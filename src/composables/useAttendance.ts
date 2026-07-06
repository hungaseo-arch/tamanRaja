import { reactive } from 'vue';
import { supabase } from '@/lib/supabase';

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

export function useAttendance() {
  async function setAttendance(yearMonth: string, memberId: string, attending: boolean | null): Promise<void> {
    if (!state[yearMonth]) state[yearMonth] = {};
    state[yearMonth][memberId] = attending;
    persist();
    const mid = parseInt(memberId, 10);
    if (attending === null) {
      const { error } = await supabase
        .from('attendance_confirmations')
        .delete()
        .eq('year_month', yearMonth)
        .eq('member_id', mid);
      if (error) console.error('[attendance] delete error:', error.message);
    } else {
      const { error } = await supabase
        .from('attendance_confirmations')
        .upsert({ year_month: yearMonth, member_id: mid, attending });
      if (error) console.error('[attendance] upsert error:', error.message);
    }
  }

  function getAttendance(yearMonth: string): Record<string, boolean | null> {
    return state[yearMonth] ?? {};
  }

  return { setAttendance, getAttendance, state };
}
