<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Layout from '@/components/Layout.vue';
import LoginModal from '@/components/LoginModal.vue';
import ScoreInputModal from '@/components/ScoreInputModal.vue';
import Toaster from '@/components/ui/Toaster.vue';
import { loadData, dataLoading, dataInitialized, dataError, MEETINGS, GOLF_COURSES, getMonthlyData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useAttendance } from '@/composables/useAttendance';
import { ROUTE_PATHS } from '@/lib';

const router = useRouter();
const route = useRoute();
const { currentMember } = useAuth();
const { setAttendance, getAttendance } = useAttendance();

const loginModalOpen = ref(false);
const scoreModalOpen = ref(false);

function openLoginModal(): void {
  loginModalOpen.value = true;
}

function openAttendanceModal(): void {
  scoreModalOpen.value = true;
}

const today = new Date();
const nextYM = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}`;

const nextMeeting = computed(() => MEETINGS.find((m) => m.year_month === nextYM));

const nextMeetingCourseName = computed(() => {
  if (!nextMeeting.value) return '';
  return GOLF_COURSES.find((c) => c.id === nextMeeting.value!.golf_course_id)?.name ?? '';
});

const nextMemberData = computed(() => {
  if (!currentMember.value) return null;
  return getMonthlyData(nextYM).find((d) => d.member_id === currentMember.value!.id) ?? null;
});

const nextAttended = computed((): boolean | null => {
  if (!currentMember.value) return null;
  const saved = getAttendance(nextYM)[currentMember.value.id];
  if (saved !== undefined) return saved;
  return nextMemberData.value?.attended ?? null;
});

const isManager = computed(() =>
  currentMember.value?.display_order === 1 || nextMemberData.value?.result_rank === 'Host'
);

async function handleSaveScore(_score: number | null, attended: boolean | null): Promise<void> {
  if (!currentMember.value) return;
  await setAttendance(nextYM, currentMember.value.id, attended);
  const alreadyOnFutureMonth = route.path === ROUTE_PATHS.MONTHLY && route.query.month === nextYM;
  if (alreadyOnFutureMonth) {
    window.location.reload();
  } else {
    router.push({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <!-- 홈(로그인) 페이지는 Layout 없이 렌더링 -->
  <RouterView v-if="route.path === ROUTE_PATHS.HOME" />

  <Layout v-else :on-login-click="openLoginModal" :on-attendance-click="openAttendanceModal">
    <!-- 최초 로딩 (초기화 전에만 표시 — 저장 후 백그라운드 리로드 때는 표시 안 함) -->
    <div
      v-if="!dataInitialized && dataLoading"
      class="flex items-center justify-center min-h-[60vh] text-muted-foreground"
    >
      <span class="animate-pulse text-lg">데이터를 불러오는 중...</span>
    </div>

    <!-- 오류 (초기 로딩 실패) -->
    <div
      v-else-if="!dataInitialized && dataError"
      class="flex flex-col items-center justify-center min-h-[60vh] gap-4"
    >
      <span class="text-destructive text-sm">{{ dataError }}</span>
      <button
        class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        @click="loadData()"
      >다시 시도</button>
    </div>

    <!-- 정상 -->
    <RouterView v-else />
  </Layout>

  <LoginModal v-model:open="loginModalOpen" />
  <ScoreInputModal
    v-if="currentMember"
    v-model:open="scoreModalOpen"
    :member="currentMember"
    :year-month="nextYM"
    :current-score="nextMemberData?.score ?? null"
    :current-attended="nextAttended"
    :has-meeting="!!nextMeeting"
    :meeting-date="nextMeeting?.meeting_date ?? ''"
    :course-name="nextMeetingCourseName"
    :is-manager="isManager"
    @save="handleSaveScore"
  />
  <Toaster />
</template>
