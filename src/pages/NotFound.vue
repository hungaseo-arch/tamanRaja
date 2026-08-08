<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import { ROUTE_PATHS } from '@/lib';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { isLoggedIn } = useAuth();

function goHome(): void {
  router.replace(isLoggedIn.value ? ROUTE_PATHS.MONTHLY : ROUTE_PATHS.HOME);
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
    <p class="text-5xl">🏌️</p>
    <h1 class="text-2xl font-bold text-foreground">페이지를 찾을 수 없습니다</h1>
    <p class="text-sm text-muted-foreground">
      요청하신 주소가 없거나 옮겨졌습니다.
    </p>
    <p class="text-xs text-muted-foreground break-all font-mono">#{{ route.fullPath }}</p>
    <Button variant="default" size="sm" @click="goHome">
      {{ isLoggedIn ? '월간 기록으로' : '로그인 화면으로' }}
    </Button>
  </div>
</template>
