<script setup lang="ts">
import { provide, ref, watch } from 'vue';
import { cn } from '@/lib/utils';
import { TABS_KEY } from './tabs-context';

interface Props {
  modelValue?: string;
  defaultValue?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), { modelValue: '', defaultValue: '' });

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const internal = ref<string>(props.modelValue || props.defaultValue);

watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined && v !== internal.value) internal.value = v;
  }
);

function setValue(v: string): void {
  internal.value = v;
  emit('update:modelValue', v);
}

provide(TABS_KEY, { value: internal, setValue });
</script>

<template>
  <div :class="cn('w-full', props.class)">
    <slot />
  </div>
</template>
