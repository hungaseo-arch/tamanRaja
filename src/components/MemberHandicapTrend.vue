<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import AsyncState from '@/components/ui/AsyncState.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';

// 나의 기록 : 연도별 기준핸디 추이. handicap_annual 의 본인 행만 읽는다 (DB 변경 없음).
// 확정 전(draft) 연도는 '안' 으로 표시한다.
const props = defineProps<{ memberId: string | number }>();

interface YearRow {
  year: number;
  std_hc: number;
  prev_std_hc: number | null;
  status: string;
}

const rows = ref<YearRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  const id = Number(props.memberId);
  if (!Number.isInteger(id)) {
    // 회원 ID 를 정수로 읽지 못하면 남의 행을 잘못 보여 주지 않도록 조회하지 않는다.
    rows.value = [];
    loading.value = false;
    return;
  }
  const { data, error: err } = await supabase
    .from('handicap_annual')
    .select('year, std_hc, prev_std_hc, status')
    .eq('member_id', id)
    .order('year', { ascending: true });
  loading.value = false;
  if (err) {
    error.value = err.message;
    rows.value = [];
    return;
  }
  rows.value = (data ?? []).map((r) => ({
    year: Number(r.year),
    std_hc: Number(r.std_hc),
    prev_std_hc: r.prev_std_hc === null || r.prev_std_hc === undefined ? null : Number(r.prev_std_hc),
    status: String(r.status),
  }));
}

onMounted(load);
watch(() => props.memberId, load);

/** 표에 보이는 줄: 전년 대비 증감을 함께 계산한다 (전년 기준핸디가 비면 바로 앞 연도 값을 쓴다). */
const view = computed(() =>
  rows.value.map((r, i) => {
    const base = r.prev_std_hc ?? (i > 0 ? rows.value[i - 1].std_hc : null);
    return { ...r, delta: base === null ? null : r.std_hc - base, draft: r.status !== 'confirmed' };
  }),
);

function fmtDelta(d: number | null): string {
  if (d === null) return '—';
  if (d === 0) return '0';
  return `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
}
function deltaLabel(d: number | null): string {
  return d === null || d === 0 ? '' : d > 0 ? '인상' : '인하';
}

// 꺾은선: 가로는 연도 순서, 세로는 핸디 (값이 클수록 위). 점이 하나여도 그린다.
const W = 300;
const H = 100;
const PAD_X = 22;
const PAD_TOP = 24; // 값 라벨이 잘리지 않도록 위를 넉넉히
const PAD_BOTTOM = 18; // 연도 글자 자리
const chart = computed(() => {
  const v = view.value;
  if (v.length === 0) return null;
  const vals = v.map((r) => r.std_hc);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const pts = v.map((r, i) => ({
    x: v.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (v.length - 1),
    // 값이 모두 같으면 가운데 높이에 그린다.
    y: span === 0 ? PAD_TOP + plotH / 2 : PAD_TOP + ((hi - r.std_hc) * plotH) / span,
    year: r.year,
    hc: r.std_hc,
    draft: r.draft,
  }));
  return { pts, line: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') };
});
const ariaLabel = computed(
  () => '연도별 기준핸디 추이: ' + view.value.map((r) => `${r.year}년 ${r.std_hc}${r.draft ? '(안)' : ''}`).join(', '),
);
</script>

<template>
  <Card v-if="loading || error || view.length > 0">
    <CardContent class="py-3 px-3 sm:px-4">
      <h2 class="text-sm font-bold m-0 mb-2">연도별 기준핸디 추이</h2>
      <!-- 불러오는 중·실패는 다른 화면과 같은 AsyncState 로 그린다. 실패 사유는 그대로 보인다. -->
      <AsyncState :loading="loading" :error="error" label="연도별 기준핸디 추이" container-class="py-3" @retry="load">
        <template v-if="chart">
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="block w-full max-w-md h-auto mx-auto mb-2 text-primary"
            role="img"
            :aria-label="ariaLabel"
            preserveAspectRatio="xMidYMid meet"
          >
            <polyline v-if="chart.pts.length > 1" :points="chart.line" fill="none" stroke-width="2" class="stroke-current" />
            <g v-for="p in chart.pts" :key="p.year">
              <circle
                :cx="p.x"
                :cy="p.y"
                r="4"
                :class="p.draft ? 'fill-background stroke-current stroke-2' : 'fill-current'"
              />
              <text :x="p.x" :y="p.y - 8" text-anchor="middle" class="fill-current text-[10px] font-bold">{{ p.hc }}</text>
              <text :x="p.x" :y="H - 1" text-anchor="middle" class="fill-muted-foreground text-[9px]">{{ p.year }}</text>
            </g>
          </svg>
          <Table :scroll="false" class="text-xs sm:text-sm" caption="연도별 기준핸디와 전년 대비 증감">
            <TableHeader>
              <TableRow>
                <TableHead class="static text-center font-semibold text-foreground px-1.5 py-1.5">연도</TableHead>
                <TableHead class="static text-center font-semibold text-foreground px-1.5 py-1.5">기준핸디</TableHead>
                <TableHead class="static text-center font-semibold text-foreground px-1.5 py-1.5">전년 대비</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody class="[&_tr:last-child>th]:border-0">
              <TableRow v-for="r in view" :key="r.year">
                <TableHead scope="row" class="static text-center px-1.5 py-1.5 font-bold text-foreground">
                  {{ r.year }}<span v-if="r.draft" class="ml-1 text-[11px] text-muted-foreground">안</span>
                </TableHead>
                <TableCell class="text-center font-mono font-bold px-1.5 py-1.5">{{ r.std_hc }}</TableCell>
                <TableCell class="text-center font-mono px-1.5 py-1.5">
                  {{ fmtDelta(r.delta) }}<span v-if="deltaLabel(r.delta)" class="ml-1 font-sans text-[11px] text-muted-foreground">{{ deltaLabel(r.delta) }}</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-if="view.some((r) => r.draft)" class="text-xs text-muted-foreground m-0 mt-1">'안' 표시는 확정 전 값입니다.</p>
        </template>
      </AsyncState>
    </CardContent>
  </Card>
</template>
