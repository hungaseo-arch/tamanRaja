import { ref, type Ref } from 'vue';

/**
 * useToast (Vue 3 Composable)
 *
 * React 원본 `src/hooks/use-toast.ts` 를 단순화한 Vue 버전.
 * shadcn-vue Toast 컴포넌트와 결합해 사용하거나, 자체 Toast UI에서 toasts ref 를 구독합니다.
 */

export type ToastVariant = 'default' | 'destructive';

/** 토스트 안의 버튼 하나. 누르면 토스트는 닫힌다. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
}

export interface ToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  /** 0 이면 사용자가 닫을 때까지 남는다. 기본 3초. */
  duration?: number;
}

const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 3000;

// 모듈 단위 전역 reactive
const toasts: Ref<ToastItem[]> = ref<ToastItem[]>([]);

function makeId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function useToast() {
  function toast(input: ToastInput): string {
    const id = makeId();
    const item: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? 'default',
      action: input.action,
    };

    toasts.value = [item, ...toasts.value].slice(0, TOAST_LIMIT);

    const duration = input.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  function dismiss(id?: string): void {
    if (!id) {
      toasts.value = [];
      return;
    }
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toast, dismiss, toasts };
}
