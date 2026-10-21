-- P8 · 초기 PIN 무작위화 + 첫 로그인 PIN 변경 강제
--
-- 지금까지 add_member() 는 모든 신규 회원에게 같은 PIN 을 넣었다(p7 의
-- c_default_pin). 저장소가 public 이라 그 값은 누구나 볼 수 있고, 로그인
-- 화면은 익명에게 회원 이름을 보여준다 — 이름 + 공개 PIN 이면 바로 들어온다.
--
--  1) member_credentials.must_change: 관리자가 정한 임시 PIN 인 상태.
--     프런트는 이 값이 true 면 닫을 수 없는 PIN 변경 창을 띄운다.
--  2) add_member(): 고정값 대신 무작위 4자리. 응답의 temp_pin 으로 관리자
--     화면에 한 번만 보여주고, DB 에는 해시만 남는다.
--  3) verify_pin() · session_member(): 응답에 must_change 를 싣는다.
--     session_member 에도 싣는 이유: 새로고침해도 변경 창이 다시 떠야 한다.
--  4) change_pin(): 쉬운 PIN(같은 숫자 반복·연속 숫자·옛 기본값) 거절,
--     성공하면 must_change 해제.
--  5) 옛 기본값을 그대로 쓰는 기존 회원은 must_change = true. PIN 자체는
--     바꾸지 않는다 — 본인이 알던 PIN 으로 로그인한 뒤 바로 바꾸게 된다.
--
-- 추가형 변경이다. 응답에 필드가 늘 뿐이라 구버전 프런트는 그대로 동작한다.
-- (단, 구버전 회원 관리 화면은 temp_pin 을 보여주지 않으므로 이 마이그레이션
--  적용 뒤 프런트 배포 전까지는 회원 추가를 하지 않는다.)
--
-- 옛 기본값 문자열: p7 에서 이미 공개된 값이다. 여기서는 "다시 쓰지 못하게"
-- 하는 목록과 기존 회원 표시에만 쓴다. 새 PIN 을 만드는 데 쓰지 않는다.

-- ── 1. 컬럼 ──────────────────────────────────────────────────────────────────
alter table app.member_credentials
  add column if not exists must_change boolean not null default false;

comment on column app.member_credentials.must_change is
  'true = 관리자가 정한 임시 PIN(또는 옛 공통 기본값). 다음 로그인에서 변경을 강제한다.';

-- ── 2. 쉬운 PIN 판정 · 무작위 PIN ───────────────────────────────────────────
create or replace function app.is_weak_pin(p_pin text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_pin is null
      or p_pin !~ '^[0-9]{4}$'
      or p_pin ~ '^([0-9])\1{3}$'                    -- 0000 · 1111 …
      or position(p_pin in '0123456789') > 0         -- 0123 · 1234 …
      or position(p_pin in '9876543210') > 0         -- 4321 · 9876 …
      or p_pin = '2322'                              -- p7 의 옛 공통 기본값(공개됨)
$$;

revoke all on function app.is_weak_pin(text) from public;

-- random() 이 아니라 gen_random_bytes — 임시 PIN 도 추측되면 안 된다.
-- 32비트 값을 10000 으로 나눈 나머지라 치우침은 0.0003% 미만이다.
create or replace function app.random_pin()
returns text
language plpgsql
volatile
set search_path = pg_catalog, extensions
as $$
declare
  v_pin text;
begin
  loop
    v_pin := lpad(
      ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 10000)::text,
      4, '0');
    exit when not app.is_weak_pin(v_pin);
  end loop;
  return v_pin;
end;
$$;

revoke all on function app.random_pin() from public;

-- ── 3. 회원 추가 (p7 정의를 대체) ────────────────────────────────────────────
create or replace function public.add_member(
  p_name            text,
  p_std_hc          integer,
  p_enrollment_year integer default null,
  p_start_month     text    default null,
  p_role            text    default 'member'
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_year  integer := coalesce(p_enrollment_year, extract(year from now())::integer);
  v_month text := coalesce(nullif(btrim(coalesce(p_start_month, '')), ''), to_char(now(), 'YYYY-MM'));
  v_id    integer;
  -- 이 응답에만 실려 나간다. 테이블·로그 어디에도 평문으로 남기지 않는다.
  v_temp_pin text := app.random_pin();
begin
  perform app.require_admin();

  if v_name = '' or length(v_name) > 50 then
    return json_build_object('ok', false, 'reason', 'invalid_name');
  end if;

  if exists (select 1 from public.members m where btrim(m.name) = v_name) then
    return json_build_object('ok', false, 'reason', 'duplicate_name');
  end if;

  if p_std_hc is null or p_std_hc < 0 or p_std_hc > 54 then
    return json_build_object('ok', false, 'reason', 'invalid_std_hc');
  end if;

  if v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    return json_build_object('ok', false, 'reason', 'invalid_month');
  end if;

  if p_role not in ('admin', 'member') then
    return json_build_object('ok', false, 'reason', 'invalid_role');
  end if;

  insert into public.members (name, enrollment_year, role, is_active)
  values (v_name, v_year, p_role, true)
  returning id into v_id;

  insert into app.member_credentials (member_id, pin_hash, must_change)
  values (v_id, extensions.crypt(v_temp_pin, extensions.gen_salt('bf', 10)), true);

  insert into public.monthly_handicaps (member_id, year_month, std_hc, app_hc, next_hc)
  values (v_id, v_month, p_std_hc, p_std_hc, null);

  return json_build_object(
    'ok', true,
    'member', json_build_object('id', v_id, 'name', v_name, 'role', p_role),
    'temp_pin', v_temp_pin
  );
end;
$$;

-- ── 4. 로그인 (운영 정의 + must_change) ──────────────────────────────────────
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

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return json_build_object(
      'ok', false,
      'reason', 'locked',
      'retry_after_seconds', ceil(extract(epoch from (v_cred.locked_until - now())))
    );
  end if;

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

  perform app.sweep_sessions();
  delete from app.member_auth_events where occurred_at < now() - c_retention;

  return json_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'must_change', v_cred.must_change,
    'member', json_build_object('id', v_member.id, 'name', v_member.name, 'role', v_member.role)
  );
end;
$$;

-- ── 5. 세션 확인 (새로고침 뒤에도 변경 창 유지) ─────────────────────────────
create or replace function public.session_member()
returns json
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select json_build_object(
           'id', m.id,
           'name', m.name,
           'role', m.role,
           'must_change', coalesce(c.must_change, false)
         )
  from public.members m
  left join app.member_credentials c on c.member_id = m.id
  where m.id = app.current_member_id()
$$;

-- ── 6. PIN 변경 (운영 정의 + 쉬운 PIN 거절 + must_change 해제) ──────────────
create or replace function public.change_pin(p_old_pin text, p_new_pin text)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_member_id integer := app.current_member_id();
  v_cred      app.member_credentials%rowtype;
begin
  if v_member_id is null then
    return json_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'reason', 'invalid_format');
  end if;

  select * into v_cred
  from app.member_credentials
  where member_id = v_member_id
  for update;

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return json_build_object('ok', false, 'reason', 'locked');
  end if;

  if extensions.crypt(coalesce(p_old_pin, ''), v_cred.pin_hash) <> v_cred.pin_hash then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  if p_old_pin = p_new_pin then
    return json_build_object('ok', false, 'reason', 'same');
  end if;

  if app.is_weak_pin(p_new_pin) then
    return json_build_object('ok', false, 'reason', 'weak');
  end if;

  update app.member_credentials
     set pin_hash        = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
         failed_attempts = 0,
         locked_until    = null,
         must_change     = false,
         updated_at      = now()
   where member_id = v_member_id;

  delete from app.member_sessions
  where member_id = v_member_id
    and token_hash <> app.token_hash(app.session_token());

  return json_build_object('ok', true);
end;
$$;

-- ── 7. 옛 공통 기본값을 그대로 쓰는 회원 표시 ────────────────────────────────
-- 누구인지는 어디에도 출력하지 않는다. 다음 로그인 때 변경 창이 뜬다.
update app.member_credentials
   set must_change = true
 where pin_hash = extensions.crypt('2322', pin_hash);

-- ── rollback ─────────────────────────────────────────────────────────────────
-- 함수: 20260907000400_p7_member_admin.sql 의 add_member, 그리고 이 파일 이전
--       운영 정의(verify_pin · session_member · change_pin — must_change 관련
--       줄만 뺀 것)를 create or replace 로 되돌린다.
-- drop function if exists app.random_pin();
-- drop function if exists app.is_weak_pin(text);
-- alter table app.member_credentials drop column if exists must_change;
