<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Trophy, Medal, Home, ArrowUp } from 'lucide-vue-next';
import { getYearlySummary, MEETINGS, MONTHLY_HANDICAPS } from '@/data';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';

const availableYears = computed(() => {
  const years = [...new Set(MEETINGS.map((m) => m.year_month.substring(0, 4)))].sort(
    (a, b) => Number(b) - Number(a)
  );
  return years.map((y) => ({ value: y, label: `${y}년` }));
});

const selectedYear = ref<string>('');

watch(
  availableYears,
  (years) => {
    if (years.length > 0 && !years.some((y) => y.value === selectedYear.value)) {
      selectedYear.value = years[0].value;
    }
  },
  { immediate: true }
);

const summary = computed(() => getYearlySummary(selectedYear.value));

type SortKey = 'std_hc' | 'avg_net_score' | 'avg_score';
const sortKey = ref<SortKey>('avg_net_score');

function setSort(key: SortKey): void {
  sortKey.value = key;
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

const sortedSummary = computed(() => {
  const arr = [...summary.value];
  const key = sortKey.value;
  arr.sort((a, b) => {
    // 기준핸디는 summary가 아닌 stdHcMap에서 값을 가져온다
    const av = key === 'std_hc' ? stdHcMap.value.get(a.member_id) ?? null : a[key];
    const bv = key === 'std_hc' ? stdHcMap.value.get(b.member_id) ?? null : b[key];
    // null 값은 항상 마지막
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  });
  return arr;
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
    <div class="container mx-auto px-4 py-2 max-w-7xl space-y-6 h-full flex flex-col">
    

      <!-- 상위 4명 하이라이트 카드 -->
      <div v-if="sortedSummary.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          v-for="(row, idx) in sortedSummary.slice(0, 4)"
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
                  <TableHead class="font-bold text-foreground whitespace-nowrap">
                    <div class="flex gap-1 flex-wrap">
                      <Badge
                        v-for="year in availableYears.slice(0, 4)"
                        :key="year.value"
                        :variant="selectedYear === year.value ? 'default' : 'outline'"
                        class="cursor-pointer"
                        @click="selectedYear = year.value"
                      >
                        {{ year.label }}
                      </Badge>
                    </div>
                  </TableHead>
                  <TableHead class="font-bold text-foreground whitespace-nowrap">회원</TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap">참석</TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap hidden sm:table-cell cursor-pointer select-none hover:text-primary"
                    @click="setSort('std_hc')"
                  >
                    <div class="inline-flex items-center gap-1">
                      기준 핸디
                      <ArrowUp class="w-3 h-3" :class="sortKey === 'std_hc' ? 'opacity-100 text-primary' : 'opacity-30'" />
                    </div>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap cursor-pointer select-none hover:text-primary"
                    @click="setSort('avg_net_score')"
                  >
                    <div class="inline-flex items-center gap-1">
                      평균 Net
                      <ArrowUp class="w-3 h-3" :class="sortKey === 'avg_net_score' ? 'opacity-100 text-primary' : 'opacity-30'" />
                    </div>
                  </TableHead>
                  <TableHead
                    class="font-bold text-center whitespace-nowrap cursor-pointer select-none hover:text-primary"
                    @click="setSort('avg_score')"
                  >
                    <div class="inline-flex items-center gap-1">
                      평균 스코어
                      <ArrowUp class="w-3 h-3" :class="sortKey === 'avg_score' ? 'opacity-100 text-primary' : 'opacity-30'" />
                    </div>
                  </TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell">Winner</TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell">Medalist</TableHead>
                  <TableHead class="font-bold text-center whitespace-nowrap hidden md:table-cell">Host</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="(row, idx) in sortedSummary.slice(0, 10)"
                  :key="row.member_id"
                  :class="idx < 4
                    ? 'bg-primary/5 hover:bg-primary/10 transition-colors font-semibold'
                    : 'hover:bg-muted/50 transition-colors'"
                >
                  <TableCell class="font-medium whitespace-nowrap pl-7">{{ rankLabel(idx + 1) }}</TableCell>
                  <TableCell class="font-medium whitespace-nowrap">{{ row.member_name }}</TableCell>
                  <TableCell class="text-center whitespace-nowrap">{{ row.attended_count }}회</TableCell>
                  <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ stdHcMap.get(row.member_id) ?? '-' }}</TableCell>
                  <TableCell class="text-center font-mono whitespace-nowrap">
                    <span
                      :class="row.avg_net_score >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-orange-600 dark:text-orange-400'"
                    >
                      {{ row.avg_net_score >= 0 ? '+' : '' }}{{ row.avg_net_score.toFixed(2) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-center font-mono whitespace-nowrap">
                    <span v-if="row.avg_score !== null" class="text-purple-600 dark:text-purple-400 font-semibold">{{ row.avg_score.toFixed(1) }}</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                    <span v-if="row.winner_count" class="text-yellow-600 font-bold">{{ row.winner_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                    <span v-if="row.medalist_count" class="text-gray-500 font-bold">{{ row.medalist_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap hidden md:table-cell">
                    <span v-if="row.host_count" class="text-green-600 font-bold">{{ row.host_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                </TableRow>
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
