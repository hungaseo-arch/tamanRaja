import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { ROUTE_PATHS } from '@/lib';
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
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const requiresAuth = [ROUTE_PATHS.MONTHLY, ROUTE_PATHS.RANKING, ROUTE_PATHS.PROFILE];
  if (requiresAuth.includes(to.path as typeof ROUTE_PATHS.MONTHLY) && !isLoggedIn()) {
    return ROUTE_PATHS.HOME;
  }
});
