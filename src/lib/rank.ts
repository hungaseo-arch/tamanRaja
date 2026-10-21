import { Trophy, Medal, Home } from 'lucide-vue-next';
import type { Component } from 'vue';
import type { ResultGroup, ResultRank } from '@/lib';

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

// ── 결과 자동 계산 ────────────────────────────────────────────────────────────
// 월간 표 편집 중 스코어를 넣으면 조·차월 핸디·시상을 채운다. 화면 코드에
// 묶여 있으면 시험할 수 없어 순수 함수로 뺐다 (5-6).

export interface ScoredRow {
  member_id: string;
  std_hc: number;
  app_hc: number;
  prev_result_group: ResultGroup;
  score: number;
}

export interface ComputedResult {
  result_group: Exclude<ResultGroup, null>;
  next_hc: number;
  /** 시상이 없으면 '' */
  result_rank: RankName | '';
}

export function computeResults(rows: ScoredRow[]): Record<string, ComputedResult> {
  const scored = rows
    .map((row) => ({ ...row, netScore: row.score - row.app_hc }))
    .sort((a, b) => a.netScore - b.netScore);
  const out: Record<string, ComputedResult> = {};
  if (scored.length === 0) return out;

  const topCount = Math.floor(scored.length / 2);

  scored.forEach((row, idx) => {
    const group = idx < topCount ? '1등조' : '2등조';

    // 차월핸디:
    //  - 당월핸디가 기준핸디와 같은 달(1월·기준핸디 재설정·조 변경 복귀 직후)은
    //    초기화 상태라 직전 조와 견주지 않고 당월 결과만으로 ±1
    //  - 그 외 직전 라운드와 같은 조 → 1등조 app-1 / 2등조 app+1
    //  - 조가 바뀐 경우 → 기준핸디(std_hc)로 복귀
    const fresh = row.app_hc === row.std_hc;
    const adjust = group === '1등조' ? row.app_hc - 1 : row.app_hc + 1;
    out[row.member_id] = {
      result_group: group,
      next_hc:
        fresh || (row.prev_result_group !== null && row.prev_result_group === group)
          ? adjust
          : row.std_hc,
      result_rank: '',
    };
  });

  // Winner: 최저 Net Score
  const winnerRow = scored[0];
  // Host: 최고 Net Score (Winner와 다른 경우)
  const last = scored[scored.length - 1];
  const hostRow = last.member_id !== winnerRow.member_id ? last : undefined;
  // Medalist: 최저 Raw Score (Winner 제외)
  const byRaw = [...scored].sort((a, b) => a.score - b.score);
  const medalistRow = byRaw.find((r) => r.member_id !== winnerRow.member_id);

  out[winnerRow.member_id].result_rank = 'Winner';
  if (medalistRow) out[medalistRow.member_id].result_rank = 'Medalist';
  if (hostRow && hostRow.member_id !== medalistRow?.member_id) {
    out[hostRow.member_id].result_rank = 'Host';
  }
  return out;
}
