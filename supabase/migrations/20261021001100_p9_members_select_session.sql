-- 5-4 (2/2): members 테이블 조회를 로그인 세션으로 제한
--
-- 반드시 20261021001000_p9_login_members.sql 적용 + 프런트 배포(로그인
-- 화면이 login_members() 를 부르는 버전) 확인 뒤에 적용한다. 먼저 적용하면
-- 구버전 화면의 로그인 목록이 비어 아무도 로그인할 수 없다.
--
-- 모든 요청이 anon 역할로 나가므로 grant 를 회수하면 로그인 사용자도 막힌다.
-- 정책 조건으로 "세션이 있는 요청" 만 통과시킨다 (다른 테이블과 같은 방식).
-- 적용 뒤 확인: 로그아웃 상태에서 members 조회가 0행, 로그인 목록은 정상.

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to anon, authenticated
  using (app.current_member_id() is not null);

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop policy if exists members_select on public.members;
-- create policy members_select on public.members
--   for select to anon, authenticated
--   using (true);
