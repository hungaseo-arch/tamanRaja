-- P3-5: 화면에 박아둔 공지 문구를 설정 테이블로
--
-- "* 기준 핸디는 2026년 7월 부터 신규 적용" 이 월간 기록·연간 랭킹·나의 기록
-- 세 파일에 각각 하드코딩돼 있었다. 문구를 고치려면 코드를 고치고 배포해야
-- 하고, 세 곳 중 하나를 빠뜨리면 화면마다 다른 말이 나간다.
--
-- ⚠️ 이 마이그레이션은 프런트를 먼저 배포한 뒤에 적용해도 안전하다.
--    테이블이 없는 동안 프런트는 조회 실패를 삼키고 문구를 그냥 감춘다.
--    (반대 순서도 안전하다 — 구버전 프런트는 이 테이블을 아예 안 읽는다.)

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  -- 관리 화면을 만들 때 "누가 언제 바꿨나"를 물어보게 된다. 나중에 컬럼을
  -- 더하면 기존 행의 이력이 비므로 지금부터 남긴다.
  updated_at timestamptz not null default now(),
  updated_by integer references public.members(id)
);

comment on table public.app_settings is
  '화면 문구 등 코드 배포 없이 바꿔야 하는 값. key 단위로 읽는다.';

alter table public.app_settings enable row level security;

-- 읽기: 다른 기록 테이블과 같은 규칙(P1-2). 이 문구가 걸리는 화면은 전부
-- 로그인 뒤에만 열리므로 익명에게 열어둘 이유가 없다.
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to anon, authenticated
  using (app.current_member_id() is not null);

-- 쓰기: 관리자만. 모임 기록과 달리 전월 Host 에게는 열지 않는다 — 이건
-- 특정 달의 기록이 아니라 모임 전체에 걸리는 문구다.
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to anon, authenticated
  using (app.is_admin())
  with check (app.is_admin());

grant select on table public.app_settings to anon, authenticated;
grant insert, update, delete on table public.app_settings to anon, authenticated;

-- 현재 화면에 나가고 있는 문구를 그대로 옮긴다. 이미 있으면 건드리지 않는다
-- (재적용 시 운영에서 수정한 문구를 되돌리면 안 된다).
insert into public.app_settings (key, value)
values ('handicap_notice', '* 기준 핸디는 2026년 7월 부터 신규 적용')
on conflict (key) do nothing;
