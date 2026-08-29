<script setup lang="ts">
/**
 * 표에서 상세를 여는 자리 — 줄의 이름 칸에 놓는다.
 * 눌러서 열리는 것이 보이도록 점선 밑줄을 두고, 화면 낭독기에는
 * 창이 열린다는 것(aria-haspopup)과 어느 줄인지를 알린다.
 */
interface Props { label: string }
defineProps<Props>();
</script>

<template>
  <button
    type="button"
    aria-haspopup="dialog"
    :aria-label="`${label} 상세 보기`"
    class="-mx-1 rounded-sm px-1 py-1 text-left underline decoration-dotted decoration-muted-foreground/70 underline-offset-4 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  ><slot /></button>
</template>
