import { onUnmounted, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { IDLE_TIMEOUT_MS, idleRemainingMs, touchSession } from '@/lib/session';

/**
 * 30분 무활동 자동 로그아웃.
 *
 * 세 겹으로 본다.
 *  1. 조작 감지 — 누르기·타이핑·스크롤이 있을 때마다 유휴 시계를 되돌린다.
 *  2. 주기 점검 — 조작이 끊긴 뒤 시계가 0이 되는 순간을 잡는다.
 *  3. 서버 통보 — last_seen_at 을 밀어 준다. 서버도 같은 규칙(app.idle_timeout)
 *     으로 세션을 잘라내므로, 알리지 않으면 쓰고 있는데도 끊긴다.
 *
 * 타이머만 믿지 않는다. 기기가 절전에 들어가면 setInterval 은 멈춰 있다가
 * 깨어난 뒤에야 한 번 돌기 때문이다. 그래서 판정은 항상 "마지막 조작 시각과
 * 지금의 차이"로 하고(session.ts), 탭이 다시 보이는 순간에도 즉시 확인한다.
 *
 * 이 훅은 앱 전체에서 한 번만(App.vue) 설치한다.
 */

// mousemove 는 넣지 않는다. 사용자가 아무것도 하지 않아도 마우스가 스치기만
// 하면 세션이 계속 살아나 "30분" 이 사실상 무한이 된다.
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

// 시계가 0이 되는 순간을 얼마나 촘촘히 잡을지. 30분 기준에서 이 정도면
// 사용자가 체감하는 오차가 없다.
const CHECK_INTERVAL_MS = 20 * 1000;

// 서버에 활동을 알리는 간격. 조작마다 보내면 요청이 폭주하므로 묶는다.
// 서버의 유휴 기준(35분)이 프런트(30분)보다 넉넉한 것이 이 간격 때문이다.
const SERVER_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function useIdleLogout(onTimeout: () => void | Promise<void>): void {
  const { isLoggedIn } = useAuth();

  let lastServerTouchAt = 0;
  // 만료 처리는 한 번만. 점검 타이머와 조작 감지가 같은 순간에 겹칠 수 있다.
  let expiring = false;

  async function expire(): Promise<void> {
    if (expiring) return;
    expiring = true;
    try {
      await onTimeout();
    } finally {
      expiring = false;
    }
  }

  /** 유휴 시간이 지났으면 로그아웃시킨다. 지났는지만 보고 아무것도 갱신하지 않는다. */
  function check(): void {
    // currentMember 가 이 앱이 아는 "로그인 상태"다. 저장된 세션 쪽은 유휴가
    // 지나는 순간 스스로 비워지므로, 그것만 봐서는 원래 로그인이 아니었던
    // 경우와 방금 만료된 경우를 구분할 수 없다.
    if (!isLoggedIn.value || expiring) return;
    if (idleRemainingMs() > 0) return;
    void expire();
  }

  /** 서버의 last_seen_at 을 민다. 실패는 삼킨다 — 로컬 판정이 먼저다. */
  async function notifyServer(): Promise<void> {
    lastServerTouchAt = Date.now();
    try {
      const { data, error } = await supabase.rpc('touch_session');
      if (error) return; // 네트워크·구버전 서버(RPC 없음). 다음 기회에 다시 보낸다.
      // 서버가 이미 끝난 세션이라고 답하면 화면만 로그인 상태로 남는 것을 막는다.
      if ((data as { ok?: boolean } | null)?.ok === false) void expire();
    } catch {
      /* 로컬 타이머가 뒷단속을 한다 */
    }
  }

  function onActivity(): void {
    if (!isLoggedIn.value || expiring) return;
    if (idleRemainingMs() <= 0) {
      void expire();
      return;
    }

    touchSession();
    if (Date.now() - lastServerTouchAt >= SERVER_TOUCH_INTERVAL_MS) void notifyServer();
  }

  function onVisibilityChange(): void {
    // 다른 탭을 보다 돌아온 것 자체는 조작이 아니다. 시계를 되돌리지 않고
    // 확인만 한다 — 자리를 비운 사이 만료됐다면 여기서 잡힌다.
    if (document.visibilityState === 'visible') check();
  }

  ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisibilityChange);
  const timer = window.setInterval(check, CHECK_INTERVAL_MS);

  // 앱을 여는 것도 조작이다. 로그인한 채로 다시 들어왔다면 서버에도 알려
  // 첫 5분 동안 last_seen_at 이 로그인 시각에 머물지 않게 한다. 새로고침
  // 직후에는 revalidate 가 끝나기 전이라 아직 비어 있을 수 있어, 로그인이
  // 확정되는 순간도 함께 본다 (로그인 직후도 같은 경로로 들어온다).
  if (isLoggedIn.value) onActivity();
  const stopWatch = watch(isLoggedIn, (loggedIn) => {
    if (loggedIn) onActivity();
  });

  onUnmounted(() => {
    ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity));
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.clearInterval(timer);
    stopWatch();
  });
}

/** 화면 안내에 쓰는 값. "30분 동안 사용하지 않아…" 같은 문구가 상수와 어긋나지 않게. */
export const IDLE_TIMEOUT_MINUTES = Math.round(IDLE_TIMEOUT_MS / 60000);
