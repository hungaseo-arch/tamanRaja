<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { describeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import AsyncState from '@/components/ui/AsyncState.vue';
import Dialog from '@/components/ui/Dialog.vue';
import RowDetailDialog from '@/components/ui/RowDetailDialog.vue';
import DetailItem from '@/components/ui/DetailItem.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

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
  /** 가중 시상횟수와 시상 원점수 (마이그레이션 20261108000400 적용 전에는 null) */
  w_win?: number | null;
  w_med?: number | null;
  w_host?: number | null;
  award_raw?: number | null;
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
  /** 휴면 개시 연월 (없으면 null). 휴면 뱃지에 쓴다. */
  dormant_from?: string | null;
  /** 인간미 보정 (정수 -2~+2, 미입력 null). handicap_humanity 에서 가져온다. */
  humanity?: number | null;
}

// 인간미 보정 범위. 서버(handicap_humanity CHECK · save_handicap_humanity)도 같은 범위로 다시 검증한다.
const HUMANITY_MIN = -2;
const HUMANITY_MAX = 2;

const YEAR = 2027;
const COMPARE_YEAR = 2025;
const rows = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const NUMERIC_KEYS = [
  'w_sum', 'w_win', 'w_med', 'w_host', 'award_raw', 'w_avg', 'avg_a', 'avg_b', 'avg_c', 'award_adj', 'calc_hc',
  'attend_rate', 'apply_rate', 'raw_delta', 'final_delta',
] as const;

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  // 두 조회는 서로 의존하지 않으므로 병렬로 보낸다.
  // 인간미는 별도 테이블이다. 아직 마이그레이션 전이거나 읽기에 실패해도 산정결과 표는 그대로 보여 준다.
  const [{ data, error: err }, hum] = await Promise.all([
    supabase.from('v_handicap_annual').select('*').in('year', [COMPARE_YEAR, YEAR]),
    supabase.from('handicap_humanity').select('member_id, adj').eq('year', YEAR),
  ]);
  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
  const humMap = new Map<number, number>(
    (hum.error ? [] : (hum.data ?? [])).map((h) => [h.member_id as number, Number(h.adj)]),
  );
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
      out.humanity = humMap.get(r.member_id as number) ?? null;
      return out as unknown as Row;
    });
}
onMounted(load);

// ── 정렬 ─────────────────────────────────────────────────────────────────────
type SortKey =
  | 'member_name' | 'std_hc_2025' | 'prev_std_hc' | 'std_hc' | 'humanity' | 'proposal'
  | 'final_delta' | 'w_avg' | 'attend_rate';
const sortKey = ref<SortKey>('std_hc');
const sortAsc = ref(true);

function setSort(key: SortKey): void {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value;
  else {
    sortKey.value = key;
    sortAsc.value = true;
  }
}

// 2027 제안 = 2027 기준 + 인간미 (미입력은 0). 수정 중에는 입력 중인 값으로 바로 더한다.
function humanityOf(r: Row): number | null {
  if (editing.value) {
    const d = draft.value[r.member_id];
    if (d !== undefined) return parseHumanity(d);
  }
  return r.humanity ?? null;
}
function proposalOf(r: Row): number {
  return r.std_hc + (humanityOf(r) ?? 0);
}

const sorted = computed(() => {
  const k = sortKey.value;
  const dir = sortAsc.value ? 1 : -1;
  return [...rows.value].sort((a, b) => {
    const av = k === 'proposal' ? proposalOf(a) : k === 'humanity' ? humanityOf(a) : a[k];
    const bv = k === 'proposal' ? proposalOf(b) : k === 'humanity' ? humanityOf(b) : b[k];
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

const DORMANT_TIP = '휴면 중. 복귀 전까지 적용되지 않는 참고값임 (9번 섹션 안내 참조)';

// ── 상세 창 ──────────────────────────────────────────────────────────────────
// 성명을 누르면 그 회원의 산정 근거를 모달로 보여 준다 (RowDetailDialog).
const selectedId = ref<number | null>(null);
const selected = computed(() => rows.value.find((r) => r.member_id === selectedId.value) ?? null);
const dialogOpen = computed({
  get: () => selected.value !== null,
  set: (v: boolean) => {
    if (!v) selectedId.value = null;
  },
});

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
// 시상 원점수는 소수 셋째 자리까지 쓴다.
function fmtSigned3(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const t = Math.abs(v).toFixed(3);
  if (v > 0) return `+${t}`;
  if (v < 0) return `${MINUS}${t}`;
  return t;
}
// 인쇄용 비고: 상태 표시(휴면·한도·표본 부족)와 비고 문구를 ' · ' 로 잇는다.
function printNote(r: Row): string {
  return [r.dormant_from ? '휴면' : '', r.capped ? '한도' : '', r.low_sample ? '표본 부족' : '', r.note ?? '']
    .filter(Boolean)
    .join(' · ');
}

function fmtAwardCounts(r: Row): string {
  if (r.w_win == null || r.w_med == null || r.w_host == null) return '—';
  return `${fmt(r.w_win, 2)} / ${fmt(r.w_med, 2)} / ${fmt(r.w_host, 2)}`;
}
// 시상보정은 소수 둘째 자리까지 쓰는 열이라 별도 포맷터를 둔다.
function fmtSignedInt(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `${MINUS}${Math.abs(v)}`;
  return '0';
}
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

// ── 인간미 입력 · 저장 (관리자만) ────────────────────────────────────────────
const { isAdmin } = useAuth();
const { toast } = useToast();
const editing = ref(false);
const saving = ref(false);
/** 입력 중인 문자열. 빈 문자열은 '지움'이다. */
const draft = ref<Record<number, string>>({});

/** 입력 문자열 → 값. 비어 있으면 null, 범위·정수가 아니면 NaN. */
// type=number 입력은 v-model 이 숫자로 바꿔 넣으므로 문자열이 아닐 수 있다.
function parseHumanity(raw: string | number): number | null {
  const t = String(raw ?? '').trim().replace(MINUS, '-');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < HUMANITY_MIN || n > HUMANITY_MAX) return NaN;
  return n;
}
function isInvalid(r: Row): boolean {
  const d = draft.value[r.member_id];
  return d !== undefined && Number.isNaN(parseHumanity(d));
}
const hasInvalid = computed(() => rows.value.some(isInvalid));
const changed = computed(() =>
  rows.value.filter((r) => {
    const d = draft.value[r.member_id];
    return d !== undefined && !Number.isNaN(parseHumanity(d)) && parseHumanity(d) !== (r.humanity ?? null);
  }),
);

function startEdit(focusId?: number): void {
  draft.value = Object.fromEntries(rows.value.map((r) => [r.member_id, r.humanity == null ? '' : String(r.humanity)]));
  editing.value = true;
  // 셀을 직접 눌러 들어온 경우 해당 입력창에 바로 커서를 둔다.
  if (focusId !== undefined) {
    void nextTick(() => {
      document.querySelector<HTMLInputElement>(`#hum-${focusId}`)?.focus();
    });
  }
}
function cancelEdit(): void {
  editing.value = false;
  draft.value = {};
}
// 저장 버튼은 바로 보내지 않고 변경 건수와 이름을 보여 주는 확인 창을 먼저 연다.
// 인간미는 연말 기준핸디 제안에 바로 더해지므로 잘못 누른 저장을 한 번 걸러 준다.
const confirmOpen = ref(false);
function requestSave(): void {
  if (hasInvalid.value || changed.value.length === 0 || saving.value) return;
  confirmOpen.value = true;
}
/** 확인 창 목록: 이름과 기존 값 → 새 값. 서버 판단값(제안 등)은 여기서 계산하지 않는다. */
const confirmItems = computed(() =>
  changed.value.map((r) => {
    const next = parseHumanity(draft.value[r.member_id] ?? '');
    return {
      id: r.member_id,
      name: r.member_name,
      from: r.humanity == null ? '미입력' : fmtSignedInt(r.humanity),
      to: next === null ? '지움' : fmtSignedInt(next),
    };
  }),
);
async function confirmSave(): Promise<void> {
  confirmOpen.value = false;
  await saveEdit();
}
async function saveEdit(): Promise<void> {
  if (hasInvalid.value || changed.value.length === 0 || saving.value) return;
  saving.value = true;
  try {
    const items = changed.value.map((r) => ({ member_id: r.member_id, adj: parseHumanity(draft.value[r.member_id] ?? '') }));
    const { data, error: err } = await supabase.rpc('save_handicap_humanity', { p_year: YEAR, p_items: items });
    if (err) throw err;
    const res = data as { ok: boolean; message?: string; saved?: number };
    if (!res.ok) throw new Error(res.message ?? '저장 실패');
    // 서버가 받은 값을 다시 읽어 화면과 DB 가 어긋나지 않게 한다.
    await load();
    editing.value = false;
    draft.value = {};
    toast({ title: '인간미 저장 완료', description: `${res.saved ?? items.length}건 반영` });
  } catch (e) {
    toast({ title: '저장 실패', description: describeError(e, ''), variant: 'destructive' });
  } finally {
    saving.value = false;
  }
}

const COLS: { key: SortKey; label: string; cls: string }[] = [
  { key: 'member_name', label: '성명', cls: '' },
  { key: 'std_hc_2025', label: '2025 기준(연말)', cls: 'num pp-hide-sm' },
  { key: 'prev_std_hc', label: '2026 기준', cls: 'num pp-hide-sm' },
  { key: 'std_hc', label: '2027 기준', cls: 'num pp-col-std' },
  { key: 'humanity', label: '인간미', cls: 'num pp-col-hum' },
  { key: 'proposal', label: '2027 제안', cls: 'num pp-col-std' },
  { key: 'final_delta', label: '증감', cls: 'num pp-hide-sm' },
  { key: 'w_avg', label: '가중평균 오버파', cls: 'num pp-hide-sm' },
  { key: 'attend_rate', label: '2026 참석률', cls: 'num pp-hide-sm' },
];
</script>

<template>
  <div>
    <!-- 불러오는 중·실패·빈 상태는 다른 화면과 같은 AsyncState 로 그린다 (골격 · 다시 시도). -->
    <AsyncState
      :loading="loading"
      :error="error"
      :empty="rows.length === 0"
      label="산정결과"
      :skeleton-rows="8"
      empty-title="표시할 산정결과 없음"
      empty-hint="2027 산정결과가 등록되면 표시 · 관리자에게 문의"
      @retry="load"
    >
      <!-- 안내 문장과 관리자 버튼을 한 줄에 둔다. 버튼은 표 오른쪽 끝에 맞춘다. -->
      <div class="pp-head-row">
        <p class="policy-note pp-head-note">
          성명 선택 시 산정 근거(구간별 평균·가중 라운드·시상보정·산출핸디 등) 창 표시. 열 제목 선택 시 정렬 변경
        </p>
        <div v-if="isAdmin" class="pp-edit-bar">
          <template v-if="!editing">
            <Button variant="outline" size="xs" class="h-9 px-2.5 text-xs sm:h-8" @click="startEdit()">인간미 수정</Button>
          </template>
          <template v-else>
            <Button size="xs" class="h-9 px-2.5 text-xs sm:h-8" :disabled="saving || hasInvalid || changed.length === 0" @click="requestSave">
              {{ saving ? '저장 중' : `저장${changed.length ? ` (${changed.length}건)` : ''}` }}
            </Button>
            <Button variant="outline" size="xs" class="h-9 px-2.5 text-xs sm:h-8" :disabled="saving" @click="cancelEdit">취소</Button>
            <span v-if="hasInvalid" class="pp-edit-msg pp-up" role="alert">인간미는 −2 ~ +2 사이 정수만 입력 가능</span>
          </template>
        </div>
      </div>
      <div class="policy-table-wrap pp-results-wrap">
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
                  <span v-if="sortKey === c.key" aria-hidden="true">{{ sortAsc ? '▲' : '▼' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in sorted" :key="r.member_id">
              <tr class="pp-row">
                <th scope="row">
                  <button type="button" class="pp-expand" @click="selectedId = r.member_id">
                    {{ r.member_name }}
                  </button>
                  <span
                    v-if="r.dormant_from"
                    class="policy-flag pp-dormant"
                  >휴면</span>
                  <!-- 휴면 회원은 휴면만 표시한다. 한도·부족은 휴면에 포함되므로 따로 보이지 않는다. -->
                  <span v-if="r.capped && !r.dormant_from" class="policy-flag">한도</span>
                  <span v-if="r.low_sample && !r.dormant_from" class="policy-flag" title="표본 부족">부족</span>
                </th>
                <td class="num pp-hide-sm">{{ r.std_hc_2025 ?? '—' }}</td>
                <td class="num pp-hide-sm">{{ r.prev_std_hc ?? '—' }}</td>
                <td class="num pp-std">{{ r.std_hc }}</td>
                <td class="num pp-hum" :class="deltaClass(humanityOf(r) || null)">
                  <!-- ui/Input 은 문자열을 내보낸다. parseHumanity 가 String(raw ?? '') 로 읽으므로 그대로 받는다. -->
                  <Input
                    v-if="editing"
                    v-model="draft[r.member_id]"
                    type="number"
                    :id="`hum-${r.member_id}`"
                    :class="cn('mx-auto h-9 sm:h-8 w-11 sm:w-14 px-1 text-center', isInvalid(r) && 'border-destructive bg-destructive/10')"
                    :min="HUMANITY_MIN"
                    :max="HUMANITY_MAX"
                    step="1"
                    :ariaLabel="`${r.member_name} 인간미 (${HUMANITY_MIN} ~ +${HUMANITY_MAX})`"
                    :ariaInvalid="isInvalid(r)"
                    @keydown.enter.prevent="requestSave"
                  />
                  <button
                    v-else-if="isAdmin"
                    type="button"
                    class="pp-hum-cell"
                    :aria-label="`${r.member_name} 인간미 입력`"
                    @click="startEdit(r.member_id)"
                  >{{ r.humanity == null ? '—' : fmtSignedInt(r.humanity) }}</button>
                  <template v-else>{{ r.humanity == null ? '—' : fmtSignedInt(r.humanity) }}</template>
                </td>
                <td class="num pp-std">{{ Number.isNaN(humanityOf(r)) ? '—' : proposalOf(r) }}</td>
                <td class="num pp-hide-sm" :class="deltaClass(r.final_delta)">
                  {{ fmtSigned2(r.final_delta) }}
                  <span class="pp-delta-label">{{ deltaLabel(r.final_delta) }}</span>
                </td>
                <td class="num pp-hide-sm">{{ fmt(r.w_avg) }}</td>
                <td class="num pp-hide-sm">{{ fmt(r.attend_rate) }}%</td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr>
              <!-- 좁은 화면은 보이는 열이 4개뿐이다. colspan 을 9 로 두면 숨은 열 5개가 폭을 나눠 가져가
                   증감 열이 쪼그라들므로, 폭에 맞는 칸을 따로 둔다. -->
              <td colspan="4" class="pp-foot-sm">
                <strong>핸디 총합 {{ totalPrev }} → {{ totalStd }} ({{ totalLabel }})</strong>
              </td>
              <td colspan="9" class="pp-hide-sm">
                <strong>핸디 총합 {{ totalPrev }} → {{ totalStd }} ({{ totalLabel }})</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- 인쇄 전용: 성명을 눌러야 보이는 모달 상세는 종이에 나오지 않으므로, 같은 근거를 표 한 장으로 따로 낸다. 화면에서는 숨김. -->
      <div class="pp-print-only" aria-hidden="true">
        <p class="policy-note">산정 근거 (회원별 상세)</p>
        <table class="policy-table pp-detail-print">
          <thead>
            <tr>
              <th scope="col">성명</th>
              <th scope="col">A 평균</th>
              <th scope="col">B 평균</th>
              <th scope="col">C 평균</th>
              <th scope="col">가중 라운드</th>
              <th scope="col">시상횟수 W/M/H</th>
              <th scope="col">시상 원점수</th>
              <th scope="col">시상보정</th>
              <th scope="col">산출핸디</th>
              <th scope="col">반영률</th>
              <th scope="col">한도 전 증감</th>
              <th scope="col">한도 후 증감</th>
              <th scope="col">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in sorted" :key="r.member_id">
              <th scope="row">{{ r.member_name }}</th>
              <td class="num">{{ fmt(r.avg_a) }}</td>
              <td class="num">{{ fmt(r.avg_b) }}</td>
              <td class="num">{{ fmt(r.avg_c) }}</td>
              <td class="num">{{ fmt(r.w_sum, 2) }}</td>
              <td class="num">{{ fmtAwardCounts(r) }}</td>
              <td class="num">{{ fmtSigned3(r.award_raw) }}</td>
              <td class="num">{{ fmtSigned2(r.award_adj) }}</td>
              <td class="num">{{ fmt(r.calc_hc) }}</td>
              <td class="num">{{ r.apply_rate === null ? '—' : (r.apply_rate * 100).toFixed(1) + '%' }}</td>
              <td class="num">{{ fmtSigned2(r.raw_delta) }}</td>
              <td class="num">{{ fmtSigned2(r.final_delta) }}</td>
              <td class="pp-left">{{ printNote(r) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncState>

    <Dialog v-model:open="confirmOpen" label="인간미 저장 확인" content-class="sm:max-w-sm">
      <div class="space-y-3 px-1 pt-1">
        <h2 class="text-base font-bold m-0">인간미 {{ confirmItems.length }}건 저장</h2>
        <p class="text-sm text-muted-foreground m-0">아래 회원의 인간미를 저장 · 저장 후 서버 값으로 다시 표시</p>
        <ul class="m-0 max-h-60 list-none space-y-1 overflow-y-auto p-0 text-sm">
          <li v-for="it in confirmItems" :key="it.id" class="flex justify-between gap-3 border-b border-border py-1.5">
            <span class="font-medium">{{ it.name }}</span>
            <span class="font-mono">{{ it.from }} → {{ it.to }}</span>
          </li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="outline" @click="confirmOpen = false">취소</Button>
          <Button :disabled="saving" @click="confirmSave">저장</Button>
        </div>
      </div>
    </Dialog>

    <RowDetailDialog v-model:open="dialogOpen" :title="selected?.member_name ?? ''" subtitle="2027 기준핸디 산정결과 (안)">
      <template v-if="selected">
        <DetailItem label="2025 기준(연말)">{{ selected.std_hc_2025 ?? '—' }}</DetailItem>
        <DetailItem label="2026 기준">{{ selected.prev_std_hc ?? '—' }}</DetailItem>
        <DetailItem label="2027 기준(안)"><span class="pp-std">{{ selected.std_hc }}</span></DetailItem>
        <DetailItem label="인간미">{{ selected.humanity == null ? '—' : fmtSignedInt(selected.humanity) }}</DetailItem>
        <DetailItem label="2027 제안(안)"><span class="pp-std">{{ proposalOf(selected) }}</span></DetailItem>
        <DetailItem label="증감">
          <span :class="deltaClass(selected.final_delta)">
            {{ fmtSigned2(selected.final_delta) }} {{ deltaLabel(selected.final_delta) }}
          </span>
        </DetailItem>
        <DetailItem label="가중평균 오버파">{{ fmt(selected.w_avg) }}</DetailItem>
        <DetailItem label="2026 참석률">
          {{ fmt(selected.attend_rate) }}%
        </DetailItem>
        <DetailItem label="A 구간 평균">{{ fmt(selected.avg_a) }}</DetailItem>
        <DetailItem label="B 구간 평균">{{ fmt(selected.avg_b) }}</DetailItem>
        <DetailItem label="C 구간 평균">{{ fmt(selected.avg_c) }}</DetailItem>
        <DetailItem label="가중 라운드">{{ fmt(selected.w_sum, 2) }}</DetailItem>
        <DetailItem label="가중 시상횟수 (W / M / H)">{{ fmtAwardCounts(selected) }}</DetailItem>
        <DetailItem label="시상 원점수">
          <span :class="deltaClass(selected.award_raw ?? null)">{{ fmtSigned3(selected.award_raw) }}</span>
        </DetailItem>
        <DetailItem label="시상보정">{{ fmtSigned2(selected.award_adj) }}</DetailItem>
        <DetailItem label="산출핸디">{{ fmt(selected.calc_hc) }}</DetailItem>
        <DetailItem label="참석률 반영률">
          {{ selected.apply_rate === null ? '—' : (selected.apply_rate * 100).toFixed(1) + '%' }}
        </DetailItem>
        <DetailItem label="한도 적용 전 증감">
          <span :class="deltaClass(selected.raw_delta)">{{ fmtSigned2(selected.raw_delta) }}</span>
        </DetailItem>
        <DetailItem label="한도 적용 후 증감">
          <span :class="deltaClass(selected.final_delta)">{{ fmtSigned2(selected.final_delta) }}</span>
        </DetailItem>
        <DetailItem v-if="selected.dormant_from" label="휴면">
          <span class="pp-note-text">{{ DORMANT_TIP }}</span>
        </DetailItem>
        <DetailItem v-if="selected.capped" label="한도 적용">
          <span class="pp-up">적용 전 {{ fmtSigned2(selected.raw_delta) }} → 적용 후 {{ fmtSigned2(selected.final_delta) }}</span>
        </DetailItem>
        <DetailItem v-if="selected.note" label="비고">
          <span class="pp-note-text"><span v-if="selected.low_sample" class="pp-up">표본 부족 · </span>{{ selected.note }}</span>
        </DetailItem>
      </template>
    </RowDetailDialog>
  </div>
</template>

<style>
.pp-up {
  /* 모달은 body 로 옮겨져 .policy-page 변수를 못 받으므로 :root 토큰을 대체값으로 둔다. */
  color: var(--pp-up, var(--delta-up));
}
.pp-down {
  color: var(--pp-down, var(--delta-down));
}
.pp-std {
  /* 2027 기준핸디 강조색 (보라) */
  color: var(--std-accent);
  font-weight: 700;
}
.pp-delta-label {
  display: inline;
  margin-left: 0.25rem;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
}
.pp-results th,
.pp-results td {
  padding: 0.4rem 0.5rem;
}
/* 열 폭 배분: 375px 에서도 헤더가 겹치지 않게 성명 90px · 2027 기준 90px 로 고정하고 나머지는 증감이 쓴다. */
.pp-results {
  table-layout: fixed;
}
.pp-results thead th {
  white-space: normal;
  vertical-align: bottom;
  line-height: 1.3;
}
/* 본문 행은 모든 칸을 세로 가운데로 맞춘다. 입력 상자가 있어도 성명·숫자가 같은 줄에 놓인다. */
.pp-results tbody th,
.pp-results tbody td {
  vertical-align: middle;
}
/* 성명 칸의 배지는 작게 줄이고 줄바꿈 때 여백을 최소로 둔다. */
.pp-results .policy-flag {
  margin: 0.125rem 0.125rem 0.125rem 0;
  padding: 0 0.1875rem;
  border-radius: 0.1875rem;
  font-size: 0.6875rem;
  line-height: 1.25;
}
.pp-results thead th:first-child,
.pp-results tbody th {
  width: 80px;
  text-align: left;
}
.pp-results thead th.pp-col-std {
  width: 56px;
}
.pp-results thead th.pp-col-hum {
  width: 64px;
}
/* 좁은 화면은 네 열이 305px 안에 들어가야 하므로 셀 여백을 줄인다. */
@media (max-width: 639px) {
  .pp-results th,
  .pp-results td {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }
  /* 머리글은 고정폭 숫자 글꼴이라 넓다. 좁은 화면에서만 줄여 셀 안에 넣는다. */
  .pp-results thead th {
    font-size: 0.75rem;
    letter-spacing: -0.02em;
  }
}
.pp-sort {
  flex-wrap: wrap;
  justify-content: center;
}
.pp-head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.pp-head-note {
  flex: 1 1 16rem;
  margin: 0;
}
.pp-edit-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}
.pp-edit-msg {
  font-size: 0.75rem;
  font-weight: 600;
}
.pp-hum-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  min-height: 2rem;
  padding: 0.1rem 0.3rem;
  border: 1px dashed var(--pp-border, var(--border));
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: text;
}
.pp-hum-cell:hover,
.pp-hum-cell:focus-visible {
  border-style: solid;
  border-color: var(--primary);
}
.pp-dormant {
  border-color: var(--muted-foreground);
  color: var(--muted-foreground);
}
/* 640px 이상은 9열이 보인다. 고정 배분이면 좁은 열에서 글자가 옆 열을 덮으므로
   열 폭을 내용에 맞추고, 래퍼 폭을 넘으면 가로로 스크롤한다. */
@media (min-width: 640px) {
  .pp-results {
    table-layout: auto;
  }
  .pp-results thead th:first-child,
  .pp-results tbody th {
    width: auto;
    white-space: nowrap;
  }
  .pp-results thead th.pp-col-std,
  .pp-results thead th.pp-col-hum {
    width: auto;
  }
  .pp-results thead th {
    white-space: nowrap;
    word-break: keep-all;
  }
  /* 가로로 스크롤해도 이름 열만 왼쪽에 남긴다. 겹쳐 지나가는 값이 비치지 않게 배경을 채운다. */
  .pp-results thead th:first-child,
  .pp-results tbody th {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--pp-bg);
    box-shadow: 1px 0 0 var(--pp-grey);
  }
  .pp-results thead th:first-child {
    z-index: 2;
    background: var(--pp-blue);
  }
  .pp-results td {
    white-space: nowrap;
  }
  .policy-table-wrap.pp-results-wrap {
    overflow-x: auto;
  }
  .pp-delta-label {
    margin-left: 0.5rem;
  }
}
.pp-results tbody th {
  font-weight: 600;
}
.pp-sort,
.pp-expand {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: inherit;
}
.pp-expand {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}
/* 좁은 화면은 정렬·상세 버튼 높이를 44px 로 잡는다. 히트영역을 바깥으로 넓히면 행끼리 겹치고 래퍼에 잘린다. */
@media (max-width: 639px) {
  .pp-sort,
  .pp-expand {
    min-height: 2.75rem;
  }
}
.pp-sort:focus-visible,
.pp-expand:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.pp-results tfoot td {
  background: var(--pp-sage);
  border-top: 1px solid var(--pp-border);
  text-align: right;
}
/* 좁은 화면: 성명 · 2027 기준 · 인간미 · 2027 제안 네 열만 남기고 나머지는 성명을 눌러 열리는 창에서 본다. */
.pp-hide-sm {
  display: none;
}
@media (min-width: 640px) {
  .pp-hide-sm {
    display: table-cell;
  }
  .pp-foot-sm {
    display: none;
  }
}
.pp-note-text {
  display: block;
  font-weight: 500;
  text-align: right;
}

/* 인쇄 전용 산정 근거 표: 화면에서는 숨기고 인쇄에서만 보인다. */
.pp-print-only {
  display: none;
}
@media print {
  .pp-print-only {
    display: block;
    break-before: page;
  }
  .pp-detail-print {
    font-size: 0.625rem;
  }
  .pp-detail-print th,
  .pp-detail-print td {
    padding: 0.15rem 0.2rem;
    text-align: center;
  }
  .pp-detail-print td.pp-left {
    text-align: left;
  }
  .pp-detail-print tr {
    break-inside: avoid;
  }
}
</style>
