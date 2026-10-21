<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getMonthlyData, getAvailableMonths, GOLF_COURSES, MEETINGS, MEETING_RESULTS, MEMBERS, loadData } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';
import { ROUTE_PATHS } from '@/lib';
import { setPageTitle } from '@/lib/title';
import type { SavePayload } from '@/components/MonthlyTable.vue';
import MonthlyTable from '@/components/MonthlyTable.vue';

const availableMonths = computed(() => getAvailableMonths());

const today = new Date();
const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
// 12월의 다음 달은 이듬해 1월이다. 월만 더하면 '2026-13' 이 된다.
const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const nextYM = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

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

const router = useRouter();

// ?month= 와 고른 달은 양쪽으로 맞춘다 — 주소를 단톡방에 붙이면 같은 달이 열린다.
// 참석 창(#/attendance)은 이 화면을 배경으로 빌려 쓸 뿐이라 주소를 건드리지 않는다.
watch(() => route.query.month, (m) => {
  if (m && typeof m === 'string') selectedMonth.value = m;
});
// 문서 제목에 보고 있는 달을 붙인다 (4-5). 참석 창은 라우터가 정한 제목 그대로.
watch(selectedMonth, (m) => {
  if (route.path === ROUTE_PATHS.MONTHLY) setPageTitle(`월간 기록 ${m}`);
}, { immediate: true });
watch(selectedMonth, (m) => {
  if (route.path !== ROUTE_PATHS.MONTHLY || route.query.month === m) return;
  void router.replace({ query: { ...route.query, month: m } });
});

const monthlyData = computed(() => getMonthlyData(selectedMonth.value));

const selectedMeeting = computed(() =>
  availableMonths.value.find((m) => m.year_month === selectedMonth.value)
);


// 현재월·다음달은 미팅 없어도 선택 가능
const SELECTABLE = new Set([currentYM, nextYM]);
const existingMonths = computed(() => new Set(availableMonths.value.map((m) => m.year_month)));
const isSelectable = (ym: string): boolean => existingMonths.value.has(ym) || SELECTABLE.has(ym);

// 연도 → 월 2단 선택 (4-1). 연도는 기록이 있는 해와 고를 수 있는 달(이번 달·
// 다음 달)이 속한 해. 고를 달이 하나도 없는 해는 넣지 않는다.
const yearOptions = computed(() => {
  const years = new Set([...existingMonths.value, ...SELECTABLE].map((ym) => ym.slice(0, 4)));
  return [...years].sort().reverse().map((y) => ({ value: y, label: `${y}년` }));
});

const selectedYear = computed({
  get: () => selectedMonth.value.slice(0, 4),
  // 해를 바꾸면 그해에서 고를 수 있는 가장 최근 달(이번 달 이하 우선)로 간다.
  set: (y: string) => {
    if (y === selectedMonth.value.slice(0, 4)) return;
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(12 - i).padStart(2, '0')}`)
      .filter(isSelectable);
    selectedMonth.value = months.find((ym) => ym <= currentYM) ?? months[months.length - 1] ?? `${y}-01`;
  },
});

const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const ym = `${selectedYear.value}-${String(12 - i).padStart(2, '0')}`;
    return { value: ym, label: `${12 - i}월`, disabled: !isSelectable(ym) };
  })
);

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

// 참석 창(App.vue, #/attendance)은 익월 본인 참석만 바꾼다. 익월을 볼 때만 본인
// 줄의 이름·참석 칸을 그 창으로 잇는다.
const attendanceMemberId = computed(() =>
  selectedMonth.value === nextYM ? currentMember.value?.id ?? null : null
);

function openAttendance(): void {
  router.push(ROUTE_PATHS.ATTENDANCE);
}

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

// 기한이 지난(확정된) 달도 관리자는 사유를 남기고 고칠 수 있다 (4-2). 서버
// can_manage_month 는 원래 관리자에게 기한을 두지 않으므로 화면 가드만 푼다.
// 전월 Host 는 기존 3일 규칙 그대로다.
const canUnlock = computed(() => isAdmin.value && !!selectedMeeting.value && !isEditableMonth.value);

// 사유를 meetings.notes 끝에 [YYYY-MM-DD 수정: 사유] 로 덧붙인다. 결과 저장이
// 끝난 뒤에 붙인다 — 먼저 붙이면 저장이 실패해도 수정했다는 기록이 남는다.
async function appendEditNote(yearMonth: string, reason: string): Promise<void> {
  const { data, error } = await supabase.from('meetings').select('notes').eq('year_month', yearMonth).single();
  if (error) throw error;
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const line = `[${stamp} 수정: ${reason}]`;
  const prev = (data?.notes as string | null)?.trim();
  const { error: upErr } = await supabase
    .from('meetings')
    .update({ notes: prev ? `${prev}\n${line}` : line })
    .eq('year_month', yearMonth);
  if (upErr) throw upErr;
}

const saveError = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'error'>('idle');

async function handleSaveMonth(payload: SavePayload): Promise<void> {
  if (saveState.value === 'saving') return;
  saveError.value = null;
  saveState.value = 'saving';
  try {
    // 골프장·모임·결과를 한 트랜잭션으로 저장한다(save_meeting_results). 도중에
    // 실패하면 서버가 전부 되돌리므로, 그 달 결과가 비는 일이 없다.
    // 스코어가 있으면 참석으로 보는 규칙·입력 검증은 서버가 다시 한다.
    const courseName = manualCourse.value.trim();
    const existingCourse = GOLF_COURSES.find((c) => c.name.trim() === courseName);
    const hostMemberId = Object.entries(payload.ranks).find(([, v]) => v === 'Host')?.[0] ?? null;

    const rows = monthlyData.value.map((row) => ({
      member_id: parseInt(row.member_id),
      attended: payload.attendance[row.member_id] ?? false,
      score: payload.scores[row.member_id] ?? '',
      result_group: payload.groups[row.member_id] || null,
      result_rank: payload.ranks[row.member_id] || null,
    }));

    const { data, error } = await supabase.rpc('save_meeting_results', {
      p_year_month: selectedMonth.value,
      p_meeting_date: manualDate.value || null,
      p_course_id: existingCourse ? parseInt(existingCourse.id) : null,
      p_new_course_name: existingCourse ? null : courseName || null,
      p_host_member_id: hostMemberId ? parseInt(hostMemberId) : null,
      p_rows: rows,
    });
    if (error) throw error;
    const res = data as { ok: boolean; message?: string; saved?: number };
    if (!res.ok) throw new Error(res.message ?? '저장 실패');

    // 결과는 이미 저장됐으니 사유를 못 붙여도 저장 실패로 돌리지 않는다. 대신 알린다.
    let noteFailed = false;
    if (payload.unlockReason) {
      try {
        await appendEditNote(selectedMonth.value, payload.unlockReason);
      } catch {
        noteFailed = true;
      }
    }

    await loadData();
    saveState.value = 'idle';
    if (noteFailed) {
      toast({ title: '수정 사유 기록 실패', description: '결과는 저장 완료 · 사유는 관리자가 따로 기록 필요', variant: 'destructive' });
    }
    toast({
      title: '저장 완료',
      description: `${selectedMonth.value} 기록 ${res.saved ?? rows.length}건 저장 완료`,
    });
  } catch (err) {
    // 인라인 문구는 남겨 둔다 — 토스트는 몇 초 뒤 사라지는데, 저장에 실패했다는
    // 사실은 다시 저장할 때까지 화면에 남아 있어야 한다.
    saveError.value = describeError(err, '저장 중 오류 발생');
    saveState.value = 'error';
    toast({ title: '저장 실패', description: saveError.value, variant: 'destructive' });
  }
}


</script>

<template>
  <div class="w-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-5xl">
        <p v-if="saveError" class="text-sm text-destructive px-1" role="alert">{{ saveError }}</p>

        <MonthlyTable
          :year-month="selectedMonth"
          :monthly-data="monthlyData"
          :meeting-date="effectiveMeetingDate"
          :course-name="effectiveCourseName"
          :is-manager="isManager"
          :can-unlock="canUnlock"
          :is-future-month="isFutureMonth"
          :is-editable="isEditableMonth"
          v-model:selected-month="selectedMonth"
          v-model:selected-year="selectedYear"
          :year-options="yearOptions"
          :month-options="monthOptions"
          v-model:manual-date="manualDate"
          v-model:manual-course="manualCourse"
          :save-state="saveState"
          :attendance-member-id="attendanceMemberId"
          @save="handleSaveMonth"
          @open-attendance="openAttendance"
        />
      
    </div>
  </div>
</template>
