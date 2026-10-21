-- meetings.host_member_id 를 결과표의 Host 로 백필 (작업지시서 D2, 사용자 승인)
--
-- 2022-02 ~ 2026-05 는 null 이었고, 2026-07 은 8(장효익) 으로 결과표의
-- Host 1(고영춘) 과 달랐다. 사용자 확인: 7월 기획자는 고영춘.
-- 결과표에 Host 가 없는 달은 null 이 된다 (파생값이므로).
--
-- 바꾸기 전 값을 app.meetings_host_backup_20261021 에 남긴다 (되돌리기용).
-- 적용 뒤 검증: 아래 쿼리가 0행이어야 한다.
--   select m.year_month, m.host_member_id, r.member_id as result_host
--   from meetings m left join meeting_results r on r.meeting_id = m.id and r.result_rank = 'Host'
--   where m.host_member_id is distinct from r.member_id order by 1;

create table if not exists app.meetings_host_backup_20261021 as
  select id as meeting_id, year_month, host_member_id
  from public.meetings;

revoke all on app.meetings_host_backup_20261021 from public;

do $$
declare v_id integer;
begin
  for v_id in select id from public.meetings loop
    perform app.sync_meeting_host(v_id);
  end loop;
end;
$$;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- update public.meetings m set host_member_id = b.host_member_id
-- from app.meetings_host_backup_20261021 b where b.meeting_id = m.id;
-- (트리거가 있으면 다음 결과 저장 때 다시 결과표 값으로 맞춰진다.
--  되돌리려면 20261021000800 의 rollback 을 먼저 실행할 것.)
-- drop table app.meetings_host_backup_20261021;   -- 확인이 끝난 뒤
