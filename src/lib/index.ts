// Route paths
export const ROUTE_PATHS = {
  HOME: '/',
  RANKING: '/ranking',
  PROFILE: '/profile',
} as const;

// Domain types (1:1 with original src/lib/index.ts)
export interface Member {
  id: string;
  name: string;
  pin: string;
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

export interface DashboardRow {
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
}

export interface YearlySummary {
  member_id: string;
  member_name: string;
  avg_net_score: number;
  attended_count: number;
  winner_count: number;
  medalist_count: number;
  host_count: number;
  rank: number;
}
