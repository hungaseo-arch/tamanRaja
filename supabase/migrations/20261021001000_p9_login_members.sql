-- 5-4 (1/2): 로그인 화면 전용 회원 목록 함수
--
-- 로그인 전 화면은 members 테이블을 직접 읽는다. 그래서 members_select 가
-- using (true) 로 열려 있고, 세션 없이도 휴면 회원까지 전체 명단과
-- dormant_from 이 보인다. 로그인 화면에 필요한 건 "지금 현역인 회원의
-- id, name" 뿐이므로 그것만 돌려주는 함수를 따로 둔다.
--
-- 뷰가 아니라 함수인 이유: 정책을 우회하려면 security definer 뷰가 되는데,
-- Supabase advisor 가 이를 ERROR(security_definer_view) 로 잡는다.
--
-- 적용 순서 (CLAUDE.md): 이 파일 적용 → 프런트 배포·확인 →
-- 20261021001100_p9_members_select_session.sql 적용.
-- 적용 뒤 확인: select * from public.login_members(); — 현역 회원만 나와야 한다.

create or replace function public.login_members()
returns table (id integer, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id::integer, m.name::text
  from public.members m
  where m.dormant_from is null
     or m.dormant_from > to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')
  order by m.name;
$$;

revoke all on function public.login_members() from public;
grant execute on function public.login_members() to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop function if exists public.login_members();
