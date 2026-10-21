<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Layout from '@/components/Layout.vue';
import LoginModal from '@/components/LoginModal.vue';
import PinChangeForm from '@/components/PinChangeForm.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Toaster from '@/components/ui/Toaster.vue';
import AsyncState from '@/components/ui/AsyncState.vue';
import { loadData, loadMembers, clearData, dataLoading, dataInitialized, dataError, getMonthlyData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useIdleLogout, IDLE_TIMEOUT_MINUTES } from '@/composables/useIdleLogout';
import { useAttendance } from '@/composables/useAttendance';
import { useToast } from '@/composables/useToast';
import { ROUTE_PATHS } from '@/lib';

const router = useRouter();
const route = useRoute();
const { currentMember, isLoggedIn, revalidate, logout } = useAuth();
const { setAttendance, getAttendance } = useAttendance();
const { toast } = useToast();

// 헤더의 계정 버튼으로 연 경우. 주소로 연 경우(#/attendance)는 아래 modalOpen 이
// 따로 본다.
const loginModalOpen = ref(false);
const savingAttendance = ref(false);

function openLoginModal(): void {
  loginModalOpen.value = true;
}

// 참석 확인 창은 계정 창과 하나로 합쳤다. #/attendance 주소는 그대로 살아 있어
// (단톡방 링크·뒤로가기) 그 주소면 창이 열린다. ref 로만 들고 있으면 뒤로가기를
// 눌러도 창이 남고, 링크로 들어온 사람에게는 창이 열리지 않는다.
const modalOpen = computed({
  get: () => loginModalOpen.value || route.path === ROUTE_PATHS.ATTENDANCE,
  set: (open: boolean) => {
    loginModalOpen.value = open;
    if (!open && route.path === ROUTE_PATHS.ATTENDANCE) closeAttendance();
  },
});

// 이 앱 안에서 열었으면 뒤로가기가 곧 닫기다. 링크를 눌러 바로 들어온 경우엔
// 돌아갈 곳이 없으므로 그 달 기록으로 바꿔 준다.
function closeAttendance(): void {
  if (window.history.state?.back) router.back();
  else router.replace({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
}

const today = new Date();
const nextYM = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}`;

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

const ATTENDANCE_LABEL: Record<string, string> = { true: '참석', false: '불참', null: '미정' };

// 저장이 끝나기 전에는 창을 닫지 않는다. 실패하면 창이 그대로 열려 있어
// 사유를 보고 바로 다시 누를 수 있다.
async function handleSaveAttendance(attended: boolean | null): Promise<void> {
  if (!currentMember.value || savingAttendance.value) return;
  savingAttendance.value = true;
  const result = await setAttendance(nextYM, currentMember.value.id, attended);
  savingAttendance.value = false;

  if (!result.ok) {
    toast({
      title: '저장 실패',
      // 화면 값은 setAttendance 안에서 이미 원래대로 돌아갔다.
      description: result.message ?? '네트워크 상태 확인 후 다시 시도',
      variant: 'destructive',
    });
    return;
  }

  toast({
    title: '저장 완료',
    description: `${nextYM} ${ATTENDANCE_LABEL[String(attended)]}(으)로 저장`,
  });

  // 전체 페이지 리로드 대신 데이터만 다시 읽는다 (번들 재다운로드·세션 재검증 회피)
  await loadData();
  loginModalOpen.value = false;
  // push 가 아니라 replace — 이미 저장한 뒤라 뒤로가기로 확인 창이 다시 열리면
  // 저장이 안 된 줄 알고 또 누르게 된다.
  router.replace({ path: ROUTE_PATHS.MONTHLY, query: { month: nextYM } });
}

// 임시 PIN(관리자가 새로 만들었거나 초기화한 PIN, 또는 옛 공통 기본값)으로
// 들어온 회원은 PIN 을 바꾸기 전까지 이 창을 닫을 수 없다. 서버가 세션마다
// must_change 를 알려주므로 새로고침해도 다시 뜬다. 공용 기기에서 남의 계정을
// 열어 둔 채 떠나지 않도록 로그아웃만은 열어 둔다.
const mustChangePin = computed(() => isLoggedIn.value && currentMember.value?.mustChange === true);

async function logoutFromPinChange(): Promise<void> {
  await logout();
  router.replace(ROUTE_PATHS.HOME);
}

function onForcedPinChanged(): void {
  toast({ title: 'PIN 변경 완료', description: '다음 로그인부터 새 PIN 사용' });
}

// 30분 동안 아무 조작이 없으면 스스로 로그아웃한다. 라운드 중 스코어를 보다
// 자리를 뜬 기기가 그대로 열려 있지 않게 하려는 것이라, "이 기기에서 로그인
// 유지"를 켠 경우에도 똑같이 걸린다. 서버도 같은 규칙을 갖고 있고(P6-1),
// 여기서는 그 사실을 사용자에게 알리는 일까지 한다.
useIdleLogout(async () => {
  await logout('idle');
  loginModalOpen.value = false;
  router.replace(ROUTE_PATHS.HOME);
  toast({
    title: '자동 로그아웃',
    description: `${IDLE_TIMEOUT_MINUTES}분 동안 사용 없음 · 다시 로그인 필요`,
    duration: 6000,
  });
});

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

  <LoginModal
    v-model:open="modalOpen"
    :attendance-year-month="nextYM"
    :attendance-attended="nextAttended"
    :saving-attendance="savingAttendance"
    @save-attendance="handleSaveAttendance"
  />
  <Dialog
    :open="mustChangePin"
    :dismissible="false"
    label="새 PIN 정하기"
    content-class="sm:max-w-sm"
  >
    <div class="w-full px-1 pt-1 space-y-4">
      <h2 class="text-base font-bold">새 PIN 설정 필요</h2>
      <!-- 회원 단체 공지 대신 이 창이 안내를 맡는다 (공통 초기 PIN 폐지). -->
      <div class="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
        <p class="font-medium">보안 강화 안내</p>
        <ul class="list-disc pl-4 text-muted-foreground space-y-0.5">
          <li>공통 초기 PIN·관리자 임시 PIN 사용 중단</li>
          <li>본인만 아는 4자리로 변경 후 이용 가능</li>
          <li>다음 로그인부터 새 PIN 사용</li>
          <li>PIN 분실 시 관리자에게 초기화 요청</li>
        </ul>
      </div>
      <PinChangeForm old-label="지금 PIN" @changed="onForcedPinChanged" />
      <div class="border-t border-border pt-3">
        <Button variant="ghost" size="sm" class="w-full" @click="logoutFromPinChange">
          나중에 바꾸기 (로그아웃)
        </Button>
      </div>
    </div>
  </Dialog>
  <Toaster />
</template>
