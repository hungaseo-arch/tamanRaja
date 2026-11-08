<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { setPageTitle } from '@/lib/title';
import { supabase } from '@/lib/supabase';
import PolicySection from '@/components/PolicySection.vue';
import HandicapResultsTable from '@/components/HandicapResultsTable.vue';

onMounted(() => {
  setPageTitle('핸디캡 산정기준');
  void loadCourseRatings();
});

// 산식 6단계. 수식은 지시서 원문 그대로다 (재계산·재표기하지 않는다).
const FORMULA_STEPS = [
  {
    no: '①',
    name: '라운드별 보정 오버파',
    formula: '실오버파 − 해당 구장 난이도 가중적용치',
    note: '실오버파는 총타수 − 해당 구장 Par 입니다. Par 71 구장은 +1 보정합니다.',
  },
  {
    no: '②',
    name: '가중평균',
    formula: 'Σ(보정 오버파 × 구간가중) ÷ Σ(구간가중)',
    note: '최근 라운드일수록 무겁게 반영한 평균입니다. 구간별 가중은 아래 2번 섹션에 있습니다.',
  },
  {
    no: '③',
    name: '시상보정',
    formula: '(−0.5×W + −0.25×M + +0.5×H) × 6 ÷ Σ구간가중   ※ ±1.0 한도',
    note: 'W·M·H 는 Winner·Medalist·Host 횟수입니다. 시상 횟수에도 구간가중을 곱합니다.',
  },
  {
    no: '④',
    name: '산출핸디',
    formula: '가중평균 − 6.2 + 시상보정',
    note: '6.2 는 모임 전체 핸디 총합이 2026년과 같아지도록 맞춘 기준점입니다. 회원별 (가중평균 − 현재 핸디) 의 평균값입니다.',
  },
  {
    no: '⑤',
    name: '증감',
    formula: '(산출핸디 − 2026년 기준핸디) × 참석률 반영률',
    note: '참석이 적으면 변동폭을 줄여 반영합니다. 반영률은 4번 섹션에 있습니다.',
  },
  {
    no: '⑥',
    name: '2027년 기준핸디',
    formula: '2026년 기준핸디 + 증감   ※ −2 ~ +3 한도, 0.5는 올림',
    note: '0.5 는 올림: 경계값은 회원에게 유리한 쪽(핸디가 큰 쪽)으로 처리합니다.',
  },
];

// 구간 가중 (3-3절)
const WEIGHT_BANDS = [
  { band: 'A', period: '2026-06 ~ 2026-11', weight: '100%', desc: '최근 6개월. 현재 기량을 가장 무겁게 반영합니다.' },
  { band: 'B', period: '2026-01 ~ 2026-05', weight: '50%', desc: '당해년 전반. 한 시즌 전체 흐름을 보완합니다.' },
  { band: 'C', period: '2025-07 ~ 2025-12', weight: '25%', desc: '전년 하반기. 장기 추세를 확인합니다.' },
  { band: '—', period: '2025-06 이전', weight: '0%', desc: '미반영. 2년 전 성적까지 끌면 핸디가 현재를 따라가지 못합니다.' },
];

// 시상 가중치 (3-4절)
const AWARDS = [
  { name: 'Winner', weight: '−0.50', meaning: '핸디 대비 호성적 → 핸디 축소' },
  { name: 'Medalist', weight: '−0.25', meaning: 'Gross 최저타 → 실력 입증' },
  { name: 'Host', weight: '+0.50', meaning: '최하위 → 핸디 확대' },
];

// 참석률 반영률 (3-5절)
const ATTEND_RATES = [
  { range: '80% 이상', rate: '100%' },
  { range: '50 ~ 80%', rate: '70%' },
  { range: '50% 미만', rate: '50%' },
];

// 증감 한도 (3-6절)
const LIMITS = [
  { kind: '인하 (핸디↓, 불리)', limit: '연 2타', reason: '한 해 성적만으로 급히 깎으면 다음 해 부담이 과도함' },
  { kind: '인상 (핸디↑, 유리)', limit: '연 3타', reason: '연령·건강 변화는 빠르게 반영해야 계속 참여할 수 있음' },
  { kind: '표본 부족 시', limit: '±1타', reason: '가중합 3.0 미만' },
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

// WHS Handicap Index 대조 (3-9절). 차이 = Handicap Index − 2026 기준핸디.
const WHS_ROWS = [
  { name: '박영진', index: '11.6', std: 10, diff: '+1.6' },
  { name: '박재현', index: '12.2', std: 11, diff: '+1.2' },
  { name: '정인원', index: '12.3', std: 12, diff: '+0.3' },
  { name: '서종환', index: '13.1', std: 13, diff: '+0.1' },
  { name: '김재헌', index: '13.8', std: 14, diff: '−0.2' },
  { name: '유영보', index: '14.9', std: 15, diff: '−0.1' },
  { name: '장효익', index: '15.5', std: 14, diff: '+1.5' },
  { name: '고영춘', index: '16.7', std: 17, diff: '−0.3' },
  { name: '남정곤', index: '17.3', std: 15, diff: '+2.3' },
  { name: '정재욱', index: '18.5', std: 18, diff: '+0.5' },
  { name: '조학영', index: '18.5', std: 19, diff: '−0.5' },
  { name: '정기혁', index: '20.3', std: 20, diff: '+0.3' },
  { name: '손동현', index: '23.2', std: 24, diff: '−0.8' },
  { name: '신승민', index: '26.2', std: 24, diff: '+2.2' },
];
/** 차이 부호별 글자색 (+ 붉은색, − 파란색). 부호 문자가 항상 함께 표시된다. */
function diffClass(d: string): string {
  return d.startsWith('+') ? 'pp-up' : d.startsWith('\u2212') ? 'pp-down' : '';
}

// 구장별 Course Rating · Slope (참고). 2027년 산정에는 쓰지 않는다.
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
    <div class="container mx-auto px-4 max-w-3xl py-4 space-y-3">
      <header class="space-y-2">
        <h1 class="text-lg font-bold">2027년 기준 핸디캡 산정기준</h1>
        <!-- 확정 전 안(案)임을 페이지 맨 위에서 밝힌다. 색만으로 전달하지 않도록 문구가 본체다. -->
        <p class="policy-status" role="status">
          <span class="policy-status-dot" aria-hidden="true" />
          2027년 적용(안) · 2026-11-08 기준 · 회원 확정 전
        </p>
        <p class="text-sm leading-relaxed">
          이 페이지는 2027년 기준핸디를 어떻게 정했는지, 회원별 숫자가 어떻게 나왔는지를 공개하는
          설명 자료입니다. 내용은 <strong>확정 전 안(案)</strong>이며 회원 확정 전에는 바뀔 수 있습니다.
        </p>
      </header>

      <PolicySection id="sec-formula" no="1" title="산정 산식" default-open>
        <p class="policy-lead">기준핸디는 아래 6단계로 계산합니다. 숫자를 순서대로 따라가면 본인 결과를 직접 확인할 수 있습니다.</p>
        <ol class="space-y-2 list-none p-0 m-0">
          <li v-for="step in FORMULA_STEPS" :key="step.no" class="policy-card">
            <p class="policy-card-title"><span class="policy-step-no" aria-hidden="true">{{ step.no }}</span>{{ step.name }}</p>
            <pre class="policy-formula">{{ step.formula }}</pre>
            <p class="policy-note">{{ step.note }}</p>
          </li>
        </ol>
      </PolicySection>

      <PolicySection id="sec-weights" no="2" title="구간 가중">
        <p class="policy-lead">라운드가 최근일수록 무겁게, 오래될수록 가볍게 반영합니다.</p>
        <div class="policy-table-wrap">
          <table class="policy-table">
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
                  <td class="num">{{ b.weight }}</td>
                </tr>
                <tr class="policy-desc-row">
                  <td colspan="3">{{ b.desc }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          최근 6개월 비중이 전체의 60% 이상을 차지하므로 최근 기량이 여전히 결과를 주도합니다.
          예시로 정기혁님은 가중합 9.50 중 6.00(63.2%)이 최근 6개월분입니다.
        </p>
      </PolicySection>

      <PolicySection id="sec-awards" no="3" title="시상 가중치">
        <div class="policy-table-wrap">
          <table class="policy-table">
            <thead>
              <tr>
                <th scope="col">시상</th>
                <th scope="col" class="num">가중</th>
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
        <ul class="policy-list">
          <li>시상 횟수에도 구간가중을 곱합니다. 최근 Winner 가 1년 반 전 Winner 보다 4배 무겁게 반영됩니다.</li>
          <li>6라운드 상당으로 환산한 뒤 ±1.0타 한도로 절사합니다.</li>
        </ul>
      </PolicySection>

      <PolicySection id="sec-attend" no="4" title="참석률 반영률">
        <p class="policy-lead">
          평균값이 아니라 <strong>변동폭의 반영률</strong>로 적용합니다. 참석이 적으면 표본이 부족해
          평균을 그대로 신뢰하기 어렵기 때문입니다.
        </p>
        <div class="policy-table-wrap">
          <table class="policy-table">
            <thead>
              <tr>
                <th scope="col">연간 참석률</th>
                <th scope="col" class="num">반영률</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in ATTEND_RATES" :key="r.range">
                <th scope="row">{{ r.range }}</th>
                <td class="num">{{ r.rate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="policy-card mt-3">
          <p class="policy-card-title">표본 부족 보완 규칙</p>
          <p class="policy-note m-0">
            가중합이 3.0 미만이면 실질 3라운드에 미달하므로 변동 한도를 ±1타로 좁힙니다. WHS 최소 산정
            요건과 같은 기준입니다. 동결하지 않는 이유는 핸디가 실제 기량과 크게 벌어진 신규·복귀
            회원을 방치하지 않기 위함입니다.
          </p>
        </div>
      </PolicySection>

      <PolicySection id="sec-limits" no="5" title="증감 한도">
        <div class="policy-table-wrap">
          <table class="policy-table">
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
          한도에 걸려 잘린 잔여분은 2028년 산정에 자연히 이월됩니다. 2027년 한도 적용자는 아래 5명입니다.
        </p>
        <ul class="policy-list">
          <li v-for="m in CAPPED_MEMBERS" :key="m.name">
            <strong>{{ m.name }}</strong>
            <span class="policy-flag">한도 적용</span>
            <span class="font-mono">{{ m.before }} → {{ m.after }}</span>
          </li>
        </ul>
      </PolicySection>

      <PolicySection id="sec-course" no="6" title="코스 난이도 지수">
        <p class="policy-lead">
          같은 회원들이 같은 핸디로 쳤는데 특정 구장에서 Net 이 높게 나오면 그 구장이 어려운 것입니다.
          WHS 의 PCC 와 원리가 같습니다.
        </p>
        <pre class="policy-formula">난이도지수 = 해당 구장 평균 Net − 전체 평균 Net
가중적용치 = 난이도지수 × (모임 수 ÷ 4, 최대 1.0)   ※ 표본 적은 구장은 영향 축소</pre>
        <p class="policy-note">산출 창: 2025-07 ~ 2026-11</p>
        <div class="policy-table-wrap mt-2">
          <table class="policy-table">
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
          구눙굴리스에서만 많이 친 회원과 리버사이드에서만 친 회원의 점수를 그대로 비교하면 2.2타 차이가
          생깁니다. 이를 상쇄하는 장치입니다.
        </p>

        <details class="policy-details mt-3">
          <summary>참고: 구장별 Course Rating · Slope</summary>
          <p class="policy-note">
            2027년 산정에는 쓰지 않습니다. 2028년 WHS 전환에 대비해 수집한 값입니다.
          </p>
          <p v-if="courseRatingsLoading" class="policy-note" role="status">불러오는 중...</p>
          <p v-else-if="courseRatingsError" class="policy-note" role="alert">
            불러오기 실패: {{ courseRatingsError }}
            <button type="button" class="policy-link" @click="loadCourseRatings">다시 시도</button>
          </p>
          <div v-else class="policy-table-wrap">
            <table class="policy-table">
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

      <PolicySection id="sec-results" no="7" title="회원별 산정결과 (안)" default-open>
        <HandicapResultsTable />
      </PolicySection>

      <PolicySection id="sec-whs" no="8" title="참고: WHS Handicap Index 대조">
        <p class="policy-lead">외부 표준(WHS)으로 계산해도 비슷한 결과가 나온다는 대조 자료입니다.</p>
        <div class="policy-table-wrap">
          <table class="policy-table">
            <thead>
              <tr>
                <th scope="col">성명</th>
                <th scope="col" class="num">Handicap Index</th>
                <th scope="col" class="num">2026 기준핸디</th>
                <th scope="col" class="num">차이</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in WHS_ROWS" :key="w.name">
                <th scope="row">{{ w.name }}</th>
                <td class="num">{{ w.index }}</td>
                <td class="num">{{ w.std }}</td>
                <td class="num" :class="diffClass(w.diff)">{{ w.diff }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="policy-note mt-2">
          산출: 최근 20라운드 Score Differential 중 최저 8개 평균. 표의 차이 열 기준 평균 절대차는 약
          0.9타이며, 순서도 거의 같습니다.
        </p>
      </PolicySection>

      <PolicySection id="sec-schedule" no="9" title="적용 일정 · 유의사항">
        <ul class="policy-list policy-list-first">
          <li>2027년 1월 모임부터 적용합니다.</li>
          <li>
            조별 금회적용 핸디 ±1 규칙은 현행 유지합니다 (1등조 −1 / 2등조 +1). 본 기준은 연 1회
            기준핸디 산정에만 적용합니다.
          </li>
          <li>손동현 · 신승민: 2027년 상반기 성적으로 7월 중간 재산정을 검토합니다.</li>
          <li>이성남: 휴면 중. 복귀 후 3회 참석 시 재산정합니다.</li>
          <li>
            2028년부터 정식 WHS Handicap Index 전환을 목표로 합니다. 2027년 1월 모임부터 홀별 스코어
            기록으로 전환이 필요합니다.
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
  --pp-bg: #f0f0f0;
  --pp-blue: #e3f2fd;
  --pp-grey: #eceff1;
  --pp-sage: #e8f5e9;
  --pp-text: #546e7a;
  --pp-up: #c62828;
  --pp-down: #1565c0;
  min-height: 100%;
  background: var(--pp-bg);
  color: var(--pp-text);
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
  border: 1px solid var(--pp-text);
  border-radius: 999px;
  background: var(--pp-sage);
  font-size: 0.8125rem;
  font-weight: 600;
}
.policy-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--pp-text);
}

.policy-section {
  border: 1px solid var(--pp-text);
  border-radius: 0.5rem;
  background: var(--pp-grey);
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
  outline: 2px solid var(--pp-text);
  outline-offset: -2px;
}
.policy-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid var(--pp-text);
  border-radius: 999px;
  background: var(--pp-sage);
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
  border: 1px solid var(--pp-text);
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

.policy-table-wrap {
  border: 1px solid var(--pp-text);
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
  text-align: right;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.policy-desc-row td {
  padding-top: 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--pp-text);
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
  border: 1px solid var(--pp-text);
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
