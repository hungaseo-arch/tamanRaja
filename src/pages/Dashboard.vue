<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Plus } from 'lucide-vue-next';
import { getDashboardData, getAvailableMonths, GOLF_COURSES, loadData } from '@/data';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import type { SavePayload } from '@/components/DashboardTable.vue';
import DashboardTable from '@/components/DashboardTable.vue';
import ScoreInputModal from '@/components/ScoreInputModal.vue';
import Button from '@/components/ui/Button.vue';

const { isLoggedIn, currentMember } = useAuth();

// computed가 매번 재계산되는 비용이 낮아 useMemo 대용으로 충분
const availableMonths = computed(() => getAvailableMonths());

const selectedMonth = ref<string>(
  availableMonths.value.length > 0 ? availableMonths.value[0].year_month : '2026-05'
);

const scoreModalOpen = ref<boolean>(false);

const dashboardData = computed(() => getDashboardData(selectedMonth.value));

const selectedMeeting = computed(() =>
  availableMonths.value.find((m) => m.year_month === selectedMonth.value)
);

const courseName = computed(() => {
  if (!selectedMeeting.value) return '';
  const course = GOLF_COURSES.find((c) => c.id === selectedMeeting.value!.golf_course_id);
  return course?.name ?? '';
});



const currentMemberData = computed(() => {
  if (!currentMember.value) return null;
  return dashboardData.value.find((d) => d.member_id === currentMember.value!.id) ?? null;
});

const YEAR = '2026';
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0');
  return `${YEAR}-${m}`;
}).reverse();

// 현재월·다음달은 미팅 없어도 선택 가능
const today = new Date();
const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const nextYM = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}`;
const SELECTABLE = new Set([currentYM, nextYM]);

const monthOptions = computed(() => {
  const existing = new Set(availableMonths.value.map((m) => m.year_month));
  return ALL_MONTHS.map((ym) => ({
    value: ym,
    label: ym,
    disabled: !existing.has(ym) && !SELECTABLE.has(ym),
  }));
});

// 직접 입력 (Supabase 미팅 없는 달)
const manualDate = ref('');
const manualCourse = ref('');

watch(selectedMonth, () => {
  manualDate.value = '';
  manualCourse.value = '';
});

const isFutureMonth = computed(
  () => !availableMonths.value.find((m) => m.year_month === selectedMonth.value)
);

const effectiveMeetingDate = computed(
  () => selectedMeeting.value?.meeting_date ?? manualDate.value
);
const effectiveCourseName = computed(
  () => (selectedMeeting.value ? courseName.value : manualCourse.value)
);

const saveError = ref<string | null>(null);
const saveLoading = ref(false);

async function handleSaveMonth(payload: SavePayload): Promise<void> {
  saveError.value = null;
  if (!manualDate.value) { saveError.value = '경기일자를 입력해주세요.'; return; }
  if (!manualCourse.value) { saveError.value = '골프장명을 입력해주세요.'; return; }

  saveLoading.value = true;
  try {
    // 1. 골프장 조회 or 생성
    let courseId: number;
    const existing = GOLF_COURSES.find((c) => c.name === manualCourse.value);
    if (existing) {
      courseId = parseInt(existing.id);
    } else {
      const { data: nc, error: e1 } = await supabase
        .from('golf_courses').insert({ name: manualCourse.value }).select('id').single();
      if (e1) throw new Error(e1.message);
      courseId = (nc as { id: number }).id;
    }

    // 2. 호스트 회원 id
    const hostMemberId = Object.entries(payload.ranks).find(([, v]) => v === 'Host')?.[0] ?? null;

    // 3. meeting 생성
    const { data: meeting, error: e2 } = await supabase
      .from('meetings')
      .insert({
        year_month: selectedMonth.value,
        meeting_date: manualDate.value,
        course_id: courseId,
        host_member_id: hostMemberId ? parseInt(hostMemberId) : null,
      })
      .select('id').single();
    if (e2) throw new Error(e2.message);
    const meetingId = (meeting as { id: number }).id;

    // 4. meeting_results 생성 (전체 회원)
    const results = dashboardData.value.map((row) => {
      const scoreStr = payload.scores[row.member_id];
      const score = scoreStr ? parseInt(scoreStr, 10) : null;
      const attended = score !== null && !isNaN(score);
      return {
        meeting_id: meetingId,
        member_id: parseInt(row.member_id),
        attended,
        score: attended ? score : null,
        result_group: payload.groups[row.member_id] || null,
        result_rank: payload.ranks[row.member_id] || null,
      };
    });
    const { error: e3 } = await supabase.from('meeting_results').insert(results);
    if (e3) throw new Error(e3.message);

    await loadData();
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
  } finally {
    saveLoading.value = false;
  }
}

function handleSaveScore(_score: number | null, _attended: boolean): void {
  // TODO: Supabase 점수 저장 연동
}
</script>

<template>
  <div class="w-full min-h-screen bg-background">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <!-- <div class="space-y-6"> -->
        <!-- <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-foreground">대시보드</h1>
        
        </div> -->


        <p v-if="saveError" class="text-sm text-destructive px-1">{{ saveError }}</p>

        <DashboardTable
          :year-month="selectedMonth"
          :dashboard-data="dashboardData"
          :meeting-date="effectiveMeetingDate"
          :course-name="effectiveCourseName"
          :is-future-month="isFutureMonth"
          v-model:selected-month="selectedMonth"
          :month-options="monthOptions"
          v-model:manual-date="manualDate"
          v-model:manual-course="manualCourse"
          @save="handleSaveMonth"
        />
      <!-- </div> -->

      <template v-if="isLoggedIn && currentMember && currentMemberData">
        <div class="fixed bottom-8 right-8">
          <Button
            size="lg"
            class="rounded-full shadow-lg h-14 px-6"
            @click="scoreModalOpen = true"
          >
            <Plus class="mr-2 h-5 w-5" />
            내 점수 입력
          </Button>
        </div>

        <ScoreInputModal
          v-model:open="scoreModalOpen"
          :member="currentMember"
          :year-month="selectedMonth"
          :current-score="currentMemberData.score"
          :current-attended="currentMemberData.attended"
          @save="handleSaveScore"
        />
      </template>
    </div>
  </div>
</template>
