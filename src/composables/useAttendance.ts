import { reactive } from 'vue';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';

import { STORAGE_PREFIX } from '@/lib/session';

const STORAGE_KEY = `${STORAGE_PREFIX}attendance`;
// 접두사 규칙 이전의 키. 읽을 때 한 번만 옮기고 지운다 — 그대로 두면 로그아웃
// 정리 대상에서 빠져 다음 사용자에게 남의 참석 답변이 보인다.
const LEGACY_KEY = 'golf_future_attendance';

type AttendanceMap = Record<string, Record<string, boolean | null>>;

function load(): AttendanceMap {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw !== null) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    return JSON.parse(raw ?? '{}');
  } catch { return {}; }
}

const state = reactive<AttendanceMap>(load());

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 로그아웃 시 호출한다. clearSession() 이 저장소는 비우지만 이 모듈이 들고 있는
 * reactive 사본은 그대로라, 지우지 않으면 다음 사람이 로그인했을 때 앞사람의
 * 참석 답변이 화면에 그려진다.
 */
export function clearAttendance(): void {
  for (const key of Object.keys(state)) delete state[key];
}

export function syncAttendanceFromDB(items: { year_month: string; member_id: number; attending: boolean | null }[]): void {
  for (const item of items) {
    if (!state[item.year_month]) state[item.year_month] = {};
    state[item.year_month][String(item.member_id)] = item.attending;
  }
}

/** 저장 결과. 실패하면 화면 값은 이미 원래대로 되돌아가 있고 message 에 사유가 담긴다. */
export interface AttendanceResult {
  ok: boolean;
  message?: string;
}

export function useAttendance() {
  /**
   * 화면에 먼저 반영하고 서버에 보낸다. 실패하면 직전 값으로 되돌린다 —
   * 되돌리지 않으면 localStorage 에 남은 거짓 값이 새로고침 뒤에도 살아남아
   * "참석했다고 눌렀는데 명단에 없다"가 된다.
   */
  async function setAttendance(
    yearMonth: string,
    memberId: string,
    attending: boolean | null
  ): Promise<AttendanceResult> {
    if (!state[yearMonth]) state[yearMonth] = {};
    // undefined(=아직 답한 적 없음) 와 null(=미정으로 답함) 은 다른 상태다.
    const hadValue = memberId in state[yearMonth];
    const previous = state[yearMonth][memberId];

    state[yearMonth][memberId] = attending;
    persist();

    const mid = parseInt(memberId, 10);
    const { error } = attending === null
      ? await supabase
          .from('attendance_confirmations')
          .delete()
          .eq('year_month', yearMonth)
          .eq('member_id', mid)
      : await supabase
          .from('attendance_confirmations')
          .upsert({ year_month: yearMonth, member_id: mid, attending });

    if (error) {
      if (hadValue) state[yearMonth][memberId] = previous;
      else delete state[yearMonth][memberId];
      persist();
      return { ok: false, message: describeError(error, '참석 여부를 저장하지 못했습니다.') };
    }
    return { ok: true };
  }

  function getAttendance(yearMonth: string): Record<string, boolean | null> {
    return state[yearMonth] ?? {};
  }

  return { setAttendance, getAttendance, state };
}
