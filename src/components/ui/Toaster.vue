<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import { cn } from '@/lib/utils';

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
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
