-- P8 · 회원 관리 "기록" 열을 "참석" 으로 (사용자 요청)
--
-- result_count 는 meeting_results 행 수라 불참·미기록 달도 센다. 화면에서는
-- 참석 횟수로 읽혀 헷갈렸다. 스코어가 있는 참석만 센 attended_count 를 더한다.
-- 기준은 차월핸디 계산(recompute_next_hc_for_meeting 의 A)과 같다:
--   attended is true and score > 0
-- result_count 는 그대로 둔다 — 삭제 가능 판단(delete_member)과 상세창이 쓴다.
--
-- 반환 열이 바뀌어 create or replace 가 안 되므로 drop 후 다시 만든다.
-- 열은 끝에 더하므로 구버전 프런트는 그대로 동작한다. 그래서 이 마이그레이션을
-- 프런트보다 먼저 적용한다 (새 프런트는 attended_count 를 읽는다).

drop function if exists public.admin_members();

create function public.admin_members()
returns table (
  id              integer,
  name            text,
  role            text,
  enrollment_year integer,
  dormant_from    text,
  result_count    integer,
  hosted_count    integer,
  last_login_at   timestamptz,
  attended_count  integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app, public
as $$
begin
  perform app.require_admin();

  return query
  select m.id,
         m.name::text,
         m.role,
         m.enrollment_year,
         m.dormant_from::text,
         (select count(*)::integer from public.meeting_results r where r.member_id = m.id),
         (select count(*)::integer from public.meetings g      where g.host_member_id = m.id),
         (select max(e.occurred_at)
            from app.member_auth_events e
           where e.member_id = m.id and e.event = 'login'),
         (select count(*)::integer from public.meeting_results r
           where r.member_id = m.id and r.attended is true and r.score > 0)
  from public.members m
  order by m.id;
end;
$$;

revoke all on function public.admin_members() from public;
grant execute on function public.admin_members() to anon, authenticated;

comment on function public.admin_members() is
  '관리자용 회원 목록. anon 에게 members.role SELECT 권한이 없어 이 RPC 로만 등급을 본다. attended_count = 스코어 있는 참석, result_count = 전체 결과 행(삭제 판단용).';

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop function public.admin_members(); 후 20260907000400_p7_member_admin.sql 의
-- 정의·revoke·grant·comment 를 다시 실행한다 (프런트를 먼저 되돌릴 것).
