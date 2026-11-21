# Impeccable critique: 랭킹·프로필

Method: ⚠️ DEGRADED: single-context (위임받은 읽기 전용 실행이라 A/B 하위 에이전트 분리 없음. 소스 정독 + `impeccable detect` 소스 스캔만 수행, 브라우저 실측 없음)

대상: `src/pages/YearlyRanking.vue`, `src/pages/MyProfile.vue`, `src/components/MemberHandicapTrend.vue`
모드: Operate (모바일 375px, 중장년)
제외(의도된 사항): 추이 그래프의 표 없음·빈 점, 그래프 글자 9px/8.5px, 삭제된 안내 문구

## 휴리스틱 점수: 28/40 (Good, 70%)

| # | 휴리스틱 | 점수 | 핵심 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | AsyncState로 로딩·오류·빈 상태 통일. 랭킹 기준 전환 상태는 모바일 카드에 안 드러남 |
| 2 | 현실 세계와의 일치 | 3 | 모임 용어 일관. Net·Medalist 영문 용어는 그대로 노출 |
| 3 | 사용자 통제 | 3 | 연도 전환·정렬·상세 창 닫기 양호 |
| 4 | 일관성 | 3 | 두 페이지 툴바·표 구조 동일. 시상 색 의미는 카드마다 다르게 쓰임 |
| 5 | 오류 예방 | 3 | 읽기 전용 화면, 위험 동작 없음 |
| 6 | 인식 > 회상 | 2 | 모바일 카드 숫자에 라벨 없음, 정렬이 곧 기준 변경이라는 규칙은 기억해야 함 |
| 7 | 유연성·효율 | 3 | CSV, 정렬, 줄 상세. 모바일에서 참석·핸디 정렬 불가 |
| 8 | 미니멀 디자인 | 3 | 군더더기 적음. 시상 3종이 통계 카드 5칸 중 3칸을 차지 |
| 9 | 오류 복구 | 3 | 재시도 버튼 제공 |
| 10 | 도움말 | 2 | 순위 규칙은 표 아래 작은 한 줄에만 있음 |

탐지기 결과: 소스 스캔 2건(advisory), 모두 MemberHandicapTrend.vue:118-119의 9px·8.5px. 의도된 사항이라 무시. 나머지 위반 없음.

## 총평

숫자 중심의 정돈된 표이고 두 페이지의 구조가 같아 학습 비용이 낮음. 가장 큰 약점은 (1) 모바일 터치 영역, (2) 상위 4명 카드에서 숫자가 무엇인지 말해 주지 않는 점, (3) 의미색(시상·Net·평균 스코어)이 카드와 표에서 서로 다른 강도로 쓰이는 점.

## 잘 된 점

- 순위 열·회원 열 sticky 고정, 정렬 버튼화, aria-sort, 표 caption에 기준·대상 명시 (YearlyRanking.vue:439, 447-538).
- 기준 미달 회원을 숨기지 않고 구분선 아래 남김 (YearlyRanking.vue:547-550). 정직한 정보 구조.
- 줄 상세 디스클로저가 점선 밑줄·min-h-11로 눌림 신호와 터치 영역을 갖춤 (RowDetailButton).

## 우선순위 항목

| ID | 등급 | 파일:라인 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| R1 | P1 | YearlyRanking.vue:349-359, 336-343 / MyProfile.vue:217-237 | 상단 툴바의 연도 Select와 CSV 버튼이 모바일 h-8(32px), 글자 13px. 제품 원칙(터치 44px·본문 14px)과 중장년 사용자 기준에 미달. 모바일에서 CSV는 아이콘만 남음 | `/impeccable adapt` | 예. `ui/Button.vue:23`, `ui/Select.vue:48`의 `xs` 규격이 월간 기록 등 다른 툴바에도 영향 |
| R2 | P1 | YearlyRanking.vue:384-401 | 모바일 상위 4명 카드는 지표 라벨(`hidden sm:inline`)을 숨겨 숫자 하나만 보임. "80.5"인지 "+2.31"인지 형식으로만 구분됨. 지금 무엇으로 순위를 매겼는지 카드·표 어디서도 짧게 말해 주지 않음(표 캡션은 낭독기 전용) | `/impeccable clarify` | 아니오 (페이지 한정) |
| R3 | P2 | YearlyRanking.vue:664-668, 182 | 정렬을 누르면 순위 기준이 바뀌는 숨은 결합(평균 Net·평균 스코어 헤더)과 "참석·핸디 정렬은 순위 무관" 규칙이 표 아래 작은 muted 한 줄에만 있음. 참석 정렬 시 순위 열이 뒤섞여 보임 | `/impeccable clarify` | 아니오 |
| R4 | P2 | YearlyRanking.vue:468, 490, 512, 534 | 비활성 정렬 아이콘이 12px·opacity-30. 누를 수 있다는 신호가 약하고 정렬 상태가 아이콘 하나에만 의존. 활성 열 헤더 자체의 시각 차이 없음 | `/impeccable polish` | 아니오 (표 헤더 패턴은 MonthlyTable과 공통일 수 있어 확인 필요) |
| R5 | P2 | YearlyRanking.vue:436-540 | 375px에서 순위(56)+회원+평균 Net+평균 스코어 헤더(nowrap+아이콘)가 카드 안 가로 폭을 넘길 가능성. 실측 없음. 넘치면 점수 열이 화면 밖으로 밀림 | `/impeccable adapt` (실측 후) | 예. `Table.vue` 공통 |
| R6 | P2 | MyProfile.vue:263-277, rank.ts:20-22 | Medalist 수치가 `text-muted-foreground`라 5칸 통계 카드 중 가장 약하게 보임. 0회여도 Winner·Host는 색이 그대로라 0과 1 이상이 구분되지 않음. 시상 의미색을 카드·표·상세가 제각각 적용(YearlyRanking.vue:645-657은 0회면 muted) | `/impeccable colorize` | 예. `lib/rank.ts` RANK_STYLE.text |
| R7 | P2 | MyProfile.vue:241-279 | 통계 카드 5칸이 모두 같은 크기·같은 위계. 모바일은 3열×2줄로 시상 3칸이 같은 비중. 이 사용자의 첫 질문(내 기록·핸디)에 맞는 한 칸 강조가 없음 | `/impeccable layout` | 아니오 |
| R8 | P2 | MyProfile.vue:296-372, 346-361 | 모바일 표는 월·스코어·NET·결과만 남고 기준·당월·차월 핸디가 숨음. 핸디는 이 앱의 핵심 숫자인데 월을 눌러 창을 열어야만 보임. 눌림 가능 여부는 점선 밑줄 하나뿐이고 기록 없는 달은 눌러도 반응 없음(의도됨) | `/impeccable adapt` | 아니오 |
| R9 | P2 | YearlyRanking.vue:553-558, 548 | 기준 미달 줄은 전체가 muted. 숫자 대비가 약해지고(48% 명도), 평균 Net은 색 없이 부호만 남아 표 안에서 다른 열과 의미색 체계가 달라짐 | `/impeccable polish` | 아니오 |
| R10 | P3 | index.css:90 (--net-minus) | 주황 oklch(0.553 0.195 38.4)가 흰 바탕에서 4.5:1 근처. 실측 필요. 음수는 부호 병행이라 색 단독 전달은 아님 | `/impeccable audit` | 예. 의미색 토큰 |
| R11 | P3 | YearlyRanking.vue:298-310, 371-372 | 4위에 🏅 이모지를 필터로 회색 처리. 렌더링이 기기별 이모지 폰트에 의존하고 "메달=상위 3"이라는 상식과 어긋남. aria-label은 있음 | `/impeccable polish` | 아니오 |
| R12 | P3 | MyProfile.vue:208-211 | 제목 "나의 기록 — OOO 님"에서 이름이 text-sm muted. 긴 이름·좁은 폭에서 연도 Select·CSV와 한 줄에 몰려 줄바꿈 위험(flex-wrap 없음, YearlyRanking은 wrap 있음) | `/impeccable layout` | 아니오 |
| R13 | P3 | YearlyRanking.vue:575, 631-633 | 기준 핸디 없는 회원이 `-`, 상세 창의 평균 스코어는 값 없을 때 빈 칸(`DetailItem` 내부 비어 있음). 빈 값 표기가 화면마다 다름 | `/impeccable harden` | 예. `ui/DetailItem.vue`, `lib/format.ts` |
| R14 | P3 | YearlyRanking.vue:395, 585, 635 | 평균 Net·평균 스코어가 null일 수 있는 경우를 평균 스코어만 처리(avg_score는 null 분기, avg_net_score는 `.toFixed` 직접 호출). 서버가 null을 주면 렌더 오류 | `/impeccable harden` | 아니오 |

## 페르소나 점검

- 중장년 회원(PRODUCT.md 사용자): R1이 가장 직접적. 연도 Select·CSV가 32px라 오터치 가능. 카드 숫자 라벨 부재(R2)로 "내 점수가 좋은 건지" 맥락이 없음.
- Casey(모바일·한 손): 툴바가 화면 최상단에 있어 엄지가 닿기 어려움. 상세를 열려면 작은 점선 밑줄 이름을 눌러야 함.
- Sam(접근성): 색 대비 R10 점검 필요. 정렬 버튼·aria-sort·role=img는 양호. 줄 상세 단추 라벨도 있음.

## 고려할 질문

- 모바일에서 평균 Net과 평균 스코어 중 하나만 카드에 보인다면, 기준 이름을 카드 첫 줄에 한 번만 붙이면 충분하지 않은가.
- 통계 카드 5칸 중 시상 3칸을 한 줄 "Winner 1 · Medalist 0 · Host 2"로 묶으면 위계가 생기지 않는가.

## 영향 요약

- P0: 0건
- P1: 2건 (R1, R2)
- P2: 7건 (R3-R9)
- P3: 5건 (R10-R14)
- 공유 자원 관련: R1(Button/Select xs), R5(Table), R6(RANK_STYLE), R10(의미색 토큰), R13(DetailItem/format)
