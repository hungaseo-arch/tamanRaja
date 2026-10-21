-- P8 · 차월 핸디 체인 검사를 2026-07 부터로 한정 (작업지시서 3-1 후속)
--
-- 000400 적용 뒤 app.check_handicap_chain() 이 2022-03 ~ 2026-06 에서 100행
-- 넘게 나왔다. 2026-07 이후는 0행(9월 4건은 000500 으로 보정).
-- 2026-06 → 07 은 전 회원 기준핸디를 새로 정한 달이고, 그 전 기록은 시트에서
-- 옮긴 값이라 재설정 달마다 next_hc 와 다음 달 app_hc 가 다른 게 정상이다.
--
--  1) check_handicap_chain(): 2026-07 이후 행만 본다.
--  2) recompute (C): 2026-07 이후 달에만 적용한다 — 지난 달을 다시 저장해도
--     옛 next_hc 를 재설정 값으로 덮어쓰지 않는다.
-- 프런트(resolveHandicap 의 HANDICAP_CHAIN_FROM)와 같은 기준이다.

create or replace function app.recompute_next_hc_for_meeting(
  p_meeting_id integer,
  p_carry      boolean default true   -- false = 삭제 뒤: 다음 달 이월(B)은 하지 않는다
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ym text; v_next_ym text;
begin
  select year_month into v_ym from meetings where id = p_meeting_id;
  if v_ym is null then return; end if;

  v_next_ym := to_char(to_date(v_ym,'YYYY-MM') + interval '1 month', 'YYYY-MM');

  -- (A) 당월 차월핸디: 당월핸디 = 기준핸디(초기화 상태)이거나 직전 라운드와
  --     같은 조 → ±1, 조 바뀜 → 기준핸디 복귀, 미참석·스코어 없음 → 유지
  update monthly_handicaps mh
  set next_hc = sub.next_hc
  from (
    select mh2.member_id,
      case
        when r.attended is true and r.score is not null and r.score > 0 and r.result_group is not null then
          case
            when mh2.app_hc = mh2.std_hc or (pg.result_group is not null and pg.result_group = r.result_group)
            then case when r.result_group = '1등조' then mh2.app_hc - 1 else mh2.app_hc + 1 end
            else mh2.std_hc
          end
        else mh2.app_hc
      end as next_hc
    from monthly_handicaps mh2
    left join meeting_results r on r.meeting_id = p_meeting_id and r.member_id = mh2.member_id
    -- 직전 라운드의 조: 불참·미기록으로 조가 없던 달은 건너뛴다.
    left join lateral (
      select r2.result_group
      from meeting_results r2
      join meetings m2 on m2.id = r2.meeting_id
      where r2.member_id = mh2.member_id
        and m2.year_month < v_ym
        and r2.result_group is not null
      order by m2.year_month desc
      limit 1
    ) pg on true
    where mh2.year_month = v_ym
  ) sub
  where mh.member_id = sub.member_id and mh.year_month = v_ym;

  -- (B) 다음 달 미시행 시 당월핸디 이월 생성/갱신
  if p_carry
     and not exists (select 1 from meeting_results mr join meetings m on m.id = mr.meeting_id where m.year_month = v_next_ym) then
    update monthly_handicaps nm set app_hc = cm.next_hc
    from monthly_handicaps cm
    where cm.year_month = v_ym and cm.next_hc is not null
      and nm.year_month = v_next_ym and nm.member_id = cm.member_id;
    insert into monthly_handicaps (member_id, year_month, std_hc, app_hc, next_hc)
    select cm.member_id, v_next_ym, cm.std_hc, cm.next_hc, null
    from monthly_handicaps cm
    where cm.year_month = v_ym and cm.next_hc is not null
      and not exists (select 1 from monthly_handicaps x where x.member_id = cm.member_id and x.year_month = v_next_ym);
  end if;

  -- (C) 다음 달 결과가 이미 있으면(B 를 건너뛴 경우) 다음 달 당월핸디가 확정값
  --     이다 — 그 달 Net 이 이미 그 값으로 계산됐다. 당월 차월핸디를 거기에
  --     맞춰 체인을 끊지 않는다. 다음 달 핸디를 바꾸려면 다음 달을 직접 고친다.
  --     2026-07 전 기록은 체인 대상이 아니다 (재설정 달마다 어긋나는 게 정상).
  if v_ym >= '2026-07'
     and exists (select 1 from meeting_results mr join meetings m on m.id = mr.meeting_id where m.year_month = v_next_ym) then
    update monthly_handicaps cm set next_hc = nm.app_hc
    from monthly_handicaps nm
    where cm.year_month = v_ym
      and nm.year_month = v_next_ym and nm.member_id = cm.member_id
      and nm.app_hc is not null
      and cm.next_hc is distinct from nm.app_hc;
  end if;
end;
$$;

create or replace function app.check_handicap_chain()
returns table (
  member_id       integer,
  member_name     text,
  year_month      text,
  next_hc         integer,
  next_year_month text,
  next_app_hc     integer
)
language sql
stable
set search_path = pg_catalog, public
as $$
  select cm.member_id,
         m.name::text,
         cm.year_month::text,
         cm.next_hc,
         nm.year_month::text,
         nm.app_hc
  from monthly_handicaps cm
  join monthly_handicaps nm
    on nm.member_id = cm.member_id
   and nm.year_month = to_char(to_date(cm.year_month, 'YYYY-MM') + interval '1 month', 'YYYY-MM')
  join members m on m.id = cm.member_id
  where cm.year_month >= '2026-07'
    and cm.next_hc is not null
    and nm.app_hc is not null
    and cm.next_hc <> nm.app_hc
  order by cm.year_month, m.name;
$$;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- 20261021000400_p8_handicap_chain.sql 의 두 함수 정의로 create or replace.
