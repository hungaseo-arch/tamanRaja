<script setup lang="ts">
import { computed, inject } from 'vue';
import { cn } from '@/lib/utils';
import { TABS_KEY } from './tabs-context';

interface Props {
  value: string;
  class?: string;
}

const props = defineProps<Props>();

const ctx = inject(TABS_KEY);
if (!ctx) throw new Error('TabsContent must be used inside <Tabs>');

const isActive = computed(() => ctx.value.value === props.value);
</script>

<template>
  <div
    v-show="isActive"
    role="tabpanel"
    :class="cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      props.class
    )"
  >
    <slot />
  </div>
</template>
