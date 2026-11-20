<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { CalendarCheck, ChevronLeft, ChevronRight, CircleHelp, Download } from 'lucide-vue-next';
import type { MonthlyRow, ResultRank, ResultGroup } from '@/lib';
import { formatDate, formatMeetingHeading, formatYearMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { computeResults, isRankName, type ScoredRow } from '@/lib/rank';
import { GOLF_COURSES, setting } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useAttendance } from '@/composables/useAttendance';
import { useRecordExport } from '@/composables/useRecordExport';
import { useCompactTable } from '@/composables/useCompactTable';
import Select from '@/components/ui/Select.vue';
import type { SelectOption } from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import RankBadge from '@/components/ui/RankBadge.vue';
import Button from '@/components/ui/Button.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import AsyncState from '@/components/ui/AsyncState.vue';
import RowDetailDialog from '@/components/ui/RowDetailDialog.vue';
import RowDetailButton from '@/components/ui/RowDetailButton.vue';
import DetailItem from '@/components/ui/DetailItem.vue';
import Dialog from '@/components/ui/Dialog.vue';

export interface SavePayload {
  scores: Record<string, string>;
  groups: Record<string, string>;
  ranks: Record<string, string>;
  attendance: Record<string, boolean | null>;
  /** 잠금 해제 후 수정일 때 그 사유 (4-2). 저장이 끝나면 meetings.notes 에 덧붙인다. */
  unlockReason?: string;
}

interface Props {
  yearMonth: string;
  monthlyData: MonthlyRow[];
  meetingDate: string;
  courseName: string;
  isFutureMonth?: boolean;
  isEditable?: boolean;
  isManager?: boolean;
  /** 기한(경기일+3일)이 지난 달을 잠금 해제해 고칠 수 있는지 — 관리자 한정 (4-2). */
  canUnlock?: boolean;
  selectedMonth: string;
  monthOptions: SelectOption[];
  // 고를 수 있는 바로 이전·다음 달. 없으면 null 이고 이동 버튼은 비활성화된다.
  prevMonth?: string | null;
  nextMonth?: string | null;
  selectedYear: string;
  yearOptions: SelectOption[];
  manualDate: string;
  manualCourse: string;
  /**
   * 부모의 저장 진행 상태. 'saving' → 'idle' 로 끝나야 편집 모드를 닫는다.
   * 'error' 로 끝나면 입력값을 그대로 둔 채 편집 모드를 유지한다 —
   * 저장에 실패했는데 화면이 읽기 모드로 돌아가면 방금 친 값이 사라진 것처럼 보인다.
   */
  saveState?: 'idle' | 'saving' | 'error';
  /**
   * 참석 창을 열 수 있는 줄(로그인한 본인)의 회원 id. 참석 창은 아직 답할 수
   * 있는 달의 본인 참석만 바꾸므로, 부모가 그런 달을 보고 있을 때만 넘긴다. 그 외에는 null.
   */
  attendanceMemberId?: string | null;
  /**
   * 연·월 선택 칸을 다시 그리는 번호. 변경분 때문에 월 전환을 취소하면 부모는 달을
   * 그대로 두는데, 네이티브 select 는 고른 값이 화면에 남는다. 번호가 바뀌면 칸을
   * 새로 만들어 실제 달로 되돌린다.
   */
  selectRevision?: number;
}

const props = defineProps<Props>();
const { isAdmin } = useAuth();

const emit = defineEmits<{
  (e: 'save', data: SavePayload): void;
  (e: 'update:selectedMonth', value: string): void;
  (e: 'update:selectedYear', value: string): void;
  (e: 'update:manualDate', value: string): void;
  (e: 'update:manualCourse', value: string): void;
  (e: 'open-attendance'): void;
  /** 저장하지 않은 입력이 있는지. 부모가 월 전환·새로고침 경고에 쓴다. */
  (e: 'dirty-change', dirty: boolean): void;
}>();

// 편집 모드. 미래 달은 기본 편집 상태로 열리지만, 편집 권한이 있을 때만이다.
// (권한 없는 회원에게 입력 필드가 노출되던 문제 — 서버 RLS 가 최종 차단하지만
//  애초에 보이지 않아야 한다.)
const isEditing = ref(false);

// 입력값 — watch보다 먼저 선언해야 immediate watch의 TDZ 에러 방지
const localScores = reactive<Record<string, string>>({});
const localGroups = reactive<Record<string, string>>({});
const localRanks = reactive<Record<string, string>>({});
const localNextHc = reactive<Record<string, number>>({});
const localAttendance = reactive<Record<string, boolean | null>>({});

const { getAttendance } = useAttendance();

// 편집 가능 여부: 미래월(기획) 또는 경기일 +3일 이내(당월 수정) — 관리자 한정
// 잠금 해제(4-2): 기한이 지난 달을 관리자가 사유를 남기고 다시 연다. 달을 바꾸면 다시 잠긴다.
const unlockReason = ref<string | null>(null);
const canManage = computed(() =>
  ((props.isEditable ?? props.isFutureMonth ?? false) || unlockReason.value !== null) && (props.isManager ?? false)
);

function clearLocal(): void {
  [localScores, localGroups, localRanks, localNextHc].forEach((map) =>
    Object.keys(map).forEach((k) => delete map[k]),
  );
  Object.keys(localAttendance).forEach((k) => delete localAttendance[k]);
}

// ── 저장하지 않은 입력 감지 ───────────────────────────────────────────────────
// 편집 모드로 들어선 직후(시드·자동 계산이 끝난 뒤)의 값을 기준으로 삼고, 지금 값과
// 다르면 변경분이 있는 것이다. 비운 칸('')과 아예 없는 칸은 같게 본다.
function snapshot(): string {
  const entries = (o: Record<string, unknown>) =>
    Object.keys(o)
      .filter((k) => o[k] !== '' && o[k] !== undefined)
      .sort()
      .map((k) => [k, o[k]]);
  return JSON.stringify([
    entries(localScores), entries(localGroups), entries(localRanks), entries(localAttendance),
    props.manualDate, props.manualCourse,
  ]);
}
const baseline = ref('');
let baselineDate = '';
let baselineCourse = '';
function captureBaseline(): void {
  baseline.value = snapshot();
  baselineDate = props.manualDate;
  baselineCourse = props.manualCourse;
}
const isDirty = computed(() => isEditing.value && snapshot() !== baseline.value);
watch(isDirty, (v) => emit('dirty-change', v));

// 다른 달로 옮기면 잠금 해제도 풀린다 — 사유는 그 달 하나에 대한 것이다.
watch(() => props.yearMonth, () => { unlockReason.value = null; });

watch(
  () => [props.yearMonth, props.isFutureMonth, canManage.value] as const,
  ([ym, future, manage]) => {
    isEditing.value = (future ?? false) && manage; // 미래월 + 편집 권한
    clearLocal();
    if (future) {
      Object.assign(localAttendance, getAttendance(ym));
    }
    // 입력값 감시자(computeAutoFields)까지 돈 뒤에 기준을 잡는다.
    void nextTick(captureBaseline);
  },
  { immediate: true },
);

// 당월 수정 진입: 기존 저장 데이터로 로컬 입력값을 시드한 뒤 편집 모드 전환.
// (점수만 시드하면 computeAutoFields가 조/시상/차월핸디를 자동 재계산)
function enterEdit(): void {
  if (!props.isFutureMonth) {
    clearLocal();
    for (const row of props.monthlyData) {
      localAttendance[row.member_id] = row.attended;
      if (row.attended && row.score !== null) {
        localScores[row.member_id] = String(row.score);
      }
    }
  }
  isEditing.value = true;
  void nextTick(captureBaseline);
}

function getLocalNet(row: MonthlyRow): string {
  const raw = localScores[row.member_id];
  if (!raw) return '';
  if (row.app_hc === null) return '';
  const score = parseInt(raw, 10);
  if (isNaN(score)) return '';
  const net = score - row.app_hc;
  return (net >= 0 ? '+' : '') + net;
}

function computeAutoFields(): void {
  const scored: ScoredRow[] = props.monthlyData
    .filter((row) => {
      // 적용 핸디가 없으면 Net 을 낼 수 없다. 0 으로 두고 계산하면 Net 이
      // 스코어와 같아져 조 편성·Winner 판정까지 어긋나므로 아예 뺀다.
      if (row.app_hc === null) return false;
      const val = localScores[row.member_id];
      return val !== undefined && val !== '' && !isNaN(parseInt(val, 10));
    })
    .map((row) => ({
      member_id: row.member_id,
      std_hc: row.std_hc,
      app_hc: row.app_hc as number,
      prev_result_group: row.prev_result_group,
      score: parseInt(localScores[row.member_id], 10),
    }));

  // 점수 없는 회원의 자동 계산값 초기화
  for (const row of props.monthlyData) {
    if (!localScores[row.member_id]) {
      delete localGroups[row.member_id];
      delete localNextHc[row.member_id];
      delete localRanks[row.member_id];
    }
  }

  for (const [memberId, r] of Object.entries(computeResults(scored))) {
    localGroups[memberId] = r.result_group;
    localNextHc[memberId] = r.next_hc;
    localRanks[memberId] = r.result_rank;
  }
}

// ── 스코어 입력 검증 ──────────────────────────────────────────────────────────
// 여기 스코어는 총타수가 아니라 오버파 기준값이라 실제 기록은 한 자리~두 자리다.
// 자릿수를 잘못 눌러 세 자리가 들어가면 조 편성·차월 핸디까지 통째로 어긋나므로
// 저장 전에 막는다.
const SCORE_MIN = -20;
const SCORE_MAX = 60;

function isScoreInvalid(memberId: string): boolean {
  const raw = localScores[memberId];
  if (raw === undefined || raw.trim() === '') return false;
  const n = Number(raw);
  return !Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX;
}

const invalidScoreNames = computed(() =>
  props.monthlyData.filter((row) => isScoreInvalid(row.member_id)).map((row) => row.member_name),
);

const validationError = ref<string | null>(null);

// 당월 핸디가 없는 회원 (3-4). 서버 save_meeting_results 의 no_handicap 과 같은
// 규칙이다 — 스코어가 저장된 적 없는 달은 전원, 이미 저장된 달(사후 수정)은
// 참석·스코어 행만 본다. 직전 달이 미확정이면 resolveHandicap 이 app_hc 를
// null 로 주므로 그 경우도 여기 걸린다. 눌러 봐야 서버가 거절하니 버튼을 잠근다.
const missingHcNames = computed(() =>
  props.monthlyData
    .filter((row) => row.app_hc === null)
    .filter((row) =>
      props.isFutureMonth
      || localAttendance[row.member_id] === true
      || !!localScores[row.member_id]?.trim(),
    )
    .map((row) => row.member_name),
);

watch(
  localScores,
  () => {
    computeAutoFields();
    // 고치는 즉시 경고를 거둔다. 남겨 두면 이미 고친 뒤에도 야단맞는 것처럼 보인다.
    if (validationError.value && invalidScoreNames.value.length === 0) validationError.value = null;
  },
  { deep: true },
);

function handleSave(): void {
  if (props.saveState === 'saving' || missingHcNames.value.length > 0) return;
  if (invalidScoreNames.value.length > 0) {
    validationError.value =
      `스코어는 ${SCORE_MIN}~${SCORE_MAX} 사이 정수만 가능 — ${invalidScoreNames.value.join(', ')}`;
    return;
  }
  validationError.value = null;
  askConfirm({
    title: '저장 확인',
    lines: saveSummaryLines(),
    okLabel: '저장',
    cancelLabel: '돌아가기',
    onOk: doSave,
  });
}

// 저장 전 요약 — 화면에 이미 나와 있는 입력값(참석·스코어·시상 칸)을 그대로 읽는다.
// 시상은 computeAutoFields 가 채운 localRanks 에서 이름만 찾는다.
function saveSummaryLines(): string[] {
  const attended = props.monthlyData.filter(
    (row) => localAttendance[row.member_id] === true || !!localScores[row.member_id]?.trim(),
  ).length;
  const nameOf = (rank: string): string => {
    const id = Object.keys(localRanks).find((k) => localRanks[k] === rank);
    return props.monthlyData.find((row) => row.member_id === id)?.member_name ?? '미정';
  };
  const lines = [
    heading.value,
    `${attended}명 참석`,
    `Winner ${nameOf('Winner')}`,
    `Medalist ${nameOf('Medalist')}`,
    `Host ${nameOf('Host')}`,
  ];
  if (unlockReason.value) lines.push(`수정 사유 ${unlockReason.value}`);
  return lines;
}

function doSave(): void {
  if (props.saveState === 'saving') return;
  emit('save', {
    scores: { ...localScores },
    groups: { ...localGroups },
    ranks: { ...localRanks },
    attendance: { ...localAttendance },
    unlockReason: unlockReason.value ?? undefined,
  });
}

// 저장이 실제로 끝난 뒤에만 편집 모드를 닫는다.
watch(
  () => props.saveState,
  (now, before) => {
    if (before === 'saving' && now === 'idle') {
      isEditing.value = false;
      unlockReason.value = null; // 한 번 저장하면 다시 잠근다. 또 고치려면 사유를 새로 적는다.
    }
  },
);

// ── 잠금 해제 (4-2) ──────────────────────────────────────────────────────────
const unlockOpen = ref(false);
const unlockInput = ref('');
const unlockError = ref<string | null>(null);
const showUnlock = computed(() => !!props.canUnlock && (props.isManager ?? false) && unlockReason.value === null);

function openUnlock(): void {
  unlockInput.value = '';
  unlockError.value = null;
  unlockOpen.value = true;
}

function confirmUnlock(): void {
  const reason = unlockInput.value.trim();
  if (!reason) {
    unlockError.value = '수정 사유 필요';
    return;
  }
  unlockReason.value = reason;
  unlockOpen.value = false;
  // canManage 가 참이 된 뒤 watch 가 입력값을 비우므로, 그다음에 시드한다.
  void nextTick(enterEdit);
}

function cancelEdit(): void {
  clearLocal();
  // 미래 달의 참석 칸은 편집 모드와 상관없이 화면에 남으므로 저장된 값으로 되돌린다.
  if (props.isFutureMonth) Object.assign(localAttendance, getAttendance(props.yearMonth));
  if (props.manualDate !== baselineDate) emit('update:manualDate', baselineDate);
  if (props.manualCourse !== baselineCourse) emit('update:manualCourse', baselineCourse);
  isEditing.value = false;
  unlockReason.value = null;
}

// 변경분이 있으면 한 번 더 묻는다. 없으면 바로 닫는다.
function requestCancel(): void {
  if (!isDirty.value) {
    cancelEdit();
    return;
  }
  askConfirm({
    title: '수정 취소',
    lines: ['저장하지 않은 입력이 사라짐'],
    okLabel: '입력 폐기',
    cancelLabel: '계속 수정',
    onOk: cancelEdit,
  });
}

// ── 확인 창 (저장 전 요약·입력 폐기 공용) ─────────────────────────────────────
const confirmDlg = reactive({
  open: false,
  title: '',
  lines: [] as string[],
  okLabel: '',
  cancelLabel: '',
  onOk: null as (() => void) | null,
});

function askConfirm(opts: { title: string; lines: string[]; okLabel: string; cancelLabel: string; onOk: () => void }): void {
  Object.assign(confirmDlg, opts, { open: true });
}

function acceptConfirm(): void {
  const run = confirmDlg.onOk;
  confirmDlg.open = false;
  confirmDlg.onOk = null;
  run?.();
}

// ── 줄 상세 (디스클로저) ─────────────────────────────────────────────────────
// 좁은 화면에서는 기준 핸디·차월 핸디·결과 그룹 열이 숨는다. 회원 이름을
// 누르면 그 회원의 값을 숨은 것까지 모아 보여 준다.
// md 부터는 열이 전부 보여 창을 열어도 표와 같은 내용이라 아예 열지 않는다.
// detailRow 는 창을 닫아도 비우지 않는다 — 닫히는 동안 내용이 사라지면
// 사라지는 애니메이션이 빈 상자로 보인다.
const compact = useCompactTable('md');
// 좁은 화면의 편집 모드에서는 표가 가로 스크롤을 맡는다. (3-3)
const tableScrolls = computed(() => isEditing.value && compact.value);

// 핸디 규칙 도움말. 차월 핸디 열은 좁은 화면에서 숨겨지므로 열 제목이 아니라
// 항상 보이는 컨트롤 줄에 둔다.
const showHcHelp = ref(false);
const detailRow = ref<MonthlyRow | null>(null);
const detailOpen = ref(false);

// 본인 줄의 이름·참석 칸. 이름 칸은 상세가 아니라 참석 창이 열리므로, 상세(점선·회색)와
// 달리 실선·초록·달력 아이콘으로 구분한다.
// 모바일은 줄 높이를 늘리지 않고 칸 여백(py-2)을 버튼이 먹어 44px 를 채운다.
const ATTENDANCE_BUTTON_CLASS =
  '-mx-1 -my-2 sm:my-0 inline-flex min-h-11 sm:min-h-0 items-center gap-1 rounded-sm px-1 py-1 text-left underline decoration-solid decoration-primary underline-offset-4 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function openDetail(row: MonthlyRow): void {
  detailRow.value = row;
  detailOpen.value = true;
}

// 창을 열어 둔 채 화면을 넓히면 뒤의 표에 같은 값이 드러난다 — 그때는 닫는다.
watch(compact, (isCompact) => {
  if (!isCompact) detailOpen.value = false;
});

// 참석 표기는 표와 상세가 같아야 한다.
function attendanceLabel(row: MonthlyRow): { text: string; class: string } {
  if (props.isFutureMonth) {
    const v = localAttendance[row.member_id];
    if (v === true) return { text: '참석', class: 'text-primary' };
    if (v === null) return { text: '미정', class: 'text-warning' };
    if (v === false) return { text: '불참', class: 'text-destructive' };
    return { text: '미응답', class: 'text-muted-foreground font-normal' };
  }
  return row.attended
    ? { text: '참석', class: 'text-primary' }
    : { text: '불참', class: 'text-muted-foreground font-normal' };
}

// 골프장이 아직 없으면 구분자('-')를 아예 붙이지 않는다 — "2026년 8월 1일 - "
// 처럼 구분자만 남는 문제 (P1-1)
// 한 줄짜리 표제. 빈 화면 문구와 상세 창의 부제에 쓴다.
const heading = computed(() =>
  formatMeetingHeading(props.selectedMonth, props.meetingDate, props.courseName),
);

// h1 은 날짜가 주인공이고 골프장은 딸린 설명이다 — 나의 기록의
// "나의 기록 — 홍길동 님" 과 같은 짜임으로 맞춘다.
const headingDate = computed(() => formatDate(props.meetingDate) || formatYearMonth(props.selectedMonth));
const headingCourse = computed(() => props.courseName?.trim() ?? '');

const sortedMonthlyData = computed(() =>
  [...props.monthlyData].sort((a, b) => a.member_name.localeCompare(b.member_name, 'ko'))
);

const winnerRow = computed(() => props.monthlyData.find((r) => r.result_rank === 'Winner'));

const localSelectedYear = computed({
  get: () => props.selectedYear,
  set: (v: string) => emit('update:selectedYear', v),
});
const localSelectedMonth = computed({
  get: () => props.selectedMonth,
  set: (v: string) => emit('update:selectedMonth', v),
});

const localManualDate = computed({
  get: () => props.manualDate,
  set: (v: string) => emit('update:manualDate', v),
});

// ── 골프장 선택 ───────────────────────────────────────────────────────────────
// 값은 계속 이름 문자열 하나(props.manualCourse)로 오간다. 화면에서만
// "목록에서 고르기 / 신규 추가" 두 갈래로 나눠 보여준다.
const NEW_COURSE = '__new__';
const courseChoice = ref('');
const newCourseName = ref('');
const newCourseInput = ref<HTMLInputElement | null>(null);

const courseOptions = computed<SelectOption[]>(() => [
  ...GOLF_COURSES.map((c) => ({ value: c.name, label: c.name })),
  { value: NEW_COURSE, label: '+ 신규 추가' },
]);

const resolvedCourse = computed(() =>
  courseChoice.value === NEW_COURSE ? newCourseName.value.trim() : courseChoice.value,
);

// 바깥에서 값이 바뀐 경우(달 전환 등)만 두 갈래로 되돌려 놓는다.
// 우리가 올린 값이 그대로 되돌아온 것이면 건드리지 않는다 — 신규 입력 도중
// 글자를 지웠을 때 셀렉트가 제멋대로 '선택 안 함' 으로 튀는 걸 막는다.
watch(
  () => props.manualCourse,
  (name) => {
    if (resolvedCourse.value === name) return;
    if (!name) {
      courseChoice.value = '';
      newCourseName.value = '';
    } else if (GOLF_COURSES.some((c) => c.name === name)) {
      courseChoice.value = name;
      newCourseName.value = '';
    } else {
      // 목록에 없는 이름이 이미 저장돼 있던 경우 (예전 자유 입력분)
      courseChoice.value = NEW_COURSE;
      newCourseName.value = name;
    }
  },
  { immediate: true },
);

watch(resolvedCourse, (v) => {
  if (v !== props.manualCourse) emit('update:manualCourse', v);
});

watch(courseChoice, async (v) => {
  if (v !== NEW_COURSE) return;
  await nextTick();
  newCourseInput.value?.focus();
});

const futureAttendedCount = computed(() =>
  Object.values(localAttendance).filter((v) => v === true).length
);

const stats = computed(() => {
  let attendedCount = 0, winnerName = '-', medalistName = '-', hostName = '-';
  for (const d of props.monthlyData) {
    if (d.attended && d.score !== null) attendedCount++; // 스코어가 기록된 인원만 집계
    if (d.result_rank === 'Winner')   winnerName   = d.member_name;
    if (d.result_rank === 'Medalist') medalistName = d.member_name;
    if (d.result_rank === 'Host')     hostName     = d.member_name;
  }
  return { attendedCount, winnerName, medalistName, hostName };
});

// ── 엑셀(CSV) 다운로드 ────────────────────────────────────────────────────────
// 결과 알림(성공·빈 데이터)은 useRecordExport 안에서 처리한다.
const { exportYearlyRecords } = useRecordExport();

const exportYear = computed(() => props.selectedMonth.substring(0, 4));
</script>

<template>
  <div class="space-y-3">
    <!-- 표제 줄. 한때 sticky 로 붙잡아 뒀는데, 붙잡힌 바 위로 표의 고정 셀이
         지나가 겹쳤다. 지금은 이 줄도 표와 함께 밀려 올라가고, 화면에 남는
         것은 표의 열 제목뿐이다. -->
    <!-- 표제 줄. 한때 초록 그라데이션 카드였는데, 연간 랭킹·나의 기록은
         카드 없이 "제목 + 오른쪽 컨트롤" 한 줄이라 이 화면만 색이 튀었다.
         지금은 세 화면이 같은 줄을 쓴다. -->
    <div class="space-y-2 pt-1">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <!-- 연월 (제목) — 이 화면의 h1 이다. 사이트 이름은 헤더의 일반 텍스트다. -->
        <CardTitle as="h1" class="px-0 min-w-0 break-words text-lg font-bold text-foreground">
          {{ headingDate }}
          <span v-if="headingCourse" class="text-sm font-medium text-muted-foreground">— {{ headingCourse }}</span>
        </CardTitle>

        <!-- 그달 요약. 제목과 컨트롤 사이 가운데에 놓는다(mx-auto 가 남는 폭을
             양쪽으로 나눠 가진다). 좁은 화면에서는 줄이 접혀 제목 아래로
             내려가고, Winner·Medalist 는 sm 미만에서 숨는다. -->
        <div v-if="isFutureMonth" class="mx-auto flex items-center gap-1.5 text-sm">
          <span class="font-medium text-muted-foreground whitespace-nowrap">참석 예정 인원</span>
          <span class="font-bold">{{ futureAttendedCount }}명</span>
        </div>
        <div v-else class="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-medium text-muted-foreground whitespace-nowrap">참석인원</span>
            <span class="font-bold">{{ stats.attendedCount }}명</span>
          </div>
          <div :class="cn('items-center gap-1.5 min-w-0', isEditing ? 'hidden sm:flex' : 'flex')">
            <RankBadge rank="Winner" class="shrink-0" />
            <span class="font-semibold truncate">{{ stats.winnerName }}</span>
          </div>
          <div :class="cn('items-center gap-1.5 min-w-0', isEditing ? 'hidden sm:flex' : 'flex')">
            <RankBadge rank="Medalist" class="shrink-0" />
            <span class="font-semibold truncate">{{ stats.medalistName }}</span>
          </div>
        </div>

        <!-- 컨트롤은 한 덩어리다. 낱개로 두면 좁은 폭에서 줄이 접힐 때
             왼쪽으로 흩어져 제목 아래에 아무렇게나 붙는다. 오른쪽 끝은
             가운데 요약의 mx-auto 가 밀어 준다. -->
        <div class="flex flex-wrap items-center justify-end gap-2">
        <!-- 연월 입력창 / 골프장명 (미래달) / 저장·수정 (관리자) -->
        <template v-if="canManage">
          <template v-if="isFutureMonth">
            <input
              type="date"
              v-model="localManualDate"
              aria-label="모임 날짜"
              class="h-11 sm:h-8 rounded-md border border-input bg-background px-2 text-base sm:text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 w-full sm:w-auto sm:flex-initial"
            />
            <!-- 골프장은 목록에서 고르는 것이 기본이다. datalist 는 제안일 뿐이라
                 오타가 그대로 저장돼 같은 골프장이 두 개로 갈라졌다. 새 골프장은
                 '신규 추가' 를 고른 뒤 명시적으로 입력한다. -->
            <Select
              v-model="courseChoice"
              :options="courseOptions"
              placeholder="골프장 선택"
              aria-label="골프장"
              size="xs"
              class="flex-1 min-w-0 sm:flex-initial sm:w-32"
          select-class="text-sm sm:text-xs"
            />
            <input
              v-if="courseChoice === NEW_COURSE"
              ref="newCourseInput"
              type="text"
              v-model="newCourseName"
              aria-label="새 골프장명"
              placeholder="새 골프장명"
              class="h-11 sm:h-8 rounded-md border border-input bg-background px-2 text-base sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 flex-1 min-w-0 sm:flex-initial sm:w-28"
            />
          </template>
          <!-- 저장 중 재클릭은 meeting_results 를 지웠다 다시 넣는 과정을
               겹쳐 돌려 기록이 어긋날 수 있다. 끝날 때까지 잠근다. -->
          <Button
            v-if="isEditing"
            size="xs"
            class="shrink-0"
            :disabled="props.saveState === 'saving' || missingHcNames.length > 0"
            :aria-describedby="isEditing && missingHcNames.length > 0 ? 'monthly-missing-hc' : undefined"
            @click="handleSave"
          >{{ props.saveState === 'saving' ? '저장 중...' : '저장' }}</Button>
          <!-- 취소는 모든 편집 모드에 둔다. 변경분이 있으면 폐기 확인을 거친다. -->
          <Button
            v-if="isEditing"
            size="xs"
            variant="outline"
            class="shrink-0"
            :disabled="props.saveState === 'saving'"
            @click="requestCancel"
          >취소</Button>
          <Button v-else size="xs" variant="outline" class="shrink-0" @click="enterEdit">수정</Button>
        </template>
        <Button v-else-if="showUnlock" size="xs" variant="outline" class="shrink-0" @click="openUnlock">
          잠금 해제 후 수정
        </Button>

        <!-- 연도·월 선택. 연간 랭킹의 연도 선택과 같은 자리·같은 배색이다.
             고를 연도가 하나뿐이면 연도 상자는 띄우지 않는다 (연간 랭킹과 같다). -->
        <template v-if="yearOptions.length > 1">
          <label for="monthly-year" class="sr-only">조회할 연도</label>
          <Select
            id="monthly-year"
            :key="`year-${props.selectRevision ?? 0}`"
            v-model="localSelectedYear"
            :options="yearOptions"
            placeholder=""
            size="xs"
            class="w-28 sm:w-22 shrink-0"
          select-class="text-sm sm:text-xs"
          />
        </template>
        <Button
          variant="outline"
          size="xs"
          class="w-11 px-0 shrink-0 sm:w-8"
          :disabled="!props.prevMonth"
          aria-label="이전 달"
          title="이전 달"
          @click="props.prevMonth && emit('update:selectedMonth', props.prevMonth)"
        >
          <ChevronLeft class="w-4 h-4" aria-hidden="true" />
        </Button>
        <label for="monthly-month" class="sr-only">조회할 월</label>
        <Select
          id="monthly-month"
          :key="`month-${props.selectRevision ?? 0}`"
          v-model="localSelectedMonth"
          :options="monthOptions"
          placeholder="월 선택"
          size="xs"
          class="w-24 sm:w-18 shrink-0"
          select-class="text-sm sm:text-xs"
        />
        <Button
          variant="outline"
          size="xs"
          class="w-11 px-0 shrink-0 sm:w-8"
          :disabled="!props.nextMonth"
          aria-label="다음 달"
          title="다음 달"
          @click="props.nextMonth && emit('update:selectedMonth', props.nextMonth)"
        >
          <ChevronRight class="w-4 h-4" aria-hidden="true" />
        </Button>

        <!-- 엑셀(CSV) 다운로드 — 해당 연도 전체 기록.
             좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 gap-1"
          :title="`${exportYear}년 전체 기록 CSV 다운로드(엑셀용)`"
          :aria-label="`${exportYear}년 전체 기록 CSV 다운로드(엑셀용)`"
          @click="exportYearlyRecords(props.selectedMonth)"
        >
          <Download class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">CSV</span>
        </Button>

        <!-- 핸디 규칙 도움말 -->
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 gap-1"
          title="핸디 규칙 보기"
          aria-label="핸디 규칙 보기"
          @click="showHcHelp = true"
        >
          <CircleHelp class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">핸디 규칙</span>
        </Button>
        </div>
      </div>

      <!-- 저장을 막은 이유는 저장 버튼 가까이 둔다. 표 아래에 있으면 화면이 긴
           달에서는 눌러 놓고 아무 반응이 없는 것처럼 보인다. -->
      <p v-if="validationError" class="text-sm text-destructive" role="alert">
        {{ validationError }}
      </p>
      <p
        v-if="isEditing && missingHcNames.length > 0"
        id="monthly-missing-hc"
        class="text-sm text-destructive"
        role="status"
      >
        당월 핸디 없는 회원 있음 — {{ missingHcNames.join(', ') }} · 직전 달 결과 저장 후 저장 가능
      </p>
    </div>

    <!-- 월별 기록 테이블 -->
    <!-- 카드가 표를 감싼다: 표는 좁은 화면에서 줄일 수 없는 최소 폭이 있고
         평소 가로 스크롤은 main 이 맡는다. 카드 폭을 그 최소 폭(w-min)에 맞춰야
         테두리·배경이 표 오른쪽 끝까지 따라간다. 넓은 화면에서는
         min-w-full 이 이겨서 예전과 똑같이 폭을 가득 채운다.
         표가 스스로 스크롤할 때(tableScrolls)는 카드가 화면 폭에 머문다. -->
    <Card :class="tableScrolls ? 'w-full' : 'w-min min-w-full'">
      <CardContent class="px-2 sm:px-6">
        <div class="pt-4">
          <!-- 위의 월 선택·엑셀은 밖에 둔다. 기록이 없는 달이라도 다른 달로
               넘어갈 수단은 남아 있어야 한다. -->
          <AsyncState
            :empty="props.monthlyData.length === 0"
            :empty-title="`${heading} 기록 없음`"
            empty-hint="다른 달 선택, 또는 경기 결과 저장 후 표 표시"
          >
          <!-- 평소에는 스크롤을 페이지가 한다. 그래야 위쪽 표제 줄이 함께
               밀려 올라가고, 열 제목만 화면 맨 위에 남는다.
               좁은 화면의 편집 모드만 표가 스스로 옆으로 민다 — 입력칸이 붙어
               최소 폭이 화면보다 넓어지는데, 페이지째 밀리면 저장 버튼까지
               화면 밖으로 나간다. 회원 열은 sticky 라 그대로 남는다. (3-3) -->
          <!-- NET 은 낮을수록 좋다. 색(파랑 +, 주황 −)만으로 읽히지 않게 표 바로 위에 적는다.
               상세 단서는 숨은 열이 있는 폭(compact)·읽기 모드에서만 둔다. -->
          <p class="mb-1 px-2 text-sm text-muted-foreground">NET 스코어 = 스코어 − 당월 핸디 · 낮을수록 좋음</p>
          <p v-if="compact && !isEditing" class="mb-2 px-2 text-sm text-muted-foreground">
            이름을 누르면 숨은 열까지 상세 표시<template v-if="attendanceMemberId"> · 내 이름은 참석 창 열림</template>
          </p>
          <Table
            :scroll="tableScrolls"
            class="text-sm [&_thead_th]:bg-muted [&_thead_th]:text-foreground"
            :caption="`${heading} 회원별 핸디·스코어 기록`"
          >
            <TableHeader>
              <TableRow>
                <!-- 가로 스크롤에도 회원명은 남는다 — 어느 행인지 잃지 않도록 -->
                <TableHead class="font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-card">회원</TableHead>
                <TableHead v-if="isFutureMonth" class="font-bold text-center whitespace-nowrap">참석</TableHead>
                <TableHead class="font-bold text-center hidden sm:table-cell">기준 핸디</TableHead>
                <!-- 모바일 14px 에서 열이 가로로 넘치므로 당월 핸디는 읽기 모드의 좁은 폭에서 숨기고
                     상세 창에 둔다. 편집 모드는 표가 스스로 스크롤하므로 그대로 둔다. -->
                <TableHead :class="cn('font-bold text-center whitespace-nowrap', !isEditing && 'hidden sm:table-cell')">당월 핸디</TableHead>
                <TableHead class="font-bold text-center hidden sm:table-cell">차월 핸디</TableHead>
                <TableHead class="font-bold text-center whitespace-nowrap">스코어</TableHead>
                <TableHead class="font-bold text-center whitespace-nowrap">NET 스코어</TableHead>
                <TableHead class="font-bold text-center hidden md:table-cell">결과 그룹</TableHead>
                <TableHead class="font-bold text-center whitespace-nowrap">결과</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in sortedMonthlyData"
                :key="row.member_id"
                :class="cn('group', row.member_id === winnerRow?.member_id
                  ? 'bg-primary/5 hover:bg-primary/10 transition-colors'
                  : 'hover:bg-muted/50 transition-colors')"
              >
                <!-- 고정 열은 밑을 지나가는 셀을 가리려 불투명 bg-card 를 깐다.
                     그러면 tr 의 반투명 강조·hover 틴트가 이 열에서만 사라지므로
                     isolate + 음수 z-index ::before 로 다시 얹는다.
                     relative 는 넣지 말 것 — cn 이 sticky 와 같은 그룹으로 보고 덮어쓴다. -->
                <TableCell
                  :class="cn('font-medium whitespace-nowrap sticky left-0 z-10 bg-card isolate',
                    'before:absolute before:inset-0 before:-z-10 before:transition-colors',
                    row.member_id === winnerRow?.member_id
                      ? 'before:bg-primary/5 group-hover:before:bg-primary/10'
                      : 'group-hover:before:bg-muted/50')"
                >
                  <!-- 편집 중에는 열지 않는다. 상세는 저장된 값을 보여주므로
                       아직 저장하지 않은 입력값과 어긋나 보인다. -->
                  <!-- 본인 줄은 상세 대신 참석 창을 연다. 참석 창은 저장된 값만
                       다루므로 편집 중에도 연다. -->
                  <button
                    v-if="row.member_id === attendanceMemberId"
                    type="button"
                    aria-haspopup="dialog"
                    :aria-label="`${row.member_name} 참석 여부 바꾸기`"
                    :class="ATTENDANCE_BUTTON_CLASS"
                    @click="emit('open-attendance')"
                  >{{ row.member_name }}<CalendarCheck class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /></button>
                  <RowDetailButton v-else-if="!isEditing" :label="row.member_name" :enabled="compact" :class="compact ? '-my-2 sm:my-0' : undefined" @click="openDetail(row)">{{ row.member_name }}</RowDetailButton>
                  <template v-else>{{ row.member_name }}</template>
                </TableCell>

                <!-- 참석여부 (미래월만) -->
                <TableCell v-if="isFutureMonth" class="text-center">
                  <button
                    v-if="row.member_id === attendanceMemberId"
                    type="button"
                    aria-haspopup="dialog"
                    :aria-label="`참석 여부 ${attendanceLabel(row).text} — 바꾸기`"
                    :class="cn(ATTENDANCE_BUTTON_CLASS, 'text-sm font-semibold whitespace-nowrap', attendanceLabel(row).class)"
                    @click="emit('open-attendance')"
                  >{{ attendanceLabel(row).text }}</button>
                  <span v-else :class="cn('text-sm font-semibold whitespace-nowrap', attendanceLabel(row).class)">{{ attendanceLabel(row).text }}</span>
                </TableCell>

                <TableCell class="text-center font-mono hidden sm:table-cell">{{ row.std_hc }}</TableCell>
                <TableCell :class="cn('text-center font-mono', !isEditing && 'hidden sm:table-cell')">
                  <template v-if="row.app_hc !== null">{{ row.app_hc }}</template>
                  <span v-else class="text-muted-foreground" title="직전 달 차월 핸디 미정">-</span>
                </TableCell>
                <TableCell class="text-center font-mono hidden sm:table-cell">
                  <template v-if="isEditing && localNextHc[row.member_id] != null">{{ localNextHc[row.member_id] }}</template>
                  <template v-else-if="!isEditing && row.attended && row.score !== null">{{ row.next_hc }}</template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- Score -->
                <!-- 편집 칸이 든 셀은 여백을 줄인다 — 칸 높이(sm 이상 h-7, 모바일은 터치용 h-11)와 기본 여백(py-2)이
                     겹치면 그 줄만 연간 랭킹 표보다 한참 두꺼워진다. -->
                <TableCell :class="cn('text-center font-mono', isEditing && 'py-1')">
                  <template v-if="isEditing">
                    <!-- type="number" 는 모바일에서 스피너가 붙어 스크롤 한 번에
                         값이 바뀐다. 숫자 자판은 inputmode 로 부르고 스피너는 뗀다. -->
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="-?[0-9]*"
                      maxlength="4"
                      :value="localScores[row.member_id] ?? ''"
                      placeholder="-"
                      :aria-label="`${row.member_name} 스코어`"
                      :aria-invalid="isScoreInvalid(row.member_id) || undefined"
                      :class="cn('h-11 sm:h-7 w-16 text-center border rounded px-1 py-0 text-base sm:text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        isScoreInvalid(row.member_id)
                          ? 'border-destructive text-destructive focus-visible:ring-destructive'
                          : 'border-input focus-visible:ring-ring')"
                      @input="(e) => { localScores[row.member_id] = (e.target as HTMLInputElement).value; }"
                    />
                  </template>
                  <template v-else-if="row.attended && row.score !== null">{{ row.score }}</template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- Net Score -->
                <TableCell class="text-center font-mono">
                  <template v-if="isEditing">
                    <span
                      v-if="getLocalNet(row)"
                      :class="getLocalNet(row).startsWith('-')
                        ? 'text-net-minus'
                        : 'text-net-plus font-semibold'"
                    >
                      {{ getLocalNet(row) }}
                    </span>
                    <span v-else class="text-muted-foreground">-</span>
                  </template>
                  <template v-else-if="row.attended && row.net_score !== null">
                    <span
                      :class="row.net_score >= 0
                        ? 'text-net-plus font-semibold'
                        : 'text-net-minus'"
                    >
                      {{ row.net_score >= 0 ? '+' : '' }}{{ row.net_score }}
                    </span>
                  </template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- 결과 Group -->
                <TableCell :class="cn('text-center hidden md:table-cell', isEditing && 'py-1')">
                  <template v-if="isEditing">
                    <select
                      :value="localGroups[row.member_id] ?? ''"
                      :aria-label="`${row.member_name} 결과 조`"
                      class="h-11 sm:h-7 w-20 text-center border border-input rounded px-1 py-0 text-base sm:text-xs bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 appearance-none cursor-pointer"
                      @change="(e) => { localGroups[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="1등조">1등조</option>
                      <option value="2등조">2등조</option>
                    </select>
                  </template>
                  <template v-else-if="row.result_group">
                    <Badge v-if="row.result_group === '1등조'" class="bg-group-first text-white border-0">1등조</Badge>
                    <Badge v-else variant="secondary">2등조</Badge>
                  </template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- 결과 -->
                <TableCell :class="cn('text-center', isEditing && 'py-1')">
                  <template v-if="isEditing">
                    <select
                      :value="localRanks[row.member_id] ?? ''"
                      :aria-label="`${row.member_name} 시상`"
                      class="h-11 sm:h-7 w-24 text-center border border-input rounded px-1 py-0 text-base sm:text-xs bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 appearance-none cursor-pointer"
                      @change="(e) => { localRanks[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="Winner">Winner</option>
                      <option value="Medalist">Medalist</option>
                      <option value="Host">Host</option>
                    </select>
                  </template>
                  <template v-else-if="isRankName(row.result_rank)">
                    <RankBadge :rank="row.result_rank" />
                    <!-- 결과 그룹 열이 숨는 폭에서는 배지에 가려 조가 사라진다 (5-5) -->
                    <span v-if="row.result_group" class="md:hidden block text-sm leading-tight text-muted-foreground mt-0.5">{{ row.result_group }}</span>
                  </template>
                  <!-- 순위 없는 회원: 작은 화면(결과 그룹 컬럼 숨김)에서만 그룹 표시 -->
                  <template v-else-if="row.result_group">
                    <Badge v-if="row.result_group === '1등조'" class="md:hidden bg-group-first text-white border-0">1등조</Badge>
                    <Badge v-else variant="secondary" class="md:hidden">2등조</Badge>
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-if="setting('handicap_notice')" class="text-sm text-muted-foreground mt-2 px-2">
            {{ setting('handicap_notice') }}
          </p>
          </AsyncState>
        </div>
      </CardContent>
    </Card>

    <!-- 회원 한 명의 그달 기록 전부 -->
    <RowDetailDialog
      v-model:open="detailOpen"
      :title="detailRow?.member_name ?? ''"
      :subtitle="heading"
    >
      <template v-if="detailRow">
        <DetailItem label="참석">
          <span :class="attendanceLabel(detailRow).class">{{ attendanceLabel(detailRow).text }}</span>
        </DetailItem>
        <DetailItem label="기준 핸디">
          <span class="font-mono">{{ detailRow.std_hc }}</span>
        </DetailItem>
        <DetailItem label="당월 핸디">
          <span v-if="detailRow.app_hc !== null" class="font-mono">{{ detailRow.app_hc }}</span>
        </DetailItem>
        <DetailItem label="차월 핸디">
          <span v-if="detailRow.attended && detailRow.score !== null && detailRow.next_hc !== null" class="font-mono">{{ detailRow.next_hc }}</span>
          <Badge v-if="isAdmin && detailRow.next_hc_mismatch" variant="outline" class="ml-1.5 border-warning-border text-warning font-normal">※ 저장값 불일치(관리자 확인 필요)</Badge>
        </DetailItem>
        <DetailItem label="스코어">
          <span v-if="detailRow.attended && detailRow.score !== null" class="font-mono">{{ detailRow.score }}</span>
        </DetailItem>
        <DetailItem label="NET 스코어">
          <span
            v-if="detailRow.attended && detailRow.net_score !== null"
            :class="cn('font-mono', detailRow.net_score >= 0 ? 'text-net-plus font-semibold' : 'text-net-minus')"
          >{{ detailRow.net_score >= 0 ? '+' : '' }}{{ detailRow.net_score }}</span>
        </DetailItem>
        <DetailItem label="결과 그룹">
          <Badge v-if="detailRow.result_group === '1등조'" class="bg-group-first text-white border-0">1등조</Badge>
          <Badge v-else-if="detailRow.result_group" variant="secondary">2등조</Badge>
        </DetailItem>
        <DetailItem label="결과">
          <RankBadge v-if="isRankName(detailRow.result_rank)" :rank="detailRow.result_rank" />
        </DetailItem>
        <!-- 연간 순위는 그달까지의 누적이다. 아직 치지 않은 달에 붙이면
             그달 성적처럼 읽힌다. -->
        <DetailItem
          v-if="detailRow.yearly_rank !== null && detailRow.attended && detailRow.score !== null"
          label="연간 순위"
        >
          {{ detailRow.yearly_rank }}위
        </DetailItem>
      </template>
    </RowDetailDialog>

    <!-- 핸디 규칙 도움말. 모임 규정표를 그대로 옮긴 것이다. 계산 로직
         (src/data/index.ts, DB recompute_next_hc) 과 어긋나면 이쪽을 고친다. -->
    <Dialog v-model:open="showHcHelp" label="핸디 규칙" content-class="sm:max-w-lg">
      <h2 class="text-base font-bold pr-8">핸디 규칙</h2>
      <div class="mt-3 space-y-4 text-sm">
        <section class="space-y-1.5">
          <h3 class="font-semibold">용어</h3>
          <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><b class="text-foreground">기준 핸디</b> — 매년 1월에 새로 정하는 그 해의 기본 핸디</li>
            <li><b class="text-foreground">당월 핸디</b> — 이달 경기에 적용하는 핸디 · NET = 스코어 − 당월 핸디</li>
            <li><b class="text-foreground">차월 핸디</b> — 이달 결과로 정해지는 다음 달의 당월 핸디</li>
            <li><b class="text-foreground">조 편성</b> — NET 이 낮은 순으로 참석자 절반이 1등조, 나머지가 2등조</li>
          </ul>
        </section>

        <section class="space-y-1.5">
          <h3 class="font-semibold">차월 핸디 정하기</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b">
                  <th class="py-1 pr-2 text-left font-semibold">직전 라운드</th>
                  <th class="py-1 pr-2 text-left font-semibold">이번 달</th>
                  <th class="py-1 text-left font-semibold">차월 핸디</th>
                </tr>
              </thead>
              <tbody class="text-muted-foreground">
                <tr class="border-b">
                  <td class="py-1 pr-2">1등조</td><td class="py-1 pr-2">1등조</td>
                  <td class="py-1 text-foreground">당월 핸디 − 1</td>
                </tr>
                <tr class="border-b">
                  <td class="py-1 pr-2">2등조</td><td class="py-1 pr-2">2등조</td>
                  <td class="py-1 text-foreground">당월 핸디 + 1</td>
                </tr>
                <tr class="border-b">
                  <td class="py-1 pr-2">1등조</td><td class="py-1 pr-2">2등조</td>
                  <td class="py-1 text-foreground">기준 핸디로 복귀</td>
                </tr>
                <tr>
                  <td class="py-1 pr-2">2등조</td><td class="py-1 pr-2">1등조</td>
                  <td class="py-1 text-foreground">기준 핸디로 복귀</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>홀수 핸디도 그대로 인정</li>
            <li>계속 1등조라 핸디가 내려가 있어도 <b class="text-foreground">단 한 번</b> 2등조에 들면 기준 핸디로 복귀 · 2등조도 반대로 동일</li>
            <li><b class="text-foreground">기준 핸디로 복귀하면 모든 것을 초기화</b> · 당월 핸디가 기준 핸디와 같은 달(매년 1월, 기준 핸디를 새로 정한 달, 조 변경으로 복귀한 다음 달)은 직전 라운드와 견주지 않고 그 달 결과만으로 ±1</li>
            <li>"직전 라운드" = 마지막으로 조에 편성된 달 · 불참한 달은 건너뛰고 비교</li>
            <li>불참한 달은 당월 핸디를 그대로 다음 달로 이월</li>
          </ul>
        </section>
      </div>
    </Dialog>

    <!-- 저장 전 요약·입력 폐기 확인 -->
    <Dialog v-model:open="confirmDlg.open" :label="confirmDlg.title" content-class="sm:max-w-sm">
      <div class="px-1 pt-1 space-y-3">
        <h2 class="text-base font-bold pr-8">{{ confirmDlg.title }}</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="line in confirmDlg.lines" :key="line">{{ line }}</li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" @click="confirmDlg.open = false">{{ confirmDlg.cancelLabel }}</Button>
          <Button type="button" size="sm" @click="acceptConfirm">{{ confirmDlg.okLabel }}</Button>
        </div>
      </div>
    </Dialog>

    <!-- 잠금 해제 사유 (4-2) -->
    <Dialog v-model:open="unlockOpen" label="잠금 해제 후 수정" content-class="sm:max-w-sm">
      <form class="px-1 pt-1 space-y-3" @submit.prevent="confirmUnlock">
        <h2 class="text-base font-bold">잠금 해제 후 수정</h2>
        <p class="text-sm">확정된 기록 · 수정 사유 입력 필요</p>
        <p class="text-xs text-muted-foreground">
          사유는 저장 시 모임 메모에 <span class="whitespace-nowrap">[날짜 수정: 사유]</span> 로 누적
        </p>
        <div class="space-y-1">
          <label for="unlock-reason" class="text-sm font-medium">수정 사유</label>
          <textarea
            id="unlock-reason"
            v-model="unlockInput"
            rows="3"
            maxlength="200"
            class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            placeholder="예: 홍길동 스코어 오기 정정"
            :aria-invalid="!!unlockError"
            :aria-describedby="unlockError ? 'unlock-error' : undefined"
          />
          <p v-if="unlockError" id="unlock-error" class="text-sm text-destructive" role="alert">{{ unlockError }}</p>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" @click="unlockOpen = false">취소</Button>
          <Button type="submit" size="sm">잠금 해제</Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
