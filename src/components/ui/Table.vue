<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { useEventListener, useResizeObserver } from '@vueuse/core';
import { cn } from '@/lib/utils';
// caption: 표가 무엇을 담은 표인지. 화면에는 안 보이지만 화면 낭독기가 표에
// 들어설 때 읽어준다. 없으면 "표, 9열 15행"까지만 읽히고 무슨 표인지 알 수 없다.
//
// scroll: 표가 자기 안에서 스크롤할지. 기본은 참이다. 거짓이면 스크롤은
// 바깥(페이지)이 맡고 이 상자는 아무것도 자르지 않는다 — 열 제목의 sticky 는
// 가장 가까운 스크롤 상자를 기준으로 걸리므로, 표 위쪽 카드까지 함께 밀려
// 올라가게 하려면 중간에 자르는 상자가 없어야 한다.
interface Props { class?: string; caption?: string; scroll?: boolean }
const props = withDefaults(defineProps<Props>(), { scroll: true });

// 오른쪽에 아직 가려진 열이 있는지. 좁은 화면에서 표만 옆으로 밀릴 때
// 끝에 그라데이션을 깔아 "더 있다"를 알린다 — 스크롤바는 모바일에서
// 손을 대기 전까지 보이지 않아 마지막 열이 없는 줄로 읽힌다. (3-3)
const scroller = useTemplateRef<HTMLElement>('scroller');
const tableEl = useTemplateRef<HTMLElement>('tableEl');
const moreRight = ref(false);

function updateHint(): void {
  const el = scroller.value;
  // 1px 여유: 배율에 따라 scrollLeft 가 소수점으로 끝에 못 미칠 수 있다.
  moreRight.value = !!el && props.scroll && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

useEventListener(scroller, 'scroll', updateHint, { passive: true });
// 상자 폭(회전·창 크기)과 표 폭(편집 칸이 생기고 사라짐) 어느 쪽이 바뀌어도 다시 잰다.
useResizeObserver([scroller, tableEl], updateHint);
</script>
<template>
  <!-- scroll 일 때 안쪽 div 가 표의 유일한 스크롤 컨테이너다. 페이지 쪽에서 다시
       감싸면 스크롤바가 두 개 생기므로 감싸지 말 것. (P1-4)
       바깥 div 는 스크롤하지 않고 힌트 그라데이션을 스크롤 상자 오른쪽에
       붙여 두는 자리일 뿐이다.
       border-separate: sticky 셀에서도 테두리가 함께 고정되도록. collapse 상태의
       테두리는 셀이 아니라 표에 그려져 스크롤 시 떨어져 나간다. -->
  <!-- tabindex=0: 가로로 스크롤되는 영역은 키보드로도 밀 수 있어야 한다.
       마우스 휠·터치만 되면 키보드 사용자는 오른쪽 열에 닿지 못한다. (P2-1)
       role=region + 이름을 붙여야 포커스가 왔을 때 어디인지 알 수 있다.
       스스로 스크롤하지 않을 때는 밀 것이 없으므로 셋 다 붙이지 않는다. -->
  <div :class="cn('relative w-full', props.scroll && 'h-full')">
    <div
      ref="scroller"
      :class="props.scroll
        ? 'w-full h-full overflow-auto focus-visible:outline-2 focus-visible:outline-ring'
        : 'w-full'"
      :tabindex="props.scroll ? 0 : undefined"
      :role="props.scroll && props.caption ? 'region' : undefined"
      :aria-label="props.scroll ? props.caption : undefined"
    >
      <table
        ref="tableEl"
        :class="cn(
          'w-full caption-bottom text-sm border-separate border-spacing-0',
          props.scroll && 'h-full',
          props.class
        )"
      >
        <caption v-if="props.caption" class="sr-only">{{ props.caption }}</caption>
        <slot />
      </table>
    </div>
    <div
      v-if="moreRight"
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 z-30 w-8 bg-linear-to-l from-card to-transparent"
    />
  </div>
</template>
