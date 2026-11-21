# 용어 일괄 수정 후 독립 재감사

- 범위: src/pages/*.vue, src/components/*.vue, src/components/ui/*.vue 화면 노출 문구
- 방법: 용어군별 grep + 문맥 확인 + 데이터 경로 확인. 소스 수정 없음, 이전 보고서 미참조
- 테스트: .claude/worktrees 제외 시 16 파일 146건 통과

## 1. 등급별 건수

| 등급 | 건수 | 비고 |
|---|---|---|
| P0 | 0 | |
| P1 | 0 | |
| P2 | 5 | 용어 잔존 2, 어색한 문구 1, 테스트 2 |
| P3 | 9 | 띄어쓰기·표기 미세 불일치 |

판정: P0·P1 0건. 통과.

## 2. 잔존 불일치 (P2)

| # | 파일:줄 | 현재 문구 | 권장 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| 1 | src/pages/YearlyRanking.vue:463 | 경기 결과 저장 후 이 표에 순위 표시 | 모임 결과 저장 후 이 표에 순위 표시 | clarify | 아님 |
| 2 | src/pages/AdminMembers.vue:456, 816 | 경기 기록 N건 있음 / 경기 기록이 있는 회원은 | 모임 기록 | clarify | 아님 |
| 3 | src/components/MonthlyTable.vue:1051 | {저장 실패} 입력한 내용은 그대로 있습니다. | {저장 실패} · 입력한 내용 유지 (개조식, 문장 사이 구분) | clarify | 아님 |
| 4 | src/components/HandicapAdminStates.static.test.ts:36 | expect(admin).toContain('확인') | 임시 PIN 창 버튼을 특정하는 정규식 예: /@click="tempPinOpen = false">확인</ (AdminMembers.vue:849). '확인'은 파일에 다수라 항상 통과 | harden | 테스트 공유 |
| 5 | vitest 설정(프로젝트 루트) | .claude/worktrees 안 옛 복사본까지 수집, 18 파일 29건 실패 (예: '당월 {{ row.app_hc ?? '미정' }}' 옛 단언) | test.exclude 에 '.claude/**' 추가. 현재 npm test 결과가 실패로 보임 | harden | 설정 공유 |

## 3. 잔존 불일치 (P3)

| # | 파일:줄 | 현재 | 권장 | 비고 |
|---|---|---|---|---|
| 1 | src/components/MonthlyTable.vue:643 | 참석 예정 인원 | 참석 인원 (용어집). 미래월이라 '예정'이 뜻상 필요하면 유지 가능 | 판단 필요 |
| 2 | src/components/MonthlyTable.vue:358 | 미지정 시 폴백 '미정' (Winner·Medalist·Host 이름 자리) | '-' 또는 '미지정'. '미정'은 참석 응답 용어와 충돌 | 뜻 오독 소지 |
| 3 | src/components/MemberHandicapTrend.vue:129 | aria-label 의 '(안)' 접미 | '(안)'은 제목·부제에만. 'N년 제안' 또는 '안' 설명 분리 | |
| 4 | src/components/Layout.vue:41-43 | 메뉴 '27년 핸디' | 페이지 제목은 '27년 기준핸디 (안)'. 폭 때문에 5자 제한이면 '27년 기준' 검토 (주석에 폭 근거 있음) | 의도적, 판단 필요 |
| 5 | src/pages/MyProfile.vue:224 | 나의 기록 — {이름} 님 | '님'은 계정 인사만 허용. 제목에서는 '님' 제거 | LoginModal:160, Layout:153 은 계정 인사라 허용 |
| 6 | src/pages/MyProfile.vue:184 | `${n}월` 약식 | formatYearMonth 미사용. 표 첫 열이라 연도 배지가 옆에 있어 수용 가능 | 수용 가능 |
| 7 | 시상 횟수 표기 혼재: HandicapPolicy.vue:328 '시상 횟수', :329 '가중 시상횟수', HandicapResultsTable.vue:483·551 '시상횟수' | 한 가지로 통일 (예: 시상 횟수) | |
| 8 | 숫자·영문 뒤 조사 띄어쓰기: HandicapPolicy.vue:431/503 '1.50 · 1.75 로', :499 '+3.00 만', :665 '2.00 임.', MonthlyTable.vue:1136 'Par 를', :1142 'Net 이' | 붙여 쓰기 ('1.75로', '+3.00만', 'Par를', 'Net이') | |
| 9 | HandicapAdminStates.static.test.ts:34 describe/it 이름 '핸디캡 정보 없음' | '핸디 정보 없음' | 테스트 이름 |

## 4. 확인 결과 (잔존 없음)

- 구장·핸디캡·HC·NET·결과 그룹·운영진: 화면 노출 0건. 주석에만 '핸디캡', '구장별'
- ASCII '...': 화면 노출 0건. 진행 문구는 모두 '…' (Login, LoginModal, PinChangeForm, AdminMembers, AttendancePanel, AsyncState, MonthlyTable, HandicapResultsTable)
- 1등조·2등조·결과조: 일관 (MonthlyTable 열 제목 '결과조', MyProfile '결과' 열은 시상·조 병합 표시라 허용)
- 오류 문구: '~ 실패', '~ 필요' 형식 일관. AttendancePanel '참석하시나요'만 예외로 유지
- 관리자: 운영진 0건. 회원 등급 라벨 '회원/관리자' 일관
- 사용자 노출 연월: Monthly·AdminMembers·AttendancePanel·MonthlyTable 모두 formatYearMonth. 예외 MyProfile.vue:184
- 앱 이름: Login.vue:101, Layout.vue:112-115 모두 '따만라자 골프모임'
- 당월 핸디·차월 핸디·기준핸디: MonthlyTable, MyProfile, AttendancePanel 일관. '산정 전' 사용 (MonthlyTable:891-892, 913)

## 5. 375px 잘림 위험

| 대상 | 판정 | 근거 |
|---|---|---|
| Layout '따만라자 골프모임' | 안전 | text-base(16px) nowrap truncate, 주석 기준 약 130px + 계정 버튼 max-w-40. 이름이 길면 로고 쪽 말줄임 발생 가능 |
| 뱃지 '한도 적용'·'표본 부족' (HandicapResultsTable.vue:408-409) | 주의(P3 이내) | 이름 열 폭 80px 고정. 이름+뱃지 2개는 세 줄로 접힘. 의도된 줄바꿈이며 잘림은 없음. 뱃지 12px |
| 열 제목 '스코어(오버파)' (MyProfile.vue:327) | 안전 | 모바일 표시 열이 월·스코어·Net·결과 4개뿐 (골프장·핸디 3열은 sm 이상). nowrap이나 가로 스크롤 허용 |
| '참석 횟수' (YearlyRanking.vue:498, AdminMembers.vue:584) | 안전 | 두 곳 모두 sm 미만에서 열 숨김. MyProfile 통계 카드는 grid-cols-3 안 짧은 라벨 |
| '참석 여부' (MonthlyTable.vue:835) | 안전 | 미래월 편집 시에만 노출, 4자 |
| MonthlyTable 보조 줄 '당월 산정 전 · 차월 -' (:892) | 주의 | 이름 아래 한 줄. 이름이 길면 줄바꿈 가능 (잘림 아님) |

## 6. AttendancePanel '당월 핸디' = handicap.next_hc 판정

판정: 데이터상 맞음.

- AttendancePanel.vue:68-76: prevYM = 참석 대상월의 직전 달, resolveHandicap(member.id, prevYM) 호출
- src/data/index.ts:340-348: 직전 달 행의 next_hc 는 '다음 달 행의 app_hc 가 있으면 그 값, 없으면 저장된 next_hc'. 즉 직전 달 차월 핸디 = 대상월 당월 핸디
- 마이그레이션 20261021000700_p8_handicap_chain_from.sql:65, 82: `nm.app_hc = cm.next_hc` 와 `cm.next_hc = nm.app_hc` 체인으로 동일 규칙 보장
- 부수 확인 (P3):
  - 1월 대상이면 prevYM 이 전년 12월이라 같은 카드의 '기준핸디'가 전년 값. 새 해 기준핸디와 다를 수 있음
  - 직전 달 스코어 미입력 시 next_hc 가 null 이라 카드에 '-'. 표는 '산정 전'을 쓰므로 같은 문구 권장
  - 코드 주석 AttendancePanel.vue:64 에 '핸디캡' 잔존 (주석이라 범위 외)

## 7. 이전 대비

- 이전: 상 5 · 중 15 · 하 6 = 26건
- 추정 해소: 약 21건 (80%). 구장·HC·NET·그룹·운영진·ASCII 말줄임·오류 문구 형식·연월 표기·당월/차월 핸디 통일이 모두 해소
- 잔존 추정: 상 0 · 중 5 · 하 9 (아래 신규 포함)

## 8. 신규 문제

- P2-3 MonthlyTable.vue:1051 '저장 실패 입력한 내용은 그대로 있습니다.' 경어체 혼입, 앞 문구와 구분 없음
- P2-5 vitest 가 .claude/worktrees 를 수집해 전체 실행 시 29건 실패
- P2-4 확인 단계 테스트 약화 (요청에서 지적한 건, 개선 안 됨)
- P3-2 '미정' 폴백이 참석 응답 용어와 충돌
- P3-3 MemberHandicapTrend aria-label 에 '(안)'

## 9. 총평

- 핵심 용어 불일치는 정리됨. P0·P1 없음
- 후속 권장 순서: 테스트 보강(P2-4, P2-5), 문구 3곳(P2-1~3), P3 일괄 정리
