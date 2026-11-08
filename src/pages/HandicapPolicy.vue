<script setup lang="ts">
import { onMounted } from 'vue';
import { setPageTitle } from '@/lib/title';
import PolicySection from '@/components/PolicySection.vue';

onMounted(() => setPageTitle('핸디캡 산정기준'));

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
  .policy-section {
    break-inside: avoid-page;
  }
}
</style>
