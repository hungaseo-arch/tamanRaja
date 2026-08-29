/**
 * 과거 기록 조회 (v_meeting_scores · v_member_stats)
 *
 * 2022-02 ~ 오늘까지 4년치가 쌓이면서, 화면이 봐야 할 범위가 data/index.ts 의
 * 조회 창(최근 2년)을 넘어섰다. 그렇다고 761행을 통째로 받아 브라우저에서
 * 거르면 연도를 오갈 때마다 전량이 다시 내려온다.
 *
 * 그래서 역할을 나눈다.
 *   · data/index.ts — 최근 2년. 쓰기(스코어 입력·참석)와 핸디 폴백이 걸린
 *     편집 경로가 쓴다. 원본 테이블을 그대로 들고 있어야 저장이 가능하다.
 *   · 이 파일       — 전 기간. 읽기 전용 화면(랭킹·명예의 전당·개인 이력)이
 *     쓴다. 연도(또는 회원)를 서버에서 걸어 필요한 만큼만 받는다.
 *
 * 두 뷰 모두 security_invoker 라 세션이 없으면 0행이 온다. 로그인 전에
 * 부르지 않는다.
 */
import { reactive, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';
import type { ResultGroup, ResultRank } from '@/lib';

/** v_member_stats 의 통산 행(year IS NULL)을 가리키는 캐시 키 */
export const CAREER = 'career';

/** v_meeting_scores 한 줄 — 모임 × 회원 */
export interface ScoreRow {
  meeting_id: string;
  year_month: string;
  year: string;
  meeting_date: string;
  /** 같은 달에 두 번 열려 빈 달로 옮겨 적은 모임. 실제 개최일을 병기해야 한다. */
  is_reassigned: boolean;
  meeting_note: string | null;
  course_name: string | null;
  par: number | null;
  member_id: string;
  member_name: string;
  dormant_from: string | null;
  attended: boolean;
  /** 파 기준 오버(T/T). 총타수가 아니다. */
  gross_over: number | null;
  gross_total: number | null;
  std_hc: number | null;
  app_hc: number | null;
  next_hc: number | null;
  net_score: number | null;
  result_group: ResultGroup;
  result_rank: ResultRank;
  /** 엑셀 원본 비고 원문. 시상 3종 외의 표기(깍두기·Guest·Y Winner 등)가 여기에만 있다. */
  note: string | null;
}

/** v_member_stats 한 줄 — 연도별(year 있음) 또는 통산(year 가 null) */
export interface MemberStatsRow {
  /** 통산 행이면 null */
  year: string | null;
  member_id: string;
  member_name: string;
  dormant_from: string | null;
  rounds: number;
  /** 참석 중 점수가 기록된 라운드. 평균의 분모다. */
  scored_rounds: number;
  avg_gross: number | null;
  avg_net: number | null;
  best_gross: number | null;
  best_net: number | null;
  winner_cnt: number;
  medalist_cnt: number;
  host_cnt: number;
  group1_cnt: number;
  group2_cnt: number;
}

const SCORE_COLUMNS =
  'meeting_id, year_month, year, meeting_date, is_reassigned, meeting_note, course_name, par, ' +
  'member_id, member_name, dormant_from, attended, gross_over, gross_total, ' +
  'std_hc, app_hc, next_hc, net_score, result_group, result_rank, note';

// 한 번 받은 연도는 그대로 둔다. 연도 탭을 오갈 때마다 같은 조회를 반복하지
// 않기 위해서다. 기록을 고쳐 저장하면 resetHistory() 로 통째로 버린다.
const SCORES: Record<string, ScoreRow[]> = reactive({});
const STATS: Record<string, MemberStatsRow[]> = reactive({});
const MEMBER_SCORES: Record<string, ScoreRow[]> = reactive({});

export const scoresLoading = ref(false);
export const scoresError = ref<string | null>(null);
export const statsLoading = ref(false);
export const statsError = ref<string | null>(null);

/**
 * 뷰는 생성된 Database 타입에 없어서 select() 결과가 GenericStringError 로 잡힌다.
 * 행 모양은 아래 to*Row() 가 책임지므로, 여기서 unknown 을 거쳐 한 번만 넓혀 준다.
 */
function rows(data: unknown): Record<string, unknown>[] {
  return (data ?? []) as Record<string, unknown>[];
}

/** postgrest 는 numeric 을 문자열로 내려보낸다. 화면에서 비교·정렬하므로 여기서 숫자로 바꾼다. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function int(v: unknown): number {
  return num(v) ?? 0;
}

function toScoreRow(r: Record<string, unknown>): ScoreRow {
  return {
    meeting_id: String(r.meeting_id),
    year_month: r.year_month as string,
    year: String(r.year),
    meeting_date: (r.meeting_date as string | null) ?? '',
    is_reassigned: r.is_reassigned === true,
    meeting_note: (r.meeting_note as string | null) ?? null,
    course_name: (r.course_name as string | null) ?? null,
    par: num(r.par),
    member_id: String(r.member_id),
    member_name: r.member_name as string,
    dormant_from: (r.dormant_from as string | null) ?? null,
    attended: r.attended === true,
    gross_over: num(r.gross_over),
    gross_total: num(r.gross_total),
    std_hc: num(r.std_hc),
    app_hc: num(r.app_hc),
    next_hc: num(r.next_hc),
    net_score: num(r.net_score),
    result_group: (r.result_group ?? null) as ResultGroup,
    result_rank: (r.result_rank ?? null) as ResultRank,
    note: (r.note as string | null) ?? null,
  };
}

function toStatsRow(r: Record<string, unknown>): MemberStatsRow {
  return {
    year: r.year === null || r.year === undefined ? null : String(r.year),
    member_id: String(r.member_id),
    member_name: r.member_name as string,
    dormant_from: (r.dormant_from as string | null) ?? null,
    rounds: int(r.rounds),
    scored_rounds: int(r.scored_rounds),
    avg_gross: num(r.avg_gross),
    avg_net: num(r.avg_net),
    best_gross: num(r.best_gross),
    best_net: num(r.best_net),
    winner_cnt: int(r.winner_cnt),
    medalist_cnt: int(r.medalist_cnt),
    host_cnt: int(r.host_cnt),
    group1_cnt: int(r.group1_cnt),
    group2_cnt: int(r.group2_cnt),
  };
}

// ── 연도별 성적 ───────────────────────────────────────────────────────────────

export function getYearScores(year: string): ScoreRow[] {
  return SCORES[year] ?? [];
}

export function hasYearScores(year: string): boolean {
  return SCORES[year] !== undefined;
}

/** 선택 연도의 개인 성적. 연도 필터는 서버에서 건다 — 전량을 받아 거르지 않는다. */
export async function loadYearScores(year: string, reload = false): Promise<void> {
  if (!year) return;
  if (!reload && SCORES[year] !== undefined) return;

  scoresLoading.value = true;
  scoresError.value = null;
  try {
    const { data, error } = await supabase
      .from('v_meeting_scores')
      .select(SCORE_COLUMNS)
      .eq('year', Number(year))
      .order('year_month', { ascending: true });
    if (error) throw new Error(error.message);
    SCORES[year] = rows(data).map(toScoreRow);
  } catch (err) {
    scoresError.value = describeError(err, '기록을 불러오지 못했습니다.');
  } finally {
    scoresLoading.value = false;
  }
}

// ── 회원별 전체 이력 (개인 상세) ─────────────────────────────────────────────

export function getMemberScores(memberId: string): ScoreRow[] {
  return MEMBER_SCORES[memberId] ?? [];
}

export function hasMemberScores(memberId: string): boolean {
  return MEMBER_SCORES[memberId] !== undefined;
}

/** 한 회원의 통산 참석 이력. 회원 필터도 서버에서 건다. */
export async function loadMemberScores(memberId: string, reload = false): Promise<void> {
  if (!memberId) return;
  if (!reload && MEMBER_SCORES[memberId] !== undefined) return;

  scoresLoading.value = true;
  scoresError.value = null;
  try {
    const { data, error } = await supabase
      .from('v_meeting_scores')
      .select(SCORE_COLUMNS)
      .eq('member_id', Number(memberId))
      .order('year_month', { ascending: true });
    if (error) throw new Error(error.message);
    MEMBER_SCORES[memberId] = rows(data).map(toScoreRow);
  } catch (err) {
    scoresError.value = describeError(err, '개인 기록을 불러오지 못했습니다.');
  } finally {
    scoresLoading.value = false;
  }
}

// ── 집계 (연도별 / 통산) ─────────────────────────────────────────────────────

/** @param scope 연도 문자열, 또는 통산이면 CAREER */
export function getStats(scope: string): MemberStatsRow[] {
  return STATS[scope] ?? [];
}

export function hasStats(scope: string): boolean {
  return STATS[scope] !== undefined;
}

/**
 * 회원별 집계. 통산(CAREER)은 GROUPING SETS 가 만든 year IS NULL 행이라
 * `.is('year', null)` 하나로 서버에서 골라 받는다.
 */
export async function loadStats(scope: string, reload = false): Promise<void> {
  if (!scope) return;
  if (!reload && STATS[scope] !== undefined) return;

  statsLoading.value = true;
  statsError.value = null;
  try {
    const query = supabase.from('v_member_stats').select('*');
    const { data, error } = await (scope === CAREER
      ? query.is('year', null)
      : query.eq('year', Number(scope)));
    if (error) throw new Error(error.message);
    STATS[scope] = rows(data).map(toStatsRow);
  } catch (err) {
    statsError.value = describeError(err, '집계를 불러오지 못했습니다.');
  } finally {
    statsLoading.value = false;
  }
}

// ── 명예의 전당 ───────────────────────────────────────────────────────────────
// 연간 위너·연말 준우승은 result_rank 체크 제약에 없어 note 에만 남아 있다.
// 표기가 흔들리는 값(`Y25 Winner`)이 있지만 DB 는 그대로 두고 여기서만 맞춘다.

export interface HonorRow {
  year: string;
  /** 연간 위너 */
  winner: string | null;
  /** 연말 준우승 */
  runnerUp: string | null;
}

const YEAR_WINNER_NOTES = ['Y Winner', 'Y25 Winner'];
const RUNNER_UP_NOTE = '1st Runner';

export const HONORS: HonorRow[] = reactive([]);
export const honorsLoading = ref(false);
export const honorsError = ref<string | null>(null);
const honorsLoaded = ref(false);

export async function loadHonors(reload = false): Promise<void> {
  if (!reload && honorsLoaded.value) return;

  honorsLoading.value = true;
  honorsError.value = null;
  try {
    const { data, error } = await supabase
      .from('v_meeting_scores')
      .select('year, member_name, note')
      .in('note', [...YEAR_WINNER_NOTES, RUNNER_UP_NOTE]);
    if (error) throw new Error(error.message);

    const byYear = new Map<string, HonorRow>();
    for (const r of rows(data)) {
      const year = String(r.year);
      const row = byYear.get(year) ?? { year, winner: null, runnerUp: null };
      const note = r.note as string;
      if (YEAR_WINNER_NOTES.includes(note)) row.winner = r.member_name as string;
      else if (note === RUNNER_UP_NOTE) row.runnerUp = r.member_name as string;
      byYear.set(year, row);
    }

    HONORS.splice(
      0,
      HONORS.length,
      ...[...byYear.values()].sort((a, b) => Number(b.year) - Number(a.year))
    );
    honorsLoaded.value = true;
  } catch (err) {
    honorsError.value = describeError(err, '명예의 전당을 불러오지 못했습니다.');
  } finally {
    honorsLoading.value = false;
  }
}

// ── 회원별 핸디 추이 ──────────────────────────────────────────────────────────
// monthly_handicaps 를 회원 하나로 좁혀 받는다. 781행을 통째로 받아 거르면
// 회원을 바꿀 때마다 전량이 다시 내려온다.

export interface HandicapPoint {
  year_month: string;
  std_hc: number | null;
  app_hc: number | null;
  next_hc: number | null;
}

const HANDICAPS: Record<string, HandicapPoint[]> = reactive({});
export const handicapLoading = ref(false);
export const handicapError = ref<string | null>(null);

export function getMemberHandicaps(memberId: string): HandicapPoint[] {
  return HANDICAPS[memberId] ?? [];
}

export function hasMemberHandicaps(memberId: string): boolean {
  return HANDICAPS[memberId] !== undefined;
}

export async function loadMemberHandicaps(memberId: string, reload = false): Promise<void> {
  if (!memberId) return;
  if (!reload && HANDICAPS[memberId] !== undefined) return;

  handicapLoading.value = true;
  handicapError.value = null;
  try {
    const { data, error } = await supabase
      .from('monthly_handicaps')
      .select('year_month, std_hc, app_hc, next_hc')
      .eq('member_id', Number(memberId))
      .order('year_month', { ascending: true });
    if (error) throw new Error(error.message);
    HANDICAPS[memberId] = rows(data).map((h) => ({
      year_month: h.year_month as string,
      std_hc: num(h.std_hc),
      app_hc: num(h.app_hc),
      next_hc: num(h.next_hc),
    }));
  } catch (err) {
    handicapError.value = describeError(err, '핸디캡 기록을 불러오지 못했습니다.');
  } finally {
    handicapLoading.value = false;
  }
}

// ── 캐시 비우기 ───────────────────────────────────────────────────────────────
// 로그아웃(다음 사람에게 남으면 안 된다)과 기록 저장 직후(고치기 전 숫자가
// 남으면 안 된다) 두 경우에 부른다.
export function resetHistory(): void {
  for (const key of Object.keys(SCORES)) delete SCORES[key];
  for (const key of Object.keys(STATS)) delete STATS[key];
  for (const key of Object.keys(MEMBER_SCORES)) delete MEMBER_SCORES[key];
  for (const key of Object.keys(HANDICAPS)) delete HANDICAPS[key];
  HONORS.splice(0, HONORS.length);
  honorsLoaded.value = false;
  scoresError.value = null;
  statsError.value = null;
  honorsError.value = null;
  handicapError.value = null;
}
