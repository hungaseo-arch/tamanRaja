<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Trophy, Medal, Home, AlertCircle, CheckCircle2 } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { MEETINGS, MEETING_RESULTS, MONTHLY_HANDICAPS, GOLF_COURSES } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import type { ResultRank } from '@/lib';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';

const router = useRouter();
const { isLoggedIn, currentMember, changePin } = useAuth();

if (!isLoggedIn.value) {
  router.replace(ROUTE_PATHS.HOME);
}

// ── PIN 변경 상태 ────────────────────────────────────────────────────────────
const oldPin = ref('');
const newPin = ref('');
const confirmPin = ref('');
const changePinError = ref('');
const changePinSuccess = ref(false);

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

function handleChangePin(e: Event): void {
  e.preventDefault();
  changePinError.value = '';
  changePinSuccess.value = false;

  if (oldPin.value.length !== 4 || newPin.value.length !== 4 || confirmPin.value.length !== 4) {
    changePinError.value = 'PIN은 4자리 숫자여야 합니다.';
    return;
  }
  if (newPin.value !== confirmPin.value) {
    changePinError.value = '새 PIN이 일치하지 않습니다.';
    return;
  }
  if (oldPin.value === newPin.value) {
    changePinError.value = '새 PIN은 기존 PIN과 달라야 합니다.';
    return;
  }

  const ok = changePin(oldPin.value, newPin.value);
  if (ok) {
    changePinSuccess.value = true;
    oldPin.value = '';
    newPin.value = '';
    confirmPin.value = '';
    window.setTimeout(() => { changePinSuccess.value = false; }, 3000);
  } else {
    changePinError.value = '기존 PIN이 올바르지 않습니다.';
  }
}

// ── 히스토리 및 통계 ─────────────────────────────────────────────────────────
interface HistoryRow {
  year_month: string;
  meeting_date: string;
  course_name: string;
  std_hc: number;
  app_hc: number;
  next_hc: number;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: string | null;
  result_rank: ResultRank;
}

const history = computed<HistoryRow[]>(() => {
  if (!currentMember.value) return [];
  const memberId = currentMember.value.id;

  return MEETINGS.map((meeting) => {
    const result = MEETING_RESULTS.find(
      (r) => r.meeting_id === meeting.id && r.member_id === memberId
    );
    const handicap = MONTHLY_HANDICAPS.find(
      (h) => h.member_id === memberId && h.year_month === meeting.year_month
    );
    const course = GOLF_COURSES.find((c) => c.id === meeting.golf_course_id);

    const attended = result?.attended ?? false;
    const score = result?.score ?? null;
    const netScore =
      attended && score !== null && handicap
        ? score - handicap.app_hc
        : null;

    return {
      year_month: meeting.year_month,
      meeting_date: meeting.meeting_date,
      course_name: course?.name ?? '',
      std_hc: handicap?.std_hc ?? 0,
      app_hc: handicap?.app_hc ?? 0,
      next_hc: handicap?.next_hc ?? 0,
      attended,
      score,
      net_score: netScore,
      result_group: result?.result_group ?? null,
      result_rank: result?.result_rank ?? null,
    };
  }).sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
});

const stats = computed(() => {
  const attended = history.value.filter((r) => r.attended);
  const netScores = attended.map((r) => r.net_score).filter((n): n is number => n !== null);
  const avgNet = netScores.length > 0
    ? netScores.reduce((a, b) => a + b, 0) / netScores.length
    : null;

  return {
    attendedCount: attended.length,
    avgNet,
    winnerCount: history.value.filter((r) => r.result_rank === 'Winner').length,
    medalistCount: history.value.filter((r) => r.result_rank === 'Medalist').length,
    hostCount: history.value.filter((r) => r.result_rank === 'Host').length,
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
</script>

<template>
  <div class="w-full min-h-screen bg-background">
    <div class="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-foreground">내 정보</h1>
        <Button variant="outline" @click="router.push(ROUTE_PATHS.HOME)">대시보드</Button>
      </div>

      <template v-if="currentMember">
        
        <!-- 통계 카드 -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent class="pt-4 text-center">
              <p class="text-sm text-muted-foreground mb-1">참석 횟수</p>
              <p class="text-2xl font-bold">{{ stats.attendedCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="pt-4 text-center">
              <p class="text-sm text-muted-foreground mb-1">평균 Net</p>
              <p class="text-2xl font-bold font-mono">
                <template v-if="stats.avgNet !== null">
                  <span :class="stats.avgNet >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'">
                    {{ stats.avgNet >= 0 ? '+' : '' }}{{ stats.avgNet.toFixed(1) }}
                  </span>
                </template>
                <span v-else class="text-muted-foreground text-lg">-</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="pt-4 text-center">
              <p class="text-sm text-muted-foreground mb-1">Winner</p>
              <p class="text-2xl font-bold text-yellow-600">{{ stats.winnerCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="pt-4 text-center">
              <p class="text-sm text-muted-foreground mb-1">Medalist</p>
              <p class="text-2xl font-bold text-gray-500">{{ stats.medalistCount }}회</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent class="pt-4 text-center">
              <p class="text-sm text-muted-foreground mb-1">Host</p>
              <p class="text-2xl font-bold text-green-600">{{ stats.hostCount }}회</p>
            </CardContent>
          </Card>
        </div>

        <!-- 월별 히스토리 -->
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-xl">{{ currentMember.name }} 월별 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="overflow-x-auto">
              <Table class="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead class="font-bold text-foreground w-[12%] whitespace-nowrap">월</TableHead>
                    <TableHead class="font-bold text-foreground w-[16%] whitespace-nowrap">골프장</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">기준HC</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">당월HC</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">차월HC</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">Score</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">Net Score</TableHead>
                    <TableHead class="font-bold text-center w-[12%] whitespace-nowrap">결과</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="row in history"
                    :key="row.year_month"
                    class="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell class="font-medium whitespace-nowrap">{{ row.year_month }}</TableCell>
                    <TableCell class="whitespace-nowrap">{{ row.course_name }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">{{ row.std_hc }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">{{ row.app_hc }}</TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap">{{ row.next_hc }}</TableCell>

                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <template v-if="row.attended">{{ row.score }}</template>
                      <span v-else class="text-muted-foreground text-sm">불참</span>
                    </TableCell>

                    <TableCell class="text-center font-mono whitespace-nowrap">
                      <template v-if="row.attended && row.net_score !== null">
                        <span
                          :class="row.net_score >= 0
                            ? 'text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-orange-600 dark:text-orange-400'"
                        >
                          {{ row.net_score >= 0 ? '+' : '' }}{{ row.net_score }}
                        </span>
                      </template>
                      <span v-else class="text-muted-foreground text-sm">-</span>
                    </TableCell>

                    <TableCell class="text-center whitespace-nowrap">
                      <template v-if="getRankMeta(row.result_rank)">
                        <Badge :class="getRankMeta(row.result_rank)!.cls">
                          <component :is="getRankMeta(row.result_rank)!.icon" class="w-3 h-3 mr-1" />
                          {{ getRankMeta(row.result_rank)!.label }}
                        </Badge>
                      </template>
                      <Badge
                        v-else-if="row.result_group"
                        :variant="row.result_group === '1등조' ? 'default' : 'secondary'"
                      >
                        {{ row.result_group }}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <!-- PIN 변경 -->
        <Card class="max-w-md">
          <CardHeader class="pb-2">
            <CardTitle class="text-xl">PIN 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <form class="space-y-4" @submit="handleChangePin">
              <div class="space-y-2">
                <Label for="old-pin">기존 PIN</Label>
                <Input
                  id="old-pin"
                  type="password"
                  inputmode="numeric"
                  :maxlength="4"
                  :model-value="oldPin"
                  placeholder="기존 PIN 4자리"
                  @update:model-value="(v: string) => (oldPin = onlyDigits(v))"
                />
              </div>
              <div class="space-y-2">
                <Label for="new-pin">새 PIN</Label>
                <Input
                  id="new-pin"
                  type="password"
                  inputmode="numeric"
                  :maxlength="4"
                  :model-value="newPin"
                  placeholder="새 PIN 4자리"
                  @update:model-value="(v: string) => (newPin = onlyDigits(v))"
                />
              </div>
              <div class="space-y-2">
                <Label for="confirm-pin">새 PIN 확인</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputmode="numeric"
                  :maxlength="4"
                  :model-value="confirmPin"
                  placeholder="새 PIN 4자리 확인"
                  @update:model-value="(v: string) => (confirmPin = onlyDigits(v))"
                />
              </div>

              <Alert v-if="changePinError" variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ changePinError }}</AlertDescription>
              </Alert>

              <Alert v-if="changePinSuccess" class="border-primary bg-primary/10">
                <CheckCircle2 class="h-4 w-4 text-primary" />
                <AlertDescription class="text-primary">PIN이 성공적으로 변경되었습니다.</AlertDescription>
              </Alert>

              <Button type="submit" class="w-full">PIN 변경</Button>
            </form>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>
