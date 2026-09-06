-- 2026-10 당월핸디 보정: 2026-07 특례 오적용의 누적 차이를 아직 치르지 않은
-- 10월에만 반영한다. 7~9월 기록은 그대로 둔다.
--   정기혁 23 → 22 · 정재욱 21 → 20 · 조학영 17 → 18
with fix(ym, name, app_hc) as (values
  ('2026-10', '정기혁', 22),
  ('2026-10', '정재욱', 20),
  ('2026-10', '조학영', 18)
)
update monthly_handicaps mh
set app_hc = f.app_hc
from fix f
join members m on m.name = f.name
where mh.member_id = m.id and mh.year_month = f.ym;
