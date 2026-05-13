<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Member } from '@/lib';
import { MONTHLY_HANDICAPS } from '@/data';
import { useToast } from '@/composables/useToast';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

interface Props {
  open: boolean;
  member: Member;
  yearMonth: string;
  currentScore: number | null;
  currentAttended: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'save', score: number | null, attended: boolean): void;
}>();

const { toast } = useToast();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const score = ref<string>('');
const attended = ref<boolean>(true);

const handicap = computed(() =>
  MONTHLY_HANDICAPS.find(
    (h) => h.member_id === props.member.id && h.year_month === props.yearMonth
  )
);

watch(
  () => props.open,
  (v) => {
    if (v) {
      score.value = props.currentScore !== null ? String(props.currentScore) : '';
      attended.value = props.currentAttended;
    }
  }
);

const netScorePreview = computed<number | null>(() => {
  if (!attended.value || !score.value || !handicap.value) return null;
  const s = parseInt(score.value, 10);
  if (Number.isNaN(s)) return null;
  return s - handicap.value.app_hc;
});

function handleSubmit(e: Event): void {
  e.preventDefault();

  if (!attended.value) {
    emit('save', null, false);
    toast({ title: '저장 완료', description: '불참으로 저장되었습니다.' });
    isOpen.value = false;
    return;
  }

  const scoreValue = parseInt(score.value, 10);
  if (Number.isNaN(scoreValue) || scoreValue <= 0) {
    toast({
      title: '입력 오류',
      description: '유효한 점수를 입력해주세요.',
      variant: 'destructive',
    });
    return;
  }

  emit('save', scoreValue, true);
  toast({ title: '저장 완료', description: '점수가 저장되었습니다.' });
  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen" content-class="sm:max-w-md">
    <div class="space-y-1.5 text-left mb-4">
      <h2 class="text-lg font-semibold">점수 입력</h2>
      <p class="text-sm text-muted-foreground">
        {{ member.name }}님의 {{ yearMonth }} 점수를 입력하세요.
      </p>
    </div>

    <form class="space-y-6" @submit="handleSubmit">
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>년월</Label>
          <Input :model-value="yearMonth" readonly class="bg-muted" />
        </div>

        <div v-if="handicap" class="rounded-lg border border-border bg-card p-4 space-y-2">
          <h4 class="font-medium text-sm text-muted-foreground">핸디캡 정보</h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div class="text-muted-foreground">기준 HC</div>
              <div class="font-mono font-semibold text-lg">{{ handicap.std_hc }}</div>
            </div>
            <div>
              <div class="text-muted-foreground">당월 HC</div>
              <div class="font-mono font-semibold text-lg">{{ handicap.app_hc }}</div>
            </div>
            <div>
              <div class="text-muted-foreground">차월 HC</div>
              <div class="font-mono font-semibold text-lg">{{ handicap.next_hc }}</div>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <Checkbox
            id="attended"
            :model-value="!attended"
            @update:model-value="(v: boolean) => (attended = !v)"
          />
          <Label for="attended" class="text-sm font-normal cursor-pointer">불참</Label>
        </div>

        <div v-if="attended" class="space-y-2">
          <Label for="score">점수 (Over Par)</Label>
          <Input
            id="score"
            type="number"
            v-model="score"
            placeholder="예: 92"
            :min="1"
            :required="attended"
            class="font-mono"
          />
          <p v-if="netScorePreview !== null" class="text-sm text-muted-foreground">
            Net Score: {{ netScorePreview }}
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <Button type="button" variant="outline" @click="isOpen = false">취소</Button>
        <Button type="submit">저장</Button>
      </div>
    </form>
  </Dialog>
</template>
