<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';
import { Ellipsis } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button.vue';

/**
 * "⋯" 버튼 하나 아래로 여러 동작을 접어 두는 메뉴.
 *
 * 좁은 화면에서 표 한 칸에 버튼을 여럿 늘어놓으면 표가 화면보다 넓어진다.
 * 그럴 때 이 버튼 하나로 바꾼다. (3-3)
 *
 * 메뉴는 body 로 옮겨(fixed) 그린다. 표가 스스로 스크롤하는 상자 안에 두면
 * 상자 경계에서 잘린다.
 */
export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** 막혀 있을 때 그 이유. 손가락에는 title 이 뜨지 않으므로 글자로 보인다. */
  hint?: string;
}

interface Props {
  items: DropdownMenuItem[];
  /** 버튼의 이름. 화면 낭독기가 읽는다 (예: "홍길동 관리"). */
  label: string;
  disabled?: boolean;
}
const props = defineProps<Props>();

const open = ref(false);
const anchor = useTemplateRef<HTMLElement>('anchor');
const menu = useTemplateRef<HTMLElement>('menu');
const pos = ref<{ top?: number; bottom?: number; right: number }>({ right: 0 });

const menuStyle = computed(() => ({
  top: pos.value.top !== undefined ? `${pos.value.top}px` : undefined,
  bottom: pos.value.bottom !== undefined ? `${pos.value.bottom}px` : undefined,
  right: `${pos.value.right}px`,
}));

function itemEls(): HTMLButtonElement[] {
  return [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') ?? [])];
}

async function show(): Promise<void> {
  const rect = anchor.value?.getBoundingClientRect();
  if (!rect) return;
  // 버튼 오른쪽 끝에 맞춘다. 관리 열은 표의 오른쪽 끝이라 왼쪽으로 펼쳐야 화면 안에 든다.
  pos.value = { top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) };
  open.value = true;
  await nextTick();
  // 아래가 모자라면 버튼 위로 펼친다.
  const h = menu.value?.offsetHeight ?? 0;
  if (rect.bottom + 4 + h > window.innerHeight - 8) {
    pos.value = { bottom: window.innerHeight - rect.top + 4, right: pos.value.right };
  }
  itemEls()[0]?.focus();
}

function close(returnFocus = true): void {
  if (!open.value) return;
  open.value = false;
  if (returnFocus) anchor.value?.querySelector('button')?.focus();
}

function toggle(): void {
  if (open.value) close();
  else void show();
}

function select(item: DropdownMenuItem): void {
  if (item.disabled) return;
  close();
  item.onSelect();
}

function onKeydown(e: KeyboardEvent): void {
  const els = itemEls();
  const i = els.indexOf(document.activeElement as HTMLButtonElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
  else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
  else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'Tab') close(false);
}

onClickOutside(menu, () => close(false), { ignore: [anchor] });
// fixed 로 띄웠으므로 뒤가 스크롤되면 버튼과 떨어진다. 그냥 닫는다.
useEventListener(window, 'scroll', () => close(false), { capture: true, passive: true });
useEventListener(window, 'resize', () => close(false));
</script>

<template>
  <span ref="anchor" class="inline-flex">
    <Button
      variant="outline"
      size="xs"
      class="w-8 px-0"
      :disabled="props.disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="props.label"
      :title="props.label"
      @click="toggle"
    >
      <Ellipsis class="w-4 h-4" aria-hidden="true" />
    </Button>
  </span>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menu"
      role="menu"
      :aria-label="props.label"
      class="fixed z-50 min-w-36 rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1"
      :style="menuStyle"
      @keydown="onKeydown"
    >
      <button
        v-for="item in props.items"
        :key="item.label"
        type="button"
        role="menuitem"
        tabindex="-1"
        :disabled="item.disabled"
        :class="cn(
          'flex w-full flex-col items-start rounded-sm px-2 py-2 text-left text-sm',
          'focus:outline-none focus-visible:bg-accent hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
          item.destructive && 'text-destructive'
        )"
        @click="select(item)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.disabled && item.hint" class="text-xs text-muted-foreground">{{ item.hint }}</span>
      </button>
    </div>
  </Teleport>
</template>
