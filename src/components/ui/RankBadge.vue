<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import { RANK_STYLE, type RankName } from '@/lib/rank';
import { cn } from '@/lib/utils';

// Winner·Medalist·Host 배지는 월간 기록·연간 랭킹·나의 기록 세 화면에 모두
// 나온다. 화면마다 따로 만들면 색과 아이콘이 갈리므로 여기 하나만 쓴다.
interface Props {
  rank: RankName;
  /** 있으면 이름 뒤에 붙는다 (연간 랭킹의 'Winner 2') */
  count?: number | null;
  class?: string;
}

const props = defineProps<Props>();
const style = computed(() => RANK_STYLE[props.rank]);
const label = computed(() => (props.count == null ? props.rank : `${props.rank} ${props.count}`));
</script>

<template>
  <Badge :class="cn(style.badge, 'border-0 shadow-md whitespace-nowrap', props.class)">
    <component :is="style.icon" class="w-3 h-3 mr-1" aria-hidden="true" />{{ label }}
  </Badge>
</template>
