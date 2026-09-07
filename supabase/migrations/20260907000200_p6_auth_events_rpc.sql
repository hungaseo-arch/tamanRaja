-- P6-2 · 접속 기록 조회 (관리자 전용)
--
-- app.member_auth_events 는 정책이 하나도 없어 클라이언트가 직접 읽을 수 없다.
-- 읽는 길은 이 함수 하나뿐이고, 여기서 관리자 여부를 먼저 따진다.
--
-- security definer 인 이유: 대상 테이블이 app 스키마에 있어 invoker 권한으로는
-- 애초에 닿지 않는다. 대신 함수 첫 줄에서 app.is_admin() 으로 잠근다.

create or replace function public.auth_events(
  p_member_id integer     default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_event     text        default null,
  p_limit     integer     default 300
)
returns table (
  id               bigint,
  member_id        integer,
  member_name      text,
  event            text,
  occurred_at      timestamptz,
  user_agent       text,
  duration_seconds integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app, public
as $$
begin
  if not app.is_admin() then
    -- 빈 목록으로 돌려주면 "기록이 없다"와 구분되지 않는다. 권한이 없다는
    -- 사실 자체를 화면에 그대로 띄운다.
    raise exception '접속 기록은 관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.member_id,
    m.name::text,
    e.event,
    e.occurred_at,
    e.user_agent,
    -- 세션이 끝난 기록에는 그 세션이 얼마나 열려 있었는지를 붙인다.
    -- 같은 session_hash 의 직전 login 을 짝으로 본다 (없으면 null).
    case
      when e.event in ('logout', 'idle_timeout', 'expired') and e.session_hash is not null then (
        select ceil(extract(epoch from (e.occurred_at - l.occurred_at)))::integer
        from app.member_auth_events l
        where l.session_hash = e.session_hash
          and l.event = 'login'
          and l.occurred_at <= e.occurred_at
        order by l.occurred_at desc
        limit 1
      )
    end
  from app.member_auth_events e
  join public.members m on m.id = e.member_id
  where (p_member_id is null or e.member_id = p_member_id)
    and (p_from      is null or e.occurred_at >= p_from)
    and (p_to        is null or e.occurred_at <  p_to)
    and (p_event     is null or e.event = p_event)
  order by e.occurred_at desc, e.id desc
  -- 한 번에 내려보내는 양은 서버가 정한다. 화면이 큰 수를 넣어도 1000줄에서 끊는다.
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

revoke all on function public.auth_events(integer, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.auth_events(integer, timestamptz, timestamptz, text, integer) to anon, authenticated;
