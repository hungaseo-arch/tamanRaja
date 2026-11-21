import { beforeEach, describe, expect, it, vi } from 'vitest';

// 테스트는 DB 에 접속하지 않는다
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { MEETINGS, MEETING_RESULTS, getDefaultMonth } from '@/data';
import type { Meeting } from '@/lib';

const meeting = (id: string, year_month: string, meeting_date: string): Meeting =>
  ({ id, year_month, meeting_date } as Meeting);

describe('getDefaultMonth (모임일 + 14일 뒤 다음 달)', () => {
  beforeEach(() => {
    MEETINGS.splice(0);
    MEETING_RESULTS.splice(0);
  });

  it('모임일 + 13일까지는 이번 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    expect(getDefaultMonth(new Date(2026, 10, 20))).toBe('2026-11');
  });

  it('모임일 + 14일부터는 다음 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    expect(getDefaultMonth(new Date(2026, 10, 21))).toBe('2026-12');
    expect(getDefaultMonth(new Date(2026, 10, 30))).toBe('2026-12');
  });

  it('모임 행이 없으면 첫째 주 토요일(11월은 7일)을 기준으로 본다', () => {
    expect(getDefaultMonth(new Date(2026, 10, 20))).toBe('2026-11');
    expect(getDefaultMonth(new Date(2026, 10, 21))).toBe('2026-12');
  });

  it('12월이면 이듬해 1월', () => {
    MEETINGS.push(meeting('m12', '2026-12', '2026-12-05'));
    expect(getDefaultMonth(new Date(2026, 11, 19))).toBe('2027-01');
  });
});
