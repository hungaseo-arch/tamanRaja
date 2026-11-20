<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';

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
  <Card v-if="loading || error || view.length > 0" class="pp-trend">
    <CardContent class="py-3 px-3 sm:px-4">
      <h2 class="text-sm font-bold m-0 mb-2">연도별 기준핸디 추이</h2>
      <p v-if="loading" class="text-xs text-muted-foreground m-0">불러오는 중</p>
      <p v-else-if="error" class="text-xs text-muted-foreground m-0" role="alert">
        불러오기 실패 : {{ error }}
        <button type="button" class="underline" @click="load">다시 시도</button>
      </p>
      <template v-else-if="chart">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="pp-trend-svg"
          role="img"
          :aria-label="ariaLabel"
          preserveAspectRatio="xMidYMid meet"
        >
          <polyline v-if="chart.pts.length > 1" :points="chart.line" fill="none" stroke="currentColor" stroke-width="2" class="pp-trend-line" />
          <g v-for="p in chart.pts" :key="p.year">
            <circle :cx="p.x" :cy="p.y" r="4" :class="p.draft ? 'pp-trend-dot-draft' : 'pp-trend-dot'" />
            <text :x="p.x" :y="p.y - 8" text-anchor="middle" class="pp-trend-hc">{{ p.hc }}</text>
            <text :x="p.x" :y="H - 1" text-anchor="middle" class="pp-trend-year">{{ p.year }}</text>
          </g>
        </svg>
        <table class="pp-trend-table">
          <thead>
            <tr>
              <th scope="col">연도</th>
              <th scope="col">기준핸디</th>
              <th scope="col">전년 대비</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in view" :key="r.year">
              <th scope="row">{{ r.year }}<span v-if="r.draft" class="pp-trend-draft">안</span></th>
              <td class="font-mono font-bold">{{ r.std_hc }}</td>
              <td class="font-mono">
                {{ fmtDelta(r.delta) }}<span v-if="deltaLabel(r.delta)" class="pp-trend-label">{{ deltaLabel(r.delta) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="view.some((r) => r.draft)" class="text-xs text-muted-foreground m-0 mt-1">'안' 표시는 확정 전 값입니다.</p>
      </template>
    </CardContent>
  </Card>
</template>

<style>
.pp-trend-svg {
  display: block;
  width: 100%;
  max-width: 28rem;
  height: auto;
  margin: 0 auto 0.5rem;
  color: var(--color-primary, #15803d);
}
.pp-trend-dot {
  fill: currentColor;
}
.pp-trend-dot-draft {
  fill: var(--color-background, #fff);
  stroke: currentColor;
  stroke-width: 2;
}
.pp-trend-hc {
  font-size: 10px;
  font-weight: 700;
  fill: currentColor;
}
.pp-trend-year {
  font-size: 9px;
  fill: var(--color-muted-foreground, #6b7280);
}
.pp-trend-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.pp-trend-table th,
.pp-trend-table td {
  padding: 0.25rem 0.375rem;
  text-align: center;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
.pp-trend-table thead th {
  font-weight: 600;
  color: var(--color-muted-foreground, #6b7280);
  border-top: 0;
}
.pp-trend-draft,
.pp-trend-label {
  margin-left: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted-foreground, #6b7280);
}
</style>
