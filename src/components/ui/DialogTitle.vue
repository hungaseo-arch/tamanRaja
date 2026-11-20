<script setup lang="ts">
import { cn } from '@/lib/utils';

/**
 * 모달 제목. 모든 모달이 같은 크기(18px)·굵기·간격을 쓴다.
 * pr-12: Dialog 오른쪽 위 닫기 버튼(44px) 아래로 글자가 파고들지 않게 비운다.
 */
interface Props { class?: string }
const props = defineProps<Props>();
</script>

<template>
  <h2 :class="cn('mb-4 pr-12 text-lg font-bold leading-snug', props.class)">
    <slot />
  </h2>
</template>
