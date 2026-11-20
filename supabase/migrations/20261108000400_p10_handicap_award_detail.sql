-- 2027 산정결과(안)의 시상 근거 열 추가: 가중 시상횟수(W/M/H)와 시상 원점수.
-- 시상 원점수 = Σ(시상 계수 × 그 날의 구간가중), 계수 Winner −0.50 / Medalist −0.25 / Host +0.50.
-- 구간가중: A(2026-06~11) 1.00, B(2026-01~05) 0.50, C(2025-07~12) 0.25, 그 외 0.
-- meeting_results 는 읽기만 한다. 값은 기존 award_adj(작업지시서 정본)와 대조해 어긋나면 전체를 롤백한다.

alter table public.handicap_annual
  add column if not exists w_win     numeric(4,2),  -- 가중 Winner 횟수
  add column if not exists w_med     numeric(4,2),  -- 가중 Medalist 횟수
  add column if not exists w_host    numeric(4,2),  -- 가중 Host 횟수
  add column if not exists award_raw numeric(5,3);  -- 시상 원점수

with wt as (
  select m.id as meeting_id,
         case when m.year_month between '2026-06' and '2026-11' then 1.00
              when m.year_month between '2026-01' and '2026-05' then 0.50
              when m.year_month between '2025-07' and '2025-12' then 0.25
              else 0 end as wgt
  from public.meetings m
), agg as (
  select r.member_id,
         coalesce(sum(wt.wgt) filter (where r.result_rank = 'Winner'),   0) as w_win,
         coalesce(sum(wt.wgt) filter (where r.result_rank = 'Medalist'), 0) as w_med,
         coalesce(sum(wt.wgt) filter (where r.result_rank = 'Host'),     0) as w_host
  from public.meeting_results r
  join wt on wt.meeting_id = r.meeting_id
  group by r.member_id
)
update public.handicap_annual h
set w_win     = coalesce(a.w_win, 0),
    w_med     = coalesce(a.w_med, 0),
    w_host    = coalesce(a.w_host, 0),
    award_raw = -0.50 * coalesce(a.w_win, 0) - 0.25 * coalesce(a.w_med, 0) + 0.50 * coalesce(a.w_host, 0)
from (select hh.member_id, g.w_win, g.w_med, g.w_host
      from public.handicap_annual hh
      left join agg g on g.member_id = hh.member_id
      where hh.year = 2027) a
where h.year = 2027 and h.member_id = a.member_id;

-- 대조: 시상보정 = 원점수 ÷ 가중 라운드 × 6, ±1.0 한도. 정본 award_adj 와 0.011 넘게 다르면 중단.
do $$
declare bad text;
begin
  select string_agg(mb.name || ' 계산 ' ||
           round(greatest(-1, least(1, h.award_raw / h.w_sum * 6)), 3) || ' / 정본 ' || h.award_adj, ', ')
    into bad
  from public.handicap_annual h
  join public.members mb on mb.id = h.member_id
  where h.year = 2027
    and abs(greatest(-1, least(1, h.award_raw / h.w_sum * 6)) - h.award_adj) > 0.011;
  if bad is not null then
    raise exception '시상보정 대조 불일치: %', bad;
  end if;
end $$;

-- 비고 문구를 화면 용어(가중 라운드)에 맞춘다.
update public.handicap_annual
set note = replace(note, '가중합 3.0 미만', '가중 라운드 3.00 미만')
where year = 2027 and note like '%가중합 3.0 미만%';

-- 뷰는 select h.* 가 생성 시점에 펼쳐지므로 새 열을 보이려면 다시 만든다 (열 순서가 바뀌어 drop 후 생성).
drop view if exists public.v_handicap_annual;
create view public.v_handicap_annual
  with (security_invoker = true) as
select h.*, mb.name as member_name, mb.is_active, mb.dormant_from
from public.handicap_annual h
join public.members mb on mb.id = h.member_id;
grant select on public.v_handicap_annual to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- update public.handicap_annual set note = replace(note, '가중 라운드 3.00 미만', '가중합 3.0 미만') where year = 2027;
-- alter table public.handicap_annual drop column w_win, drop column w_med, drop column w_host, drop column award_raw;
-- (뷰는 위 drop/create 와 같은 정의로 다시 만든다)
