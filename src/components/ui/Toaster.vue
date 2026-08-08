<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import { cn } from '@/lib/utils';

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <!-- 토스트는 화면 낭독기에 자동으로 읽히지 않는다. 컨테이너를 라이브 영역으로
         선언해 두면 안에 새 토스트가 들어올 때 읽어준다. 컨테이너 자체가 항상
         떠 있어야 하므로 v-if 로 감싸지 말 것 — 나중에 생긴 라이브 영역은
         브라우저가 무시한다. (P2-1) -->
    <div
      class="fixed bottom-4 right-4 z-60 flex w-full max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="cn(
            'pointer-events-auto rounded-md border p-4 shadow-md bg-background',
            t.variant === 'destructive' && 'border-destructive/50 bg-destructive text-destructive-foreground'
          )"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="space-y-1">
              <div v-if="t.title" class="text-sm font-semibold">{{ t.title }}</div>
              <div v-if="t.description" class="text-sm opacity-90">{{ t.description }}</div>
              <button
                v-if="t.action"
                type="button"
                class="mt-2 rounded-md border border-current px-2.5 py-1 text-xs font-medium hover:bg-foreground/10"
                @click="t.action.onClick(); dismiss(t.id);"
              >
                {{ t.action.label }}
              </button>
            </div>
            <button
              type="button"
              class="text-sm opacity-70 hover:opacity-100"
              aria-label="닫기"
              @click="dismiss(t.id)"
            >
              ×
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
