<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getMonthlyData, getAvailableMonths, GOLF_COURSES, MEETINGS, MEETING_RESULTS, MEMBERS, loadData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';
import { ROUTE_PATHS } from '@/lib';
import type { SavePayload } from '@/components/MonthlyTable.vue';
import MonthlyTable from '@/components/MonthlyTable.vue';

const availableMonths = computed(() => getAvailableMonths());

const today = new Date();
const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const nextYM = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}`;

// 현재달 이하의 가장 최근 미팅을 기본으로 선택 (미래달 미팅이 있어도 현재달을 우선)
const route = useRoute();
const queryMonth = route.query.month as string | undefined;
// #/attendance 는 이 화면을 배경으로 쓰는 참석 확인 창이다. 확인 대상은 익월이니
// 뒤에 깔리는 표도 익월이어야 한다.
const defaultMonth = queryMonth
  ?? (route.path === ROUTE_PATHS.ATTENDANCE ? nextYM : undefined)
  ?? availableMonths.value.find((m) => m.year_month <= currentYM)?.year_month
  ?? currentYM;
const selectedMonth = ref<string>(defaultMonth);

watch(() => route.query.month, (m) => {
  if (m && typeof m === 'string') selectedMonth.value = m;
});

const monthlyData = computed(() => getMonthlyData(selectedMonth.value));

const selectedMeeting = computed(() =>
  availableMonths.value.find((m) => m.year_month === selectedMonth.value)
);


const YEAR = '2026';
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0');
  return `${YEAR}-${m}`;
}).reverse();

// 현재월·다음달은 미팅 없어도 선택 가능
const SELECTABLE = new Set([currentYM, nextYM]);

const monthOptions = computed(() => {
  const existing = new Set(availableMonths.value.map((m) => m.year_month));
  return ALL_MONTHS.map((ym) => ({
    value: ym,
    label: ym,
    disabled: !existing.has(ym) && !SELECTABLE.has(ym),
  }));
});

// 직접 입력 (Supabase 미팅 없는 달, 또는 저장된 미래월 편집용)
const manualDate = ref('');
const manualCourse = ref('');

// 해당 월 첫째 주 토요일 (YYYY-MM-DD) — 미래월 날짜 추천값
function firstSaturday(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const day = 1 + ((6 - first.getDay() + 7) % 7); // 1일 이후 첫 토요일
  return `${ym}-${String(day).padStart(2, '0')}`;
}

watch(selectedMonth, (ym) => {
  // 저장된 미팅이 있으면 그 값으로 초기화 (미래월 재편집 케이스)
  const meeting = MEETINGS.find((m) => m.year_month === ym);
  if (meeting) {
    manualDate.value = meeting.meeting_date ?? '';
    const course = GOLF_COURSES.find((c) => c.id === meeting.golf_course_id);
    manualCourse.value = course?.name ?? '';
  } else {
    // 미팅 없는 미래월: 첫째 주 토요일을 기본 추천
    manualDate.value = firstSaturday(ym);
    manualCourse.value = '';
  }
}, { immediate: true });

// 미래월: 미팅이 없거나, 미팅은 저장됐지만 아직 어떤 스코어도 입력되지 않은 경우
const isFutureMonth = computed(() => {
  const meeting = availableMonths.value.find((m) => m.year_month === selectedMonth.value);
  if (!meeting) return true;
  const hasScores = MEETING_RESULTS.some(
    (r) => r.meeting_id === meeting.id && r.score !== null
  );
  return !hasScores;
});

const { currentMember, isAdmin } = useAuth();
const { toast } = useToast();

// 화면 노출 조건일 뿐 권한 경계가 아니다. 실제 쓰기 허용 여부는 서버 RLS 가
// app.can_manage_month() 로 동일한 규칙(관리자 또는 전월 Host)을 재검증한다.
const isManager = computed(() => {
  if (!currentMember.value) return false;
  if (isAdmin.value) return true;
  // 전월 Host 확인 (선택된 미래월 기준 전월 → 새 미래월 추가 시 자동 갱신)
  const prevMonthNum = parseInt(selectedMonth.value.slice(5)) - 1;
  const prevYM = prevMonthNum === 0
    ? `${parseInt(selectedMonth.value.slice(0, 4)) - 1}-12`
    : `${selectedMonth.value.slice(0, 4)}-${String(prevMonthNum).padStart(2, '0')}`;
  const prevMeeting = MEETINGS.find((m) => m.year_month === prevYM);
  if (!prevMeeting) return false;
  const hostResult = MEETING_RESULTS.find(
    (r) => r.meeting_id === prevMeeting.id && r.result_rank === 'Host'
  );
  if (!hostResult) return false;
  const hostMember = MEMBERS.find((m) => m.id === hostResult.member_id);
  return hostMember?.name === currentMember.value.name;
});

const effectiveMeetingDate = computed(
  () => selectedMeeting.value?.meeting_date ?? manualDate.value
);
const effectiveCourseName = computed(() =>
  selectedMeeting.value
    ? GOLF_COURSES.find((c) => c.id === selectedMeeting.value!.golf_course_id)?.name ?? ''
    : manualCourse.value
);

// 편집 가능 기간: 미래월(기획) 또는 경기일 +3일까지(당월 수정)
const isEditableMonth = computed(() => {
  if (isFutureMonth.value) return true;
  const md = effectiveMeetingDate.value;
  if (!md) return false;
  const deadline = new Date(`${md}T00:00:00`);
  deadline.setDate(deadline.getDate() + 3);
  deadline.setHours(23, 59, 59, 999);
  return new Date() <= deadline;
});

const saveError = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'error'>('idle');

async function handleSaveMonth(payload: SavePayload): Promise<void> {
  if (saveState.value === 'saving') return;
  saveError.value = null;
  saveState.value = 'saving';
  try {
    // 1. 골프장 조회 or 생성 (RLS로 생성 불가 시 null 처리)
    let courseId: number | null = null;
    const existing = GOLF_COURSES.find((c) => c.name === manualCourse.value);
    if (existing) {
      courseId = parseInt(existing.id);
    } else if (manualCourse.value) {
      const { data: nc } = await supabase
        .from('golf_courses').insert({ name: manualCourse.value }).select('id').single();
      if (nc) courseId = (nc as { id: number }).id;
    }

    // 2. 호스트 회원 id
    const hostMemberId = Object.entries(payload.ranks).find(([, v]) => v === 'Host')?.[0] ?? null;

    // 3. meeting 생성 또는 업데이트 (미래월에서 날짜/골프장 먼저 저장 후 재저장 가능)
    const existingMeeting = MEETINGS.find((m) => m.year_month === selectedMonth.value);
    let meetingId: number;
    if (existingMeeting) {
      const { error: eUpd } = await supabase
        .from('meetings')
        .update({
          meeting_date: manualDate.value || null,
          course_id: courseId,
          host_member_id: hostMemberId ? parseInt(hostMemberId) : null,
        })
        .eq('id', existingMeeting.id);
      if (eUpd) throw new Error(eUpd.message);
      meetingId = parseInt(existingMeeting.id);

      // 기존 결과 삭제 후 재생성 (재저장 시 중복 방지)
      const { error: eDel } = await supabase
        .from('meeting_results')
        .delete()
        .eq('meeting_id', meetingId);
      if (eDel) throw new Error(eDel.message);
    } else {
      const { data: meeting, error: e2 } = await supabase
        .from('meetings')
        .insert({
          year_month: selectedMonth.value,
          meeting_date: manualDate.value || null,
          course_id: courseId,
          host_member_id: hostMemberId ? parseInt(hostMemberId) : null,
        })
        .select('id').single();
      if (e2) throw new Error(e2.message);
      meetingId = (meeting as { id: number }).id;
    }

    // 4. meeting_results 생성 (전체 회원)
    const results = monthlyData.value.map((row) => {
      const scoreStr = payload.scores[row.member_id];
      const parsedScore = scoreStr != null && scoreStr !== '' ? parseInt(scoreStr, 10) : NaN;
      const hasScore = !isNaN(parsedScore);
      // 점수가 입력됐으면 참석으로 간주 (참석 컬럼이 없는 당월 수정 케이스 대응)
      const attended = (payload.attendance[row.member_id] ?? false) || hasScore;
      const score = attended && hasScore ? parsedScore : null;
      return {
        meeting_id: meetingId,
        member_id: parseInt(row.member_id),
        attended,
        score,
        result_group: attended ? (payload.groups[row.member_id] || null) : null,
        result_rank: attended ? (payload.ranks[row.member_id] || null) : null,
      };
    });
    const { error: e3 } = await supabase.from('meeting_results').insert(results);
    if (e3) throw new Error(e3.message);

    await loadData();
    saveState.value = 'idle';
    toast({
      title: '저장 완료',
      description: `${selectedMonth.value} 기록 ${results.length}건을 저장했습니다.`,
    });
  } catch (err) {
    // 인라인 문구는 남겨 둔다 — 토스트는 몇 초 뒤 사라지는데, 저장에 실패했다는
    // 사실은 다시 저장할 때까지 화면에 남아 있어야 한다.
    saveError.value = describeError(err, '저장 중 오류가 발생했습니다.');
    saveState.value = 'error';
    toast({ title: '저장하지 못했습니다', description: saveError.value, variant: 'destructive' });
  }
}


</script>

<template>
  <div class="w-full min-h-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-7xl">
        <p v-if="saveError" class="text-sm text-destructive px-1" role="alert">{{ saveError }}</p>

        <MonthlyTable
          :year-month="selectedMonth"
          :monthly-data="monthlyData"
          :meeting-date="effectiveMeetingDate"
          :course-name="effectiveCourseName"
          :is-manager="isManager"
          :is-future-month="isFutureMonth"
          :is-editable="isEditableMonth"
          v-model:selected-month="selectedMonth"
          :month-options="monthOptions"
          v-model:manual-date="manualDate"
          v-model:manual-course="manualCourse"
          :save-state="saveState"
          @save="handleSaveMonth"
        />
      
    </div>
  </div>
</template>
