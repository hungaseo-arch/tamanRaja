<script setup lang="ts">
import { computed, type Component } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { User, CalendarDays, Trophy, UserRound } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { ROUTE_PATHS } from '@/lib';
import { cn } from '@/lib/utils';

interface Props {
  onLoginClick: () => void;
}

defineProps<Props>();

const { isLoggedIn, currentMember } = useAuth();
const route = useRoute();

// line1/line2 는 sm~xl 구간에서 두 줄로 접기 위한 것. 좁은 폭(<sm)에서는
// 상단 nav 자체를 쓰지 않고 하단 탭 바로 내려가므로 label 만 쓴다.
interface NavItem { path: string; label: string; line1: string; line2: string; icon: Component }

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: ROUTE_PATHS.MONTHLY, label: '월간 기록', line1: '월간', line2: '기록', icon: CalendarDays },
    { path: ROUTE_PATHS.RANKING, label: '연간 랭킹', line1: '연간', line2: '랭킹', icon: Trophy },
  ];
  // 참석 확인은 메뉴에서 뺐다. 어차피 본인 계정으로 하는 일이라 오른쪽 위
  // 계정 버튼(계정 창의 첫 탭)으로 모았다. #/attendance 주소는 그대로 살아 있다.
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
  <!-- 화면 높이에 딱 맞는 셸이다. 헤더·푸터·탭바는 흐름 안에 있고, 스크롤은
       main 하나가 맡는다. 표의 열 제목(sticky)은 가장 가까운 스크롤 상자를
       기준으로 걸리므로, 각 화면의 표는 스스로 스크롤하지 않고(Table 의
       scroll=false) 여기 main 에 열 제목을 붙인다. 그래야 표 위의 카드까지
       함께 밀려 올라가면서도 열 제목은 화면 맨 위에 남는다. -->
  <div class="h-dvh flex flex-col bg-background">
    <header class="shrink-0 relative z-20 bg-card border-b border-border shadow-sm">
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
          </nav>

          <!-- sm 미만에서 로고와 우측 버튼 사이를 벌린다 -->
          <div class="flex-1 sm:hidden" />

          <!-- 로그인/회원정보 -->
          <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <!-- 좁은 폭에서는 글자가 숨겨져 아이콘만 남으므로 이름을 aria-label 로
                 따로 준다. 그림만 있는 버튼은 화면 낭독기에서 "버튼"으로만 읽힌다. -->
            <!-- 계정과 관련된 일(PIN 변경·로그아웃)은 이 버튼 하나로 모은다.
                 아이콘이 둘이면 이름이 숨는 좁은 폭에서 어느 쪽이 무엇인지
                 그림만 보고 가려내야 했다. -->
            <Button
              v-if="isLoggedIn && currentMember"
              variant="outline"
              size="sm"
              class="gap-2"
              :aria-label="`${currentMember.name} 님 계정`"
              @click="onLoginClick"
            >
              <User class="w-4 h-4 text-primary" aria-hidden="true" />
              <span class="hidden sm:inline font-medium">{{ currentMember.name }}</span>
            </Button>
            <Button v-else variant="default" size="sm" class="gap-1.5" aria-label="로그인" @click="onLoginClick">
              <User class="w-4 h-4" aria-hidden="true" />
              <span class="hidden sm:inline">로그인</span>
            </Button>
          </div>

        </div>
      </div>
    </header>

    <!-- 이 앱에서 세로로 스크롤되는 상자는 여기 하나다. 각 화면은 자기
         높이를 정하지 않고 내용만큼 길어지고, 넘치는 만큼 여기서 스크롤된다.
         가로 폭도 여기서 자르지 않는다 — 각 화면이 container … max-w-5xl 로
         스스로 정한다. 여기에 max-w 를 두면 그 선언이 조용히 무시된다. -->
    <main class="flex-1 min-h-0 overflow-y-auto w-full">
      <slot />
    </main>
    <footer class="shrink-0 text-center text-xs text-muted-foreground py-4 border-t border-border">
      Copyright © ASEOA
    </footer>

    <!-- 하단 탭 바 (sm 미만). 메뉴가 한 줄씩 세로로 깨지던 문제를 없애고
         각 항목에 균등한 폭을 준다. -->
    <nav
      class="sm:hidden shrink-0 relative z-20 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
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
      </div>
    </nav>
  </div>
</template>
