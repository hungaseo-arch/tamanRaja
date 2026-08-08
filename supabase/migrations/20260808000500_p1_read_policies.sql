-- P1-2: 읽기도 세션이 있어야 한다
--
-- 지금까지 기록 전체(모임·점수·핸디·참석)가 익명에게 열려 있어서, 로그인
-- 화면에 머무는 동안에도 앱이 모든 테이블을 받아왔고 익명 curl 로도 그대로
-- 읽혔다. 프런트가 "로그인 후에만 조회"로 바뀌었으니 서버도 같은 규칙으로 막는다.
--
-- members 만 예외다. 로그인 화면의 회원 선택 목록에 필요하고, PIN 은
-- 이미 app.member_credentials 로 옮겨져 이 테이블에 남아 있지 않다.

drop policy if exists select_meetings on public.meetings;
create policy meetings_select on public.meetings
  for select to anon, authenticated
  using (app.current_member_id() is not null);

drop policy if exists select_meeting_results on public.meeting_results;
create policy meeting_results_select on public.meeting_results
  for select to anon, authenticated
  using (app.current_member_id() is not null);

drop policy if exists select_monthly_handicaps on public.monthly_handicaps;
create policy monthly_handicaps_select on public.monthly_handicaps
  for select to anon, authenticated
  using (app.current_member_id() is not null);

drop policy if exists select_golf_courses on public.golf_courses;
create policy golf_courses_select on public.golf_courses
  for select to anon, authenticated
  using (app.current_member_id() is not null);

drop policy if exists attendance_select on public.attendance_confirmations;
create policy attendance_select on public.attendance_confirmations
  for select to anon, authenticated
  using (app.current_member_id() is not null);

-- members 는 로그인 목록용으로 열어둔다 (id, name, role 뿐).
drop policy if exists select_members on public.members;
create policy members_select on public.members
  for select to anon, authenticated
  using (true);
