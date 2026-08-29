<script setup lang="ts">
import { computed } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';

/**
 * 표 한 줄의 상세 (디스클로저)
 *
 * 표는 좁은 화면에서 열을 숨긴다(hidden sm:table-cell 등). 숨긴 값을 보려면
 * 가로로 밀어야 했고, 밀어 놓으면 어느 줄을 보고 있었는지 잃기 쉬웠다.
 * 줄의 이름을 누르면 그 줄의 값을 전부 여기 모아 보여 준다.
 *
 * 표시할 값은 화면마다 서식이 달라(색 있는 Net, 배지) 여기서 만들지 않는다.
 * 이 컴포넌트는 상자와 제목만 맡고, 각 줄은 DetailItem 으로 넘겨받는다.
 */

interface Props {
  open: boolean;
  /** 줄의 이름 — 회원명, 또는 나의 기록에서는 '3월'. */
  title: string;
  /** 어느 표의 어느 시점인지 (연월·골프장·연도). */
  subtitle?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});
</script>

<template>
  <Dialog v-model:open="isOpen" content-class="sm:max-w-sm" :label="`${title} 상세`">
    <!-- 부제는 줄을 따로 쓴다. 한 줄에 이으면 긴 골프장 이름이 접히면서
         닫기 버튼 밑으로 파고든다. -->
    <h2 class="mb-4 pr-8 text-lg font-semibold">
      {{ title }}
      <span v-if="subtitle" class="block text-sm font-normal text-muted-foreground">{{ subtitle }}</span>
    </h2>
    <dl class="rounded-lg border border-border divide-y divide-border">
      <slot />
    </dl>
  </Dialog>
</template>
