<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <th
    :class="cn(
      // sticky top-0: 표가 세로 스크롤 컨테이너일 때 헤더 행이 남는다.
      // 세로 스크롤이 없는 표에서는 아무 영향이 없다.
      // border-b 는 tr 이 아니라 셀에 준다 — border-separate 에서는 tr 의
      // 테두리가 그려지지 않기 때문이다.
      'sticky top-0 z-20 bg-card border-b border-border',
      'px-2 py-2.5 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:pr-0',
      props.class
    )"
  ><slot /></th>
</template>
