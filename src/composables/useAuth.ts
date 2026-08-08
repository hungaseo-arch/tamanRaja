import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { supabase } from '@/lib/supabase';
import {
  clearSession,
  invalidateSessionCache,
  loadSession,
  saveSession,
  type SessionMember,
} from '@/lib/session';

// 모듈 전역 reactive 상태 — 모든 컴포넌트가 공유
const currentMember: Ref<SessionMember | null> = ref(loadSession()?.member ?? null);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    invalidateSessionCache();
    currentMember.value = loadSession()?.member ?? null;
  });
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; remainingAttempts: number | null }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number }
  | { ok: false; reason: 'error'; message: string };

export type ChangePinResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'same' | 'invalid_format' | 'locked' | 'unauthenticated' }
  | { ok: false; reason: 'error'; message: string };

interface VerifyPinResponse {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  token?: string;
  expires_at?: string;
  remaining_attempts?: number;
  retry_after_seconds?: number;
  member?: { id: number; name: string; role: 'admin' | 'member' };
}

/** 로그인 실패 사유를 사용자 문구로 옮긴다. PIN 값 자체는 어디에도 노출하지 않는다. */
export function describeLoginError(result: Exclude<LoginResult, { ok: true }>): string {
  switch (result.reason) {
    case 'locked': {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return `PIN을 5회 잘못 입력해 로그인이 잠겼습니다. 약 ${minutes}분 후 다시 시도해주세요.`;
    }
    case 'invalid':
      return result.remainingAttempts !== null
        ? `PIN이 올바르지 않습니다. (남은 시도 ${result.remainingAttempts}회)`
        : 'PIN이 올바르지 않습니다.';
    default:
      return `로그인 중 오류가 발생했습니다. ${result.message}`;
  }
}

/** PIN 변경 실패 사유를 사용자 문구로 옮긴다. */
export function describeChangePinError(result: Exclude<ChangePinResult, { ok: true }>): string {
  switch (result.reason) {
    case 'invalid':
      return '기존 PIN이 올바르지 않습니다.';
    case 'same':
      return '새 PIN은 기존 PIN과 달라야 합니다.';
    case 'invalid_format':
      return 'PIN은 4자리 숫자여야 합니다.';
    case 'locked':
      return '로그인이 일시적으로 잠겨 있습니다. 잠시 후 다시 시도해주세요.';
    case 'unauthenticated':
      return '세션이 만료되었습니다. 다시 로그인해주세요.';
    default:
      return `저장 중 오류가 발생했습니다. ${result.message}`;
  }
}

export interface UseAuthReturn {
  isLoggedIn: ComputedRef<boolean>;
  isAdmin: ComputedRef<boolean>;
  currentMember: Ref<SessionMember | null>;
  login: (memberId: string, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<ChangePinResult>;
  revalidate: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  // PIN 대조는 전적으로 서버에서 일어난다. 프런트엔드는 PIN 을 보관하지도,
  // 비교하지도 않고 그저 서버에 넘기고 결과만 받는다.
  const login = async (memberId: string, pin: string): Promise<LoginResult> => {
    const { data, error } = await supabase.rpc('verify_pin', {
      p_member_id: Number(memberId),
      p_pin: pin,
    });

    if (error) return { ok: false, reason: 'error', message: error.message };

    const res = data as VerifyPinResponse | null;
    if (!res) return { ok: false, reason: 'error', message: '서버 응답이 비어 있습니다.' };

    if (!res.ok) {
      if (res.reason === 'locked') {
        return { ok: false, reason: 'locked', retryAfterSeconds: res.retry_after_seconds ?? 900 };
      }
      return { ok: false, reason: 'invalid', remainingAttempts: res.remaining_attempts ?? null };
    }

    if (!res.token || !res.member) {
      return { ok: false, reason: 'error', message: '세션 발급에 실패했습니다.' };
    }

    const member: SessionMember = {
      id: String(res.member.id),
      name: res.member.name,
      role: res.member.role,
    };
    saveSession({ token: res.token, expiresAt: res.expires_at ?? '', member });
    currentMember.value = member;
    return { ok: true };
  };

  const logout = async (): Promise<void> => {
    // 서버 세션을 먼저 지운다. 실패하더라도 로컬은 반드시 정리한다.
    try {
      await supabase.rpc('logout');
    } catch {
      /* 네트워크 실패 시에도 로컬 로그아웃은 진행 */
    }
    clearSession();
    currentMember.value = null;
  };

  const changePin = async (oldPin: string, newPin: string): Promise<ChangePinResult> => {
    const { data, error } = await supabase.rpc('change_pin', {
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });

    if (error) return { ok: false, reason: 'error', message: error.message };

    const res = data as { ok: boolean; reason?: string } | null;
    if (!res) return { ok: false, reason: 'error', message: '서버 응답이 비어 있습니다.' };
    if (res.ok) return { ok: true };

    return {
      ok: false,
      reason: (res.reason ?? 'invalid') as 'invalid' | 'same' | 'invalid_format' | 'locked' | 'unauthenticated',
    };
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

    const res = data as { id: number; name: string; role: 'admin' | 'member' } | null;
    if (!res) {
      clearSession();
      currentMember.value = null;
      return false;
    }

    // 서버가 알려준 역할이 최종 권위 — 저장된 값이 낡았으면 갱신한다.
    const member: SessionMember = { id: String(res.id), name: res.name, role: res.role };
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
