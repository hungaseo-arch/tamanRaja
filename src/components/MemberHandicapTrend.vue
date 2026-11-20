<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import AsyncState from '@/components/ui/AsyncState.vue';

// 나의 기록 : 연도별 기준핸디 추이. handicap_annual 의 본인 행만 읽는다 (DB 변경 없음).
// 표 없이 꺾은선 그래프만 둔다. 확정 전(draft) 연도는 속이 빈 점으로 표시한다. 본인 행이 하나도 없으면 카드는 두고 안내 한 줄을 보인다.
const props = defineProps<{ memberId: string | number }>();

interface YearRow {
  year: number;
  std_hc: number;
  prev_std_hc: number | null;
  status: string;
}

/** 2026년은 7월에 전 회원 기준핸디를 새로 정했다. 상·하반기 값이 다르면 점을 둘로 나눈다. */
const SPLIT_YEAR = 2026;
const SPLIT_FROM = `${SPLIT_YEAR}-07`;
const halves = ref<{ first: number; second: number } | null>(null);

const rows = ref<YearRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// 회원이 연달아 바뀌면 먼저 보낸 요청의 늦은 응답이 나중 결과를 덮지 않게 한다.
let loadSeq = 0;

async function load(): Promise<void> {
  const seq = ++loadSeq;
  loading.value = true;
  error.value = null;
  const id = Number(props.memberId);
  if (!Number.isInteger(id)) {
    // 회원 ID 를 정수로 읽지 못하면 남의 행을 잘못 보여 주지 않도록 조회하지 않는다.
    rows.value = [];
    halves.value = null;
    loading.value = false;
    return;
  }
  const [annual, monthly] = await Promise.all([
    supabase
      .from('handicap_annual')
      .select('year, std_hc, prev_std_hc, status')
      .eq('member_id', id)
      .order('year', { ascending: true }),
    supabase
      .from('monthly_handicaps')
      .select('year_month, std_hc')
      .eq('member_id', id)
      .gte('year_month', `${SPLIT_YEAR}-01`)
      .lte('year_month', `${SPLIT_YEAR}-12`)
      .order('year_month', { ascending: true }),
  ]);
  const { data, error: err } = annual;
  if (seq !== loadSeq) return;
  // 월별 기준핸디는 보조 정보다. 못 읽어도 연도 점은 그대로 그린다.
  const m = monthly.error ? [] : (monthly.data ?? []);
  const before = m.filter((r) => String(r.year_month) < SPLIT_FROM);
  const after = m.filter((r) => String(r.year_month) >= SPLIT_FROM);
  halves.value =
    before.length > 0 && after.length > 0
      ? { first: Number(before[before.length - 1].std_hc), second: Number(after[0].std_hc) }
      : null;
  loading.value = false;
  if (err) {
    // 서버 원문(영문)은 그대로 보이지 않고 한국어 안내로 바꾼다.
    error.value = '연도별 기준핸디 추이 불러오기 실패. 잠시 후 다시 시도';
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

/** 그래프에 그리는 줄. 확정되지 않은 연도는 draft 로 표시한다. */
const view = computed(() =>
  rows.value.flatMap((r) => {
    const draft = r.status !== 'confirmed';
    const h = halves.value;
    if (r.year === SPLIT_YEAR && h && h.first !== h.second) {
      return [
        { ...r, std_hc: h.first, draft, half: '상반기' },
        { ...r, std_hc: h.second, draft, half: '하반기' },
      ];
    }
    return [{ ...r, draft, half: '' }];
  }),
);

// 꺾은선: 가로는 연도 순서, 세로는 핸디 (값이 클수록 위). 점이 하나여도 그린다.
const W = 300;
const BASE_H = 100;
const PAD_X = 22;
const PAD_TOP = 24; // 값 라벨이 잘리지 않도록 위를 넉넉히
const PAD_BOTTOM = 18; // 연도 글자 자리 (상·하반기 점은 아래 한 줄 더)
const HALF_EXTRA = 10;
const hasHalf = computed(() => view.value.some((r) => r.half));
const H = computed(() => BASE_H + (hasHalf.value ? HALF_EXTRA : 0));
const chart = computed(() => {
  const v = view.value;
  if (v.length === 0) return null;
  const vals = v.map((r) => r.std_hc);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo;
  const plotH = BASE_H - PAD_TOP - PAD_BOTTOM;
  const pts = v.map((r, i) => ({
    x: v.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (v.length - 1),
    // 값이 모두 같으면 가운데 높이에 그린다.
    y: span === 0 ? PAD_TOP + plotH / 2 : PAD_TOP + ((hi - r.std_hc) * plotH) / span,
    year: r.year,
    half: r.half,
    hc: r.std_hc,
    draft: r.draft,
  }));
  return { pts, line: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') };
});
const ariaLabel = computed(
  () => '연도별 기준핸디 추이: ' + view.value.map((r) => `${r.year}년${r.half ? ' ' + r.half : ''} ${r.std_hc}${r.draft ? '(안)' : ''}`).join(', '),
);
</script>

<template>
  <Card>
    <CardContent class="py-3 px-3 sm:px-4">
      <h2 class="text-sm font-bold m-0 mb-2">연도별 기준핸디 추이</h2>
      <!-- 불러오는 중·실패는 다른 화면과 같은 AsyncState 로 그린다. 실패 사유는 그대로 보인다. -->
      <AsyncState
        :loading="loading"
        :error="error"
        :empty="view.length === 0"
        label="연도별 기준핸디 추이"
        container-class="py-3"
        empty-title="표시할 기준핸디 추이 없음"
        empty-hint="연도별 기준핸디 산정 결과가 등록되면 표시"
        @retry="load"
      >
        <template v-if="chart">
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="block w-full max-w-md h-auto mx-auto text-primary"
            role="img"
            :aria-label="ariaLabel"
            preserveAspectRatio="xMidYMid meet"
          >
            <polyline v-if="chart.pts.length > 1" :points="chart.line" fill="none" stroke-width="2" class="stroke-current" />
            <g v-for="p in chart.pts" :key="p.year + p.half">
              <circle
                :cx="p.x"
                :cy="p.y"
                r="4"
                :class="p.draft ? 'fill-background stroke-current stroke-2' : 'fill-current'"
              />
              <text :x="p.x" :y="p.y - 8" text-anchor="middle" class="fill-current text-[9px] font-bold">{{ p.hc }}</text>
              <text :x="p.x" :y="hasHalf ? H - 11 : H - 1" text-anchor="middle" class="fill-muted-foreground text-[8.5px]">{{ p.year }}</text>
              <text v-if="p.half" :x="p.x" :y="H - 1" text-anchor="middle" class="fill-muted-foreground text-[8.5px]">{{ p.half }}</text>
            </g>
          </svg>
        </template>
      </AsyncState>
    </CardContent>
  </Card>
</template>
