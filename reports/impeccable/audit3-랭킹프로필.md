# Impeccable audit 3차: 랭킹·프로필·참석

- 대상: src/pages/YearlyRanking.vue, src/pages/MyProfile.vue, src/components/AttendancePanel.vue, src/lib/rank.ts(표시 색)
- 기준: 현재 작업트리(브랜치 main, d16d3dc. 대상 4파일은 미수정 상태). 이전 보고서 reaudit-랭킹프로필.md 대비 신규·잔존만 기재
- 방식: 소스 판독 + `impeccable detect`(정규식 4파일, 위반 0건. 요소 규칙 미실행이라 과소 집계). 375px 렌더·터치 실측 없음. 대비는 토큰 값 기반 계산 추정
- 제외(확정 결정): Button/Select xs 32px·13px, 한도 빨강, 본문 14px, 삭제 안내문구 복원, 모바일 Input·Select 16px
- 이번 회차에서 해결 확인: 세션 만료 가드, 동순위 계산, null Net, 모바일 포디움 지표 라벨, 모바일 핸디 상세 진입. 재기재 안 함

## 점수

| 차원 | 점수(0-4) | 핵심 |
|---|---|---|
| 접근성 | 3 | 행 머리글 부재, 비활성 정렬 아이콘 대비, Host 배지 대비 추정 |
| 성능 | 4 | 문제 없음 |
| 테마 | 3 | rank.ts만 토큰 밖 팔레트·그라데이션·그림자. 나머지는 토큰 사용 |
| 반응형 | 3 | 375px 가로 폭 근접(미실측), 프로필 툴바 규격이 랭킹과 다름 |
| 구현 무결성 | 3 | 포디움 색이 순위가 아닌 인덱스 기준, 클라이언트·서버 평균 어긋남 가능 |
| **합계** | **16/20 (Good)** | 이전 17에서 -1: 이번에 새로 찾은 동순위 카드색 불일치·불참 구분 불가 반영 |

파일별 점수(0-20): YearlyRanking.vue 15 / MyProfile.vue 16 / AttendancePanel.vue 18 / rank.ts 13

## 건수

| P0 | P1 | P2 | P3 |
|---|---|---|---|
| **0** | **0** | **11** (잔존 7, 신규 4) | **8** (잔존 6, 신규 2) |

## 구현 무결성 판정

통과. 순위·결측·세션·표시 규칙이 한 곳에서 정해지고 화면·CSV가 같은 규칙을 씀. 결함은 rank.ts 색 체계와 포디움 색 매핑에 집중됨.

## 대비 재계산(이전 "AA 경계, 실측 필요" 항목 정리)

- `--net-minus`(0.553 .195 38.4)는 Tailwind orange-700 값과 같음. 흰 바탕 약 5.2:1, 통과
- `--net-plus`(0.546 .245 262.9)는 blue-600 값. 약 5.2:1, 통과
- `--avg-score`(0.558 .288 302.3)는 purple-600 계열. 약 6:1, 통과
- `text-yellow-700`(Winner 숫자)은 약 4.9:1, 통과
- `bg-primary/5` 행 틴트 위에서도 4.5 이상 유지 추정
- 결론: 이전 P2 "Net 마이너스·평균 스코어 대비" 항목 종결. 단 실제 렌더 측정은 미실시

## 상세 항목

### P2

| ID | 구분 | 파일:라인 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| A1 | 잔존(알려진) | src/lib/rank.ts:19-31 | 시상 배지·포디움이 Tailwind 원색 팔레트(yellow·gray·violet·amber·slate)와 그라데이션, RankBadge의 `shadow-md`(RankBadge.vue:25)로 구성됨. index.css:14-17이 "화면에 원색을 직접 쓰지 말 것"이라 한 규칙과 DESIGN.md의 "그라데이션·과한 그림자 금지"에 어긋남. Host 보라가 평균 스코어(`--avg-score`)·기준핸디(`--std-accent`) 보라와 겹쳐 md 이상 표에서 한 행에 보라 두 뜻이 공존함(YearlyRanking.vue:610-626) | /impeccable colorize | 예(rank.ts, RankBadge, 월간 표·나의 기록) |
| A2 | 잔존(알려진) | src/lib/rank.ts:21, YearlyRanking.vue:668-680, MyProfile.vue:283 | Medalist 숫자색이 `text-muted-foreground`라 "0회"와 "3회"가 같은 색. 랭킹 상세는 0회를 muted로 구분하나 프로필 통계 카드는 구분 안 함. 한도·인상 빨강 정리(알려진 건)와 함께 의미색 정리 대상 | /impeccable colorize | 예(rank.ts) |
| A3 | 신규 | src/lib/rank.ts:33-35, YearlyRanking.vue:404 | `podiumCardClass(idx)`가 순위가 아닌 정렬 인덱스를 받음. 공동 1위 둘이면 이모지는 🥇🥇인데 카드 색은 금·은으로 갈림. 공동 3위(🥉🥉)도 동·쇠로 갈림. 같은 순위가 다른 등급처럼 보임 | /impeccable harden | 예(rank.ts) |
| A4 | 신규(추정) | src/lib/rank.ts:22 | Host 배지 `text-white`가 그라데이션 시작 violet-500(#8b5cf6) 위에 놓임. 흰 글자 대비 약 4.2:1로 4.5 미만, 글자는 12px 배지(YearlyRanking.vue:441). 렌더 실측 필요 | /impeccable colorize | 예(rank.ts, RankBadge) |
| A5 | 잔존 | YearlyRanking.vue:600, MyProfile.vue:340 | 행 머리글이 `td`라 낭독기에서 값이 어느 회원·몇 월 줄인지 연결되지 않음(열 머리글 `scope="col"`은 있음) | /impeccable harden | 예(TableCell/Table 계열) |
| A6 | 잔존 | YearlyRanking.vue:502, 522, 542, 562 | 비활성 정렬 아이콘 `opacity-30` 12px. 비텍스트 대비 3:1 미달 가능성이 높고, 활성 열 머리글 바탕 차이도 없어 "눌러서 정렬"이 약하게 보임. 정렬 상태는 `aria-sort`로 전달됨 | /impeccable polish | 아니오 |
| A7 | 잔존 | YearlyRanking.vue:583, 606, 613 | 기준 미달 줄 전체가 `text-muted-foreground`이고 Net·평균 스코어 색 약속(파랑/주황/보라)도 함께 해제됨. 같은 지표가 줄마다 다른 색 규칙을 따름. 작은 글자에 muted 대비 여유가 적음 | /impeccable quieter | 아니오 |
| A8 | 신규 | MyProfile.vue:323-326, 359-374, 376-384 | 표에서 "불참한 달"과 "모임 자체가 없던 달"이 구분되지 않음. 두 경우 모두 스코어·Net이 '-', 결과 칸이 빔. 골프장 열은 모바일에서 숨어 단서도 없음. 참석 여부는 상세 창(:426-429)에서만 보임 | /impeccable clarify | 아니오 |
| A9 | 잔존 | MyProfile.vue:162-181 vs YearlyRanking.vue:93-99 | 프로필 평균 Net·스코어는 클라이언트 재계산, 랭킹은 서버 집계(스코어 0 초과 기준). 기준이 다르면 같은 회원의 평균이 두 화면에서 다를 수 있음 | /impeccable harden | 예(집계 기준은 data 계층) |
| A10 | 잔존·재정의 | MyProfile.vue:236, 243 vs YearlyRanking.vue:376, 385 | 같은 툴바가 프로필은 모바일 44px(`h-11`)·데스크톱 28px(`sm:h-7`), 랭킹은 xs 규격 32px. xs 32px 결정은 위반 지적 대상이 아니나, 두 화면이 서로 다른 규격이라 이동 시 툴바 크기가 바뀜. 어느 쪽이 의도인지 확정 필요. 데스크톱 28px은 2.5.8 최소 24px은 충족 | /impeccable adapt | 예(Button/Select xs와 프로필 오버라이드) |
| A11 | 잔존 | MyProfile.vue:254-292 | 통계 카드 5칸이 같은 크기·같은 위계. 모바일 3열이라 3+2로 끝줄 한 칸이 비고, 참석 횟수와 평균 Net(핵심 지표)이 시상 횟수와 같은 비중으로 읽힘 | /impeccable layout | 아니오 |

### P3

| ID | 구분 | 파일:라인 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| B1 | 잔존 | YearlyRanking.vue:402 vs 584, 356 | 포디움 카드는 `slice(0,4)`(최대 4명)인데 표 강조는 `rank <= 4`. 공동 4위가 둘 이상이면 표에서만 강조되는 회원이 생김 | /impeccable harden | 아니오 |
| B2 | 잔존 | YearlyRanking.vue:421, 428, 439-441 | 모바일 지표 라벨·배지 12px(`text-xs`). 본문 14px 기준과 거리. 카드 내부 보조 라벨이라 낮은 등급 | /impeccable typeset | 아니오 |
| B3 | 잔존 | YearlyRanking.vue:336, 343-345 | 4위 이모지(🏅)를 CSS 필터로 탈색. 플랫폼별 이모지 렌더 차이로 결과가 달라질 수 있음 | /impeccable polish | 아니오 |
| B4 | 잔존 | YearlyRanking.vue:492-565 | 정렬 열 머리글 마크업 4회 복붙 | /impeccable distill | 아니오 |
| B5 | 잔존 | YearlyRanking.vue:82, MyProfile.vue:48·79·301, rank.ts:44 | "(P1-3)", "(P1-1)", "(4-1)", "(3-3)", "(5-6)" 등 내부 작업 번호 주석. 의미 없는 흔적 | /impeccable polish | 아니오 |
| B6 | 신규 | AttendancePanel.vue:124 | `aria-checked`가 있는데 sr-only "선택됨"을 또 넣어 낭독기가 선택 상태를 두 번 읽음 | /impeccable harden | 아니오 |
| B7 | 신규 | AttendancePanel.vue:64 | 주석 "기준핸디 / 차월 핸디 표시"가 실제 라벨(:136 "당월 핸디")과 어긋남. 직전 달 차월 핸디 = 이번 달 당월 핸디이므로 값은 맞고 주석만 낡음 | /impeccable polish | 아니오 |

(P3 8번째 항목: 이전 보고서의 프로필 DetailItem 빈 칸 표기 불일치 MyProfile.vue:436-444는 B군과 같은 등급 잔존. 스코어·Net이 값 없으면 빈 칸, 랭킹 상세는 '-'. /impeccable clarify, 공유: DetailItem. P3 합계 B1~B7 + 이 항목 = 8건.)

## 패턴·구조 이슈

- 시상 색 체계가 rank.ts 한 곳에 모여 있으나 토큰 체계 밖(원색·그라데이션). 월간·랭킹·프로필 3화면 공유라 수정 시 한 번에 영향
- 표 행 머리글 부재가 두 화면에서 반복(Table 공유 컴포넌트에서 처리 가능)
- 화면 간 같은 요소(툴바, 빈 값 표기, 통계 위계)의 규격 불일치

## 잘 된 점

- AttendancePanel: 라디오 그룹 키보드 이동, 64px 이상 터치 영역, 색+체크 아이콘+라벨 병행(색만으로 전달 안 함), 미응답 시 저장 차단과 사유 문구, 저장 중 중복 전송 차단
- 순위 계산이 비교 함수 기반이라 안정적이고 정렬·표시·CSV가 같은 결측 규칙을 씀
- 정렬 버튼이 실제 `button`이며 `aria-sort`, 모바일 `min-h-11` 제공
- 순위 없음 표기에 `aria-hidden` + sr-only 병행, 이모지에 `role="img"`+공동 순위 aria-label
- 프로필 세션 가드가 반응형이고 모바일 행 상세 창 진입 경로 확보

## 권장 순서

1. A3·A4·A1·A2 (rank.ts 묶음: 동순위 카드색 매핑, Host 대비, 팔레트 토큰화, Medalist 0회 색) → /impeccable harden, colorize. 월간·RankBadge 영향 확인
2. A8 불참/모임 없음 구분 → /impeccable clarify
3. A10 툴바 규격 확정 → /impeccable adapt
4. A5 행 머리글, A9 평균 집계 기준 → /impeccable harden
5. A6·A7·A11 → polish, quieter, layout
6. 375px 실측(가로 폭 근접, Host 배지 대비 측정)
7. 마무리: /impeccable polish
