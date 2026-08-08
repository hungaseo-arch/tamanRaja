<script setup lang="ts">
import { computed, type Component } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { LogOut, User, CalendarDays, Trophy, UserRound, ClipboardCheck } from 'lucide-vue-next';
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

// line1/line2 는 sm~xl 구간에서 두 줄로 접기 위한 것. 좁은 폭(<sm)에서는
// 상단 nav 자체를 쓰지 않고 하단 탭 바로 내려가므로 label 만 쓴다.
interface NavItem { path: string; label: string; line1: string; line2: string; icon: Component }

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: ROUTE_PATHS.MONTHLY, label: '월간 기록', line1: '월간', line2: '기록', icon: CalendarDays },
    { path: ROUTE_PATHS.RANKING, label: '연간 랭킹', line1: '연간', line2: '랭킹', icon: Trophy },
  ];
  if (isLoggedIn.value) {
    items.push({ path: ROUTE_PATHS.PROFILE, label: '나의 기록', line1: '나의', line2: '기록', icon: UserRound });
  }
  return items;
});

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<template>
  <div class="min-h-screen bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
    <header class="fixed top-0 left-0 right-0 z-30 bg-card border-b border-border shadow-sm">
      <div class="w-full px-3 sm:px-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div class="flex items-center h-14 sm:h-16 gap-x-1.5 sm:gap-x-2">

          <!-- 로고. 좁은 폭에서는 메뉴가 하단 탭 바로 내려가 자리가 남으므로
               제목을 숨기지 않는다 (기존에는 sm 미만에서 통째로 사라졌다). -->
          <!-- 사이트 이름은 h1 이 아니다. h1 은 각 페이지가 "무슨 화면인지"를
               말하는 데 쓴다 — 여기에 h1 을 두면 페이지마다 h1 이 둘이 된다. -->
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <span class="text-2xl sm:text-4xl shrink-0" aria-hidden="true">🏌️</span>
            <span class="text-base sm:text-xl font-bold text-foreground whitespace-nowrap truncate">따만라자 모임</span>
          </div>

          <!-- 네비게이션 (sm 이상). 좁은 폭에서는 하단 탭 바가 대신한다. -->
          <nav class="hidden sm:flex flex-1 items-center justify-center gap-1 px-6" aria-label="주요 메뉴">
            <RouterLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              :class="cn(
                'flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-center leading-tight',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )"
              :aria-current="isActive(item.path) ? 'page' : undefined"
            >
              <span class="xl:hidden">{{ item.line1 }}<br>{{ item.line2 }}</span>
              <span class="hidden xl:inline">{{ item.label }}</span>
            </RouterLink>
            <button
              v-if="isLoggedIn && onAttendanceClick"
              :class="cn(
                'flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-center leading-tight',
                'text-muted-foreground hover:text-foreground hover:bg-accent'
              )"
              @click="onAttendanceClick"
            >
              <span class="xl:hidden">참석<br>확인</span><span class="hidden xl:inline">참석 확인</span>
            </button>
          </nav>

          <!-- sm 미만에서 로고와 우측 버튼 사이를 벌린다 -->
          <div class="flex-1 sm:hidden" />

          <!-- 로그인/회원정보 -->
          <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <!-- 좁은 폭에서는 글자가 숨겨져 아이콘만 남으므로 이름을 aria-label 로
                 따로 준다. 그림만 있는 버튼은 화면 낭독기에서 "버튼"으로만 읽힌다. -->
            <template v-if="isLoggedIn && currentMember">
              <Button
                variant="outline"
                size="sm"
                class="gap-2"
                :aria-label="`${currentMember.name} 님 계정`"
                @click="onLoginClick"
              >
                <User class="w-4 h-4 text-primary" aria-hidden="true" />
                <span class="hidden sm:inline font-medium">{{ currentMember.name }}</span>
              </Button>
              <Button variant="ghost" size="sm" class="px-2" aria-label="로그아웃" @click="handleLogout">
                <LogOut class="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              </Button>
            </template>
            <Button v-else variant="default" size="sm" class="gap-1.5" aria-label="로그인" @click="onLoginClick">
              <User class="w-4 h-4" aria-hidden="true" />
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

    <!-- 하단 탭 바 (sm 미만). 메뉴가 한 줄씩 세로로 깨지던 문제를 없애고
         각 항목에 균등한 폭을 준다. -->
    <nav
      class="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="주요 메뉴"
    >
      <div class="flex items-stretch h-14">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap transition-colors',
            isActive(item.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
          {{ item.label }}
        </RouterLink>
        <button
          v-if="isLoggedIn && onAttendanceClick"
          class="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors"
          @click="onAttendanceClick"
        >
          <ClipboardCheck class="w-5 h-5 shrink-0" aria-hidden="true" />
          참석 확인
        </button>
      </div>
    </nav>
  </div>
</template>
