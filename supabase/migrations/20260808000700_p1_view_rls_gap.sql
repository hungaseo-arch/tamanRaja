-- P1-2 보완: 뷰로 우회해 기록을 읽을 수 있던 구멍
--
-- 20260808000500_p1_read_policies.sql 에서 meetings·meeting_results·
-- monthly_handicaps 의 SELECT 를 세션 있는 사람으로 막았는데, 그 테이블들을
-- 조인해 만든 public.v_yearly_summary 뷰는 손대지 않았다.
--
-- 뷰는 기본이 security definer 라 뷰를 만든 사람(postgres, rolbypassrls)의
-- 권한으로 기반 테이블을 읽는다. 그래서 익명 키만 있으면
--   GET /rest/v1/v_yearly_summary?select=*
-- 로 전 회원의 연간 Net·참석횟수·순위 14행이 그대로 나왔다. 익명 키는
-- 프런트 번들에 들어 있으니 사실상 아무나 읽을 수 있었다는 뜻이다.
--
-- security_invoker 를 켜면 뷰가 "호출한 사람"의 권한으로 기반 테이블을
-- 읽으므로 기존 RLS 가 그대로 걸린다. 세션이 없으면 조인 결과가 0행이 된다.
-- 권한 자체를 회수하지 않는 이유는, 로그인한 회원에게는 다른 기록 테이블과
-- 같은 규칙으로 열려 있는 편이 맞기 때문이다.
--
-- (프런트는 현재 이 뷰를 쓰지 않는다. 연간 집계는 클라이언트에서 한다.)

alter view public.v_yearly_summary set (security_invoker = on);

-- 함수 search_path 고정. 세 함수 모두 search_path 가 호출자에 따라 바뀔 수
-- 있어, 같은 이름의 테이블·함수를 앞선 스키마에 심으면 다른 것을 부르게
-- 만들 수 있다. SECURITY DEFINER 인 것이 섞여 있어 더 그렇다.
alter function app.prev_year_month(text)  set search_path = pg_catalog, app, public;
alter function app.session_token()        set search_path = pg_catalog, app, public;
alter function public.set_updated_at()    set search_path = pg_catalog, public;
