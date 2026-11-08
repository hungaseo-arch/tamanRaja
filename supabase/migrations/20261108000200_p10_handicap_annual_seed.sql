-- 2027 기준핸디 산정결과(안) 15행(draft) + 2026 기준핸디 15행(confirmed) 적재.
-- 값은 작업지시서(2026-11-08)의 표가 정본이며 재계산하지 않고 그대로 넣는다.
-- 기존 테이블(meetings·meeting_results·monthly_handicaps·members·golf_courses)은 건드리지 않는다.

insert into public.handicap_annual
  (year, member_id, status, prev_std_hc, std_hc, w_sum, w_avg, avg_a, avg_b, avg_c,
   award_adj, calc_hc, attend_rate, apply_rate, raw_delta, final_delta, capped, low_sample, note)
select 2027, mb.id, 'draft', v.prev, v.std, v.w_sum, v.w_avg, v.a, v.b, v.c,
       v.award, v.calc, v.rate, v.apply, v.raw, v.final, v.capped, v.low, v.note
from (values
  ('박영진', 10, 9, 8.50, 15.7, 15.5, 14.8, 18.0, -0.79, 8.7, 81.8, 1.00, -1.3, -1.3, false, false, null::text),
  ('정인원', 12, 10, 6.50, 16.5, 15.6, 24.3, 17.4, -1.00, 9.3, 54.5, 0.70, -1.9, -1.9, false, false, null::text),
  ('박재현', 11, 11, 7.00, 17.4, 17.4, 19.1, 15.8, -0.11, 11.1, 90.0, 1.00, 0.1, 0.1, false, false, null::text),
  ('서종환', 13, 11, 9.00, 17.7, 17.7, 15.8, 20.8, -0.67, 10.8, 90.9, 1.00, -2.2, -2.0, true, false, null::text),
  ('김재헌', 14, 12, 8.00, 19.0, 18.1, 21.5, 18.9, -0.52, 12.3, 81.8, 1.00, -1.7, -1.7, false, false, null::text),
  ('유영보', 15, 14, 9.50, 20.0, 20.6, 18.2, 20.9, 0.00, 13.8, 100.0, 1.00, -1.2, -1.2, false, false, null::text),
  ('장효익', 14, 15, 8.75, 21.5, 21.3, 22.6, 21.3, 0.00, 15.3, 81.8, 1.00, 1.3, 1.3, false, false, null::text),
  ('고영춘', 17, 16, 8.75, 22.6, 23.8, 19.4, 21.7, 0.09, 16.5, 90.9, 1.00, -0.5, -0.5, false, false, null::text),
  ('남정곤', 15, 18, 8.00, 23.8, 23.6, 24.3, null::numeric, 0.56, 18.2, 90.9, 1.00, 3.2, 3.0, true, false, null::text),
  ('조학영', 19, 19, 8.50, 25.0, 25.2, 23.7, 26.2, -0.18, 18.6, 81.8, 1.00, -0.4, -0.4, false, false, null::text),
  ('정기혁', 20, 20, 9.50, 26.3, 25.8, 27.3, 27.2, -0.08, 20.0, 90.9, 1.00, 0.0, 0.0, false, false, null::text),
  ('정재욱', 18, 21, 9.75, 27.4, 28.1, 25.0, 28.9, 0.54, 21.7, 100.0, 1.00, 3.7, 3.0, true, false, null::text),
  ('손동현', 24, 24, 2.50, 29.7, null::numeric, 29.0, 32.5, 0.00, 23.5, 45.5, 0.50, -0.2, -0.2, false, true, '표본 부족(가중합 3.0 미만) — 변동 ±1타 제한 적용'),
  ('신승민', 24, 25, 2.00, 34.7, 36.3, 33.1, null::numeric, 0.00, 28.5, 27.3, 0.50, 2.3, 1.0, true, true, '표본 부족(가중합 3.0 미만) — 변동 ±1타 제한 적용'),
  ('이성남', 26, 27, 2.00, 40.2, null::numeric, 44.0, 36.5, 0.75, 34.8, 66.7, 0.70, 6.1, 1.0, true, true, '표본 부족(가중합 3.0 미만) — 변동 ±1타 제한 적용 / 2026-04 휴면 — 복귀 후 3회 참석 시 재산정')
) as v(name, prev, std, w_sum, w_avg, a, b, c, award, calc, rate, apply, raw, final, capped, low, note)
join public.members mb on mb.name = v.name
on conflict (year, member_id) do nothing;

-- 2026 기준핸디 (소급 입력: prev 는 NULL, std_hc 는 위 표의 prev 열과 같다)
insert into public.handicap_annual (year, member_id, status, prev_std_hc, std_hc)
select 2026, h.member_id, 'confirmed', null, h.prev_std_hc
from public.handicap_annual h
where h.year = 2027
on conflict (year, member_id) do nothing;

-- 적재 검증: 행 수와 총합. 어긋나면 마이그레이션 전체가 롤백된다.
do $$
declare n27 int; n26 int; s27 int; s26 int;
begin
  select count(*), sum(std_hc) into n27, s27 from public.handicap_annual where year = 2027;
  select count(*), sum(std_hc) into n26, s26 from public.handicap_annual where year = 2026;
  if n27 <> 15 or n26 <> 15 then raise exception 'handicap_annual 행 수 불일치: 2027=%, 2026=%', n27, n26; end if;
  if s27 <> 252 or s26 <> 252 then raise exception 'handicap_annual 총합 불일치: 2027=%, 2026=%', s27, s26; end if;
end $$;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- delete from public.handicap_annual where year in (2026, 2027);
