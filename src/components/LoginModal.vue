<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, LogOut } from 'lucide-vue-next';
import { describeLoginError, useAuth } from '@/composables/useAuth';
import { MEMBERS, dataError, isDormantNow, loadMembers, membersLoading } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import Dialog from '@/components/ui/Dialog.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';
import Tabs from '@/components/ui/Tabs.vue';
import TabsList from '@/components/ui/TabsList.vue';
import TabsTrigger from '@/components/ui/TabsTrigger.vue';
import TabsContent from '@/components/ui/TabsContent.vue';
import AttendancePanel from '@/components/AttendancePanel.vue';
import PinChangeForm from '@/components/PinChangeForm.vue';

/**
 * 로그인 전에는 로그인 폼, 로그인 뒤에는 [참석 확인]·[계정] 두 탭을 가진 창.
 * 참석 확인은 예전에 따로 있던 창이자 메뉴였는데, 어차피 본인 계정으로 하는
 * 일이라 헤더의 계정 버튼 하나 아래로 모았다.
 */
interface Props {
  open: boolean;
  /** 참석 확인 대상 달. 계산은 App 이 한다 (getAttendanceMonth). */
  attendanceYearMonth: string;
  attendanceAttended: boolean | null | undefined;
  /** App 이 서버에 참석 여부를 보내는 중 */
  savingAttendance?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'save-attendance', attended: boolean | null): void;
}>();

const { login, logout, isLoggedIn, currentMember } = useAuth();
const router = useRouter();

// 로그인 폼 상태
const selectedMember = ref<string>('');
const pin = ref<string>('');
const loginError = ref<string>('');
const pinInput = ref<InstanceType<typeof Input> | null>(null);
const errorField = ref<'member' | 'pin' | null>(null);
const loginLoading = ref<boolean>(false);
// 기본은 켜짐. 로그인 화면(Login.vue)과 같은 값이다. 회원 대부분이 자기
// 휴대폰으로 들어오고, 공용 기기의 위험은 무활동 자동 로그아웃이 막는다.
// 공용 기기라면 본인이 끈다.
const remember = ref<boolean>(true);

// PIN 변경 폼은 PinChangeForm 이 들고 있다. 창을 닫을 때 key 를 바꿔 입력값을 비운다.
const pinFormKey = ref(0);

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

// 회원 목록은 members(id, name) 만 사용한다. PIN 은 어떤 형태로도 내려오지 않는다.
const memberOptions = computed(() =>
  [...MEMBERS]
    .filter((m) => !isDormantNow(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.id, label: m.name }))
);

function resetState(): void {
  selectedMember.value = '';
  pin.value = '';
  loginError.value = '';
  errorField.value = null;
  loginLoading.value = false;
  remember.value = true;
  pinFormKey.value++;
}

// 계정 창을 열 때 먼저 보이는 것은 참석 확인이다. PIN 변경·로그아웃보다
// 훨씬 자주 하는 일이고, 예전에 메뉴에 따로 있던 것도 그래서였다.
const tab = ref<'attendance' | 'account'>('attendance');

watch(isOpen, (v) => {
  if (v) tab.value = 'attendance';
  else resetState();
});

// 회원 목록이 비어 있으면 Select 자리에 불러오는 중 / 실패 사유 + 다시 시도를 보여 준다.
const membersUnavailable = computed(() => memberOptions.value.length === 0);

function retryMembers(): void {
  dataError.value = null;
  loadMembers();
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

async function handleLogin(e: Event): Promise<void> {
  e.preventDefault();
  loginError.value = '';
  errorField.value = null;

  if (!selectedMember.value) {
    loginError.value = '회원 선택 필요';
    errorField.value = 'member';
    document.getElementById('member-select')?.focus();
    return;
  }
  if (pin.value.length !== 4) {
    loginError.value = 'PIN 4자리 숫자 입력 필요';
    errorField.value = 'pin';
    pinInput.value?.focus();
    return;
  }

  loginLoading.value = true;
  try {
    const result = await login(selectedMember.value, pin.value, remember.value);
    if (result.ok) {
      resetState();
      isOpen.value = false;
      return;
    }
    loginError.value = describeLoginError(result);
    errorField.value = 'pin';
    pin.value = '';
    await nextTick();
    pinInput.value?.focus();
  } finally {
    loginLoading.value = false;
  }
}

// 로그아웃은 헤더가 아니라 이 창에 있다. 헤더 아이콘을 하나로 줄이면서 옮겨
// 온 것으로, 하는 일은 그대로다 — 세션을 지우고 로그인 화면으로 보낸다.
async function handleLogout(): Promise<void> {
  isOpen.value = false;
  await logout();
  router.push(ROUTE_PATHS.HOME);
}
</script>

<template>
  <Dialog v-model:open="isOpen" content-class="sm:max-w-sm" :label="isLoggedIn ? '계정' : '로그인'">
    <!-- 로그인 상태 → 이름 줄(로그아웃) + [참석 확인] / [계정(PIN 변경)]
         로그아웃은 탭 밖 이름 줄에 둔다. 창은 늘 참석 확인 탭으로 열리므로,
         계정 탭 안에 두면 로그아웃하려고 탭을 한 번 더 눌러야 했다. -->
    <div v-if="isLoggedIn" class="w-full space-y-4">
      <!-- 이름과 로그아웃은 왼쪽에 묶고, 오른쪽 끝은 닫기(X) 하나만 둔다.
           pr-12: 닫기 버튼(44px) 아래로 파고들지 않게 비운다. -->
      <div class="flex items-center gap-3 pr-12">
        <p class="min-w-0 truncate text-lg font-bold">{{ currentMember?.name }} 님</p>
        <Button variant="outline" size="xs" class="shrink-0 gap-1.5" @click="handleLogout">
          <LogOut class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          로그아웃
        </Button>
      </div>

      <Tabs v-model="tab">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">참석 확인</TabsTrigger>
          <TabsTrigger value="account">계정</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" class="pt-3">
          <!-- 참석은 본인 것만 다루므로 세션 회원이 있어야 그린다. -->
          <AttendancePanel
            v-if="currentMember"
            :member="currentMember"
            :year-month="attendanceYearMonth"
            :current-attended="attendanceAttended"
            :saving="savingAttendance"
            @save="(attended: boolean | null) => emit('save-attendance', attended)"
            @cancel="isOpen = false"
          />
        </TabsContent>

        <TabsContent value="account" class="pt-3">
          <PinChangeForm :key="pinFormKey" />
        </TabsContent>
      </Tabs>
    </div>

    <!-- 비로그인 → 로그인 폼 -->
    <form v-else class="space-y-4" @submit="handleLogin">
      <DialogTitle class="mb-0">로그인</DialogTitle>
      <div class="space-y-2">
        <Label for="member-select">회원 선택</Label>
        <div
        v-if="membersUnavailable"
        id="member-select"
        class="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input px-3 py-1 text-sm"
        role="status"
        tabindex="-1"
        >
          <span :class="membersLoading ? 'text-muted-foreground' : 'text-destructive'">
            {{ membersLoading ? '회원 목록 불러오는 중…' : (dataError ?? '회원 목록 없음') }}
          </span>
          <Button v-if="!membersLoading" type="button" variant="outline" size="xs" @click="retryMembers">다시 시도</Button>
        </div>
        <Select
          v-else
          id="member-select"
          v-model="selectedMember"
          :aria-invalid="errorField === 'member'"
          :aria-describedby="errorField === 'member' ? 'login-modal-error' : undefined"
          :options="memberOptions"
          placeholder="회원 선택"
        />
      </div>

      <div class="space-y-2">
        <Label for="pin-input">PIN 입력</Label>
        <p class="text-sm text-muted-foreground">처음이면 관리자에게 받은 임시 PIN 입력</p>
        <Input
          id="pin-input"
          ref="pinInput"
          type="password"
          autocomplete="current-password"
          :ariaInvalid="errorField === 'pin'"
          :ariaDescribedby="errorField === 'pin' ? 'login-modal-error' : undefined"
          inputmode="numeric"
          :maxlength="4"
          :model-value="pin"
          placeholder="PIN 4자리"
          @update:model-value="(v: string) => (pin = onlyDigits(v))"
        />
      </div>

      <div class="flex items-center gap-2">
        <Checkbox id="remember-me-modal" v-model="remember" />
        <Label for="remember-me-modal" class="text-sm font-normal cursor-pointer">
          이 기기에서 로그인 유지
        </Label>
      </div>

      <div v-if="loginError" id="login-modal-error">
        <Alert variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertDescription>{{ loginError }}</AlertDescription>
        </Alert>
      </div>

      <Button type="submit" class="w-full" :disabled="loginLoading || membersUnavailable">
        {{ loginLoading ? '확인 중…' : '로그인' }}
      </Button>
    </form>
  </Dialog>
</template>
