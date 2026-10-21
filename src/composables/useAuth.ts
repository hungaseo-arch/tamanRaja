import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { supabase } from '@/lib/supabase';
import {
  clearSession,
  invalidateSessionCache,
  loadSession,
  saveSession,
  type SessionMember,
} from '@/lib/session';
import { clearAttendance } from '@/composables/useAttendance';

// 모듈 전역 reactive 상태 — 모든 컴포넌트가 공유
const currentMember: Ref<SessionMember | null> = ref(loadSession()?.member ?? null);

if (typeof window !== 'undefined') {
  // 다른 탭에서 로그인/로그아웃한 경우를 따라간다. localStorage 로 세션을
  // 유지하는 경우 이 이벤트가 실제로 뜬다.
  window.addEventListener('storage', () => {
    invalidateSessionCache();
    currentMember.value = loadSession()?.member ?? null;
    // 세션이 사라졌을 때만 참석 사본을 버린다. 다른 탭의 참석 저장에도
    // 반응하면 방금 누른 값이 화면에서 지워진다.
    if (!currentMember.value) clearAttendance();
  });
}

/** 서버 인증 이력에 남길 로그아웃 사유. 'idle' 은 30분 무활동 자동 로그아웃. */
export type LogoutReason = 'idle';

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; remainingAttempts: number | null }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number }
  | { ok: false; reason: 'error'; message: string };

export type ChangePinResult =
  | { ok: true }
  | { ok: false; reason: ChangePinFailure }
  | { ok: false; reason: 'error'; message: string };

type ChangePinFailure = 'invalid' | 'same' | 'weak' | 'invalid_format' | 'locked' | 'unauthenticated';

interface SessionMemberResponse {
  id: number;
  name: string;
  role: 'admin' | 'member';
  must_change?: boolean;
}

interface VerifyPinResponse {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  token?: string;
  expires_at?: string;
  remaining_attempts?: number;
  retry_after_seconds?: number;
  must_change?: boolean;
  member?: { id: number; name: string; role: 'admin' | 'member' };
}

function toSessionMember(m: SessionMemberResponse, mustChange = m.must_change): SessionMember {
  return { id: String(m.id), name: m.name, role: m.role, mustChange: mustChange === true };
}

/** 로그인 실패 사유를 사용자 문구로 옮긴다. PIN 값 자체는 어디에도 노출하지 않는다. */
export function describeLoginError(result: Exclude<LoginResult, { ok: true }>): string {
  switch (result.reason) {
    case 'locked': {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return `PIN 5회 오입력으로 로그인 잠김 · 약 ${minutes}분 후 다시 시도`;
    }
    case 'invalid':
      return result.remainingAttempts !== null
        ? `PIN 불일치 (남은 시도 ${result.remainingAttempts}회)`
        : 'PIN 불일치';
    default:
      return `로그인 중 오류 발생 — ${result.message}`;
  }
}

/** PIN 변경 실패 사유를 사용자 문구로 옮긴다. */
export function describeChangePinError(result: Exclude<ChangePinResult, { ok: true }>): string {
  switch (result.reason) {
    case 'invalid':
      return '기존 PIN 불일치';
    case 'same':
      return '새 PIN이 기존 PIN과 같음';
    case 'weak':
      return '같은 숫자 반복(1111)·연속 숫자(1234) 같은 쉬운 PIN 사용 불가';
    case 'invalid_format':
      return 'PIN은 4자리 숫자만 가능';
    case 'locked':
      return '로그인 일시 잠김 · 잠시 후 다시 시도';
    case 'unauthenticated':
      return '세션 만료 · 다시 로그인 필요';
    default:
      return `저장 중 오류 발생 — ${result.message}`;
  }
}

export interface UseAuthReturn {
  isLoggedIn: ComputedRef<boolean>;
  isAdmin: ComputedRef<boolean>;
  currentMember: Ref<SessionMember | null>;
  login: (memberId: string, pin: string, remember?: boolean) => Promise<LoginResult>;
  logout: (reason?: LogoutReason) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<ChangePinResult>;
  revalidate: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  // PIN 대조는 전적으로 서버에서 일어난다. 프런트엔드는 PIN 을 보관하지도,
  // 비교하지도 않고 그저 서버에 넘기고 결과만 받는다.
  //
  // remember 는 이 브라우저가 토큰을 얼마나 들고 있을지만 정한다. 토큰의 실제
  // 수명(30일)과 폐기 권한은 서버에 있다. 기본은 끔 — 공용 기기에서 무심코
  // 로그인한 사람이 로그인된 채로 남지 않도록 명시적으로 켜게 한다.
  const login = async (memberId: string, pin: string, remember = false): Promise<LoginResult> => {
    const { data, error } = await supabase.rpc('verify_pin', {
      p_member_id: Number(memberId),
      p_pin: pin,
    });

    if (error) return { ok: false, reason: 'error', message: error.message };

    const res = data as VerifyPinResponse | null;
    if (!res) return { ok: false, reason: 'error', message: '서버 응답 없음' };

    if (!res.ok) {
      if (res.reason === 'locked') {
        return { ok: false, reason: 'locked', retryAfterSeconds: res.retry_after_seconds ?? 900 };
      }
      return { ok: false, reason: 'invalid', remainingAttempts: res.remaining_attempts ?? null };
    }

    if (!res.token || !res.member) {
      return { ok: false, reason: 'error', message: '세션 발급 실패' };
    }

    const member = toSessionMember(res.member, res.must_change);
    saveSession(
      { token: res.token, expiresAt: res.expires_at ?? '', member, lastActiveAt: new Date().toISOString() },
      remember,
    );
    currentMember.value = member;
    return { ok: true };
  };

  // reason 은 서버 기록에만 쓰인다 ('idle' → 자동 로그아웃). 값을 넘기지 않으면
  // 본인이 누른 로그아웃으로 남는다.
  const logout = async (reason?: LogoutReason): Promise<void> => {
    // 서버 세션을 먼저 지운다. 실패하더라도 로컬은 반드시 정리한다.
    try {
      await supabase.rpc('logout', reason ? { p_reason: reason } : {});
    } catch {
      /* 네트워크 실패 시에도 로컬 로그아웃은 진행 */
    }
    clearSession();
    clearAttendance();
    currentMember.value = null;
  };

  const changePin = async (oldPin: string, newPin: string): Promise<ChangePinResult> => {
    const { data, error } = await supabase.rpc('change_pin', {
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });

    if (error) return { ok: false, reason: 'error', message: error.message };

    const res = data as { ok: boolean; reason?: string } | null;
    if (!res) return { ok: false, reason: 'error', message: '서버 응답 없음' };
    if (res.ok) {
      // 서버가 must_change 를 내렸다. 변경 창이 바로 닫히도록 여기서도 맞춘다.
      if (currentMember.value?.mustChange) {
        const member = { ...currentMember.value, mustChange: false };
        const stored = loadSession();
        if (stored) saveSession({ ...stored, member });
        currentMember.value = member;
      }
      return { ok: true };
    }

    return { ok: false, reason: (res.reason ?? 'invalid') as ChangePinFailure };
  };

  // 저장된 토큰이 서버에서도 아직 유효한지 확인한다. 만료·폐기된 세션으로
  // 로그인된 것처럼 보이는 상태를 막는다.
  const revalidate = async (): Promise<boolean> => {
    if (!loadSession()) {
      currentMember.value = null;
      return false;
    }

    const { data, error } = await supabase.rpc('session_member');
    if (error) return currentMember.value !== null; // 네트워크 오류면 기존 상태 유지

    const res = data as SessionMemberResponse | null;
    if (!res) {
      clearSession();
      currentMember.value = null;
      return false;
    }

    // 서버가 알려준 역할·must_change 가 최종 권위 — 저장된 값이 낡았으면 갱신한다.
    const member = toSessionMember(res);
    const stored = loadSession();
    if (stored) saveSession({ ...stored, member });
    currentMember.value = member;
    return true;
  };

  return {
    isLoggedIn: computed(() => currentMember.value !== null),
    isAdmin: computed(() => currentMember.value?.role === 'admin'),
    currentMember,
    login,
    logout,
    changePin,
    revalidate,
  };
}
