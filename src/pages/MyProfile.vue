<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Trophy, Medal, Home, Download } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useRecordExport } from '@/composables/useRecordExport';
import { MEETINGS, MEETING_RESULTS, MONTHLY_HANDICAPS, GOLF_COURSES, resolveHandicap, setting } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import { formatPending, formatValue } from '@/lib/format';
import type { ResultRank } from '@/lib';
import AsyncState from '@/components/ui/AsyncState.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';

const router = useRouter();
const { isLoggedIn, currentMember } = useAuth();

if (!isLoggedIn.value) {
  router.replace(ROUTE_PATHS.HOME);
}

interface RankMeta { cls: string; icon: typeof Trophy; label: string }

const RANK_META: Record<NonNullable<ResultRank>, RankMeta> = {
  Winner:   { cls: 'bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950 border-0 shadow-md', icon: Trophy,  label: 'Winner' },
  Medalist: { cls: 'bg-linear-to-r from-gray-300 to-gray-400 text-gray-900 border-0 shadow-md',      icon: Medal,   label: 'Medalist' },
  Host:     { cls: 'bg-linear-to-r from-green-500 to-green-600 text-white border-0 shadow-md',        icon: Home,    label: 'Host' },
};

interface HistoryRow {
  year_month: string;
  // 아직 정해지지 않은 값은 null 로 둔다. `?? 0` 으로 채우면 확정된 핸디 0 과
  // 구분되지 않아 미래 달이 "차월 핸디 0" 으로 보인다. (P1-1)
  course_name: string | null;
  std_hc: number | null;
  app_hc: number | null;
  next_hc: number | null;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: string | null;
  result_rank: ResultRank;
  rankMeta: RankMeta | null;
}

const history = computed<HistoryRow[]>(() => {
  if (!currentMember.value) return [];
  const memberId = currentMember.value.id;

  // 미팅이 있는 달 + (미팅 없이) 핸디캡만 등록된 달(예: 새 기준핸디 적용 월)을 합쳐 표시
  const months = new Set<string>();
  for (const m of MEETINGS) months.add(m.year_month);
  for (const h of MONTHLY_HANDICAPS) if (h.member_id === memberId) months.add(h.year_month);

  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => {
      const meeting  = MEETINGS.find((m) => m.year_month === ym);
      const result   = meeting ? MEETING_RESULTS.find((r) => r.meeting_id === meeting.id && r.member_id === memberId) : undefined;
      const handicap = resolveHandicap(memberId, ym);
      const course   = meeting ? GOLF_COURSES.find((c) => c.id === meeting.golf_course_id) : undefined;

      const attended    = result?.attended ?? false;
      const score       = result?.score ?? null;
      // 적용 핸디가 아직 없는 달(직전 달 차월핸디 미확정)은 Net 을 비워 둔다.
      // 빼기로 넘기면 null 이 0 이 되어 Net 이 스코어와 같아진다.
      const net_score   = attended && score !== null && handicap?.app_hc != null ? score - handicap.app_hc : null;
      const result_rank = result?.result_rank ?? null;

      return {
        year_month:   ym,
        course_name:  course?.name ?? null,
        std_hc:       handicap?.std_hc ?? null,
        app_hc:       handicap?.app_hc ?? null,
        next_hc:      handicap?.next_hc ?? null,
        attended,
        score,
        net_score,
        result_group: result?.result_group ?? null,
        result_rank,
        rankMeta:     result_rank ? (RANK_META[result_rank] ?? null) : null,
      };
    });
});

const historyYear = computed(() => history.value[0]?.year_month.slice(0, 4) ?? '');

const derived = computed(() => {
  let attendedCount = 0, winnerCount = 0, medalistCount = 0, hostCount = 0;
  let netSum = 0, netCount = 0, scoreSum = 0, scoreCount = 0;

  for (const r of history.value) {
    if (r.result_rank === 'Winner')        winnerCount++;
    else if (r.result_rank === 'Medalist') medalistCount++;
    else if (r.result_rank === 'Host')     hostCount++;
    if (!r.attended) continue;
    attendedCount++;
    if (r.score     !== null) { scoreSum += r.score;     scoreCount++; }
    if (r.net_score !== null) { netSum   += r.net_score; netCount++;   }
  }

  const fmt = (sum: number, n: number) => n > 0 ? (sum / n).toFixed(1) : '-';

  return {
    attendedCount, winnerCount, medalistCount, hostCount,
    avgNet:   netCount   > 0 ? netSum   / netCount   : null,
    scoreAvg: fmt(scoreSum, scoreCount),
    netAvg:   fmt(netSum,   netCount),
  };
});

function formatMonth(ym: string): string {
  return `${parseInt(ym.slice(5), 10)}월`;
}

const nowYM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// 아직 오지 않은 달은 `미정`(앞으로 정해짐), 지난 달은 `-`(기록 없음).
function formatCourse(row: HistoryRow): string {
  return row.year_month >= nowYM ? formatPending(row.course_name) : formatValue(row.course_name);
}

// ── 엑셀(CSV) 다운로드 ────────────────────────────────────────────────────────
// 화면의 표와 같은 행·같은 순서로 내보낸다. 평균 행은 파일에 넣지 않는다 —
// 엑셀에서 정렬·필터를 걸면 합계 행이 섞여 들어가 계산을 망친다.
const { exportMyRecords } = useRecordExport();

function handleExport(): void {
  if (!currentMember.value) return;
  exportMyRecords(
    currentMember.value.name,
    history.value.map((r) => ({
      year_month: r.year_month,
      course_name: r.course_name,
      std_hc: r.std_hc,
      app_hc: r.app_hc,
      next_hc: r.next_hc,
      attended: r.attended,
      score: r.score,
      net_score: r.net_score,
      result_group: r.result_group,
      result_rank: r.result_rank,
    }))
  );
}
</script>

<template>
  <div class="w-full h-full min-h-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-7xl space-y-2 h-full flex flex-col flex-1">
      <template v-if="currentMember">
        <div class="flex items-center gap-2 pt-1">
          <h1 class="text-lg font-bold text-foreground mr-auto">
            나의 기록 <span class="text-muted-foreground font-medium text-sm">— {{ currentMember.name }} 님</span>
          </h1>
          <!-- 좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2 shrink-0 gap-1 text-xs"
            title="나의 기록 엑셀(CSV) 다운로드"
            aria-label="나의 기록 엑셀 다운로드"
            @click="handleExport"
          >
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
            <span class="hidden sm:inline">엑셀</span>
          </Button>
        </div>

        <!-- 통계 카드 -->
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">참석 횟수</p>
              <p class="text-xl font-bold">{{ derived.attendedCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">평균 Net</p>
              <p class="text-xl font-bold font-mono">
                <template v-if="derived.avgNet !== null">
                  <span :class="derived.avgNet >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'">
                    {{ derived.avgNet >= 0 ? '+' : '' }}{{ derived.avgNet.toFixed(1) }}
                  </span>
                </template>
                <span v-else class="text-muted-foreground text-base">-</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">Winner</p>
              <p class="text-xl font-bold text-yellow-700">{{ derived.winnerCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">Medalist</p>
              <p class="text-xl font-bold text-muted-foreground">{{ derived.medalistCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">Host</p>
              <p class="text-xl font-bold text-green-600">{{ derived.hostCount }}회</p>
            </CardContent>
          </Card>
        </div>

        <!-- 월별 히스토리 테이블 -->
        <Card class="flex flex-col flex-1 min-h-0">
          <CardContent class="flex-1 overflow-hidden min-h-0">
            <AsyncState
              :empty="history.length === 0"
              empty-title="아직 기록이 없습니다"
              empty-hint="모임에 참석하고 스코어가 저장되면 여기에 쌓입니다."
            >
            <div class="overflow-x-auto overflow-y-auto h-full min-h-0 mt-4">
              <Table caption="월별 참석·핸디·스코어 기록">
                <TableHeader>
                  <TableRow>
                    <TableHead class="font-bold text-foreground whitespace-nowrap">
                      <Badge variant="default">{{ historyYear }}년</Badge>
                    </TableHead>
                    <TableHead class="font-bold text-foreground whitespace-nowrap">골프장</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">기준 핸디</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">당월 핸디</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">차월 핸디</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">스코어</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">NET 스코어</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">결과</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="row in history"
                    :key="row.year_month"
                    class="hover:bg-muted/50 transition-colors h-14"
                  >
                    <TableCell class="font-medium whitespace-nowrap pl-7">{{ formatMonth(row.year_month) }}</TableCell>
                    <TableCell
                      class="whitespace-nowrap"
                      :class="row.course_name ? '' : 'text-muted-foreground text-sm'"
                    >{{ formatCourse(row) }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ formatValue(row.std_hc) }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ formatValue(row.app_hc) }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">{{ formatValue(row.next_hc) }}</TableCell>

                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <template v-if="row.attended && row.score !== null">{{ row.score }}</template>
                      <span v-else class="text-muted-foreground text-sm">-</span>
                    </TableCell>

                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <template v-if="row.attended && row.net_score !== null">
                        <span :class="row.net_score >= 0
                          ? 'text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-orange-700 dark:text-orange-400'"
                        >
                          {{ row.net_score >= 0 ? '+' : '' }}{{ row.net_score }}
                        </span>
                      </template>
                      <span v-else class="text-muted-foreground text-sm">-</span>
                    </TableCell>

                    <TableCell class="text-center whitespace-nowrap">
                      <Badge v-if="row.rankMeta" :class="row.rankMeta.cls">
                        <component :is="row.rankMeta.icon" class="w-3 h-3 mr-1" />
                        {{ row.rankMeta.label }}
                      </Badge>
                      <Badge
                        v-else-if="row.result_group"
                        :variant="row.result_group === '1등조' ? 'default' : 'secondary'"
                      >
                        {{ row.result_group }}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <!-- 평균 행 -->
                  <TableRow class="border-t-2 border-border bg-muted/40 font-semibold h-14">
                    <TableCell class="text-sm text-muted-foreground whitespace-nowrap pl-7">평균</TableCell>
                    <TableCell />
                    <TableCell class="hidden sm:table-cell" />
                    <TableCell class="hidden sm:table-cell" />
                    <TableCell class="hidden sm:table-cell" />
                    <TableCell class="text-center font-mono whitespace-nowrap">{{ derived.scoreAvg }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <span
                        v-if="derived.netAvg !== '-'"
                        :class="parseFloat(derived.netAvg) >= 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-orange-700 dark:text-orange-400'"
                      >
                        {{ parseFloat(derived.netAvg) >= 0 ? '+' : '' }}{{ derived.netAvg }}
                      </span>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              <p v-if="setting('handicap_notice')" class="text-xs text-muted-foreground mt-2 px-4">
                {{ setting('handicap_notice') }}
              </p>
            </div>
            </AsyncState>
          </CardContent>
        </Card>

      </template>
    </div>
  </div>
</template>
