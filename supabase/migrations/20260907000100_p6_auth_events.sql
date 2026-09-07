-- P6-1 · 로그인/로그아웃 기록 + 30분 유휴 세션 만료
--
-- 지금까지 세션은 app.member_sessions 에 있다가 로그아웃하면 그냥 사라졌다.
-- 누가 언제 들어왔다 나갔는지는 어디에도 남지 않고, 토큰은 30일 동안
-- 무조건 살아 있었다 — 공용 기기에 켜 둔 채 잊으면 한 달 내내 열려 있다.
--
-- 이 마이그레이션이 하는 일은 둘이다.
--   1. app.member_auth_events 에 로그인·로그아웃·자동 로그아웃을 남긴다.
--   2. 세션 유효 판정에 "마지막 활동 이후" 조건을 더한다 (유휴 만료).
--
-- ⚠️ 배포 순서: 새 프런트를 먼저 올린 뒤 적용한다.
--    유휴 판정은 프런트가 활동할 때마다 touch_session() 을 불러 last_seen_at
--    을 밀어주는 것을 전제로 한다. 구버전 프런트는 이 RPC 를 모르므로
--    로그인 후 35분이면 세션이 끊긴다 (기능은 동작하되 체감이 나쁘다).

-- ── 1. 유휴 시간 기준 ────────────────────────────────────────────────────────
-- 사용자에게 약속한 값은 30분이고, 그 30분을 재는 것은 프런트다
-- (src/lib/session.ts 의 IDLE_TIMEOUT_MS). 서버는 프런트가 죽었거나
-- 토큰만 따로 쓰는 경우를 막는 뒷단속이라 여유를 둔다 — 프런트는 활동이
-- 있어도 last_seen_at 갱신을 최대 5분에 한 번으로 묶으므로(요청 폭주 방지),
-- 서버가 정확히 30분으로 자르면 실제로 쓰고 있는 사람이 끊길 수 있다.
create or replace function app.idle_timeout()
returns interval
language sql
immutable
as $$
  select interval '35 minutes'
$$;

comment on function app.idle_timeout() is
  '유휴 세션 만료 기준. 프런트의 30분 + 갱신 스로틀(5분) 여유.';

-- ── 2. 감사 로그 테이블 ──────────────────────────────────────────────────────
create table if not exists app.member_auth_events (
  id           bigserial   primary key,
  member_id    integer     not null references public.members(id) on delete cascade,
  event        text        not null,
  occurred_at  timestamptz not null default now(),
  -- 로그인과 로그아웃을 한 세션으로 묶기 위한 값. 토큰 원문이 아니라
  -- member_sessions 와 같은 sha256 해시다. 화면에는 내보내지 않는다.
  session_hash text,
  -- 어떤 기기에서 들어왔는지. 계정을 나눠 쓰는지 가려내는 데 쓴다.
  user_agent   text
);

do $$
begin
  alter table app.member_auth_events
    add constraint member_auth_events_event_check
    check (event in ('login', 'login_failed', 'locked', 'logout', 'idle_timeout', 'expired'));
exception
  when duplicate_object then null;
end
$$;

comment on table app.member_auth_events is
  '회원 인증 이력. login/logout 은 본인 행위, idle_timeout/expired 는 자동 종료.';

-- 정책을 하나도 만들지 않는다 = anon/authenticated 직접 접근 전면 차단.
-- 읽기는 관리자 전용 RPC(public.auth_events)를 통해서만 열린다.
alter table app.member_auth_events enable row level security;

create index if not exists member_auth_events_member_idx  on app.member_auth_events (member_id, occurred_at desc);
create index if not exists member_auth_events_time_idx    on app.member_auth_events (occurred_at desc);
create index if not exists member_auth_events_session_idx on app.member_auth_events (session_hash);

-- ── 3. 기록 헬퍼 ─────────────────────────────────────────────────────────────
-- PostgREST 는 요청 헤더를 request.headers GUC 에 실어준다. 여기서 꺼내
-- 기기 문자열만 남긴다 (IP 는 남기지 않는다 — 모임 운영에 필요 없다).
create or replace function app.request_user_agent()
returns text
language sql
stable
as $$
  select left(nullif(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300)
$$;

create or replace function app.record_auth_event(
  p_member_id integer,
  p_event text,
  p_session_hash text default null
)
returns void
language sql
security definer
set search_path = pg_catalog, app, public
as $$
  insert into app.member_auth_events (member_id, event, session_hash, user_agent)
  values (p_member_id, p_event, p_session_hash, app.request_user_agent())
$$;

-- app 스키마에는 anon/authenticated 가 usage 를 갖고 있다. 함수 실행 권한의
-- 기본값은 PUBLIC 이므로, 명시적으로 회수하지 않으면 클라이언트가 직접 호출해
-- 없는 기록을 만들어 넣을 수 있다.
revoke all on function app.request_user_agent()                  from public;
revoke all on function app.record_auth_event(integer, text, text) from public;
revoke all on function app.idle_timeout()                        from public;

-- ── 4. 만료 세션 정리 ────────────────────────────────────────────────────────
-- 예전에는 verify_pin 이 `delete from member_sessions where expires_at < now()`
-- 한 줄로 지웠다. 이제 지우기 전에 왜 끝났는지를 남긴다.
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
        or last_seen_at <= now() - app.idle_timeout()
    returning member_id, token_hash, expires_at, last_seen_at
  )
  insert into app.member_auth_events (member_id, event, session_hash, occurred_at)
  select member_id,
         case when expires_at <= now() then 'expired' else 'idle_timeout' end,
         token_hash,
         -- 지운 시각이 아니라 실제로 끊긴 시각을 남긴다. 정리는 다음 로그인
         -- 때 몰아서 일어나므로 now() 로 적으면 몇 시간씩 어긋난다.
         least(expires_at, last_seen_at + app.idle_timeout())
  from dead;
end;
$$;

revoke all on function app.sweep_sessions() from public;

-- ── 5. 세션 유효 판정에 유휴 조건 추가 ───────────────────────────────────────
-- RLS 정책 전부가 이 함수를 거친다. 여기 한 줄이 곧 "유휴 세션으로는
-- 아무것도 읽고 쓸 수 없다" 가 된다.
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
    and s.last_seen_at > now() - app.idle_timeout()
  limit 1
$$;

-- 지금 살아 있는 세션들의 last_seen_at 은 로그인 시각 그대로다(갱신하는
-- 쪽이 없었으므로). 그대로 두면 이 마이그레이션을 적용하는 순간 로그인한 지
-- 35분 넘은 사람이 전부 튕긴다. 한 번만 현재 시각으로 밀어 준다.
update app.member_sessions set last_seen_at = now() where expires_at > now();

-- ── 6. 활동 보고 RPC ─────────────────────────────────────────────────────────
-- 프런트가 사용자의 조작을 감지할 때마다(스로틀 적용) 부른다.
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
     and last_seen_at > now() - app.idle_timeout()
  returning member_id into v_member_id;

  if v_member_id is null then
    -- 이미 끝난 세션. 프런트는 이 응답을 보고 로컬 세션을 정리한다.
    return json_build_object('ok', false);
  end if;

  return json_build_object('ok', true, 'idle_expires_at', now() + app.idle_timeout());
end;
$$;

revoke all on function public.touch_session() from public;
grant execute on function public.touch_session() to anon, authenticated;

-- ── 7. 로그아웃: 사유를 받아 기록한다 ────────────────────────────────────────
-- 인자 없는 기존 시그니처는 지운다. 기본값이 있으므로 구버전 프런트의
-- `rpc('logout')` (인자 없는 호출) 도 그대로 이 함수로 들어온다.
drop function if exists public.logout();

create or replace function public.logout(p_reason text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_hash      text := app.token_hash(app.session_token());
  v_member_id integer;
begin
  -- current_member_id() 가 아니라 해시로 직접 찾는다. 유휴로 이미 만료된
  -- 세션도 프런트가 "자동 로그아웃했다"고 알려오면 그대로 기록해야 한다.
  delete from app.member_sessions
   where token_hash = v_hash
  returning member_id into v_member_id;

  if v_member_id is null then
    return;
  end if;

  perform app.record_auth_event(
    v_member_id,
    case when p_reason = 'idle' then 'idle_timeout' else 'logout' end,
    v_hash
  );
end;
$$;

revoke all on function public.logout(text) from public;
grant execute on function public.logout(text) to anon, authenticated;

-- ── 8. 로그인: 성공·실패·잠금을 모두 남긴다 ──────────────────────────────────
create or replace function public.verify_pin(p_member_id integer, p_pin text)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_member public.members%rowtype;
  v_cred   app.member_credentials%rowtype;
  v_fails  integer;
  v_token  text;
  v_hash   text;
  v_expires timestamptz;
  c_ttl        constant interval := interval '30 days';
  c_max_fails  constant integer  := 5;
  c_lock_for   constant interval := interval '15 minutes';
  c_retention  constant interval := interval '180 days';
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_cred
  from app.member_credentials
  where member_id = p_member_id
  for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- 잠금 중
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return json_build_object(
      'ok', false,
      'reason', 'locked',
      'retry_after_seconds', ceil(extract(epoch from (v_cred.locked_until - now())))
    );
  end if;

  -- 잠금이 이미 풀렸으면 카운터를 0에서 다시 시작한다
  v_fails := case
               when v_cred.locked_until is not null and v_cred.locked_until <= now() then 0
               else v_cred.failed_attempts
             end;

  if p_pin is null or extensions.crypt(p_pin, v_cred.pin_hash) <> v_cred.pin_hash then
    v_fails := v_fails + 1;

    update app.member_credentials
       set failed_attempts = v_fails,
           locked_until    = case when v_fails >= c_max_fails then now() + c_lock_for end,
           updated_at      = now()
     where member_id = p_member_id;

    -- 실패도 남긴다. 남의 계정을 두드려 보는 일이 있었는지는 성공 기록만
    -- 봐서는 알 수 없다. PIN 값 자체는 어디에도 적지 않는다.
    perform app.record_auth_event(
      p_member_id,
      case when v_fails >= c_max_fails then 'locked' else 'login_failed' end
    );

    if v_fails >= c_max_fails then
      return json_build_object(
        'ok', false,
        'reason', 'locked',
        'retry_after_seconds', ceil(extract(epoch from c_lock_for))
      );
    end if;

    return json_build_object(
      'ok', false,
      'reason', 'invalid',
      'remaining_attempts', c_max_fails - v_fails
    );
  end if;

  -- 성공
  update app.member_credentials
     set failed_attempts = 0,
         locked_until    = null,
         updated_at      = now()
   where member_id = p_member_id;

  v_token   := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash    := app.token_hash(v_token);
  v_expires := now() + c_ttl;

  insert into app.member_sessions (token_hash, member_id, expires_at)
  values (v_hash, p_member_id, v_expires);

  perform app.record_auth_event(p_member_id, 'login', v_hash);

  -- 끝난 세션 정리(사유 기록 포함) + 오래된 이력 폐기.
  -- 로그인은 드물게 일어나는 일이라 정리를 얹기 좋은 자리다.
  perform app.sweep_sessions();
  delete from app.member_auth_events where occurred_at < now() - c_retention;

  return json_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'member', json_build_object('id', v_member.id, 'name', v_member.name, 'role', v_member.role)
  );
end;
$$;

revoke all on function public.verify_pin(integer, text) from public;
grant execute on function public.verify_pin(integer, text) to anon, authenticated;
