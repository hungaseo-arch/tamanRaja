-- 유휴 자동 로그아웃 한도를 역할별로 나눈다.
--   관리자 : 마지막 조작 후 30분 (프런트 30분 + 갱신 스로틀 5분 여유 = 35분)
--   회원   : 마지막 조작 후 3시간 (프런트 3시간 + 갱신 스로틀 5분 여유 = 3시간 5분)
-- 관리자는 결과 수정·PIN 초기화 권한이 있어 기존 30분을 유지한다.
-- 서버 토큰 자체의 만료(expires_at, 30일)는 바꾸지 않는다.

create or replace function app.idle_timeout_for(p_member_id integer)
returns interval
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
           when exists (select 1 from public.members m where m.id = p_member_id and m.role = 'admin')
             then interval '35 minutes'
           else interval '185 minutes'
         end
$$;

comment on function app.idle_timeout_for(integer) is
  '역할별 유휴 세션 만료 기준. 관리자 30분, 회원 3시간 + 각각 갱신 스로틀(5분) 여유. 프런트 src/lib/session.ts 와 맞춘다.';

revoke all on function app.idle_timeout_for(integer) from public;

-- 만료 세션 정리 (p6 정의에서 유휴 기준만 역할별로 교체)
create or replace function app.sweep_sessions()
returns void
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
begin
  with dead as (
    delete from app.member_sessions
     where expires_at <= now()
        or last_seen_at <= now() - app.idle_timeout_for(member_id)
    returning member_id, token_hash, expires_at, last_seen_at
  )
  insert into app.member_auth_events (member_id, event, session_hash, occurred_at)
  select member_id,
         case when expires_at <= now() then 'expired' else 'idle_timeout' end,
         token_hash,
         least(expires_at, last_seen_at + app.idle_timeout_for(member_id))
  from dead;
end;
$$;

revoke all on function app.sweep_sessions() from public;

-- 세션 유효 판정 (RLS 전 정책이 거치는 함수)
create or replace function app.current_member_id()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select s.member_id
  from app.member_sessions s
  where s.token_hash = app.token_hash(app.session_token())
    and s.expires_at > now()
    and s.last_seen_at > now() - app.idle_timeout_for(s.member_id)
  limit 1
$$;

-- 활동 보고 RPC
create or replace function public.touch_session()
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_hash      text := app.token_hash(app.session_token());
  v_member_id integer;
begin
  perform app.sweep_sessions();

  update app.member_sessions
     set last_seen_at = now()
   where token_hash = v_hash
     and expires_at > now()
     and last_seen_at > now() - app.idle_timeout_for(member_id)
  returning member_id into v_member_id;

  if v_member_id is null then
    return json_build_object('ok', false);
  end if;

  return json_build_object('ok', true, 'idle_expires_at', now() + app.idle_timeout_for(v_member_id));
end;
$$;

revoke all on function public.touch_session() from public;
grant execute on function public.touch_session() to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- 20260907000100_p6_auth_events.sql 의 sweep_sessions / current_member_id / touch_session 정의로
-- 되돌리고(app.idle_timeout() 35분 사용), 아래를 실행한다.
-- drop function if exists app.idle_timeout_for(integer);
