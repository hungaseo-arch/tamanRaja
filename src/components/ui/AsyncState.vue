<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

// 불러오는 중 / 실패 / 내용 없음 을 한 곳에서 같은 모양으로 그린다.
// 화면마다 제각각 문구를 두면 어떤 화면은 아무 말도 없이 비어 보인다.
interface Props {
  loading?: boolean;
  /** 실패 사유. 사용자에게 그대로 보여주므로 서버 메시지를 넣어도 된다. */
  error?: string | null;
  /** 불러오기는 끝났는데 보여줄 내용이 없는 경우 */
  empty?: boolean;
  /** 무엇을 불러오는지. "연간 랭킹" → "연간 랭킹을 불러오는 중" */
  label?: string;
  /** 로딩 중 그릴 표 골격 줄 수. 0 이면 문구만 (표가 아닌 화면). */
  skeletonRows?: number;
  emptyTitle?: string;
  /** 비어 있을 때 다음에 무엇을 하면 되는지 알려준다. */
  emptyHint?: string;
  /** 로딩·오류·빈 상태 화면에만 붙는 여백 클래스. 정상일 때는 슬롯만 나가므로
      여기에 준 클래스가 페이지 레이아웃을 건드리지 않는다. */
  containerClass?: string;
}

const props = defineProps<Props>();

// 정상일 때 내보내는 것은 슬롯뿐이라 루트 엘리먼트가 없다. 물려받은 속성을
// 그대로 두면 Vue 가 "붙일 곳이 없다"고 경고한다. 여백은 containerClass 로 받는다.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <!-- 로딩이 오류를 덮는다. 다시 시도를 누른 직후에는 이전 오류가 아니라
       "다시 불러오는 중"이 보여야 누른 게 먹혔는지 알 수 있다. -->
  <div v-if="props.loading" :class="['py-6', props.containerClass]" role="status" aria-live="polite">
    <span class="sr-only">{{ props.label ? `${props.label}을(를) 불러오는 중` : '불러오는 중' }}</span>
    <template v-if="props.skeletonRows">
      <!-- 표 골격. 화면 전체를 문구로 덮으면 내용이 도착할 때 레이아웃이 튄다. -->
      <div class="space-y-2" aria-hidden="true">
        <div class="h-9 rounded bg-muted animate-pulse" />
        <div
          v-for="i in props.skeletonRows"
          :key="i"
          class="h-8 rounded bg-muted/60 animate-pulse"
          :style="{ animationDelay: `${i * 60}ms` }"
        />
      </div>
    </template>
    <p v-else class="text-center text-muted-foreground animate-pulse py-8">
      {{ props.label ? `${props.label}을(를) 불러오는 중...` : '불러오는 중...' }}
    </p>
  </div>

  <div
    v-else-if="props.error"
    :class="['flex flex-col items-center justify-center gap-3 py-10 px-4 text-center', props.containerClass]"
    role="alert"
  >
    <p class="font-medium text-foreground">
      {{ props.label ? `${props.label}을(를) 불러오지 못했습니다` : '불러오지 못했습니다' }}
    </p>
    <!-- 원인을 감추지 않는다. "오류가 발생했습니다"만 보면 기다려야 할지
         새로고침해야 할지 판단할 수가 없다. -->
    <p class="text-sm text-destructive wrap-break-word max-w-md">{{ props.error }}</p>
    <Button variant="outline" size="sm" class="gap-1.5" @click="emit('retry')">
      <RefreshCw class="w-4 h-4" aria-hidden="true" />
      다시 시도
    </Button>
  </div>

  <div
    v-else-if="props.empty"
    :class="['flex flex-col items-center justify-center gap-1.5 py-10 px-4 text-center', props.containerClass]"
  >
    <p class="text-muted-foreground">{{ props.emptyTitle ?? '표시할 기록이 없습니다' }}</p>
    <p v-if="props.emptyHint" class="text-sm text-muted-foreground/80">{{ props.emptyHint }}</p>
    <slot name="empty-action" />
  </div>

  <slot v-else />
</template>
