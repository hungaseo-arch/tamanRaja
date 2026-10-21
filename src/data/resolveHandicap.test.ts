import { beforeEach, describe, expect, it, vi } from 'vitest';

// 테스트는 DB 에 접속하지 않는다
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { MEETINGS, MEETING_RESULTS, MONTHLY_HANDICAPS, resolveHandicap } from '@/data';
import type { Meeting, MeetingResult, MonthlyHandicap } from '@/lib';

const hc = (year_month: string, app_hc: number, next_hc: number | null, std_hc = 12): MonthlyHandicap =>
  ({ id: year_month, member_id: '1', year_month, std_hc, app_hc, next_hc } as MonthlyHandicap);
const meeting = (id: string, year_month: string): Meeting => ({ id, year_month } as Meeting);
const result = (meeting_id: string, score: number | null): MeetingResult =>
  ({ id: `${meeting_id}-1`, meeting_id, member_id: '1', attended: true, score } as MeetingResult);

describe('resolveHandicap', () => {
  beforeEach(() => {
    MONTHLY_HANDICAPS.splice(0);
    MEETINGS.splice(0);
    MEETING_RESULTS.splice(0);
  });

  it('차월 핸디는 다음 달 행의 당월 핸디가 우선하고, 다르면 불일치로 표시', () => {
    MONTHLY_HANDICAPS.push(hc('2026-09', 13, 12), hc('2026-10', 11, null));
    const r = resolveHandicap('1', '2026-09');
    expect(r?.next_hc).toBe(11);
    expect(r?.next_hc_mismatch).toBe(true);
  });

  it('다음 달 행이 없으면 그 달 next_hc', () => {
    MONTHLY_HANDICAPS.push(hc('2026-09', 13, 12));
    const r = resolveHandicap('1', '2026-09');
    expect(r?.next_hc).toBe(12);
    expect(r?.next_hc_mismatch).toBe(false);
  });

  it('직전 달 결과가 미확정이면 당월 핸디는 null', () => {
    MONTHLY_HANDICAPS.push(hc('2026-10', 11, null));
    MEETINGS.push(meeting('m9', '2026-09'));
    MEETING_RESULTS.push(result('m9', null));
    expect(resolveHandicap('1', '2026-10')?.app_hc).toBeNull();
  });

  it('그 달 행이 없으면 가장 가까운 이전 달 next_hc 를 당월 핸디로', () => {
    MONTHLY_HANDICAPS.push(hc('2026-08', 14, 13), hc('2026-07', 15, 14));
    const r = resolveHandicap('1', '2026-09');
    expect(r?.app_hc).toBe(13);
    expect(r?.next_hc).toBeNull();
  });
});
