import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 테스트는 DB 에 접속하지 않는다
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const route = vi.hoisted(() => ({
  path: '/monthly',
  query: {} as Record<string, string>,
}));
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/composables/useAuth', async () => {
  const { ref } = await import('vue');
  return { useAuth: () => ({ currentMember: ref(null), isAdmin: ref(false) }) };
});
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/title', () => ({ setPageTitle: vi.fn() }));
// 표 자체가 아니라 어떤 달을 넘겨받는지만 본다
vi.mock('@/components/MonthlyTable.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      inheritAttrs: false,
      props: { selectedMonth: { type: String, required: true } },
      setup: (props) => () => h('output', props.selectedMonth),
    }),
  };
});

import { MEETINGS, MEETING_RESULTS } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import type { Meeting } from '@/lib';
import Monthly from './Monthly.vue';

const meeting = (id: string, year_month: string, meeting_date: string): Meeting =>
  ({ id, year_month, meeting_date } as Meeting);

async function openedMonth(): Promise<string | undefined> {
  const html = await renderToString(createSSRApp(Monthly));
  return html.match(/<output>(.*?)<\/output>/)?.[1];
}

describe('월간 기록 기본 달', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6));
    route.path = ROUTE_PATHS.MONTHLY;
    route.query = {};
    MEETINGS.splice(0);
    MEETING_RESULTS.splice(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('이번 달 모임 행이 아직 없어도 이번 달을 연다', async () => {
    MEETINGS.push(meeting('m10', '2026-10', '2026-10-03'));
    expect(await openedMonth()).toBe('2026-11');
  });

  it('이번 달 모임 행이 있으면 이번 달을 연다', async () => {
    MEETINGS.push(meeting('m10', '2026-10', '2026-10-03'), meeting('m11', '2026-11', '2026-11-07'));
    expect(await openedMonth()).toBe('2026-11');
  });

  it('다음 달 모임 행이 있어도 이번 달을 연다', async () => {
    MEETINGS.push(meeting('m12', '2026-12', '2026-12-05'));
    expect(await openedMonth()).toBe('2026-11');
  });

  it('주소에 ?month= 가 있으면 그 달을 연다', async () => {
    route.query = { month: '2026-09' };
    expect(await openedMonth()).toBe('2026-09');
  });

  it('참석 창 배경은 참석 확인 대상 달을 연다', async () => {
    vi.setSystemTime(new Date(2026, 10, 20));
    route.path = ROUTE_PATHS.ATTENDANCE;
    MEETINGS.push(meeting('m10', '2026-10', '2026-10-03'));
    expect(await openedMonth()).toBe('2026-12');
  });
});
