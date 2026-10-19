-- P8 · 참석 확인 '미정' 을 DB 에 남긴다
--
-- attendance_confirmations.attending 이 NOT NULL 이라 프런트는 '미정' 을
-- "행 삭제" 로 표현했다. 그 결과 '미정' 으로 답한 뒤 로그아웃하면
-- (localStorage 가 비워지고) DB 에는 답이 없어 '미응답' 으로 되돌아갔다.
--
-- 세 가지 답(참석 true / 불참 false / 미정 null)을 모두 행으로 남기고,
-- 행이 없는 경우만 '미응답' 으로 둔다.

alter table public.attendance_confirmations
  alter column attending drop not null,
  alter column attending drop default;

comment on column public.attendance_confirmations.attending is
  'true=참석, false=불참, null=미정. 행이 없으면 아직 답하지 않은 것.';
