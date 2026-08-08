// 세션 토큰 저장소.
//
// 토큰은 서버(verify_pin RPC)가 발급한 불투명 문자열이다. 프런트엔드는 토큰을
// 해석하지 않고 그대로 보관했다가 요청 헤더에 실어 보내기만 한다. 권한 판정과
// 만료 판정의 최종 권한은 전적으로 서버(RLS)에 있으며, 여기 저장된 expiresAt 은
// 만료가 뻔한 토큰을 미리 버리기 위한 UI 편의값일 뿐이다.
//
// 저장 위치는 두 곳이다.
//  - localStorage:   "이 기기에서 로그인 유지" 를 고른 경우. 브라우저를 닫아도 남는다.
//  - sessionStorage: 기본값. 탭을 닫으면 사라진다 (공용 기기 대비).
// 서버 토큰 자체는 어느 쪽이든 30일짜리다 — 여기서 정하는 건 이 브라우저가
// 얼마나 오래 들고 있느냐뿐이다.
//
// 이 모듈은 supabase 클라이언트를 import 하지 않는다. supabase.ts 가 요청마다
// getSessionToken() 을 호출하므로 순환 참조가 되기 때문이다.

/** 앱이 브라우저에 남기는 키는 전부 이 접두사를 쓴다. 로그아웃 때 한 번에 지운다. */
export const STORAGE_PREFIX = 'taman:';

const SESSION_KEY = `${STORAGE_PREFIX}session`;

// 접두사 규칙 이전에 쓰던 키. 남겨 두면 로그아웃해도 지워지지 않아 다음
// 사용자에게 보인다. 지우기만 하고 새로 쓰지는 않는다.
const LEGACY_KEYS = ['golf_auth_member', 'golf_future_attendance'];

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

function parse(raw: string | null): StoredSession | null {
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

// 기기에 남겨 둔 세션이 먼저다. 둘 다 있을 일은 없지만(저장할 때 반대쪽을
// 지운다) 만약 남아 있다면 오래가는 쪽을 따른다.
function stores(): Storage[] {
  return [localStorage, sessionStorage];
}

function read(): StoredSession | null {
  for (const store of stores()) {
    const session = parse(store.getItem(SESSION_KEY));
    if (session) return session;
    // 만료됐거나 깨진 값은 그 자리에서 버린다.
    if (store.getItem(SESSION_KEY) !== null) store.removeItem(SESSION_KEY);
  }
  return null;
}

export function loadSession(): StoredSession | null {
  if (cached === undefined) cached = read();
  return cached;
}

/**
 * @param remember true 면 브라우저를 닫아도 유지한다. 넘기지 않으면 지금 저장된
 *   위치를 그대로 따른다 — 세션 갱신(revalidate)이 사용자의 선택을 뒤집지 않도록.
 */
export function saveSession(session: StoredSession, remember?: boolean): void {
  const persist = remember ?? localStorage.getItem(SESSION_KEY) !== null;
  const target = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;

  cached = session;
  other.removeItem(SESSION_KEY);
  target.setItem(SESSION_KEY, JSON.stringify(session));
}

/** 로그아웃. 세션뿐 아니라 앱이 남긴 값을 전부 지운다. */
export function clearSession(): void {
  cached = null;
  for (const store of stores()) {
    // 순회 중 지우면 인덱스가 밀린다. 키를 먼저 모은 뒤 지운다.
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && (key.startsWith(STORAGE_PREFIX) || LEGACY_KEYS.includes(key))) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  }
}

/** supabase.ts 의 fetch 래퍼가 매 요청마다 호출한다. */
export function getSessionToken(): string | null {
  return loadSession()?.token ?? null;
}

/** 다른 탭에서 로그인/로그아웃한 경우 캐시를 버린다. */
export function invalidateSessionCache(): void {
  cached = undefined;
}
