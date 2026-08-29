<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Layout from '@/components/Layout.vue';
import LoginModal from '@/components/LoginModal.vue';
import ScoreInputModal from '@/components/ScoreInputModal.vue';
import Toaster from '@/components/ui/Toaster.vue';
import AsyncState from '@/components/ui/AsyncState.vue';
import { loadData, loadMembers, clearData, dataLoading, dataInitialized, dataError, MEETINGS, GOLF_COURSES, getMonthlyData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useAttendance } from '@/composables/useAttendance';
import { useToast } from '@/composables/useToast';
import { ROUTE_PATHS } from '@/lib';

const router = useRouter();
const route = useRoute();
const { currentMember, isAdmin, isLoggedIn, revalidate } = useAuth();
const { setAttendance, getAttendance } = useAttendance();
const { toast } = useToast();

const loginModalOpen = ref(false);
const savingAttendance = ref(false);

function openLoginModal(): void {
  loginModalOpen.value = true;
}

// 창의 열림 여부는 주소가 정한다. ref 로 따로 들고 있으면 뒤로가기를 눌러도
// 창이 남고, 링크로 들어온 사람에게는 창이 열리지 않는다.
const scoreModalOpen = computed({
  get: () => route.path === ROUTE_PATHS.ATTENDANCE,
  set: (open: boolean) => { if (!open) closeAttendance(); },
});

// 이 앱 안에서 열었으면 뒤로가기가 곧 닫기다. 링크를 눌러 바로 들어온 경우엔
// 돌아갈 곳이 없으므로 그 달 기록으로 바꿔 준다.
function closeAttendance(): void {
  if (window.history.state?.back) router.back();
  else router.replace({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
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

const ATTENDANCE_LABEL: Record<string, string> = { true: '참석', false: '불참', null: '미정' };

// 저장이 끝나기 전에는 창을 닫지 않는다. 실패하면 창이 그대로 열려 있어
// 사유를 보고 바로 다시 누를 수 있다.
async function handleSaveScore(_score: number | null, attended: boolean | null): Promise<void> {
  if (!currentMember.value || savingAttendance.value) return;
  savingAttendance.value = true;
  const result = await setAttendance(nextYM, currentMember.value.id, attended);
  savingAttendance.value = false;

  if (!result.ok) {
    toast({
      title: '저장하지 못했습니다',
      // 화면 값은 setAttendance 안에서 이미 원래대로 돌아갔다.
      description: result.message ?? '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      variant: 'destructive',
    });
    return;
  }

  toast({
    title: '저장 완료',
    description: `${nextYM} ${ATTENDANCE_LABEL[String(attended)]}(으)로 저장되었습니다.`,
  });

  // 전체 페이지 리로드 대신 데이터만 다시 읽는다 (번들 재다운로드·세션 재검증 회피)
  await loadData();
  // push 가 아니라 replace — 이미 저장한 뒤라 뒤로가기로 확인 창이 다시 열리면
  // 저장이 안 된 줄 알고 또 누르게 된다.
  router.replace({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
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

  <Layout v-else :on-login-click="openLoginModal">
    <!-- 초기화 전에만 로딩·오류를 그린다. 저장 후 백그라운드 리로드 때는
         이미 화면에 표가 있으므로 갈아엎지 않는다. -->
    <AsyncState
      container-class="container mx-auto px-4 py-4 max-w-5xl"
      :loading="!dataInitialized && dataLoading"
      :error="!dataInitialized ? dataError : null"
      label="기록"
      :skeleton-rows="8"
      @retry="loadData()"
    >
      <RouterView />
    </AsyncState>
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
    :saving="savingAttendance"
    @save="handleSaveScore"
  />
  <Toaster />
</template>
