import { Trophy, Medal, Home } from 'lucide-vue-next';
import type { Component } from 'vue';
import type { ResultRank } from '@/lib';

/** 월간 결과 등수. null(등수 없음)을 뺀 값. */
export type RankName = NonNullable<ResultRank>;

// 같은 상을 화면마다 따로 칠하다 보니 Host 가 월간·랭킹에서는 보라, 나의
// 기록에서는 초록이었고, 같은 화면 안에서도 배지는 보라·숫자는 초록이었다.
// 배지 색·아이콘·숫자 강조색은 이 표 하나에서만 정한다.
interface RankStyle {
  /** 배지 바탕·글자색 */
  badge: string;
  icon: Component;
  /** 배지 없이 숫자만 강조할 때의 글자색 (표의 '3회', 통계 카드) */
  text: string;
}

export const RANK_STYLE: Record<RankName, RankStyle> = {
  Winner:   { badge: 'bg-linear-to-r from-yellow-400 to-yellow-600 text-yellow-950', icon: Trophy, text: 'text-yellow-700' },
  Medalist: { badge: 'bg-linear-to-r from-gray-300 to-gray-400 text-gray-900',       icon: Medal,  text: 'text-muted-foreground' },
  Host:     { badge: 'bg-linear-to-r from-violet-500 to-violet-600 text-white',      icon: Home,   text: 'text-violet-600' },
};

/** 문자열이 등수 이름인지. 서버에서 온 값을 그대로 넘길 수 있게 둔다. */
export function isRankName(v: string | null | undefined): v is RankName {
  return v === 'Winner' || v === 'Medalist' || v === 'Host';
}
