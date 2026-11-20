-- (1) 증감(raw_delta, final_delta)을 소수 둘째 자리로 저장한다.
--     첫째 자리로 줄이면 고영춘이 17 + (−0.5) = 16.5 → 올림 17 로 잘못 계산된다.
--     정확한 값 −0.51 이면 17 + (−0.51) = 16.49 → 16. 값은 작업지시서(개정판) 표가 정본이다.
-- (2) 2025 기준핸디를 monthly_handicaps 의 2025-12 값(연말)으로 교체한다. 2025-01 값은 쓰지 않는다.
--     산정 대상 15명만 대상으로 한다 (허우석 등 휴면 회원 제외).
-- 기존 테이블(meetings·meeting_results·monthly_handicaps·members·golf_courses)은 읽기만 한다.

-- 뷰가 select h.* 를 펼쳐 갖고 있어 열 타입을 바꾸려면 먼저 내려야 한다.
drop view if exists public.v_handicap_annual;

alter table public.handicap_annual
  alter column raw_delta   type numeric(5,2),
  alter column final_delta type numeric(5,2);

update public.handicap_annual h
set raw_delta = v.raw, final_delta = v.final, updated_at = now()
from (values
  ('박영진', -1.29, -1.29), ('정인원', -1.89, -1.89), ('박재현',  0.09,  0.09),
  ('서종환', -2.17, -2.00), ('김재헌', -1.72, -1.72), ('유영보', -1.20, -1.20),
  ('장효익',  1.30,  1.30), ('고영춘', -0.51, -0.51), ('남정곤',  3.16,  3.00),
  ('조학영', -0.38, -0.38), ('정기혁',  0.02,  0.02), ('정재욱',  3.74,  3.00),
  ('손동현', -0.25, -0.25), ('신승민',  2.25,  1.00), ('이성남',  6.12,  1.00)
) as v(name, raw, final)
join public.members mb on mb.name = v.name
where h.year = 2027 and h.member_id = mb.id;

-- 대조: 2026 기준 + 최종 증감을 0.5 올림하면 2027 기준과 같아야 한다 (15명 전원).
do $$
declare bad text;
begin
  select string_agg(mb.name || ' ' || h.prev_std_hc || '+' || h.final_delta || ' → ' ||
                    floor(h.prev_std_hc + h.final_delta + 0.5) || ' / 기준 ' || h.std_hc, ', ')
    into bad
  from public.handicap_annual h
  join public.members mb on mb.id = h.member_id
  where h.year = 2027 and floor(h.prev_std_hc + h.final_delta + 0.5) <> h.std_hc;
  if bad is not null then
    raise exception '증감과 2027 기준핸디 불일치: %', bad;
  end if;
end $$;

-- 2025 기준(연말): 기존 2025 행(2025-01 값, 허우석 포함)을 지우고 2025-12 값으로 다시 넣는다.
delete from public.handicap_annual where year = 2025;

insert into public.handicap_annual (year, member_id, status, prev_std_hc, std_hc)
select 2025, mh.member_id, 'confirmed', null, mh.std_hc
from public.monthly_handicaps mh
where mh.year_month = '2025-12'
  and mh.std_hc is not null
  and mh.member_id in (select member_id from public.handicap_annual where year = 2027)
on conflict (year, member_id) do nothing;

-- 대조: 지시서의 2025-12 값 13명과 일치해야 하고, 남정곤·신승민은 행이 없어야 한다.
do $$
declare bad text; n int;
begin
  select count(*) into n from public.handicap_annual where year = 2025;
  if n <> 13 then raise exception '2025 기준 행 수 불일치: % (13 이어야 함)', n; end if;

  select string_agg(mb.name || ' ' || coalesce(h.std_hc::text, '없음') || ' / 기대 ' || v.std, ', ')
    into bad
  from (values
    ('이성남', 22), ('정재욱', 12), ('박영진', 9), ('정인원', 10), ('박재현', 9), ('손동현', 21),
    ('정기혁', 15), ('유영보', 12), ('김재헌', 15), ('고영춘', 16), ('조학영', 14), ('장효익', 13), ('서종환', 14)
  ) as v(name, std)
  join public.members mb on mb.name = v.name
  left join public.handicap_annual h on h.member_id = mb.id and h.year = 2025
  where h.std_hc is distinct from v.std;
  if bad is not null then raise exception '2025-12 값 불일치: %', bad; end if;
end $$;

create view public.v_handicap_annual
  with (security_invoker = true) as
select h.*, mb.name as member_name, mb.is_active, mb.dormant_from
from public.handicap_annual h
join public.members mb on mb.id = h.member_id;
grant select on public.v_handicap_annual to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- 증감 값은 20261108000200 시드의 1자리 값으로, 2025 행은 20261108000300 정의(2025-01 값)로 되돌린다.
-- (뷰는 위와 같은 정의로 다시 만든다)
