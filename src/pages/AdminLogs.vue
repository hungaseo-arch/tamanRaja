<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { RefreshCw } from 'lucide-vue-next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useCompactTable } from '@/composables/useCompactTable';
import { MEMBERS } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import { describeError } from '@/lib/errors';
import { DASH } from '@/lib/format';
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
import RowDetailDialog from '@/components/ui/RowDetailDialog.vue';
import RowDetailButton from '@/components/ui/RowDetailButton.vue';
import DetailItem from '@/components/ui/DetailItem.vue';

/**
 * 접속 기록 (관리자 전용).
 *
 * 원본은 app.member_auth_events 이고, 이 화면은 public.auth_events RPC 로만
 * 읽는다 — 그 함수가 첫 줄에서 관리자 여부를 따진다. 아래 라우팅 가드는
 * 편의일 뿐 권한 경계가 아니다 (관리자가 아니면 RPC 가 거절한다).
 */

const router = useRouter();
const { isLoggedIn, isAdmin } = useAuth();

if (!isLoggedIn.value) router.replace(ROUTE_PATHS.HOME);
else if (!isAdmin.value) router.replace(ROUTE_PATHS.MONTHLY);

interface AuthEventRow {
  id: number;
  member_id: number;
  member_name: string;
  event: string;
  occurred_at: string;
  user_agent: string | null;
  /** 세션이 끝난 기록에만 있다. 그 세션이 열려 있던 시간(초). */
  duration_seconds: number | null;
  /** 본인이 아닌 사람이 일으킨 기록(pin_reset)의 행위자. 그때 기기는 행위자의 것이다. */
  actor_name?: string | null;
}

// 화면 문구와 색을 한 곳에 모은다. 서버가 새 값을 보내와도 뱃지가 비어
// 보이지 않도록 아래에서 기본값을 준다.
const EVENT_META = {
  login:        { label: '로그인',       variant: 'default'     },
  logout:       { label: '로그아웃',     variant: 'secondary'   },
  idle_timeout: { label: '자동 로그아웃', variant: 'outline'     },
  expired:      { label: '세션 만료',    variant: 'outline'     },
  login_failed: { label: 'PIN 실패',     variant: 'destructive' },
  locked:       { label: '잠금',         variant: 'destructive' },
  pin_reset:    { label: 'PIN 초기화',   variant: 'secondary'   },
} as const;

type EventKey = keyof typeof EVENT_META;

function eventMeta(event: string): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  return EVENT_META[event as EventKey] ?? { label: event, variant: 'outline' };
}

// ── 필터 ─────────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: '1',  label: '오늘' },
  { value: '7',  label: '최근 7일' },
  { value: '30', label: '최근 30일' },
  { value: '',   label: '전체 기간' },
] as const;

const memberFilter = ref('');
const periodFilter = ref('7');
const eventFilter = ref('');

const memberOptions = computed(() => [
  { value: '', label: '전체 회원' },
  ...[...MEMBERS]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.id, label: m.name })),
]);

const eventOptions = [
  { value: '', label: '전체 구분' },
  ...Object.entries(EVENT_META).map(([value, meta]) => ({ value, label: meta.label })),
];

/** 기간 필터의 시작 시각. '오늘' 은 24시간 전이 아니라 오늘 0시부터다. */
function periodStart(): string | null {
  const days = Number(periodFilter.value);
  if (!days) return null;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return from.toISOString();
}

// ── 조회 ─────────────────────────────────────────────────────────────────────
const rows = ref<AuthEventRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const ROW_LIMIT = 300;

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  const { data, error: rpcError } = await supabase.rpc('auth_events', {
    p_member_id: memberFilter.value ? Number(memberFilter.value) : null,
    p_from: periodStart(),
    p_to: null,
    p_event: eventFilter.value || null,
    p_limit: ROW_LIMIT,
  });

  if (rpcError) {
    // 권한 없음(42501)도 그대로 보여준다. 빈 표로 두면 기록이 없는 것과
    // 구분되지 않는다.
    error.value = describeError(rpcError, '접속 기록 불러오기 실패');
    rows.value = [];
  } else {
    rows.value = (data ?? []) as AuthEventRow[];
  }
  loading.value = false;
}

watch([memberFilter, periodFilter, eventFilter], () => void load());
onMounted(() => void load());

// ── 표기 ─────────────────────────────────────────────────────────────────────
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 표에 넣는 짧은 형태. 같은 해가 대부분이라 연도는 상세 창에서만 보여준다. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhenFull(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 세션이 열려 있던 시간. 로그인 기록에는 없다(아직 안 끝났거나 짝이 없음). */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return DASH;
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

/**
 * user-agent 원문 대신 기기 한 줄. 원문은 상세 창에서 그대로 볼 수 있다.
 * 판정 순서가 중요하다 — Edge 는 자기 문자열에 Chrome 을, Chrome 은 Safari 를
 * 함께 달고 다닌다.
 */
function formatDevice(ua: string | null): string {
  if (!ua) return DASH;
  const os =
    /iPhone/.test(ua)     ? '아이폰'
    : /iPad/.test(ua)     ? '아이패드'
    : /Android/.test(ua)  ? '안드로이드'
    : /Macintosh|Mac OS/.test(ua) ? '맥'
    : /Windows/.test(ua)  ? '윈도우'
    : '기타';
  const browser =
    /Edg\//.test(ua)            ? 'Edge'
    : /CriOS|Chrome/.test(ua)   ? 'Chrome'
    : /FxiOS|Firefox/.test(ua)  ? 'Firefox'
    : /Safari/.test(ua)         ? 'Safari'
    : '';
  return browser ? `${os} · ${browser}` : os;
}

// ── 줄 상세 ──────────────────────────────────────────────────────────────────
// 좁은 화면에서는 체류·기기 열이 숨는다. 시각을 누르면 그 줄을 통째로 본다.
const compact = useCompactTable('sm');
const detailRow = ref<AuthEventRow | null>(null);
const detailOpen = ref(false);

function openDetail(row: AuthEventRow): void {
  detailRow.value = row;
  detailOpen.value = true;
}

watch(compact, (isCompact) => {
  if (!isCompact) detailOpen.value = false;
});
</script>

<template>
  <div class="w-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-5xl space-y-3">
      <div class="flex items-center gap-2 pt-1">
        <h1 class="text-lg font-bold text-foreground mr-auto">
          접속 기록 <span class="text-muted-foreground font-medium text-sm">— 관리자</span>
        </h1>
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 gap-1"
          :disabled="loading"
          aria-label="접속 기록 다시 불러오기"
          @click="load()"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
          <span class="hidden sm:inline">새로고침</span>
        </Button>
      </div>

      <!-- 필터. 좁은 화면에서는 두 줄로 접힌다. -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Select
          v-model="memberFilter"
          :options="memberOptions"
          :placeholder="''"
          size="xs"
          aria-label="회원으로 거르기"
        />
        <Select
          v-model="periodFilter"
          :options="[...PERIODS]"
          :placeholder="''"
          size="xs"
          aria-label="기간으로 거르기"
        />
        <Select
          v-model="eventFilter"
          :options="eventOptions"
          :placeholder="''"
          size="xs"
          class="col-span-2 sm:col-span-1"
          aria-label="구분으로 거르기"
        />
      </div>

      <Card class="w-min min-w-full">
        <CardContent class="px-2 sm:px-6">
          <AsyncState
            :loading="loading"
            :error="error"
            :empty="rows.length === 0"
            label="접속 기록"
            :skeleton-rows="8"
            empty-title="해당 조건의 기록 없음"
            empty-hint="기간 확대 또는 필터 해제"
            container-class="py-6"
            @retry="load()"
          >
            <div class="pt-4">
              <Table
                :scroll="false"
                class="text-xs sm:text-sm [&_thead_th]:bg-muted [&_thead_th]:text-foreground"
                caption="회원별 로그인·로그아웃 이력"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead class="font-bold text-foreground whitespace-nowrap">시각</TableHead>
                    <TableHead class="font-bold text-foreground whitespace-nowrap">회원</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">구분</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">접속 시간</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">기기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in rows" :key="row.id" class="hover:bg-muted/50 transition-colors">
                    <TableCell class="font-mono whitespace-nowrap">
                      <RowDetailButton
                        :label="`${row.member_name} ${formatWhen(row.occurred_at)}`"
                        :enabled="compact"
                        @click="openDetail(row)"
                      >{{ formatWhen(row.occurred_at) }}</RowDetailButton>
                    </TableCell>
                    <TableCell class="font-medium whitespace-nowrap">{{ row.member_name }}</TableCell>
                    <TableCell class="text-center whitespace-nowrap">
                      <Badge :variant="eventMeta(row.event).variant">{{ eventMeta(row.event).label }}</Badge>
                    </TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">
                      {{ formatDuration(row.duration_seconds) }}
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap hidden sm:table-cell text-muted-foreground">
                      <template v-if="row.actor_name">{{ row.actor_name }} 처리 · </template>{{ formatDevice(row.user_agent) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <p class="text-xs text-muted-foreground mt-2 px-4">
                {{ rows.length }}건
                <template v-if="rows.length >= ROW_LIMIT">
                  (최근 {{ ROW_LIMIT }}건까지만 표시 — 기간 축소 필요)
                </template>
                · 기록 180일 보관
              </p>
            </div>
          </AsyncState>
        </CardContent>
      </Card>

      <RowDetailDialog
        v-model:open="detailOpen"
        :title="detailRow ? detailRow.member_name : ''"
        :subtitle="detailRow ? eventMeta(detailRow.event).label : ''"
      >
        <template v-if="detailRow">
          <DetailItem label="시각">
            <span class="font-mono">{{ formatWhenFull(detailRow.occurred_at) }}</span>
          </DetailItem>
          <DetailItem label="구분">
            <Badge :variant="eventMeta(detailRow.event).variant">{{ eventMeta(detailRow.event).label }}</Badge>
          </DetailItem>
          <DetailItem label="접속 시간">
            <span class="font-mono">{{ formatDuration(detailRow.duration_seconds) }}</span>
          </DetailItem>
          <DetailItem v-if="detailRow.actor_name" label="처리한 관리자">{{ detailRow.actor_name }}</DetailItem>
          <DetailItem :label="detailRow.actor_name ? '처리 기기' : '기기'">{{ formatDevice(detailRow.user_agent) }}</DetailItem>
          <DetailItem label="기기 원문">
            <span class="text-xs text-muted-foreground wrap-break-word">{{ detailRow.user_agent ?? DASH }}</span>
          </DetailItem>
        </template>
      </RowDetailDialog>
    </div>
  </div>
</template>
