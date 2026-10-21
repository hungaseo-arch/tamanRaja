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
// 그 30일과 별개로 "마지막 조작 이후 30분" 이라는 유휴 한도가 있다(lastActiveAt).
// 로그인 유지를 켰든 껐든 똑같이 걸린다 — 켜 두고 자리를 뜬 기기가 그대로
// 열려 있지 않게 하려는 것이므로 예외를 두면 의미가 없다. 서버도 같은 규칙을
// 조금 더 넉넉한 값으로 갖고 있다 (app.idle_timeout()).
//
// 이 모듈은 supabase 클라이언트를 import 하지 않는다. supabase.ts 가 요청마다
// getSessionToken() 을 호출하므로 순환 참조가 되기 때문이다. 서버에 활동을
// 알리는 일(touch_session RPC)은 useIdleLogout 이 맡는다.

/** 앱이 브라우저에 남기는 키는 전부 이 접두사를 쓴다. 로그아웃 때 한 번에 지운다. */
export const STORAGE_PREFIX = 'taman:';

const SESSION_KEY = `${STORAGE_PREFIX}session`;

/** 마지막 조작 이후 이만큼 지나면 세션을 버린다. 사용자에게 약속한 값. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// lastActiveAt 을 storage 에 적는 간격. 조작마다 적으면 다른 탭의 storage
// 이벤트까지 그만큼 깨운다. 캐시는 매번 갱신되므로 이 탭의 판정은 정확하고,
// 새로고침 직후에만 최대 이만큼 손해를 본다.
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

// 접두사 규칙 이전에 쓰던 키. 남겨 두면 로그아웃해도 지워지지 않아 다음
// 사용자에게 보인다. 지우기만 하고 새로 쓰지는 않는다.
const LEGACY_KEYS = ['golf_auth_member', 'golf_future_attendance'];

export type MemberRole = 'admin' | 'member';

export interface SessionMember {
  id: string;
  name: string;
  role: MemberRole;
  /** 관리자가 정한 임시 PIN 상태. true 면 PIN 을 바꾸기 전까지 변경 창이 닫히지 않는다. */
  mustChange?: boolean;
}

export interface StoredSession {
  token: string;
  expiresAt: string;
  member: SessionMember;
  /** 마지막 조작 시각(ISO). 유휴 자동 로그아웃의 기준. */
  lastActiveAt?: string;
}

// 요청 헤더에 실을 토큰을 동기적으로 얻기 위한 캐시.
// storage 접근은 느리고, supabase 의 fetch 래퍼는 매 요청마다 호출된다.
let cached: StoredSession | null | undefined;
let lastWriteAt = 0;

/**
 * 이 세션이 유휴로 버려지는 시각(ms). lastActiveAt 이 없는 세션은 이 기능
 * 이전에 저장된 것이라 마지막 조작을 알 수 없다 — 한 번은 살려 두고 첫
 * 조작에서 값을 채운다 (서버 쪽 유휴 판정이 뒷단속을 한다).
 */
function idleDeadline(session: StoredSession): number {
  if (!session.lastActiveAt) return Infinity;
  const at = new Date(session.lastActiveAt).getTime();
  return Number.isNaN(at) ? Infinity : at + IDLE_TIMEOUT_MS;
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.member?.id) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) return null;
    if (Date.now() >= idleDeadline(parsed)) return null;
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
  // 캐시에 담긴 뒤로 유휴 시간이 지났을 수 있다. 이 값이 곧 요청 헤더에
  // 실리는 토큰이므로, 타이머와 별개로 여기서도 한 번 본다 — 절전에서
  // 깨어난 직후처럼 타이머가 늦게 도는 상황에서도 끝난 세션을 안 보낸다.
  if (cached && Date.now() >= idleDeadline(cached)) {
    clearSession();
    return null;
  }
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

  const next: StoredSession = { ...session, lastActiveAt: session.lastActiveAt ?? new Date().toISOString() };
  cached = next;
  lastWriteAt = Date.now();
  other.removeItem(SESSION_KEY);
  target.setItem(SESSION_KEY, JSON.stringify(next));
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

/** 유휴 만료까지 남은 시간(ms). 세션이 없거나 이미 지났으면 0. */
export function idleRemainingMs(): number {
  const session = loadSession();
  if (!session) return 0;
  const deadline = idleDeadline(session);
  if (deadline === Infinity) return IDLE_TIMEOUT_MS;
  return Math.max(0, deadline - Date.now());
}

/**
 * 사용자가 무언가 조작했다고 알린다. 유휴 시계를 처음으로 되돌린다.
 * 서버(last_seen_at)에 알리는 것은 별개다 — useIdleLogout 이 더 긴 간격으로
 * 묶어 보낸다.
 */
export function touchSession(): void {
  const session = loadSession();
  if (!session) return;

  const now = Date.now();
  cached = { ...session, lastActiveAt: new Date(now).toISOString() };
  if (now - lastWriteAt < ACTIVITY_WRITE_INTERVAL_MS) return;
  saveSession(cached);
}
