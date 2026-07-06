<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { MEMBERS, isDormantNow } from '@/data';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';

interface Props {
  open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const { login, changePin, isLoggedIn } = useAuth();

// 로그인 폼 상태
const selectedMember = ref<string>('');
const pin = ref<string>('');
const loginError = ref<string>('');

// PIN 변경 폼 상태
const oldPin = ref<string>('');
const newPin = ref<string>('');
const confirmPin = ref<string>('');
const changePinError = ref<string>('');
const changePinSuccess = ref<boolean>(false);
const changePinLoading = ref<boolean>(false);

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const memberOptions = computed(() =>
  [...MEMBERS]
    .filter((m) => !isDormantNow(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((m) => ({ value: m.name, label: m.name }))
);

function resetState(): void {
  selectedMember.value = '';
  pin.value = '';
  loginError.value = '';
  oldPin.value = '';
  newPin.value = '';
  confirmPin.value = '';
  changePinError.value = '';
  changePinSuccess.value = false;
  changePinLoading.value = false;
}

watch(isOpen, (v) => {
  if (!v) resetState();
});

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
    resetState();
    isOpen.value = false;
  } else {
    loginError.value = '회원명 또는 PIN이 올바르지 않습니다.';
  }
}

async function handleChangePin(e: Event): Promise<void> {
  e.preventDefault();
  changePinError.value = '';
  changePinSuccess.value = false;

  if (oldPin.value.length !== 4 || newPin.value.length !== 4 || confirmPin.value.length !== 4) {
    changePinError.value = 'PIN은 4자리 숫자여야 합니다.';
    return;
  }
  if (newPin.value !== confirmPin.value) {
    changePinError.value = '새 PIN이 일치하지 않습니다.';
    return;
  }
  if (oldPin.value === newPin.value) {
    changePinError.value = '새 PIN은 기존 PIN과 달라야 합니다.';
    return;
  }

  changePinLoading.value = true;
  try {
    const ok = await changePin(oldPin.value, newPin.value);
    if (ok) {
      changePinSuccess.value = true;
      oldPin.value = '';
      newPin.value = '';
      confirmPin.value = '';
      setTimeout(() => { changePinSuccess.value = false; }, 3000);
    } else {
      changePinError.value = '기존 PIN이 올바르지 않습니다.';
    }
  } catch {
    changePinError.value = '저장 중 오류가 발생했습니다.';
  } finally {
    changePinLoading.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen" content-class="sm:max-w-sm">
    <!-- 로그인 상태 → PIN 변경 -->
    <div v-if="isLoggedIn" class="w-full px-5 pt-4 space-y-4">
      <form class="space-y-6" @submit="handleChangePin">
          <div class="flex items-center gap-3">
            <Label for="old-pin" class="w-20 shrink-0 text-right">기존 PIN</Label>
            <Input
              id="old-pin"
              type="password"
              inputmode="numeric"
              :maxlength="4"
              :model-value="oldPin"
              class="w-40" placeholder="4자리 숫자"
              @update:model-value="(v: string) => (oldPin = onlyDigits(v))"
            />
          </div>

          <div class="flex items-center gap-3">
            <Label for="new-pin" class="w-20 shrink-0 text-right">새 PIN</Label>
            <Input
              id="new-pin"
              type="password"
              inputmode="numeric"
              :maxlength="4"
              :model-value="newPin"
              class="w-40" placeholder="4자리 숫자"
              @update:model-value="(v: string) => (newPin = onlyDigits(v))"
            />
          </div>

          <div class="flex items-center gap-3">
            <Label for="confirm-pin" class="w-20 shrink-0 text-right">새 PIN 확인</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputmode="numeric"
              :maxlength="4"
              :model-value="confirmPin"
              class="w-40" placeholder="4자리 숫자 확인"
              @update:model-value="(v: string) => (confirmPin = onlyDigits(v))"
            />
          </div>

          <Alert v-if="changePinError" variant="destructive">
            <AlertCircle class="h-4 w-4" />
            <AlertDescription>{{ changePinError }}</AlertDescription>
          </Alert>

          <Alert v-if="changePinSuccess" class="border-primary bg-primary/10">
            <CheckCircle2 class="h-4 w-4 text-primary" />
            <AlertDescription class="text-primary">PIN이 성공적으로 변경되었습니다.</AlertDescription>
          </Alert>

          <Button type="submit" class="w-full" :disabled="changePinLoading">
            {{ changePinLoading ? '저장 중...' : 'PIN 변경' }}
          </Button>
      </form>
    </div>

    <!-- 비로그인 → 로그인 폼 -->
    <form v-else class="space-y-4" @submit="handleLogin">
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
  </Dialog>
</template>
