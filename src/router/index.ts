import {
  createRouter,
  createWebHashHistory,
  type RouteLocationGeneric,
  type RouteRecordRaw,
} from 'vue-router';
import { LEGACY_ROUTE_PATHS, ROUTE_PATHS } from '@/lib';
import { loadSession } from '@/lib/session';

// 라우터 가드는 편의일 뿐 권한 경계가 아니다. 실제 접근 통제는 서버 RLS 가 한다.
function isLoggedIn(): boolean {
  return loadSession() !== null;
}

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HOME,
    name: 'login',
    component: () => import('@/pages/Login.vue'),
  },
  {
    path: ROUTE_PATHS.MONTHLY,
    name: 'monthly',
    component: () => import('@/pages/Monthly.vue'),
  },
  {
    path: ROUTE_PATHS.RANKING,
    name: 'ranking',
    component: () => import('@/pages/YearlyRanking.vue'),
  },
  {
    path: ROUTE_PATHS.PROFILE,
    name: 'profile',
    component: () => import('@/pages/MyProfile.vue'),
  },
  {
    // 참석 확인 창의 주소. 뒤에는 그 달(익월) 기록이 그대로 깔린다 —
    // 창을 닫았을 때 빈 화면이 남지 않고, 링크로 들어온 사람도 누가 참석하는지
    // 바로 본다. 창 자체는 App.vue 가 이 경로를 보고 연다.
    path: ROUTE_PATHS.ATTENDANCE,
    name: 'attendance',
    component: () => import('@/pages/Monthly.vue'),
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
]);

router.beforeEach((to) => {
  // 없는 경로는 로그인 여부와 무관하게 404 를 보여준다 (홈으로 튕기면
  // 주소가 틀렸다는 사실 자체를 알 수 없다).
  if (AUTH_REQUIRED.has(to.path) && !isLoggedIn()) {
    return ROUTE_PATHS.HOME;
  }
});
