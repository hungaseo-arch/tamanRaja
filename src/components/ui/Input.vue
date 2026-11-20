<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'search' | 'email' | 'url' | 'none';
  maxlength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  // Enter 로 저장하는 입력 칸처럼 키 입력을 받아야 하는 곳이 쓴다.
  (e: 'keydown', event: KeyboardEvent): void;
}>();

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <input
    :id="id"
    :name="name"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :inputmode="inputmode"
    :maxlength="maxlength"
    :min="min"
    :max="max"
    :step="step"
    :aria-label="ariaLabel"
    :aria-invalid="ariaInvalid"
    :readonly="readonly"
    :disabled="disabled"
    :required="required"
    :class="cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      props.class
    )"
    @input="onInput"
    @keydown="emit('keydown', $event)"
  />
</template>
