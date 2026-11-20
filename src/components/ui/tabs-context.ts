import type { InjectionKey, Ref } from 'vue';

export interface TabsContext {
  value: Ref<string>;
  setValue: (v: string) => void;
  /** 트리거·패널 id 의 공통 접두 */
  baseId: string;
}

export const TABS_KEY: InjectionKey<TabsContext> = Symbol('tabs');
