<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { MEMBERS, isDormantNow } from '@/data';
import { ROUTE_PATHS } from '@/lib';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Select from '@/components/ui/Select.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';

const router = useRouter();
const { login, isLoggedIn } = useAuth();

onMounted(() => {
  if (isLoggedIn.value) router.replace(ROUTE_PATHS.MONTHLY);
});

const selectedMember = ref('');
const pin = ref('');
const loginError = ref('');

const memberOptions = computed(() =>
  [...MEMBERS]
    .filter((m) => !isDormantNow(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.name, label: m.name }))
);

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

function handleLogin(e: Event): void {
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
  const ok = login(selectedMember.value, pin.value);
  if (ok) {
    router.push(ROUTE_PATHS.MONTHLY);
  } else {
    loginError.value = '회원명 또는 PIN이 올바르지 않습니다.';
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-10">
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
            <Alert v-if="loginError" variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ loginError }}</AlertDescription>
            </Alert>
            <Button type="submit" class="w-full">로그인</Button>
          </form>
        </CardContent>
      </Card>

    </div>
  </div>
</template>
