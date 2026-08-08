<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <!-- 이 div 가 표의 유일한 스크롤 컨테이너다. 페이지 쪽에서 다시 감싸면
       스크롤바가 두 개 생기므로 감싸지 말 것. (P1-4)
       border-separate: sticky 셀에서도 테두리가 함께 고정되도록. collapse 상태의
       테두리는 셀이 아니라 표에 그려져 스크롤 시 떨어져 나간다. -->
  <div class="relative w-full h-full overflow-auto">
    <table :class="cn('w-full h-full caption-bottom text-sm border-separate border-spacing-0', props.class)">
      <slot />
    </table>
  </div>
</template>
