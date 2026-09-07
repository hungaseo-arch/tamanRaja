-- P6-3 · 새로 만든 app 함수에 search_path 고정
--
-- P6-1 에서 만든 app.idle_timeout() 과 app.request_user_agent() 에만
-- search_path 선언이 빠져 있었다 (Supabase 린터의 function_search_path_mutable).
--
-- 둘 다 security definer 가 아니고 public 실행 권한도 회수돼 있어 실제로
-- 뚫릴 구멍은 아니다. 다만 저장소의 다른 함수는 전부 search_path 를 못박아
-- 두었고, 예외를 하나 두면 "이건 왜 다른가" 를 매번 다시 따져야 한다.
--
-- 참고: SET 절이 붙으면 SQL 함수는 인라인되지 않는다. idle_timeout() 은
-- current_member_id() 의 WHERE 안에서 불리지만 그 질의는 token_hash 인덱스로
-- 한 행을 집으므로 호출 횟수 차이가 없다.

create or replace function app.idle_timeout()
returns interval
language sql
immutable
set search_path = pg_catalog
as $$
  select interval '35 minutes'
$$;

comment on function app.idle_timeout() is
  '유휴 세션 만료 기준. 프런트의 30분 + 갱신 스로틀(5분) 여유.';

create or replace function app.request_user_agent()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select left(nullif(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300)
$$;

-- create or replace 는 기존 권한을 유지하지만, 새로 만들어졌을 경우를 대비해
-- 다시 회수한다. 이 두 함수는 SECURITY DEFINER 함수 안에서만 불린다.
revoke all on function app.idle_timeout()       from public;
revoke all on function app.request_user_agent() from public;
