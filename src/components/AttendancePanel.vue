<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Check } from 'lucide-vue-next';
import { nextRovingIndex } from '@/components/ui/roving';
import type { SessionMember } from '@/lib/session';
import { formatValue } from '@/lib/format';
import { resolveHandicap } from '@/data';
import Button from '@/components/ui/Button.vue';

/**
 * 참석 확인 패널. 예전에는 자기 Dialog 를 가진 창이었지만, 계정 창과 탭으로
 * 합치면서 본문만 남겼다. 창을 여닫고 알림을 띄우는 일은 바깥이 맡는다.
 */
interface Props {
  /**
   * 이 패널은 로그인한 본인의 참석만 다룬다. 명단의 Member 가 아니라 세션이
   * 들고 있는 회원이 넘어오고, 여기서 쓰는 것도 id 와 name 뿐이다.
   */
  member: SessionMember;
  /** 참석 확인 대상 year_month (getAttendanceMonth) */
  yearMonth: string;
  currentAttended: boolean | null;
  /** 바깥이 서버에 보내는 중. 저장이 끝난 뒤 창을 닫는 것도 바깥이 한다. */
  saving?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'save', attended: boolean | null): void;
  (e: 'cancel'): void;
}>();

// 창이 닫히면 Dialog 가 내용을 통째로 지우므로(v-if), 이 패널은 열릴 때마다
// 새로 만들어진다. 현재 값은 여기서 한 번만 받아 두면 된다.
const attended = ref<boolean | null>(props.currentAttended);

// 참석/미정/불참 라디오. 미정(null)도 하나의 값이라 항상 하나가 선택돼 있고,
// 선택된 버튼만 tabindex 0 이다.
const options: { value: boolean | null; label: string; emoji: string }[] = [
  { value: true, label: '참석', emoji: '✅' },
  { value: null, label: '미정', emoji: '🤔' },
  { value: false, label: '불참', emoji: '❌' },
];
const radioRefs = ref<HTMLButtonElement[]>([]);

function onRadioKeydown(e: KeyboardEvent): void {
  const current = options.findIndex((o) => o.value === attended.value);
  const next = nextRovingIndex(e.key, current, options.length);
  if (next === null) return;
  e.preventDefault();
  attended.value = options[next].value;
  void nextTick(() => radioRefs.value[next]?.focus());
}

// 이전 달(현재달) 핸디캡 → 기준 핸디 / 차월 핸디 표시
const prevYM = computed(() => {
  const [y, m] = props.yearMonth.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
});

// 표와 같은 규칙을 쓴다 — 직전 달 스코어가 아직 안 들어왔으면 차월 핸디는
// 정해지지 않은 것이라 '-' 로 나온다.
const handicap = computed(() => resolveHandicap(props.member.id, prevYM.value));

// 저장 결과를 아는 쪽은 바깥이다. 여기서 미리 "저장 완료"를 띄우고 창을 닫으면
// 서버가 거절해도 성공한 것처럼 보인다.
function handleSubmit(e: Event): void {
  e.preventDefault();
  if (props.saving) return;
  emit('save', attended.value);
}
</script>

<template>
  <form class="space-y-5" @submit="handleSubmit">

    <!-- 핸디캡 정보 -->
    <div v-if="handicap" class="rounded-lg border border-border bg-muted/40 p-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="text-center">
          <div class="text-muted-foreground text-xs mb-1">기준 핸디</div>
          <div class="font-mono font-bold text-2xl">{{ formatValue(handicap.std_hc) }}</div>
        </div>
        <div class="text-center">
          <div class="text-muted-foreground text-xs mb-1">차월 핸디</div>
          <div class="font-mono font-bold text-2xl text-primary">{{ formatValue(handicap.next_hc) }}</div>
        </div>
      </div>
    </div>
    <div v-else class="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center">
      <p class="m-0">핸디캡 정보 없음</p>
      <p class="m-0 mt-1 text-sm">직전 달 핸디캡이 등록되면 표시</p>
    </div>

    <!-- 참석 / 미정 / 불참 선택 -->
    <p class="text-sm text-center text-muted-foreground">{{ yearMonth }} 참석 여부 선택</p>
    <div
      class="grid grid-cols-3 gap-2"
      role="radiogroup"
      :aria-label="`${yearMonth} 참석 여부`"
      @keydown="onRadioKeydown"
    >
      <button
        v-for="(opt, i) in options"
        :key="String(opt.value)"
        :ref="(el) => { if (el) radioRefs[i] = el as HTMLButtonElement; }"
        type="button"
        role="radio"
        :aria-checked="attended === opt.value"
        :tabindex="attended === opt.value ? 0 : -1"
        class="relative rounded-lg border p-3 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        :class="[
          attended === opt.value
            ? opt.value === true
              ? 'border-primary bg-primary/10 text-primary font-semibold'
              : opt.value === null
                ? 'border-warning-border bg-warning-surface text-warning font-semibold'
                : 'border-destructive bg-destructive/10 text-destructive font-semibold'
            : 'border-border hover:bg-muted/30',
        ]"
        @click="attended = opt.value"
      >
        <Check
          v-if="attended === opt.value"
          class="absolute right-1.5 top-1.5 h-4 w-4"
          aria-hidden="true"
        />
        <div class="text-xl mb-1" aria-hidden="true">{{ opt.emoji }}</div>
        <div class="text-sm font-medium">{{ opt.label }}</div>
        <span v-if="attended === opt.value" class="sr-only">선택됨</span>
      </button>
    </div>

    <div class="flex justify-end gap-3">
      <Button type="button" variant="outline" :disabled="saving" @click="emit('cancel')">취소</Button>
      <!-- 저장 중에는 눌러도 반응이 없어야 한다. 참석 확인을 두 번 보내면
           두 번째 요청이 첫 번째를 덮어써 순서가 뒤집힐 수 있다. -->
      <Button type="submit" :disabled="saving" aria-live="polite">
        {{ saving ? '저장 중...' : '저장' }}
      </Button>
    </div>
  </form>
</template>
