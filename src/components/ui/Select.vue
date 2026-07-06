<script setup lang="ts">
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-vue-next';

/**
 * Select (네이티브 <select> 기반 단순 래퍼)
 *
 * shadcn-vue 의 Radix 기반 Select 는 컴포넌트가 5종(Trigger/Content/Item/Value/Group) 으로
 * 분리되어 있습니다. 본 프로젝트의 골격 단계에서는 접근성·동작 안정성이 검증된
 * 네이티브 <select> 를 v-model 호환 형태로 래핑해 사용합니다.
 *
 * 사용 예:
 *   <Select v-model="selected" :options="months" placeholder="월 선택" />
 *   <Select v-model="selected" placeholder="회원 선택">
 *     <option v-for="m in MEMBERS" :key="m.id" :value="m.name">{{ m.name }}</option>
 *   </Select>
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue?: string;
  options?: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  class?: string;
  selectClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '선택',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div :class="cn('relative inline-flex w-full', props.class)">
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      :class="cn(
        'flex h-10 w-full appearance-none items-center justify-between rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        props.selectClass
      )"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
        {{ opt.label }}{{ opt.disabled ? ' (예정)' : '' }}
      </option>
      <slot />
    </select>
    <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
  </div>
</template>
