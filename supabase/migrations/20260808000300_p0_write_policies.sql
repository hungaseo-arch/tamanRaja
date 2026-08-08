-- P0-2 / P0-1 마무리: 쓰기 권한 서버측 검증 + 평문 PIN 테이블 노출 차단
--
-- ⚠️ 2단계(잠금) 마이그레이션이다. 새 프런트엔드(x-taman-session 헤더를 보내는
--    빌드)를 배포한 뒤에 적용해야 한다. 먼저 적용하면 배포 중인 구버전 프런트가
--    anon 으로 쓰기를 시도하다 403 을 받는다.
--
-- 쓰기 규칙은 프런트의 isManager 와 동일하게 맞춘다:
--   관리자(members.role='admin') 또는 "해당 월의 전월 Host".
--   지침서에는 관리자 전용으로 적혀 있으나, 전월 Host 가 다음 모임을 기획하는
--   동작이 실제로 쓰이고 있어 그대로 서버에서 재검증한다. 화면 노출 조건과
--   서버 정책이 같은 규칙을 공유하는 것이 핵심이다.

-- ---------------------------------------------------------------------------
-- 1. 권한 판정 헬퍼
-- ---------------------------------------------------------------------------

create or replace function app.prev_year_month(p_year_month text)
returns text
language sql
immutable
as $$
  select to_char(to_date(p_year_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')
$$;

-- 해당 연월의 모임을 편집할 수 있는가?
create or replace function app.can_manage_month(p_year_month text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select case
    when app.current_member_id() is null then false
    when app.is_admin() then true
    when p_year_month is null then false
    else exists (
      select 1
      from public.meetings pm
      left join public.meeting_results r
        on r.meeting_id = pm.id and r.result_rank = 'Host'
      where pm.year_month = app.prev_year_month(p_year_month)
        and app.current_member_id() in (pm.host_member_id, r.member_id)
    )
  end
$$;

-- meeting_results 는 연월을 직접 갖고 있지 않으므로 meeting 을 거쳐 판정한다.
create or replace function app.can_manage_meeting(p_meeting_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select app.can_manage_month(
    (select m.year_month::text from public.meetings m where m.id = p_meeting_id)
  )
$$;

-- 골프장 신규 등록용. 특정 월에 묶이지 않으므로 "관리자 또는 Host 이력이 있는 회원".
create or replace function app.is_meeting_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select case
    when app.current_member_id() is null then false
    when app.is_admin() then true
    else exists (
      select 1 from public.meetings m where m.host_member_id = app.current_member_id()
    ) or exists (
      select 1 from public.meeting_results r
      where r.member_id = app.current_member_id() and r.result_rank = 'Host'
    )
  end
$$;

revoke all on function app.prev_year_month(text) from public;
revoke all on function app.can_manage_month(text) from public;
revoke all on function app.can_manage_meeting(integer) from public;
revoke all on function app.is_meeting_manager() from public;
grant execute on function app.prev_year_month(text) to anon, authenticated;
grant execute on function app.can_manage_month(text) to anon, authenticated;
grant execute on function app.can_manage_meeting(integer) to anon, authenticated;
grant execute on function app.is_meeting_manager() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. meetings — 누구나 읽기, 편집은 권한자만
-- ---------------------------------------------------------------------------

drop policy if exists anon_write_meetings on public.meetings;

create policy meetings_insert on public.meetings
  for insert to anon, authenticated
  with check (app.can_manage_month(year_month::text));

create policy meetings_update on public.meetings
  for update to anon, authenticated
  using (app.can_manage_month(year_month::text))
  with check (app.can_manage_month(year_month::text));

create policy meetings_delete on public.meetings
  for delete to anon, authenticated
  using (app.can_manage_month(year_month::text));

-- ---------------------------------------------------------------------------
-- 3. meeting_results — 점수/결과. 권한자만 쓰기
-- ---------------------------------------------------------------------------

drop policy if exists anon_write_meeting_results on public.meeting_results;

create policy meeting_results_insert on public.meeting_results
  for insert to anon, authenticated
  with check (app.can_manage_meeting(meeting_id));

create policy meeting_results_update on public.meeting_results
  for update to anon, authenticated
  using (app.can_manage_meeting(meeting_id))
  with check (app.can_manage_meeting(meeting_id));

create policy meeting_results_delete on public.meeting_results
  for delete to anon, authenticated
  using (app.can_manage_meeting(meeting_id));

-- ---------------------------------------------------------------------------
-- 4. golf_courses — 신규 골프장 등록
-- ---------------------------------------------------------------------------

drop policy if exists anon_insert_golf_courses on public.golf_courses;

create policy golf_courses_insert on public.golf_courses
  for insert to anon, authenticated
  with check (app.is_meeting_manager());

-- ---------------------------------------------------------------------------
-- 5. attendance_confirmations — 본인 행만 (관리자는 대리 수정 허용)
-- ---------------------------------------------------------------------------

drop policy if exists allow_all on public.attendance_confirmations;

create policy attendance_select on public.attendance_confirmations
  for select to anon, authenticated
  using (true);

create policy attendance_insert on public.attendance_confirmations
  for insert to anon, authenticated
  with check (member_id = app.current_member_id() or app.is_admin());

create policy attendance_update on public.attendance_confirmations
  for update to anon, authenticated
  using (member_id = app.current_member_id() or app.is_admin())
  with check (member_id = app.current_member_id() or app.is_admin());

create policy attendance_delete on public.attendance_confirmations
  for delete to anon, authenticated
  using (member_id = app.current_member_id() or app.is_admin());

-- ---------------------------------------------------------------------------
-- 6. monthly_handicaps — 쓰기 정책 없음(의도적)
--    핸디는 meeting_results 트리거 trg_recompute_next_hc → recompute_next_hc()
--    (SECURITY DEFINER, owner=postgres) 가 계산해 넣는다. RLS 를 우회하므로
--    클라이언트에 쓰기 정책을 열어줄 필요가 없다.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. member_pins — 평문 PIN 테이블을 PostgREST 노출 스키마에서 제거
--    삭제하지 않고 app 스키마로 옮긴다(비노출 + 롤백 가능). 인증은 이제
--    app.member_credentials(bcrypt 해시) 를 쓰는 verify_pin RPC 가 담당한다.
-- ---------------------------------------------------------------------------

drop policy if exists allow_select on public.member_pins;
drop policy if exists allow_update on public.member_pins;

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'member_pins'
  ) then
    execute 'alter table public.member_pins set schema app';
  end if;
end $$;

revoke all on table app.member_pins from anon, authenticated;
