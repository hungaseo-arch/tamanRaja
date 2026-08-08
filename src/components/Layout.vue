<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { LogOut, User } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { ROUTE_PATHS } from '@/lib';
import { cn } from '@/lib/utils';

interface Props {
  onLoginClick: () => void;
  onAttendanceClick?: () => void;
}

defineProps<Props>();

const { isLoggedIn, currentMember, logout } = useAuth();
const route = useRoute();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await logout();
  router.push(ROUTE_PATHS.HOME);
}

interface NavItem { path: string; label: string; html: string }

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: ROUTE_PATHS.MONTHLY, label: '월간 기록', html: '<span class="xl:hidden">월간<br>기록</span><span class="hidden xl:inline">월간 기록</span>' },
    { path: ROUTE_PATHS.RANKING, label: '연간 랭킹', html: '<span class="xl:hidden">연간<br>랭킹</span><span class="hidden xl:inline">연간 랭킹</span>' },
  ];
  if (isLoggedIn.value) {
    items.push({ path: ROUTE_PATHS.PROFILE, label: '나의 기록', html: '<span class="xl:hidden">나의<br>기록</span><span class="hidden xl:inline">나의 기록</span>' });
  }
  return items;
});

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="fixed top-0 left-0 right-0 z-30 bg-card border-b border-border shadow-sm">
      <div class="w-full px-3 sm:px-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div class="flex items-center h-14 sm:h-16 gap-x-1.5 sm:gap-x-2">

          <!-- 로고 -->
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <span class="text-2xl sm:text-4xl">🏌️</span>
            <h1 class="text-xl font-bold text-foreground hidden sm:inline">따만라자 모임</h1>
          </div>

          <!-- 네비게이션 -->
          <nav class="flex flex-1 items-center justify-center gap-0.5 sm:gap-1 px-1 sm:px-6">
            <RouterLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              :class="cn(
                'flex items-center justify-center px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-center leading-tight',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )"
              v-html="item.html"
            />
            <button
              v-if="isLoggedIn && onAttendanceClick"
              :class="cn(
                'flex items-center justify-center px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-center leading-tight',
                'text-muted-foreground hover:text-foreground hover:bg-accent'
              )"
              @click="onAttendanceClick"
            >
              <span class="xl:hidden">참석<br>확인</span><span class="hidden xl:inline">참석 확인</span>
            </button>
          </nav>

          <!-- 로그인/회원정보 -->
          <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <template v-if="isLoggedIn && currentMember">
              <Button variant="outline" size="sm" class="gap-2" @click="onLoginClick">
                <User class="w-4 h-4 text-primary" />
                <span class="hidden sm:inline font-medium">{{ currentMember.name }}</span>
              </Button>
              <Button variant="ghost" size="sm" class="px-2" @click="handleLogout">
                <LogOut class="w-4 h-4 text-muted-foreground" />
              </Button>
            </template>
            <Button v-else variant="default" size="sm" class="gap-1.5" @click="onLoginClick">
              <User class="w-4 h-4" />
              <span class="hidden sm:inline">로그인</span>
            </Button>
          </div>

        </div>
      </div>
    </header>

    <main class="pt-14 sm:pt-16 w-full max-w-5xl mx-auto min-h-[calc(100vh-4rem)]">
      <slot />
    </main>
    <footer class="text-center text-xs text-muted-foreground py-4 border-t border-border">
      Copyright © ASEOA
    </footer>
  </div>
</template>
