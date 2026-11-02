import { beforeEach, describe, expect, it, vi } from 'vitest';

// 테스트는 DB 에 접속하지 않는다
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { MEETINGS, MEETING_RESULTS, canAnswerAttendance, getAttendanceMonth } from '@/data';
import type { Meeting, MeetingResult } from '@/lib';

const meeting = (id: string, year_month: string, meeting_date: string): Meeting =>
  ({ id, year_month, meeting_date } as Meeting);
const result = (meeting_id: string, score: number | null): MeetingResult =>
  ({ id: `${meeting_id}-1`, meeting_id, member_id: '1', attended: true, score } as MeetingResult);

describe('getAttendanceMonth', () => {
  beforeEach(() => {
    MEETINGS.splice(0);
    MEETING_RESULTS.splice(0);
  });

  it('이번 달 모임이 아직이면 이번 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    MEETING_RESULTS.push(result('m11', null));
    expect(getAttendanceMonth(new Date(2026, 10, 2))).toBe('2026-11');
  });

  it('모임 당일까지는 이번 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    expect(getAttendanceMonth(new Date(2026, 10, 7))).toBe('2026-11');
  });

  it('모임일이 지났으면 다음 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    expect(getAttendanceMonth(new Date(2026, 10, 8))).toBe('2026-12');
  });

  it('스코어가 들어왔으면 모임일 전이라도 다음 달', () => {
    MEETINGS.push(meeting('m11', '2026-11', '2026-11-07'));
    MEETING_RESULTS.push(result('m11', 85));
    expect(getAttendanceMonth(new Date(2026, 10, 7))).toBe('2026-12');
  });

  it('이번 달 모임 행이 없으면 첫째 주 토요일까지는 이번 달', () => {
    expect(getAttendanceMonth(new Date(2026, 10, 2))).toBe('2026-11');
    expect(getAttendanceMonth(new Date(2026, 10, 7))).toBe('2026-11');
  });

  it('모임 행 없이 첫째 주 토요일이 지나면 다음 달, 12월이면 이듬해 1월', () => {
    expect(getAttendanceMonth(new Date(2026, 10, 8))).toBe('2026-12');
    expect(getAttendanceMonth(new Date(2026, 11, 20))).toBe('2027-01');
  });
});

describe('canAnswerAttendance', () => {
  beforeEach(() => {
    MEETINGS.splice(0);
    MEETING_RESULTS.splice(0);
  });

  it('확인 대상 달과 그 뒤의 달만 답할 수 있다', () => {
    const today = new Date(2026, 10, 2);
    expect(canAnswerAttendance('2026-10', today)).toBe(false);
    expect(canAnswerAttendance('2026-11', today)).toBe(true);
    expect(canAnswerAttendance('2026-12', today)).toBe(true);
  });

  it('모임이 끝난 이번 달은 답할 수 없다', () => {
    const today = new Date(2026, 10, 8);
    expect(canAnswerAttendance('2026-11', today)).toBe(false);
    expect(canAnswerAttendance('2026-12', today)).toBe(true);
  });

  it('형식이 틀린 값은 거른다', () => {
    expect(canAnswerAttendance('2026-12x', new Date(2026, 10, 2))).toBe(false);
  });
});
