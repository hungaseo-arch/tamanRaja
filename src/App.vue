<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Layout from '@/components/Layout.vue';
import LoginModal from '@/components/LoginModal.vue';
import Toaster from '@/components/ui/Toaster.vue';
import { loadData, dataLoading, dataError } from '@/data';

const loginModalOpen = ref(false);

function openLoginModal(): void {
  loginModalOpen.value = true;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <Layout :on-login-click="openLoginModal">
    <!-- 로딩 -->
    <div
      v-if="dataLoading"
      class="flex items-center justify-center min-h-[60vh] text-muted-foreground"
    >
      <span class="animate-pulse text-lg">데이터를 불러오는 중...</span>
    </div>

    <!-- 오류 -->
    <div
      v-else-if="dataError"
      class="flex items-center justify-center min-h-[60vh] text-destructive"
    >
      <span>{{ dataError }}</span>
    </div>

    <!-- 정상 -->
    <RouterView v-else />
  </Layout>

  <LoginModal v-model:open="loginModalOpen" />
  <Toaster />
</template>
