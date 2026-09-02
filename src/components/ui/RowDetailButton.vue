<script setup lang="ts">
/**
 * 표에서 상세를 여는 자리 — 줄의 이름 칸에 놓는다.
 * 눌러서 열리는 것이 보이도록 점선 밑줄을 두고, 화면 낭독기에는
 * 창이 열린다는 것(aria-haspopup)과 어느 줄인지를 알린다.
 *
 * 열이 모두 보이는 넓은 화면에서는 상세 창이 표와 같은 내용이라
 * enabled=false 로 넘겨 이름만 글자로 둔다 — 눌러도 아무 일이 없는
 * 밑줄이 남아 있으면 누를 것이 있는 줄로 잘못 읽힌다.
 */
interface Props {
  label: string;
  /** 상세를 열 수 있는 화면인지. 아니면 글자만 남는다. */
  enabled?: boolean;
}
withDefaults(defineProps<Props>(), { enabled: true });
</script>

<template>
  <button
    v-if="enabled"
    type="button"
    aria-haspopup="dialog"
    :aria-label="`${label} 상세 보기`"
    class="-mx-1 rounded-sm px-1 py-1 text-left underline decoration-dotted decoration-muted-foreground/70 underline-offset-4 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  ><slot /></button>
  <slot v-else />
</template>
