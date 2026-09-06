// 관리자 판정은 더 이상 프런트엔드 하드코딩이 아니라 members.role 이 소스다.
// 세션 회원의 role 은 session_member() RPC 가 알려주며(useAuth 의 isAdmin),
// 최종 강제는 서버 RLS 가 한다. 화면 조건은 편의일 뿐 권한 경계가 아니다.

export const ROUTE_PATHS = {
  HOME: '/',
  MONTHLY: '/monthly',
  RANKING: '/ranking',
  PROFILE: '/profile',
  // 참석 확인은 모달이지만 주소를 갖는다 — 단톡방에 링크로 돌리고,
  // 뒤로가기로 닫을 수 있어야 한다.
  ATTENDANCE: '/attendance',
} as const;

// 예전 경로(끝 슬래시 포함). 북마크·공유 링크가 살아 있도록 리다이렉트만 남긴다.
export const LEGACY_ROUTE_PATHS = {
  MONTHLY: ['/monthlyRecord/', '/monthlyRecord'],
} as const;

// Domain types (1:1 with original src/lib/index.ts)
export interface Member {
  id: string;
  name: string;
  display_order: number;
  /** 휴면 시작월(YYYY-MM). 이 달부터의 경기는 집계·랭킹에서 빠진다. 현역이면 null. */
  dormant_from: string | null;
}

export interface Meeting {
  id: string;
  year_month: string;
  meeting_date: string;
  golf_course_id: string;
  host_member_id: string;
  /** 모임 비고. 대체 개최·앞당김 사유가 여기에 적혀 있다. */
  notes: string | null;
}

export interface MonthlyHandicap {
  id: string;
  member_id: string;
  year_month: string;
  std_hc: number;
  app_hc: number;
  // 그 달 스코어가 아직 입력되지 않았으면 차월 핸디는 정해지지 않는다.
  // (최신 달은 대개 null 이다 — number 로 단언하면 폴백 계산이 조용히 깨진다)
  next_hc: number | null;
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
  /**
   * 엑셀 원본 비고 원문. 시상 3종(result_rank)에 담기지 않는 표기 — 연간
   * 위너·연말 준우승·깍두기·Guest — 가 여기에만 남아 있어 그대로 보여준다.
   */
  note: string | null;
}

export interface MonthlyRow {
  member_id: string;
  member_name: string;
  display_order: number;
  std_hc: number;
  // 적용 핸디가 아직 정해지지 않은 달이 있다 (직전 달 차월핸디로 폴백했는데
  // 그 값도 비어 있는 경우). 이때 Net·조 편성은 계산하지 않는다.
  app_hc: number | null;
  next_hc: number | null;
  /** 마지막으로 조에 편성된 달의 조 (불참한 달은 건너뛴다). 차월 핸디 판정 기준. */
  prev_result_group: ResultGroup;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: ResultGroup;
  result_rank: ResultRank;
  yearly_net: number | null;
  yearly_rank: number | null;
  /** meeting_results.note 원문 (비고 열) */
  note: string | null;
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
