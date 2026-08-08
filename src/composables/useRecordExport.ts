import { getYearlyExportRows } from '@/data';
import { downloadCsv, toCsv, type CsvValue } from '@/lib/csv';
import { useToast } from '@/composables/useToast';

// 화면마다 내보내는 내용이 다르므로 표 모양은 각 함수가 정하고,
// "비어 있으면 알리고 멈춘다 / 받았으면 몇 건인지 알린다"는 공통 처리만 묶는다.
function download(filename: string, headers: string[], body: CsvValue[][], label: string): number {
  const { toast } = useToast();

  if (body.length === 0) {
    toast({
      title: '내려받을 기록이 없습니다',
      description: `${label} 기록이 없습니다.`,
      variant: 'destructive',
    });
    return 0;
  }

  downloadCsv(filename, toCsv(headers, body));
  toast({
    title: '엑셀 다운로드 완료',
    description: `${label} ${body.length}건을 내려받았습니다.`,
  });
  return body.length;
}

// 파일 이름에 회원명이 들어간다. OS가 경로로 해석할 수 있는 문자는 빼둔다.
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '');
}

const YEARLY_HEADERS = [
  '연월', '경기일', '골프장', '회원', '참석',
  '기준핸디', '당월핸디', '차월핸디', '스코어', 'NET',
  '월간순위', '결과그룹', '결과', '연간NET평균', '연간순위',
];

const RANKING_HEADERS = [
  '순위', '회원', '참석', '기준핸디', '평균NET', '평균스코어',
  'Winner', 'Medalist', 'Host', '비고',
];

const PROFILE_HEADERS = [
  '연월', '골프장', '기준핸디', '당월핸디', '차월핸디',
  '스코어', 'NET', '결과그룹', '결과',
];

/** 연간 랭킹 화면에서 내보낼 한 줄. 화면에 보이는 순서·순위를 그대로 넘긴다. */
export interface RankingExportRow {
  /** 기준 참석을 못 채워 순위가 없는 회원은 null */
  rank: number | null;
  member_name: string;
  attended_count: number;
  std_hc: number | null;
  avg_net_score: number;
  avg_score: number | null;
  winner_count: number;
  medalist_count: number;
  host_count: number;
}

/** 나의 기록 화면에서 내보낼 한 줄. */
export interface ProfileExportRow {
  year_month: string;
  course_name: string | null;
  std_hc: number | null;
  app_hc: number | null;
  next_hc: number | null;
  attended: boolean;
  score: number | null;
  net_score: number | null;
  result_group: string | null;
  result_rank: string | null;
}

export function useRecordExport() {
  /** 선택된 월이 속한 연도의 전체 경기 기록. 내보낸 행 수를 반환. */
  function exportYearlyRecords(yearMonth: string): number {
    const year = yearMonth.substring(0, 4);
    const body: CsvValue[][] = getYearlyExportRows(year).map((r) => [
      r.year_month,
      r.meeting_date,
      r.course_name,
      r.member_name,
      r.attended ? 'Y' : 'N',
      r.std_hc,
      r.app_hc,
      r.next_hc,
      r.score,
      r.net_score,
      r.monthly_rank,
      r.result_group,
      r.result_rank,
      // 소수점 둘째 자리까지 — 랭킹 화면 표기와 동일
      r.yearly_avg_net === null ? null : Number(r.yearly_avg_net.toFixed(2)),
      r.yearly_rank,
    ]);

    return download(`타만라자_기록_${year}.csv`, YEARLY_HEADERS, body, `${year}년 전체`);
  }

  /**
   * 연간 랭킹표. 정렬·최소 참석 기준을 반영한 화면 그대로를 넘겨받아 내보낸다.
   * (여기서 다시 집계하면 화면과 파일이 어긋날 수 있다)
   */
  function exportYearlyRanking(year: string, rows: RankingExportRow[], minRounds: number): number {
    const body: CsvValue[][] = rows.map((r) => [
      r.rank,
      r.member_name,
      r.attended_count,
      r.std_hc,
      Number(r.avg_net_score.toFixed(2)),
      r.avg_score === null ? null : Number(r.avg_score.toFixed(1)),
      r.winner_count,
      r.medalist_count,
      r.host_count,
      // 순위가 비어 있는 이유를 파일만 봐도 알 수 있게 남긴다
      r.rank === null ? `${minRounds}회 미만 참석` : '',
    ]);

    return download(`타만라자_연간랭킹_${year}.csv`, RANKING_HEADERS, body, `${year}년 랭킹`);
  }

  /** 로그인한 본인의 월별 기록. */
  function exportMyRecords(memberName: string, rows: ProfileExportRow[]): number {
    const body: CsvValue[][] = rows.map((r) => [
      r.year_month,
      r.course_name,
      r.std_hc,
      r.app_hc,
      r.next_hc,
      r.attended ? r.score : null,
      r.attended ? r.net_score : null,
      r.result_group,
      r.result_rank,
    ]);

    return download(
      `타만라자_${safeName(memberName)}_기록.csv`,
      PROFILE_HEADERS,
      body,
      `${memberName} 님의`
    );
  }

  return { exportYearlyRecords, exportYearlyRanking, exportMyRecords };
}
