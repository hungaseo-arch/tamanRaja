<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { setPageTitle } from '@/lib/title';
import { supabase } from '@/lib/supabase';
import PolicySection from '@/components/PolicySection.vue';
import HandicapResultsTable from '@/components/HandicapResultsTable.vue';

onMounted(() => {
  setPageTitle('27년 핸디캡 (안)');
  void loadCourseRatings();
});

// 산식 8단계. 수식은 지시서 원문 그대로다 (재계산·재표기하지 않는다).
const FORMULA_STEPS = [
  {
    no: '①',
    name: '보정 오버파',
    formula: '실오버파 − 해당 구장 난이도 가중적용치',
    note: '실오버파 : 총타수 − 해당 구장 Par. Par 71 구장은 +1 보정',
  },
  {
    no: '②',
    name: '가중 라운드',
    formula: 'Σ(참석 라운드의 구간가중)',
    note: '가중 라운드 : 참석 라운드를 구간가중으로 환산한 수. 전 모임 참석 시 10.00',
  },
  {
    no: '③',
    name: '가중평균 오버파',
    formula: 'Σ(보정 오버파 × 구간가중) ÷ 가중 라운드',
    note: '보정 오버파의 가중평균. 최근 라운드일수록 가중을 높게 반영. 구간별 가중은 3번 섹션 참조',
  },
  {
    no: '④',
    name: '시상 원점수',
    formula: 'Σ(시상 계수 × 그 날의 구간가중)',
    note: '시상 계수와 계산 예시는 4번 섹션 참조',
  },
  {
    no: '⑤',
    name: '시상보정',
    formula: '시상 원점수 ÷ 가중 라운드 × 6   ※ ±1.0타 한도',
    note: '계수 6의 의미는 4번 섹션 참조',
  },
  {
    no: '⑥',
    name: '산출핸디',
    formula: '가중평균 오버파 − 6.2 + 시상보정',
    note: '6.2 : 모임 전체 핸디 총합을 2026년과 동일하게 맞추는 기준점. 회원별 (가중평균 오버파 − 현재 핸디)의 평균값',
  },
  {
    no: '⑦',
    name: '증감',
    formula: '(산출핸디 − 2026년 기준핸디) × 참석률 반영률',
    note: '참석이 적으면 변동폭 축소 반영. 반영률은 5번 섹션 참조',
  },
  {
    no: '⑧',
    name: '2027년 기준핸디',
    formula: '2026년 기준핸디 + 증감   ※ −2 ~ +3 한도, 0.5는 올림',
    note: '0.5 올림 : 경계값은 회원에게 유리한 쪽(핸디가 큰 쪽)으로 처리',
  },
];

// 구간 가중 (3-3절)
const WEIGHT_BANDS = [
  { band: 'A', period: '2026-06 ~ 2026-11', weight: '100.0%', desc: '최근 6개월. 현재 기량을 가장 높게 반영' },
  { band: 'B', period: '2026-01 ~ 2026-05', weight: '50.0%', desc: '당해년 전반. 한 시즌 전체 흐름 보완' },
  { band: 'C', period: '2025-07 ~ 2025-12', weight: '25.0%', desc: '전년 하반기. 장기 추세 확인' },
  { band: '—', period: '2025-06 이전', weight: '0.0%', desc: '미반영. 2년 전 성적까지 포함하면 핸디가 현재 기량을 반영하지 못함' },
];

// 시상 가중치 (3-4절)
const AWARDS = [
  { name: 'Winner', weight: '−0.50', meaning: '핸디 대비 호성적 → 핸디 축소' },
  { name: 'Medalist', weight: '−0.25', meaning: 'Gross 최저타 → 실력 입증' },
  { name: 'Host', weight: '+0.50', meaning: '최하위 → 핸디 확대' },
];

// 박영진 시상 예시 (시상 8건, 원점수 −1.125). 표 값은 지시서가 정본이다.
const AWARD_EXAMPLE = [
  { date: '2025-09-06', award: 'Medalist', coef: '−0.25', band: 'C', wgt: '0.25', prod: '−0.063' },
  { date: '2025-10-04', award: 'Host', coef: '+0.50', band: 'C', wgt: '0.25', prod: '+0.125' },
  { date: '2025-11-01', award: 'Medalist', coef: '−0.25', band: 'C', wgt: '0.25', prod: '−0.063' },
  { date: '2026-02-07', award: 'Winner', coef: '−0.50', band: 'B', wgt: '0.50', prod: '−0.250' },
  { date: '2026-05-02', award: 'Medalist', coef: '−0.25', band: 'B', wgt: '0.50', prod: '−0.125' },
  { date: '2026-06-06', award: 'Medalist', coef: '−0.25', band: 'A', wgt: '1.00', prod: '−0.250' },
  { date: '2026-08-01', award: 'Medalist', coef: '−0.25', band: 'A', wgt: '1.00', prod: '−0.250' },
  { date: '2026-09-05', award: 'Medalist', coef: '−0.25', band: 'A', wgt: '1.00', prod: '−0.250' },
];
// 시상보정 상수 비교 (계수 6 선택 근거)
const AWARD_CONSTANTS = [
  { k: '×4', over: '0명', verdict: '시상 효과가 너무 약함', chosen: false },
  { k: '×6', over: '1명', verdict: '채택. 대부분 한도 안에서 변별됨', chosen: true },
  { k: '×8', over: '2명', verdict: '상위권이 뭉개짐', chosen: false },
  { k: '×10', over: '4명', verdict: '박영진 −1.32와 정인원 −2.02가 같은 −1.00이 됨', chosen: false },
];
/** 가운데 정렬해도 % 값의 자릿수가 세로로 맞도록 앞을 공백(NBSP)으로 채운다. */
function padPct(v: string): string {
  return v.padStart(6, '\u00A0');
}
/** 부호 문자열(+/−) 글자색. 부호 문자가 항상 함께 표시된다. */
function signClass(v: string): string {
  return v.startsWith('+') ? 'pp-up' : v.startsWith('\u2212') ? 'pp-down' : '';
}

// 참석률 반영률 (3-5절)
const ATTEND_RATES = [
  { range: '80.0% 이상', rate: '100.0%' },
  { range: '50.0 ~ 80.0%', rate: '70.0%' },
  { range: '50.0% 미만', rate: '50.0%' },
];

// 증감 한도 (3-6절)
const LIMITS = [
  { kind: '인하 (핸디↓, 불리)', limit: '연 2타', reason: '한 해 성적만으로 급하게 낮추면 다음 해 부담 과다' },
  { kind: '인상 (핸디↑, 유리)', limit: '연 3타', reason: '연령·건강 변화를 빠르게 반영해야 지속 참여 가능' },
  { kind: '표본 부족 시', limit: '±1타', reason: '가중 라운드 3.00 미만' },
];

// 2027년 한도 적용자 5명 (한도 적용 전 → 후). 표 값은 지시서가 정본이다.
const CAPPED_MEMBERS = [
  { name: '서종환', before: '−2.2', after: '−2.0' },
  { name: '남정곤', before: '+3.2', after: '+3.0' },
  { name: '정재욱', before: '+3.7', after: '+3.0' },
  { name: '신승민', before: '+2.3', after: '+1.0' },
  { name: '이성남', before: '+6.1', after: '+1.0' },
];

// 코스 난이도 지수 (3-7절). 산출 창: 2025-07 ~ 2026-11
const COURSE_DIFFICULTY = [
  { name: '리버사이드', par: 72, meetings: 1, rounds: 12, over: '24.4', net: '11.0', index: '+3.7', applied: '+0.9' },
  { name: '센툴하일랜드', par: 72, meetings: 2, rounds: 22, over: '23.8', net: '8.5', index: '+1.2', applied: '+0.6' },
  { name: '자고라위', par: 72, meetings: 5, rounds: 57, over: '22.4', net: '7.8', index: '+0.5', applied: '+0.5' },
  { name: '레인보우', par: 72, meetings: 3, rounds: 25, over: '23.2', net: '7.5', index: '+0.2', applied: '+0.1' },
  { name: '구눙굴리스', par: 72, meetings: 4, rounds: 47, over: '21.8', net: '6.0', index: '−1.3', applied: '−1.3' },
  { name: '끄다똔', par: 72, meetings: 1, rounds: 8, over: '18.1', net: '5.1', index: '−2.2', applied: '−0.5' },
  { name: '보고라야', par: 71, meetings: 1, rounds: 10, over: '20.1', net: '4.4', index: '−2.9', applied: '−0.7' },
];

// WHS Handicap Index 대조. 차이 = Handicap Index − 기준핸디 (표기 시 계산).
// std2026 은 2026 기준핸디, std2027 은 2027 산정(안) 값이다 (DB handicap_annual 과 동일).
const WHS_ROWS = [
  { name: '박영진', index: 11.6, std2026: 10, std2027: 9 },
  { name: '박재현', index: 12.2, std2026: 11, std2027: 11 },
  { name: '정인원', index: 12.3, std2026: 12, std2027: 10 },
  { name: '서종환', index: 13.1, std2026: 13, std2027: 11 },
  { name: '김재헌', index: 13.8, std2026: 14, std2027: 12 },
  { name: '유영보', index: 14.9, std2026: 15, std2027: 14 },
  { name: '장효익', index: 15.5, std2026: 14, std2027: 15 },
  { name: '고영춘', index: 16.7, std2026: 17, std2027: 16 },
  { name: '남정곤', index: 17.3, std2026: 15, std2027: 18 },
  { name: '정재욱', index: 18.5, std2026: 18, std2027: 21 },
  { name: '조학영', index: 18.5, std2026: 19, std2027: 19 },
  { name: '정기혁', index: 20.3, std2026: 20, std2027: 20 },
  { name: '손동현', index: 23.2, std2026: 24, std2027: 24 },
  { name: '신승민', index: 26.2, std2026: 24, std2027: 25 },
];
/** Handicap Index − 기준핸디 (소수 첫째 자리). */
function whsDiff(index: number, std: number): number {
  return Math.round((index - std) * 10) / 10;
}
function fmtDiff(d: number): string {
  if (d === 0) return '0.0';
  return (d > 0 ? '+' : '\u2212') + Math.abs(d).toFixed(1);
}
/** 차이 부호별 글자색 (+ 붉은색, − 파란색). 부호 문자가 항상 함께 표시된다. */
function diffClass(d: number): string {
  return d > 0 ? 'pp-up' : d < 0 ? 'pp-down' : '';
}
/** 열 평균 (소수 첫째 자리 반올림). 차이 평균은 부호를 유지한 평균이다. */
function mean(values: number[]): number {
  return Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10;
}
const WHS_AVG = {
  index: mean(WHS_ROWS.map((r) => r.index)),
  std2026: mean(WHS_ROWS.map((r) => r.std2026)),
  std2027: mean(WHS_ROWS.map((r) => r.std2027)),
  diff2026: mean(WHS_ROWS.map((r) => whsDiff(r.index, r.std2026))),
  diff2027: mean(WHS_ROWS.map((r) => whsDiff(r.index, r.std2027))),
};
function meanAbsDiff(key: 'std2026' | 'std2027'): string {
  const sum = WHS_ROWS.reduce((acc, r) => acc + Math.abs(whsDiff(r.index, r[key])), 0);
  return (sum / WHS_ROWS.length).toFixed(1);
}

// 구장별 Course Rating · Slope (참고). 2027년 산정에는 미사용.
interface CourseRating {
  id: number;
  name: string;
  tee_box: string | null;
  par: number | null;
  course_rating: number | null;
  slope_rating: number | null;
  course_variant: string | null;
  rating_note: string | null;
}
const courseRatings = ref<CourseRating[]>([]);
const courseRatingsError = ref<string | null>(null);
const courseRatingsLoading = ref(true);

async function loadCourseRatings(): Promise<void> {
  courseRatingsLoading.value = true;
  courseRatingsError.value = null;
  const { data, error } = await supabase
    .from('golf_courses')
    .select('id, name, tee_box, par, course_rating, slope_rating, course_variant, rating_note')
    .not('course_rating', 'is', null)
    .order('name');
  courseRatingsLoading.value = false;
  if (error) {
    courseRatingsError.value = error.message;
    return;
  }
  courseRatings.value = (data ?? []).map((c) => ({
    ...c,
    course_rating: c.course_rating === null ? null : Number(c.course_rating),
  })) as CourseRating[];
}
</script>

<template>
  <div class="policy-page">
    <div class="container mx-auto px-4 max-w-5xl py-2 space-y-3">
      <header class="space-y-2">
        <h1 class="text-lg font-bold">27년 핸디캡 (안)</h1>
        <!-- 확정 전 안(案)임을 페이지 맨 위에서 밝힌다. 색만으로 전달하지 않도록 문구가 본체다. -->
        <p class="policy-status" role="status">
          <span class="policy-status-dot" aria-hidden="true" />
          2027년 적용(안) · 2026-11-08 기준 · 회원 확정 전
        </p>
        <p class="text-sm leading-relaxed">
          2027년 기준핸디 산정 방식과 회원별 산출 근거 공개 자료. 내용은 <strong>확정 전 안(案)</strong>이며
          회원 확정 전 변경 가능
        </p>
      </header>

      <PolicySection id="sec-results" no="1" title="회원별 산정결과 (안)" default-open>
        <HandicapResultsTable />
      </PolicySection>

      <PolicySection id="sec-formula" no="2" title="산정 산식" default-open>
        <p class="policy-lead">기준핸디 산출 8단계. 순서대로 대입하면 본인 결과 직접 확인 가능</p>
        <ol class="space-y-2 list-none p-0 m-0">
          <li v-for="step in FORMULA_STEPS" :key="step.no" class="policy-card">
            <p class="policy-card-title"><span class="policy-step-no" aria-hidden="true">{{ step.no }}</span>{{ step.name }}</p>
            <pre class="policy-formula">{{ step.formula }}</pre>
            <p class="policy-note">{{ step.note }}</p>
          </li>
        </ol>
      </PolicySection>

      <PolicySection id="sec-weights" no="3" title="구간 가중">
        <p class="policy-lead">최근 라운드일수록 가중 상향, 오래된 라운드일수록 가중 하향</p>
        <div class="policy-table-wrap">
          <table class="policy-table pp-fixed pp-center-all">
            <colgroup><col style="width:20%" /><col style="width:50%" /><col style="width:30%" /></colgroup>
            <thead>
              <tr>
                <th scope="col">구간</th>
                <th scope="col">기간</th>
                <th scope="col" class="num">가중</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="b in WEIGHT_BANDS" :key="b.band + b.period">
                <tr>
                  <th scope="row">{{ b.band }}</th>
                  <td>{{ b.period }}</td>
                  <td class="num">{{ padPct(b.weight) }}</td>
                </tr>
                <tr class="policy-desc-row">
                  <td colspan="3">{{ b.desc }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          최근 6개월 비중이 전체의 60.0% 이상으로 최근 기량 중심 결과.
          예시 : 정기혁 가중 라운드 9.50 중 6.00(63.2%)이 최근 6개월분
        </p>
      </PolicySection>

      <PolicySection id="sec-awards" no="4" title="시상 가중치">
        <div class="policy-table-wrap">
          <table class="policy-table pp-fixed">
            <colgroup><col style="width:28%" /><col style="width:18%" /><col style="width:54%" /></colgroup>
            <thead>
              <tr>
                <th scope="col">시상</th>
                <th scope="col" class="num">계수</th>
                <th scope="col">의미</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in AWARDS" :key="a.name">
                <th scope="row">{{ a.name }}</th>
                <td class="num">{{ a.weight }}</td>
                <td>{{ a.meaning }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          <strong>부호 설명</strong> : 시상 횟수는 양수로 집계하고 위 계수가 핸디 증감 방향을 결정.
          화면의 「가중 시상횟수」 열이 모두 양수인 것은 정상
        </p>
        <p class="policy-note">
          <strong>시상 원점수 계산</strong> : 시상 1건마다 <span class="font-mono">계수 × 그 날의 구간가중</span>을
          구해 전부 합산. 같은 Medalist라도 A구간(가중 1.00)이 C구간(가중 0.25)보다 4배 높게 반영
        </p>

        <details class="policy-details mt-3">
          <summary>예시 : 박영진 (시상 8건, 원점수 −1.125)</summary>
          <div class="policy-table-wrap mt-2">
            <table class="policy-table pp-whs">
              <thead>
                <tr>
                  <th scope="col">일자</th>
                  <th scope="col">시상</th>
                  <th scope="col" class="num">계수</th>
                  <th scope="col" class="num">구간</th>
                  <th scope="col" class="num">가중</th>
                  <th scope="col" class="num">계수 × 가중</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in AWARD_EXAMPLE" :key="e.date">
                  <th scope="row">{{ e.date }}</th>
                  <td>{{ e.award }}</td>
                  <td class="num" :class="signClass(e.coef)">{{ e.coef }}</td>
                  <td class="num">{{ e.band }}</td>
                  <td class="num">{{ e.wgt }}</td>
                  <td class="num" :class="signClass(e.prod)">{{ e.prod }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colspan="5">합계</th>
                  <td class="num pp-down">−1.125</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>

        <div class="policy-card mt-3">
          <p class="policy-card-title">계수 6을 곱하는 이유</p>
          <p class="policy-note m-0">
            원점수는 횟수 합계라 라운드가 많을수록 커짐. 가중 라운드로 나눠 1라운드당 값으로 바꾸면
            라운드 수와 무관해지나(박영진 −0.132) 값이 작아 핸디 영향 미미. 여기에 6을 곱해 타수 크기로
            환원(−0.79). 상수 6은 ±1.0타 한도에 과도하게 몰리지 않도록 조정한 값이며 기간을 뜻하지 않음
          </p>
          <div class="policy-table-wrap mt-2">
            <table class="policy-table pp-whs">
              <thead>
                <tr>
                  <th scope="col">상수</th>
                  <th scope="col" class="num">±1.0 한도 초과</th>
                  <th scope="col">판단</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in AWARD_CONSTANTS" :key="c.k">
                  <th scope="row">{{ c.k }}<span v-if="c.chosen" class="policy-flag">채택</span></th>
                  <td class="num">{{ c.over }}</td>
                  <td>{{ c.verdict }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PolicySection>

      <PolicySection id="sec-attend" no="5" title="참석률 반영률">
        <p class="policy-lead">
          <strong>변동폭의 반영률</strong> 방식 적용. 참석이 적으면 표본 부족으로 평균값을 그대로
          신뢰하기 어려움
        </p>
        <div class="policy-table-wrap">
          <table class="policy-table pp-fixed">
            <colgroup><col style="width:50%" /><col style="width:50%" /></colgroup>
            <thead>
              <tr>
                <th scope="col">연간 참석률</th>
                <th scope="col" class="num">반영률</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in ATTEND_RATES" :key="r.range">
                <th scope="row">{{ r.range }}</th>
                <td class="num">{{ padPct(r.rate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          <strong>참석률과 가중 라운드는 다른 값</strong> : 참석률은 2026년 11개 모임 기준 단순 비율, 가중 라운드는
          2025-07 ~ 2026-11 의 17개 모임에 구간가중을 적용한 값. 예시 : 남정곤은 참석률 90.9%인데
          가중 라운드는 8.00 (2025년 하반기 전부 불참)
        </p>
        <div class="policy-card mt-3">
          <p class="policy-card-title">표본 부족 보완 규칙</p>
          <p class="policy-note m-0">
            가중 라운드 3.00 미만은 실질 3라운드 미달로 변동 한도를 ±1타로 축소. WHS 최소 산정 요건과 동일 기준.
            동결하지 않는 이유는 실제 기량과 핸디 차이가 큰 신규·복귀 회원 방치 방지
          </p>
        </div>
      </PolicySection>

      <PolicySection id="sec-limits" no="6" title="증감 한도">
        <div class="policy-table-wrap">
          <table class="policy-table pp-fixed">
            <colgroup><col style="width:60%" /><col style="width:40%" /></colgroup>
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col" class="num">한도</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="l in LIMITS" :key="l.kind">
                <tr>
                  <th scope="row">{{ l.kind }}</th>
                  <td class="num">{{ l.limit }}</td>
                </tr>
                <tr class="policy-desc-row">
                  <td colspan="2">{{ l.reason }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          한도 초과분은 2028년 산정에 이월. 2027년 한도 적용자 5명
        </p>
        <ul class="policy-list">
          <li v-for="m in CAPPED_MEMBERS" :key="m.name">
            <strong>{{ m.name }}</strong>
            <span class="policy-flag">한도 적용</span>
            <span class="font-mono">{{ m.before }} → {{ m.after }}</span>
          </li>
        </ul>
      </PolicySection>

      <PolicySection id="sec-course" no="7" title="코스 난이도 지수">
        <p class="policy-lead">
          동일 회원·동일 핸디 조건에서 특정 구장 Net이 높으면 난이도 높은 구장으로 판단.
          WHS의 PCC와 동일 원리
        </p>
        <pre class="policy-formula">난이도지수 = 해당 구장 평균 Net − 전체 평균 Net
가중적용치 = 난이도지수 × (모임 수 ÷ 4, 최대 1.0)   ※ 표본 적은 구장은 영향 축소</pre>
        <p class="policy-note">산출 창 : 2025-07 ~ 2026-11</p>
        <div class="policy-table-wrap mt-2">
          <table class="policy-table pp-fixed">
            <colgroup><col style="width:40%" /><col style="width:30%" /><col style="width:30%" /></colgroup>
            <thead>
              <tr>
                <th scope="col">구장</th>
                <th scope="col" class="num">난이도지수</th>
                <th scope="col" class="num">가중적용치</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="c in COURSE_DIFFICULTY" :key="c.name">
                <tr>
                  <th scope="row">{{ c.name }}</th>
                  <td class="num">{{ c.index }}</td>
                  <td class="num">{{ c.applied }}</td>
                </tr>
                <tr class="policy-desc-row">
                  <td colspan="3">
                    Par {{ c.par }} · 모임 {{ c.meetings }} · 라운드 {{ c.rounds }} · 실오버파 {{ c.over }} · 평균 Net {{ c.net }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          구눙굴리스 위주 회원과 리버사이드 위주 회원의 점수를 그대로 비교하면 2.2타 차이 발생. 이를 상쇄하는 장치
        </p>

        <details class="policy-details mt-3">
          <summary>참고: 구장별 Course Rating · Slope</summary>
          <p class="policy-note">
            2027년 산정 미사용. 2028년 WHS 전환 대비 수집값
          </p>
          <p v-if="courseRatingsLoading" class="policy-note" role="status">불러오는 중</p>
          <p v-else-if="courseRatingsError" class="policy-note" role="alert">
            불러오기 실패 : {{ courseRatingsError }}
            <button type="button" class="policy-link" @click="loadCourseRatings">다시 시도</button>
          </p>
          <div v-else class="policy-table-wrap">
            <table class="policy-table pp-fixed">
              <colgroup><col style="width:40%" /><col style="width:30%" /><col style="width:30%" /></colgroup>
              <thead>
                <tr>
                  <th scope="col">구장</th>
                  <th scope="col" class="num">CR</th>
                  <th scope="col" class="num">Slope</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="c in courseRatings" :key="c.id">
                  <tr>
                    <th scope="row">{{ c.name }}</th>
                    <td class="num">{{ c.course_rating?.toFixed(1) ?? '—' }}</td>
                    <td class="num">{{ c.slope_rating ?? '—' }}</td>
                  </tr>
                  <tr class="policy-desc-row">
                    <td colspan="3">
                      {{ c.tee_box }} tee · Par {{ c.par }}<template v-if="c.course_variant"> · {{ c.course_variant }}</template>
                      <template v-if="c.rating_note"> · {{ c.rating_note }}</template>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </details>
      </PolicySection>

      <PolicySection id="sec-whs" no="8" title="참고: WHS Handicap Index 대조">
        <p class="policy-lead">외부 표준(WHS) 산출 결과와 기준핸디 비교 자료</p>
        <div class="policy-table-wrap">
          <table class="policy-table pp-whs">
            <thead>
              <tr>
                <th scope="col">성명</th>
                <th scope="col" class="num">Handicap Index</th>
                <th scope="col" class="num">2026 기준</th>
                <th scope="col" class="num">2027 기준(안)</th>
                <th scope="col" class="num">차이 (2026)</th>
                <th scope="col" class="num">차이 (2027안)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in WHS_ROWS" :key="w.name">
                <th scope="row">{{ w.name }}</th>
                <td class="num">{{ w.index.toFixed(1) }}</td>
                <td class="num">{{ w.std2026 }}</td>
                <td class="num pp-std">{{ w.std2027 }}</td>
                <td class="num" :class="diffClass(whsDiff(w.index, w.std2026))">{{ fmtDiff(whsDiff(w.index, w.std2026)) }}</td>
                <td class="num" :class="diffClass(whsDiff(w.index, w.std2027))">{{ fmtDiff(whsDiff(w.index, w.std2027)) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">평균</th>
                <td class="num">{{ WHS_AVG.index.toFixed(1) }}</td>
                <td class="num">{{ WHS_AVG.std2026.toFixed(1) }}</td>
                <td class="num pp-std">{{ WHS_AVG.std2027.toFixed(1) }}</td>
                <td class="num" :class="diffClass(WHS_AVG.diff2026)">{{ fmtDiff(WHS_AVG.diff2026) }}</td>
                <td class="num" :class="diffClass(WHS_AVG.diff2027)">{{ fmtDiff(WHS_AVG.diff2027) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="policy-note mt-2">
          산출 : 최근 20라운드 Score Differential 중 최저 8개 평균. 평균 절대차 : 2026 기준 {{ meanAbsDiff('std2026') }}타, 2027 기준(안) {{ meanAbsDiff('std2027') }}타
        </p>
      </PolicySection>

      <PolicySection id="sec-schedule" no="9" title="적용 일정 · 유의사항">
        <ul class="policy-list policy-list-first">
          <li>2027년 1월 모임부터 적용</li>
          <li>
            조별 금회적용 핸디 ±1 규칙 현행 유지 (1등조 −1 / 2등조 +1). 본 기준은 연 1회 기준핸디 산정에만 적용
          </li>
          <li>손동현 · 신승민 : 2027년 상반기 성적 기준 7월 중간 재산정 검토</li>
          <li>이성남 : 휴면 중. 복귀 후 3회 참석 시 재산정</li>
          <li>
            2028년부터 정식 WHS Handicap Index 전환 목표. 2027년 1월 모임부터 홀별 스코어 기록 필요
          </li>
        </ul>
      </PolicySection>
    </div>
  </div>
</template>

<style>
/* 이 페이지 전용 팔레트 (60-30-10). 파스텔은 배경(fill) 전용이고 글자는 #546E7A 로 고정해
   명도 대비를 확보한다. 앱 전역 토큰은 건드리지 않도록 .policy-page 안에서만 쓴다. */
.policy-page {
  --pp-bg: var(--card);
  --pp-blue: var(--muted);
  --pp-grey: var(--card);
  --pp-sage: var(--secondary);
  --pp-text: var(--foreground);
  --pp-border: var(--border);
  --pp-up: oklch(0.55 0.22 25);
  --pp-down: #2563eb;
  min-height: 100%;
  background: var(--background);
  color: var(--foreground);
}
.policy-page h1,
.policy-page h2 {
  color: var(--pp-text);
}
.policy-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--primary);
  border-radius: 999px;
  background: var(--pp-sage);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary);
}
.policy-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--primary);
}

.policy-section {
  border: 1px solid var(--pp-border);
  border-radius: var(--radius);
  background: var(--pp-grey);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  overflow: hidden;
}
.policy-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 0.875rem;
  background: var(--pp-blue);
  color: var(--pp-text);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.policy-toggle:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}
.policy-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.8125rem;
}
.policy-chevron {
  width: 1.125rem;
  height: 1.125rem;
  transition: transform 0.15s;
}
.policy-body {
  padding: 0.875rem;
  font-size: 0.875rem;
  line-height: 1.6;
}
.policy-lead {
  margin: 0 0 0.75rem;
}
.policy-card {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--pp-border);
  border-radius: 0.5rem;
  background: var(--pp-bg);
}
.policy-card-title {
  margin: 0 0 0.375rem;
  font-weight: 700;
}
.policy-step-no {
  margin-right: 0.375rem;
}
/* 가로 스크롤 대신 줄바꿈을 허용한다 (모바일 우선). */
.policy-formula {
  margin: 0;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  background: var(--pp-blue);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.policy-note {
  margin: 0.375rem 0 0;
  font-size: 0.8125rem;
}
/* 표·수식 바로 아래의 설명은 각주로 보고 들여쓴다. */
.policy-table-wrap + .policy-note,
.policy-formula + .policy-note {
  padding-left: 0.625rem;
}

.policy-table-wrap {
  border: 1px solid var(--pp-border);
  border-radius: 0.375rem;
  overflow: hidden;
}
.policy-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--pp-bg);
  font-size: 0.875rem;
}
.policy-table th,
.policy-table td {
  padding: 0.4rem 0.625rem;
  text-align: left;
  border-bottom: 1px solid var(--pp-grey);
  vertical-align: top;
}
.policy-table thead th {
  background: var(--pp-blue);
  font-weight: 700;
}
.policy-table .num {
  text-align: center;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.policy-table.pp-whs th,
.policy-table.pp-whs td {
  padding-left: 0.4rem;
  padding-right: 0.4rem;
}
.policy-table.pp-whs tfoot th,
.policy-table.pp-whs tfoot td {
  background: var(--pp-sage);
  border-top: 1px solid var(--pp-border);
  font-weight: 700;
}
.policy-table.pp-whs thead th.num {
  white-space: normal;
}
/* 열 폭을 colgroup 비율로 고정한다 (내용 길이에 따라 열이 쏠리지 않게). */
.policy-table.pp-fixed {
  table-layout: fixed;
}
/* 모든 열을 가운데 정렬한다. 행 아래 설명(colspan 행)은 왼쪽 그대로 둔다. */
.policy-table.pp-center-all th,
.policy-table.pp-center-all td:not([colspan]) {
  text-align: center;
}
.policy-desc-row td {
  padding-left: 1.25rem;
  padding-top: 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--pp-border);
}

.policy-list {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.875rem;
}
.policy-list-first {
  margin-top: 0;
}
.policy-list li + li {
  margin-top: 0.25rem;
}
/* 한도 적용·표본 부족 표시. 색(붉은 글자)과 함께 문자 라벨을 항상 붙인다. */
.policy-flag {
  display: inline-block;
  margin: 0 0.375rem;
  padding: 0 0.375rem;
  border: 1px solid var(--pp-up);
  border-radius: 0.25rem;
  color: var(--pp-up);
  font-size: 0.75rem;
  font-weight: 700;
}
.policy-details {
  border: 1px solid var(--pp-border);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--pp-bg);
}
.policy-details summary {
  cursor: pointer;
  font-weight: 700;
}
.policy-link {
  margin-left: 0.375rem;
  text-decoration: underline;
  cursor: pointer;
}

/* 인쇄: 접힌 섹션도 모두 펼치고 접기 버튼의 화살표는 숨긴다. */
@media print {
  .policy-page {
    background: #fff;
  }
  .policy-body {
    display: block !important;
  }
  .policy-chevron {
    display: none;
  }
  /* 참고 접이식도 인쇄에서는 펼친 채로 나오도록 한다. */
  .policy-details > :not(summary) {
    display: block;
  }
  .policy-section {
    break-inside: avoid-page;
  }
}
</style>
