-- P0-1 / P0-2 · 1단계(추가 전용)
--
-- 서버측 PIN 검증·세션·회원 권한의 기반을 만든다.
-- 이 단계는 기존 테이블/정책을 하나도 바꾸지 않으므로, 배포 중인 프런트엔드는
-- 그대로 동작한다. 실제 차단(평문 PIN 제거·쓰기 정책 잠금)은 새 프런트엔드를
-- 배포한 뒤 2단계 마이그레이션에서 수행한다.
--
-- 세션 토큰은 요청 헤더 `x-taman-session` 으로 전달되며, PostgREST 가 이를
-- `request.headers` GUC 에 실어주므로 RLS 정책에서 호출자를 식별할 수 있다.

-- ── 내부 스키마 ───────────────────────────────────────────────────────────────
-- PostgREST 는 public/graphql_public 만 노출하므로 app 스키마의 테이블은
-- REST 로 접근할 수 없다. 헬퍼 함수 실행 권한만 열어준다.
create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ── 1. 회원 권한 (P0-2) ───────────────────────────────────────────────────────
alter table public.members
  add column if not exists role text not null default 'member';

do $$
begin
  alter table public.members
    add constraint members_role_check check (role in ('admin', 'member'));
exception
  when duplicate_object then null;
end
$$;

-- 기존 프런트엔드 하드코딩(src/lib/index.ts 의 ADMIN_NAMES)을 그대로 이관
update public.members set role = 'admin' where name in ('서종환', '조학영');

-- ── 2. 자격 증명: 평문 PIN → bcrypt 해시 ─────────────────────────────────────
create table if not exists app.member_credentials (
  member_id       integer     primary key references public.members(id) on delete cascade,
  pin_hash        text        not null,
  failed_attempts integer     not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

-- 정책을 하나도 만들지 않는다 = anon/authenticated 전면 차단.
-- 접근은 아래 SECURITY DEFINER 함수를 통해서만 가능하다.
alter table app.member_credentials enable row level security;

-- 기존 평문 PIN 이관.
-- '0000' 은 프런트엔드가 런타임에 '2322' 로 치환해 쓰던 기본값이므로 동일하게 맞춘다.
insert into app.member_credentials (member_id, pin_hash)
select p.member_id,
       extensions.crypt(
         case when p.pin = '0000' then '2322' else p.pin end,
         extensions.gen_salt('bf', 10)
       )
from public.member_pins p
on conflict (member_id) do nothing;

-- member_pins 행이 없는 회원도 기본 PIN 으로 채워 로그인 가능 상태를 유지
insert into app.member_credentials (member_id, pin_hash)
select m.id, extensions.crypt('2322', extensions.gen_salt('bf', 10))
from public.members m
on conflict (member_id) do nothing;

-- ── 3. 세션 ──────────────────────────────────────────────────────────────────
-- 토큰 원문이 아니라 sha256 해시를 저장한다. DB 덤프가 유출되어도 살아있는
-- 세션을 그대로 탈취할 수 없다.
create table if not exists app.member_sessions (
  token_hash   text        primary key,
  member_id    integer     not null references public.members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

alter table app.member_sessions enable row level security;

create index if not exists member_sessions_member_idx  on app.member_sessions (member_id);
create index if not exists member_sessions_expires_idx on app.member_sessions (expires_at);

-- ── 4. 세션 헬퍼 ─────────────────────────────────────────────────────────────
create or replace function app.session_token()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-taman-session', '')
$$;

create or replace function app.token_hash(p_token text)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, public
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- 현재 요청의 회원 id. 세션이 없거나 만료됐으면 NULL.
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
  limit 1
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select exists (
    select 1
    from public.members m
    where m.id = app.current_member_id()
      and m.role = 'admin'
  )
$$;

grant execute on function
  app.session_token(),
  app.token_hash(text),
  app.current_member_id(),
  app.is_admin()
to anon, authenticated;

-- ── 5. 로그인 RPC (P0-1) ─────────────────────────────────────────────────────
-- 실패 5회 누적 시 15분 잠금. PIN 대조는 전적으로 서버에서만 일어난다.
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
  v_expires timestamptz;
  c_ttl        constant interval := interval '30 days';
  c_max_fails  constant integer  := 5;
  c_lock_for   constant interval := interval '15 minutes';
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
  v_expires := now() + c_ttl;

  insert into app.member_sessions (token_hash, member_id, expires_at)
  values (app.token_hash(v_token), p_member_id, v_expires);

  delete from app.member_sessions where expires_at < now();

  return json_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'member', json_build_object('id', v_member.id, 'name', v_member.name, 'role', v_member.role)
  );
end;
$$;

-- ── 6. 세션 조회 / 로그아웃 / PIN 변경 ───────────────────────────────────────
create or replace function public.session_member()
returns json
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select json_build_object('id', m.id, 'name', m.name, 'role', m.role)
  from public.members m
  where m.id = app.current_member_id()
$$;

create or replace function public.logout()
returns void
language sql
security definer
set search_path = pg_catalog, app, public
as $$
  delete from app.member_sessions
  where token_hash = app.token_hash(app.session_token())
$$;

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

  update app.member_credentials
     set pin_hash        = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
         failed_attempts = 0,
         locked_until    = null,
         updated_at      = now()
   where member_id = v_member_id;

  -- PIN 을 바꿨으면 다른 기기의 세션은 모두 끊는다(현재 세션만 유지)
  delete from app.member_sessions
  where member_id = v_member_id
    and token_hash <> app.token_hash(app.session_token());

  return json_build_object('ok', true);
end;
$$;

-- ── 7. RPC 실행 권한 ─────────────────────────────────────────────────────────
revoke all on function public.verify_pin(integer, text)   from public;
revoke all on function public.session_member()            from public;
revoke all on function public.logout()                    from public;
revoke all on function public.change_pin(text, text)      from public;

grant execute on function public.verify_pin(integer, text) to anon, authenticated;
grant execute on function public.session_member()          to anon, authenticated;
grant execute on function public.logout()                  to anon, authenticated;
grant execute on function public.change_pin(text, text)    to anon, authenticated;
