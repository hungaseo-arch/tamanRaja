import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 모달 상세는 인쇄되지 않으므로, 같은 근거를 담은 인쇄 전용 표가 빠지지 않았는지 정적으로 점검한다.
const vue = readFileSync('src/components/HandicapResultsTable.vue', 'utf-8');

describe('핸디캡 산정결과 인쇄 상세', () => {
  it('인쇄 전용 표가 화면에서는 숨겨지고 인쇄에서만 보인다', () => {
    expect(vue).toMatch(/\.pp-print-only\s*\{\s*display:\s*none;/);
    expect(vue).toMatch(/@media print\s*\{\s*\.pp-print-only\s*\{\s*display:\s*block;/);
  });
  it('모든 회원 행(sorted)을 그리고 모달 상세의 핵심 근거 열을 포함한다', () => {
    const block = vue.slice(vue.indexOf('pp-detail-print'));
    expect(block).toMatch(/v-for="r in sorted"/);
    for (const k of ['avg_a', 'avg_b', 'avg_c', 'w_sum', 'award_raw', 'award_adj', 'calc_hc', 'apply_rate', 'raw_delta', 'final_delta']) {
      expect(block).toContain(`r.${k}`);
    }
    expect(block).toContain('fmtAwardCounts(r)');
    expect(block).toContain('printNote(r)');
  });
  it('인쇄용 표는 새 페이지에서 시작한다', () => {
    expect(vue).toMatch(/break-before:\s*page/);
  });
  it('휴면 안내는 모달에 DORMANT_TIP 로 보이고 뱃지에는 터치 불가 속성이 없다', () => {
    expect(vue).toMatch(/<DetailItem v-if="selected\.dormant_from" label="휴면">[\s\S]*?\{\{ DORMANT_TIP \}\}/);
    const badge = vue.slice(vue.indexOf('pp-dormant"'), vue.indexOf('>휴면</span>'));
    expect(badge).not.toMatch(/tabindex|role=|:title|:aria-label/);
  });
  it('산정결과와 인간미 조회는 Promise.all 로 병렬 처리한다', () => {
    expect(vue).toMatch(/Promise\.all\(\[[\s\S]*?v_handicap_annual[\s\S]*?handicap_humanity/);
  });
});
