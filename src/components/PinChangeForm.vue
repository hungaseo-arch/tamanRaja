<script setup lang="ts">
import { ref } from 'vue';
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next';
import { describeChangePinError, useAuth } from '@/composables/useAuth';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Alert from '@/components/ui/Alert.vue';
import AlertDescription from '@/components/ui/AlertDescription.vue';

/**
 * PIN 변경 폼. 계정 창의 [계정] 탭과, 임시 PIN 으로 들어온 회원에게 뜨는
 * 닫을 수 없는 변경 창이 함께 쓴다. 입력값은 이 컴포넌트 안에만 있고 어디에도
 * 남기지 않는다 — 부모는 key 를 바꿔 새로 그리는 것으로 비운다.
 */
interface Props {
  /** 기존 PIN 칸의 이름. 임시 PIN 으로 들어온 경우 "임시 PIN" 으로 바꿔 부른다. */
  oldLabel?: string;
}

withDefaults(defineProps<Props>(), { oldLabel: '기존 PIN' });
const emit = defineEmits<{ (e: 'changed'): void }>();

const { changePin } = useAuth();

const oldPin = ref('');
const newPin = ref('');
const confirmPin = ref('');
const error = ref('');
const success = ref(false);
const loading = ref(false);

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();
  error.value = '';
  success.value = false;

  if (oldPin.value.length !== 4 || newPin.value.length !== 4 || confirmPin.value.length !== 4) {
    error.value = 'PIN은 4자리 숫자만 가능';
    return;
  }
  if (newPin.value !== confirmPin.value) {
    error.value = '새 PIN 불일치';
    return;
  }

  loading.value = true;
  try {
    // 기존 PIN 대조·동일성·쉬운 PIN 검사 모두 서버(change_pin RPC)가 판정한다.
    const result = await changePin(oldPin.value, newPin.value);
    if (result.ok) {
      success.value = true;
      oldPin.value = '';
      newPin.value = '';
      confirmPin.value = '';
      setTimeout(() => { success.value = false; }, 3000);
      emit('changed');
    } else {
      error.value = describeChangePinError(result);
    }
  } catch {
    error.value = '저장 중 오류 발생';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="space-y-6" @submit="handleSubmit">
    <div class="flex items-center gap-3">
      <Label for="old-pin" class="w-20 shrink-0 text-right">{{ oldLabel }}</Label>
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

    <Alert v-if="error" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <Alert v-if="success" class="border-primary bg-primary/10">
      <CheckCircle2 class="h-4 w-4 text-primary" />
      <AlertDescription class="text-primary">PIN 변경 완료</AlertDescription>
    </Alert>

    <Button type="submit" class="w-full" :disabled="loading">
      {{ loading ? '저장 중...' : 'PIN 변경' }}
    </Button>
  </form>
</template>
