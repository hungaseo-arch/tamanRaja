<script setup lang="ts">
/**
 * RowDetailDialog 안의 한 줄. 왼쪽에 항목 이름, 오른쪽에 값.
 * 값은 슬롯으로 넣는다 — 비워 두면 '-' 가 나온다.
 */
interface Props { label: string }
defineProps<Props>();
</script>

<template>
  <div class="flex items-baseline justify-between gap-4 px-3 py-2">
    <dt class="shrink-0 text-xs text-muted-foreground">{{ label }}</dt>
    <dd class="min-w-0 text-right text-sm font-medium">
      <slot><span class="text-muted-foreground">-</span></slot>
    </dd>
  </div>
</template>
