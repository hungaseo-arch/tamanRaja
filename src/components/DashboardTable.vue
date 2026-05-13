<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Trophy, Medal, Home } from 'lucide-vue-next';
import type { DashboardRow, ResultRank, ResultGroup } from '@/lib';
import Select from '@/components/ui/Select.vue';
import type { SelectOption } from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
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
}

interface Props {
  yearMonth: string;
  dashboardData: DashboardRow[];
  meetingDate: string;
  courseName: string;
  isFutureMonth?: boolean;
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

// 편집 모드: 미래 달이면 기본 편집 상태
const isEditing = ref(props.isFutureMonth ?? false);

// 입력값 — watch보다 먼저 선언해야 immediate watch의 TDZ 에러 방지
const localScores = reactive<Record<string, string>>({});
const localGroups = reactive<Record<string, string>>({});
const localRanks = reactive<Record<string, string>>({});
const localNextHc = reactive<Record<string, number>>({});

watch(
  () => [props.yearMonth, props.isFutureMonth] as const,
  ([, future]) => {
    isEditing.value = future ?? false;
    [localScores, localGroups, localRanks, localNextHc].forEach((map) =>
      Object.keys(map).forEach((k) => delete map[k]),
    );
  },
);

function getLocalNet(row: DashboardRow): string {
  const raw = localScores[row.member_id];
  if (!raw) return '';
  const score = parseInt(raw, 10);
  if (isNaN(score)) return '';
  const net = score - row.app_hc;
  return (net >= 0 ? '+' : '') + net;
}

function computeAutoFields(): void {
  const scored = props.dashboardData
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
  for (const row of props.dashboardData) {
    if (!localScores[row.member_id]) {
      delete localGroups[row.member_id];
      delete localNextHc[row.member_id];
      delete localRanks[row.member_id];
    }
  }

  if (scored.length === 0) return;

  const topCount = Math.floor(scored.length / 2);
  const isJanuary = props.yearMonth.endsWith('-01');

  scored.forEach((row, idx) => {
    const group: ResultGroup = idx < topCount ? '1등조' : '2등조';
    localGroups[row.member_id] = group;

    let nextHc: number;
    if (isJanuary) {
      nextHc = group === '1등조' ? row.app_hc - 1 : row.app_hc + 1;
    } else if (row.prev_result_group !== null && row.prev_result_group === group) {
      nextHc = group === '1등조' ? row.app_hc - 1 : row.app_hc + 1;
    } else {
      nextHc = row.std_hc;
    }
    localNextHc[row.member_id] = nextHc;
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
  });
  isEditing.value = false;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
}

const winnerRow = computed(() => props.dashboardData.find((r) => r.result_rank === 'Winner'));

const localSelectedMonth = computed({
  get: () => props.selectedMonth,
  set: (v: string) => emit('update:selectedMonth', v),
});

const stats = computed(() => {
  const attendedCount = props.dashboardData.filter((d) => d.attended).length;
  return {
    attendedCount,
    winnerName: props.dashboardData.find((d) => d.result_rank === 'Winner')?.member_name ?? '-',
    medalistName: props.dashboardData.find((d) => d.result_rank === 'Medalist')?.member_name ?? '-',
    hostName: props.dashboardData.find((d) => d.result_rank === 'Host')?.member_name ?? '-',
  };
});


interface RankMeta { cls: string; icon: typeof Trophy; label: string }

function getRankMeta(rank: ResultRank): RankMeta | null {
  switch (rank) {
    case 'Winner':
      return { cls: 'bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950 border-0 shadow-md', icon: Trophy, label: 'Winner' };
    case 'Medalist':
      return { cls: 'bg-linear-to-r from-gray-300 to-gray-400 text-gray-900 border-0 shadow-md', icon: Medal, label: 'Medalist' };
    case 'Host':
      return { cls: 'bg-linear-to-r from-green-500 to-green-600 text-white border-0 shadow-md', icon: Home, label: 'Host' };
    default:
      return null;
  }
}

function getGroupVariant(g: ResultGroup): 'default' | 'secondary' | null {
  if (!g) return null;
  return g === '1등조' ? 'default' : 'secondary';
}
</script>

<template>
  <div class="space-y-6">
    <Card class="py-5 flex items-center justify-between bg-linear-to-r from-gray-200 to-gray-100 text-gray-900 border-0 text-xs">
      <div class="flex items-center gap-4">
        <!-- 게임일자 및 구장정보 -->
        <CardTitle class="px-5 text-2xl font-bold text-primary">
          {{ meetingDate ? `${formatDate(meetingDate)} - ${courseName}` : formatYearMonth(selectedMonth) }}
        </CardTitle>
        <div class="w-40">
          <Select v-model="localSelectedMonth" :options="monthOptions" placeholder="월 선택" />
        </div>
        <template v-if="isFutureMonth">
          <div class="flex items-center gap-2">
            <Label class="text-sm text-muted-foreground whitespace-nowrap">경기일자</Label>
            <Input
              type="date"
              class="w-40 font-mono text-sm"
              :model-value="manualDate"
              @update:model-value="(v: string) => emit('update:manualDate', v)"
            />
          </div>
          <div class="flex items-center gap-2">
            <Label class="text-sm text-muted-foreground whitespace-nowrap">골프장</Label>
            <Input
              type="text"
              class="w-36 text-sm"
              placeholder="예: 자고라위"
              :model-value="manualCourse"
              @update:model-value="(v: string) => emit('update:manualCourse', v)"
            />
          </div>
        </template>
      </div>

      <!-- 당월 참석인원과 수상자 현황 -->
      <CardContent class="flex items-center justify-end gap-6 py-3">
        <div v-if="!isFutureMonth" class="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground text-sm font-medium">참석인원</span>
            <span class="text-xl font-bold">{{ stats.attendedCount }}명</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge class="bg-yellow-500 text-white hover:bg-yellow-600">🏆 Winner</Badge>
            <span class="font-semibold">{{ stats.winnerName }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge class="bg-muted text-foreground hover:bg-muted/80">🥈 Medalist</Badge>
            <span class="font-semibold">{{ stats.medalistName }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge class="bg-primary text-primary-foreground hover:bg-primary/90">🎯 Host</Badge>
            <span class="font-semibold">{{ stats.hostName }}</span>
          </div>
        </div>
        <div v-if="isFutureMonth" class="flex gap-2 shrink-0">
          <Button v-if="isEditing" @click="handleSave">저장</Button>
          <Button v-else variant="outline" @click="isEditing = true">수정</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent>
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="font-bold text-foreground">회원</TableHead>
                <TableHead class="font-bold text-center">기준HC</TableHead>
                <TableHead class="font-bold text-center">당월HC</TableHead>
                <TableHead class="font-bold text-center">차월HC</TableHead>
                <TableHead class="font-bold text-center">Score</TableHead>
                <TableHead class="font-bold text-center">Net Score</TableHead>
                <TableHead class="font-bold text-center">결과Group</TableHead>
                <TableHead class="font-bold text-center">결과Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in dashboardData"
                :key="row.member_id"
                :class="row.member_id === winnerRow?.member_id
                  ? 'bg-primary/5 hover:bg-primary/10 transition-colors'
                  : 'hover:bg-muted/50 transition-colors'"
              >
                <TableCell class="font-medium">{{ row.member_name }}</TableCell>
                <TableCell class="text-center font-mono">{{ row.std_hc }}</TableCell>
                <TableCell class="text-center font-mono">{{ row.app_hc }}</TableCell>
                <TableCell class="text-center font-mono">
                  <template v-if="isFutureMonth && localNextHc[row.member_id] != null">{{ localNextHc[row.member_id] }}</template>
                  <template v-else-if="!isFutureMonth && row.attended && row.score !== null">{{ row.next_hc }}</template>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>

                <!-- Score -->
                <TableCell class="text-center font-mono">
                  <template v-if="isFutureMonth && isEditing">
                    <input
                      type="number"
                      :value="localScores[row.member_id] ?? ''"
                      placeholder="-"
                      class="w-16 text-center border border-input rounded px-1 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      @input="(e) => { localScores[row.member_id] = (e.target as HTMLInputElement).value; }"
                    />
                  </template>
                  <template v-else-if="isFutureMonth">
                    <span class="font-mono">{{ localScores[row.member_id] || '-' }}</span>
                  </template>
                  <template v-else-if="row.attended">{{ row.score }}</template>
                  <span v-else class="text-muted-foreground">불참</span>
                </TableCell>

                <!-- Net Score -->
                <TableCell class="text-center font-mono">
                  <template v-if="isFutureMonth">
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
                  <span v-else class="text-muted-foreground">불참</span>
                </TableCell>

                <!-- 결과Group -->
                <TableCell class="text-center">
                  <template v-if="isFutureMonth && isEditing">
                    <select
                      :value="localGroups[row.member_id] ?? ''"
                      class="w-20 text-center border border-input rounded px-1 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                      @change="(e) => { localGroups[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="1등조">1등조</option>
                      <option value="2등조">2등조</option>
                    </select>
                  </template>
                  <template v-else-if="isFutureMonth">
                    <Badge v-if="localGroups[row.member_id]" :variant="localGroups[row.member_id] === '1등조' ? 'default' : 'secondary'">
                      {{ localGroups[row.member_id] }}
                    </Badge>
                    <span v-else class="text-muted-foreground">-</span>
                  </template>
                  <template v-else>
                    <Badge
                      v-if="getGroupVariant(row.result_group)"
                      :variant="getGroupVariant(row.result_group)!"
                    >
                      {{ row.result_group }}
                    </Badge>
                  </template>
                </TableCell>

                <!-- 결과Rank -->
                <TableCell class="text-center">
                  <template v-if="isFutureMonth && isEditing">
                    <select
                      :value="localRanks[row.member_id] ?? ''"
                      class="w-24 text-center border border-input rounded px-1 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                      @change="(e) => { localRanks[row.member_id] = (e.target as HTMLSelectElement).value; }"
                    >
                      <option value="">-</option>
                      <option value="Winner">Winner</option>
                      <option value="Medalist">Medalist</option>
                      <option value="Host">Host</option>
                    </select>
                  </template>
                  <template v-else-if="isFutureMonth">
                    <Badge v-if="localRanks[row.member_id]" :class="getRankMeta(localRanks[row.member_id] as ResultRank)?.cls">
                      <component :is="getRankMeta(localRanks[row.member_id] as ResultRank)!.icon" class="w-3 h-3 mr-1" />
                      {{ localRanks[row.member_id] }}
                    </Badge>
                    <span v-else class="text-muted-foreground">-</span>
                  </template>
                  <template v-else-if="getRankMeta(row.result_rank)">
                    <Badge :class="getRankMeta(row.result_rank)!.cls">
                      <component :is="getRankMeta(row.result_rank)!.icon" class="w-3 h-3 mr-1" />
                      {{ getRankMeta(row.result_rank)!.label }}
                    </Badge>
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
