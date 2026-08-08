<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Trophy, Medal, Home } from 'lucide-vue-next';
import type { MonthlyRow, ResultRank, ResultGroup } from '@/lib';
import { formatMeetingHeading } from '@/lib/format';
import { cn } from '@/lib/utils';
import { GOLF_COURSES } from '@/data';
import { useAttendance } from '@/composables/useAttendance';
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
  const score = parseInt(raw, 10);
  if (isNaN(score)) return '';
  const net = score - row.app_hc;
  return (net >= 0 ? '+' : '') + net;
}

function computeAutoFields(): void {
  const scored = props.monthlyData
    .filter((row) => {
      const val = localScores[row.member_id];
      return val !== undefined && val !== '' && !isNaN(parseInt(val, 10));
    })
    .map((row) => ({
      member_id: row.member_id,
      std_hc: row.std_hc,
      app_hc: row.app_hc,
      prev_result_group: row.prev_result_group,
      score: parseInt(localScores[row.member_id], 10),
      netScore: parseInt(localScores[row.member_id], 10) - row.app_hc,
    }))
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

watch(localScores, computeAutoFields, { deep: true });

function handleSave(): void {
  emit('save', {
    scores: { ...localScores },
    groups: { ...localGroups },
    ranks: { ...localRanks },
    attendance: { ...localAttendance },
  });
  isEditing.value = false;
}

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

const localManualCourse = computed({
  get: () => props.manualCourse,
  set: (v: string) => emit('update:manualCourse', v),
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
</script>

<template>
  <div class="space-y-4">
    <Card class="sticky top-20 z-20 py-0 bg-linear-to-r from-green-200 to-green-100 text-gray-900 border-0 text-xs">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 px-3 sm:px-4">
        <!-- 1. 연월 (제목) -->
        <CardTitle class="px-0 text-sm font-bold text-primary truncate shrink-0">
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
              class="h-7 rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto sm:flex-initial"
            />
            <input
              type="text"
              v-model="localManualCourse"
              list="golf-courses-list"
              placeholder="골프장명"
              class="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0 sm:flex-initial sm:w-28"
            />
            <datalist id="golf-courses-list">
              <option v-for="c in GOLF_COURSES" :key="c.id" :value="c.name" />
            </datalist>
          </template>
          <div class="flex gap-2 shrink-0">
            <Button v-if="isEditing" size="sm" class="text-xs h-7 px-2" @click="handleSave">저장</Button>
            <Button v-else size="sm" variant="outline" class="text-xs h-7 px-2" @click="enterEdit">수정</Button>
          </div>
        </template>

        <!-- 월 선택 -->
        <div class="shrink-0 w-24 ml-auto">
          <Select
            v-model="localSelectedMonth"
            :options="monthOptions"
            placeholder="월 선택"
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
          <Table>
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
                  <span v-else-if="localAttendance[row.member_id] === null" class="text-xs font-semibold text-yellow-600">미정</span>
                  <span v-else-if="localAttendance[row.member_id] === false" class="text-xs font-semibold text-destructive">불참</span>
                  <span v-else class="text-xs text-muted-foreground whitespace-nowrap">미응답</span>
                </TableCell>

                <TableCell class="text-center font-mono hidden sm:table-cell">{{ row.std_hc }}</TableCell>
                <TableCell class="text-center font-mono">{{ row.app_hc }}</TableCell>
                <TableCell class="text-center font-mono hidden sm:table-cell">
                  <template v-if="isEditing && localNextHc[row.member_id] != null">{{ localNextHc[row.member_id] }}</template>
                  <template v-else-if="!isEditing && row.attended && row.score !== null">{{ row.next_hc }}</template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- Score -->
                <TableCell class="text-center font-mono">
                  <template v-if="isEditing">
                    <input
                      type="number"
                      :value="localScores[row.member_id] ?? ''"
                      placeholder="-"
                      class="w-16 text-center border border-input rounded px-1 py-0 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
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
                        ? 'text-orange-600 dark:text-orange-400'
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
                        : 'text-orange-600 dark:text-orange-400'"
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
                      class="w-20 text-center border border-input rounded px-1 py-0 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                      @change="(e) => { localGroups[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="1등조">1등조</option>
                      <option value="2등조">2등조</option>
                    </select>
                  </template>
                  <template v-else-if="row.result_group">
                    <Badge v-if="row.result_group === '1등조'" class="bg-blue-500 text-white border-0 hover:bg-blue-600">1등조</Badge>
                    <Badge v-else variant="secondary">2등조</Badge>
                  </template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- 결과 -->
                <TableCell class="text-center">
                  <template v-if="isEditing">
                    <select
                      :value="localRanks[row.member_id] ?? ''"
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
                    <Badge v-if="row.result_group === '1등조'" class="md:hidden bg-blue-500 text-white border-0 hover:bg-blue-600">1등조</Badge>
                    <Badge v-else variant="secondary" class="md:hidden">2등조</Badge>
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p class="text-xs text-muted-foreground mt-2 px-2">
            * 기준 핸디는 2026년 7월 부터 신규 적용
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
