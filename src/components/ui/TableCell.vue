<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <td
    :class="cn('px-2 py-2 align-middle has-[[role=checkbox]]:pr-0', props.class)"
  ><slot /></td>
</template>
