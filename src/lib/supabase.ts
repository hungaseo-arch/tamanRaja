import { createClient } from '@supabase/supabase-js';
import { getSessionToken } from './session';

// 세션 토큰 전달 헤더. PostgREST 가 요청 헤더를 request.headers GUC 에 실어주므로
// RLS 정책과 SECURITY DEFINER 함수가 app.current_member_id() 로 호출자를 식별한다.
const SESSION_HEADER = 'x-taman-session';

// 헤더는 클라이언트 생성 시점이 아니라 요청 시점에 결정돼야 한다(로그인/로그아웃이
// 런타임에 일어나므로). fetch 를 감싸 매 요청마다 현재 토큰을 붙인다.
function fetchWithSession(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getSessionToken();

  if (token) {
    headers.set(SESSION_HEADER, token);
  } else {
    headers.delete(SESSION_HEADER);
  }

  return fetch(input, { ...init, headers });
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    // Supabase Auth 는 쓰지 않는다. 인증은 verify_pin RPC + 자체 세션 토큰이다.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithSession },
  },
);
