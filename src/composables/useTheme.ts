import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { THEME_KEY } from '@/lib/session';

/**
 * 밝게 / 어둡게 / 시스템 설정 따라가기.
 *
 * 실제 클래스 부착은 index.html 안의 인라인 스크립트가 첫 렌더 전에 이미
 * 해 둔다. 여기서는 그 뒤의 전환만 맡는다 — 자바스크립트 번들이 도착한 뒤에
 * 처음 칠하면 화면이 밝은 색으로 한 번 번쩍인다.
 */
export type Theme = 'light' | 'dark' | 'system';

function stored(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const theme: Ref<Theme> = ref(stored());

const media = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

// 'system' 일 때만 OS 설정을 따라간다. 사용자가 직접 고른 뒤에는 OS 가 바뀌어도
// 그 선택을 뒤집지 않는다.
const systemDark = ref(media?.matches ?? false);
media?.addEventListener('change', (e) => { systemDark.value = e.matches; });

const isDark = computed(() =>
  theme.value === 'system' ? systemDark.value : theme.value === 'dark'
);

// index.html 의 인라인 스크립트와 같은 값을 쓴다. 둘이 어긋나면 새로고침할
// 때마다 주소창 색이 한 번 튄다.
const BAR_COLOR = { light: '#ffffff', dark: '#0b1410' };

function apply(): void {
  document.documentElement.classList.toggle('dark', isDark.value);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark.value ? BAR_COLOR.dark : BAR_COLOR.light);
}

export interface UseThemeReturn {
  theme: Ref<Theme>;
  isDark: ComputedRef<boolean>;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  function setTheme(next: Theme): void {
    theme.value = next;
    try {
      // 'system' 은 키를 지운다. 'system' 이라는 값을 저장해 두면 나중에
      // 기본값을 바꿀 때 명시적으로 고른 것과 구분할 수 없다.
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch { /* 저장소를 못 써도 이번 세션 동안은 적용된다 */ }
    apply();
  }

  // 지금 보이는 것의 반대로. 시스템 설정을 따르던 중이면 그 반대로 고정된다.
  function toggleTheme(): void {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  return { theme, isDark, setTheme, toggleTheme };
}

// 시스템 설정이 바뀌었는데 'system' 모드면 즉시 반영한다.
if (typeof window !== 'undefined') {
  media?.addEventListener('change', () => { if (theme.value === 'system') apply(); });
}
