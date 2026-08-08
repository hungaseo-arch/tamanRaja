<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Trophy, Medal, Home, ArrowUp, ArrowDown, ChevronsUpDown, Download } from 'lucide-vue-next';
import { getYearlySummary, MEETINGS, MONTHLY_HANDICAPS } from '@/data';
import type { YearlySummary } from '@/lib';
import { cn } from '@/lib/utils';
import { useRecordExport } from '@/composables/useRecordExport';
import AsyncState from '@/components/ui/AsyncState.vue';
import Button from '@/components/ui/Button.vue';
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

// ── 엑셀(CSV) 다운로드 ────────────────────────────────────────────────────────
// 파일에는 화면에 보이는 그대로를 담는다 — 선택한 연도·최소 참석 기준·정렬 순서.
// 여기서 다시 집계하면 화면과 파일이 어긋나 어느 쪽이 맞는지 알 수 없게 된다.
const { exportYearlyRanking } = useRecordExport();

function handleExport(): void {
  const rows = tableRows.value
    .filter((e) => e.row !== null)
    .map((e) => ({
      rank: e.rank,
      member_name: e.row!.member_name,
      attended_count: e.row!.attended_count,
      std_hc: stdHcMap.value.get(e.row!.member_id) ?? null,
      avg_net_score: e.row!.avg_net_score,
      avg_score: e.row!.avg_score,
      winner_count: e.row!.winner_count,
      medalist_count: e.row!.medalist_count,
      host_count: e.row!.host_count,
    }));
  exportYearlyRanking(selectedYear.value, rows, minRoundsNum.value);
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank === 4) return '🏅';
  return `${rank}위`;
}

// 고정(sticky) 열은 밑으로 지나가는 셀을 가려야 하므로 불투명한 bg-card 를 깐다.
// 그러면 tr 에 걸린 반투명 강조·hover 틴트가 이 두 열에서만 사라져 왼쪽에 흰
// 홈이 생긴다. isolate + 음수 z-index ::before 로 셀 배경 위·글자 아래에 같은
// 틴트를 다시 얹어 맞춘다. (tr 쪽 클래스와 색을 함께 유지할 것)
// relative 는 넣지 말 것 — cn(tailwind-merge)이 sticky 와 같은 그룹으로 보고
// 뒤엣것만 남겨 고정이 통째로 풀린다. isolate 만으로 ::before 의 -z-10 이 먹는다.
const STICKY_BASE = 'sticky z-10 bg-card isolate before:absolute before:inset-0 before:-z-10 before:transition-colors';
function stickyTint(rank: number | null): string {
  if (rank === null) return 'group-hover:before:bg-muted/50';
  if (rank <= 4) return 'before:bg-primary/5 group-hover:before:bg-primary/10';
  return 'group-hover:before:bg-muted/50';
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
        <!-- 좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
        <Button
          variant="outline"
          size="sm"
          class="h-8 px-2 shrink-0 gap-1 text-xs"
          :title="`${selectedYear}년 연간 랭킹 엑셀(CSV) 다운로드`"
          :aria-label="`${selectedYear}년 연간 랭킹 엑셀 다운로드`"
          @click="handleExport"
        >
          <Download class="w-3.5 h-3.5" aria-hidden="true" />
          <span class="hidden sm:inline">엑셀</span>
        </Button>
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
                  : 'text-orange-700 dark:text-orange-400'"
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
          <!-- Table 컴포넌트가 이미 스크롤 컨테이너다 (이중 스크롤 방지) -->
          <!-- 기록이 하나도 없으면 연도 목록 자체가 비어 selectedYear 도 빈 값이다.
               그대로 끼우면 "년 기록이 없습니다" 가 된다. -->
          <AsyncState
            :empty="summary.length === 0"
            :empty-title="selectedYear ? `${selectedYear}년 기록이 없습니다` : '기록이 없습니다'"
            empty-hint="경기 결과가 저장되면 이 표에 순위가 나타납니다."
          >
          <div class="h-full min-h-0 mt-4">
            <Table :caption="`${selectedYear}년 연간 랭킹 — 평균 Net 낮은 순, ${minRoundsNum}회 이상 참석자 대상`">
              <TableHeader>
                <TableRow>
                  <!-- 가로 스크롤에도 순위·회원은 남는다.
                       순위 열 폭은 내부 w-10 + 좌우 px-2 로 정확히 56px 고정이고,
                       회원 열의 left-14(=56px)가 거기에 맞춰져 있다. 표 셀의
                       width/min-width 는 auto 레이아웃에서 무시될 수 있어(실측 45px)
                       내용 폭으로 못박았다. 셋 중 하나를 바꾸면 나머지도 바꿀 것. -->
                  <TableHead class="font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-card px-2" scope="col">
                    <div class="w-10">순위</div>
                  </TableHead>
                  <TableHead class="font-bold text-foreground whitespace-nowrap sticky left-14 z-30 bg-card" scope="col">회원</TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap p-0"
                    scope="col"
                    :aria-sort="sortAriaSort('attended_count')"
                  >
                    <!-- 정렬은 버튼이어야 한다. th 에 @click 만 달면 마우스로만
                         쓸 수 있고 Tab 으로는 닿지도 않는다. (P2-1) -->
                    <button
                      type="button"
                      class="w-full h-full px-2 py-2.5 inline-flex items-center justify-center gap-1 select-none hover:text-primary"
                      :aria-label="`참석 기준으로 정렬`"
                      @click="setSort('attended_count')"
                    >
                      참석
                      <component
                        :is="sortKey !== 'attended_count' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'attended_count' ? 'text-primary' : 'opacity-30'"
                        aria-hidden="true"
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap hidden sm:table-cell p-0"
                    scope="col"
                    :aria-sort="sortAriaSort('std_hc')"
                  >
                    <!-- 정렬은 버튼이어야 한다. th 에 @click 만 달면 마우스로만
                         쓸 수 있고 Tab 으로는 닿지도 않는다. (P2-1) -->
                    <button
                      type="button"
                      class="w-full h-full px-2 py-2.5 inline-flex items-center justify-center gap-1 select-none hover:text-primary"
                      :aria-label="`기준 핸디 기준으로 정렬`"
                      @click="setSort('std_hc')"
                    >
                      기준 핸디
                      <component
                        :is="sortKey !== 'std_hc' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'std_hc' ? 'text-primary' : 'opacity-30'"
                        aria-hidden="true"
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap p-0"
                    scope="col"
                    :aria-sort="sortAriaSort('avg_net_score')"
                  >
                    <!-- 정렬은 버튼이어야 한다. th 에 @click 만 달면 마우스로만
                         쓸 수 있고 Tab 으로는 닿지도 않는다. (P2-1) -->
                    <button
                      type="button"
                      class="w-full h-full px-2 py-2.5 inline-flex items-center justify-center gap-1 select-none hover:text-primary"
                      :aria-label="`평균 Net 기준으로 정렬`"
                      @click="setSort('avg_net_score')"
                    >
                      평균 Net
                      <component
                        :is="sortKey !== 'avg_net_score' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'avg_net_score' ? 'text-primary' : 'opacity-30'"
                        aria-hidden="true"
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap p-0"
                    scope="col"
                    :aria-sort="sortAriaSort('avg_score')"
                  >
                    <!-- 정렬은 버튼이어야 한다. th 에 @click 만 달면 마우스로만
                         쓸 수 있고 Tab 으로는 닿지도 않는다. (P2-1) -->
                    <button
                      type="button"
                      class="w-full h-full px-2 py-2.5 inline-flex items-center justify-center gap-1 select-none hover:text-primary"
                      :aria-label="`평균 스코어 기준으로 정렬`"
                      @click="setSort('avg_score')"
                    >
                      평균 스코어
                      <component
                        :is="sortKey !== 'avg_score' ? ChevronsUpDown : sortAsc ? ArrowUp : ArrowDown"
                        class="w-3 h-3"
                        :class="sortKey === 'avg_score' ? 'text-primary' : 'opacity-30'"
                        aria-hidden="true"
                      />
                    </button>
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
                    :class="cn('group', entry.rank === null
                      ? 'text-muted-foreground hover:bg-muted/50 transition-colors'
                      : entry.rank <= 4
                        ? 'bg-primary/5 hover:bg-primary/10 transition-colors font-semibold'
                        : 'hover:bg-muted/50 transition-colors')"
                  >
                    <TableCell :class="cn('font-medium whitespace-nowrap px-2 left-0', STICKY_BASE, stickyTint(entry.rank))">
                      <!-- w-10 + 좌우 px-2 = 56px. 회원 열의 left-14 가 여기에 맞춰져 있다. -->
                      <div class="w-10">
                        <template v-if="entry.rank !== null">{{ rankLabel(entry.rank) }}</template>
                        <span v-else aria-label="순위 없음">-</span>
                      </div>
                    </TableCell>
                    <TableCell :class="cn('font-medium whitespace-nowrap left-14', STICKY_BASE, stickyTint(entry.rank))">{{ entry.row.member_name }}</TableCell>
                    <TableCell class="text-center whitespace-nowrap">{{ entry.row.attended_count }}회</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ stdHcMap.get(entry.row.member_id) ?? '-' }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <span
                        :class="entry.rank === null
                          ? ''
                          : entry.row.avg_net_score >= 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-orange-700 dark:text-orange-400'"
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
                      <span v-if="entry.row.winner_count" class="text-yellow-700 font-bold">{{ entry.row.winner_count }}회</span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                      <span v-if="entry.row.medalist_count" class="text-muted-foreground font-bold">{{ entry.row.medalist_count }}회</span>
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
          </AsyncState>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
