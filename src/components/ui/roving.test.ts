import { describe, expect, it } from 'vitest';
import { nextRovingIndex } from './roving';

describe('nextRovingIndex', () => {
  it('좌우·상하 키로 이동하고 끝에서 순환한다', () => {
    expect(nextRovingIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextRovingIndex('ArrowDown', 2, 3)).toBe(0);
    expect(nextRovingIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextRovingIndex('ArrowUp', 1, 3)).toBe(0);
  });
  it('horizontal 모드에서는 상하 키를 무시한다', () => {
    expect(nextRovingIndex('ArrowDown', 0, 2, 'horizontal')).toBeNull();
    expect(nextRovingIndex('ArrowRight', 0, 2, 'horizontal')).toBe(1);
  });
  it('Home/End 는 homeEnd 일 때만 동작한다', () => {
    expect(nextRovingIndex('Home', 1, 3)).toBeNull();
    expect(nextRovingIndex('Home', 2, 3, 'horizontal', true)).toBe(0);
    expect(nextRovingIndex('End', 0, 3, 'horizontal', true)).toBe(2);
  });
  it('관계없는 키와 빈 목록은 null', () => {
    expect(nextRovingIndex('Tab', 0, 3)).toBeNull();
    expect(nextRovingIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
