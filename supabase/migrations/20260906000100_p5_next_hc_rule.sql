-- 차월 핸디(next_hc) 산출 규칙을 모임 규칙표에 맞춘다.
--
-- 규칙표 원문
--   ▶ 전월 1등조에서 당월 1등조로 분류되면 익월에 H'cap -1로 적용하고,
--     전월 2등조에서 당월 2등조로 분류되면 익월에 H'cap +1로 적용한다.
--   ▶ 전월 1등조에서 당월 2등조가 되거나, 전월 2등조에서 당월 1등조가 되면,
--     익월 핸디는 기준 핸디가 된다.
--   ▶ 매해 1월의 경우는 특별히 당월 결과만으로 2월의 핸디를 가감한다.
--   ▶ 계속 1등조가 되어 경기 H'cap이 떨어져 있다가 단 1회라도 2등조에 들면
--     기준 H'cap으로 원상 복귀한다. (2등조도 같음)
--
-- 고친 점 두 가지
--  (1) 당월 결과만으로 ±1 하는 특례를 **1월에만** 준다. 전에는 연중에 기준
--      핸디를 다시 매긴 달(예: 2026-07)도 특례로 쳐서, 조가 바뀐 회원까지
--      ±1 되고 그 값이 다음 달 당월핸디로 계속 흘러갔다.
--  (2) 비교할 '전월 조'를 직전 **라운드**의 조로 본다. 규칙표의 "계속 1등조가
--      되어 … 단 1회라도" 는 달력이 아니라 경기를 세는 말이다. 직전 달만 보면
--      그 달 쉰 사람은 비교할 조가 없어 전부 조 변경으로 몰렸다.

create or replace function public.recompute_next_hc()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_meeting_id int; v_ym text; v_next_ym text; v_is_jan boolean;
begin
  v_meeting_id := coalesce(NEW.meeting_id, OLD.meeting_id);
  select year_month into v_ym from meetings where id = v_meeting_id;
  if v_ym is null then return null; end if;

  v_next_ym := to_char(to_date(v_ym,'YYYY-MM') + interval '1 month', 'YYYY-MM');
  v_is_jan  := right(v_ym,2) = '01';

  -- (A) 당월 차월핸디: 1월이거나 직전 라운드와 같은 조 → ±1,
  --     조 바뀜 → 기준핸디 복귀, 미참석·스코어 없음 → 당월핸디 유지
  update monthly_handicaps mh
  set next_hc = sub.next_hc
  from (
    select mh2.member_id,
      case
        when r.attended is true and r.score is not null and r.score > 0 and r.result_group is not null then
          case
            when v_is_jan or (pg.result_group is not null and pg.result_group = r.result_group)
            then case when r.result_group = '1등조' then mh2.app_hc - 1 else mh2.app_hc + 1 end
            else mh2.std_hc
          end
        else mh2.app_hc
      end as next_hc
    from monthly_handicaps mh2
    left join meeting_results r on r.meeting_id = v_meeting_id and r.member_id = mh2.member_id
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

  -- (B) 다음 달 미시행 시 당월핸디 이월 생성/갱신 (기존과 동일)
  if TG_OP <> 'DELETE'
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

  return null;
end;
$function$;
