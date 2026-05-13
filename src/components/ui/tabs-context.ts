import type { InjectionKey, Ref } from 'vue';

export interface TabsContext {
  value: Ref<string>;
  setValue: (v: string) => void;
}

export const TABS_KEY: InjectionKey<TabsContext> = Symbol('tabs');
