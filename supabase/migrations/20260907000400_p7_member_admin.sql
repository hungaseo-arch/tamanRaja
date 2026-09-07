-- P7 · 회원 관리 (추가 · 삭제 · 등급 변경)
--
-- public.members 에는 지금까지 SELECT 정책 하나뿐이라 명단을 손대려면 콘솔에
-- 들어가야 했다. 쓰기 정책을 새로 여는 대신 관리자 전용 RPC 로 처리한다.
-- 이유가 둘이다.
--
--  1) 회원 추가는 members 한 행으로 끝나지 않는다. app.member_credentials
--     (로그인) 과 monthly_handicaps (월간 기록 표에 등장) 가 같이 있어야
--     한다. monthly_handicaps 는 트리거 전용이라 쓰기 정책이 아예 없고
--     (P0-3 §6), member_credentials 는 app 스키마라 REST 로 닿지 않는다.
--     세 테이블을 한 트랜잭션으로 묶을 수 있는 곳은 여기뿐이다.
--  2) 삭제는 그냥 열어 주면 안 된다. members 를 참조하는 FK 가 전부
--     on delete cascade 라, 기록이 있는 회원을 지우면 meeting_results 와
--     monthly_handicaps 가 함께 사라진다. 실제로 지금 20명 전원이 결과를
--     7~53건씩 갖고 있다. 아래 delete_member() 는 기록이 하나라도 있으면
--     거절하고 휴면 처리를 안내한다.
--
-- 추가 전용 마이그레이션이다. 기존 정책·함수를 건드리지 않으므로 배포 중인
-- 구버전 프런트엔드는 그대로 동작한다.

-- ── 0. 공통 가드 ─────────────────────────────────────────────────────────────
-- 화면에서 메뉴를 감추는 것은 편의일 뿐이고 실제 경계는 여기다.
create or replace function app.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, app, public
as $$
begin
  if not app.is_admin() then
    raise exception '회원 관리는 관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.require_admin() from public;

-- ── 1. 관리자용 회원 목록 ────────────────────────────────────────────────────
-- 화면이 members 를 직접 select 하지 못하는 이유: anon 에게 members.role 의
-- SELECT 권한이 없다(P1-2 의 컬럼 단위 권한). 등급을 보여주려면 이 RPC 를
-- 거쳐야 한다. 기록 건수와 마지막 로그인도 함께 낸다 — 삭제 가능 여부와
-- "이 사람 아직 쓰고 있나" 를 같은 화면에서 판단하려는 것이다.
create or replace function public.admin_members()
returns table (
  id              integer,
  name            text,
  role            text,
  enrollment_year integer,
  dormant_from    text,
  result_count    integer,
  hosted_count    integer,
  last_login_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app, public
as $$
begin
  perform app.require_admin();

  return query
  select m.id,
         m.name::text,
         m.role,
         m.enrollment_year,
         m.dormant_from::text,
         (select count(*)::integer from public.meeting_results r where r.member_id = m.id),
         (select count(*)::integer from public.meetings g      where g.host_member_id = m.id),
         (select max(e.occurred_at)
            from app.member_auth_events e
           where e.member_id = m.id and e.event = 'login')
  from public.members m
  order by m.id;
end;
$$;

-- ── 2. 회원 추가 ─────────────────────────────────────────────────────────────
-- 기준핸디와 시작월을 함께 받는다. monthly_handicaps 행이 없으면
-- getMonthlyData() 의 resolveHandicap() 이 null 을 돌려주고 그 회원은 월간
-- 기록 표에서 통째로 빠진다 — 추가는 됐는데 화면에 안 보이는 상태가 된다.
-- 첫 달의 당월핸디는 기준핸디와 같다 (기존 신규 회원도 그렇게 들어와 있다).
--
-- 이름 중복을 막는 이유: 휴면 판정 isActive() 가 아직 이름으로 회원을 찾는다.
-- 동명이인이 생기면 한 사람의 휴면이 다른 사람에게 옮겨 붙는다.
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
  -- P0-1 에서 PIN 이 없던 회원을 채울 때 쓴 값과 같다. 화면에도 로그에도
  -- 남기지 않고, 첫 로그인 뒤 본인이 바꾸는 것을 전제로 한다.
  c_default_pin constant text := '2322';
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

  insert into app.member_credentials (member_id, pin_hash)
  values (v_id, extensions.crypt(c_default_pin, extensions.gen_salt('bf', 10)));

  insert into public.monthly_handicaps (member_id, year_month, std_hc, app_hc, next_hc)
  values (v_id, v_month, p_std_hc, p_std_hc, null);

  return json_build_object(
    'ok', true,
    'member', json_build_object('id', v_id, 'name', v_name, 'role', p_role)
  );
end;
$$;

-- ── 3. 등급 변경 ─────────────────────────────────────────────────────────────
-- 두 가지를 막는다. 자기 자신을 강등하면 그 자리에서 관리 화면을 잃고,
-- 마지막 관리자를 강등하면 아무도 되돌릴 수 없다 (콘솔로만 복구 가능).
create or replace function public.set_member_role(p_member_id integer, p_role text)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_me      integer := app.current_member_id();
  v_current text;
begin
  perform app.require_admin();

  if p_role not in ('admin', 'member') then
    return json_build_object('ok', false, 'reason', 'invalid_role');
  end if;

  select m.role into v_current from public.members m where m.id = p_member_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_current = p_role then
    return json_build_object('ok', true, 'role', p_role);
  end if;

  if p_role = 'member' then
    if p_member_id = v_me then
      return json_build_object('ok', false, 'reason', 'self_demote');
    end if;
    if (select count(*) from public.members m where m.role = 'admin') <= 1 then
      return json_build_object('ok', false, 'reason', 'last_admin');
    end if;
  end if;

  update public.members set role = p_role, updated_at = now() where id = p_member_id;

  return json_build_object('ok', true, 'role', p_role);
end;
$$;

-- ── 4. 휴면 · 복귀 ───────────────────────────────────────────────────────────
-- 기록이 있는 회원을 명단에서 빼는 정상 경로다. dormant_from 이후의 경기는
-- 집계·랭킹·로그인 목록에서 빠지지만 지난 기록은 그대로 남는다.
-- is_active 를 같이 맞추는 이유: 지금 데이터가 둘을 항상 짝지어 두고 있다.
create or replace function public.set_member_dormant(p_member_id integer, p_from text default null)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_from text := nullif(btrim(coalesce(p_from, '')), '');
begin
  perform app.require_admin();

  if v_from is not null and v_from !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    return json_build_object('ok', false, 'reason', 'invalid_month');
  end if;

  if not exists (select 1 from public.members m where m.id = p_member_id) then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.members
     set dormant_from = v_from,
         is_active    = (v_from is null),
         updated_at   = now()
   where id = p_member_id;

  -- 휴면 처리는 로그인을 막는 장치가 아니지만, 살아 있는 세션을 남겨 둘
  -- 이유도 없다. 복귀(v_from is null)일 때는 건드리지 않는다.
  if v_from is not null then
    delete from app.member_sessions where member_id = p_member_id;
  end if;

  return json_build_object('ok', true, 'dormant_from', v_from);
end;
$$;

-- ── 5. 회원 삭제 ─────────────────────────────────────────────────────────────
-- 기록이 하나라도 있으면 거절한다. members 를 참조하는 FK 가 전부 cascade 라
-- 여기서 막지 않으면 delete 한 번에 그 회원의 점수·핸디가 전부 사라진다.
-- 실질적으로 "잘못 추가한 회원을 되돌리는" 통로다. 활동했던 회원을 명단에서
-- 빼는 것은 set_member_dormant() 쪽이다.
create or replace function public.delete_member(p_member_id integer)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_me       integer := app.current_member_id();
  v_role     text;
  v_results  integer;
  v_handicaps integer;
  v_hosted   integer;
begin
  perform app.require_admin();

  select m.role into v_role from public.members m where m.id = p_member_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_member_id = v_me then
    return json_build_object('ok', false, 'reason', 'self');
  end if;

  if v_role = 'admin' and (select count(*) from public.members m where m.role = 'admin') <= 1 then
    return json_build_object('ok', false, 'reason', 'last_admin');
  end if;

  select count(*) into v_results   from public.meeting_results   r where r.member_id = p_member_id;
  select count(*) into v_handicaps from public.monthly_handicaps h where h.member_id = p_member_id;
  select count(*) into v_hosted    from public.meetings          g where g.host_member_id = p_member_id;

  -- 핸디는 회원 추가 때 우리가 넣은 시드 한 줄일 수 있으므로 그 자체로는
  -- 막지 않는다. 경기 결과나 기획 이력이 있으면 그때부터 운영 기록이다.
  if v_results > 0 or v_hosted > 0 then
    return json_build_object(
      'ok', false,
      'reason', 'has_records',
      'result_count', v_results,
      'hosted_count', v_hosted
    );
  end if;

  -- member_credentials · member_sessions · member_auth_events ·
  -- monthly_handicaps 는 FK 의 on delete cascade 로 함께 지워진다.
  delete from public.members where id = p_member_id;

  return json_build_object('ok', true, 'handicap_count', v_handicaps);
end;
$$;

-- ── 6. 실행 권한 ─────────────────────────────────────────────────────────────
-- 함수 실행 권한의 기본값이 PUBLIC 이라 회수부터 한다. 그 다음 anon 에게만
-- 준다 — 이 앱은 Supabase Auth 를 쓰지 않아 로그인한 사용자도 anon 이다.
-- 관리자 판정은 함수 안의 app.require_admin() 이 세션 토큰으로 한다.
revoke all on function public.admin_members()                          from public;
revoke all on function public.add_member(text, integer, integer, text, text) from public;
revoke all on function public.set_member_role(integer, text)           from public;
revoke all on function public.set_member_dormant(integer, text)        from public;
revoke all on function public.delete_member(integer)                   from public;

grant execute on function public.admin_members()                          to anon, authenticated;
grant execute on function public.add_member(text, integer, integer, text, text) to anon, authenticated;
grant execute on function public.set_member_role(integer, text)           to anon, authenticated;
grant execute on function public.set_member_dormant(integer, text)        to anon, authenticated;
grant execute on function public.delete_member(integer)                   to anon, authenticated;

comment on function public.admin_members() is
  '관리자용 회원 목록. anon 에게 members.role SELECT 권한이 없어 이 RPC 로만 등급을 본다.';
comment on function public.delete_member(integer) is
  '기록 없는 회원만 삭제. 기록이 있으면 has_records 로 거절하고 휴면 처리로 유도한다.';
