<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Member } from '@/lib';
import { MONTHLY_HANDICAPS } from '@/data';
import { useToast } from '@/composables/useToast';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';

interface Props {
  open: boolean;
  member: Member;
  yearMonth: string;       // 다음달 year_month
  currentAttended: boolean | null;
  hasMeeting: boolean;
  isManager: boolean;
  // 미사용이지만 emit 호환성 유지용
  currentScore: number | null;
  meetingDate: string;
  courseName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'save', score: number | null, attended: boolean | null, meetingDate: string, courseName: string): void;
}>();

const { toast } = useToast();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const attended = ref<boolean | null>(null);

watch(
  () => props.open,
  (v) => { if (v) attended.value = props.currentAttended; }
);

// 이전 달(현재달) 핸디캡 → 기준 핸디 / 차월 핸디 표시
const prevYM = computed(() => {
  const [y, m] = props.yearMonth.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
});

const handicap = computed(() =>
  MONTHLY_HANDICAPS.find(
    (h) => h.member_id === props.member.id && h.year_month === prevYM.value
  )
);

function handleSubmit(e: Event): void {
  e.preventDefault();
  emit('save', null, attended.value, props.meetingDate, props.courseName);
  toast({
    title: '저장 완료',
    description: attended.value === true ? '참석으로 저장되었습니다.' : attended.value === false ? '불참으로 저장되었습니다.' : '미정으로 저장되었습니다.',
  });
  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen" content-class="sm:max-w-sm">
    <h2 class="text-lg font-semibold text-left mb-5">{{ member.name }} <span class="text-zinc-500">님 참석 확인</span></h2>

    <form class="space-y-5" @submit="handleSubmit">

      <!-- 핸디캡 정보 -->
      <div v-if="handicap" class="rounded-lg border border-border bg-muted/40 p-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="text-center">
            <div class="text-muted-foreground text-xs mb-1">기준 핸디</div>
            <div class="font-mono font-bold text-2xl">{{ handicap.std_hc }}</div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground text-xs mb-1">차월 핸디</div>
            <div class="font-mono font-bold text-2xl text-primary">{{ handicap.next_hc }}</div>
          </div>
        </div>
      </div>
      <div v-else class="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center">
        핸디캡 정보가 없습니다.
      </div>

      <!-- 참석 / 미정 / 불참 선택 -->
      <p class="text-sm text-center text-muted-foreground">{{ yearMonth }} 참석 여부를 선택해 주세요.</p>
      <div class="grid grid-cols-3 gap-2">
        <button
          type="button"
          class="rounded-lg border p-3 text-center transition-colors cursor-pointer"
          :class="attended === true ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-muted/30'"
          @click="attended = true"
        >
          <div class="text-xl mb-1">✅</div>
          <div class="text-sm font-medium">참석</div>
        </button>
        <button
          type="button"
          class="rounded-lg border p-3 text-center transition-colors cursor-pointer"
          :class="attended === null ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 font-semibold' : 'border-border hover:bg-muted/30'"
          @click="attended = null"
        >
          <div class="text-xl mb-1">🤔</div>
          <div class="text-sm font-medium">미정</div>
        </button>
        <button
          type="button"
          class="rounded-lg border p-3 text-center transition-colors cursor-pointer"
          :class="attended === false ? 'border-destructive bg-destructive/10 text-destructive font-semibold' : 'border-border hover:bg-muted/30'"
          @click="attended = false"
        >
          <div class="text-xl mb-1">❌</div>
          <div class="text-sm font-medium">불참</div>
        </button>
      </div>

      <div class="flex justify-end gap-3">
        <Button type="button" variant="outline" @click="isOpen = false">취소</Button>
        <Button type="submit">저장</Button>
      </div>
    </form>
  </Dialog>
</template>
