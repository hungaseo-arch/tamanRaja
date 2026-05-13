<script setup lang="ts">
import { computed } from 'vue';
import { Check } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

interface Props {
  modelValue?: boolean;
  id?: string;
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), { modelValue: false });

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const checked = computed(() => props.modelValue);

function toggle(): void {
  if (props.disabled) return;
  emit('update:modelValue', !checked.value);
}
</script>

<template>
  <button
    :id="id"
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :disabled="disabled"
    :class="cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      checked && 'bg-primary text-primary-foreground',
      props.class
    )"
    @click="toggle"
  >
    <Check v-if="checked" class="h-3.5 w-3.5" />
  </button>
</template>
