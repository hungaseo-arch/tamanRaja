import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { Member } from '@/lib';
import { MEMBERS } from '@/data';

/**
 * useAuth (Vue 3 Composable)
 *
 * React 원본(`src/hooks/useAuth.ts`)을 1:1 변환한 버전.
 * - useState → 모듈 단위 ref(전역 상태 공유)
 * - useEffect (storage listener) → 모듈 초기화 시 1회 등록
 *
 * `useAuth()` 를 호출하는 모든 컴포넌트가 같은 reactive 상태를 공유합니다.
 */

const SESSION_KEY = 'golf_auth_member';
const PIN_STORAGE_PREFIX = 'golf_pin_';

function getStoredPin(memberId: string): string {
  return localStorage.getItem(PIN_STORAGE_PREFIX + memberId) ?? '0000';
}

function setStoredPin(memberId: string, pin: string): void {
  localStorage.setItem(PIN_STORAGE_PREFIX + memberId, pin);
}

function getSessionMember(): Member | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Member;
  } catch {
    return null;
  }
}

function setSessionMember(member: Member | null): void {
  if (member) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(member));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

// 모듈 전역 reactive 상태 — 모든 컴포넌트가 공유
const currentMember: Ref<Member | null> = ref<Member | null>(getSessionMember());

// 다른 탭에서 storage 변경 시 동기화 (React 원본의 useEffect와 동일)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    currentMember.value = getSessionMember();
  });
}

export interface UseAuthReturn {
  isLoggedIn: ComputedRef<boolean>;
  currentMember: Ref<Member | null>;
  login: (name: string, pin: string) => boolean;
  logout: () => void;
  changePin: (oldPin: string, newPin: string) => boolean;
}

export function useAuth(): UseAuthReturn {
  const login = (name: string, pin: string): boolean => {
    const member = MEMBERS.find((m) => m.name === name);
    if (!member) return false;

    const storedPin = getStoredPin(member.id);
    if (storedPin !== pin) return false;

    setSessionMember(member);
    currentMember.value = member;
    return true;
  };

  const logout = (): void => {
    setSessionMember(null);
    currentMember.value = null;
  };

  const changePin = (oldPin: string, newPin: string): boolean => {
    const member = currentMember.value;
    if (!member) return false;

    const storedPin = getStoredPin(member.id);
    if (storedPin !== oldPin) return false;

    setStoredPin(member.id, newPin);
    return true;
  };

  return {
    isLoggedIn: computed(() => currentMember.value !== null),
    currentMember,
    login,
    logout,
    changePin,
  };
}
