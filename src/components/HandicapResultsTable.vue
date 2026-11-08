<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import { supabase } from '@/lib/supabase';

// 회원별 2027 기준핸디 산정결과(안). v_handicap_annual 에서 year=2027 을 읽는다.
// 값은 DB 에 적재된 그대로 보여 주고 화면에서 다시 계산하지 않는다.
interface Row {
  member_id: number;
  member_name: string;
  prev_std_hc: number | null;
  /** 비교자료: 2025년 기준핸디 (year=2025 행에서 가져온다. 없으면 null) */
  std_hc_2025?: number | null;
  std_hc: number;
  w_sum: number | null;
  w_avg: number | null;
  avg_a: number | null;
  avg_b: number | null;
  avg_c: number | null;
  award_adj: number | null;
  calc_hc: number | null;
  attend_rate: number | null;
  apply_rate: number | null;
  raw_delta: number | null;
  final_delta: number | null;
  capped: boolean;
  low_sample: boolean;
  note: string | null;
  status: string;
}

const YEAR = 2027;
const COMPARE_YEAR = 2025;
const rows = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const NUMERIC_KEYS = [
  'w_sum', 'w_avg', 'avg_a', 'avg_b', 'avg_c', 'award_adj', 'calc_hc',
  'attend_rate', 'apply_rate', 'raw_delta', 'final_delta',
] as const;

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  const { data, error: err } = await supabase
    .from('v_handicap_annual')
    .select('*')
    .in('year', [COMPARE_YEAR, YEAR]);
  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
  // numeric 열이 문자열로 올 수 있어 숫자로 맞춘다 (null 은 그대로 둔다).
  const all = data ?? [];
  const std2025 = new Map<number, number>(
    all.filter((r) => r.year === COMPARE_YEAR).map((r) => [r.member_id as number, Number(r.std_hc)]),
  );
  rows.value = all
    .filter((r) => r.year === YEAR)
    .map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const k of NUMERIC_KEYS) out[k] = r[k] === null || r[k] === undefined ? null : Number(r[k]);
      out.std_hc_2025 = std2025.get(r.member_id as number) ?? null;
      return out as unknown as Row;
    });
}
onMounted(load);

// ── 정렬 ─────────────────────────────────────────────────────────────────────
type SortKey = 'member_name' | 'std_hc_2025' | 'prev_std_hc' | 'std_hc' | 'final_delta' | 'w_avg' | 'attend_rate';
const sortKey = ref<SortKey>('std_hc');
const sortAsc = ref(true);

function setSort(key: SortKey): void {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value;
  else {
    sortKey.value = key;
    sortAsc.value = true;
  }
}

const sorted = computed(() => {
  const k = sortKey.value;
  const dir = sortAsc.value ? 1 : -1;
  return [...rows.value].sort((a, b) => {
    const av = a[k];
    const bv = b[k];
    let c: number;
    if (typeof av === 'string' || typeof bv === 'string') c = String(av).localeCompare(String(bv), 'ko');
    else c = (av ?? 0) - (bv ?? 0);
    // 같은 값이면 기준핸디, 이름 순으로 고정해 정렬이 흔들리지 않게 한다.
    return c * dir || a.std_hc - b.std_hc || a.member_name.localeCompare(b.member_name, 'ko');
  });
});

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortAsc.value ? 'ascending' : 'descending';
}

// ── 펼침 ─────────────────────────────────────────────────────────────────────
const expanded = ref<Set<number>>(new Set());
function toggle(id: number): void {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

// ── 표기 ─────────────────────────────────────────────────────────────────────
const MINUS = '−'; // 지시서 표기와 같은 − (U+2212)

function fmt(v: number | null, digits = 1): string {
  return v === null ? '—' : v.toFixed(digits);
}
function fmtSigned(v: number | null): string {
  if (v === null) return '—';
  const t = Math.abs(v).toFixed(1);
  if (v > 0) return `+${t}`;
  if (v < 0) return `${MINUS}${t}`;
  return t;
}
// 시상보정은 소수 둘째 자리까지 쓰는 열이라 별도 포맷터를 둔다.
function fmtSigned2(v: number | null): string {
  if (v === null) return '—';
  const t = Math.abs(v).toFixed(2);
  if (v > 0) return `+${t}`;
  if (v < 0) return `${MINUS}${t}`;
  return t;
}
/** 증감 부호에 따른 글자색 클래스 (+ 붉은색, − 파란색, 0 중립). */
function deltaClass(v: number | null): string {
  if (v === null || v === 0) return '';
  return v > 0 ? 'pp-up' : 'pp-down';
}
/** 색만으로 뜻을 전달하지 않도록 붙이는 문자 라벨. */
function deltaLabel(v: number | null): string {
  if (v === null) return '';
  if (v > 0) return '인상';
  if (v < 0) return '인하';
  return '유지';
}

const totalPrev = computed(() => rows.value.reduce((s, r) => s + (r.prev_std_hc ?? 0), 0));
const totalStd = computed(() => rows.value.reduce((s, r) => s + r.std_hc, 0));
const totalLabel = computed(() => {
  if (totalStd.value === totalPrev.value) return '중립';
  return totalStd.value > totalPrev.value ? '증가' : '감소';
});

const COLS: { key: SortKey; label: string; cls: string }[] = [
  { key: 'member_name', label: '성명', cls: '' },
  { key: 'std_hc_2025', label: '2025 기준', cls: 'num pp-hide-sm' },
  { key: 'prev_std_hc', label: '2026 기준', cls: 'num pp-hide-sm' },
  { key: 'std_hc', label: '2027 기준', cls: 'num' },
  { key: 'final_delta', label: '증감', cls: 'num' },
  { key: 'w_avg', label: '가중평균', cls: 'num pp-hide-sm' },
  { key: 'attend_rate', label: '참석률', cls: 'num pp-hide-sm' },
];
</script>

<template>
  <div>
    <p v-if="loading" class="policy-note" role="status">산정결과 불러오는 중</p>
    <p v-else-if="error" class="policy-note" role="alert">
      산정결과 불러오기 실패 : {{ error }}
      <button type="button" class="policy-link" @click="load">다시 시도</button>
    </p>
    <p v-else-if="rows.length === 0" class="policy-note">표시할 산정결과 없음</p>

    <template v-else>
      <p class="policy-note mt-0 mb-2">
        행 선택 시 산정 근거(구간별 평균·가중합·시상보정·산출핸디 등) 표시. 열 제목 선택 시 정렬 변경
      </p>
      <div class="policy-table-wrap">
        <table class="policy-table pp-results">
          <thead>
            <tr>
              <th
                v-for="c in COLS"
                :key="c.key"
                scope="col"
                :class="c.cls"
                :aria-sort="ariaSort(c.key)"
              >
                <button type="button" class="pp-sort" @click="setSort(c.key)">
                  {{ c.label }}
                  <span aria-hidden="true">{{ sortKey === c.key ? (sortAsc ? '▲' : '▼') : '' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in sorted" :key="r.member_id">
              <tr class="pp-row">
                <th scope="row">
                  <button
                    type="button"
                    class="pp-expand"
                    :aria-expanded="expanded.has(r.member_id)"
                    :aria-controls="`pp-detail-${r.member_id}`"
                    @click="toggle(r.member_id)"
                  >
                    <ChevronRight
                      class="pp-chevron"
                      :class="{ 'rotate-90': expanded.has(r.member_id) }"
                      aria-hidden="true"
                    />
                    <span>{{ r.member_name }}</span>
                  </button>
                  <span v-if="r.capped" class="policy-flag">한도</span>
                  <span v-if="r.low_sample" class="policy-flag">표본부족</span>
                </th>
                <td class="num pp-hide-sm">{{ r.std_hc_2025 ?? '—' }}</td>
                <td class="num pp-hide-sm">{{ r.prev_std_hc ?? '—' }}</td>
                <td class="num pp-std">{{ r.std_hc }}</td>
                <td class="num" :class="deltaClass(r.final_delta)">
                  {{ fmtSigned(r.final_delta) }}
                  <span class="pp-delta-label">{{ deltaLabel(r.final_delta) }}</span>
                </td>
                <td class="num pp-hide-sm">{{ fmt(r.w_avg) }}</td>
                <td class="num pp-hide-sm">{{ fmt(r.attend_rate) }}%</td>
              </tr>
              <tr v-show="expanded.has(r.member_id)" :id="`pp-detail-${r.member_id}`" class="pp-detail">
                <td colspan="7">
                  <dl class="pp-dl">
                    <div class="pp-show-sm"><dt>2025 기준</dt><dd>{{ r.std_hc_2025 ?? '—' }}</dd></div>
                    <div class="pp-show-sm"><dt>2026 기준</dt><dd>{{ r.prev_std_hc ?? '—' }}</dd></div>
                    <div class="pp-show-sm"><dt>가중평균</dt><dd>{{ fmt(r.w_avg) }}</dd></div>
                    <div class="pp-show-sm"><dt>참석률</dt><dd>{{ fmt(r.attend_rate) }}%</dd></div>
                    <div><dt>A 구간 평균</dt><dd>{{ fmt(r.avg_a) }}</dd></div>
                    <div><dt>B 구간 평균</dt><dd>{{ fmt(r.avg_b) }}</dd></div>
                    <div><dt>C 구간 평균</dt><dd>{{ fmt(r.avg_c) }}</dd></div>
                    <div><dt>가중합</dt><dd>{{ fmt(r.w_sum, 2) }}</dd></div>
                    <div><dt>시상보정</dt><dd>{{ fmtSigned2(r.award_adj) }}</dd></div>
                    <div><dt>산출핸디</dt><dd>{{ fmt(r.calc_hc) }}</dd></div>
                    <div><dt>참석률 반영률</dt><dd>{{ r.apply_rate === null ? '—' : (r.apply_rate * 100).toFixed(1) + '%' }}</dd></div>
                    <div>
                      <dt>한도 적용 전 증감</dt>
                      <dd :class="deltaClass(r.raw_delta)">{{ fmtSigned(r.raw_delta) }}</dd>
                    </div>
                    <div>
                      <dt>한도 적용 후 증감</dt>
                      <dd :class="deltaClass(r.final_delta)">{{ fmtSigned(r.final_delta) }}</dd>
                    </div>
                  </dl>
                  <p v-if="r.capped" class="pp-detail-note pp-up">
                    한도 적용 : 적용 전 {{ fmtSigned(r.raw_delta) }} → 적용 후 {{ fmtSigned(r.final_delta) }}
                  </p>
                  <p v-if="r.note" class="pp-detail-note">
                    <span v-if="r.low_sample" class="pp-up">표본 부족 · </span>{{ r.note }}
                  </p>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="7">
                <strong>핸디 총합 {{ totalPrev }} → {{ totalStd }} ({{ totalLabel }})</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>

<style>
.pp-up {
  color: var(--pp-up);
}
.pp-down {
  color: var(--pp-down);
}
.pp-std {
  /* 앱 공통 규칙: 기준 핸디는 주황 */
  color: #c2410c;
  font-weight: 700;
}
.pp-delta-label {
  display: block;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
}
.pp-results th,
.pp-results td {
  padding: 0.4rem 0.5rem;
}
.pp-results tbody th {
  font-weight: 600;
}
.pp-sort,
.pp-expand {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: inherit;
}
.pp-sort:focus-visible,
.pp-expand:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.pp-chevron {
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
  transition: transform 0.15s;
}
.pp-detail td {
  background: var(--pp-blue);
  border-bottom: 1px solid var(--pp-border);
}
.pp-dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem 0.75rem;
  margin: 0;
  font-size: 0.8125rem;
}
.pp-dl dt {
  font-size: 0.75rem;
}
.pp-dl dd {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 600;
}
.pp-detail-note {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  font-weight: 600;
}
.pp-results tfoot td {
  background: var(--pp-sage);
  border-top: 1px solid var(--pp-border);
  text-align: right;
}
/* 좁은 화면: 성명 · 2027 기준 · 증감 세 열만 남기고 나머지는 행 펼침에서 본다. */
.pp-hide-sm {
  display: none;
}
@media (min-width: 640px) {
  .pp-hide-sm {
    display: table-cell;
  }
  .pp-show-sm {
    display: none;
  }
  .pp-dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media print {
  .pp-detail {
    display: table-row !important;
  }
  .pp-chevron {
    display: none;
  }
}
</style>
