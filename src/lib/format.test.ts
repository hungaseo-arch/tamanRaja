import { describe, expect, it } from 'vitest';
import { formatDate, formatMeetingHeading, formatSigned, formatValue } from './format';

describe('format', () => {
  it('formatSigned: 0 이상은 + 를 붙이고 없는 값은 -', () => {
    expect(formatSigned(3)).toBe('+3');
    expect(formatSigned(0)).toBe('+0');
    expect(formatSigned(-2)).toBe('-2');
    expect(formatSigned(null)).toBe('-');
  });

  it('formatValue: 0 은 값으로, null·빈 문자열은 없는 값으로', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(null)).toBe('-');
    expect(formatValue('  ')).toBe('-');
  });

  it('formatDate·formatMeetingHeading: 구분자가 홀로 남지 않음', () => {
    expect(formatDate('2026-08-01')).toBe('2026년 8월 1일');
    expect(formatDate('잘못된 값')).toBe('');
    expect(formatMeetingHeading('2026-08')).toBe('2026년 8월');
    expect(formatMeetingHeading('2026-08', '2026-08-01')).toBe('2026년 8월 1일');
    expect(formatMeetingHeading('2026-08', '2026-08-01', '레이크')).toBe('2026년 8월 1일 - 레이크');
  });
});
