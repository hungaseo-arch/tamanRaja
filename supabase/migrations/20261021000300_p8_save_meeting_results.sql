-- P8 · 월 기록 저장 단일 트랜잭션
--
-- 지금까지 월 기록 저장은 프런트가 요청 4개(골프장 → meetings → results
-- 전부 삭제 → 전부 삽입)를 차례로 보냈다. 삭제와 삽입 사이에 연결이 끊기면
-- 그 달 결과가 통째로 빈다(README "알려진 제한" 1번).
--
--  1) save_meeting_results(): 위 네 단계를 함수 하나(= 트랜잭션 하나)로.
--     security invoker — 호출자 권한으로 돌아서 기존 RLS
--     (can_manage_month · can_manage_meeting · golf_courses_insert)가 그대로
--     권한 경계다. 새 경계를 만들지 않는다. 앞단의 can_manage_month 확인은
--     RLS 의 영어 오류 대신 우리말 안내를 주려는 것일 뿐이다.
--     결과 행은 지우고 다시 넣지 않고 (meeting_id, member_id) 로 upsert 하며,
--     입력에 없는 회원의 행만 지운다.
--  2) 입력 검증(쓰기 전에 전부): 스코어 정수 -20~60(프런트 SCORE_MIN·MAX 와
--     같음), 시상은 Winner·Medalist·Host 만, Host 는 최대 1명, 당월 핸디가
--     없는 회원이 있으면 거절(reason = 'no_handicap', 3-4).
--  3) recompute_next_hc 를 행 단위 → 문장 단위 트리거로. 20명을 저장하면
--     같은 달 재계산이 20번(구버전 경로는 삭제 20 + 삽입 20) 돌던 것이 문장당
--     1번이 된다. 계산 본문은 app.recompute_next_hc_for_meeting() 으로 떼어
--     냈고 내용은 바꾸지 않았다 — 결과는 마지막 행 기준 재계산과 같다.
--
-- 추가형이다. 구버전 프런트(4단계 요청)도 그대로 저장되고, 트리거가 문장
-- 단위가 되어도 최종 결과는 같다. 그래서 DB 먼저 적용 → 프런트 배포.

-- ── 1. 차월 핸디 재계산 본문 (기존 트리거 함수에서 그대로 옮김) ─────────────
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
end;
$$;

revoke all on function app.recompute_next_hc_for_meeting(integer, boolean) from public;

-- ── 2. 문장 단위 트리거 ──────────────────────────────────────────────────────
-- 전이 테이블은 이벤트가 하나인 트리거에만 붙일 수 있어 셋으로 나눈다.
-- plpgsql 은 쿼리를 실행할 때 해석하므로, 실행되지 않는 분기의 전이 테이블
-- 이름은 문제가 되지 않는다.
create or replace function public.recompute_next_hc_stmt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id integer;
begin
  if TG_OP = 'INSERT' then
    for v_id in select distinct meeting_id from new_rows loop
      perform app.recompute_next_hc_for_meeting(v_id, true);
    end loop;
  elsif TG_OP = 'UPDATE' then
    for v_id in select meeting_id from new_rows union select meeting_id from old_rows loop
      perform app.recompute_next_hc_for_meeting(v_id, true);
    end loop;
  else
    for v_id in select distinct meeting_id from old_rows loop
      perform app.recompute_next_hc_for_meeting(v_id, false);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_recompute_next_hc on public.meeting_results;

create trigger trg_recompute_next_hc_ins
  after insert on public.meeting_results
  referencing new table as new_rows
  for each statement execute function public.recompute_next_hc_stmt();

create trigger trg_recompute_next_hc_upd
  after update on public.meeting_results
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.recompute_next_hc_stmt();

create trigger trg_recompute_next_hc_del
  after delete on public.meeting_results
  referencing old table as old_rows
  for each statement execute function public.recompute_next_hc_stmt();

-- 옛 행 단위 트리거 함수는 더 쓰지 않는다. 되돌릴 때를 위해 남겨 둔다.
comment on function public.recompute_next_hc() is
  'P8 이후 미사용 — trg_recompute_next_hc_{ins,upd,del}(recompute_next_hc_stmt) 로 대체.';

-- ── 3. 월 기록 저장 ──────────────────────────────────────────────────────────
-- p_rows: [{member_id, attended, score, result_group, result_rank}, …]
--         화면에 보이는 회원 전원. 여기 없는 회원의 그 달 결과 행은 지운다.
create or replace function public.save_meeting_results(
  p_year_month      text,
  p_meeting_date    date,
  p_course_id       integer,
  p_new_course_name text,
  p_host_member_id  integer,
  p_rows            jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, app, public
as $$
declare
  c_score_min constant integer := -20;   -- MonthlyTable.vue SCORE_MIN
  c_score_max constant integer := 60;    -- MonthlyTable.vue SCORE_MAX

  v_course_name text := nullif(btrim(coalesce(p_new_course_name, '')), '');
  v_course_id   integer := p_course_id;
  v_meeting_id  integer;
  v_has_scores  boolean;
  v_prev_ym     text;
  v_prev_open   boolean;
  v_bad         text;
  v_hosts       integer[];
  v_count       integer;
  v_rows        jsonb;
begin
  -- ── 검증 (쓰기 전에 전부) ──
  if p_year_month is null or p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_month',
      'message', '연월 형식이 올바르지 않습니다.');
  end if;

  if p_meeting_date is null then
    return jsonb_build_object('ok', false, 'reason', 'no_date',
      'message', '경기일을 입력해 주세요.');
  end if;

  if not app.can_manage_month(p_year_month) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden',
      'message', '이 달의 기록을 저장할 권한이 없습니다. (관리자 또는 전월 Host)');
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_rows',
      'message', '저장할 회원 행이 없습니다.');
  end if;

  -- 행 펼치기. 스코어가 있으면 참석으로 보고(참석 칸이 없는 당월 수정 화면
  -- 대응), 참석하지 않은 행의 스코어·조·시상은 버린다 — 프런트와 같은 규칙.
  -- 임시 테이블 대신 jsonb 변수에 담는다(호출 역할의 TEMP 권한에 기대지 않으려고).
  select string_agg(m.name, ', ' order by m.name) into v_bad
  from jsonb_array_elements(p_rows) e
  join public.members m on m.id = (e->>'member_id')::integer
  where nullif(btrim(coalesce(e->>'score', '')), '') is not null
    -- SQL 의 or 는 단락 평가가 보장되지 않아 형변환은 case 안에서만 한다.
    and case when btrim(e->>'score') ~ '^-?\d{1,3}$'
             then btrim(e->>'score')::integer not between c_score_min and c_score_max
             else true end;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_score',
      'message', format('스코어는 %s~%s 사이의 정수여야 합니다 — %s', c_score_min, c_score_max, v_bad));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id',    x.member_id,
           'attended',     x.attended,
           'score',        case when x.attended then x.score end,
           'result_group', case when x.attended then x.result_group end,
           'result_rank',  case when x.attended then x.result_rank end)), '[]'::jsonb)
    into v_rows
  from (
    select (e->>'member_id')::integer as member_id,
           coalesce((e->>'attended')::boolean, false)
             or nullif(btrim(coalesce(e->>'score', '')), '') is not null as attended,
           nullif(btrim(coalesce(e->>'score', '')), '')::integer as score,
           nullif(btrim(coalesce(e->>'result_group', '')), '') as result_group,
           nullif(btrim(coalesce(e->>'result_rank', '')), '') as result_rank
    from jsonb_array_elements(p_rows) e
  ) x;

  if exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer) where r.member_id is null)
     or exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer)
                group by r.member_id having count(*) > 1)
     or exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer)
                where not exists (select 1 from public.members m where m.id = r.member_id)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_rows',
      'message', '회원 행이 비었거나 중복되었거나 없는 회원입니다.');
  end if;

  if exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text) where result_group is not null and result_group not in ('1등조', '2등조')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_group',
      'message', '조는 1등조·2등조 중 하나여야 합니다.');
  end if;

  if exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text) where result_rank is not null and result_rank not in ('Winner', 'Medalist', 'Host')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_rank',
      'message', '시상은 Winner·Medalist·Host 중 하나여야 합니다.');
  end if;

  select array_agg(member_id) into v_hosts from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text) where result_rank = 'Host';
  if coalesce(array_length(v_hosts, 1), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'multiple_hosts',
      'message', 'Host 는 한 명만 지정할 수 있습니다.');
  end if;
  if p_host_member_id is not null and p_host_member_id is distinct from v_hosts[1] then
    return jsonb_build_object('ok', false, 'reason', 'host_mismatch',
      'message', 'Host 지정이 결과 표와 맞지 않습니다. 새로고침 후 다시 저장해 주세요.');
  end if;

  -- 당월 핸디(3-4). 화면(resolveHandicap)과 같은 규칙: 그 달 행이 있으면 그
  -- app_hc, 없으면 가장 최근 달의 next_hc. 단 전월 모임이 있는데 스코어가 하나도
  -- 없으면(전월 미확정) 당월 핸디는 아직 없는 것이다.
  -- 이미 스코어가 저장된 달(관리자 사후 수정)은 참석·스코어 행만 본다 — 옛 달에는
  -- 불참한 회원의 당월 핸디가 빈 경우가 있다.
  select exists (
    select 1 from public.meeting_results r join public.meetings m on m.id = r.meeting_id
    where m.year_month = p_year_month and r.score is not null
  ) into v_has_scores;

  v_prev_ym := to_char(to_date(p_year_month, 'YYYY-MM') - interval '1 month', 'YYYY-MM');
  select exists (select 1 from public.meeting_results r where r.meeting_id = m.id)
         and not exists (select 1 from public.meeting_results r where r.meeting_id = m.id and r.score is not null)
    into v_prev_open
  from public.meetings m where m.year_month = v_prev_ym;

  select string_agg(mem.name, ', ' order by mem.name) into v_bad
  from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text)
  join public.members mem on mem.id = r.member_id
  left join public.monthly_handicaps cur
    on cur.member_id = r.member_id and cur.year_month = p_year_month
  left join lateral (
    select h.next_hc from public.monthly_handicaps h
    where h.member_id = r.member_id and h.year_month < p_year_month
    order by h.year_month desc limit 1
  ) prev on true
  where (not v_has_scores or r.attended)
    and (coalesce(v_prev_open, false)
         or (case when cur.member_id is not null then cur.app_hc else prev.next_hc end) is null);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'no_handicap',
      'message', format('당월 핸디가 없는 회원이 있어 저장할 수 없습니다 — %s. 직전 달 결과가 저장되면 당월 핸디가 생깁니다.', v_bad));
  end if;

  -- ── 쓰기 (여기부터 오류가 나면 전부 롤백) ──
  if v_course_id is null and v_course_name is not null then
    select g.id into v_course_id from public.golf_courses g
    where btrim(g.name) = v_course_name order by g.id limit 1;
    if v_course_id is null then
      insert into public.golf_courses (name) values (v_course_name) returning id into v_course_id;
    end if;
  end if;

  insert into public.meetings (year_month, meeting_date, course_id, host_member_id)
  values (p_year_month, p_meeting_date, v_course_id, v_hosts[1])
  on conflict (year_month) do update
     set meeting_date   = excluded.meeting_date,
         course_id      = excluded.course_id,
         host_member_id = excluded.host_member_id
  returning id into v_meeting_id;

  delete from public.meeting_results mr
  where mr.meeting_id = v_meeting_id
    and not exists (select 1 from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text) where r.member_id = mr.member_id);

  insert into public.meeting_results (meeting_id, member_id, attended, score, result_group, result_rank)
  select v_meeting_id, r.member_id, r.attended, r.score, r.result_group, r.result_rank
  from jsonb_to_recordset(v_rows) as r(member_id integer, attended boolean, score integer, result_group text, result_rank text)
  on conflict (meeting_id, member_id) do update
     set attended     = excluded.attended,
         score        = excluded.score,
         result_group = excluded.result_group,
         result_rank  = excluded.result_rank;
  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', true, 'meeting_id', v_meeting_id, 'saved', v_count);
end;
$$;

revoke all on function public.save_meeting_results(text, date, integer, text, integer, jsonb) from public;
grant execute on function public.save_meeting_results(text, date, integer, text, integer, jsonb) to anon, authenticated;

comment on function public.save_meeting_results(text, date, integer, text, integer, jsonb) is
  '월 기록(모임·결과) 저장을 한 트랜잭션으로. security invoker — 권한은 기존 RLS.';

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop function if exists public.save_meeting_results(text, date, integer, text, integer, jsonb);
-- drop trigger if exists trg_recompute_next_hc_ins on public.meeting_results;
-- drop trigger if exists trg_recompute_next_hc_upd on public.meeting_results;
-- drop trigger if exists trg_recompute_next_hc_del on public.meeting_results;
-- create trigger trg_recompute_next_hc after insert or update or delete on public.meeting_results
--   for each row execute function public.recompute_next_hc();
-- drop function if exists public.recompute_next_hc_stmt();
-- drop function if exists app.recompute_next_hc_for_meeting(integer, boolean);
