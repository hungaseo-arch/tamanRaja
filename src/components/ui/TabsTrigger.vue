<script setup lang="ts">
import { computed, inject } from 'vue';
import { cn } from '@/lib/utils';
import { nextRovingIndex } from './roving';
import { TABS_KEY } from './tabs-context';

interface Props {
  value: string;
  class?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

// 좁힌 타입을 새 상수에 옮겨 담는다. 아래 activate 는 함수 선언이라
// 위 if 로 좁힌 결과가 그 안까지 따라오지 않는다.
const injected = inject(TABS_KEY);
if (!injected) throw new Error('TabsTrigger must be used inside <Tabs>');
const ctx = injected;

const isActive = computed(() => ctx.value.value === props.value);

function activate(): void {
  if (props.disabled) return;
  ctx.setValue(props.value);
}

// 방향키로 같은 탭 목록의 다른 탭으로 옮기고 바로 활성화한다. 목록은 DOM 에서
// 찾는다 — 비활성 탭은 건너뛴다.
function onKeydown(e: KeyboardEvent): void {
  const self = e.currentTarget as HTMLElement;
  const list = self.closest('[role="tablist"]');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const next = nextRovingIndex(e.key, tabs.indexOf(self as HTMLButtonElement), tabs.length, 'horizontal', true);
  if (next === null) return;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
</script>

<template>
  <button
    type="button"
    role="tab"
    :id="`${ctx.baseId}-tab-${props.value}`"
    :aria-controls="`${ctx.baseId}-panel-${props.value}`"
    :tabindex="isActive ? 0 : -1"
    :aria-selected="isActive"
    :disabled="disabled"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 min-h-11 sm:min-h-0 text-sm font-extrabold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      props.class
    )"
    @click="activate"
    @keydown="onKeydown"
  >
    <slot />
  </button>
</template>
