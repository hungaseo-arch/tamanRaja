-- P0-1 · 레거시 PIN RPC 제거
--
-- 점검 중 발견: 이전 구현이 남긴 SECURITY DEFINER 함수들이 anon 에게 EXECUTE 가
-- 열린 채 방치되어 있었다. 모두 PIN 을 평문 파라미터로 받아 권한을 판정하며,
-- SECURITY DEFINER 이므로 이후 단계에서 RLS 를 잠가도 그대로 우회한다.
--
--   verify_pin(int, varchar)        - members.pin 대조 (해당 컬럼은 이미 삭제됨)
--   change_pin(int, varchar, varchar)
--   login_by_name_pin(varchar, varchar)
--   save_handicap(int, varchar, ...)        ← 핸디캡 임의 수정
--   save_meeting_result(int, varchar, ...)  ← 스코어/결과 임의 수정
--
-- 현재 프런트엔드는 RPC 를 전혀 호출하지 않으며(`grep -rn "\.rpc(" src/` 결과 없음),
-- 위 함수들은 존재하지 않는 members.pin 컬럼을 참조하므로 이미 런타임 오류 상태다.
-- 따라서 삭제해도 동작 변화가 없다.
--
-- 주의: recompute_next_hc() 는 meeting_results 의 트리거 함수이므로 유지한다.
-- (트리거 반환형이라 PostgREST 가 RPC 로 노출하지 않는다.)

drop function if exists public.verify_pin(integer, character varying);
drop function if exists public.change_pin(integer, character varying, character varying);
drop function if exists public.login_by_name_pin(character varying, character varying);
drop function if exists public.save_handicap(integer, character varying, character varying, integer, integer, integer);
drop function if exists public.save_meeting_result(integer, character varying, character varying, integer, boolean, character varying, character varying);

-- 미사용 읽기 헬퍼도 함께 정리한다(SECURITY INVOKER 라 RLS 는 지키지만, 쓰지 않는
-- 표면은 남겨둘 이유가 없다).
drop function if exists public.get_dashboard(character varying);
drop function if exists public.get_available_months();
