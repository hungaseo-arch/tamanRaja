<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <tr
    :class="cn(
      // 행 구분선은 셀(TableCell/TableHead)의 border-b 가 그린다.
      'transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      props.class
    )"
  ><slot /></tr>
</template>
