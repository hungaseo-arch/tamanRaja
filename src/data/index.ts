import { reactive, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type {
  Member,
  Meeting,
  MonthlyHandicap,
  MeetingResult,
  DashboardRow,
  YearlySummary,
} from '@/lib/index';

// ── 휴면 회원: 해당 year_month 이후 대시보드·랭킹에서 제외 ──────────────────
const DORMANT: { name: string; from: string }[] = [
  { name: '이성남', from: '2026-04' },
  { name: '박재현', from: '2026-04' },
];

function isActive(memberName: string, yearMonth: string): boolean {
  const d = DORMANT.find((x) => x.name === memberName);
  return !d || yearMonth < d.from;
}

// ── Reactive arrays (Supabase에서 로드 후 채워짐) ────────────────────────────
export const MEMBERS: Member[] = reactive([]);
export const GOLF_COURSES: { id: string; name: string }[] = reactive([]);
export const MEETINGS: Meeting[] = reactive([]);
export const MONTHLY_HANDICAPS: MonthlyHandicap[] = reactive([]);
export const MEETING_RESULTS: MeetingResult[] = reactive([]);

export const dataLoading = ref(false);
export const dataError = ref<string | null>(null);

function fill<T>(arr: T[], items: T[]): void {
  arr.splice(0, arr.length, ...items);
}

export async function loadData(): Promise<void> {
  if (dataLoading.value) return;
  dataLoading.value = true;
  dataError.value = null;

  try {
    const [
      { data: courses, error: e1 },
      { data: meetings, error: e2 },
      // members 테이블 직접 접근 불가(RLS) → monthly_handicaps 조인으로 우회
      { data: handicaps, error: e3 },
      { data: results, error: e4 },
    ] = await Promise.all([
      supabase.from('golf_courses').select('id, name'),
      supabase.from('meetings').select('id, year_month, meeting_date, course_id, host_member_id'),
      supabase
        .from('monthly_handicaps')
        .select('id, member_id, year_month, std_hc, app_hc, next_hc, members!inner(id, name)'),
      supabase
        .from('meeting_results')
        .select('id, meeting_id, member_id, attended, score, result_group, result_rank'),
    ]);

    const firstError = e1 ?? e2 ?? e3 ?? e4;
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

    // members: monthly_handicaps 조인에서 추출 후 중복 제거
    const memberMap = new Map<string, Member>();
    for (const h of handicaps ?? []) {
      const raw = (h as { members: { id: number; name: string } | { id: number; name: string }[] }).members;
      const m = Array.isArray(raw) ? raw[0] : raw;
      const id = String(m.id);
      if (!memberMap.has(id)) {
        memberMap.set(id, { id, name: m.name, pin: '0000', display_order: m.id });
      }
    }
    fill(MEMBERS, [...memberMap.values()].sort((a, b) => a.display_order - b.display_order));

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
  } catch (err) {
    dataError.value =
      err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.';
  } finally {
    dataLoading.value = false;
  }
}

// ── 대시보드 데이터 ───────────────────────────────────────────────────────────
export function getDashboardData(yearMonth: string): DashboardRow[] {
  const meeting = MEETINGS.find((m) => m.year_month === yearMonth);

  const [yr, mo] = yearMonth.split('-');
  const prevMonthNum = parseInt(mo) - 1;
  const prevYM =
    prevMonthNum === 0
      ? `${parseInt(yr) - 1}-12`
      : `${yr}-${String(prevMonthNum).padStart(2, '0')}`;
  const prevMeeting = MEETINGS.find((m) => m.year_month === prevYM);

  const rows: DashboardRow[] = [];

  for (const member of MEMBERS) {
    if (!isActive(member.name, yearMonth)) continue;

    // 해당 월 핸디캡 레코드 탐색
    const exactHandicap = MONTHLY_HANDICAPS.find(
      (h) => h.member_id === member.id && h.year_month === yearMonth
    );
    const prevHandicap = [...MONTHLY_HANDICAPS]
      .filter((h) => h.member_id === member.id && h.year_month < yearMonth)
      .sort((a, b) => (a.year_month > b.year_month ? -1 : 1))[0];

    // 해당 월 레코드가 없으면 직전 달의 next_hc를 당월HC로 사용
    const baseHandicap = exactHandicap ?? prevHandicap;
    if (!baseHandicap) continue;

    const stdHc = baseHandicap.std_hc;
    const appHc = exactHandicap ? exactHandicap.app_hc : prevHandicap!.next_hc;

    const result = meeting
      ? MEETING_RESULTS.find((r) => r.meeting_id === meeting.id && r.member_id === member.id)
      : undefined;

    // 미팅 없는 달: 핸디캡이라도 있으면 행 표시
    // 미팅 있는 달: result도 필요
    if (meeting && !result) continue;

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
      const ymHandicap = MONTHLY_HANDICAPS.find(
        (h) => h.member_id === member.id && h.year_month === ym.year_month
      );
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
      next_hc: exactHandicap?.next_hc ?? null,
      prev_result_group: prevResult?.result_group ?? null,
      attended: result?.attended ?? false,
      score: result?.score ?? null,
      net_score: netScore,
      result_group: result?.result_group ?? null,
      result_rank: result?.result_rank ?? null,
      yearly_net: yearlyNet,
      yearly_rank: null,
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
    const netScores: number[] = [];
    let winnerCount = 0;
    let medalistCount = 0;
    let hostCount = 0;

    for (const meeting of yearMeetings) {
      if (!isActive(member.name, meeting.year_month)) continue;

      const result = MEETING_RESULTS.find(
        (r) => r.meeting_id === meeting.id && r.member_id === member.id
      );
      const handicap = MONTHLY_HANDICAPS.find(
        (h) => h.member_id === member.id && h.year_month === meeting.year_month
      );

      if (result) {
        if (result.result_rank === 'Winner') winnerCount++;
        if (result.result_rank === 'Medalist') medalistCount++;
        if (result.result_rank === 'Host') hostCount++;
      }

      if (result && result.attended && result.score !== null && result.score > 0 && handicap) {
        netScores.push(result.score - handicap.app_hc);
      }
    }

    if (netScores.length > 0) {
      summaries.push({
        member_id: member.id,
        member_name: member.name,
        avg_net_score: netScores.reduce((a, b) => a + b, 0) / netScores.length,
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

// ── 월 목록 ───────────────────────────────────────────────────────────────────
export function getAvailableMonths(): Meeting[] {
  return [...MEETINGS].sort(
    (a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  );
}
