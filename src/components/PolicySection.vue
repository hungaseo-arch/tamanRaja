<script setup lang="ts">
import { ref } from 'vue';
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
</script>

<template>
  <section class="policy-section">
    <h2 class="m-0">
      <button
        type="button"
        class="policy-toggle"
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
