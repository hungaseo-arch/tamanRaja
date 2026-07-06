<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <th
    :class="cn(
      'px-2 py-2.5 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:pr-0',
      props.class
    )"
  ><slot /></th>
</template>
