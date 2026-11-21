<script setup lang="ts">
import type { TdHTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
// colspan 등은 그대로 <td> 로 흘러간다 (extends 앞 표시는 Button.vue 참고).
// rowHeader: 그 줄의 이름이 되는 칸(회원·월)을 <th scope="row"> 로 낸다. 화면 낭독기가 다른 칸을
// 읽을 때 "누구의 값인지" 알려 준다. 열 제목(TableHead)과 달리 sticky·배경은 붙이지 않는다.
interface Props extends /* @vue-ignore */ TdHTMLAttributes { class?: string; rowHeader?: boolean }
const props = defineProps<Props>();
</script>
<template>
  <component
    :is="props.rowHeader ? 'th' : 'td'"
    :scope="props.rowHeader ? 'row' : undefined"
    :class="cn('border-b border-border px-2 py-2 align-middle has-[[role=checkbox]]:pr-0', props.rowHeader && 'text-left font-normal', props.class)"
  ><slot /></component>
</template>
