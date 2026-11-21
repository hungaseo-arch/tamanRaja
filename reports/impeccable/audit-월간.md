# Impeccable Audit: 월간 (Monthly)

대상: src/pages/Monthly.vue, src/components/MonthlyTable.vue, src/components/AttendancePanel.vue
날짜: 2026-11-20 / 모드: Operate / 방식: 코드 정독 + `impeccable detect`(어드바이저리 2건). 렌더 확인(375px 에뮬레이션)은 하지 않음 — 읽기 전용 진단.
제외(알려진 의도): 툴바 32px·13px, 표 본문 14px, 표 안 11px 라벨, 읽기 모드 열 숨김(상세 창 대체), 편집 모드 모바일 표 가로 스크롤(3-3).

## 점수: 15 / 20 (Good)

| # | 차원 | 점수 | 핵심 |
|---|------|------|------|
| 1 | 접근성 | 3 | 라디오·aria-sort·alert 정돈. 편집 select 가 chevron 없음, 오류 연결 약함 |
| 2 | 성능 | 3 | 20명 규모라 문제 없음. 편집 시 deep watch + JSON 스냅샷 반복은 가벼움 |
| 3 | 테마 | 3 | 토큰 일관. `text-white` 1건, 13px 도움말 본문 |
| 4 | 반응형 | 3 | 입력 44px(모바일) 확보. 편집 모드 모바일에서 sticky 머리글·저장 버튼 소실 |
| 5 | 구현 무결성 | 3 | 의도가 주석에 남아 있음. 이름 비교 권한 노출, 문자열 비교 분기 |
| **합계** | | **15/20** | P0 0건 · P1 0건 · P2 6건 · P3 4건 |

## 구현 무결성 판정: 통과
토큰(`net-plus`, `net-minus`, `warning-*`, `group-first`)만 쓰고 시상 색은 RankBadge 로 위임. 숫자 칸 `font-mono` 일관. 색만으로 뜻을 전하지 않음(부호·라벨·체크 아이콘 병행). detector 는 13px 어드바이저리 2건만 보고(둘 다 도움말 다이얼로그, 라인 974·992).

## 요약
- P0 0, P1 0, P2 6, P3 4
- 상위 이슈: (1) 편집 모드 모바일 레이아웃 상실 (2) 시상 select 어포던스 없음 (3) 도움말 본문 13px (4) 참석 미응답/미정 혼동 가능 (5) 권한 노출이 이름 비교

## 상세 (P등급 / 파일:라인 / 문제 / 추천 명령 / 공유 자원 여부)

### P2-1 편집 모드 모바일: sticky 머리글 소실 + 저장 버튼이 스크롤 위로 사라짐
- 위치: MonthlyTable.vue:405 (`tableScrolls`), :733-737, 툴바 :587-694
- 문제: 표가 스스로 가로 스크롤하면(overflow-x:auto) 세로 sticky 기준이 그 상자가 되어 열 제목이 고정되지 않을 수 있음(DESIGN.md "표 안 세로 스크롤 금지"의 반대 증상). 툴바는 sticky 가 아니라 20여 행 입력 후 저장하려면 맨 위로 되돌아가야 함. 렌더로 검증 필요.
- 영향: 관리자 월말 입력 흐름(Operate 핵심)에서 열 제목 상실, 위로 스크롤 반복.
- 추천: `/impeccable adapt` (편집 모드 모바일 하단 고정 저장 줄 또는 sticky 툴바 검토)
- 공유 자원: 아니오(Table.vue 의 `scroll` prop 동작은 공유 컴포넌트이므로 수정 시 확인 필요)

### P2-2 시상 select 에 chevron 없음 (`appearance-none`)
- 위치: MonthlyTable.vue:871 (결과 그룹, md 이상만 노출), :892 (결과/시상, 전 폭 노출)
- 문제: 네이티브 화살표를 지우고 대체 아이콘이 없어 눌러서 고르는 칸이 텍스트 상자처럼 보임. 중장년 관리자에게 어포던스 부족.
- 영향: 입력 칸 인지 저하. 터치 목표는 모바일 h-11 로 충분.
- 추천: `/impeccable polish` (chevron 배경 아이콘 또는 공유 Select 컴포넌트 재사용)
- 공유 자원: 부분(공유 `ui/Select.vue` 재사용이 가장 쉬움)

### P2-3 핸디 규칙 다이얼로그 본문 13px
- 위치: MonthlyTable.vue:974, :992 (detector 확인)
- 문제: 읽기용 긴 본문이 DESIGN.md 의 14px 기준·타입 램프 밖. 툴바 13px 예외와 달리 이 줄은 규정 설명문이라 예외 목록에 없음. 설명문이 핵심 콘텐츠(산정 근거).
- 영향: 중장년 가독성.
- 추천: `/impeccable typeset` (text-sm 로 올리거나 DESIGN.md 예외에 기록)
- 공유 자원: 아니오(DESIGN.md 예외 추가를 택하면 문서 수정)

### P2-4 참석 "미응답"과 "미정"의 구분이 패널에서 사라짐
- 위치: AttendancePanel.vue:37, :41-45, :116-121 / MonthlyTable.vue:430-437
- 문제: 표는 미응답(undefined)과 미정(null)을 구분해 보이지만, 패널은 `currentAttended` null 을 곧바로 "미정" 선택 상태(경고색)로 렌더. 미응답인 회원이 이미 "미정"으로 답한 것처럼 보임. 호출부 값 전달을 확인 필요.
- 영향: 참석 확인 정확도(핵심 성공 기준).
- 추천: `/impeccable clarify` (미응답은 아무것도 선택 안 된 상태로)
- 공유 자원: 아니오

### P2-5 관리 권한 화면 노출 판정이 이름 문자열 비교
- 위치: Monthly.vue:211-212 (`hostMember?.name === currentMember.value.name`)
- 문제: id 가 아닌 이름 비교라 동명이인이면 잘못 노출. 서버 RLS(`can_manage_month`)가 최종 차단하므로 화면 노출 문제에 한정. `parseInt` 기수 인자 없음(:134, :201).
- 영향: 권한 없는 회원에게 편집 UI 노출 가능(쓰기는 차단됨).
- 추천: `/impeccable harden`
- 공유 자원: 아니오

### P2-6 편집 모드 모바일에서 결과 그룹·차월 핸디 열이 편집 중에도 숨음
- 위치: MonthlyTable.vue:743, 747, 750, 807, 866
- 문제: 자동 계산 결과(조·차월 핸디)를 저장 전에 확인·보정할 수 없음. 저장 확인창(:286-303)도 Winner/Medalist/Host 만 요약하고 조·차월 핸디는 빠짐. 설계 4번 원칙(저장 전 확인)과 어긋날 여지. (읽기 모드의 열 숨김은 의도라 제외.)
- 영향: 폰으로 입력하는 관리자가 잘못된 자동 계산을 못 봄.
- 추천: `/impeccable adapt`
- 공유 자원: 아니오

### P3-1 입력 높이가 한 줄 안에서 혼재
- 위치: MonthlyTable.vue:595, 615 (`h-11 sm:h-8`) vs Select/Button xs(`h-8`)
- 문제: 모바일 툴바에서 날짜·신규 골프장 입력은 44px, 옆 select·버튼은 32px. DESIGN.md "화면마다 h-7/h-8 덮어쓰기 금지"와도 어긋남. (32px 자체는 의도라 제외, 혼재만 지적.)
- 추천: `/impeccable layout` / 공유 자원: 아니오

### P3-2 확인 창 분기를 라벨 문자열로 판정
- 위치: MonthlyTable.vue:1040 (`confirmDlg.okLabel === '입력 폐기'`)
- 문제: 문구를 바꾸면 destructive 스타일이 조용히 사라짐. `variant` 를 askConfirm 인자로 받는 편이 안전.
- 추천: `/impeccable harden` / 공유 자원: 아니오

### P3-3 `text-white` 직접 사용, 중복 주석, 오류 연결 약함
- 위치: MonthlyTable.vue:880, 908, 953 (`bg-group-first text-white`) / :548-553 (표제 주석 중복) / :699-709 (검증 오류는 role 로 알리나 입력 `aria-describedby` 연결 없음)
- 문제: 토큰 단일 출처 규칙상 `text-white` 도 토큰(예: primary-foreground 계열)이 낫다. 대비는 통과(파랑 .546 위 흰색 약 5:1).
- 추천: `/impeccable polish` / 공유 자원: 부분(Badge 변형으로 흡수 시 `ui/Badge.vue`)

### P3-4 제출 버튼 `aria-live`
- 위치: AttendancePanel.vue:141
- 문제: 버튼 자체에 `aria-live="polite"` 는 라벨 변경("저장 중...")을 읽게 하려는 의도이나 효과가 스크린리더별로 불균일. 결과 알림은 바깥 토스트가 맡음.
- 추천: `/impeccable audit` 재검(실기기 확인) / 공유 자원: 아니오

## 패턴·시스템 이슈
- 공유 자원이 걸린 항목: P2-2(Select), P3-3(Badge), P2-1(Table.vue `scroll`). 토큰·전역 CSS·config 변경은 필요 없음.
- 반복 패턴: 모바일 편집 모드의 정보 숨김(P2-1, P2-6). 읽기 모드의 숨김은 상세 창이 보완하지만 편집 모드는 보완 수단이 없음.

## 긍정 요소
- 저장하지 않은 입력 보호(달 이동 확인·beforeunload·취소 확인)가 3겹으로 정돈됨.
- 입력 오류: `aria-invalid`, 범위 검증(-20~60), 저장 전 요약 확인, 핸디 없는 회원 시 저장 잠금.
- 참석 라디오: roving tabindex, 방향키, 체크 아이콘+sr-only 로 색 비의존.
- 표 `caption`, h1 단일, `sr-only` 라벨, 아이콘 버튼의 `aria-label`.
- 의미색이 토큰으로만 쓰이고 Net 은 부호 병행. 숫자 `font-mono`.
- 날짜·직전 달 계산에서 12월→1월 경계 처리 주석과 코드가 정확.
- 모바일 편집 입력은 `h-11`, `inputmode=numeric`, 스피너 없음.

## 권장 순서
1. [P2] `/impeccable adapt`: 편집 모드 모바일 sticky 머리글·저장 접근, 조·차월 핸디 확인 수단 (P2-1, P2-6)
2. [P2] `/impeccable clarify`: 미응답/미정 구분 (P2-4)
3. [P2] `/impeccable typeset`: 도움말 13px 처리 (P2-3)
4. [P2] `/impeccable harden`: 권한 판정을 id 기준으로, 확인창 variant 인자화 (P2-5, P3-2)
5. [P2/P3] `/impeccable layout`: 입력 높이 혼재 정리 (P3-1)
6. 마무리 `/impeccable polish`: select chevron, `text-white` 토큰화, 주석 정리 (P2-2, P3-3)

수정 후 `/impeccable audit` 재실행 권장. 렌더 검증(375px, 터치 제스처)은 이번에 수행하지 않았음.
