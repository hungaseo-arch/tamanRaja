// 「27년 핸디캡 (안)」 데이터·문구 정합성 검증.
//
// 값의 정본은 작업지시서(2026-11-08, 개정판)의 2027 산정결과 표다. 이 파일은 그 표를 픽스처로 들고,
//  1) DB 에 적재하는 마이그레이션 SQL(시드 + p12 갱신)이 픽스처와 일치하는지,
//  2) 픽스처의 값끼리 산식 관계가 맞는지,
//  3) 페이지에 하드코딩된 표·문구가 픽스처와 일치하는지,
//  4) 화면에 금지 용어가 없고 섹션 번호 참조가 실제 번호와 맞는지
// 를 확인한다. 산정값을 바꿀 때는 픽스처와 마이그레이션을 함께 고치고 이 테스트를 돌린다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Page from '@/pages/HandicapPolicy.vue';

const ROOT = resolve(__dirname, '../..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');
const MINUS = '−';

interface Row {
  prev: number; std: number; wSum: number; wAvg: number;
  a: number | null; b: number | null; c: number | null;
  award: number; calc: number; rate: number; apply: number;
  raw: number; final: number; capped: boolean; low: boolean;
}

// 정본: 작업지시서 2절 표 (증감은 소수 둘째 자리).
const EXPECTED: Record<string, Row> = {
  박영진: { prev: 10, std: 9, wSum: 8.5, wAvg: 15.7, a: 15.5, b: 14.8, c: 18.0, award: -0.79, calc: 8.7, rate: 81.8, apply: 1.0, raw: -1.29, final: -1.29, capped: false, low: false },
  정인원: { prev: 12, std: 10, wSum: 6.5, wAvg: 16.5, a: 15.6, b: 24.3, c: 17.4, award: -1.0, calc: 9.3, rate: 54.5, apply: 0.7, raw: -1.89, final: -1.89, capped: false, low: false },
  박재현: { prev: 11, std: 11, wSum: 7.0, wAvg: 17.4, a: 17.4, b: 19.1, c: 15.8, award: -0.11, calc: 11.1, rate: 90.0, apply: 1.0, raw: 0.09, final: 0.09, capped: false, low: false },
  서종환: { prev: 13, std: 11, wSum: 9.0, wAvg: 17.7, a: 17.7, b: 15.8, c: 20.8, award: -0.67, calc: 10.8, rate: 90.9, apply: 1.0, raw: -2.17, final: -2.0, capped: true, low: false },
  김재헌: { prev: 14, std: 12, wSum: 8.0, wAvg: 19.0, a: 18.1, b: 21.5, c: 18.9, award: -0.52, calc: 12.3, rate: 81.8, apply: 1.0, raw: -1.72, final: -1.72, capped: false, low: false },
  유영보: { prev: 15, std: 14, wSum: 9.5, wAvg: 20.0, a: 20.6, b: 18.2, c: 20.9, award: 0.0, calc: 13.8, rate: 100.0, apply: 1.0, raw: -1.2, final: -1.2, capped: false, low: false },
  장효익: { prev: 14, std: 15, wSum: 8.75, wAvg: 21.5, a: 21.3, b: 22.6, c: 21.3, award: 0.0, calc: 15.3, rate: 81.8, apply: 1.0, raw: 1.3, final: 1.3, capped: false, low: false },
  고영춘: { prev: 17, std: 16, wSum: 8.75, wAvg: 22.6, a: 23.8, b: 19.4, c: 21.7, award: 0.09, calc: 16.5, rate: 90.9, apply: 1.0, raw: -0.51, final: -0.51, capped: false, low: false },
  남정곤: { prev: 15, std: 18, wSum: 8.0, wAvg: 23.8, a: 23.6, b: 24.3, c: null, award: 0.56, calc: 18.2, rate: 90.9, apply: 1.0, raw: 3.16, final: 3.0, capped: true, low: false },
  조학영: { prev: 19, std: 19, wSum: 8.5, wAvg: 25.0, a: 25.2, b: 23.7, c: 26.2, award: -0.18, calc: 18.6, rate: 81.8, apply: 1.0, raw: -0.38, final: -0.38, capped: false, low: false },
  정기혁: { prev: 20, std: 20, wSum: 9.5, wAvg: 26.3, a: 25.8, b: 27.3, c: 27.2, award: -0.08, calc: 20.0, rate: 90.9, apply: 1.0, raw: 0.02, final: 0.02, capped: false, low: false },
  정재욱: { prev: 18, std: 21, wSum: 9.75, wAvg: 27.4, a: 28.1, b: 25.0, c: 28.9, award: 0.54, calc: 21.7, rate: 100.0, apply: 1.0, raw: 3.74, final: 3.0, capped: true, low: false },
  손동현: { prev: 24, std: 24, wSum: 2.5, wAvg: 29.7, a: null, b: 29.0, c: 32.5, award: 0.0, calc: 23.5, rate: 45.5, apply: 0.5, raw: -0.25, final: -0.25, capped: false, low: true },
  신승민: { prev: 24, std: 25, wSum: 2.0, wAvg: 34.7, a: 36.3, b: 33.1, c: null, award: 0.0, calc: 28.5, rate: 27.3, apply: 0.5, raw: 2.25, final: 1.0, capped: true, low: true },
  이성남: { prev: 26, std: 27, wSum: 2.0, wAvg: 40.2, a: null, b: 44.0, c: 36.5, award: 0.75, calc: 34.8, rate: 66.7, apply: 0.7, raw: 6.12, final: 1.0, capped: true, low: true },
};
const NAMES = Object.keys(EXPECTED);

const num = (s: string): number | null => (s.startsWith('null') ? null : Number(s));

/** 시드 SQL 의 2027 행을 읽고, p12 마이그레이션의 증감 갱신값(둘째 자리)을 덮어쓴다. */
function loadMigrationRows(): Record<string, Row> {
  const seed = read('supabase/migrations/20261108000200_p10_handicap_annual_seed.sql');
  const re =
    /\('(\S+?)', (\d+), (\d+), ([\d.]+), (null::numeric|[\d.]+), (null::numeric|[\d.]+), (null::numeric|[\d.]+), (null::numeric|[\d.]+), (-?[\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), (-?[\d.]+), (-?[\d.]+), (true|false), (true|false),/g;
  const rows: Record<string, Row> = {};
  for (const m of seed.matchAll(re)) {
    rows[m[1]] = {
      prev: Number(m[2]), std: Number(m[3]), wSum: Number(m[4]), wAvg: num(m[5]) as number,
      a: num(m[6]), b: num(m[7]), c: num(m[8]), award: Number(m[9]), calc: Number(m[10]),
      rate: Number(m[11]), apply: Number(m[12]), raw: Number(m[13]), final: Number(m[14]),
      capped: m[15] === 'true', low: m[16] === 'true',
    };
  }
  const p12 = read('supabase/migrations/20261108000600_p12_handicap_delta_2dp_and_2025_year_end.sql');
  const upd = p12.split('as v(name, raw, final)')[0];
  for (const m of upd.matchAll(/\('(\S+)',\s+(-?[\d.]+),\s+(-?[\d.]+)\)/g)) {
    rows[m[1]].raw = Number(m[2]);
    rows[m[1]].final = Number(m[3]);
  }
  return rows;
}

describe('마이그레이션 SQL 과 작업지시서 표', () => {
  const rows = loadMigrationRows();

  it('15명 전원이 적재된다', () => {
    expect(Object.keys(rows).sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s: 시드(+p12 증감 갱신)가 지시서 값과 전 항목 일치', (name) => {
    expect(rows[name]).toEqual(EXPECTED[name]);
  });

  it('핸디 총합은 2026·2027 모두 252 (중립)', () => {
    const vals = Object.values(rows);
    expect(vals.reduce((s, r) => s + r.prev, 0)).toBe(252);
    expect(vals.reduce((s, r) => s + r.std, 0)).toBe(252);
  });

  it('2025 기준(연말) 기대값 13명이 p12 검증 블록과 같다', () => {
    const p12 = read('supabase/migrations/20261108000600_p12_handicap_delta_2dp_and_2025_year_end.sql');
    const expected2025: Record<string, number> = {
      이성남: 22, 정재욱: 12, 박영진: 9, 정인원: 10, 박재현: 9, 손동현: 21,
      정기혁: 15, 유영보: 12, 김재헌: 15, 고영춘: 16, 조학영: 14, 장효익: 13, 서종환: 14,
    };
    const block = p12.slice(p12.indexOf("('이성남', 22)"));
    const found: Record<string, number> = {};
    for (const m of block.matchAll(/\('(\S+)', (\d+)\)/g)) found[m[1]] = Number(m[2]);
    expect(found).toEqual(expected2025);
    expect(p12).toContain("mh.year_month = '2025-12'");
  });
});

describe('산정값끼리의 산식 관계', () => {
  it.each(NAMES)('%s', (name) => {
    const r = EXPECTED[name];
    // ⑥ 산출핸디 = 가중평균 오버파 − 6.2 + 시상보정
    expect(Math.abs(r.wAvg - 6.2 + r.award - r.calc)).toBeLessThanOrEqual(0.06);
    // ⑦ 증감 = (산출핸디 − 전년 기준) × 참석률 반영률
    expect(Math.abs((r.calc - r.prev) * r.apply - r.raw)).toBeLessThanOrEqual(0.06);
    // 참석률 반영률 구간: 80 이상 1.00 / 50~80 0.70 / 50 미만 0.50
    expect(r.apply).toBe(r.rate >= 80 ? 1 : r.rate >= 50 ? 0.7 : 0.5);
    // 표본 부족: 가중 라운드 3.00 미만
    expect(r.low).toBe(r.wSum < 3);
    // 한도: 표본 부족 ±1, 그 외 인하 −2 / 인상 +3
    const [lo, hi] = r.low ? [-1, 1] : [-2, 3];
    expect(r.final).toBeCloseTo(Math.max(lo, Math.min(hi, r.raw)), 2);
    expect(r.capped).toBe(r.raw < lo || r.raw > hi);
    // ⑧ 2027 기준 = 전년 기준 + 증감 (0.5 는 올림). 증감을 둘째 자리로 두는 이유 (고영춘 16.49 → 16)
    expect(Math.floor(r.prev + r.final + 0.5 + 1e-9)).toBe(r.std);
    // 가중 라운드는 전 모임 참석 시 10.00 이 상한 (6 + 2.5 + 1.5)
    expect(r.wSum).toBeLessThanOrEqual(10);
    // 시상보정은 ±1.0 한도
    expect(Math.abs(r.award)).toBeLessThanOrEqual(1);
  });

  it('고영춘은 둘째 자리 증감에서만 16 이 된다', () => {
    expect(Math.floor(17 + -0.5 + 0.5)).toBe(17);
    expect(Math.floor(17 + EXPECTED.고영춘.final + 0.5)).toBe(16);
  });
});

// ── 페이지 소스의 하드코딩 값 ────────────────────────────────────────────────
const pageSrc = read('src/pages/HandicapPolicy.vue');
function block(name: string): string {
  const m = pageSrc.match(new RegExp(`const ${name} = \\[(.*?)\\n\\];`, 's'));
  if (!m) throw new Error(`${name} 상수를 찾지 못함`);
  return m[1];
}

describe('페이지 상수와 작업지시서', () => {
  it('구간 가중 A100 / B50 / C25 / 미반영 0', () => {
    const got = [...block('WEIGHT_BANDS').matchAll(/band: '(.+?)', period: '(.+?)', weight: '(.+?)'/g)].map((m) => [m[1], m[2], m[3]]);
    expect(got).toEqual([
      ['A', '2026-06 ~ 2026-11', '100.0%'],
      ['B', '2026-01 ~ 2026-05', '50.0%'],
      ['C', '2025-07 ~ 2025-12', '25.0%'],
      ['—', '2025-06 이전', '0.0%'],
    ]);
  });

  it('시상 계수 Winner −0.50 / Medalist −0.25 / Host +0.50', () => {
    const got = [...block('AWARDS').matchAll(/name: '(.+?)', weight: '(.+?)'/g)].map((m) => [m[1], m[2]]);
    expect(got).toEqual([['Winner', `${MINUS}0.50`], ['Medalist', `${MINUS}0.25`], ['Host', '+0.50']]);
  });

  it('참석률 반영률 3구간', () => {
    const got = [...block('ATTEND_RATES').matchAll(/range: '(.+?)', rate: '(.+?)'/g)].map((m) => [m[1], m[2]]);
    expect(got).toEqual([['80.0% 이상', '100.0%'], ['50.0 ~ 80.0%', '70.0%'], ['50.0% 미만', '50.0%']]);
  });

  it('증감 한도 인하 2타 / 인상 3타 / 표본 부족 ±1타', () => {
    const got = [...block('LIMITS').matchAll(/kind: '(.+?)', limit: '(.+?)'/g)].map((m) => [m[1], m[2]]);
    expect(got).toEqual([['인하 (핸디↓, 불리)', '연 2타'], ['인상 (핸디↑, 유리)', '연 3타'], ['표본 부족 시', '±1타']]);
  });

  it('한도 적용자 5명이 픽스처의 capped 행과 같다 (둘째 자리)', () => {
    const fmt = (v: number): string => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(2);
    const got = [...block('CAPPED_MEMBERS').matchAll(/name: '(.+?)', before: '(.+?)', after: '(.+?)'/g)].map((m) => [m[1], m[2], m[3]]);
    const want = NAMES.filter((n) => EXPECTED[n].capped).map((n) => [n, fmt(EXPECTED[n].raw), fmt(EXPECTED[n].final)]);
    expect(got.sort()).toEqual(want.sort());
    expect(got).toHaveLength(5);
  });

  it('코스 난이도 7행: 지시서 값, 전체 평균 Net 일정, 가중적용치 = 지수 × min(모임÷4, 1)', () => {
    const rows = [...block('COURSE_DIFFICULTY').matchAll(/name: '(.+?)', par: (\d+), meetings: (\d+), rounds: (\d+), over: '(.+?)', net: '(.+?)', index: '(.+?)', applied: '(.+?)'/g)];
    expect(rows.map((m) => [m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]])).toEqual([
      ['리버사이드', '72', '1', '12', '24.4', '11.0', '+3.7', '+0.9'],
      ['센툴하일랜드', '72', '2', '22', '23.8', '8.5', '+1.2', '+0.6'],
      ['자고라위', '72', '5', '57', '22.4', '7.8', '+0.5', '+0.5'],
      ['레인보우', '72', '3', '25', '23.2', '7.5', '+0.2', '+0.1'],
      ['구눙굴리스', '72', '4', '47', '21.8', '6.0', `${MINUS}1.3`, `${MINUS}1.3`],
      ['끄다똔', '72', '1', '8', '18.1', '5.1', `${MINUS}2.2`, `${MINUS}0.5`],
      ['보고라야', '71', '1', '10', '20.1', '4.4', `${MINUS}2.9`, `${MINUS}0.7`],
    ]);
    const parse = (s: string): number => Number(s.replace(MINUS, '-'));
    const overall = rows.map((m) => Number(m[6]) - parse(m[7]));
    expect(Math.max(...overall) - Math.min(...overall)).toBeLessThan(0.06);
    for (const m of rows) {
      expect(Math.abs(parse(m[7]) * Math.min(Number(m[3]) / 4, 1) - parse(m[8]))).toBeLessThanOrEqual(0.051);
    }
  });

  it('WHS 대조 14명: 2026 기준·2027 기준(안)이 픽스처와 같다', () => {
    const got = [...block('WHS_ROWS').matchAll(/name: '(.+?)', index: ([\d.]+), std2026: (\d+), std2027: (\d+)/g)];
    expect(got).toHaveLength(14);
    for (const m of got) {
      expect(EXPECTED[m[1]], m[1]).toBeDefined();
      expect(Number(m[3]), `${m[1]} 2026`).toBe(EXPECTED[m[1]].prev);
      expect(Number(m[4]), `${m[1]} 2027`).toBe(EXPECTED[m[1]].std);
    }
    // 이성남은 휴면이라 WHS 표에 없다
    expect(got.map((m) => m[1])).not.toContain('이성남');
  });

  it('박영진 시상 예시: 행별 계수 × 가중, 합계 −1.125, 1라운드당 −0.132, ×6 = −0.79', () => {
    const rows = [...block('AWARD_EXAMPLE').matchAll(/coef: '(.+?)', band: '(.+?)', wgt: '(.+?)', prod: '(.+?)'/g)];
    expect(rows).toHaveLength(8);
    const parse = (s: string): number => Number(s.replace(MINUS, '-'));
    let sum = 0;
    for (const m of rows) {
      sum += parse(m[1]) * Number(m[3]);
      expect(Math.abs(parse(m[1]) * Number(m[3]) - parse(m[4]))).toBeLessThan(0.0006);
    }
    expect(sum).toBeCloseTo(-1.125, 9);
    expect(-1.125 / EXPECTED.박영진.wSum).toBeCloseTo(-0.132, 3);
    expect((-1.125 / EXPECTED.박영진.wSum) * 6).toBeCloseTo(EXPECTED.박영진.award, 2);
  });

  it('정기혁: 가중 라운드 9.50 중 최근 6개월 6.00 = 63.2%', () => {
    expect(EXPECTED.정기혁.wSum).toBe(9.5);
    expect(Math.round((6 / 9.5) * 1000) / 10).toBe(63.2);
  });
});

// ── 화면 문구 ───────────────────────────────────────────────────────────────
describe('화면 문구', () => {
  let text = '';
  let sections: Record<string, string> = {};

  it('렌더링', async () => {
    const html = await renderToString(createSSRApp(Page));
    text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    sections = {};
    for (const m of html.matchAll(/policy-no[^>]*>\s*(\d)\s*<\/span>[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/g)) sections[m[1]] = m[2];
    expect(text.length).toBeGreaterThan(1000);
  });

  it('금지 용어가 없다 (가중합 / 참석률 가중치 / 6라운드)', () => {
    expect(text).not.toMatch(/가중합|참석률 가중치|6라운드/);
  });

  it('상단 배지에 "회원 확정 전"이 있다', () => {
    expect(text).toContain('2027년 적용(안) · 2026-11-08 기준 · 회원 확정 전');
  });

  it('필수 문구가 모두 있다', () => {
    for (const phrase of [
      '부호 설명',
      '시상 원점수 계산',
      '계수 6을 곱하는 이유',
      '참석률 분모',
      '참석률과 가중 라운드는 다른 값',
      '3타 인상 2명 설명',
      '핸디 인상은 불이익이 아니라 혜택',
      '이성남 회원 안내',
      '복귀 전까지 적용되지 않는 참고값',
      '표본 부족 보완 규칙',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
  });

  it('"N번 섹션" 참조가 문맥에 맞는 섹션을 가리킨다', () => {
    // 문구 → 가리켜야 할 섹션 제목. 번호가 실재하는 것만으로는 부족하다 (엉뚱한 섹션을 가리킬 수 있다).
    const contexts: [RegExp, string][] = [
      [/구간별 가중은 (\d)번 섹션/, '구간 가중'],
      [/시상 계수와 계산 예시는 (\d)번 섹션/, '시상 가중치'],
      [/계수 6의 의미는 (\d)번 섹션/, '시상 가중치'],
      [/반영률은 (\d)번 섹션/, '참석률 반영률'],
    ];
    for (const [re, title] of contexts) {
      const m = text.match(re);
      expect(m, `${re} 문구가 없음`).not.toBeNull();
      expect(sections[m![1]], `${re} → ${m![1]}번`).toContain(title);
    }
    // 위 네 문맥 밖의 "N번 섹션" 참조가 새로 생기면 여기서 알려 준다.
    expect([...text.matchAll(/(\d)번 섹션/g)]).toHaveLength(contexts.length);
  });

  it('섹션 1~9 가 모두 있고 1번이 산정결과다', () => {
    expect(Object.keys(sections).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(sections['1']).toContain('회원별 산정결과');
  });
});
