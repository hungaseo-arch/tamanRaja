import { reactive, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { syncAttendanceFromDB } from '@/composables/useAttendance';
import type {
  Member,
  Meeting,
  MonthlyHandicap,
  MeetingResult,
  MonthlyRow,
  YearlySummary,
} from '@/lib/index';

// ── 휴면 회원: 해당 year_month 이후 대시보드·랭킹에서 제외 ──────────────────
const DORMANT: { name: string; from: string }[] = [
  { name: '이성남', from: '2026-04' },
];

function isActive(memberName: string, yearMonth: string): boolean {
  const d = DORMANT.find((x) => x.name === memberName);
  return !d || yearMonth < d.from;
}

// 현재(오늘 기준) 휴면 여부 — 로그인 목록 등에서 제외 판단에 사용
export function isDormantNow(memberName: string): boolean {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return !isActive(memberName, ym);
}

// ── Reactive arrays (Supabase에서 로드 후 채워짐) ────────────────────────────
export const MEMBERS: Member[] = reactive([]);
export const GOLF_COURSES: { id: string; name: string }[] = reactive([]);
export const MEETINGS: Meeting[] = reactive([]);
export const MONTHLY_HANDICAPS: MonthlyHandicap[] = reactive([]);
export const MEETING_RESULTS: MeetingResult[] = reactive([]);

export const dataLoading = ref(false);
export const dataInitialized = ref(false);
export const dataError = ref<string | null>(null);

function fill<T>(arr: T[], items: T[]): void {
  arr.splice(0, arr.length, ...items);
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function loadData(retries = 3): Promise<void> {
  if (dataLoading.value) return;
  dataLoading.value = true;
  dataError.value = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await _fetchAll();
      dataLoading.value = false;
      dataInitialized.value = true;
      return;
    } catch (err) {
      if (attempt < retries) {
        await delay(1500 * attempt);
      } else {
        dataError.value =
          err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      }
    }
  }
  dataLoading.value = false;
}

async function _fetchAll(): Promise<void> {
  const [
      { data: courses, error: e1 },
      { data: meetings, error: e2 },
      { data: handicaps, error: e3 },
      { data: results, error: e4 },
      { data: members, error: e5 },
      { data: attendances },
    ] = await Promise.all([
      supabase.from('golf_courses').select('id, name'),
      supabase.from('meetings').select('id, year_month, meeting_date, course_id, host_member_id'),
      supabase
        .from('monthly_handicaps')
        .select('id, member_id, year_month, std_hc, app_hc, next_hc'),
      supabase
        .from('meeting_results')
        .select('id, meeting_id, member_id, attended, score, result_group, result_rank'),
      supabase.from('members').select('id, name'),
      supabase.from('attendance_confirmations').select('year_month, member_id, attending'),
    ]);

    const firstError = e1 ?? e2 ?? e3 ?? e4 ?? e5;
    if (firstError) throw new Error(firstError.message);

    // golf_courses
    fill(GOLF_COURSES, (courses ?? []).map((c) => ({
      id: String(c.id),
      name: c.name as string,
    })));

    // meetings: DB의 course_id → 내부 golf_course_id로 매핑
    fill(
      MEETINGS,
      (meetings ?? [])
        .map((m) => ({
          id: String(m.id),
          year_month: m.year_month as string,
          meeting_date: m.meeting_date as string,
          golf_course_id: String((m as { course_id: unknown }).course_id),
          host_member_id: m.host_member_id ? String(m.host_member_id) : '',
        }))
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
    );

    // members — PIN 은 어디에서도 프런트엔드로 내려오지 않는다.
    fill(
      MEMBERS,
      (members ?? [])
        .map((m) => ({
          id: String(m.id),
          name: m.name as string,
          display_order: m.id as number,
        }))
        .sort((a, b) => a.display_order - b.display_order)
    );

    // monthly_handicaps
    fill(
      MONTHLY_HANDICAPS,
      (handicaps ?? []).map((h) => ({
        id: String(h.id),
        member_id: String(h.member_id),
        year_month: h.year_month as string,
        std_hc: h.std_hc as number,
        app_hc: h.app_hc as number,
        next_hc: h.next_hc as number,
      }))
    );

    // meeting_results
    fill(
      MEETING_RESULTS,
      (results ?? []).map((r) => ({
        id: String(r.id),
        meeting_id: String(r.meeting_id),
        member_id: String(r.member_id),
        attended: r.attended as boolean,
        score: r.score as number | null,
        result_group: (r.result_group ?? null) as MeetingResult['result_group'],
        result_rank: (r.result_rank ?? null) as MeetingResult['result_rank'],
      }))
    );

    syncAttendanceFromDB(
      (attendances ?? []).map((a) => ({
        year_month: a.year_month as string,
        member_id: (a as { member_id: number }).member_id,
        attending: a.attending as boolean,
      }))
    );
}

// ── 핸디캡 해석 ───────────────────────────────────────────────────────────────
// 해당 월 핸디 레코드가 없으면 직전 달의 next_hc를 당월 핸디로 사용한다.
// (월간/연간/나의기록 모두 동일 규칙을 쓰기 위한 단일 소스)
export function resolveHandicap(
  memberId: string,
  yearMonth: string
): { std_hc: number; app_hc: number; next_hc: number | null } | null {
  const exact = MONTHLY_HANDICAPS.find(
    (h) => h.member_id === memberId && h.year_month === yearMonth
  );
  if (exact) return { std_hc: exact.std_hc, app_hc: exact.app_hc, next_hc: exact.next_hc };

  const prev = [...MONTHLY_HANDICAPS]
    .filter((h) => h.member_id === memberId && h.year_month < yearMonth)
    .sort((a, b) => (a.year_month > b.year_month ? -1 : 1))[0];
  if (!prev) return null;

  return { std_hc: prev.std_hc, app_hc: prev.next_hc, next_hc: null };
}

// ── 대시보드 데이터 ───────────────────────────────────────────────────────────
export function getMonthlyData(yearMonth: string): MonthlyRow[] {
  const meeting = MEETINGS.find((m) => m.year_month === yearMonth);

  const [yr, mo] = yearMonth.split('-');
  const prevMonthNum = parseInt(mo) - 1;
  const prevYM =
    prevMonthNum === 0
      ? `${parseInt(yr) - 1}-12`
      : `${yr}-${String(prevMonthNum).padStart(2, '0')}`;
  const prevMeeting = MEETINGS.find((m) => m.year_month === prevYM);

  // 기준핸디 재적용(리셋) 월: 1월이거나, 직전 달 대비 std_hc가 바뀐 회원이 있으면 리셋 월.
  // 이 달은 직전 달과 조를 비교할 수 없어 조 변경 리셋 없이 ±1만 적용한다.
  const isResetMonth =
    yearMonth.endsWith('-01') ||
    MONTHLY_HANDICAPS.some((cur) => {
      if (cur.year_month !== yearMonth) return false;
      const prv = MONTHLY_HANDICAPS.find(
        (h) => h.member_id === cur.member_id && h.year_month === prevYM
      );
      return prv !== undefined && prv.std_hc !== cur.std_hc;
    });

  const rows: MonthlyRow[] = [];

  for (const member of MEMBERS) {
    if (!isActive(member.name, yearMonth)) continue;

    // 해당 월 핸디캡(없으면 직전 달 next_hc로 폴백)
    const baseHandicap = resolveHandicap(member.id, yearMonth);
    if (!baseHandicap) continue;

    const stdHc = baseHandicap.std_hc;
    const appHc = baseHandicap.app_hc;

    const result = meeting
      ? MEETING_RESULTS.find((r) => r.meeting_id === meeting.id && r.member_id === member.id)
      : undefined;

    // 핸디캡이 있는 활성 회원은 항상 행 표시. 미팅이 있는데 result 행이 없는 경우
    // (예: 휴면 중 미팅이 생성된 뒤 활성 전환된 회원)에도 미참석(-)으로 노출한다.

    const netScore =
      result?.attended && result.score !== null ? result.score - appHc : null;

    const year = yearMonth.substring(0, 4);
    const yearMeetings = MEETINGS.filter((m) => m.year_month.startsWith(year));
    const yearlyNetScores: number[] = [];

    for (const ym of yearMeetings) {
      if (!isActive(member.name, ym.year_month)) continue;
      const ymResult = MEETING_RESULTS.find(
        (r) => r.meeting_id === ym.id && r.member_id === member.id
      );
      const ymHandicap = resolveHandicap(member.id, ym.year_month);
      if (ymResult && ymResult.attended && ymResult.score !== null && ymResult.score > 0 && ymHandicap) {
        yearlyNetScores.push(ymResult.score - ymHandicap.app_hc);
      }
    }

    const yearlyNet =
      yearlyNetScores.length > 0
        ? yearlyNetScores.reduce((a, b) => a + b, 0) / yearlyNetScores.length
        : null;

    const prevResult = prevMeeting
      ? MEETING_RESULTS.find((r) => r.meeting_id === prevMeeting.id && r.member_id === member.id)
      : undefined;

    rows.push({
      member_id: member.id,
      member_name: member.name,
      display_order: member.display_order,
      std_hc: stdHc,
      app_hc: appHc,
      next_hc: baseHandicap.next_hc,
      prev_result_group: prevResult?.result_group ?? null,
      attended: result?.attended ?? false,
      score: result?.score ?? null,
      net_score: netScore,
      result_group: result?.result_group ?? null,
      result_rank: result?.result_rank ?? null,
      yearly_net: yearlyNet,
      yearly_rank: null,
      is_reset_month: isResetMonth,
    });
  }

  const attendedRows = rows.filter((r) => r.yearly_net !== null);
  attendedRows.sort((a, b) => (a.yearly_net ?? 0) - (b.yearly_net ?? 0));
  attendedRows.forEach((row, index) => {
    row.yearly_rank = index + 1;
  });

  rows.sort((a, b) => a.display_order - b.display_order);
  return rows;
}

// ── 연간 요약 ─────────────────────────────────────────────────────────────────
export function getYearlySummary(year: string): YearlySummary[] {
  const yearMeetings = MEETINGS.filter((m) => m.year_month.startsWith(year));
  const summaries: YearlySummary[] = [];

  for (const member of MEMBERS) {
    // 해당 연도 중 휴면 전환된 회원은 제외 (예: from='2026-04' → 2026·2027 랭킹에서 제외)
    const dormant = DORMANT.find((d) => d.name === member.name);
    if (dormant && dormant.from <= `${year}-12`) continue;

    const netScores: number[] = [];
    const rawScores: number[] = [];
    let winnerCount = 0;
    let medalistCount = 0;
    let hostCount = 0;

    for (const meeting of yearMeetings) {
      if (!isActive(member.name, meeting.year_month)) continue;

      const result = MEETING_RESULTS.find(
        (r) => r.meeting_id === meeting.id && r.member_id === member.id
      );
      const handicap = resolveHandicap(member.id, meeting.year_month);

      if (result) {
        if (result.result_rank === 'Winner') winnerCount++;
        if (result.result_rank === 'Medalist') medalistCount++;
        if (result.result_rank === 'Host') hostCount++;
      }

      if (result && result.attended && result.score !== null && result.score > 0) {
        rawScores.push(result.score);
        if (handicap) netScores.push(result.score - handicap.app_hc);
      }
    }

    if (netScores.length > 0) {
      summaries.push({
        member_id: member.id,
        member_name: member.name,
        avg_net_score: netScores.reduce((a, b) => a + b, 0) / netScores.length,
        avg_score: rawScores.length > 0
          ? rawScores.reduce((a, b) => a + b, 0) / rawScores.length
          : null,
        attended_count: netScores.length,
        winner_count: winnerCount,
        medalist_count: medalistCount,
        host_count: hostCount,
        rank: 0,
      });
    }
  }

  summaries.sort((a, b) => a.avg_net_score - b.avg_net_score);
  summaries.forEach((s, index) => {
    s.rank = index + 1;
  });

  return summaries;
}

// ── 연간 기록 내보내기(CSV) ───────────────────────────────────────────────────
// 데이터 검증·개인 분석용. 해당 연도의 모든 미팅 × 전회원을 한 행씩 펼친 형태로,
// 월간 화면과 동일한 규칙(휴면 제외·핸디 폴백)을 그대로 따른다.
export interface YearlyExportRow {
  year_month: string;
  meeting_date: string;
  course_name: string;
  member_name: string;
  attended: boolean;
  std_hc: number;
  app_hc: number;
  next_hc: number | null;
  score: number | null;
  net_score: number | null;
  monthly_rank: number | null;
  result_group: MeetingResult['result_group'];
  result_rank: MeetingResult['result_rank'];
  yearly_avg_net: number | null;
  yearly_rank: number | null;
}

export function getYearlyExportRows(year: string): YearlyExportRow[] {
  const yearMeetings = MEETINGS.filter((m) => m.year_month.startsWith(year)).sort((a, b) =>
    a.year_month < b.year_month ? -1 : a.year_month > b.year_month ? 1 : 0
  );
  // 연간 평균·순위는 랭킹 페이지와 동일한 집계를 재사용한다
  const summaryByMember = new Map(getYearlySummary(year).map((s) => [s.member_id, s]));

  const rows: YearlyExportRow[] = [];

  for (const meeting of yearMeetings) {
    const courseName = GOLF_COURSES.find((c) => c.id === meeting.golf_course_id)?.name ?? '';
    const monthRows: YearlyExportRow[] = [];

    for (const member of MEMBERS) {
      if (!isActive(member.name, meeting.year_month)) continue;

      const handicap = resolveHandicap(member.id, meeting.year_month);
      if (!handicap) continue;

      const result = MEETING_RESULTS.find(
        (r) => r.meeting_id === meeting.id && r.member_id === member.id
      );
      const attended = result?.attended ?? false;
      const score = attended ? result?.score ?? null : null;
      const scored = score !== null && score > 0;
      const summary = summaryByMember.get(member.id);

      monthRows.push({
        year_month: meeting.year_month,
        meeting_date: meeting.meeting_date ?? '',
        course_name: courseName,
        member_name: member.name,
        attended,
        std_hc: handicap.std_hc,
        app_hc: handicap.app_hc,
        // 차월 핸디는 스코어가 기록된 경우에만 확정값 (월간 화면과 동일)
        next_hc: scored ? handicap.next_hc : null,
        score,
        net_score: scored ? score - handicap.app_hc : null,
        monthly_rank: null,
        result_group: result?.result_group ?? null,
        result_rank: result?.result_rank ?? null,
        yearly_avg_net: summary?.avg_net_score ?? null,
        yearly_rank: summary?.rank ?? null,
      });
    }

    // 해당 월 Net 스코어 기준 순위 부여 (미참석·미기록은 순위 없음)
    [...monthRows]
      .filter((r) => r.net_score !== null)
      .sort((a, b) => (a.net_score ?? 0) - (b.net_score ?? 0))
      .forEach((r, idx) => {
        r.monthly_rank = idx + 1;
      });

    monthRows.sort((a, b) => {
      if (a.monthly_rank !== null && b.monthly_rank !== null) return a.monthly_rank - b.monthly_rank;
      if (a.monthly_rank !== null) return -1;
      if (b.monthly_rank !== null) return 1;
      return a.member_name.localeCompare(b.member_name, 'ko');
    });

    rows.push(...monthRows);
  }

  return rows;
}

// ── 월 목록 ───────────────────────────────────────────────────────────────────
export function getAvailableMonths(): Meeting[] {
  return [...MEETINGS].sort(
    (a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  );
}
