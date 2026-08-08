import { reactive } from 'vue';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';

const STORAGE_KEY = 'golf_future_attendance';

type AttendanceMap = Record<string, Record<string, boolean | null>>;

function load(): AttendanceMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

const state = reactive<AttendanceMap>(load());

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
