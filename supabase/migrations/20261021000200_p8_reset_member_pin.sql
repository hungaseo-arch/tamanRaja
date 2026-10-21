-- P8 · 관리자 PIN 초기화
--
-- PIN 을 잊은 회원을 되살릴 길이 Supabase 콘솔 SQL 뿐이었다. 관리자 전용
-- RPC 로 연다.
--
--  reset_member_pin(id): 무작위 임시 PIN 발급(해시만 저장) → must_change =
--  true → 그 회원의 세션 전부 삭제(강제 로그아웃) → 접속 기록에 pin_reset.
--  임시 PIN 은 응답에 한 번만 실린다.
--
-- 누가 초기화했는지 남기려고 member_auth_events.actor_member_id 를 더한다.
-- user_agent 칸에 끼워 넣지 않는 이유: 그 칸은 기기 문자열이고, 화면이
-- 기기 이름으로 풀어 보여준다.
--
-- 20261021000100_p8_pin_hardening.sql(must_change · app.random_pin) 다음에
-- 적용한다. 추가형이라 구버전 프런트에는 영향이 없다 — auth_events 가 열
-- 하나(actor_name)를 더 돌려줄 뿐이다.

-- ── 1. 접속 기록: 행위자 · 새 이벤트 ────────────────────────────────────────
alter table app.member_auth_events
  add column if not exists actor_member_id integer
    references public.members(id) on delete set null;

comment on column app.member_auth_events.actor_member_id is
  '본인이 아닌 사람이 일으킨 이벤트(pin_reset)의 행위자. 그 외에는 null.';

alter table app.member_auth_events drop constraint if exists member_auth_events_event_check;
alter table app.member_auth_events add constraint member_auth_events_event_check
  check (event = any (array[
    'login', 'login_failed', 'locked', 'logout', 'idle_timeout', 'expired', 'pin_reset'
  ]));

-- ── 2. PIN 초기화 ────────────────────────────────────────────────────────────
create or replace function public.reset_member_pin(p_member_id integer)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_me       integer := app.current_member_id();
  v_temp_pin text;
begin
  perform app.require_admin();

  if not exists (select 1 from public.members m where m.id = p_member_id) then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 본인은 계정 창에서 바꾼다. 여기서 허용하면 자기 세션까지 끊긴다.
  if p_member_id = v_me then
    return json_build_object('ok', false, 'reason', 'self');
  end if;

  v_temp_pin := app.random_pin();

  -- 자격 행이 없을 수도 있다(콘솔에서 만든 회원 등). 없으면 만든다.
  insert into app.member_credentials (member_id, pin_hash, must_change)
  values (p_member_id, extensions.crypt(v_temp_pin, extensions.gen_salt('bf', 10)), true)
  on conflict (member_id) do update
     set pin_hash        = excluded.pin_hash,
         must_change     = true,
         failed_attempts = 0,
         locked_until    = null,
         updated_at      = now();

  delete from app.member_sessions where member_id = p_member_id;

  insert into app.member_auth_events (member_id, event, user_agent, actor_member_id)
  values (p_member_id, 'pin_reset', app.request_user_agent(), v_me);

  return json_build_object('ok', true, 'temp_pin', v_temp_pin);
end;
$$;

revoke all on function public.reset_member_pin(integer) from public;
grant execute on function public.reset_member_pin(integer) to anon, authenticated;

comment on function public.reset_member_pin(integer) is
  '관리자 전용. 임시 PIN 발급·변경 강제·세션 전부 폐기. 임시 PIN 은 응답에만 실린다.';

-- ── 3. 접속 기록 조회에 행위자 이름 ──────────────────────────────────────────
-- 반환 열이 바뀌므로 create or replace 로는 안 된다.
drop function if exists public.auth_events(integer, timestamptz, timestamptz, text, integer);

create function public.auth_events(
  p_member_id integer     default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_event     text        default null,
  p_limit     integer     default 300
)
returns table (
  id               bigint,
  member_id        integer,
  member_name      text,
  event            text,
  occurred_at      timestamptz,
  user_agent       text,
  duration_seconds integer,
  actor_name       text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app, public
as $$
begin
  if not app.is_admin() then
    raise exception '접속 기록은 관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.member_id,
    m.name::text,
    e.event,
    e.occurred_at,
    e.user_agent,
    case
      when e.event in ('logout', 'idle_timeout', 'expired') and e.session_hash is not null then (
        select ceil(extract(epoch from (e.occurred_at - l.occurred_at)))::integer
        from app.member_auth_events l
        where l.session_hash = e.session_hash
          and l.event = 'login'
          and l.occurred_at <= e.occurred_at
        order by l.occurred_at desc
        limit 1
      )
    end,
    a.name::text
  from app.member_auth_events e
  join public.members m on m.id = e.member_id
  left join public.members a on a.id = e.actor_member_id
  where (p_member_id is null or e.member_id = p_member_id)
    and (p_from      is null or e.occurred_at >= p_from)
    and (p_to        is null or e.occurred_at <  p_to)
    and (p_event     is null or e.event = p_event)
  order by e.occurred_at desc, e.id desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

revoke all on function public.auth_events(integer, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.auth_events(integer, timestamptz, timestamptz, text, integer) to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop function if exists public.reset_member_pin(integer);
-- auth_events: drop 후 20260907000200_p6_auth_events_rpc.sql 정의로 다시 create.
-- delete from app.member_auth_events where event = 'pin_reset';
-- alter table app.member_auth_events drop constraint member_auth_events_event_check;
-- alter table app.member_auth_events add constraint member_auth_events_event_check
--   check (event = any (array['login','login_failed','locked','logout','idle_timeout','expired']));
-- alter table app.member_auth_events drop column if exists actor_member_id;
