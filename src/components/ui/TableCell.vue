<script setup lang="ts">
import type { TdHTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
// colspan 등은 그대로 <td> 로 흘러간다 (extends 앞 표시는 Button.vue 참고).
interface Props extends /* @vue-ignore */ TdHTMLAttributes { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <td
    :class="cn('border-b border-border px-2 py-2 align-middle has-[[role=checkbox]]:pr-0', props.class)"
  ><slot /></td>
</template>
