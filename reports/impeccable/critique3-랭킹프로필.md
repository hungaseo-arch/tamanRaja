# Impeccable critique3: 랭킹·프로필·참석

- 대상 : YearlyRanking.vue, MyProfile.vue, AttendancePanel.vue
- 방식 : 소스 판독, 브라우저 실측 없음. 서브에이전트 작성본을 메인이 저장
- 휴리스틱 점수 : 31/40 (Good)
- 건수 : P0 0 / P1 0 / P2 9 (신규 3, 잔존 6) / P3 10 (신규 5, 잔존 5)

## P2

| ID | 구분 | 파일:라인 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| A1 | 잔존 | YearlyRanking.vue:332-338, 408, 596 | 공동 순위가 눈으로 안 보임. "공동"은 aria와 모바일 상세 창에만 있음 | clarify | 아니오 |
| A2 | 신규 | YearlyRanking.vue:402-404, lib/rank.ts:33 | podiumCardClass 가 정렬 인덱스 기준이라 공동 1위 3명이면 3번째 카드가 동메달 색인데 라벨은 🥇 | harden | rank.ts (인덱스→등수 매핑만) |
| A3 | 신규 | MyProfile.vue:359-384 | 모바일 월별 표에서 불참·일정 없음·미래 달이 모두 "-"로 같아 참석 여부를 표에서 못 읽음 | clarify | 아니오 |
| A4 | 잔존 | YearlyRanking.vue:582-613 | 기준 미달 줄이 전체 muted 라 Net 부호·평균 스코어 의미색 소실 | colorize | 아니오 |
| A5 | 잔존 | MyProfile.vue:236,243 vs YearlyRanking.vue:376,384 | 같은 툴바가 프로필은 모바일 44px, 랭킹은 xs 32px. 의도 확정 필요 | adapt | Button/Select xs |
| A6 | 잔존 | YearlyRanking.vue:588,600, MyProfile.vue:340 | 행 머리글(th scope=row) 없음 | harden | Table 계열 |
| A7 | 잔존 | YearlyRanking.vue:502-562 | 비활성 정렬 아이콘 opacity-30, 12px | layout | 아니오 |
| A8 | 잔존 | rank.ts:21, MyProfile.vue:277-289, YearlyRanking.vue:668-680 | Medalist 색 화면 간 불일치, 보라 3종 의미 충돌 | colorize | rank.ts, index.css |
| A9 | 잔존 | MyProfile.vue:254-292 | 통계 카드 5칸 같은 위계, 3열이라 3+2 끊김 | layout | 아니오 |

## P3

| ID | 구분 | 파일:라인 | 문제 | 추천 명령 |
|---|---|---|---|---|
| B1 | 신규 | MyProfile.vue:389 | 평균 행 라벨이 sticky 아님 | adapt |
| B2 | 신규 | MyProfile.vue:366-368,442 / YearlyRanking.vue:148 | Net 0 이 "+0" 양수 색·semibold | typeset |
| B3 | 신규 | AttendancePanel.vue:124,129-137 | "당월 핸디" 라벨인데 값은 직전 달 next_hc, 주석과 불일치 | clarify |
| B4 | 신규 | AttendancePanel.vue:124 | role=radio 안 sr-only "선택됨"이 aria-checked 와 중복 낭독 | harden |
| B5 | 신규 | AttendancePanel.vue:146 | "응답 전 · 하나 선택 필요" 안내가 선택지와 떨어짐 | layout |
| B6 | 잔존 | YearlyRanking.vue:402 vs 356,584 | 카드 상위 4명 vs 표 강조 rank<=4, 공동 4위 시 어긋남 | harden |
| B7 | 잔존 | YearlyRanking.vue:421,428 | 모바일 지표 라벨 12px | typeset |
| B8 | 잔존 | MyProfile.vue:436-444 | 상세 창 값 없으면 빈 칸(랭킹은 "-") | clarify |
| B9 | 잔존 | YearlyRanking.vue:336,344 | 🏅 grayscale 필터 렌더 차이 | polish |
| B10 | 잔존 | YearlyRanking.vue:492-565,82 | 정렬 버튼 4벌 복붙, 내부 번호 주석 | distill |

## 권장 순서

1. A1+A2 공동 순위 표기와 포디움 색 매핑
2. A3 프로필 불참·예정 표기
3. A5 툴바 규격 확정 후 통일
4. A4·A8 색 정리 (공유 토큰, 월간 영향 확인)
5. A6 행 머리글 (Table 공유)
