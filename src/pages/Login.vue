<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from 'lucide-vue-next';
import { describeLoginError, useAuth } from '@/composables/useAuth';
import { MEMBERS, isDormantNow, loadMembers } from '@/data';
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
const submitting = ref(false);
// 기본은 꺼짐. 공용 기기에서 무심코 로그인한 사람이 로그인된 채 남지 않도록
// 켜는 건 본인이 정하게 한다.
const remember = ref(false);

// 회원 목록은 members(id, name) 만 사용한다. PIN 은 어떤 형태로도 내려오지 않는다.
const memberOptions = computed(() =>
  [...MEMBERS]
    .filter((m) => !isDormantNow(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.id, label: m.name }))
);

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

async function handleLogin(e: Event): Promise<void> {
  e.preventDefault();
  loginError.value = '';
  if (!selectedMember.value) {
    loginError.value = '회원을 선택해주세요.';
    return;
  }
  if (pin.value.length !== 4) {
    loginError.value = 'PIN은 4자리 숫자여야 합니다.';
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
    pin.value = '';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- 이 화면은 Layout 을 거치지 않고 그려지므로 main 랜드마크를 여기서 준다.
       없으면 화면 낭독기가 "본문으로 건너뛰기"를 할 곳이 없다. (P2-1) -->
  <main class="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-10">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <span class="text-5xl">🏌️</span>
        <h1 class="text-2xl font-bold text-foreground">따만라자 모임</h1>
        <p class="text-sm text-muted-foreground">로그인 후 기록을 확인하세요</p>
      </div>

      <Card>
        <CardContent class="pt-6">
          <form class="space-y-4" @submit="handleLogin">
            <div class="space-y-2">
              <Label for="member-select">회원 선택</Label>
              <Select
                id="member-select"
                v-model="selectedMember"
                :options="memberOptions"
                placeholder="회원을 선택하세요"
              />
            </div>
            <div class="space-y-2">
              <Label for="pin-input">PIN 입력</Label>
              <Input
                id="pin-input"
                type="password"
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

            <Alert v-if="loginError" variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ loginError }}</AlertDescription>
            </Alert>
                  <Button type="submit" class="w-full" :disabled="submitting">
              {{ submitting ? '확인 중...' : '로그인' }}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  </main>
</template>
