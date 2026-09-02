import { useMediaQuery } from '@vueuse/core';
import type { Ref } from 'vue';

/** Tailwind 기본 분기점 — 이 폭부터 그 단계의 열이 드러난다. */
const MIN_WIDTH = { sm: 640, md: 768 } as const;

/**
 * 표가 열을 숨기고 있는 좁은 화면인지.
 *
 * 표는 좁은 화면에서 일부 열을 숨기고(hidden sm:table-cell 등), 그 값은
 * 줄 상세 창(RowDetailDialog)으로 본다. 열이 모두 보이는 넓은 화면에서는
 * 상세 창이 표와 같은 내용을 되풀이할 뿐이라 열지 않는다.
 *
 * @param breakpoint 그 표의 열이 전부 드러나는 분기점.
 * @returns 아직 열이 숨겨져 있는 폭이면 true.
 */
export function useCompactTable(breakpoint: keyof typeof MIN_WIDTH): Ref<boolean> {
  return useMediaQuery(`(max-width: ${MIN_WIDTH[breakpoint] - 0.02}px)`);
}
