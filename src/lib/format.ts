/**
 * 미확정·미입력 값 표기 규칙 (P1-1)
 *
 * 화면 곳곳에서 `?? 0` / `?? ''` 로 없는 값을 채우는 바람에
 *   - 아직 정해지지 않은 차월 핸디가 `0` 으로,
 *   - 아직 안 정한 골프장이 빈 칸으로
 * 보이는 문제가 있었다. `0` 은 실제로 유효한 핸디 값이므로 "없음"과 반드시
 * 구분해야 한다. 아래 헬퍼로 표기를 한 곳에 모은다.
 */

/** 값이 아직 없음 (해당 없음 / 미입력) */
export const DASH = '-';
/** 아직 정해지지 않음 (앞으로 정해질 예정) */
export const TBD = '미정';

/**
 * null / undefined 만 없는 값으로 보고, `0` 과 빈 문자열이 아닌 값은 그대로 쓴다.
 * `''` 도 없는 값으로 취급한다 (조회 실패로 빈 문자열이 들어오는 경로가 있다).
 */
export function formatValue(
  value: number | string | null | undefined,
  fallback: string = DASH,
): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return String(value);
}

/** 골프장처럼 "앞으로 정해질" 값. 없으면 `미정`. */
export function formatPending(value: string | null | undefined): string {
  return formatValue(value, TBD);
}

/** 부호를 붙여 보여주는 값 (NET 스코어, 핸디 증감 등) */
export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return (value >= 0 ? '+' : '') + value;
}

/** `2026-08` → `2026년 8월` */
export function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
}

/** `2026-08-01` → `2026년 8월 1일`. 값이 없으면 빈 문자열. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 월간 표 머리말. 날짜와 골프장이 모두 없으면 `2026년 8월` 만,
 * 날짜만 있으면 구분자 없이 날짜만 — `2026년 8월 1일 - ` 처럼 구분자가
 * 홀로 남지 않게 한다.
 */
export function formatMeetingHeading(yearMonth: string, meetingDate?: string | null, courseName?: string | null): string {
  const date = formatDate(meetingDate);
  const course = courseName?.trim() ?? '';
  if (!date) return formatYearMonth(yearMonth);
  if (!course) return date;
  return `${date} - ${course}`;
}
