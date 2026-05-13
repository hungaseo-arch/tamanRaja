<script setup lang="ts">
import { computed, ref } from 'vue';
import { Trophy, Medal, Home } from 'lucide-vue-next';
import { getYearlySummary, MEETINGS, MONTHLY_HANDICAPS } from '@/data';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Select from '@/components/ui/Select.vue';
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

const selectedYear = ref<string>(
  availableYears.value.length > 0 ? availableYears.value[0].value : ''
);

const summary = computed(() => getYearlySummary(selectedYear.value));

const stdHcMap = computed(() => {
  const map = new Map<string, number>();
  const yearMonths = MEETINGS
    .filter((m) => m.year_month.startsWith(selectedYear.value))
    .map((m) => m.year_month)
    .sort((a, b) => b.localeCompare(a));
  const latestMonth = yearMonths[0];
  if (!latestMonth) return map;
  for (const h of MONTHLY_HANDICAPS) {
    if (h.year_month === latestMonth) map.set(h.member_id, h.std_hc);
  }
  return map;
});

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}위`;
}
</script>

<template>
  <div class="w-full min-h-screen bg-background">
    <div class="container mx-auto px-4 py-8 max-w-7xl space-y-6">
    

      <!-- 상위 3명 하이라이트 카드 -->
      <div v-if="summary.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          v-for="row in summary.slice(0, 3)"
          :key="row.member_id"
          :class="row.rank === 1
            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
            : row.rank === 2
              ? 'border-gray-400 bg-gray-50 dark:bg-gray-950/20'
              : 'border-amber-700 bg-orange-50 dark:bg-orange-950/20'"
        >
          <CardContent class="pt-4 text-center space-y-1">
            <p class="text-2xl">{{ rankLabel(row.rank) }}</p>
            <p class="text-lg font-bold">{{ row.member_name }}</p>
            <p class="text-sm text-muted-foreground">
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
                class="bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950 border-0 text-xs"
              >
                <Trophy class="w-3 h-3 mr-1" />Winner {{ row.winner_count }}
              </Badge>
              <Badge
                v-if="row.medalist_count"
                class="bg-linear-to-r from-gray-300 to-gray-400 text-gray-900 border-0 text-xs"
              >
                <Medal class="w-3 h-3 mr-1" />Medalist {{ row.medalist_count }}
              </Badge>
              <Badge
                v-if="row.host_count"
                class="bg-linear-to-r from-green-500 to-green-600 text-white border-0 text-xs"
              >
                <Home class="w-3 h-3 mr-1" />Host {{ row.host_count }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 전체 랭킹 테이블 -->
      <Card>
        <CardHeader class="pb-2 flex flex-row! items-center justify-between">
          <CardTitle class="text-xl whitespace-nowrap">{{ selectedYear }}년 전체 순위</CardTitle>
          <div class="w-36">
            <Select v-model="selectedYear" :options="availableYears" placeholder="연도 선택" />
          </div>


        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <Table class="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead class="font-bold text-foreground w-[14%] whitespace-nowrap">순위</TableHead>
                  <TableHead class="font-bold text-foreground w-[14%] whitespace-nowrap">회원</TableHead>
                  <TableHead class="font-bold text-center w-[14%] whitespace-nowrap">기준HC</TableHead>
                  <TableHead class="font-bold text-center w-[14%] whitespace-nowrap">평균 Net</TableHead>
                  <TableHead class="font-bold text-center w-[14%] whitespace-nowrap">참석</TableHead>
                  <TableHead class="font-bold text-center w-[14%] whitespace-nowrap">Winner</TableHead>
                  <TableHead class="font-bold text-center w-[16%] whitespace-nowrap">Medalist</TableHead>
                  <TableHead class="font-bold text-center w-[14%] whitespace-nowrap">Host</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in summary"
                  :key="row.member_id"
                  :class="row.rank <= 3
                    ? 'bg-primary/5 hover:bg-primary/10 transition-colors font-semibold'
                    : 'hover:bg-muted/50 transition-colors'"
                >
                  <TableCell class="text-lg whitespace-nowrap">{{ rankLabel(row.rank) }}</TableCell>
                  <TableCell class="font-medium whitespace-nowrap">{{ row.member_name }}</TableCell>
                  <TableCell class="text-center font-mono whitespace-nowrap">{{ stdHcMap.get(row.member_id) ?? '-' }}</TableCell>
                  <TableCell class="text-center font-mono whitespace-nowrap">
                    <span
                      :class="row.avg_net_score >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-orange-600 dark:text-orange-400'"
                    >
                      {{ row.avg_net_score >= 0 ? '+' : '' }}{{ row.avg_net_score.toFixed(2) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap">{{ row.attended_count }}회</TableCell>
                  <TableCell class="text-center whitespace-nowrap">
                    <span v-if="row.winner_count" class="text-yellow-600 font-bold">{{ row.winner_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap">
                    <span v-if="row.medalist_count" class="text-gray-500 font-bold">{{ row.medalist_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell class="text-center whitespace-nowrap">
                    <span v-if="row.host_count" class="text-green-600 font-bold">{{ row.host_count }}회</span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p v-if="summary.length === 0" class="text-center text-muted-foreground py-8">
            해당 연도의 데이터가 없습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
