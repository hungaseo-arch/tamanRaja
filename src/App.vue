<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Layout from '@/components/Layout.vue';
import LoginModal from '@/components/LoginModal.vue';
import ScoreInputModal from '@/components/ScoreInputModal.vue';
import Toaster from '@/components/ui/Toaster.vue';
import { loadData, loadMembers, clearData, dataLoading, dataInitialized, dataError, MEETINGS, GOLF_COURSES, getMonthlyData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useAttendance } from '@/composables/useAttendance';
import { ROUTE_PATHS } from '@/lib';

const router = useRouter();
const route = useRoute();
const { currentMember, isAdmin, isLoggedIn, revalidate } = useAuth();
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
  isAdmin.value || nextMemberData.value?.result_rank === 'Host'
);

async function handleSaveScore(_score: number | null, attended: boolean | null): Promise<void> {
  if (!currentMember.value) return;
  await setAttendance(nextYM, currentMember.value.id, attended);
  const alreadyOnFutureMonth = route.path === ROUTE_PATHS.MONTHLY && route.query.month === nextYM;
  if (alreadyOnFutureMonth) {
    // 전체 페이지 리로드 대신 데이터만 다시 읽는다 (번들 재다운로드·세션 재검증 회피)
    await loadData();
  } else {
    router.push({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
  }
}

// 로그인 전에는 members(id, name) 만 가져온다. 나머지 테이블은 세션이 생긴
// 뒤에야 요청한다 — 서버 RLS 도 같은 규칙으로 막는다. (P1-2)
// 한 번 불러온 데이터는 모듈 스코프 배열에 남으므로 탭·월을 바꿔도 재요청이
// 없다. 갱신은 저장 직후 loadData() 를 다시 부를 때만 일어난다.
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) loadData();
  else clearData();
});

onMounted(async () => {
  // 저장된 토큰이 서버에서도 유효한지 먼저 확인한다. 만료·폐기된 세션으로
  // 로그인된 것처럼 보이는 상태를 막는다.
  await revalidate();
  if (isLoggedIn.value) loadData();
  else loadMembers();
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
