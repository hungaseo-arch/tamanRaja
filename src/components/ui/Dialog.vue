<script setup lang="ts">
import { onKeyStroke, useScrollLock } from '@vueuse/core';
import { computed, nextTick, useTemplateRef, watch, watchEffect } from 'vue';
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
  /** 모달의 이름. 화면 낭독기가 열릴 때 읽어준다. */
  label?: string;
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

// ── 포커스 관리 ──────────────────────────────────────────────────────────────
// 모달이 열려도 포커스가 뒤 화면에 남아 있으면, 키보드 사용자는 보이지도 않는
// 곳을 계속 넘나들게 된다. 열 때 안으로 옮기고, 열려 있는 동안 Tab 을 안에
// 가두고, 닫을 때 원래 있던 곳으로 돌려준다. (P2-1)

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 열기 직전에 포커스가 있던 요소. 닫을 때 여기로 되돌린다.
let lastFocused: HTMLElement | null = null;

function focusables(): HTMLElement[] {
  const root = bodyRef.value;
  if (!root) return [];
  // 숨겨진 요소(예: 조건부로 사라진 버튼)는 건너뛴다.
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
}

watch(isOpen, async (open) => {
  if (open) {
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    // 첫 입력칸이 있으면 거기로, 없으면 모달 자신에게.
    const first = focusables().find((el) => el.tagName === 'INPUT' || el.tagName === 'SELECT');
    (first ?? focusables()[0] ?? bodyRef.value)?.focus();
  } else {
    lastFocused?.focus();
    lastFocused = null;
  }
});

function onTab(e: KeyboardEvent): void {
  const items = focusables();
  if (items.length === 0) {
    e.preventDefault();
    bodyRef.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  // 양 끝에서 넘어가려 하면 반대편으로 감는다. 모달 밖으로는 나가지 않는다.
  if (e.shiftKey && (active === first || !bodyRef.value?.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
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
            :aria-label="label"
            tabindex="-1"
            :class="cn(
              'relative w-full max-w-lg rounded-lg border bg-background p-4 sm:p-6 shadow-lg sm:max-w-md overflow-y-auto max-h-[90vh]',
              contentClass
            )"
            @click.stop
            @keydown.tab="onTab"
          >
            <button
              type="button"
              aria-label="닫기"
              class="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
