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
  /** 0 이면 사용자가 닫을 때까지 남는다. 기본 3초, 오류(destructive)는 8초. */
  duration?: number;
}

const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 3000;
// 오류 사유는 읽을 시간이 필요하므로 더 오래 둔다 (중장년 사용자, WCAG 2.2.1).
const DESTRUCTIVE_DURATION = 8000;

// 모듈 단위 전역 reactive
const toasts: Ref<ToastItem[]> = ref<ToastItem[]>([]);

// 토스트별 닫기 타이머. 마우스를 올리거나 포커스가 있는 동안은 멈추고(WCAG 2.2.1), 벗어나면 처음부터 다시 센다.
const timers = new Map<string, { handle: number; duration: number }>();

function startTimer(id: string, duration: number): void {
  stopTimer(id);
  if (duration <= 0) return;
  timers.set(id, { handle: window.setTimeout(() => dismissToast(id), duration), duration });
}

function stopTimer(id: string): void {
  const t = timers.get(id);
  if (t) window.clearTimeout(t.handle);
}

function dismissToast(id: string): void {
  stopTimer(id);
  timers.delete(id);
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

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

    const duration = input.duration ?? (item.variant === 'destructive' ? DESTRUCTIVE_DURATION : DEFAULT_DURATION);
    startTimer(id, duration);

    return id;
  }

  function dismiss(id?: string): void {
    if (!id) {
      for (const key of [...timers.keys()]) stopTimer(key);
      timers.clear();
      toasts.value = [];
      return;
    }
    dismissToast(id);
  }

  /** 사용자가 읽는 중이면 멈춘다. */
  function pause(id: string): void {
    stopTimer(id);
  }

  /** 읽기를 마치면 처음 길이만큼 다시 센다. 직접 닫아야 하는 토스트(0)는 그대로 둔다. */
  function resume(id: string): void {
    const t = timers.get(id);
    if (t) startTimer(id, t.duration);
  }

  return { toast, dismiss, pause, resume, toasts };
}
