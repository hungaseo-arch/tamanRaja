import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { Member } from '@/lib';
import { MEMBERS } from '@/data';
import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'golf_auth_member';

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
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const login = (name: string, pin: string): boolean => {
    const member = MEMBERS.find((m) => m.name === name);
    if (!member) return false;
    if (member.pin !== pin) return false;

    setSessionMember(member);
    currentMember.value = member;
    return true;
  };

  const logout = (): void => {
    setSessionMember(null);
    currentMember.value = null;
  };

  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    const member = currentMember.value;
    if (!member) return false;

    const livePin = MEMBERS.find((m) => m.id === member.id)?.pin ?? '2322';
    if (livePin !== oldPin) return false;

    const { error } = await supabase
      .from('member_pins')
      .update({ pin: newPin })
      .eq('member_id', parseInt(member.id));

    if (error) throw new Error(error.message);

    // 인메모리 MEMBERS 업데이트
    const target = MEMBERS.find((m) => m.id === member.id);
    if (target) target.pin = newPin;

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
