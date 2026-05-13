<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { LogOut, User } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { ROUTE_PATHS } from '@/lib';
import { cn } from '@/lib/utils';

interface Props {
  onLoginClick: () => void;
}

defineProps<Props>();

const { isLoggedIn, currentMember, logout } = useAuth();
const route = useRoute();

interface NavItem { path: string; label: string }

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: ROUTE_PATHS.HOME, label: '대시보드' },
    { path: ROUTE_PATHS.RANKING, label: '연간 랭킹' },
  ];
  if (isLoggedIn.value) {
    items.push({ path: ROUTE_PATHS.PROFILE, label: '내 정보' });
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
      <div class="w-full px-4 py-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="text-4xl">🏌️</span>
            <!-- <div class="flex justify-around"> -->
              <h1 class="text-xl font-bold text-foreground">따만라자 모임</h1>

              <nav class="flex gap-1 pt-3">
                <RouterLink
                  v-for="item in navItems"
                  :key="item.path"
                  :to="item.path"
                  :class="cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )"
                >
                  {{ item.label }}
                </RouterLink>
              </nav>
            
            <!-- </div> -->
          </div>

          <div class="flex items-center gap-2">
            <template v-if="isLoggedIn && currentMember">
              <div class="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                <User class="w-4 h-4 text-primary" />
                <span class="text-sm font-medium text-foreground">{{ currentMember.name }}</span>
              </div>
              <Button variant="outline" size="sm" class="gap-2" @click="logout">
                <LogOut class="w-4 h-4" />
                로그아웃
              </Button>
            </template>
            <Button v-else variant="default" size="sm" class="gap-2" @click="onLoginClick">
              <User class="w-4 h-4" />
              로그인
            </Button>
          </div>
        </div>


      </div>
    </header>

    <main class="pt-20 w-full">
      <slot />
    </main>
  </div>
</template>
