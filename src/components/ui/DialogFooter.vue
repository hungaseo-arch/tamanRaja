<script setup lang="ts">
import { cn } from '@/lib/utils';

/**
 * 모달 하단 버튼 줄. 취소는 왼쪽, 주 동작은 오른쪽(마지막 자식).
 * 모바일은 두 칸 균등, sm 이상은 오른쪽 정렬. 버튼 높이는 항상 44px.
 * 버튼이 하나뿐이면 class="grid-cols-1" 로 넘긴다.
 */
interface Props { class?: string }
const props = defineProps<Props>();
</script>

<template>
  <div
    :class="cn(
      'grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3 [&>button]:h-11 sm:[&>button]:min-w-24',
      props.class
    )"
  >
    <slot />
  </div>
</template>
