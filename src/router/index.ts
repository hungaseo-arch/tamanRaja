import {
  createRouter,
  createWebHashHistory,
  type RouteLocationGeneric,
  type RouteRecordRaw,
} from 'vue-router';
import { LEGACY_ROUTE_PATHS, ROUTE_PATHS } from '@/lib';
import { loadSession } from '@/lib/session';
import { setPageTitle } from '@/lib/title';

declare module 'vue-router' {
  interface RouteMeta {
    /** 문서 제목의 화면명. 연월·연도가 붙는 화면은 페이지가 setPageTitle 로 덧쓴다. */
    title?: string;
  }
}

// 라우터 가드는 편의일 뿐 권한 경계가 아니다. 실제 접근 통제는 서버 RLS 가 한다.
function isLoggedIn(): boolean {
  return loadSession() !== null;
}

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HOME,
    name: 'login',
    meta: { title: '로그인' },
    component: () => import('@/pages/Login.vue'),
  },
  {
    path: ROUTE_PATHS.MONTHLY,
    name: 'monthly',
    meta: { title: '월간 기록' },
    component: () => import('@/pages/Monthly.vue'),
  },
  {
    path: ROUTE_PATHS.RANKING,
    name: 'ranking',
    meta: { title: '연간 랭킹' },
    component: () => import('@/pages/YearlyRanking.vue'),
  },
  {
    path: ROUTE_PATHS.PROFILE,
    name: 'profile',
    meta: { title: '나의 기록' },
    component: () => import('@/pages/MyProfile.vue'),
  },
  {
    // 참석 확인 창의 주소. 뒤에는 그 달(익월) 기록이 그대로 깔린다 —
    // 창을 닫았을 때 빈 화면이 남지 않고, 링크로 들어온 사람도 누가 참석하는지
    // 바로 본다. 창 자체는 App.vue 가 이 경로를 보고 연다.
    path: ROUTE_PATHS.ATTENDANCE,
    name: 'attendance',
    meta: { title: '참석 확인' },
    component: () => import('@/pages/Monthly.vue'),
  },
  {
    path: ROUTE_PATHS.ADMIN_LOGS,
    name: 'admin-logs',
    meta: { title: '접속 기록' },
    component: () => import('@/pages/AdminLogs.vue'),
  },
  {
    path: ROUTE_PATHS.ADMIN_MEMBERS,
    name: 'admin-members',
    meta: { title: '회원 관리' },
    component: () => import('@/pages/AdminMembers.vue'),
  },
  // 예전 경로 → 새 경로. 쿼리(?month=...)는 그대로 넘긴다.
  ...LEGACY_ROUTE_PATHS.MONTHLY.map((path, i) => ({
    path,
    name: `monthly-legacy-${i}`,
    redirect: (to: RouteLocationGeneric) => ({ path: ROUTE_PATHS.MONTHLY, query: to.query }),
  })),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    meta: { title: '페이지 없음' },
    component: () => import('@/pages/NotFound.vue'),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const AUTH_REQUIRED = new Set<string>([
  ROUTE_PATHS.MONTHLY,
  ROUTE_PATHS.RANKING,
  ROUTE_PATHS.PROFILE,
  ROUTE_PATHS.ATTENDANCE,
  ROUTE_PATHS.ADMIN_LOGS,
  ROUTE_PATHS.ADMIN_MEMBERS,
]);

router.beforeEach((to) => {
  // 없는 경로는 로그인 여부와 무관하게 404 를 보여준다 (홈으로 튕기면
  // 주소가 틀렸다는 사실 자체를 알 수 없다).
  if (AUTH_REQUIRED.has(to.path) && !isLoggedIn()) {
    return ROUTE_PATHS.HOME;
  }
});

// 화면이 바뀔 때만 제목을 바꾼다. 같은 화면에서 쿼리만 바뀌는 이동(월간 기록의
// ?month=)에서 덮어쓰면, 페이지가 붙여 둔 연월이 지워진다.
router.afterEach((to, from) => {
  if (to.path === from.path && from.matched.length > 0) return;
  setPageTitle(to.meta.title);
});
