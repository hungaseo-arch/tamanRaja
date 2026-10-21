import { describe, expect, it } from 'vitest';
import { computeResults, type ScoredRow } from './rank';

const row = (id: string, score: number, app_hc: number, std_hc = app_hc + 1, prev: ScoredRow['prev_result_group'] = null): ScoredRow =>
  ({ member_id: id, score, app_hc, std_hc, prev_result_group: prev });

describe('computeResults', () => {
  it('NET 낮은 순 절반이 1등조, 홀수면 나머지가 2등조', () => {
    // NET: a=0, b=2, c=5
    const r = computeResults([row('c', 15, 10), row('a', 10, 10), row('b', 12, 10)]);
    expect(r.a.result_group).toBe('1등조');
    expect(r.b.result_group).toBe('2등조');
    expect(r.c.result_group).toBe('2등조');
  });

  it('Winner 최저 NET · Medalist 최저 스코어(Winner 제외) · Host 최고 NET', () => {
    // NET: w=-5, m=3, x=4, h=9 / 스코어 최저(Winner 제외)는 m
    const r = computeResults([
      row('w', 10, 15), row('m', 8, 5), row('x', 14, 10), row('h', 19, 10),
    ]);
    expect(r.w.result_rank).toBe('Winner');
    expect(r.m.result_rank).toBe('Medalist');
    expect(r.h.result_rank).toBe('Host');
    expect(r.x.result_rank).toBe('');
  });

  it('Host 와 Medalist 가 같은 회원이면 Medalist 가 우선', () => {
    // NET: w=-5, h=4 / 최고 NET 도, Winner 제외 최저 스코어도 h
    const r = computeResults([row('w', 10, 15), row('h', 14, 10)]);
    expect(r.h.result_rank).toBe('Medalist');
    expect(Object.values(r).some((x) => x.result_rank === 'Host')).toBe(false);
  });

  it('차월 핸디: 직전과 같은 조면 ±1, 조가 바뀌면 기준 핸디 복귀, 초기화 달은 ±1', () => {
    const r = computeResults([
      row('same1', 0, 10, 12, '1등조'),   // 1등조 유지 → 9
      row('fresh', 0, 10, 10, '2등조'),   // app=std 초기화 → 1등조 9
      row('back', 20, 10, 12, '1등조'),   // 1등조 → 2등조 → 기준 12
      row('same2', 30, 10, 12, '2등조'),  // 2등조 유지 → 11
    ]);
    expect(r.same1.next_hc).toBe(9);
    expect(r.fresh.next_hc).toBe(9);
    expect(r.back.next_hc).toBe(12);
    expect(r.same2.next_hc).toBe(11);
  });

  it('입력이 없으면 빈 결과', () => {
    expect(computeResults([])).toEqual({});
  });
});
