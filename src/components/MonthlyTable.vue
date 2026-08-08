<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { Trophy, Medal, Home, Download } from 'lucide-vue-next';
import type { MonthlyRow, ResultRank, ResultGroup } from '@/lib';
import { formatMeetingHeading } from '@/lib/format';
import { cn } from '@/lib/utils';
import { GOLF_COURSES, setting } from '@/data';
import { useAttendance } from '@/composables/useAttendance';
import { useRecordExport } from '@/composables/useRecordExport';
import Select from '@/components/ui/Select.vue';
import type { SelectOption } from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import AsyncState from '@/components/ui/AsyncState.vue';

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
  const isResetMonth = props.monthlyData[0]?.is_reset_month ?? false;

  scored.forEach((row, idx) => {
    const group: ResultGroup = idx < topCount ? '1등조' : '2등조';
    localGroups[row.member_id] = group;

    // 차월핸디:
    //  - 리셋 월(기준핸디 재적용) 또는 전월과 같은 조 → 1등조 app-1 / 2등조 app+1
    //  - 조가 바뀐 경우 → 기준핸디(std_hc)로 리셋
    const adjust = group === '1등조' ? row.app_hc - 1 : row.app_hc + 1;
    localNextHc[row.member_id] =
      isResetMonth || (row.prev_result_group !== null && row.prev_result_group === group)
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

// 골프장이 아직 없으면 구분자('-')를 아예 붙이지 않는다 — "2026년 8월 1일 - "
// 처럼 구분자만 남는 문제 (P1-1)
const heading = computed(() =>
  formatMeetingHeading(props.selectedMonth, props.meetingDate, props.courseName),
);

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

interface RankMeta { cls: string; icon: typeof Trophy; label: string }

const RANK_META: Record<string, RankMeta> = {
  Winner:   { cls: 'bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950 border-0 shadow-md', icon: Trophy, label: 'Winner' },
  Medalist: { cls: 'bg-linear-to-r from-gray-300 to-gray-400 text-gray-900 border-0 shadow-md',      icon: Medal,  label: 'Medalist' },
  Host:     { cls: 'bg-linear-to-r from-violet-500 to-violet-600 text-white border-0 shadow-md',      icon: Home,   label: 'Host' },
};

function getRankMeta(rank: ResultRank | string): RankMeta | null {
  return rank ? RANK_META[rank] ?? null : null;
}

// ── 엑셀(CSV) 다운로드 ────────────────────────────────────────────────────────
// 결과 알림(성공·빈 데이터)은 useRecordExport 안에서 처리한다.
const { exportYearlyRecords } = useRecordExport();

const exportYear = computed(() => props.selectedMonth.substring(0, 4));
</script>

<template>
  <div class="space-y-4">
    <Card class="sticky top-20 z-20 py-0 bg-linear-to-r from-green-200 to-green-100 text-gray-900 border-0 text-xs">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 px-3 sm:px-4">
        <!-- 1. 연월 (제목) — 이 화면의 h1 이다. 사이트 이름은 헤더의 일반 텍스트다. -->
        <CardTitle as="h1" class="px-0 text-sm font-bold text-primary truncate shrink-0">
          {{ heading }}
        </CardTitle>

        <!-- 2. 참석 예정 인원 (미래월) -->
        <div v-if="isFutureMonth" class="flex items-center gap-1.5 text-xs shrink-0">
          <span class="text-muted-foreground font-medium whitespace-nowrap">참석 예정 인원</span>
          <span class="font-bold">{{ futureAttendedCount }}명</span>
        </div>

        <!-- 통계 (현재/과거월) -->
        <div v-if="!isFutureMonth" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-muted-foreground font-medium whitespace-nowrap">참석인원</span>
            <span class="font-bold">{{ stats.attendedCount }}명</span>
          </div>
          <div class="hidden lg:flex items-center gap-1.5 min-w-0">
            <Badge class="bg-yellow-500 text-white hover:bg-yellow-600 shrink-0">🏆 Winner</Badge>
            <span class="font-semibold truncate">{{ stats.winnerName }}</span>
          </div>
          <div class="hidden lg:flex items-center gap-1.5 min-w-0">
            <Badge class="bg-muted text-foreground hover:bg-muted/80 shrink-0">🥈 Medalist</Badge>
            <span class="font-semibold truncate">{{ stats.medalistName }}</span>
          </div>
        </div>

        <!-- 3. 연월 입력창 / 4. 골프장명 (미래달) / 저장·수정 (관리자) -->
        <template v-if="canManage">
          <template v-if="isFutureMonth">
            <input
              type="date"
              v-model="localManualDate"
              aria-label="모임 날짜"
              class="h-7 rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto sm:flex-initial"
            />
            <!-- 골프장은 목록에서 고르는 것이 기본이다. datalist 는 제안일 뿐이라
                 오타가 그대로 저장돼 같은 골프장이 두 개로 갈라졌다. 새 골프장은
                 '신규 추가' 를 고른 뒤 명시적으로 입력한다. -->
            <Select
              v-model="courseChoice"
              :options="courseOptions"
              placeholder="골프장 선택"
              aria-label="골프장"
              class="flex-1 min-w-0 sm:flex-initial sm:w-32"
              select-class="h-7 py-0 pr-7 text-xs"
            />
            <input
              v-if="courseChoice === NEW_COURSE"
              ref="newCourseInput"
              type="text"
              v-model="newCourseName"
              aria-label="새 골프장명"
              placeholder="새 골프장명"
              class="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0 sm:flex-initial sm:w-28"
            />
          </template>
          <div class="flex gap-2 shrink-0">
            <!-- 저장 중 재클릭은 meeting_results 를 지웠다 다시 넣는 과정을
                 겹쳐 돌려 기록이 어긋날 수 있다. 끝날 때까지 잠근다. -->
            <Button
              v-if="isEditing"
              size="sm"
              class="text-xs h-7 px-2"
              :disabled="props.saveState === 'saving'"
              @click="handleSave"
            >{{ props.saveState === 'saving' ? '저장 중...' : '저장' }}</Button>
            <Button v-else size="sm" variant="outline" class="text-xs h-7 px-2" @click="enterEdit">수정</Button>
          </div>
        </template>

        <!-- 엑셀(CSV) 다운로드 — 해당 연도 전체 기록.
             좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
        <Button
          variant="outline"
          size="sm"
          class="text-xs h-7 px-2 shrink-0 ml-auto gap-1 bg-white/70 hover:bg-white"
          :title="`${exportYear}년 전체 기록 엑셀(CSV) 다운로드`"
          :aria-label="`${exportYear}년 전체 기록 엑셀 다운로드`"
          @click="exportYearlyRecords(props.selectedMonth)"
        >
          <Download class="w-3.5 h-3.5" aria-hidden="true" />
          <span class="hidden sm:inline">엑셀</span>
        </Button>

        <!-- 저장을 막은 이유는 저장 버튼 옆에 둔다. 표 아래에 있으면 화면이 긴
             달에서는 눌러 놓고 아무 반응이 없는 것처럼 보인다. -->
        <p v-if="validationError" class="w-full text-xs text-destructive" role="alert">
          {{ validationError }}
        </p>

        <!-- 월 선택 -->
        <div class="shrink-0 w-24">
          <Select
            v-model="localSelectedMonth"
            :options="monthOptions"
            placeholder="월 선택"
            aria-label="조회할 월"
            select-class="h-8 py-0 text-xs bg-green-50/60 border-green-400 text-green-900 font-semibold focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>
    </Card>

    <!-- 월별 기록 테이블 -->
    <Card>
      <CardContent>
        <!-- Table 컴포넌트가 이미 스크롤 컨테이너다. 여기서 또 감싸면 이중 스크롤. -->
        <div class="mt-4">
          <!-- 위의 월 선택·엑셀은 밖에 둔다. 기록이 없는 달이라도 다른 달로
               넘어갈 수단은 남아 있어야 한다. -->
          <AsyncState
            :empty="props.monthlyData.length === 0"
            :empty-title="`${heading} 기록이 없습니다`"
            empty-hint="다른 달을 고르거나, 경기 결과가 저장되면 여기에 표가 나타납니다."
          >
          <Table :caption="`${heading} 회원별 핸디·스코어 기록`">
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
                >{{ row.member_name }}</TableCell>

                <!-- 참석여부 (미래월만) -->
                <TableCell v-if="isFutureMonth" class="text-center">
                  <span v-if="localAttendance[row.member_id] === true" class="text-xs font-semibold text-primary">참석</span>
                  <span v-else-if="localAttendance[row.member_id] === null" class="text-xs font-semibold text-yellow-700">미정</span>
                  <span v-else-if="localAttendance[row.member_id] === false" class="text-xs font-semibold text-destructive">불참</span>
                  <span v-else class="text-xs text-muted-foreground whitespace-nowrap">미응답</span>
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
                <TableCell class="text-center font-mono">
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
                      :class="cn('w-16 text-center border rounded px-1 py-0 text-sm bg-background focus:outline-none focus:ring-1',
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
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-blue-600 dark:text-blue-400 font-semibold'"
                    >
                      {{ getLocalNet(row) }}
                    </span>
                    <span v-else class="text-muted-foreground">-</span>
                  </template>
                  <template v-else-if="row.attended && row.net_score !== null">
                    <span
                      :class="row.net_score >= 0
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-orange-700 dark:text-orange-400'"
                    >
                      {{ row.net_score >= 0 ? '+' : '' }}{{ row.net_score }}
                    </span>
                  </template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- 결과 Group -->
                <TableCell class="text-center hidden md:table-cell">
                  <template v-if="isEditing">
                    <select
                      :value="localGroups[row.member_id] ?? ''"
                      :aria-label="`${row.member_name} 결과 조`"
                      class="w-20 text-center border border-input rounded px-1 py-0 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
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
                <TableCell class="text-center">
                  <template v-if="isEditing">
                    <select
                      :value="localRanks[row.member_id] ?? ''"
                      :aria-label="`${row.member_name} 시상`"
                      class="w-24 text-center border border-input rounded px-1 py-0 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                      @change="(e) => { localRanks[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="Winner">Winner</option>
                      <option value="Medalist">Medalist</option>
                      <option value="Host">Host</option>
                    </select>
                  </template>
                  <template v-else-if="getRankMeta(row.result_rank)">
                    <Badge :class="getRankMeta(row.result_rank)!.cls">
                      <component :is="getRankMeta(row.result_rank)!.icon" class="w-3 h-3 mr-1" />
                      {{ getRankMeta(row.result_rank)!.label }}
                    </Badge>
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
  </div>
</template>
