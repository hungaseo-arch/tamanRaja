// 세션 토큰 저장소.
//
// 토큰은 서버(verify_pin RPC)가 발급한 불투명 문자열이다. 프런트엔드는 토큰을
// 해석하지 않고 그대로 보관했다가 요청 헤더에 실어 보내기만 한다. 권한 판정과
// 만료 판정의 최종 권한은 전적으로 서버(RLS)에 있으며, 여기 저장된 expiresAt 은
// 만료가 뻔한 토큰을 미리 버리기 위한 UI 편의값일 뿐이다.
//
// 이 모듈은 supabase 클라이언트를 import 하지 않는다. supabase.ts 가 요청마다
// getSessionToken() 을 호출하므로 순환 참조가 되기 때문이다.

const SESSION_KEY = 'taman:session';

export type MemberRole = 'admin' | 'member';

export interface SessionMember {
  id: string;
  name: string;
  role: MemberRole;
}

export interface StoredSession {
  token: string;
  expiresAt: string;
  member: SessionMember;
}

// 요청 헤더에 실을 토큰을 동기적으로 얻기 위한 캐시.
// storage 접근은 느리고, supabase 의 fetch 래퍼는 매 요청마다 호출된다.
let cached: StoredSession | null | undefined;

function read(): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.member?.id) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadSession(): StoredSession | null {
  if (cached === undefined) cached = read();
  return cached;
}

export function saveSession(session: StoredSession): void {
  cached = session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  cached = null;
  sessionStorage.removeItem(SESSION_KEY);
}

/** supabase.ts 의 fetch 래퍼가 매 요청마다 호출한다. */
export function getSessionToken(): string | null {
  return loadSession()?.token ?? null;
}

/** 다른 탭에서 로그인/로그아웃한 경우 캐시를 버린다. */
export function invalidateSessionCache(): void {
  cached = undefined;
}
