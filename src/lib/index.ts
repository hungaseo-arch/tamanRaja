// 관리자 판정은 더 이상 프런트엔드 하드코딩이 아니라 members.role 이 소스다.
// 세션 회원의 role 은 session_member() RPC 가 알려주며(useAuth 의 isAdmin),
// 최종 강제는 서버 RLS 가 한다. 화면 조건은 편의일 뿐 권한 경계가 아니다.

export const ROUTE_PATHS = {
  HOME: '/',
  MONTHLY: '/monthlyRecord/',
  RANKING: '/ranking',
  PROFILE: '/profile',
} as const;

// Domain types (1:1 with original src/lib/index.ts)
export interface Member {
  id: string;
  name: string;
  display_order: number;
}

export interface Meeting {
  id: string;
  year_month: string;
  meeting_date: string;
  golf_course_id: string;
  host_member_id: string;
}

export interface MonthlyHandicap {
  id: string;
  member_id: string;
  year_month: string;
  std_hc: number;
  app_hc: number;
  next_hc: number;
}

export type ResultRank = 'Winner' | 'Medalist' | 'Host' | null;
export type ResultGroup = '1등조' | '2등조' | null;

export interface MeetingResult {
  id: string;
  meeting_id: string;
  member_id: string;
  attended: boolean;
  score: number | null;
  result_group: ResultGroup;
  result_rank: ResultRank;
}

export interface MonthlyRow {
  member_id: string;
  member_name: string;
  display_order: number;
  std_hc: number;
  app_hc: number;
  next_hc: number | null;
  prev_result_group: ResultGroup;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: ResultGroup;
  result_rank: ResultRank;
  yearly_net: number | null;
  yearly_rank: number | null;
  // 기준핸디 재적용(리셋) 월 여부 — 이 달은 조 변경 리셋 없이 ±1만 적용
  is_reset_month: boolean;
}

export interface YearlySummary {
  member_id: string;
  member_name: string;
  avg_net_score: number;
  avg_score: number | null;
  attended_count: number;
  winner_count: number;
  medalist_count: number;
  host_count: number;
  rank: number;
}
