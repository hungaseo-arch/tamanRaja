-- 인간미 보정 (27년 핸디캡 (안) 결과표의 '인간미' · '2027 제안' 열)
--
--   2027 제안 = 2027 기준 + 인간미   (제안값은 저장하지 않고 화면에서 더한다)
--
-- 방침
--   · 별도 테이블로 둔다. handicap_annual 은 산정 시드라 건드리지 않는다.
--   · 조회: 로그인 회원 전체 (handicap_annual 과 같은 방침).
--   · 쓰기: 관리자만, RPC(save_handicap_humanity)로만. 테이블에 쓰기 정책을 두지 않는다.
--   · 값: 정수 -2 ~ +2. 서버가 다시 검증한다 (테이블 CHECK + RPC).
--   · 0 을 저장하면 보정 없음이다. 값을 비우면(null) 행을 지운다.
--
-- 추가형이라 구버전 프런트에는 영향이 없다.

create table if not exists public.handicap_humanity (
  year        smallint not null,
  member_id   integer  not null references public.members(id) on delete cascade,
  adj         smallint not null check (adj between -2 and 2),
  updated_by  integer  references public.members(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (year, member_id)
);

comment on table public.handicap_humanity is
  '연도별 회원 인간미 보정(정수 -2~+2). 2027 제안 = handicap_annual.std_hc + adj.';

alter table public.handicap_humanity enable row level security;

drop policy if exists handicap_humanity_read on public.handicap_humanity;
create policy handicap_humanity_read on public.handicap_humanity
  for select to anon, authenticated
  using (app.current_member_id() is not null);

grant select on public.handicap_humanity to anon, authenticated;

-- ── 저장 RPC ─────────────────────────────────────────────────────────────────
-- p_items: [{"member_id": 3, "adj": 1}, {"member_id": 5, "adj": null}, ...]
--   adj 가 null 이면 그 회원의 값을 지운다. 한 건이라도 잘못이면 전부 되돌린다.
create or replace function public.save_handicap_humanity(p_year integer, p_items jsonb)
returns json
language plpgsql
security definer
set search_path = pg_catalog, app, public
as $$
declare
  v_me    integer := app.current_member_id();
  v_item  jsonb;
  v_mid   integer;
  v_adj   numeric;
  v_saved integer := 0;
begin
  perform app.require_admin();

  if p_year is null or p_year < 2000 or p_year > 2100 then
    return json_build_object('ok', false, 'message', '연도가 올바르지 않습니다.');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return json_build_object('ok', false, 'message', '저장할 항목이 없습니다.');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_mid := (v_item ->> 'member_id')::integer;
    if v_mid is null or not exists (
      select 1 from public.handicap_annual h where h.year = p_year and h.member_id = v_mid
    ) then
      raise exception '대상 회원이 아닙니다: %', coalesce(v_mid::text, 'null');
    end if;

    if v_item -> 'adj' is null or jsonb_typeof(v_item -> 'adj') = 'null' then
      delete from public.handicap_humanity where year = p_year and member_id = v_mid;
    else
      v_adj := (v_item ->> 'adj')::numeric;
      if v_adj <> trunc(v_adj) or v_adj < -2 or v_adj > 2 then
        raise exception '인간미는 -2 ~ +2 사이 정수여야 합니다 (회원 %: %)', v_mid, v_adj;
      end if;
      insert into public.handicap_humanity (year, member_id, adj, updated_by, updated_at)
      values (p_year, v_mid, v_adj::smallint, v_me, now())
      on conflict (year, member_id) do update
         set adj = excluded.adj, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    end if;
    v_saved := v_saved + 1;
  end loop;

  return json_build_object('ok', true, 'saved', v_saved);
exception
  when raise_exception or invalid_text_representation or numeric_value_out_of_range then
    -- 본문 예외는 한 트랜잭션이라 위 변경이 모두 되돌려진다. 사유만 돌려준다.
    return json_build_object('ok', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.save_handicap_humanity(integer, jsonb) from public;
grant execute on function public.save_handicap_humanity(integer, jsonb) to anon, authenticated;

-- ── rollback ─────────────────────────────────────────────────────────────────
-- drop function if exists public.save_handicap_humanity(integer, jsonb);
-- drop table if exists public.handicap_humanity;
