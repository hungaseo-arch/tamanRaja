<script setup lang="ts">
import { cn } from '@/lib/utils';
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <div :class="cn('px-4 pb-4 pt-0 sm:px-6 sm:pb-6', props.class)"><slot /></div>
</template>
