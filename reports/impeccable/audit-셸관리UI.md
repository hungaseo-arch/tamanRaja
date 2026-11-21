# Impeccable Audit: 셸·로그인·관리·UI

대상: App.vue, Layout.vue, LoginModal.vue, PinChangeForm.vue, Login.vue, NotFound.vue, AdminMembers.vue, AdminLogs.vue, components/ui/*.vue, index.css
모드: Operate / 375px 모바일 / 중장년 사용자. 소스 수정 없음, 정적 코드 감사(렌더 캡처 미실행).
제외한 의도 사항: Button/Select xs 모바일 32px·13px, 헤더 로고 홈 링크, 하단 탭 lg 미만.

## Audit Health Score: 13/20 (Acceptable)

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | 하단 탭 활성 상태가 색(채도)만으로 구분됨. 토스트 3초 소멸·닫기 버튼 극소 |
| 2 | Performance | 3 | 정적 번들 양호. 관리 화면 조회에 요청 경합 방어 없음 |
| 3 | Theming | 3 | 토큰 체계 충실. 하드코딩 소수, 미사용 토큰·유틸 잔존 |
| 4 | Responsive | 2 | 토스트가 375px에서 왼쪽 16px 잘림. 회원 관리 표 12px |
| 5 | Implementation Integrity | 3 | 감지기 0건. 로그인 폼 이중 구현, 표 글자 규약 위반 |
| **Total** | | **13/20** | **Acceptable** |

## Implementation Integrity Verdict
Pass. 초록 토큰(hue 145), 의미색 :root 단일 출처, 한국어 개조식 문구, 서버 판정 우선 설계가 PRODUCT.md·DESIGN.md와 일치함. `impeccable detect` 결과 안티패턴 0건, advisory 2건(Button.vue:23, Select.vue:48의 13px)은 의도된 xs 규격이라 제외. 정적 스캔은 element 규칙(대비·tiny-text)을 돌리지 못했으므로 대비 수치는 oklch 값 기준 추정.

## Executive Summary
- 점수 13/20 (Acceptable)
- 건수: P0 0 / P1 3 / P2 9 / P3 6
- 핵심 3건: (1) 토스트 375px 잘림(Toaster.vue:15), (2) 토스트 3초 자동 소멸이 오류에도 적용(useToast.ts:36), (3) 하단 탭 활성 표시가 색만(Layout.vue:183)
- 다음 단계: 공유 자원(Toaster, Layout 탭 바, index.css)부터 `adapt`/`polish`, 이어서 관리 화면 `harden`

## Detailed Findings

### P1

**[P1] 토스트가 375px 폭에서 왼쪽으로 16px 잘림**
- 위치: src/components/ui/Toaster.vue:15 (`right-4 ... w-full max-w-sm`)
- 분류: Responsive
- 영향: fixed 요소 폭이 뷰포트 100%(375px)인데 right 16px이라 왼쪽 끝이 화면 밖. 저장 실패 사유 같은 문장 첫 글자가 잘림.
- 기준: WCAG 1.4.10 Reflow 취지
- 추천: `left-4 right-4 sm:left-auto sm:max-w-sm` 식으로 양쪽 여백 지정. 컨테이너에 `pointer-events-none` 부여 후 토스트만 `pointer-events-auto`(이미 있음)
- 추천 명령: `/impeccable adapt`
- 공유 자원: 예 (컴포넌트, 전 화면 토스트 공통)

**[P1] 오류 토스트도 3초 후 사라지고 멈출 방법이 없음**
- 위치: src/composables/useToast.ts:36,58-61, src/components/ui/Toaster.vue (hover/focus 일시정지 없음)
- 분류: Accessibility
- 영향: 중장년 사용자가 `저장 실패` 사유를 읽기 전에 소멸. AdminMembers의 callRpc 실패(AdminMembers.vue:178-185)는 토스트만 사용. 
- 기준: WCAG 2.2.1 Timing Adjustable, 3.3.1
- 추천: destructive 기본 duration 0(수동 닫기) 또는 8초 이상, 호버·포커스 시 타이머 정지, destructive는 `role="alert"`(현재 컨테이너 전체가 polite 상태 영역)
- 추천 명령: `/impeccable harden`
- 공유 자원: 예 (useToast 기본값, Toaster)

**[P1] 하단 탭 활성 상태가 색만으로 구분됨**
- 위치: src/components/Layout.vue:183, 194-196 (활성 `text-primary`, 비활성 `text-muted-foreground`), 더보기 창 Layout.vue:215
- 분류: Accessibility
- 영향: primary(L0.52, C0.15)와 muted-foreground(L0.48, C0.015)는 명도가 거의 같고 채도만 다름. 회색조·색각 이상·야외 햇빛에서 현재 탭 식별 불가. PRODUCT.md "색만으로 의미 전달 안 함"과 충돌. aria-current는 있으나 시각 단서 없음.
- 기준: WCAG 1.4.1 Use of Color, 1.4.11
- 추천: 활성 탭에 상단 막대 또는 pill 배경, 굵기 증가(font-semibold), 아이콘 stroke 변화 중 하나 추가. lg 상단 nav는 배경 채움이라 정상.
- 추천 명령: `/impeccable polish`
- 공유 자원: 아니오 (Layout 한정, 단 모든 화면 노출)

### P2

**[P2] 회원 관리 표 글자가 모바일 12px**
- 위치: src/pages/AdminMembers.vue:550 (`text-xs sm:text-sm`), 654 안내문 `text-xs`
- 분류: Responsive / Implementation Integrity
- 영향: index.css 인수인계 메모 4번("표 글자 모바일 14px")과 PRODUCT.md 14px 기준 위반. AdminLogs는 `text-sm`으로 준수.
- 추천: `text-sm` 고정. 열 부족은 이미 숨김 열+상세 창으로 처리 중.
- 추천 명령: `/impeccable typeset`
- 공유 자원: 아니오

**[P2] 등급 변경이 확인 없이 즉시 실행**
- 위치: src/pages/AdminMembers.vue:248-271 (toggleRole), 605-614, 467-472
- 분류: Implementation Integrity (PRODUCT 원칙 4)
- 영향: 터치 오타로 관리자 권한 부여·회수. 휴면 복귀(313)는 되돌리기 쉬워 허용되나 권한 변경은 성격이 다름.
- 추천: 확인 창 또는 토스트 실행취소
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오

**[P2] 관리 화면 오류 문구가 스크린리더에 전달되지 않음, 입력 오류 연결 없음**
- 위치: src/pages/AdminMembers.vue:697, 720, 742, 764 (`<p v-if=... text-destructive>`), 669-688 Input에 ariaInvalid/ariaDescribedby 미사용
- 분류: Accessibility
- 영향: 회원 추가 실패 사유가 낭독되지 않음. 로그인·PIN 폼은 같은 목적에 Alert+aria-describedby를 이미 사용해 일관성도 깨짐. 색 외 아이콘도 없음.
- 기준: WCAG 3.3.1, 4.1.3
- 추천: 로그인 폼과 같은 Alert 패턴 재사용, `role="alert"`
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오

**[P2] DropdownMenu 항목 포커스 표시가 약하고 터치 높이 36px**
- 위치: src/components/ui/DropdownMenu.vue:132-135 (`focus:outline-none focus-visible:bg-accent`, `py-2 text-sm`)
- 분류: Accessibility / Responsive
- 영향: 전역 `:focus-visible` outline(index.css:212)이 `focus:outline-none`으로 꺼지고 bg-accent(L0.88)와 popover(L0.99) 대비 약 1.3:1이라 키보드 위치 식별 곤란. 모바일 관리 열의 유일한 진입이라 항목 높이 36px은 44px 기준 미달.
- 기준: WCAG 2.4.7, 1.4.11, 2.5.8
- 추천: `focus-visible:ring-2 ring-ring`, `min-h-11 sm:min-h-0`
- 추천 명령: `/impeccable adapt`
- 공유 자원: 예 (컴포넌트)

**[P2] 토스트 닫기(×)·동작 버튼 터치 영역 극소**
- 위치: src/components/ui/Toaster.vue:40-47 (`py-1 text-xs`), 49-56 (`text-sm` 글리프만)
- 분류: Responsive
- 영향: × 약 14x20px로 24px 최소 기준 미달. 버튼 글자 12px.
- 기준: WCAG 2.5.8
- 추천: `h-11 w-11` 영역(아이콘 X, 시각은 작게)
- 추천 명령: `/impeccable adapt`
- 공유 자원: 예

**[P2] 모바일 세로 공간: 푸터가 헤더·탭 바와 함께 상시 점유**
- 위치: src/components/Layout.vue:166-168 (`py-4 text-xs`, 약 50px), 셸 구조 84, 176
- 분류: Responsive
- 영향: 667px 높이에서 헤더 56 + 푸터 약 50 + 탭 56 = 160px 이상이 고정 크롬. 표 화면 본문 가시 영역 축소. 푸터 글자 12px도 14px 기준 미달.
- 추천: `<lg`에서 푸터 숨김 또는 main 스크롤 끝으로 이동
- 추천 명령: `/impeccable layout`
- 공유 자원: 아니오 (Layout, 전 화면 영향)

**[P2] 화면 전환 시 main 스크롤 위치·포커스 초기화 없음**
- 위치: src/components/Layout.vue:163 (main이 유일한 스크롤 상자), src/router/index.ts:114 (afterEach는 제목만 변경, scrollBehavior 없음)
- 분류: Accessibility / Responsive
- 영향: Vue Router의 scrollBehavior는 window 대상이라 main.scrollTop이 유지되어 탭 이동 후 중간부터 보일 수 있음(코드 기준 추정, 렌더 확인 필요). 스크린리더용 포커스 이동 없음.
- 추천: `watch(route.path)`로 main.scrollTop=0 및 main.focus({preventScroll})
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오 (Layout)

**[P2] AsyncState 빈 상태 힌트의 대비 부족 추정**
- 위치: src/components/ui/AsyncState.vue:78 (`text-muted-foreground/80`)
- 분류: Accessibility / Theming
- 영향: muted-foreground(약 5:1)에 80% 투명도를 더하면 4.5:1 아래로 내려갈 가능성. 다음 행동을 알려주는 문구라 중요.
- 기준: WCAG 1.4.3
- 추천: 투명도 제거
- 추천 명령: `/impeccable colorize`
- 공유 자원: 예 (컴포넌트)

**[P2] 관리 화면 조회에 요청 경합 방어 없음**
- 위치: src/pages/AdminLogs.vue:113-137 (필터 3개 watch마다 load), src/pages/AdminMembers.vue:72-89
- 분류: Performance
- 영향: 필터를 연속 변경하면 늦게 도착한 이전 응답이 최신 응답을 덮어 화면과 필터가 불일치. 비관리자도 redirect 전 마운트되어 RPC를 호출함(AdminLogs.vue:39-40, 137 / AdminMembers.vue:47-48, 89).
- 추천: 요청 시퀀스 번호 비교, 비관리자는 load 생략
- 추천 명령: `/impeccable optimize`
- 공유 자원: 아니오

### P3

**[P3] Badge 12px와 비상호작용 요소의 포커스 클래스**
- 위치: src/components/ui/Badge.vue:7 (`text-xs`, `focus:ring-2` 등)
- 영향: 표 안 등급·구분 배지가 12px. 의미는 라벨로 전달되므로 영향 작음.
- 추천 명령: `/impeccable typeset`  / 공유 자원: 예

**[P3] 로그인 폼 이중 구현**
- 위치: src/pages/Login.vue:107-166 와 src/components/LoginModal.vue:193-253 (회원 선택·PIN·유지·오류 거의 동일, onlyDigits·memberOptions도 중복)
- 영향: 수정 시 한쪽 누락 위험(이미 기본값 주석을 양쪽에 따로 적고 있음).
- 추천 명령: `/impeccable extract`에 해당하나 허용 목록 밖이므로 `/impeccable distill`  / 공유 자원: 예

**[P3] 로딩 중 회원 목록 자리의 label 연결**
- 위치: src/pages/Login.vue:109-121, LoginModal.vue:196-208 (`<Label for="member-select">`가 div를 가리킴, 라벨 대상 아님)
- 추천 명령: `/impeccable harden`  / 공유 자원: 아니오

**[P3] PinChangeForm 라벨 폭 80px에서 "새 PIN 확인" 줄바꿈 가능**
- 위치: src/components/PinChangeForm.vue:108, 125, 142 (`sm:w-20`, `leading-none`)
- 영향: 14px 기준 약 85px로 추정되어 두 줄로 접힐 수 있음. 렌더 확인 필요. PIN 보이기 토글 부재도 중장년 입력 실수 요인.
- 추천 명령: `/impeccable layout`  / 공유 자원: 아니오

**[P3] index.css 정리 대상**
- 위치: src/index.css:101-108 및 153-160, 사이드바·차트 토큰, 181-198 `scrollbar-none`·`.fab-position`
- 영향: src 어디에서도 쓰이지 않음(grep 확인). 전역 `:focus-visible { border-radius: .25rem }`(212-216)은 원형·pill 요소 포커스 시 모양을 바꿈. reduced-motion 전역 0.01ms(220-228)는 스피너·스켈레톤만 영향이라 현재 문제는 작음.
- 추천 명령: `/impeccable distill`  / 공유 자원: 예 (전역 CSS)

**[P3] 하드코딩 색**
- 위치: Layout.vue:117 (`text-white` on bg-warning), Dialog.vue:118 (`bg-black/50`), MonthlyTable 계열 `text-white`는 범위 밖
- 영향: 현재 대비 충족(약 5:1). 토큰화되면 변경이 한 곳.
- 추천 명령: `/impeccable colorize`  / 공유 자원: 예

## Patterns & Systemic Issues
- 피드백 계층 공백: 토스트(소멸·잘림·작은 닫기)와 관리 화면 인라인 오류(role 없음)가 로그인·PIN 폼의 Alert 패턴과 갈라져 있음. Toaster/useToast와 Alert를 기준으로 통일하면 P1 두 건과 P2 한 건이 함께 해소됨.
- 자체 규약과 코드의 어긋남: index.css 상단 규약(표 14px, 툴바 xs)과 AdminMembers 표 12px, Layout 푸터 12px.
- 포커스 표시: 전역 outline(index.css:212)을 `focus:outline-none`이 개별 해제하는 곳(DropdownMenu, RowDetailButton, Badge)은 대체 표시의 강도를 점검해야 함.

## Positive Findings
- 의미색·테마 토큰이 :root 한 곳에 모여 있고 AA 대비를 주석으로 보증함.
- Dialog: 포커스 이동·Tab 가둠·복귀·Esc·비닫힘 모드(임시 PIN)가 갖춰짐. 닫기 44px, 스크롤 잠금.
- Table: caption, scope=col, 스크롤 시 tabindex+region, 가로 스크롤 힌트 그라데이션.
- Tabs: roving 방향키, aria-controls/labelledby 완비. Checkbox는 시각 16~20px에 44px 가상 히트 영역.
- Select는 네이티브 사용, Input aria-invalid·describedby, 스킵 링크, safe-area 처리, 로딩 skeleton의 sr-only 문구.
- 폼 오류 시 해당 칸으로 포커스 이동, PIN 값 비로깅, 관리자 위험 조작(PIN 초기화·삭제·휴면)은 확인 창 제공.
- 시간 초과 자동 로그아웃 안내 토스트가 6초로 별도 연장됨(App.vue:130-134).

## Recommended Actions
1. [P1] `/impeccable adapt`: Toaster 폭 잘림, 닫기·동작 터치 영역, DropdownMenu 항목 높이
2. [P1] `/impeccable harden`: 오류 토스트 지속·일시정지·role, 관리 폼 오류 Alert 통일, 등급 변경 확인, 라우트 전환 시 스크롤·포커스, 요청 경합
3. [P1] `/impeccable polish`: 하단 탭 활성 상태에 비색 단서 추가
4. [P2] `/impeccable typeset`: 회원 관리 표 14px, Badge·푸터 글자 크기
5. [P2] `/impeccable layout`: 모바일 푸터 처리, PIN 폼 라벨 폭
6. [P2] `/impeccable colorize`: 빈 상태 힌트 대비, 하드코딩 색 토큰화
7. [P3] `/impeccable distill`: 미사용 토큰·유틸 제거, 로그인 폼 중복 정리
8. `/impeccable polish`: 최종 점검

수정 후 `/impeccable audit` 재실행으로 점수 변화 확인 권장. 렌더 기반 대비·줄바꿈 항목(AsyncState 힌트, PIN 라벨, main 스크롤)은 375px 실기 캡처로 확정 필요.
