import { reactive, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { syncAttendanceFromDB } from '@/composables/useAttendance';
import { describeError } from '@/lib/errors';
import type {
  Member,
  Meeting,
  MonthlyHandicap,
  MeetingResult,
  MonthlyRow,
  YearlySummary,
} from '@/lib/index';

// ── 휴면 회원: 해당 year_month 이후 대시보드·랭킹에서 제외 ──────────────────
// 시작월은 members.dormant_from 에서 온다. 예전에는 여기 상수로 박혀 있어
// 회원 한 명이 쉬는 것을 배포로만 반영할 수 있었고, 서버 집계(yearly_ranking)
// 와 규칙이 갈릴 수밖에 없었다.
function isActive(memberName: string, yearMonth: string): boolean {
  const from = MEMBERS.find((m) => m.name === memberName)?.dormant_from;
  return !from || yearMonth < from;
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

/**
 * 코드 배포 없이 바꿔야 하는 화면 문구 (public.app_settings).
 * 값이 없으면 빈 문자열이라 화면에서 v-if 로 그냥 사라진다 — 테이블이
 * 아직 없는 서버에 새 프런트를 먼저 올려도 깨지지 않게 하려는 것이다.
 */
export const SETTINGS: Record<string, string> = reactive({});

export function setting(key: string): string {
  return SETTINGS[key] ?? '';
}

export const dataLoading = ref(false);
export const dataInitialized = ref(false);
export const dataError = ref<string | null>(null);
export const membersLoading = ref(false);

function fill<T>(arr: T[], items: T[]): void {
  arr.splice(0, arr.length, ...items);
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * 조회 하한 (P1-2). 지금은 2026년 데이터뿐이라 실질적으로 전량이지만,
 * 해가 쌓여도 전송량이 무한정 늘지 않게 막아둔다. 2년 치를 가져오는 이유:
 * resolveHandicap() 이 "직전 기록"으로 폴백하고, 나의 기록/연간 랭킹이
 * 이전 연도를 참조할 수 있기 때문에 선택 월만 가져오면 계산이 깨진다.
 */
function defaultFromYearMonth(): string {
  return `${new Date().getFullYear() - 2}-01`;
}

/**
 * 로그인 화면용 최소 조회. 회원 목록(id, name) 외에는 아무것도 요청하지 않는다.
 * 나머지 테이블은 세션이 생긴 뒤 loadData() 가 가져온다.
 */
export async function loadMembers(): Promise<void> {
  if (MEMBERS.length > 0 || membersLoading.value) return;
  membersLoading.value = true;
  try {
    // dormant_from 은 로그인 화면의 회원 목록에서 휴면 회원을 빼는 데 쓴다.
    // 기록이 아니라 명단에 붙는 표시라 로그인 전에도 필요하다.
    const { data, error } = await supabase.from('members').select('id, name, dormant_from');
    if (error) throw new Error(error.message);
    fillMembers(data ?? []);
  } catch (err) {
    dataError.value = describeError(err, '회원 목록을 불러오는 중 오류가 발생했습니다.');
  } finally {
    membersLoading.value = false;
  }
}

/** 로그아웃 시 캐시를 비운다. 다음 로그인 때 다시 채워진다. */
export function clearData(): void {
  fill(GOLF_COURSES, []);
  fill(MEETINGS, []);
  fill(MONTHLY_HANDICAPS, []);
  fill(MEETING_RESULTS, []);
  for (const key of Object.keys(SETTINGS)) delete SETTINGS[key];
  for (const key of Object.keys(YEARLY_RANKING)) delete YEARLY_RANKING[key];
  dataInitialized.value = false;
  dataError.value = null;
}

function fillMembers(rows: { id: unknown; name: unknown; dormant_from?: unknown }[]): void {
  fill(
    MEMBERS,
    rows
      .map((m) => ({
        id: String(m.id),
        name: m.name as string,
        display_order: m.id as number,
        dormant_from: (m.dormant_from as string | null) ?? null,
      }))
      .sort((a, b) => a.display_order - b.display_order)
  );
}

/**
 * 기본값이 1인 이유: postgrest-js 가 이미 요청 단위로 3회(1s·2s·4s 백오프)
 * 재시도한다. 여기서 또 감싸면 재시도가 곱해져 실패 화면이 뜨기까지 26초가
 * 걸린다 — 그동안 사용자는 골격만 본다. 재시도는 아래 계층에 맡기고,
 * 이 층은 "안 되면 빨리 알리고 다시 시도 버튼을 준다"만 한다.
 */
export async function loadData(retries = 1): Promise<void> {
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
        dataError.value = describeError(err, '데이터를 불러오는 중 오류가 발생했습니다.');
      }
    }
  }
  dataLoading.value = false;
}

async function _fetchAll(): Promise<void> {
  const from = defaultFromYearMonth();

  // 기록을 다시 받으므로 서버 집계 캐시는 버린다 (저장 직후 재조회 포함).
  for (const key of Object.keys(YEARLY_RANKING)) delete YEARLY_RANKING[key];
  yearlyRankingVersion.value += 1;

  const [
      { data: courses, error: e1 },
      { data: meetings, error: e2 },
      { data: handicaps, error: e3 },
      { data: results, error: e4 },
      { data: members, error: e5 },
      { data: attendances },
      { data: settings },
    ] = await Promise.all([
      supabase.from('golf_courses').select('id, name'),
      supabase
        .from('meetings')
        .select('id, year_month, meeting_date, course_id, host_member_id')
        .gte('year_month', from),
      supabase
        .from('monthly_handicaps')
        .select('id, member_id, year_month, std_hc, app_hc, next_hc')
        .gte('year_month', from),
      // meeting_results 에는 year_month 가 없어 meetings 를 통해 범위를 건다
      // (meeting_results_meeting_id_fkey 로 임베드 필터가 가능).
      supabase
        .from('meeting_results')
        .select('id, meeting_id, member_id, attended, score, result_group, result_rank, meetings!inner(year_month)')
        .gte('meetings.year_month', from),
      supabase.from('members').select('id, name, dormant_from'),
      supabase
        .from('attendance_confirmations')
        .select('year_month, member_id, attending')
        .gte('year_month', from),
      // 오류를 받지 않는다. 테이블이 아직 없는 서버(프런트 선배포)에서도
      // 나머지 화면이 그대로 떠야 한다 — 문구 하나 때문에 기록이 안 보이면
      // 바꾼 보람이 없다.
      supabase.from('app_settings').select('key, value'),
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
    fillMembers(members ?? []);

    // monthly_handicaps
    fill(
      MONTHLY_HANDICAPS,
      (handicaps ?? []).map((h) => ({
        id: String(h.id),
        member_id: String(h.member_id),
        year_month: h.year_month as string,
        std_hc: h.std_hc as number,
        app_hc: h.app_hc as number,
        next_hc: (h.next_hc as number | null) ?? null,
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

    for (const key of Object.keys(SETTINGS)) delete SETTINGS[key];
    for (const s of settings ?? []) SETTINGS[s.key as string] = String(s.value ?? '');

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
//
// 폴백의 근거인 직전 달 next_hc 는 그 달 스코어가 입력돼야 정해진다. 아직
// 비어 있으면 당월 적용 핸디를 알 수 없으므로 app_hc 는 null 이다. 이 값을
// 그대로 빼면 JS 는 null 을 0 으로 바꿔 "핸디 0" 으로 계산해 버리므로,
// 받는 쪽은 반드시 null 을 확인하고 Net 계산에서 빼야 한다.
// (서버 yearly_ranking 도 app_hc is not null 인 라운드만 집계한다)
export function resolveHandicap(
  memberId: string,
  yearMonth: string
): { std_hc: number; app_hc: number | null; next_hc: number | null } | null {
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
      result?.attended && result.score !== null && appHc !== null ? result.score - appHc : null;

    const year = yearMonth.substring(0, 4);
    const yearMeetings = MEETINGS.filter((m) => m.year_month.startsWith(year));
    const yearlyNetScores: number[] = [];

    for (const ym of yearMeetings) {
      if (!isActive(member.name, ym.year_month)) continue;
      const ymResult = MEETING_RESULTS.find(
        (r) => r.meeting_id === ym.id && r.member_id === member.id
      );
      const ymHandicap = resolveHandicap(member.id, ym.year_month);
      if (
        ymResult &&
        ymResult.attended &&
        ymResult.score !== null &&
        ymResult.score > 0 &&
        ymHandicap?.app_hc != null
      ) {
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

// ── 연간 요약 (서버 집계) ─────────────────────────────────────────────────────
// 랭킹 규칙은 public.yearly_ranking(year) RPC 한 곳에만 있다. 예전에는 원본
// 기록을 전부 받아 브라우저에서 평균을 냈는데, 규칙이 화면 코드에만 있어
// 어느 쪽이 맞는지 확인할 방법이 없었다. RPC 는 호출자 권한으로 돌아
// 기록 RLS 가 그대로 걸린다 — 세션이 없으면 빈 배열이 온다.
//
// 연도별로 한 번만 받아 두고 재사용한다. 연도를 오가며 볼 때마다 같은
// 집계를 다시 시키지 않기 위해서다. 기록을 고친 뒤에는 reload=true 로 부른다.
const YEARLY_RANKING: Record<string, YearlySummary[]> = reactive({});

export const yearlyRankingLoading = ref(false);
export const yearlyRankingError = ref<string | null>(null);

/**
 * 원본 기록을 다시 받을 때마다 1 씩 오른다. 랭킹 화면이 이 값을 지켜보다가
 * 다시 요청한다 — 기록을 고치고 저장하면 loadData() 가 돌므로, 이게 없으면
 * 랭킹만 고치기 전 숫자로 남는다.
 */
export const yearlyRankingVersion = ref(0);

/** 이미 받아 둔 연간 랭킹. 아직 안 받았으면 빈 배열. */
export function getYearlySummary(year: string): YearlySummary[] {
  return YEARLY_RANKING[year] ?? [];
}

export function hasYearlySummary(year: string): boolean {
  return YEARLY_RANKING[year] !== undefined;
}

export async function loadYearlySummary(year: string, reload = false): Promise<void> {
  if (!year) return;
  if (!reload && YEARLY_RANKING[year] !== undefined) return;

  yearlyRankingLoading.value = true;
  yearlyRankingError.value = null;
  try {
    const { data, error } = await supabase.rpc('yearly_ranking', { p_year: year });
    if (error) throw new Error(error.message);

    // numeric 은 postgrest 가 문자열로 내려보낸다. 화면에서 toFixed 를 쓰므로
    // 여기서 숫자로 바꿔 둔다 — 안 그러면 정렬이 문자열 비교가 된다.
    YEARLY_RANKING[year] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      member_id: String(r.member_id),
      member_name: r.member_name as string,
      avg_net_score: Number(r.avg_net_score),
      avg_score: r.avg_score === null ? null : Number(r.avg_score),
      attended_count: Number(r.attended_count),
      winner_count: Number(r.winner_count),
      medalist_count: Number(r.medalist_count),
      host_count: Number(r.host_count),
      rank: Number(r.rank),
    }));
  } catch (err) {
    yearlyRankingError.value = describeError(err, '연간 랭킹을 불러오지 못했습니다.');
  } finally {
    yearlyRankingLoading.value = false;
  }
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
  /** 적용 핸디를 정할 수 없는 달이면 null (Net 도 함께 비운다) */
  app_hc: number | null;
  next_hc: number | null;
  score: number | null;
  net_score: number | null;
  monthly_rank: number | null;
  result_group: MeetingResult['result_group'];
  result_rank: MeetingResult['result_rank'];
  yearly_avg_net: number | null;
  yearly_rank: number | null;
}

export async function getYearlyExportRows(year: string): Promise<YearlyExportRow[]> {
  const yearMeetings = MEETINGS.filter((m) => m.year_month.startsWith(year)).sort((a, b) =>
    a.year_month < b.year_month ? -1 : a.year_month > b.year_month ? 1 : 0
  );
  // 연간 평균·순위는 랭킹 화면과 같은 서버 집계를 그대로 쓴다.
  // 여기서 따로 계산하면 파일과 화면이 다른 순위를 말하게 된다.
  await loadYearlySummary(year);
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
        net_score: scored && handicap.app_hc !== null ? score - handicap.app_hc : null,
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
