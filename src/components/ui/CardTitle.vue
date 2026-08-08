<script setup lang="ts">
import { cn } from '@/lib/utils';
// 카드 제목이 곧 그 화면의 제목인 경우가 있어(월간 기록의 모임 표제) 태그를
// 고를 수 있게 둔다. 기본은 h3 — 제목 단계를 건너뛰지 않도록 쓰는 쪽에서 정한다.
interface Props { class?: string; as?: 'h1' | 'h2' | 'h3' }
const props = defineProps<Props>();
</script>
<template>
  <component :is="props.as ?? 'h3'" :class="cn('text-2xl font-semibold leading-none tracking-tight', props.class)">
    <slot />
  </component>
</template>
