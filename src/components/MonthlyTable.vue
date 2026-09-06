<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { CircleHelp, Download } from 'lucide-vue-next';
import type { MonthlyRow, ResultRank, ResultGroup } from '@/lib';
import { formatDate, formatMeetingHeading, formatYearMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isRankName } from '@/lib/rank';
import { GOLF_COURSES, setting } from '@/data';
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
}

interface Props {
  yearMonth: string;
  monthlyData: MonthlyRow[];
  meetingDate: string;
  courseName: string;
  isFutureMonth?: boolean;
  isEditable?: boolean;
  isManager?: boolean;
  selectedMonth: string;
  monthOptions: SelectOption[];
  manualDate: string;
  manualCourse: string;
  /**
   * 부모의 저장 진행 상태. 'saving' → 'idle' 로 끝나야 편집 모드를 닫는다.
   * 'error' 로 끝나면 입력값을 그대로 둔 채 편집 모드를 유지한다 —
   * 저장에 실패했는데 화면이 읽기 모드로 돌아가면 방금 친 값이 사라진 것처럼 보인다.
   */
  saveState?: 'idle' | 'saving' | 'error';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'save', data: SavePayload): void;
  (e: 'update:selectedMonth', value: string): void;
  (e: 'update:manualDate', value: string): void;
  (e: 'update:manualCourse', value: string): void;
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
const canManage = computed(() => (props.isEditable ?? props.isFutureMonth ?? false) && (props.isManager ?? false));

function clearLocal(): void {
  [localScores, localGroups, localRanks, localNextHc].forEach((map) =>
    Object.keys(map).forEach((k) => delete map[k]),
  );
  Object.keys(localAttendance).forEach((k) => delete localAttendance[k]);
}

watch(
  () => [props.yearMonth, props.isFutureMonth, canManage.value] as const,
  ([ym, future, manage]) => {
    isEditing.value = (future ?? false) && manage; // 미래월 + 편집 권한
    clearLocal();
    if (future) {
      Object.assign(localAttendance, getAttendance(ym));
    }
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
  const scored = props.monthlyData
    .filter((row) => {
      // 적용 핸디가 없으면 Net 을 낼 수 없다. 0 으로 두고 계산하면 Net 이
      // 스코어와 같아져 조 편성·Winner 판정까지 어긋나므로 아예 뺀다.
      if (row.app_hc === null) return false;
      const val = localScores[row.member_id];
      return val !== undefined && val !== '' && !isNaN(parseInt(val, 10));
    })
    .map((row) => {
      const appHc = row.app_hc as number;
      const score = parseInt(localScores[row.member_id], 10);
      return {
        member_id: row.member_id,
        std_hc: row.std_hc,
        app_hc: appHc,
        prev_result_group: row.prev_result_group,
        score,
        netScore: score - appHc,
      };
    })
    .sort((a, b) => a.netScore - b.netScore);

  // 점수 없는 회원의 자동 계산값 초기화
  for (const row of props.monthlyData) {
    if (!localScores[row.member_id]) {
      delete localGroups[row.member_id];
      delete localNextHc[row.member_id];
      delete localRanks[row.member_id];
    }
  }

  if (scored.length === 0) return;

  const topCount = Math.floor(scored.length / 2);

  scored.forEach((row, idx) => {
    const group: ResultGroup = idx < topCount ? '1등조' : '2등조';
    localGroups[row.member_id] = group;

    // 차월핸디:
    //  - 당월핸디가 기준핸디와 같은 달(1월·기준핸디 재설정·조 변경 복귀 직후)은
    //    초기화 상태라 직전 조와 견주지 않고 당월 결과만으로 ±1
    //  - 그 외 직전 라운드와 같은 조 → 1등조 app-1 / 2등조 app+1
    //  - 조가 바뀐 경우 → 기준핸디(std_hc)로 복귀
    const fresh = row.app_hc === row.std_hc;
    const adjust = group === '1등조' ? row.app_hc - 1 : row.app_hc + 1;
    localNextHc[row.member_id] =
      fresh || (row.prev_result_group !== null && row.prev_result_group === group)
        ? adjust
        : row.std_hc;
  });

  // Winner: 최저 Net Score
  const winnerRow = scored[0];
  // Host: 최고 Net Score (Winner와 다른 경우)
  const hostRow = scored[scored.length - 1].member_id !== winnerRow.member_id
    ? scored[scored.length - 1]
    : undefined;
  // Medalist: 최저 Raw Score (Winner 제외)
  const byRaw = [...scored].sort((a, b) => a.score - b.score);
  const medalistRow = byRaw.find((r) => r.member_id !== winnerRow.member_id);

  for (const row of scored) {
    if (row.member_id === winnerRow.member_id) {
      localRanks[row.member_id] = 'Winner';
    } else if (row.member_id === medalistRow?.member_id) {
      localRanks[row.member_id] = 'Medalist';
    } else if (row.member_id === hostRow?.member_id) {
      localRanks[row.member_id] = 'Host';
    } else {
      localRanks[row.member_id] = '';
    }
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
  if (props.saveState === 'saving') return;
  if (invalidScoreNames.value.length > 0) {
    validationError.value =
      `스코어는 ${SCORE_MIN}~${SCORE_MAX} 사이의 정수여야 합니다 — ${invalidScoreNames.value.join(', ')}`;
    return;
  }
  validationError.value = null;
  emit('save', {
    scores: { ...localScores },
    groups: { ...localGroups },
    ranks: { ...localRanks },
    attendance: { ...localAttendance },
  });
}

// 저장이 실제로 끝난 뒤에만 편집 모드를 닫는다.
watch(
  () => props.saveState,
  (now, before) => {
    if (before === 'saving' && now === 'idle') isEditing.value = false;
  },
);

// ── 줄 상세 (디스클로저) ─────────────────────────────────────────────────────
// 좁은 화면에서는 기준 핸디·차월 핸디·결과 그룹 열이 숨는다. 회원 이름을
// 누르면 그 회원의 값을 숨은 것까지 모아 보여 준다.
// md 부터는 열이 전부 보여 창을 열어도 표와 같은 내용이라 아예 열지 않는다.
// detailRow 는 창을 닫아도 비우지 않는다 — 닫히는 동안 내용이 사라지면
// 사라지는 애니메이션이 빈 상자로 보인다.
const compact = useCompactTable('md');

// 핸디 규칙 도움말. 차월 핸디 열은 좁은 화면에서 숨겨지므로 열 제목이 아니라
// 항상 보이는 컨트롤 줄에 둔다.
const showHcHelp = ref(false);
const detailRow = ref<MonthlyRow | null>(null);
const detailOpen = ref(false);

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
    if (v === null) return { text: '미정', class: 'text-yellow-700' };
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
        <CardTitle as="h1" class="px-0 min-w-0 truncate text-lg font-bold text-foreground">
          {{ headingDate }}
          <span v-if="headingCourse" class="text-sm font-medium text-muted-foreground">— {{ headingCourse }}</span>
        </CardTitle>

        <!-- 그달 요약. 제목과 컨트롤 사이 가운데에 놓는다(mx-auto 가 남는 폭을
             양쪽으로 나눠 가진다). 좁은 화면에서는 줄이 접혀 제목 아래로
             내려가고, Winner·Medalist 는 sm 미만에서 숨는다. -->
        <div v-if="isFutureMonth" class="mx-auto flex items-center gap-1.5 text-xs">
          <span class="font-medium text-muted-foreground whitespace-nowrap">참석 예정 인원</span>
          <span class="font-bold">{{ futureAttendedCount }}명</span>
        </div>
        <div v-else class="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-medium text-muted-foreground whitespace-nowrap">참석인원</span>
            <span class="font-bold">{{ stats.attendedCount }}명</span>
          </div>
          <div class="hidden sm:flex items-center gap-1.5 min-w-0">
            <RankBadge rank="Winner" class="shrink-0" />
            <span class="font-semibold truncate">{{ stats.winnerName }}</span>
          </div>
          <div class="hidden sm:flex items-center gap-1.5 min-w-0">
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
              class="h-8 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto sm:flex-initial"
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
            />
            <input
              v-if="courseChoice === NEW_COURSE"
              ref="newCourseInput"
              type="text"
              v-model="newCourseName"
              aria-label="새 골프장명"
              placeholder="새 골프장명"
              class="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0 sm:flex-initial sm:w-28"
            />
          </template>
          <!-- 저장 중 재클릭은 meeting_results 를 지웠다 다시 넣는 과정을
               겹쳐 돌려 기록이 어긋날 수 있다. 끝날 때까지 잠근다. -->
          <Button
            v-if="isEditing"
            size="xs"
            class="shrink-0"
            :disabled="props.saveState === 'saving'"
            @click="handleSave"
          >{{ props.saveState === 'saving' ? '저장 중...' : '저장' }}</Button>
          <Button v-else size="xs" variant="outline" class="shrink-0" @click="enterEdit">수정</Button>
        </template>

        <!-- 월 선택. 연간 랭킹의 연도 선택과 같은 자리·같은 배색이다 -->
        <label for="monthly-month" class="sr-only">조회할 월</label>
        <Select
          id="monthly-month"
          v-model="localSelectedMonth"
          :options="monthOptions"
          placeholder="월 선택"
          size="xs"
          class="w-24 shrink-0"
        />

        <!-- 엑셀(CSV) 다운로드 — 해당 연도 전체 기록.
             좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 gap-1"
          :title="`${exportYear}년 전체 기록 엑셀(CSV) 다운로드`"
          :aria-label="`${exportYear}년 전체 기록 엑셀 다운로드`"
          @click="exportYearlyRecords(props.selectedMonth)"
        >
          <Download class="w-3.5 h-3.5" aria-hidden="true" />
          <span class="hidden sm:inline">엑셀</span>
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
          <CircleHelp class="w-3.5 h-3.5" aria-hidden="true" />
          <span class="hidden sm:inline">핸디 규칙</span>
        </Button>
        </div>
      </div>

      <!-- 저장을 막은 이유는 저장 버튼 가까이 둔다. 표 아래에 있으면 화면이 긴
           달에서는 눌러 놓고 아무 반응이 없는 것처럼 보인다. -->
      <p v-if="validationError" class="text-xs text-destructive" role="alert">
        {{ validationError }}
      </p>
    </div>

    <!-- 월별 기록 테이블 -->
    <!-- 카드가 표를 감싼다: 표는 좁은 화면에서 줄일 수 없는 최소 폭이 있고
         가로 스크롤은 main 이 맡는다. 카드 폭을 그 최소 폭(w-min)에 맞춰야
         테두리·배경이 표 오른쪽 끝까지 따라간다. 넓은 화면에서는
         min-w-full 이 이겨서 예전과 똑같이 폭을 가득 채운다. -->
    <Card class="w-min min-w-full">
      <CardContent class="px-2 sm:px-6">
        <div class="pt-4">
          <!-- 위의 월 선택·엑셀은 밖에 둔다. 기록이 없는 달이라도 다른 달로
               넘어갈 수단은 남아 있어야 한다. -->
          <AsyncState
            :empty="props.monthlyData.length === 0"
            :empty-title="`${heading} 기록이 없습니다`"
            empty-hint="다른 달을 고르거나, 경기 결과가 저장되면 여기에 표가 나타납니다."
          >
          <!-- scroll=false: 스크롤은 페이지가 한다. 그래야 위쪽 표제 줄이 함께
               밀려 올라가고, 열 제목만 화면 맨 위에 남는다. -->
          <Table
            :scroll="false"
            class="text-xs sm:text-sm [&_thead_th]:bg-muted [&_thead_th]:text-foreground"
            :caption="`${heading} 회원별 핸디·스코어 기록`"
          >
            <TableHeader>
              <TableRow>
                <!-- 가로 스크롤에도 회원명은 남는다 — 어느 행인지 잃지 않도록 -->
                <TableHead class="font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-card">회원</TableHead>
                <TableHead v-if="isFutureMonth" class="font-bold text-center whitespace-nowrap">참석</TableHead>
                <TableHead class="font-bold text-center hidden sm:table-cell">기준 핸디</TableHead>
                <TableHead class="font-bold text-center whitespace-nowrap">당월 핸디</TableHead>
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
                  <RowDetailButton v-if="!isEditing" :label="row.member_name" :enabled="compact" @click="openDetail(row)">{{ row.member_name }}</RowDetailButton>
                  <template v-else>{{ row.member_name }}</template>
                </TableCell>

                <!-- 참석여부 (미래월만) -->
                <TableCell v-if="isFutureMonth" class="text-center">
                  <span :class="cn('text-xs font-semibold whitespace-nowrap', attendanceLabel(row).class)">{{ attendanceLabel(row).text }}</span>
                </TableCell>

                <TableCell class="text-center font-mono hidden sm:table-cell">{{ row.std_hc }}</TableCell>
                <TableCell class="text-center font-mono">
                  <template v-if="row.app_hc !== null">{{ row.app_hc }}</template>
                  <span v-else class="text-muted-foreground" title="직전 달 차월 핸디가 아직 정해지지 않았습니다">-</span>
                </TableCell>
                <TableCell class="text-center font-mono hidden sm:table-cell">
                  <template v-if="isEditing && localNextHc[row.member_id] != null">{{ localNextHc[row.member_id] }}</template>
                  <template v-else-if="!isEditing && row.attended && row.score !== null">{{ row.next_hc }}</template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- Score -->
                <!-- 편집 칸이 든 셀은 여백을 줄인다 — 칸 높이(h-7)와 기본 여백(py-2)이
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
                      :class="cn('h-7 w-16 text-center border rounded px-1 py-0 text-sm bg-background focus:outline-none focus:ring-1',
                        isScoreInvalid(row.member_id)
                          ? 'border-destructive text-destructive focus:ring-destructive'
                          : 'border-input focus:ring-ring')"
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
                        ? 'text-orange-700'
                        : 'text-blue-600 font-semibold'"
                    >
                      {{ getLocalNet(row) }}
                    </span>
                    <span v-else class="text-muted-foreground">-</span>
                  </template>
                  <template v-else-if="row.attended && row.net_score !== null">
                    <span
                      :class="row.net_score >= 0
                        ? 'text-blue-600 font-semibold'
                        : 'text-orange-700'"
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
                      class="h-7 w-20 text-center border border-input rounded px-1 py-0 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                      @change="(e) => { localGroups[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="1등조">1등조</option>
                      <option value="2등조">2등조</option>
                    </select>
                  </template>
                  <template v-else-if="row.result_group">
                    <Badge v-if="row.result_group === '1등조'" class="bg-blue-600 text-white border-0 hover:bg-blue-700">1등조</Badge>
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
                      class="h-7 w-24 text-center border border-input rounded px-1 py-0 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
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
                  </template>
                  <!-- 순위 없는 회원: 작은 화면(결과 그룹 컬럼 숨김)에서만 그룹 표시 -->
                  <template v-else-if="row.result_group">
                    <Badge v-if="row.result_group === '1등조'" class="md:hidden bg-blue-600 text-white border-0 hover:bg-blue-700">1등조</Badge>
                    <Badge v-else variant="secondary" class="md:hidden">2등조</Badge>
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-if="setting('handicap_notice')" class="text-xs text-muted-foreground mt-2 px-2">
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
        </DetailItem>
        <DetailItem label="스코어">
          <span v-if="detailRow.attended && detailRow.score !== null" class="font-mono">{{ detailRow.score }}</span>
        </DetailItem>
        <DetailItem label="NET 스코어">
          <span
            v-if="detailRow.attended && detailRow.net_score !== null"
            :class="cn('font-mono', detailRow.net_score >= 0 ? 'text-blue-600 font-semibold' : 'text-orange-700')"
          >{{ detailRow.net_score >= 0 ? '+' : '' }}{{ detailRow.net_score }}</span>
        </DetailItem>
        <DetailItem label="결과 그룹">
          <Badge v-if="detailRow.result_group === '1등조'" class="bg-blue-600 text-white border-0">1등조</Badge>
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
            <li><b class="text-foreground">기준 핸디</b> — 매년 1월에 새로 정하는 그 해의 기본 핸디.</li>
            <li><b class="text-foreground">당월 핸디</b> — 이달 경기에 적용하는 핸디. NET = 스코어 − 당월 핸디.</li>
            <li><b class="text-foreground">차월 핸디</b> — 이달 결과로 정해지는 다음 달의 당월 핸디.</li>
            <li><b class="text-foreground">조 편성</b> — NET 이 낮은 순으로 참석자 절반이 1등조, 나머지가 2등조.</li>
          </ul>
        </section>

        <section class="space-y-1.5">
          <h3 class="font-semibold">차월 핸디 정하기</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
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
            <li>홀수 핸디도 그대로 인정한다.</li>
            <li>계속 1등조라 핸디가 내려가 있어도 <b class="text-foreground">단 한 번</b> 2등조에 들면 기준 핸디로 돌아온다. 2등조도 반대로 같다.</li>
            <li><b class="text-foreground">기준 핸디로 복귀하면 모든 것이 초기화된다.</b> 당월 핸디가 기준 핸디와 같은 달(매년 1월, 기준 핸디를 새로 정한 달, 조 변경으로 복귀한 다음 달)은 직전 라운드와 견주지 않고 그 달 결과만으로 ±1 한다.</li>
            <li>"직전 라운드"는 마지막으로 조에 편성된 달이다. 불참한 달은 건너뛰고 비교한다.</li>
            <li>불참한 달은 당월 핸디가 그대로 다음 달로 이어진다.</li>
          </ul>
        </section>
      </div>
    </Dialog>
  </div>
</template>
