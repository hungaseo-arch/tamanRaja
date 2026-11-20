-- 연도별 기준 핸디캡 산정 이력 (2027년 기준 핸디캡 산정기준 페이지용)
--
-- 공개 범위: 로그인 회원만. members 조회를 세션으로 막아 둔 p9 방침을 따른다.
--   · 테이블 정책: 세션이 있는 요청만 SELECT.
--   · 뷰는 security_invoker 로 만들어 members 정책까지 호출자 기준으로 적용한다
--     (기본 뷰는 소유자 권한이라 members RLS 를 우회해 실명이 새어 나간다).
--   · 쓰기 정책은 두지 않는다 — 적재는 마이그레이션(소유자)으로만 한다.

create table if not exists public.handicap_annual (
  id            serial primary key,
  year          smallint not null,
  member_id     integer  not null references public.members(id) on delete cascade,
  status        text     not null default 'draft'
                check (status in ('draft','confirmed')),
  prev_std_hc   smallint,            -- 전년 기준핸디
  std_hc        smallint not null,   -- 당해 기준핸디
  w_sum         numeric(4,2),        -- 구간가중 합계
  w_avg         numeric(4,1),        -- 가중평균 보정 오버파
  avg_a         numeric(4,1),
  avg_b         numeric(4,1),
  avg_c         numeric(4,1),
  award_adj     numeric(4,2),        -- 시상보정
  calc_hc       numeric(4,1),        -- 산출핸디
  attend_rate   numeric(4,1),        -- 참석률(%)
  apply_rate    numeric(3,2),        -- 참석률 반영률
  raw_delta     numeric(4,1),        -- 한도 적용 전 증감
  final_delta   numeric(4,1),        -- 한도 적용 후 증감
  capped        boolean default false,
  low_sample    boolean default false,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (year, member_id)
);

alter table public.handicap_annual enable row level security;

drop policy if exists handicap_annual_read on public.handicap_annual;
create policy handicap_annual_read on public.handicap_annual
  for select to anon, authenticated
  using (app.current_member_id() is not null);

create or replace view public.v_handicap_annual
  with (security_invoker = true) as
select h.*, mb.name as member_name, mb.is_active, mb.dormant_from
from public.handicap_annual h
join public.members mb on mb.id = h.member_id;

grant select on public.handicap_annual to anon, authenticated;
grant select on public.v_handicap_annual to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop view if exists public.v_handicap_annual;
-- drop table if exists public.handicap_annual;
