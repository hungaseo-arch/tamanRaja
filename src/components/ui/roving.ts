/**
 * roving tabindex 용 방향키 계산. 라디오 그룹·탭 목록이 같이 쓴다.
 * 이동할 키가 아니면 null 을 돌려주고, 끝에서는 반대쪽 끝으로 돈다.
 */
export type RovingMode = 'both' | 'horizontal';

export function nextRovingIndex(
  key: string,
  current: number,
  length: number,
  mode: RovingMode = 'both',
  homeEnd = false
): number | null {
  if (length <= 0) return null;
  const prev = mode === 'both' ? ['ArrowLeft', 'ArrowUp'] : ['ArrowLeft'];
  const next = mode === 'both' ? ['ArrowRight', 'ArrowDown'] : ['ArrowRight'];
  if (prev.includes(key)) return (current - 1 + length) % length;
  if (next.includes(key)) return (current + 1) % length;
  if (homeEnd && key === 'Home') return 0;
  if (homeEnd && key === 'End') return length - 1;
  return null;
}
