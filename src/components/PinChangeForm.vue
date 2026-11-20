<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
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

const props = withDefaults(defineProps<Props>(), { oldLabel: '기존 PIN' });
const emit = defineEmits<{ (e: 'changed'): void }>();

const { changePin } = useAuth();

const oldPin = ref('');
const newPin = ref('');
const confirmPin = ref('');
const error = ref('');
const success = ref(false);
const loading = ref(false);

type Field = 'old' | 'new' | 'confirm';
const errorField = ref<Field | null>(null);
type InputRef = InstanceType<typeof Input> | null;
const oldInput = ref<InputRef>(null);
const newInput = ref<InputRef>(null);
const confirmInput = ref<InputRef>(null);
const inputs = { old: oldInput, new: newInput, confirm: confirmInput };
const ERROR_ID = 'pin-change-error';

let successTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(successTimer));

async function fail(field: Field, message: string): Promise<void> {
  error.value = message;
  errorField.value = field;
  await nextTick();
  inputs[field].value?.focus();
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4);
}

async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();
  error.value = '';
  errorField.value = null;
  success.value = false;

  if (oldPin.value.length !== 4) {
    await fail('old', `${props.oldLabel} 4자리 입력 필요`);
    return;
  }
  if (newPin.value.length !== 4) {
    await fail('new', '새 PIN 4자리 입력 필요');
    return;
  }
  if (confirmPin.value.length !== 4) {
    await fail('confirm', '새 PIN 확인 4자리 입력 필요');
    return;
  }
  if (newPin.value !== confirmPin.value) {
    await fail('confirm', '새 PIN 과 확인 PIN 이 다름');
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
      clearTimeout(successTimer);
      successTimer = setTimeout(() => { success.value = false; }, 5000);
      emit('changed');
    } else {
      const field: Field = result.reason === 'same' || result.reason === 'weak' ? 'new' : 'old';
      await fail(field, describeChangePinError(result));
    }
  } catch {
    error.value = '저장 실패';
    errorField.value = null;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="space-y-4" @submit="handleSubmit">
    <p class="text-sm text-muted-foreground">본인만 아는 4자리 · 1111, 1234 같은 쉬운 숫자는 불가</p>
    <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Label for="old-pin" class="sm:w-28 shrink-0 sm:text-right whitespace-nowrap">{{ oldLabel }}</Label>
      <Input
        id="old-pin"
        ref="oldInput"
        type="password"
        autocomplete="current-password"
        :ariaInvalid="errorField === 'old'"
        :ariaDescribedby="errorField === 'old' ? ERROR_ID : undefined"
        inputmode="numeric"
        :maxlength="4"
        :model-value="oldPin"
        class="w-full sm:w-40" placeholder="4자리 숫자"
        @update:model-value="(v: string) => (oldPin = onlyDigits(v))"
      />
    </div>

    <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Label for="new-pin" class="sm:w-28 shrink-0 sm:text-right whitespace-nowrap">새 PIN</Label>
      <Input
        id="new-pin"
        ref="newInput"
        type="password"
        autocomplete="new-password"
        :ariaInvalid="errorField === 'new'"
        :ariaDescribedby="errorField === 'new' ? ERROR_ID : undefined"
        inputmode="numeric"
        :maxlength="4"
        :model-value="newPin"
        class="w-full sm:w-40" placeholder="4자리 숫자"
        @update:model-value="(v: string) => (newPin = onlyDigits(v))"
      />
    </div>

    <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Label for="confirm-pin" class="sm:w-28 shrink-0 sm:text-right whitespace-nowrap">새 PIN 확인</Label>
      <Input
        id="confirm-pin"
        ref="confirmInput"
        type="password"
        autocomplete="new-password"
        :ariaInvalid="errorField === 'confirm'"
        :ariaDescribedby="errorField === 'confirm' ? ERROR_ID : undefined"
        inputmode="numeric"
        :maxlength="4"
        :model-value="confirmPin"
        class="w-full sm:w-40" placeholder="4자리 숫자 확인"
        @update:model-value="(v: string) => (confirmPin = onlyDigits(v))"
      />
    </div>

    <div v-if="error" :id="ERROR_ID">
      <Alert variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <Alert v-if="success" class="border-primary bg-primary/10">
      <CheckCircle2 class="h-4 w-4 text-primary" />
      <AlertDescription class="text-primary">PIN 변경 완료</AlertDescription>
    </Alert>

    <Button type="submit" class="w-full" :disabled="loading">
      {{ loading ? '저장 중…' : 'PIN 변경' }}
    </Button>
  </form>
</template>
