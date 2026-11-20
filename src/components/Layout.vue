<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { User, CalendarDays, Trophy, UserRound, History, Users, Scale, Ellipsis } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import { useAuth } from '@/composables/useAuth';
import { ROUTE_PATHS } from '@/lib';
import { cn } from '@/lib/utils';

interface Props {
  onLoginClick: () => void;
}

defineProps<Props>();

const { isLoggedIn, isAdmin, currentMember } = useAuth();
const route = useRoute();

// line1/line2 는 sm~xl 구간에서 두 줄로 접기 위한 것. 좁은 폭(<sm)에서는
// 상단 nav 자체를 쓰지 않고 하단 탭 바로 내려가므로 label 만 쓴다.
// tabLabel 은 하단 탭 바 전용 짧은 이름. 탭 라벨은 14px 라 375px 폭의 5칸
// (칸당 75px, 좌우 여백 4px 를 빼면 글자 폭 71px)에서 한 줄에 들어가야 한다.
// 14px 한글은 글자당 약 14px 이므로 공백 포함 5자(약 60~66px)까지가 한계다.
// '27년 핸디(안)' 은 약 85px 라 두 줄로 꺾여 탭 높이(56px)를 넘으므로 줄였다.
interface NavItem { path: string; label: string; tabLabel?: string; line1: string; line2: string; icon: Component }

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: ROUTE_PATHS.MONTHLY, label: '월간 기록', line1: '월간', line2: '기록', icon: CalendarDays },
    { path: ROUTE_PATHS.RANKING, label: '연간 랭킹', line1: '연간', line2: '랭킹', icon: Trophy },
  ];
  // 참석 확인은 메뉴에서 뺐다. 어차피 본인 계정으로 하는 일이라 오른쪽 위
  // 계정 버튼(계정 창의 첫 탭)으로 모았다. #/attendance 주소는 그대로 살아 있다.
  if (isLoggedIn.value) {
    items.push({ path: ROUTE_PATHS.PROFILE, label: '나의 기록', line1: '나의', line2: '기록', icon: UserRound });
    items.push({
      path: ROUTE_PATHS.HANDICAP_POLICY,
      label: '27년 핸디캡 (안)',
      tabLabel: '핸디(안)',
      line1: '27년',
      line2: '핸디캡 (안)',
      icon: Scale,
    });
  }
  // 접속 기록은 관리자에게만 보인다. 메뉴를 감추는 것은 편의일 뿐 권한
  // 경계가 아니다 — 주소를 직접 쳐도 서버 RPC 가 거절한다.
  if (isAdmin.value) {
    items.push({ path: ROUTE_PATHS.ADMIN_LOGS, label: '접속 기록', line1: '접속', line2: '기록', icon: History });
    items.push({ path: ROUTE_PATHS.ADMIN_MEMBERS, label: '회원 관리', line1: '회원', line2: '관리', icon: Users });
  }
  return items;
});

// 하단 탭 바는 5칸까지만 글자가 깨지지 않는다. 항목이 5개를 넘으면(관리자)
// 앞 4개만 탭에 두고 나머지는 '더보기' 창에 담는다.
const TAB_LIMIT = 5;
const tabItems = computed(() => (navItems.value.length > TAB_LIMIT ? navItems.value.slice(0, TAB_LIMIT - 1) : navItems.value));
const moreItems = computed(() => (navItems.value.length > TAB_LIMIT ? navItems.value.slice(TAB_LIMIT - 1) : []));
const moreOpen = ref(false);
const moreActive = computed(() => moreItems.value.some((item) => item.path === route.path));
watch(() => route.path, () => { moreOpen.value = false; });

// 해시 라우터라 href="#main-content" 를 그대로 두면 라우트가 바뀐다.
// 기본 동작을 막고 본문으로 포커스만 옮긴다.
function focusMain(): void {
  document.getElementById('main-content')?.focus();
}

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
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      @click.prevent="focusMain"
    >본문 바로가기</a>
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
            <!-- 계정과 관련된 일(PIN 변경·로그아웃)은 이 버튼 하나로 모은다.
                 아이콘이 둘이면 이름이 숨는 좁은 폭에서 어느 쪽이 무엇인지
                 그림만 보고 가려내야 했다. -->
            <!-- 좁은 폭에서도 글자를 숨기지 않는다. 로그인 전에는 '로그인',
                 로그인 후에는 이름을 보이고, 이름이 길면 말줄임(max-w-24=96px)으로
                 자른다. 375px 에서 로고(약 130px)와 합쳐도 헤더 폭 351px 안이다. -->
            <Button
              v-if="isLoggedIn && currentMember"
              variant="outline"
              size="sm"
              class="gap-2 max-w-40"
              :aria-label="`${currentMember.name} 님 계정`"
              @click="onLoginClick"
            >
              <User class="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
              <span class="max-w-24 truncate font-medium sm:max-w-32">{{ currentMember.name }}</span>
            </Button>
            <Button v-else variant="default" size="sm" class="gap-1.5" @click="onLoginClick">
              <User class="w-4 h-4" aria-hidden="true" />
              로그인
            </Button>
          </div>

        </div>
      </div>
    </header>

    <!-- 이 앱에서 세로로 스크롤되는 상자는 여기 하나다. 각 화면은 자기
         높이를 정하지 않고 내용만큼 길어지고, 넘치는 만큼 여기서 스크롤된다.
         가로 폭도 여기서 자르지 않는다 — 각 화면이 container … max-w-5xl 로
         스스로 정한다. 여기에 max-w 를 두면 그 선언이 조용히 무시된다. -->
    <main id="main-content" tabindex="-1" class="focus:outline-none flex-1 min-h-0 overflow-y-auto w-full">
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
          v-for="item in tabItems"
          :key="item.path"
          :to="item.path"
          :class="cn(
            'flex-1 min-w-0 flex flex-col items-center justify-start pt-1.5 gap-0.5 px-0.5 text-center text-sm whitespace-nowrap leading-tight font-medium transition-colors',
            isActive(item.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          :aria-label="item.tabLabel ? item.label : undefined"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
          <span class="max-w-full truncate">{{ item.tabLabel ?? item.label }}</span>
        </RouterLink>
        <button
          v-if="moreItems.length"
          type="button"
          :class="cn(
            'flex-1 min-w-0 flex flex-col items-center justify-start pt-1.5 gap-0.5 px-0.5 text-center text-sm whitespace-nowrap leading-tight font-medium transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )"
          aria-haspopup="dialog"
          :aria-expanded="moreOpen"
          @click="moreOpen = true"
        >
          <Ellipsis class="w-5 h-5 shrink-0" aria-hidden="true" />
          더보기
        </button>
      </div>
    </nav>

    <Dialog v-model:open="moreOpen" label="더보기 메뉴" content-class="max-w-sm">
      <ul class="flex flex-col gap-1">
        <li v-for="item in moreItems" :key="item.path">
          <RouterLink
            :to="item.path"
            :class="cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors hover:bg-accent',
              isActive(item.path) ? 'text-primary' : 'text-foreground'
            )"
            :aria-current="isActive(item.path) ? 'page' : undefined"
          >
            <component :is="item.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </Dialog>
  </div>
</template>
