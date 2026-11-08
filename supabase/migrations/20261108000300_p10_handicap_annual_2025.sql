-- 비교자료: 2025년 기준핸디. monthly_handicaps 의 2025-01 std_hc(연초 기준핸디)를 그대로 옮긴다.
-- 기존 테이블은 읽기만 하고 수정하지 않는다. 2025-01 기록이 없는 회원(2025년 신규)은 행을 만들지 않는다.

insert into public.handicap_annual (year, member_id, status, prev_std_hc, std_hc)
select 2025, mh.member_id, 'confirmed', null, mh.std_hc
from public.monthly_handicaps mh
where mh.year_month = '2025-01'
  and mh.std_hc is not null
on conflict (year, member_id) do nothing;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- delete from public.handicap_annual where year = 2025;
