-- P8 · Host 단일 소스 (작업지시서 3-2)
--
-- Host 는 두 곳에 저장돼 왔다: meetings.host_member_id 와
-- meeting_results.result_rank = 'Host'. 2022 년부터 값이 다 있는 결과표 쪽을
-- 진실 소스로 삼고, meetings.host_member_id 는 결과표에서 따라오는 파생값으로
-- 둔다. save_meeting_results 는 이미 결과표의 Host 로 채우지만, RPC 를 거치지
-- 않는 쓰기(콘솔 수정 등)에서도 어긋나지 않게 트리거로 맞춘다.
--
-- 맞춰 두면 meetings 기준으로 세는 곳(admin_members 의 기획 이력,
-- delete_member 의 가드, is_meeting_manager)도 결과표와 같은 값을 본다.
-- 과거 데이터 백필은 20261021000900_p8_host_backfill.sql (D2).
--
-- 추가형이다. 구버전 프런트에 영향이 없다.

-- ── 1. 한 모임의 host_member_id 를 결과표의 Host 로 ──────────────────────────
create or replace function app.sync_meeting_host(p_meeting_id integer)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.meetings m
  set host_member_id = h.member_id
  from (
    select (select r.member_id
              from public.meeting_results r
             where r.meeting_id = p_meeting_id and r.result_rank = 'Host'
             order by r.member_id
             limit 1) as member_id
  ) h
  where m.id = p_meeting_id
    and m.host_member_id is distinct from h.member_id;
$$;

revoke all on function app.sync_meeting_host(integer) from public;

-- ── 2. 결과표가 바뀌면 그 모임을 맞춘다 (재계산 트리거와 같은 문장 단위) ──────
create or replace function public.sync_meeting_host_stmt()
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
      perform app.sync_meeting_host(v_id);
    end loop;
  elsif TG_OP = 'UPDATE' then
    for v_id in select meeting_id from new_rows union select meeting_id from old_rows loop
      perform app.sync_meeting_host(v_id);
    end loop;
  else
    for v_id in select distinct meeting_id from old_rows loop
      perform app.sync_meeting_host(v_id);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_meeting_host_ins on public.meeting_results;
drop trigger if exists trg_sync_meeting_host_upd on public.meeting_results;
drop trigger if exists trg_sync_meeting_host_del on public.meeting_results;

create trigger trg_sync_meeting_host_ins
  after insert on public.meeting_results
  referencing new table as new_rows
  for each statement execute function public.sync_meeting_host_stmt();

create trigger trg_sync_meeting_host_upd
  after update on public.meeting_results
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.sync_meeting_host_stmt();

create trigger trg_sync_meeting_host_del
  after delete on public.meeting_results
  referencing old table as old_rows
  for each statement execute function public.sync_meeting_host_stmt();

-- ── 3. 권한 판정 주석 ─────────────────────────────────────────────────────────
-- can_manage_month 는 두 값을 OR 로 본다. 동기화 뒤에는 같은 값이라 결과가
-- 같지만, 트리거가 빠진 환경에서도 결과표의 Host 가 권한을 잃지 않도록 둔다.
comment on function app.can_manage_month(text) is
  '관리자 또는 전월 Host. Host 진실 소스는 meeting_results.result_rank=''Host'' 이고 meetings.host_member_id 는 트리거(trg_sync_meeting_host_*)로 따라오는 파생값. OR 판정은 안전장치로 둔다.';

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop trigger if exists trg_sync_meeting_host_ins on public.meeting_results;
-- drop trigger if exists trg_sync_meeting_host_upd on public.meeting_results;
-- drop trigger if exists trg_sync_meeting_host_del on public.meeting_results;
-- drop function if exists public.sync_meeting_host_stmt();
-- drop function if exists app.sync_meeting_host(integer);
-- comment on function app.can_manage_month(text) is null;
