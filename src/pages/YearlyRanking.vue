<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Trophy, Medal, Home, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-vue-next';
import { getYearlySummary, MEETINGS, MONTHLY_HANDICAPS } from '@/data';
import type { YearlySummary } from '@/lib';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Select from '@/components/ui/Select.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';

const availableYears = computed(() =>
  [...new Set(MEETINGS.map((m) => m.year_month.substring(0, 4)))].sort(
    (a, b) => Number(b) - Number(a)
  )
);

const yearOptions = computed(() => availableYears.value.map((y) => ({ value: y, label: `${y}년` })));

const selectedYear = ref<string>('');

watch(
  availableYears,
  (years) => {
    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0];
    }
  },
  { immediate: true }
);

const summary = computed(() => getYearlySummary(selectedYear.value));

// ── 최소 참석 기준 (P1-3) ────────────────────────────────────────────────────
// 3회 참석자가 8회 참석자와 같은 표에서 나란히 순위를 받던 문제. 기준 미달
// 회원도 화면에서 사라지지 않고 별도 구역에 남되, 순위는 받지 않는다.
const MIN_ROUNDS_DEFAULT = '4';
const minRoundsOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `최소 ${n}회`,
}));
const minRounds = ref(MIN_ROUNDS_DEFAULT);
const minRoundsNum = computed(() => Number(minRounds.value));

const qualified = computed(() =>
  summary.value.filter((r) => r.attended_count >= minRoundsNum.value)
);
const unqualified = computed(() =>
  summary.value.filter((r) => r.attended_count < minRoundsNum.value)
);

// 순위는 정렬과 분리한다. 어떤 열로 정렬하든 순위는 항상 랭킹 기준
// (평균 Net 낮은 순, 기준 참석 충족자 한정)을 따른다.
const rankedQualified = computed(() =>
  [...qualified.value].sort((a, b) => a.avg_net_score - b.avg_net_score)
);

const rankByMember = computed(() => {
  const map = new Map<string, number>();
  rankedQualified.value.forEach((r, i) => map.set(r.member_id, i + 1));
  return map;
});

// ── 정렬 ─────────────────────────────────────────────────────────────────────
type SortKey = 'attended_count' | 'std_hc' | 'avg_net_score' | 'avg_score';
const sortKey = ref<SortKey>('avg_net_score');
const sortAsc = ref(true);

function setSort(key: SortKey): void {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value;
  else {
    sortKey.value = key;
    sortAsc.value = true; // 새 열은 항상 오름차순부터 (모든 지표가 낮을수록 좋다)
  }
}

function sortAriaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortAsc.value ? 'ascending' : 'descending';
}

const stdHcMap = computed(() => {
  const map = new Map<string, number>();
  // 기준핸디의 출처는 핸디캡 레코드이므로, 미팅뿐 아니라 핸디캡 레코드의 월까지
  // 포함해 최신 월을 잡는다. (예: 미팅 없는 7월에 새 기준핸디가 들어와도 반영)
  const latestMonth = [
    ...MEETINGS.filter((m) => m.year_month.startsWith(selectedYear.value)).map((m) => m.year_month),
    ...MONTHLY_HANDICAPS.filter((h) => h.year_month.startsWith(selectedYear.value)).map((h) => h.year_month),
  ].reduce((max, ym) => (ym > max ? ym : max), '');
  if (!latestMonth) return map;
  // 회원별로 latestMonth 이하의 가장 최근 std_hc 레코드 선택
  const latestByMember = new Map<string, { year_month: string; std_hc: number }>();
  for (const h of MONTHLY_HANDICAPS) {
    if (h.year_month > latestMonth) continue;
    const cur = latestByMember.get(h.member_id);
    if (!cur || h.year_month > cur.year_month) {
      latestByMember.set(h.member_id, { year_month: h.year_month, std_hc: h.std_hc });
    }
  }
  for (const [memberId, { std_hc }] of latestByMember) {
    map.set(memberId, std_hc);
  }
  return map;
});

function sortValue(row: YearlySummary, key: SortKey): number | null {
  // 기준핸디는 summary가 아닌 stdHcMap에서 값을 가져온다
  if (key === 'std_hc') return stdHcMap.value.get(row.member_id) ?? null;
  return row[key];
}

function sortRows(rows: YearlySummary[]): YearlySummary[] {
  const key = sortKey.value;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    // 값이 없는 회원은 정렬 방향과 무관하게 항상 마지막
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return sortAsc.value ? av - bv : bv - av;
  });
}

const sortedQualified = computed(() => sortRows(qualified.value));
const sortedUnqualified = computed(() => sortRows(unqualified.value));

// 순위권 → 구분선 → 기준 미달. 한 표 안에 두되 셀 마크업은 한 번만 쓴다.
interface TableEntry {
  divider: boolean;
  row: YearlySummary | null;
  rank: number | null;
}

const tableRows = computed<TableEntry[]>(() => {
  const out: TableEntry[] = sortedQualified.value.map((row) => ({
    divider: false,
    row,
    rank: rankByMember.value.get(row.member_id) ?? null,
  }));
  if (sortedUnqualified.value.length > 0) {
    out.push({ divider: true, row: null, rank: null });
    out.push(...sortedUnqualified.value.map((row) => ({ divider: false, row, rank: null })));
  }
  return out;
});

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank === 4) return '🏅';
  return `${rank}위`;
}
</script>

<template>
  <div class="w-full min-h-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-7xl space-y-4 h-full flex flex-col">
      <!-- 연도·기준 선택 -->
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-lg font-bold text-foreground mr-auto">연간 랭킹</h1>
        <label for="ranking-year" class="sr-only">연도 선택</label>
        <Select
          id="ranking-year"
          v-model="selectedYear"
          :options="yearOptions"
          placeholder=""
          class="w-24 shrink-0"
          select-class="h-8 text-xs"
        />
        <label for="ranking-min-rounds" class="sr-only">최소 참석 횟수</label>
        <Select
          id="ranking-min-rounds"
          v-model="minRounds"
          :options="minRoundsOptions"
          placeholder=""
          class="w-28 shrink-0"
          select-class="h-8 text-xs"
        />
      </div>

      <!-- 랭킹 기준을 화면에 명시한다 (P1-3 완료 조건) -->
      <p class="text-xs text-muted-foreground leading-relaxed">
        <strong class="text-foreground">랭킹 기준</strong> — 평균 Net(스코어 − 적용 핸디)이 낮은 순.
        {{ selectedYear }}년에 <strong class="text-foreground">{{ minRoundsNum }}회 이상</strong> 참석한
        회원에게만 순위를 부여합니다. 표의 열 제목을 눌러 정렬해도 순위는 이 기준을 따릅니다.
      </p>

      <!-- 상위 4명 하이라이트 카드 -->
      <div v-if="rankedQualified.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          v-for="(row, idx) in rankedQualified.slice(0, 4)"
          :key="row.member_id"
          :class="idx === 0
            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
            : idx === 1
              ? 'border-gray-400 bg-gray-50 dark:bg-gray-950/20'
              : idx === 2
                ? 'border-amber-700 bg-orange-50 dark:bg-orange-950/20'
                : 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'"
        >
          <CardContent class="pt-2 text-center space-y-1">
            <p class="text-xl">{{ rankLabel(idx + 1) }}</p>
            <p class="text-shadow-md font-bold">{{ row.member_name }}</p>
            <p v-if="sortKey === 'avg_score'" class="text-sm text-muted-foreground">
              평균 스코어
              <span class="font-mono font-semibold ml-1 text-purple-600 dark:text-purple-400">
                <template v-if="row.avg_score !== null">{{ row.avg_score.toFixed(1) }}</template>
                <span v-else class="text-muted-foreground">-</span>
              </span>
            </p>
            <p v-else class="text-sm text-muted-foreground">
              평균 Net
              <span
                class="font-mono font-semibold ml-1"
                :class="row.avg_net_score >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-orange-600 dark:text-orange-400'"
              >
                {{ row.avg_net_score >= 0 ? '+' : '' }}{{ row.avg_net_score.toFixed(2) }}
              </span>
            </p>
            <p class="text-sm text-muted-foreground">{{ row.attended_count }}회 참석</p>
            <div class="flex justify-center gap-1 flex-wrap pt-1">
              <Badge
                v-if="row.winner_count"
                class="bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950 border-0 text-xs whitespace-nowrap"
              >
                <Trophy class="w-3 h-3 mr-1" />Winner {{ row.winner_count }}
              </Badge>
              <Badge
                v-if="row.medalist_count"
                class="bg-linear-to-r from-gray-300 to-gray-400 text-gray-900 border-0 text-xs whitespace-nowrap"
              >
                <Medal class="w-3 h-3 mr-1" />Medalist {{ row.medalist_count }}
              </Badge>
              <Badge
                v-if="row.host_count"
                class="bg-linear-to-r from-violet-500 to-violet-600 text-white border-0 text-xs whitespace-nowrap"
              >
                <Home class="w-3 h-3 mr-1" />Host {{ row.host_count }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 전체 랭킹 테이블 -->
      <Card class="flex flex-col flex-1 min-h-0">
        <CardContent class="flex-1 overflow-hidden min-h-0">
          <div class="overflow-x-auto overflow-y-auto h-full min-h-0 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="font-bold text-foreground whitespace-nowrap" scope="col">순위</TableHead>
                  <TableHead class="font-bold text-foreground whitespace-nowrap" scope="col">회원</TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap cursor-pointer select-none hover:text-primary"
                    scope="col"
                    :aria-sort="sortAriaSort('attended_count')"
                    @click="setSort('attended_count')"
                  >
                    <div class="inline-flex items-center gap-1">
                      참석
                      <component
                        :is="sortKey !== 'attended_count' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'attended_count' ? 'text-primary' : 'opacity-30'"
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap hidden sm:table-cell cursor-pointer select-none hover:text-primary"
                    scope="col"
                    :aria-sort="sortAriaSort('std_hc')"
                    @click="setSort('std_hc')"
                  >
                    <div class="inline-flex items-center gap-1">
                      기준 핸디
                      <component
                        :is="sortKey !== 'std_hc' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'std_hc' ? 'text-primary' : 'opacity-30'"
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap cursor-pointer select-none hover:text-primary"
                    scope="col"
                    :aria-sort="sortAriaSort('avg_net_score')"
                    @click="setSort('avg_net_score')"
                  >
                    <div class="inline-flex items-center gap-1">
                      평균 Net
                      <component
                        :is="sortKey !== 'avg_net_score' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'avg_net_score' ? 'text-primary' : 'opacity-30'"
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap cursor-pointer select-none hover:text-primary"
                    scope="col"
                    :aria-sort="sortAriaSort('avg_score')"
                    @click="setSort('avg_score')"
                  >
                    <div class="inline-flex items-center gap-1">
                      평균 스코어
                      <component
                        :is="sortKey !== 'avg_score' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'avg_score' ? 'text-primary' : 'opacity-30'"
                      />
                    </div>
                  </TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell" scope="col">Winner</TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell" scope="col">Medalist</TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell" scope="col">Host</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-for="entry in tableRows" :key="entry.row?.member_id ?? '__divider'">
                  <!-- 기준 미달 구역 시작 -->
                  <TableRow v-if="entry.divider" class="bg-muted/50 hover:bg-muted/50">
                    <TableCell :colspan="9" class="text-xs text-muted-foreground py-1.5">
                      아래는 {{ minRoundsNum }}회 미만 참석으로 순위에서 제외된 회원입니다.
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-else-if="entry.row"
                    :class="entry.rank === null
                      ? 'text-muted-foreground opacity-70 hover:bg-muted/50 transition-colors'
                      : entry.rank <= 4
                        ? 'bg-primary/5 hover:bg-primary/10 transition-colors font-semibold'
                        : 'hover:bg-muted/50 transition-colors'"
                  >
                    <TableCell class="font-medium whitespace-nowrap pl-7">
                      <template v-if="entry.rank !== null">{{ rankLabel(entry.rank) }}</template>
                      <span v-else aria-label="순위 없음">-</span>
                    </TableCell>
                    <TableCell class="font-medium whitespace-nowrap">{{ entry.row.member_name }}</TableCell>
                    <TableCell class="text-center whitespace-nowrap">{{ entry.row.attended_count }}회</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ stdHcMap.get(entry.row.member_id) ?? '-' }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <span
                        :class="entry.rank === null
                          ? ''
                          : entry.row.avg_net_score >= 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-orange-600 dark:text-orange-400'"
                      >
                        {{ entry.row.avg_net_score >= 0 ? '+' : '' }}{{ entry.row.avg_net_score.toFixed(2) }}
                      </span>
                    </TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <span
                        v-if="entry.row.avg_score !== null"
                        :class="entry.rank === null ? 'font-semibold' : 'text-purple-600 dark:text-purple-400 font-semibold'"
                      >{{ entry.row.avg_score.toFixed(1) }}</span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                      <span v-if="entry.row.winner_count" class="text-yellow-600 font-bold">{{ entry.row.winner_count }}회</span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                      <span v-if="entry.row.medalist_count" class="text-gray-500 font-bold">{{ entry.row.medalist_count }}회</span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                      <span v-if="entry.row.host_count" class="text-green-600 font-bold">{{ entry.row.host_count }}회</span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
            <p class="text-xs text-muted-foreground mt-2 px-4">
              * 기준 핸디는 2026년 7월 부터 신규 적용
            </p>
          </div>
          <p v-if="summary.length === 0" class="text-center text-muted-foreground py-8">
            해당 연도의 데이터가 없습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
