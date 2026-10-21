<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Download } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useRecordExport } from '@/composables/useRecordExport';
import { useCompactTable } from '@/composables/useCompactTable';
import { MEETINGS, MEETING_RESULTS, MONTHLY_HANDICAPS, GOLF_COURSES, resolveHandicap, setting } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import { formatPending, formatValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RANK_STYLE, isRankName } from '@/lib/rank';
import type { ResultRank } from '@/lib';
import AsyncState from '@/components/ui/AsyncState.vue';
import RowDetailDialog from '@/components/ui/RowDetailDialog.vue';
import RowDetailButton from '@/components/ui/RowDetailButton.vue';
import DetailItem from '@/components/ui/DetailItem.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import RankBadge from '@/components/ui/RankBadge.vue';
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

interface HistoryRow {
  year_month: string;
  // 아직 정해지지 않은 값은 null 로 둔다. `?? 0` 으로 채우면 확정된 핸디 0 과
  // 구분되지 않아 미래 달이 "차월 핸디 0" 으로 보인다. (P1-1)
  course_name: string | null;
  std_hc: number | null;
  app_hc: number | null;
  next_hc: number | null;
  next_hc_mismatch: boolean;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: string | null;
  result_rank: ResultRank;
}

// 아래 연도 watch(immediate)가 쓰므로 그보다 먼저 둔다.
const nowYM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// 고를 수 있는 연도. 모임이 있었던 해와 본인 핸디 기록이 있는 해 (없으면 올해).
const availableYears = computed(() => {
  const memberId = currentMember.value?.id;
  const years = new Set([
    ...MEETINGS.map((m) => m.year_month.slice(0, 4)),
    ...MONTHLY_HANDICAPS.filter((h) => h.member_id === memberId).map((h) => h.year_month.slice(0, 4)),
  ]);
  if (years.size === 0) years.add(nowYM.slice(0, 4));
  return [...years].sort().reverse();
});
const yearOptions = computed(() => availableYears.value.map((y) => ({ value: y, label: `${y}년` })));

// 표에 담을 연도. 기본은 기록이 있는 가장 최근 해 (4-1).
// 이 값 하나가 표의 12줄과 위쪽 통계 카드의 범위를 함께 정한다 — 예전에는
// 달 목록을 데이터에서 그러모으느라 연도가 섞여도 '몇 월'로만 보였다.
const historyYear = ref('');
watch(
  availableYears,
  (years) => {
    if (!years.includes(historyYear.value)) historyYear.value = years[0];
  },
  { immediate: true }
);

// ── 줄 상세 (디스클로저) ─────────────────────────────────────────────────────
// 좁은 화면에서는 기준·당월·차월 핸디 열이 숨는다. 월을 누르면 그달 기록을
// 숨은 것까지 모아 보여 준다. 경기가 없던 달은 보여 줄 것이 없어 열지 않는다.
// sm 부터는 열이 전부 보여 창을 열어도 표와 같은 내용이라 아예 열지 않는다.
const compact = useCompactTable('sm');
const detailRow = ref<HistoryRow | null>(null);
const detailOpen = ref(false);

function openDetail(row: HistoryRow): void {
  detailRow.value = row;
  detailOpen.value = true;
}

// 창을 열어 둔 채 화면을 넓히면 뒤의 표에 같은 값이 드러난다 — 그때는 닫는다.
watch(compact, (isCompact) => {
  if (!isCompact) detailOpen.value = false;
});

const history = computed<HistoryRow[]>(() => {
  if (!currentMember.value) return [];
  const memberId = currentMember.value.id;
  const year = historyYear.value;

  // 1월부터 12월까지를 항상 한 해치 그대로 놓는다. 기록이 있는 달만 뽑으면
  // 줄이 건너뛰어 몇 월이 빠졌는지 세어 봐야 알 수 있고, 남은 일정이
  // 몇 달인지도 표에서 사라진다. 미팅도 핸디도 없는 달은 빈 줄로 남는다.
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
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
        next_hc_mismatch: handicap?.next_hc_mismatch ?? false,
        attended,
        score,
        net_score,
        result_group: result?.result_group ?? null,
        result_rank,
      };
    });
});

// 빈 줄로 채운 12개월은 항상 있으므로, 행 수로는 기록 유무를 알 수 없다.
const hasRecord = computed(() =>
  history.value.some((r) => r.course_name !== null || r.std_hc !== null)
);

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
    historyYear.value,
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
  <div class="w-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-5xl space-y-3">
      <template v-if="currentMember">
        <div class="flex items-center gap-2 pt-1">
          <h1 class="text-lg font-bold text-foreground mr-auto">
            나의 기록 <span class="text-muted-foreground font-medium text-sm">— {{ currentMember.name }} 님</span>
          </h1>
          <!-- 고를 연도가 하나뿐이면 드롭다운을 띄우지 않는다 (연간 랭킹과 같다).
               그 연도는 표의 첫 열 제목에 이미 나온다. -->
          <template v-if="yearOptions.length > 1">
            <label for="profile-year" class="sr-only">연도 선택</label>
            <Select
              id="profile-year"
              v-model="historyYear"
              :options="yearOptions"
              placeholder=""
              size="xs"
              class="w-24 shrink-0"
            />
          </template>
          <!-- 좁은 화면에서는 글자가 숨겨져 아이콘만 남으므로 이름을 따로 준다. -->
          <Button
            variant="outline"
            size="xs"
            class="shrink-0 gap-1"
            :title="`나의 ${historyYear}년 기록 CSV 다운로드(엑셀용)`"
            :aria-label="`나의 ${historyYear}년 기록 CSV 다운로드(엑셀용)`"
            @click="handleExport"
          >
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
            <span class="hidden sm:inline">CSV</span>
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
                  <span :class="derived.avgNet >= 0 ? 'text-blue-600' : 'text-orange-700'">
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
              <p :class="cn('text-xl font-bold', RANK_STYLE.Winner.text)">{{ derived.winnerCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">Medalist</p>
              <p :class="cn('text-xl font-bold', RANK_STYLE.Medalist.text)">{{ derived.medalistCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-full py-3 px-2 sm:px-4">
              <p class="text-xs sm:text-sm text-muted-foreground mb-1">Host</p>
              <p :class="cn('text-xl font-bold', RANK_STYLE.Host.text)">{{ derived.hostCount }}회</p>
            </CardContent>
          </Card>
        </div>

        <!-- 월별 히스토리 테이블 -->
        <!-- 넓은 화면: 카드가 표의 최소 폭(w-min)을 따라가고, 남으면 min-w-full 로
             가득 채운다. 스크롤은 페이지가 한다.
             좁은 화면(compact): 골프장 이름 때문에 표가 화면보다 넓어진다. 이때는
             표가 스스로 옆으로 밀고 카드는 화면 폭에 머문다. (3-3) -->
        <Card :class="compact ? 'w-full' : 'w-min min-w-full'">
          <CardContent class="px-2 sm:px-6">
            <AsyncState
              :empty="!hasRecord"
              empty-title="아직 기록 없음"
              empty-hint="모임 참석 후 스코어가 저장되면 여기에 누적"
            >
            <div class="pt-4">
              <!-- 넓은 화면은 스크롤을 페이지가 한다. 그래야 위쪽 요약 카드가
                   함께 밀려 올라가고, 열 제목만 화면 맨 위에 남는다. -->
              <Table
                :scroll="compact"
                class="text-xs sm:text-sm [&_thead_th]:bg-muted [&_thead_th]:text-foreground"
                caption="월별 참석·핸디·스코어 기록"
              >
                <TableHeader>
                  <TableRow>
                    <!-- 표가 옆으로 밀려도 몇 월 줄인지는 남는다 -->
                    <TableHead class="font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-card">
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
                    class="group hover:bg-muted/50 transition-colors"
                  >
                    <!-- 고정 열은 불투명 bg-card 라 tr 의 hover 틴트가 가려진다.
                         MonthlyTable 과 같이 isolate + ::before 로 다시 얹는다. -->
                    <TableCell
                      class="font-medium whitespace-nowrap pl-7 sticky left-0 z-10 bg-card isolate before:absolute before:inset-0 before:-z-10 before:transition-colors group-hover:before:bg-muted/50"
                    >
                      <RowDetailButton
                        v-if="row.course_name"
                        :label="formatMonth(row.year_month)"
                        :enabled="compact"
                        @click="openDetail(row)"
                      >{{ formatMonth(row.year_month) }}</RowDetailButton>
                      <template v-else>{{ formatMonth(row.year_month) }}</template>
                    </TableCell>
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
                          ? 'text-blue-600 font-semibold'
                          : 'text-orange-700'"
                        >
                          {{ row.net_score >= 0 ? '+' : '' }}{{ row.net_score }}
                        </span>
                      </template>
                      <span v-else class="text-muted-foreground text-sm">-</span>
                    </TableCell>

                    <TableCell class="text-center whitespace-nowrap">
                      <RankBadge v-if="isRankName(row.result_rank)" :rank="row.result_rank" />
                      <Badge
                        v-else-if="row.result_group"
                        :variant="row.result_group === '1등조' ? 'default' : 'secondary'"
                      >
                        {{ row.result_group }}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <!-- 평균 행 -->
                  <TableRow class="border-t-2 border-border bg-muted/40 font-semibold">
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
                          ? 'text-blue-600'
                          : 'text-orange-700'"
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

        <!-- 그달 기록 전부 -->
        <RowDetailDialog
          v-model:open="detailOpen"
          :title="detailRow ? formatMonth(detailRow.year_month) : ''"
          :subtitle="`${historyYear}년`"
        >
          <template v-if="detailRow">
            <DetailItem label="골프장">{{ formatCourse(detailRow) }}</DetailItem>
            <DetailItem label="참석">
              <span v-if="detailRow.attended" class="text-primary">참석</span>
              <span v-else class="text-muted-foreground font-normal">불참</span>
            </DetailItem>
            <DetailItem label="기준 핸디"><span class="font-mono">{{ formatValue(detailRow.std_hc) }}</span></DetailItem>
            <DetailItem label="당월 핸디"><span class="font-mono">{{ formatValue(detailRow.app_hc) }}</span></DetailItem>
            <DetailItem label="차월 핸디">
              <span class="font-mono">{{ formatValue(detailRow.next_hc) }}</span>
              <Badge v-if="detailRow.next_hc_mismatch" variant="outline" class="ml-1.5 border-amber-500 text-amber-700 font-normal">※ 저장값 불일치(관리자 확인 필요)</Badge>
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
            <DetailItem label="결과">
              <RankBadge v-if="isRankName(detailRow.result_rank)" :rank="detailRow.result_rank" />
              <Badge
                v-else-if="detailRow.result_group"
                :variant="detailRow.result_group === '1등조' ? 'default' : 'secondary'"
              >{{ detailRow.result_group }}</Badge>
            </DetailItem>
          </template>
        </RowDetailDialog>

      </template>
    </div>
  </div>
</template>
