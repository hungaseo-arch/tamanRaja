-- 2026-09 차월핸디를 2026-10 당월핸디에 맞춘다 (작업지시서 D1).
--
-- 20260906130000_p5_oct_app_hc_fix 는 10월 app_hc 만 고치고 9월 next_hc 는
-- 그대로 두어 체인이 4건 어긋났다. 10월 Net 은 이미 고친 app_hc 로 계산됐으니
-- 10월 쪽이 확정값이다. 정기혁·정재욱·조학영은 원복이라 9월 값과 이미 같다.
--
--   고영춘 17→18 · 김재헌 14→13 · 서종환 13→12 · 유영보 15→14
--
-- 이전 값과 같을 때만 바꾼다. 그 사이 누가 고쳤으면 건드리지 않는다.
-- 적용 뒤 select * from app.check_handicap_chain(); 이 0행이어야 한다.
with fix(ym, name, old_next_hc, next_hc) as (values
  ('2026-09', '고영춘', 17, 18),
  ('2026-09', '김재헌', 14, 13),
  ('2026-09', '서종환', 13, 12),
  ('2026-09', '유영보', 15, 14)
)
update monthly_handicaps mh
set next_hc = f.next_hc
from fix f
join members m on m.name = f.name
where mh.member_id = m.id and mh.year_month = f.ym
  and mh.next_hc = f.old_next_hc;

-- rollback: 위 값을 거꾸로 (next_hc → old_next_hc).
