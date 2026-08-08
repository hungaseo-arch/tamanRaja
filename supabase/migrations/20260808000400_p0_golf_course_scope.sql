-- P0-2 보정: golf_courses 등록 권한 범위 축소
--
-- 최초 정의는 "과거에 한 번이라도 Host 였던 회원"을 허용했는데, 이는 한 번
-- Host 를 맡은 회원이 영구적으로 골프장을 등록할 수 있다는 뜻이었다.
-- 실제로 골프장을 추가해야 하는 사람은 "지금 다가오는 모임을 기획 중인 사람"
-- 뿐이므로, 당월·익월을 편집할 수 있는지로 좁힌다.

create or replace function app.is_meeting_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select app.is_admin()
      or app.can_manage_month(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'))
      or app.can_manage_month(to_char((now() at time zone 'Asia/Seoul') + interval '1 month', 'YYYY-MM'))
$$;
