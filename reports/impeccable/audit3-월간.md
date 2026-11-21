# 3차 감사(audit) : 월간 기록 (2026-11-21)
대상 : src/components/MonthlyTable.vue, src/pages/Monthly.vue (테스트 *.static.test.ts 는 참고만)
방식 : 소스 판독 + git diff(미커밋 MonthlyTable.vue 10줄 추가/12줄 삭제 포함, 작업트리 기준). 렌더 실측 없음. 코드 수정 없음
detect : .vue 정규식 모드만 실행, 월간 지적 없음(요소 규칙 미실행이라 과소 집계)
제외(확정) : Button/Select xs 32px·13px, 한도 빨강, 본문 14px, 삭제 안내문구 복원, 모바일 Input·Select 16px
이전 : reaudit2-월간.md (audit 18/20, P0 0 / P1 0). 해결된 항목은 반복하지 않음

## 점수 (audit, 0-20)
| # | 차원 | 점수 | 핵심 |
|---|---|---|---|
| 1 | 접근성 | 3 | 상태 문구 role 동적 부여, span aria-label (P3) |
| 2 | 성능 | 4 | 문제 없음 (행 40 내외, 키 입력마다 재계산 가벼움) |
| 3 | 테마 | 3 | text-white 3곳, 나머지 토큰 사용 |
| 4 | 반응형 | 2 | 편집 원시 입력 14px(iOS 확대), 숫자 자판에 마이너스 없음 |
| 5 | 구현 일관성 | 3 | 공유 Input/Select 를 우회한 원시 컨트롤 7곳 |
| 합계 | | 15/20 | Good (이전 18 에서 하락. 확정 결정 16px 이 원시 컨트롤에 미적용된 것이 원인) |

## 건수
- P0 0 / P1 2 / P2 6 / P3 5

## 구현 일관성 판정
부분 통과. 토큰·RankBadge·Table 계열 사용, 의미색 일관. 단 편집 모드 컨트롤이 공유 Input/Select(`text-base sm:text-sm`, Input.vue:70, Select.vue:47-48)를 쓰지 않고 `text-sm` 원시 요소로 따로 그려 확정 결정(모바일 16px)과 어긋남.

## P1

### P1-1 편집 모드 원시 입력·셀렉트가 모바일 14px (iOS 포커스 확대)
- 위치 : MonthlyTable.vue:672(날짜), :692(새 골프장명), :947(스코어), :990(결과조 select), :1014(시상 select), :1227(수정 사유 textarea)
- 문제 : 전부 `text-sm`(14px). 확정 결정은 모바일 Input·Select 16px. iOS Safari 는 16px 미만 입력 포커스 시 화면을 확대해 sticky 열·저장 줄 위치가 틀어지고, 스코어 칸을 줄마다 누르는 핵심 입력 흐름에서 반복됨. 같은 화면의 연·월·골프장 Select 만 16px 라 칸마다 글자 크기가 다름
- 추천 : /impeccable adapt (원시 요소에 `text-base sm:text-sm`, 가능하면 공유 Input/Select 로 교체. 표 안 칸은 sm:h-7 유지)
- 공유 자원 : 아님(Monthly 전용). 단 교체 시 Input.vue·Select.vue 의 표 내부용 변형(compact)이 필요하면 공유 파일 변경 발생
- 점수 영향 : 반응형 -1, 일관성 -1

### P1-2 스코어 칸 `inputmode="numeric"` 은 iOS 자판에 마이너스가 없음
- 위치 : MonthlyTable.vue:937-941 (허용 범위는 SCORE_MIN=-20, :292-293, pattern `-?[0-9]*`)
- 문제 : iPhone 숫자 자판(numeric)에는 `-` 키가 없어 음수 오버파를 입력할 수 없음. 검증은 -20 까지 허용하는데 입력 수단이 없음. 관리자가 iPhone 이면 해당 회원 기록을 모바일로 못 넣음(PC 로 우회). 실제 기기 미검증, 음수 발생 빈도는 낮음(근거: 허용 범위에 음수 포함)
- 추천 : /impeccable harden (음수 입력 수단 확보: 부호 토글 버튼, 또는 inputmode 해제. 선택은 실기기 확인 후)
- 공유 자원 : 아님
- 점수 영향 : 반응형 -1

## P2

### P2-1 저장 실패 상태가 편집 종료·월 이동 후에도 남음 (이전 N2-1 잔존)
- 위치 : MonthlyTable.vue:424-432 (cancelEdit), :1060 (하단 줄 오류 문구), Monthly.vue:252-258
- 문제 : saveState 가 다음 저장 시작 때만 초기화됨. 실패 → 취소 → 재진입하면 새로 시드한 화면에 빨간 "…입력 내용 유지." 가 다시 뜸
- 추천 : /impeccable harden (진입·취소·월 변경 시 오류 초기화 이벤트)
- 공유 자원 : 아님

### P2-2 저장 후 재조회 실패가 화면에서 묻힘 (신규)
- 위치 : Monthly.vue:297-298, 302-305 / 공유 src/data/index.ts:125-146
- 문제 : `loadData()` 는 실패해도 throw 하지 않고 dataError 만 설정, 동시 호출이면 즉시 반환. 저장은 성공했으므로 "저장 완료" 토스트와 함께 편집이 닫히지만, 표는 저장 전 값으로 남을 수 있음. 회원이 틀린 순위를 보게 됨
- 추천 : /impeccable harden (재조회 실패 시 이 화면에 "저장은 됐으나 새로고침 필요" 안내와 재시도)
- 공유 자원 : 예 (`loadData`, dataError 사용처 전체)

### P2-3 핸디 규칙·CSV 가 모든 폭에서 아이콘만 (미커밋 변경으로 신규)
- 위치 : MonthlyTable.vue:758-779 (CSV, CircleHelp), 주석 :716-718
- 문제 : 글자 없이 아이콘만 남음. title 은 터치에서 보이지 않고 aria-label 만 있어 눈으로는 뜻을 알 수 없음. 중장년 사용자 기준 발견성 저하. 핸디 규칙은 차월 핸디 열이 숨는 모바일에서 유일한 설명 진입점. 가장 필요한 곳에서 가장 약한 표시
- 추천 : /impeccable clarify (최소한 도움말만 "규칙" 같은 짧은 글자 병기 또는 sm 미만에서만 아이콘 유지 검토)
- 공유 자원 : Button xs 크기는 확정 결정이므로 변경 금지

### P2-4 잠금 해제 "수정" 이 일반 "수정" 과 구분 안 됨 (미커밋 변경으로 신규)
- 위치 : MonthlyTable.vue:719-728 (보이는 글자 "수정", aria-label "잠금 해제 후 수정")
- 문제 : 기한이 지난 달에서 눌러도 편집이 아니라 사유 입력 창이 열림. 시각상 단서 없음(이전에는 xl 에서 전체 문구). 보이는 글자가 이름에 포함돼 2.5.3 은 통과
- 추천 : /impeccable clarify (자물쇠 아이콘 병기 등. 안내문구 복원 금지 결정은 지킴)
- 공유 자원 : 아님

### P2-5 보조 줄 12px 가 PRODUCT 원칙(본문 14px 이상)과 다름 (미커밋 변경으로 신규)
- 위치 : MonthlyTable.vue:895 (`text-xs sm:text-sm`), 비교 :1028 (같은 표의 결과 아래 조 표기는 text-sm)
- 문제 : 모바일 읽기 모드의 당월·차월 핸디는 보조가 아니라 핵심 수치. 12px mono + muted 색은 중장년에게 작음. 같은 표 안에서 보조 줄 크기가 12px·14px 로 갈림. 320px 폭 압박 해소가 목적이므로 실측 후 판단 필요
- 추천 : /impeccable adapt (375px 는 14px 유지, 320px 이하에서만 축소 검토) 또는 /impeccable typeset
- 공유 자원 : 아님

### P2-6 수동 지정 오탐 (이전 N2-4 잔존)
- 위치 : MonthlyTable.vue:254-267
- 문제 : 저장된 조·시상이 현재 계산과 다르면 전부 수동 지정으로 승격. 규칙 개정 전 저장분·서버/클라이언트 계산 차이도 "직접 지정"으로 요약(:370-373)에 올라감
- 추천 : /impeccable clarify (진입 시 승격 건수 안내)
- 공유 자원 : computeResults(`@/lib/rank`) 사용처

## P3
- P3-1 보조 줄 `aria-label` 이 role 없는 span 에 붙어 낭독기가 무시하기 쉬움, 안쪽 `sm:hidden` 중복 (MonthlyTable.vue:898-901). 추천 : /impeccable polish. 공유 : 아님
- P3-2 미응답·미참석 행에도 "차월 -" 가 전 행 반복되는 소음 (MonthlyTable.vue:901, 이전 N2-3 잔존). 추천 : /impeccable distill. 공유 : 아님
- P3-3 하단 줄 오류에 `role="alert"` 를 문구와 동시에 동적 부여, 일부 낭독기는 놓칠 수 있음 (MonthlyTable.vue:1054-1058). 항상 live region 으로 두고 내용만 교체 권장. 추천 : /impeccable harden. 공유 : 아님
- P3-4 미커밋 변경 정리 잔여 : 빈 공백 줄 `</Button>` 정렬 (MonthlyTable.vue:767, 779), 낡은 주석 "가운데에 놓는다(mx-auto)"(:639-641)·"글자가 숨겨져 아이콘만"(:755-757), Monthly.vue:321-344 들여쓰기. 추천 : /impeccable polish. 공유 : 아님
- P3-5 `text-white` 하드코딩 3곳 (MonthlyTable.vue:1001, 1032, 1115). 배경이 group-first 토큰이라 대비는 통과, 전경 토큰화만 남음. 추천 : /impeccable colorize. 공유 : 의미색 토큰(index.css)은 값 변경 금지

## 해결 확인 (반복 안 함)
- "NET 스코어" 용어 : 머리글이 "Net" 으로 정리됨 (:853)
- 요약 우측 정렬(:642-646), 320px 셀 여백 축소(:821, :837) : 구조 문제 없음. 실측은 아래 미검증 참조

## 패턴·체계 이슈
- 공유 컴포넌트 우회 : 표 안·툴바 편집 컨트롤이 Input/Select 를 거치지 않아 모바일 16px 같은 결정이 따로 반영돼야 함(P1-1). 이 영역 점검 때마다 재발할 구조
- 미커밋 변경이 "폭 확보를 위한 정보 축소"(아이콘화·12px)로 모임. 의도는 맞으나 중장년·발견성 원칙과 균형 필요(P2-3, P2-4, P2-5)

## 잘 된 점
- 저장 전 요약 확인, 입력 폐기 확인, 월 이동 보호, beforeunload 경고(Monthly.vue:41-85)
- 점수 범위 검증과 저장 버튼 잠금, 하단 고정 저장 줄, 모바일 터치 h-11
- Net 음수·양수 부호 병행, 참석 상태를 글자로 표기해 색 의존 없음
- 표 caption, scope=col, sticky 회원 열의 틴트 재현

## 미검증
- 375px·320px 렌더 실측(sticky 열 폭, 보조 줄 줄바꿈, 편집 모드 가로 스크롤), 실기기 터치·iOS 자판 동작, 대비 실측

## 권장 순서
1. [P1] /impeccable adapt : 원시 컨트롤 16px (P1-1), 보조 줄 폭 (P2-5)
2. [P1] /impeccable harden : 음수 입력 수단 (P1-2), 오류 상태 초기화 (P2-1), 재조회 실패 안내 (P2-2)
3. [P2] /impeccable clarify : 아이콘 버튼·잠금 해제 표시 (P2-3, P2-4), 수동 지정 안내 (P2-6)
4. [P3] /impeccable distill, /impeccable colorize
5. 마지막 /impeccable polish
