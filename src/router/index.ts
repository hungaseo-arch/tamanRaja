import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { ROUTE_PATHS } from '@/lib';

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HOME,
    name: 'dashboard',
    component: () => import('@/pages/Dashboard.vue'),
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
