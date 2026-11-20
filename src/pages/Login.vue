<script setup lang="ts">
import { computed, nextTick, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from 'lucide-vue-next';
import { describeLoginError, useAuth } from '@/composables/useAuth';
import { MEMBERS, dataError, isDormantNow, loadMembers, membersLoading } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Select from '@/components/ui/Select.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';

const router = useRouter();
const { login, isLoggedIn } = useAuth();

onMounted(() => {
  if (isLoggedIn.value) router.replace(ROUTE_PATHS.MONTHLY);
  // 로그인 화면이 필요로 하는 유일한 조회. 이미 채워져 있으면 아무것도 안 한다.
  else loadMembers();
});

const selectedMember = ref('');
const pin = ref('');
const loginError = ref('');
const pinInput = ref<InstanceType<typeof Input> | null>(null);
const errorField = ref<'member' | 'pin' | null>(null);
const submitting = ref(false);
// 기본은 켜짐 (4-3 안 A). 회원 대부분이 자기 휴대폰으로 들어와 매번 PIN 을
// 치는 수고가 더 크다. 공용 기기에 남는 위험은 무활동 자동 로그아웃(회원 3시간·관리자 30분,
// idleTimeoutMs(), 서버 app.idle_timeout_for())이 그대로 막는다 — 유지를 켜도
// 그 한도는 똑같이 걸린다. 공용 기기라면 본인이 끄면 된다.
const remember = ref(true);

// 회원 목록은 members(id, name) 만 사용한다. PIN 은 어떤 형태로도 내려오지 않는다.
const memberOptions = computed(() =>
  [...MEMBERS]
    .filter((m) => !isDormantNow(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.id, label: m.name }))
);

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

  submitting.value = true;
  try {
    const result = await login(selectedMember.value, pin.value, remember.value);
    if (result.ok) {
      router.push(ROUTE_PATHS.MONTHLY);
      return;
    }
    loginError.value = describeLoginError(result);
    errorField.value = 'pin';
    pin.value = '';
    await nextTick();
    pinInput.value?.focus();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- 이 화면은 Layout 을 거치지 않고 그려지므로 main 랜드마크를 여기서 준다.
       없으면 화면 낭독기가 "본문으로 건너뛰기"를 할 곳이 없다. (P2-1) -->
  <main class="flex flex-col items-center justify-center min-h-dvh px-4 py-10">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <span class="text-5xl" aria-hidden="true">🏌️</span>
        <h1 class="text-2xl font-bold text-foreground">따만라자 모임</h1>
        <p class="text-sm text-muted-foreground">로그인 후 기록 확인</p>
      </div>

      <Card>
        <CardContent class="pt-6">
          <form class="space-y-4" @submit="handleLogin">
            <div class="space-y-2">
              <Label for="member-select">회원 선택</Label>
              <div
              v-if="membersUnavailable"
              id="member-select"
              class="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input px-3 text-sm"
              role="status"
              tabindex="-1"
              >
                <span :class="membersLoading ? 'text-muted-foreground' : 'text-destructive'">
                  {{ membersLoading ? '회원 목록 불러오는 중...' : (dataError ?? '회원 목록 없음') }}
                </span>
                <Button v-if="!membersLoading" type="button" variant="outline" size="xs" @click="retryMembers">다시 시도</Button>
              </div>
              <Select
                v-else
                id="member-select"
                v-model="selectedMember"
                :options="memberOptions"
                placeholder="회원 선택"
              />
            </div>
            <div class="space-y-2">
              <Label for="pin-input">PIN 입력</Label>
              <Input
                id="pin-input"
                ref="pinInput"
                type="password"
                autocomplete="current-password"
                :ariaInvalid="errorField === 'pin'"
                :ariaDescribedby="errorField === 'pin' ? 'login-error' : undefined"
                inputmode="numeric"
                :maxlength="4"
                :model-value="pin"
                placeholder="PIN 4자리"
                @update:model-value="(v: string) => (pin = onlyDigits(v))"
              />
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="remember-me" v-model="remember" />
              <Label for="remember-me" class="text-sm font-normal cursor-pointer">
                이 기기에서 로그인 유지
              </Label>
            </div>

            <div v-if="loginError" id="login-error">
              <Alert variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ loginError }}</AlertDescription>
              </Alert>
            </div>
            <Button type="submit" class="w-full" :disabled="submitting || membersUnavailable">
              {{ submitting ? '확인 중...' : '로그인' }}
            </Button>
            <p class="text-sm text-muted-foreground text-center">
              PIN 분실 시 관리자(서종환·조학영)에게 초기화 요청
            </p>
          </form>
        </CardContent>
      </Card>

    </div>
  </main>
</template>
