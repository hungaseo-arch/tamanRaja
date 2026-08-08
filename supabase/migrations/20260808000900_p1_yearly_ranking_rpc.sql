-- P1-2 (2): 연간 랭킹 집계를 클라이언트에서 서버로 옮긴다.
--
-- 지금은 프런트가 meetings·meeting_results·monthly_handicaps 를 통째로
-- 받아 브라우저에서 평균을 낸다. 집계에 필요한 것보다 훨씬 많은 원본
-- 기록이 내려가고, 랭킹 규칙이 화면 코드 안에만 있어 어디가 진짜인지
-- 알 수 없다. 규칙을 DB 함수 하나로 못박는다.

-- ── 1. 휴면 시작월을 DB 로 ────────────────────────────────────────────────────
-- members.is_active 는 참/거짓뿐이라 "언제부터" 를 담지 못한다. 그래서
-- 프런트 코드에 DORMANT = [{ name: '이성남', from: '2026-04' }] 가 상수로
-- 박혀 있었다. 이름으로 매칭하는 것도, 규칙이 배포에 묶이는 것도 문제다.
alter table public.members
  add column if not exists dormant_from varchar(7);

comment on column public.members.dormant_from is
  '휴면 시작월(YYYY-MM). 이 달부터의 경기는 집계·랭킹에서 제외한다. NULL 이면 현역.';

update public.members
   set dormant_from = '2026-04'
 where name = '이성남'
   and dormant_from is null;

-- members 는 컬럼 단위로 SELECT 를 준다 (anon 은 role 을 못 본다). 새 컬럼은
-- 자동으로 딸려오지 않으므로 명시해야 한다 — 빼먹으면 anon 의 members 조회
-- 자체가 "permission denied for table members" 로 통째로 막힌다.
-- 로그인 화면의 회원 목록에서 휴면 회원을 빼는 데 필요하므로 anon 에도 준다.
grant select (dormant_from) on public.members to anon, authenticated;

-- ── 2. 연간 랭킹 함수 ────────────────────────────────────────────────────────
-- 규칙 (프런트 getYearlySummary 와 동일해야 한다):
--   · 대상 회원 — 해당 연도 12월까지 사이에 휴면 전환된 회원은 통째로 제외
--   · 대상 경기 — 그 연도의 미팅 중, 회원이 아직 현역인 달만
--   · 적용 핸디 — 그 달 레코드가 있으면 app_hc, 없으면 직전 달의 next_hc
--   · 집계 대상 라운드 — 참석했고 스코어가 있고 0 보다 큰 경우
--   · 평균 Net = 평균(스코어 − 적용 핸디), 평균 스코어 = 평균(스코어)
--   · 참석 횟수 = 평균 Net 에 들어간 라운드 수
--   · 순위 = 평균 스코어 오름차순 (동점이면 평균 Net 낮은 쪽)
--
-- security invoker 로 둔다. 기반 테이블의 읽기 RLS(세션 있는 회원만)가
-- 그대로 걸려야 하기 때문이다 — definer 로 두면 v_yearly_summary 때와
-- 똑같이 익명 키만으로 전 회원 기록이 새어 나간다.
create or replace function public.yearly_ranking(p_year text)
returns table (
  member_id      integer,
  member_name    text,
  avg_net_score  numeric,
  avg_score      numeric,
  attended_count integer,
  winner_count   integer,
  medalist_count integer,
  host_count     integer,
  rank           integer
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with rounds as (
    select
      mb.id                      as member_id,
      mb.name::text              as member_name,
      mr.result_rank,
      mr.score,
      -- 그 달 레코드가 있으면 그 값, 없으면 직전 달의 next_hc
      case when h.id is not null then h.app_hc else prev.next_hc end as app_hc,
      -- 집계에 넣을 라운드인지
      coalesce(mr.attended, false) and mr.score is not null and mr.score > 0 as scored
    from public.members mb
    -- 그 연도 12월까지 사이에 휴면으로 넘어간 회원은 그 해 랭킹에서 뺀다
    join public.meetings m
      on left(m.year_month, 4) = p_year
     and (mb.dormant_from is null or m.year_month < mb.dormant_from)
    left join public.meeting_results mr
      on mr.meeting_id = m.id and mr.member_id = mb.id
    left join public.monthly_handicaps h
      on h.member_id = mb.id and h.year_month = m.year_month
    left join lateral (
      select p.next_hc
      from public.monthly_handicaps p
      where p.member_id = mb.id and p.year_month < m.year_month
      order by p.year_month desc
      limit 1
    ) prev on h.id is null
    where mb.dormant_from is null or mb.dormant_from > p_year || '-12'
  ),
  agg as (
    select
      r.member_id,
      r.member_name,
      avg((r.score - r.app_hc)::numeric)
        filter (where r.scored and r.app_hc is not null)          as avg_net_score,
      avg(r.score::numeric) filter (where r.scored)               as avg_score,
      count(*) filter (where r.scored and r.app_hc is not null)   as attended_count,
      count(*) filter (where r.result_rank = 'Winner')            as winner_count,
      count(*) filter (where r.result_rank = 'Medalist')          as medalist_count,
      count(*) filter (where r.result_rank = 'Host')              as host_count
    from rounds r
    group by r.member_id, r.member_name
  )
  select
    a.member_id,
    a.member_name,
    a.avg_net_score,
    a.avg_score,
    a.attended_count::integer,
    a.winner_count::integer,
    a.medalist_count::integer,
    a.host_count::integer,
    row_number() over (
      order by a.avg_score nulls last, a.avg_net_score, a.member_id
    )::integer as rank
  from agg a
  -- 적용 핸디가 붙은 라운드가 하나도 없으면 순위를 매기지 않는다
  where a.attended_count > 0
  order by rank;
$$;

comment on function public.yearly_ranking(text) is
  '연간 랭킹. 평균 스코어 오름차순으로 순위를 매긴다. 호출자 권한으로 돌아 기록 RLS 가 그대로 적용된다.';

grant execute on function public.yearly_ranking(text) to anon, authenticated;
