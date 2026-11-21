# Impeccable 재감사: 랭킹·프로필

대상: src/pages/YearlyRanking.vue, src/pages/MyProfile.vue, src/components/MemberHandicapTrend.vue(26년 상·하반기 점 분리 신규), src/data/index.ts(연간 랭킹 부분), src/lib/rank.ts
브랜치: fix/impeccable-fixes (HEAD c7d732e). 이전 진단: audit-랭킹프로필.md, critique-랭킹프로필.md
방식: 소스 판독 + `impeccable detect`(정규식 스캔 4파일, 위반 0건, advisory 2건은 MemberHandicapTrend 그래프 9px/8.5px로 의도된 사항). 375px 렌더 실측·터치 시험 없음. 대비·넘침 항목은 추정이며 실측 전 확정 아님. 코드 수정 없음.
제외(확정 결정): Button/Select xs 32px·13px(랭킹 툴바 32px 포함), 한도 빨강, 본문 14px, rank.ts 포디움 색(보류), 추이 그래프 9px/8.5px·표 없는 선 그래프·빈 점.

## 점수 (이전 → 현재)

| 구분 | 이전 | 현재 | 변화 근거 |
|---|---|---|---|
| audit (20점) | 15 | **17** | 반응형 2→3(모바일 핸디 상세 조건 확장), 구현 무결성 3→4(공동 순위·null Net·세션 만료·추이 오류·경합 처리). 접근성 3(행 머리글 잔존), 성능 4, 테마 3 유지 |
| critique (40점) | 28 | **30** | 인식>회상 2→3(모바일 포디움 라벨), 도움말 2→3(공동 순위 문구). 나머지 유지. 일관성은 신규 툴바 불일치로 3 유지 |

### audit 차원별
| 차원 | 이전 | 현재 |
|---|---|---|
| 접근성 | 3 | 3 |
| 성능 | 4 | 4 |
| 테마 | 3 | 3 |
| 반응형 | 2 | 3 |
| 구현 무결성 | 3 | 4 |

## 건수

| 등급 | 이전 audit | 이전 critique | 현재 (잔여+신규) |
|---|---|---|---|
| P0 | 0 | 0 | **0** |
| P1 | 2 | 2 | **0** |
| P2 | 8 | 7 | **11** (잔여 8, 신규 3) |
| P3 | 4(+드리프트 1) | 5 | **8** (잔여 6, 신규 2) |

## 이전 P1 해결 판정

| 이전 P1 | 판정 | 근거 |
|---|---|---|
| audit P1-1 동점·결측 지표가 다른 순위로 매겨짐 | **해결** | YearlyRanking.vue:158-171 `byRankingRule`이 동률이면 0 반환, :177-192 `rankInfo`가 동순위에 같은 등수 부여(1,1,3), 주석과 동작 일치. 값 없는 회원은 :166-167에서 항상 뒤. 잔여: 시각 표기는 P2-신규 N1 |
| audit P1-2 모바일 월별 핸디 열람 경로 불완전 | **해결** | MyProfile.vue:149-151 `hasDetail`이 course_name 또는 std/app/next 핸디 중 하나라도 있으면 상세 창 허용, :343-348에서 사용 |
| critique R1 툴바 모바일 32px | **확정 결정으로 종결** | xs 32px·13px 확정(Button.vue:23, Select.vue:48). 랭킹은 32px 유지(YearlyRanking.vue:376, 385). 신규 불일치는 N2 |
| critique R2 모바일 포디움 카드 지표 라벨 없음 | **해결** | YearlyRanking.vue:421, 428 모바일에 "스코어"/"Net" 라벨을 숫자 윗줄에 표시. 기준 지표가 위에 오고 진하게 표시(:131-135, :418). 잔여: 라벨 12px(P3) |

## 이전 P2·P3 판정

| 이전 항목 | 판정 | 근거·위치 |
|---|---|---|
| aria-label span(순위 없음) | 해결 | YearlyRanking.vue:597 aria-hidden "-" + sr-only "순위 없음" |
| 행 머리글(th scope=row) 부재 | **잔여 P2** | YearlyRanking.vue:588, 600 / MyProfile.vue:340 모두 TableCell. 공유: Table 계열 |
| 툴바 44px 충돌 | 종결(결정) | 위 R1 참조 |
| Net 마이너스·평균 스코어 대비 AA 경계 | **잔여 P2(실측 필요)** | index.css:90 `--net-minus` 0.553, :98 `--avg-score` 0.558 변동 없음. 공유 토큰 |
| 보라 3종 의미 충돌 | **잔여 P2** | index.css:93, :98 / rank.ts:22 Host `text-violet-600`. 평균 스코어 열과 Host 열이 md 이상에서 한 행에 공존 |
| 모바일 포디움 라벨 | 해결 | 위 R2 |
| 평균 Net 자릿수 불일치 | 해결(부분) | MyProfile.vue:179 소수 둘째 자리 통일, :267. 잔여: 클라이언트 재계산 vs 서버 값(N3 아님, 아래 잔여 P2-6) |
| 세션 만료 시 빈 화면 | 해결 | MyProfile.vue:37-43 `watch(isLoggedIn)` 반응형 가드, :456-459 else 문구 |
| 추이 오류 원문 노출·경합 | 해결 | MemberHandicapTrend.vue:28-29 `loadSeq`, :70 한국어 고정 문구, :146 재시도 연결 |
| avg_net_score null→0 | 해결 | data/index.ts:519-520 NaN 센티널, YearlyRanking.vue:139-153 `finiteOrNull`/`formatNet`/`netColorClass`, csv.ts:10 NaN을 빈 칸 처리 |
| R3 정렬=기준 변경 숨은 결합 | 부분 해결 | YearlyRanking.vue:686-690 문구에 "기준이 같으면 공동 순위" 추가, 규칙은 여전히 표 아래 한 줄. 잔여 P3 |
| R4 비활성 정렬 아이콘 약함 | **잔여 P2** | YearlyRanking.vue:502, 522, 542, 562 `opacity-30` 12px. 활성 열 헤더 배경 차이 없음 |
| R5 375px 가로 넘침 | 미확인 | 소스 추정으로 순위 56 + 회원 + 평균 Net + 평균 스코어 헤더 합이 카드 안쪽 폭에 근접. 실측 필요 |
| R6 Medalist 약한 색·0회 구분 | **잔여 P2** | rank.ts:21 Medalist `text-muted-foreground`. MyProfile.vue:277-289는 0회도 같은 색, YearlyRanking.vue:668-680 상세는 0회 muted로 화면 간 불일치 |
| R7 통계 카드 위계 없음 | **잔여 P2** | MyProfile.vue:254-292 5칸 동일 크기 |
| R8 모바일 핸디 숨김 | 해결(경로 확보) | 상세 창 조건 확장. 표 자체는 여전히 핸디 열 숨김 |
| R9 기준 미달 줄 전체 muted | **잔여 P2** | YearlyRanking.vue:583, 606, 613 |
| R10 --net-minus 대비 | 위 대비 항목에 병합 | |
| R11 4위 이모지 필터 | 잔여 P3 | YearlyRanking.vue:336, 344 |
| R12 프로필 제목 줄바꿈 | 해결 | MyProfile.vue:222 `flex-wrap` |
| R13 빈 값 표기 불일치 | 부분 잔여 P3 | MyProfile.vue:436-444 스코어·NET이 값 없으면 빈 칸(DetailItem). 랭킹 상세는 '-'로 정리됨(YearlyRanking.vue:665) |
| R14 null Net 렌더 오류 | 해결 | 위 avg_net_score |
| 정렬 버튼 복붙 | 잔여 P3 | YearlyRanking.vue:492-565 |
| 낡은 주석 | 대부분 해결 | 잔여: YearlyRanking.vue:82 "(P1-3)" 식 내부 번호 주석 |
| 통계 카드 3열×2행 | 잔여 P3 | MyProfile.vue:254 |
| 포디움 원색 팔레트 | **보류 항목** | rank.ts:26-31 |

## 남은·신규 P0·P1 상세

**P0: 0건, P1: 0건.** 이전 P1 4건은 해결 또는 확정 결정으로 종결. 신규 P1급 결함은 소스 판독 범위에서 발견하지 못함(실측 전제).

## 신규·주목 P2

| ID | 파일:줄 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|
| N1 | YearlyRanking.vue:332-338, 408, 596 | 공동 순위가 화면에 드러나지 않음. 낭독기용 aria("공동 N위", :198-200)와 하단 문구 한 줄뿐이고, 동률이면 눈으로는 "5위, 5위" 또는 같은 메달 이모지만 보임. 동률 회원이 오류로 오해할 수 있음 | /impeccable clarify | 아니오 |
| N2 | MyProfile.vue:236, 243 vs YearlyRanking.vue:376, 385 | 같은 구조의 툴바 규격이 두 페이지에서 다름. 프로필은 모바일 44px(`h-11`)·데스크톱 28px(`sm:h-7`), 랭킹은 xs 기본(모바일 32px). 확정된 xs 32px 결정과도 어긋남. 어느 쪽이 의도인지 확정 필요 | /impeccable adapt (규격 확정 후 한쪽으로 통일) | 예(Button/Select xs와 프로필 오버라이드) |
| N3 | MemberHandicapTrend.vue:20-21, 60-66, 90 | 상·하반기 분리가 2026에 하드코딩. 2027 이후 같은 재산정이 있으면 코드 수정이 필요함. 월별 기준핸디 조회 실패는 사용자에게 알리지 않고 단일 점으로 조용히 폴백(주석상 의도이나 값이 달라 보임). 상·하반기 두 점이 2026 한 연도 안에서 어떻게 정해졌는지 화면에 설명 없음 | /impeccable harden | 아니오 |

## 신규·주목 P3

- data/index.ts:520 + lib/index.ts:104: 평균 Net 결측을 NaN으로 표현하나 타입은 `number`. 소비처가 `Number.isFinite`를 잊으면 NaN이 새 나감(현재 YearlyRanking·csv.ts는 처리). `number | null`로 모델링 권장. /impeccable harden. 공유: lib 타입
- YearlyRanking.vue:402 vs :584: 포디움 카드는 상위 4명(`slice(0,4)`)인데 표 강조는 `rank <= 4`. 공동 4위가 둘 이상이면 표에서만 강조되는 회원이 생김. /impeccable harden
- YearlyRanking.vue:421, 428: 모바일 라벨 `text-xs`(12px). 최근 커밋의 12px 정리 범위로 보이나 PRODUCT.md 14px 기준과는 거리. 결정 확인 필요

## 잔여 P2 요약 (이전 → 유지)
1. 행 머리글 부재(Table 공유)
2. 의미색 대비 AA 경계(index.css 토큰, 실측 필요)
3. 보라 3종 의미 충돌(index.css, rank.ts)
4. 비활성 정렬 아이콘 약함
5. Medalist/0회 색 규칙 화면 간 불일치(rank.ts)
6. 평균 Net 프로필 클라이언트 재계산 vs 랭킹 서버 값 어긋남 가능(MyProfile.vue:162-181, 서버는 score>0 기준 YearlyRanking.vue:93-99)
7. 통계 카드 위계 없음
8. 기준 미달 줄 muted/색 체계 이탈

## 잘 된 점(신규 확인)
- 동순위 계산이 정렬 인덱스가 아닌 비교 함수 기반이라 안정적(YearlyRanking.vue:177-192).
- `finiteOrNull` 한 곳으로 정렬·순위·표시·CSV가 같은 결측 규칙을 씀.
- 추이 컴포넌트가 요청 순번으로 늦은 응답을 버리고, 보조 조회(월별) 실패가 주 조회를 막지 않음.
- 프로필 세션 가드가 반응형이 되어 유휴 로그아웃에도 안전함.

## 권장 순서
1. N2 툴바 규격 확정(결정 후 adapt)
2. N1 공동 순위 시각 표기(clarify)
3. 대비·보라 정리(colorize, 공유 토큰이므로 월간 영향 확인) + 375px 실측으로 R5와 대비 확정
4. Table 행 머리글(공유 컴포넌트, harden)
5. N3 상·하반기 하드코딩 제거(harden)
