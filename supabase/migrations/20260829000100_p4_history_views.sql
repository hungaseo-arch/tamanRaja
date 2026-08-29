-- P4-1: 과거 기록(2022-02 ~) 조회용 읽기 전용 뷰 2개
--
-- 2022~2025년 기록이 적재되면서 화면이 봐야 할 범위가 4년치로 늘었다.
-- 지금까지는 프런트가 meetings·meeting_results·monthly_handicaps 를 각각
-- 받아 브라우저에서 조인해 Net(= score − app_hc)을 냈는데, 조인 키가
-- (member_id, year_month) 두 개인 데다 휴면 회원 제외 조건까지 겹쳐서
-- 화면마다 규칙이 조금씩 달라지기 쉽다. 조인과 휴면 필터를 뷰 한 곳에
-- 못박고, 화면은 뷰만 조회한다.
--
-- 기존 테이블·데이터는 건드리지 않는다. 뷰 생성만 한다.
--
-- security_invoker = on 은 반드시 켠다. 뷰는 기본이 security definer 라
-- 만든 사람(postgres, rolbypassrls) 권한으로 기반 테이블을 읽는다. 그대로
-- 두면 p1_read_policies 로 막아 둔 "기록은 세션 있는 회원만" 규칙을 뷰가
-- 통째로 우회해, 프런트 번들에 들어 있는 익명 키만으로 전 회원의 점수와
-- 핸디가 새어 나간다. (p1_view_rls_gap 에서 v_yearly_summary 로 이미 한 번
-- 겪은 구멍이다.) invoker 로 두면 세션이 없을 때 0행이 나온다.

-- =====================================================================
-- v_meeting_scores : 모임별 개인 성적 (Net 계산 · 휴면 필터 포함)
-- =====================================================================
-- · gross_over  = meeting_results.score. 파 기준 오버(T/T)이지 총타수가 아니다.
-- · gross_total = gross_over + 코스 par. 코스가 아직 안 정해진 모임은 NULL.
-- · net_score   = gross_over − app_hc. 둘 중 하나라도 없으면 NULL 이다.
--   여기서 coalesce 로 0 을 채우지 않는다 — 핸디 0 은 실제로 있는 값이고,
--   0 으로 채우면 Net 이 조용히 Gross 와 같아진다.
-- · is_reassigned : 같은 달에 두 번 열려 빈 달로 옮겨 적은 모임(4건).
--   year_month 의 월과 실제 meeting_date 의 월이 다르므로, 화면은 이 값이
--   true 인 모임에 실제 개최일을 반드시 병기해야 한다.
create or replace view public.v_meeting_scores
with (security_invoker = on) as
select
  m.id                                   as meeting_id,
  m.year_month,
  left(m.year_month, 4)::int             as year,
  m.meeting_date,
  (to_char(m.meeting_date,'YYYY-MM') <> m.year_month) as is_reassigned,
  m.notes                                as meeting_note,
  c.name                                 as course_name,
  c.tee_box,
  c.par,
  mb.id                                  as member_id,
  mb.name                                as member_name,
  mb.is_active,
  mb.dormant_from,
  r.attended,
  r.score                                as gross_over,
  (r.score + c.par)                      as gross_total,
  h.std_hc, h.app_hc, h.next_hc,
  (r.score - h.app_hc)                   as net_score,
  r.result_group,
  r.result_rank,
  r.note
from public.meetings m
join public.meeting_results r on r.meeting_id = m.id
join public.members        mb on mb.id = r.member_id
left join public.golf_courses c on c.id = m.course_id
left join public.monthly_handicaps h
       on h.member_id = mb.id and h.year_month = m.year_month
-- 휴면 회원은 휴면 시작월 이후 경기를 집계에서 뺀다. 그 전 기록은 남긴다 —
-- 통산 랭킹에 '과거 회원'으로 그대로 서야 하기 때문이다.
where mb.dormant_from is null or m.year_month < mb.dormant_from;

comment on view public.v_meeting_scores is
  '모임별 개인 성적. Net 계산과 휴면 필터를 포함한 조회 전용 뷰. security_invoker 로 기록 RLS 가 그대로 걸린다.';

-- =====================================================================
-- v_member_stats : 연도별 + 통산 집계 (year IS NULL 행이 통산)
-- =====================================================================
-- GROUPING SETS 로 연도별 행과 통산 행을 한 번에 낸다. 통산 행은 year 가
-- NULL 이므로 화면은 .is('year', null) 하나로 통산만 서버에서 골라 받는다.
--
-- 평균은 NULL 을 세지 않는다(avg 의 기본 동작). 점수 미기입 라운드(2026년
-- 진행 중 모임 16건)가 평균을 끌어내리지 않게 하려는 것이며, 그래서
-- rounds(참석)와 scored_rounds(점수 있는 참석)를 따로 센다.
create or replace view public.v_member_stats
with (security_invoker = on) as
select
  year, member_id, member_name, is_active, dormant_from,
  count(*) filter (where attended)                            as rounds,
  count(*) filter (where attended and gross_over is not null)  as scored_rounds,
  round(avg(gross_over) filter (where attended), 1)           as avg_gross,
  round(avg(net_score)  filter (where attended), 1)           as avg_net,
  min(gross_over)       filter (where attended)               as best_gross,
  min(net_score)        filter (where attended)               as best_net,
  count(*) filter (where result_rank = 'Winner')              as winner_cnt,
  count(*) filter (where result_rank = 'Medalist')            as medalist_cnt,
  count(*) filter (where result_rank = 'Host')                as host_cnt,
  count(*) filter (where result_group = '1등조')              as group1_cnt,
  count(*) filter (where result_group = '2등조')              as group2_cnt
from public.v_meeting_scores
group by grouping sets ((year, member_id, member_name, is_active, dormant_from),
                        (member_id, member_name, is_active, dormant_from));

comment on view public.v_member_stats is
  '회원별 연도 집계와 통산 집계(year IS NULL). v_meeting_scores 를 그대로 받아 규칙이 갈리지 않는다.';

grant select on public.v_meeting_scores, public.v_member_stats to anon, authenticated;
