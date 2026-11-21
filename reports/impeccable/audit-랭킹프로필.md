# Impeccable Audit: 랭킹·프로필

대상: src/pages/YearlyRanking.vue, src/pages/MyProfile.vue, src/components/MemberHandicapTrend.vue
모드: Operate (모바일 375px, 중장년). 읽기 전용 진단, 소스 수정 없음. 렌더 확인(375px 실측·터치 시험)은 하지 않았고 코드 판독과 detector 결과만 근거임.
제외(의도된 사항): 추이 그래프의 표 없는 선 그래프·빈 점, 그래프 글자 9px/8.5px, 삭제된 안내 문구.

## 점수: 15/20 (Good, 약한 차원 보강 필요)

| # | 차원 | 점수 | 핵심 |
|---|------|------|------|
| 1 | 접근성 | 3 | 정렬 버튼·aria-sort·dialog 처리 양호. 이름 없는 span aria-label, 행 헤더 없음 |
| 2 | 성능 | 4 | 계산 가벼움. 추이 재조회·경합만 경미 |
| 3 | 테마 | 3 | 토큰 사용 양호. 보라 계열 3종 의미 충돌, 포디움 원색 팔레트 |
| 4 | 반응형 | 2 | 모바일에서 핸디 열 숨김 + 상세 진입 조건 때문에 일부 월 핸디 열람 불가, 툴바 32px |
| 5 | 구현 무결성 | 3 | 동점 순위·null Net 표시 불일치, 중복 마크업, 낡은 주석 |
| **합계** | | **15/20** | |

P0: 0건 / P1: 2건 / P2: 8건 / P3: 4건

## 구현 무결성 판정
통과(조건부). 토큰(net-plus/net-minus/avg-score)과 rank.ts 단일 출처, 정렬 버튼 시맨틱, 서버 집계 + 캐시 구조가 일관됨. detector 검출은 MemberHandicapTrend.vue:118-119의 글자 크기 2건(advisory)뿐이며 의도된 사항이라 제외. 감점은 아래 P1-2(동점 순위)와 마크업 중복.

## P1 (2건)

### [P1] 동점·결측 지표가 서로 다른 순위로 매겨짐
- 위치: src/pages/YearlyRanking.vue:144-165 (byRankingRule, rankByMember), 주석 :143
- 분류: 구현 무결성
- 문제: 주석은 "둘 다 없으면 동순위"라 하나 rankByMember가 정렬 인덱스 i+1을 그대로 부여해 동률도 1,2위로 갈림. 기준 지표 동률 후 보조 지표까지 같으면 임의 순서(정렬 안정성)로 순위가 정해짐. 이 순위가 포디움(상위 4명)과 CSV에 그대로 나감.
- 영향: 회원이 순위를 신뢰하는 앱의 핵심 수치. 동률 시 한 명이 억울하게 밀림.
- 추천 명령: /impeccable harden (동순위 표기 "공동 N위" 규칙 확정은 /impeccable clarify)
- 공유 자원: 아니오 (페이지 내부). CSV 내보내기(useRecordExport)는 영향받음.

### [P1] 모바일에서 월별 핸디 열람 경로가 불완전함
- 위치: src/pages/MyProfile.vue:310-313, 342-344 (sm 미만 숨김), :330-336 (`v-if="row.course_name"` 일 때만 상세 열림), hasRecord :142
- 분류: 반응형 / 접근성
- 문제: 375px에서는 기준·당월·차월 핸디 열이 숨고, 상세 창은 골프장이 있는 달에만 열림. 모임은 없지만 핸디만 있는 달(예: 차월 핸디가 먼저 확정된 달)은 모바일에서 핸디 값을 볼 방법이 없음. 핸디 확인은 제품의 1순위 목적(PRODUCT.md).
- 영향: 주 사용자(스마트폰)가 자기 핸디를 못 보는 경우 발생.
- 추천 명령: /impeccable adapt (조건을 course_name OR std_hc/next_hc 로 확장, 또는 모바일에서 차월 핸디 열 노출)
- 공유 자원: 부분적. RowDetailButton/RowDetailDialog는 공유이나 수정 대상은 이 페이지의 조건식.

## P2 (8건)

### [P2] aria-label을 쓴 일반 span (이름 부여 불가)
- 위치: YearlyRanking.vue:569 `<span aria-label="순위 없음">-</span>`
- 문제: role 없는 span의 aria-label은 낭독기가 무시함. "-"만 읽힘.
- 추천: /impeccable harden (sr-only 텍스트 "순위 없음" 또는 role="img")
- 공유 자원: 아니오

### [P2] 순위·회원/월 칸이 행 머리글(th scope=row)이 아님
- 위치: YearlyRanking.vue:560-574, MyProfile.vue:327-337
- 문제: 낭독기에서 숫자 셀이 어느 회원·월의 값인지 연결되지 않음 (Table 공유 컴포넌트가 th 셀을 지원해야 함).
- 추천: /impeccable harden
- 공유 자원: 예 (TableCell/Table 컴포넌트). 두 페이지 및 월간 표에 동시 영향.

### [P2] 툴바 컨트롤 모바일 높이 32px (프로젝트 기준 44px 미달)
- 위치: YearlyRanking.vue:336-359, MyProfile.vue:217-237 (Select/Button size="xs")
- 문제: 높이 h-8, CSV 버튼은 모바일에서 아이콘만이라 약 30x32px. WCAG 2.5.8(24px)은 통과하나 PRODUCT.md 원칙(44px, 중장년)과 DESIGN.md 툴바 규격(32px)이 충돌함.
- 추천: /impeccable adapt (기준 확정은 /impeccable document)
- 공유 자원: 예 (Button.vue:23, Select size xs)

### [P2] Net 마이너스(주황)·평균 스코어(보라) 글자 대비가 AA 경계
- 위치: YearlyRanking.vue:386-401, 578-594; MyProfile.vue:253-257, 353-357; index.css --net-minus(0.553), --avg-score(0.558)
- 문제: 흰 배경에서 약 4.6:1, bg-primary/5 행·옅은 포디움 배경 위에서 4.5 전후. 14px 일반 굵기는 대형 글자 예외 없음. 실측 필요.
- 추천: /impeccable colorize (토큰 명도 소폭 하향)
- 공유 자원: 예 (index.css 토큰)

### [P2] 보라 계열 3종이 서로 다른 뜻으로 공존
- 위치: index.css --avg-score(hue 302), --std-accent(hue 292), rank.ts:25 Host text-violet-600
- 문제: md 이상 연간 랭킹 한 행에 평균 스코어(보라)와 Host(보라)가 나란히 보임. DESIGN.md의 "열 색 약속·시상 색 한 곳" 원칙과 충돌.
- 추천: /impeccable colorize
- 공유 자원: 예 (index.css, rank.ts)

### [P2] 모바일 포디움 카드의 수치에 라벨이 없음
- 위치: YearlyRanking.vue:384-401 (라벨 `hidden sm:inline`)
- 문제: 375px에서 이름 아래 숫자만 보여 어떤 지표인지가 색과 소수 자릿수로만 구분됨. 삭제된 안내 문구 문제가 아니라 카드 자체의 라벨 부재를 지적함.
- 추천: /impeccable clarify (예: 값 앞에 "스코어"/"Net" 짧은 라벨 또는 단위)
- 공유 자원: 아니오

### [P2] 평균 Net 소수 자릿수 불일치
- 위치: MyProfile.vue:254, 160(toFixed(1)) vs YearlyRanking.vue:399, 585(toFixed(2))
- 문제: 같은 "평균 Net"이 화면마다 +0.5 / +0.52로 보임. 또 나의 기록 평균은 클라이언트 재계산, 랭킹은 서버 값이라 값 자체가 어긋날 수 있음.
- 추천: /impeccable clarify (자릿수 표기 규칙 통일) + /impeccable harden
- 공유 자원: 부분적 (lib/format에 공용 포맷 함수 추가 가능)

### [P2] 세션 만료 시 나의 기록이 빈 화면
- 위치: MyProfile.vue:35-37 (비반응형 가드), :208 `v-if="currentMember"` 에 else 없음
- 문제: 유휴 자동 로그아웃(PRODUCT.md) 후 currentMember가 null이 되면 페이지가 공백. 가드는 setup 시점 1회만 실행됨.
- 추천: /impeccable harden
- 공유 자원: 아니오 (라우터 가드로 올리면 공유)

### [P2] 추이 조회 오류 문구가 원문 그대로 노출됨, 경합 처리 없음
- 위치: MemberHandicapTrend.vue:39-42, 53 (watch 재호출)
- 문제: supabase 오류 메시지를 사용자에게 그대로 보임(한국어 아님). memberId 연속 변경 시 늦게 온 응답이 덮어쓸 수 있음.
- 추천: /impeccable harden
- 공유 자원: 아니오

(추가 판정: avg_net_score는 data/index.ts:519에서 Number(null)=0 이 되어 기록 없는 회원도 "+0.00"으로 표시될 수 있음. P2에 준해 /impeccable harden 때 함께 확인.)

## P3 (4건)

- [P3] 정렬 버튼 4벌 복붙 (YearlyRanking.vue:451-538). 정렬 헤더 컴포넌트로 추출. /impeccable extract. 공유 자원: 신규 공유 후보.
- [P3] 포디움 테두리/바탕이 원색 팔레트(yellow-400, amber-700, slate 등) (rank.ts:34-39). DESIGN.md 토큰 규칙과 거리. /impeccable colorize. 공유 자원: 예 (rank.ts).
- [P3] 낡은 주석: YearlyRanking.vue:362-377, 662-663이 존재하지 않는 "위 안내 줄"을 가리킴, "(P2-1)" 중복. /impeccable document. 공유 자원: 아니오.
- [P3] 통계 카드 375px에서 3열x2행, 마지막 줄 2칸 + 빈 칸 (MyProfile.vue:241). /impeccable layout. 공유 자원: 아니오.
- (DESIGN.md 드리프트) 표 글자 0.75rem 서술 대 실제 text-sm, 툴바 14px 서술 대 Button xs 13px. /impeccable document. 공유 자원: 예 (DESIGN.md).

## 체계적 이슈
1. 접근성 시맨틱: 행 머리글 부재는 공유 Table 레벨에서 한 번에 해결 가능.
2. 색 토큰: 보라 3종과 rank.ts 원색이 DESIGN.md "의미색 한 곳" 원칙에서 벗어남.
3. 모바일 열 숨김 전략: 숨긴 값에 도달하는 경로(상세 창)의 조건이 페이지마다 다름.

## 잘 된 점
- 정렬은 button + aria-sort, 모바일 min-h-11 확보, 포커스 링 유지.
- 확정 전 핸디를 빈 점 + aria-label "(확정 전)"으로 시각·낭독 양쪽에 전달.
- 상세 창은 compact에서만 열고 화면 확대 시 자동으로 닫음.
- sticky 열의 hover 틴트 처리, null 값을 0으로 채우지 않는 주의(미정/-).
- 서버 집계 + 연도별 캐시, 의미색 토큰 사용, 부호 병기(색만으로 전달하지 않음).

## 권장 순서
1. [P1] /impeccable harden: 동점 순위, 세션 만료, null Net 표시
2. [P1] /impeccable adapt: 모바일 핸디 열람 경로
3. [P2] /impeccable colorize: 대비·보라 의미 정리 (공유 토큰이므로 월간 화면 영향 확인)
4. [P2] /impeccable clarify: 포디움 라벨, Net 자릿수
5. [P2] /impeccable harden + adapt: Table 행 머리글, 툴바 44px (공유 컴포넌트)
6. [P3] /impeccable extract, document
7. 마무리 /impeccable polish
