<script setup lang="ts">
import { onKeyStroke, useScrollLock } from '@vueuse/core';
import { computed, useTemplateRef, watchEffect } from 'vue';
import { X } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

/**
 * Dialog (Headless 모달)
 *
 * shadcn-ui 의 Dialog 와 동일한 사용감을 v-model 패턴으로 제공.
 * 본문 영역에 <slot name="header">, <slot> (body), <slot name="footer"> 슬롯 제공.
 * VueUse 의 onKeyStroke / useScrollLock 으로 Esc 닫기와 body scroll lock 처리.
 */

interface Props {
  open: boolean;
  contentClass?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const bodyRef = useTemplateRef<HTMLElement>('bodyRef');
const isLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null);

watchEffect(() => {
  isLocked.value = isOpen.value;
});

onKeyStroke('Escape', () => {
  if (isOpen.value) isOpen.value = false;
});

function close(): void {
  isOpen.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="close"
      >
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            ref="bodyRef"
            role="dialog"
            aria-modal="true"
            :class="cn(
              'relative w-full max-w-lg rounded-lg border bg-background p-4 sm:p-6 shadow-lg sm:max-w-md overflow-y-auto max-h-[90vh]',
              contentClass
            )"
            @click.stop
          >
            <button
              type="button"
              aria-label="닫기"
              class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              @click="close"
            >
              <X class="h-4 w-4" />
            </button>
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
