<script lang="ts">
// 다른 곳(산식 설명, 상세 창 등)의 "N번 섹션 참조" 버튼이 부른다.
// 대상 섹션(또는 그 안의 요소)을 펼치고 그 위치로 스크롤·포커스를 옮긴다.
// 라우터가 해시 방식이라 #앵커 링크는 쓸 수 없어 window 이벤트로 전달한다.
const OPEN_EVENT = 'policy-section:open';
export function openPolicySection(targetId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: targetId }));
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

// 핸디캡 산정기준 페이지의 접이식 섹션. 인쇄할 때는 접힌 섹션도 모두
// 펼치고 접기 버튼을 숨긴다 (스타일은 HandicapPolicy.vue 의 @media print).
interface Props {
  id: string;
  title: string;
  /** 번호 표시 (예: "1"). 제목 앞에 동그라미로 붙는다. */
  no?: string;
  defaultOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), { no: '', defaultOpen: false });
const open = ref(props.defaultOpen);
const rootEl = ref<HTMLElement | null>(null);
const toggleEl = ref<HTMLButtonElement | null>(null);

// 스크린리더가 섹션 번호를 알도록 버튼 이름에 번호를 넣는다 (시각용 번호 원은 aria-hidden).
const toggleLabel = props.no ? `${props.no}번 ${props.title}` : props.title;

function onOpenRequest(e: Event): void {
  const targetId = (e as CustomEvent<string>).detail;
  const target = document.getElementById(targetId);
  if (!target || !rootEl.value?.contains(target)) return;
  open.value = true;
  void nextTick(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // 섹션 자체면 토글 버튼, 안쪽 요소면 그 요소로 포커스를 옮긴다.
    if (target === rootEl.value) toggleEl.value?.focus({ preventScroll: true });
    else {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });
}

onMounted(() => window.addEventListener(OPEN_EVENT, onOpenRequest));
onBeforeUnmount(() => window.removeEventListener(OPEN_EVENT, onOpenRequest));
</script>

<template>
  <section :id="props.id" ref="rootEl" class="policy-section">
    <h2 class="m-0">
      <button
        ref="toggleEl"
        type="button"
        class="policy-toggle"
        :aria-label="toggleLabel"
        :aria-expanded="open"
        :aria-controls="`${props.id}-body`"
        @click="open = !open"
      >
        <span v-if="props.no" class="policy-no" aria-hidden="true">{{ props.no }}</span>
        <span class="flex-1 text-left">{{ props.title }}</span>
        <ChevronDown class="policy-chevron" :class="{ 'rotate-180': open }" aria-hidden="true" />
      </button>
    </h2>
    <div v-show="open" :id="`${props.id}-body`" class="policy-body">
      <slot />
    </div>
  </section>
</template>
