<script setup lang="ts">
import { computed, inject } from 'vue';
import { cn } from '@/lib/utils';
import { TABS_KEY } from './tabs-context';

interface Props {
  value: string;
  class?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const ctx = inject(TABS_KEY);
if (!ctx) throw new Error('TabsTrigger must be used inside <Tabs>');

const isActive = computed(() => ctx.value.value === props.value);

function activate(): void {
  if (props.disabled) return;
  ctx.setValue(props.value);
}
</script>

<template>
  <button
    type="button"
    role="tab"
    :aria-selected="isActive"
    :disabled="disabled"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      props.class
    )"
    @click="activate"
  >
    <slot />
  </button>
</template>
