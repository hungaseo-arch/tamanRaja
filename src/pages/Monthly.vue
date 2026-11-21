<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getMonthlyData, getAvailableMonths, getAttendanceMonth, canAnswerAttendance, firstSaturday, GOLF_COURSES, MEETINGS, MEETING_RESULTS, loadData, dataError } from '@/data';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/lib/errors';
import { ROUTE_PATHS } from '@/lib';
import { setPageTitle } from '@/lib/title';
import { formatYearMonth } from '@/lib/format';
import type { SavePayload } from '@/components/MonthlyTable.vue';
import MonthlyTable from '@/components/MonthlyTable.vue';
import Dialog from '@/components/ui/Dialog.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';

const availableMonths = computed(() => getAvailableMonths());

const today = new Date();
const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
// 12월의 다음 달은 이듬해 1월이다. 월만 더하면 '2026-13' 이 된다.
const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const nextYM = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

// 기본은 이번 달이다. 모임 행은 보통 모임이 끝난 뒤에야 저장되므로, 행이 있는
// 달을 기준으로 고르면 달이 바뀌어도 지난달에 머문다.
const route = useRoute();
const queryMonth = route.query.month as string | undefined;
// 참석 확인 대상 달. 이번 달 모임이 아직이면 이번 달, 끝났으면 다음 달.
const attendanceYM = computed(() => getAttendanceMonth());
// #/attendance 는 이 화면을 배경으로 쓰는 참석 확인 창이다. 뒤에 깔리는 표도
// 확인 대상 달이어야 한다.
const defaultMonth = queryMonth
  ?? (route.path === ROUTE_PATHS.ATTENDANCE ? attendanceYM.value : currentYM);
const selectedMonth = ref<string>(defaultMonth);

const router = useRouter();

// ── 저장하지 않은 입력 보호 ────────────────────────────────────────────────────
// 표가 알려 주는 변경분 여부. 있는 채로 달이 바뀌면 입력값이 통째로 사라지므로
// 달을 바꾸는 모든 길(월·연도 선택, 주소 ?month=, 참석 대상 달)이 requestMonth 를 지난다.
const hasUnsaved = ref(false);
const pendingMonth = ref<string | null>(null);
const leaveOpen = ref(false);
// 취소하면 올라 있던 select 가 고른 값을 그대로 보여 주므로, 번호를 올려 칸을 새로 그린다.
const selectRevision = ref(0);

function requestMonth(ym: string): void {
  if (ym === selectedMonth.value) return;
  if (!hasUnsaved.value) {
    selectedMonth.value = ym;
    return;
  }
  pendingMonth.value = ym;
  leaveOpen.value = true;
}

function confirmLeave(): void {
  const ym = pendingMonth.value;
  pendingMonth.value = null;
  leaveOpen.value = false;
  if (ym) selectedMonth.value = ym;
}

// 이전 달에 머문다. 주소(뒤로 가기·링크)가 먼저 바뀌어 있었다면 ?month= 도 되돌려
// 주소와 화면이 어긋나지 않게 한다.
function stayOnMonth(): void {
  pendingMonth.value = null;
  leaveOpen.value = false;
  selectRevision.value++;
  if (route.path === ROUTE_PATHS.MONTHLY && route.query.month !== selectedMonth.value) {
    void router.replace({ query: { ...route.query, month: selectedMonth.value } });
  }
}

// 새로고침·탭 닫기. 변경분이 있을 때만 브라우저 기본 경고를 띄운다.
function warnBeforeUnload(e: BeforeUnloadEvent): void {
  if (!hasUnsaved.value) return;
  e.preventDefault();
  e.returnValue = '';
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload));

// ?month= 와 고른 달은 양쪽으로 맞춘다 — 주소를 단톡방에 붙이면 같은 달이 열린다.
// 참석 창(#/attendance)은 이 화면을 배경으로 빌려 쓸 뿐이라 주소를 건드리지 않는다.
watch(() => route.query.month, (m) => {
  if (m && typeof m === 'string') requestMonth(m);
});
// 링크로 바로 들어오면 모임 목록이 늦게 와서 대상 달이 바뀔 수 있다.
watch(attendanceYM, (ym) => {
  if (route.path === ROUTE_PATHS.ATTENDANCE && !queryMonth) requestMonth(ym);
});
// 문서 제목에 보고 있는 달을 붙인다 (4-5). 참석 창은 라우터가 정한 제목 그대로.
watch(selectedMonth, (m) => {
  if (route.path === ROUTE_PATHS.MONTHLY) setPageTitle(`월간 기록 ${formatYearMonth(m)}`);
}, { immediate: true });
watch(selectedMonth, (m) => {
  if (route.path !== ROUTE_PATHS.MONTHLY || route.query.month === m) return;
  void router.replace({ query: { ...route.query, month: m } });
});

// 월 선택 칸은 requestMonth 를 거친다 (위 보호 참고).
const monthModel = computed({
  get: () => selectedMonth.value,
  set: (v: string) => requestMonth(v),
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
    requestMonth(months.find((ym) => ym <= currentYM) ?? months[months.length - 1] ?? `${y}-01`);
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

// 참석 창(App.vue, #/attendance)은 본인 참석만 바꾼다. 아직 답할 수 있는 달
// (확인 대상 달과 그 뒤)을 볼 때 본인 줄의 이름·참석 칸을 그 창으로 잇고,
// 보고 있는 달을 주소에 실어 그 달에 저장되게 한다.
const attendanceMemberId = computed(() =>
  canAnswerAttendance(selectedMonth.value) ? currentMember.value?.id ?? null : null
);

function openAttendance(): void {
  router.push({ path: ROUTE_PATHS.ATTENDANCE, query: { month: selectedMonth.value } });
}

// 화면 노출 조건일 뿐 권한 경계가 아니다. 실제 쓰기 허용 여부는 서버 RLS 가
// app.can_manage_month() 로 동일한 규칙(관리자 또는 전월 Host)을 재검증한다.
const isManager = computed(() => {
  if (!currentMember.value) return false;
  if (isAdmin.value) return true;
  // 전월 Host 확인 (선택된 미래월 기준 전월 → 새 미래월 추가 시 자동 갱신)
  const prevMonthNum = parseInt(selectedMonth.value.slice(5), 10) - 1;
  const prevYM = prevMonthNum === 0
    ? `${parseInt(selectedMonth.value.slice(0, 4), 10) - 1}-12`
    : `${selectedMonth.value.slice(0, 4)}-${String(prevMonthNum).padStart(2, '0')}`;
  const prevMeeting = MEETINGS.find((m) => m.year_month === prevYM);
  if (!prevMeeting) return false;
  const hostResult = MEETING_RESULTS.find(
    (r) => r.meeting_id === prevMeeting.id && r.result_rank === 'Host'
  );
  if (!hostResult) return false;
  // 동명이인이 있을 수 있으므로 이름이 아니라 id 로 비교한다.
  return String(hostResult.member_id) === String(currentMember.value.id);
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
const reloadFailed = ref(false);
const reloading = ref(false);

async function retryReload(): Promise<void> {
  if (reloading.value) return;
  reloading.value = true;
  await loadData();
  reloadFailed.value = !!dataError.value;
  reloading.value = false;
  if (reloadFailed.value) {
    toast({ title: '불러오기 실패', description: '잠시 후 다시 시도', variant: 'destructive' });
  }
}

// 편집 진입·종료·월 이동 때 지난 저장 실패 표시를 지운다. 저장 중에는 건드리지 않는다.
function clearSaveError(): void {
  reloadFailed.value = false;
  if (saveState.value === 'error') {
    saveState.value = 'idle';
    saveError.value = null;
  }
}
const saveState = ref<'idle' | 'saving' | 'error'>('idle');
watch(selectedMonth, clearSaveError);

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
      member_id: parseInt(row.member_id, 10),
      attended: payload.attendance[row.member_id] ?? false,
      score: payload.scores[row.member_id] ?? '',
      result_group: payload.groups[row.member_id] || null,
      result_rank: payload.ranks[row.member_id] || null,
    }));

    const { data, error } = await supabase.rpc('save_meeting_results', {
      p_year_month: selectedMonth.value,
      p_meeting_date: manualDate.value || null,
      p_course_id: existingCourse ? parseInt(existingCourse.id, 10) : null,
      p_new_course_name: existingCourse ? null : courseName || null,
      p_host_member_id: hostMemberId ? parseInt(hostMemberId, 10) : null,
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
    // loadData 는 실패해도 던지지 않는다. 저장은 됐으니 실패로 돌리지 않되, 표가 옛 값일 수 있음을 알린다.
    reloadFailed.value = !!dataError.value;
    saveState.value = 'idle';
    if (noteFailed) {
      toast({ title: '수정 사유 기록 실패', description: '결과는 저장 완료 · 사유는 관리자가 따로 기록 필요', variant: 'destructive' });
    }
    toast({
      title: '저장 완료',
      description: `${formatYearMonth(selectedMonth.value)} 기록 ${res.saved ?? rows.length}건`,
    });
  } catch (err) {
    // 인라인 문구는 남겨 둔다 — 토스트는 몇 초 뒤 사라지는데, 저장에 실패했다는
    // 사실은 다시 저장할 때까지 화면에 남아 있어야 한다.
    saveError.value = describeError(err, '저장 실패');
    saveState.value = 'error';
    toast({ title: '저장 실패', description: saveError.value, variant: 'destructive' });
  }
}


</script>

<template>
  <div class="w-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-5xl">
        <div
          v-if="reloadFailed"
          role="alert"
          class="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span class="min-w-0 flex-1">저장은 완료됨. 최신 기록을 불러오지 못해 표가 이전 값일 수 있음.</span>
          <Button type="button" size="xs" variant="outline" :disabled="reloading" @click="retryReload">
            {{ reloading ? '불러오는 중…' : '다시 불러오기' }}
          </Button>
        </div>
        <MonthlyTable
          :year-month="selectedMonth"
          :monthly-data="monthlyData"
          :meeting-date="effectiveMeetingDate"
          :course-name="effectiveCourseName"
          :is-manager="isManager"
          :can-unlock="canUnlock"
          :is-future-month="isFutureMonth"
          :is-editable="isEditableMonth"
          v-model:selected-month="monthModel"
          v-model:selected-year="selectedYear"
          :year-options="yearOptions"
          :month-options="monthOptions"
          v-model:manual-date="manualDate"
          v-model:manual-course="manualCourse"
          :save-state="saveState"
          :save-error="saveError"
          :attendance-member-id="attendanceMemberId"
          :select-revision="selectRevision"
          @dirty-change="hasUnsaved = $event"
          @save="handleSaveMonth"
          @clear-save-error="clearSaveError"
          @open-attendance="openAttendance"
        />
      
      <!-- 저장하지 않은 입력이 있는 채로 달을 바꾸려 할 때 -->
      <Dialog :open="leaveOpen" label="달 이동 확인" content-class="sm:max-w-sm" @update:open="(v: boolean) => { if (!v && pendingMonth) stayOnMonth(); }">
        <div class="space-y-3">
          <DialogTitle class="mb-0">달 이동 확인</DialogTitle>
          <p class="text-sm">저장하지 않은 입력 있음. 다른 달로 이동하면 입력한 내용 삭제</p>
          <p v-if="pendingMonth" class="text-sm text-muted-foreground">{{ formatYearMonth(selectedMonth) }} → {{ formatYearMonth(pendingMonth) }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="stayOnMonth">이 달에 머물기</Button>
            <Button type="button" variant="destructive" @click="confirmLeave">입력 폐기하고 이동</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  </div>
</template>
