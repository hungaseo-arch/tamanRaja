# Impeccable 재감사: 셸·로그인·관리·공유 UI

- 대상: Layout.vue, App.vue, LoginModal.vue, pages/Login.vue, pages/AdminMembers.vue, pages/AdminLogs.vue, PinChangeForm.vue, components/ui/*(Toaster, DropdownMenu, AsyncState, Table, Dialog, Badge, Input 등), composables/useToast.ts, index.css
- 방법: 소스 판독만 수행. 375px 렌더 실측 없음(대비·줄바꿈·iOS 확대·이중 스크롤은 코드 기준 추정). 코드 수정 없음.
- 도구: `impeccable context` 로드, `impeccable detect src` 실행. 안티패턴 0건, advisory 8건(이 영역은 Button.vue:23, Select.vue:48의 13px로 기확정 xs 규격이라 제외).
- 제외(기확정): Button/Select xs 32px·13px, 한도 빨강, 본문 14px.
- 보류(감점하되 P1 잔여에서 분리): Input/Select 14px iOS 확대.
- 참고: 작업 트리에 미커밋 변경이 있음(index.css의 `--humanity` 토큰 2줄, HandicapResultsTable.vue). 이 영역 판정에는 영향 없음.

## 1. 점수 이전 → 현재

| 기준 | 이전 | 현재 | 비고 |
|---|---|---|---|
| audit (20점) | 13 | 16 | 접근성 2→3, 성능 3→4, 반응형 2→3, 테마·구현 무변동 |
| critique (40점) | 28 | 30 | H8 미니멀 3→4(푸터 lg 미만 숨김), H9 오류 인식 3→4(오류 토스트 8초·role=alert, 관리 폼 Alert) |

audit 차원별: 접근성 3 / 성능 4 / 테마 3 / 반응형 3 / 구현 무결성 3.
반응형을 3으로 묶어 둔 이유는 Input/Select 14px iOS 확대(보류)와 DropdownMenu hint 12px 때문임.

## 2. 건수

| 등급 | audit 이전 | audit 현재 | critique 이전 | critique 현재 |
|---|---|---|---|---|
| P0 | 0 | 0 | 0 | 0 |
| P1 | 3 | 0 | 3 | 0 (보류 1) |
| P2 | 9 | 5 | 14 | 9 |
| P3 | 6 | 7 | 8 | 8 |

P3 증가분은 이전 P2 일부의 강등과 신규 소항목(아래 5절)임.

## 3. 이전 P1 해결 여부

| 이전 P1 | 판정 | 근거 |
|---|---|---|
| 토스트 375px 왼쪽 잘림 | 해결 | Toaster.vue:15 `left-4 right-4 sm:left-auto sm:max-w-sm`로 양쪽 여백 지정 |
| 오류 토스트 3초 소멸·낭독 | 대부분 해결 | useToast.ts:38,60 destructive 8초. Toaster.vue:31 destructive는 `role="alert"`. 호버·포커스 일시정지는 없음(P2로 잔존) |
| 하단 탭 활성 색만 구분 | 해결 | Layout.vue:199-204 상단 막대 + `font-bold`. 더보기 버튼도 동일(219). 일반 탭 `font-medium`↔활성 `font-bold` 차이도 병행 |
| 회원 관리 표 모바일 12px (critique P1-2) | 해결 | AdminMembers.vue:575 `text-sm`, 안내문 679 `text-sm`. AdminLogs와 통일 |
| Input/Select 14px iOS 확대 (critique P1-3) | 보류 | Input.vue:70 `text-sm` 유지. 사용자 결정 대기 |

## 4. 남은·신규 P0·P1

### P0
- 없음.

### P1 (미해결)
- 없음.

### P1 (보류, 사용자 결정 대기)
**[P1-보류] Input/Select(default) 14px로 iOS Safari 포커스 시 자동 확대**
- 위치: src/components/ui/Input.vue:70, src/components/ui/Select.vue(default 크기 분기)
- 문제: 16px 미만 입력에 포커스하면 iOS가 화면을 확대함. 로그인·PIN·회원 추가 등 모든 입력의 첫 접촉에서 발생 가능. viewport 확대 제한이 없어 되돌려야 함.
- 추천 명령: `/impeccable adapt` (모바일 `text-base`, sm 이상 `text-sm`)
- 공유 자원: 예 (Input, Select, 앱 전역 입력)
- 비고: 본문 14px 결정과 충돌하므로 입력만 예외로 둘지 사용자 판단 필요. 렌더 실측 없음.

## 5. 이전 P2·P3 판정 및 신규 항목

### 해결됨 (파일:줄)
- 푸터 상시 점유: Layout.vue:176 `hidden lg:block`, 12px→`text-sm`
- main 스크롤·포커스 초기화: Layout.vue:69-75
- DropdownMenu 포커스 링·44px: DropdownMenu.vue:132-133 `min-h-11 ... focus-visible:ring-2`
- 토스트 닫기 터치 영역: Toaster.vue:52 `h-11 w-11`
- AsyncState 빈 상태 힌트 대비: AsyncState.vue:78 투명도 제거
- 등급 변경 확인: AdminMembers.vue:263-270, 737-754 확인 창
- 관리 폼 오류 낭독: AdminMembers.vue:722, 768, 793, 818 Alert 사용
- 관리 조회 요청 경합: AdminMembers.vue:79-85, AdminLogs.vue:118-130 loadSeq + 비관리자 load 생략
- PIN 라벨 폭: PinChangeForm.vue:108 등 `sm:w-28 whitespace-nowrap`
- index.css 미사용 토큰·유틸 정리: sidebar·chart 토큰, `scrollbar-none`, `.fab-position` 제거됨

### 남은 P2
- **P2 DropdownMenu hint 12px·흐림**: DropdownMenu.vue:139 `text-xs`, 버튼 전체에 `disabled:opacity-50`(133)이 걸려 hint 대비가 약 2:1 추정. 막힌 이유를 보이게 하려던 의도와 반대임. 추천 `/impeccable typeset`, 공유 자원 예.
- **P2 토스트 호버·포커스 일시정지 없음**: useToast.ts:61-63 타이머 고정. 일반 토스트 3초도 짧음. 추천 `/impeccable harden`, 공유 자원 예.
- **P2 body `min-h-screen`과 `h-dvh` 셸 충돌 가능**: index.css:182, Layout.vue:94. iOS 주소창 노출 시 이중 스크롤 가능(렌더 확인 필요). 추천 `min-h-dvh`, 공유 자원 예.
- **P2 유휴 자동 로그아웃 안내가 6초 토스트뿐**: App.vue:128-132. 부재 중이던 사용자는 못 봄. 추천 `/impeccable harden`, 공유 자원 아니오.
- **P2 입력 폼 모달이 바깥 터치로 닫힘**: Dialog.vue:118-119 `@click.self="close"`, `closeOnBackdrop` 옵션 없음(`dismissible`만 존재). 회원 추가 폼 값 소실. 추천 `/impeccable harden`, 공유 자원 예.
- **P2 회원 추가·휴면 시작월 자유 입력**: AdminMembers.vue:709, 766 `YYYY-MM` 텍스트. 오류는 Alert로 개선됐으나 입력 시점 검증 없음. 추천 `/impeccable harden`, 공유 자원 아니오.
- **P2 로그인 폼 이중 구현 지속**: Login.vue:107-166 / LoginModal.vue. 회원 선택·PIN·오류 블록·onlyDigits 중복. 추천 `/impeccable extract`, 공유 자원 예(추출 시 신규).
- **P2 회원 대면 문구가 개조식**: LoginModal.vue:112,118 / Login.vue:102,132 등("회원 선택 필요", "PIN 4자리 숫자 입력 필요"). 이 프로젝트는 개조식이 사용자 지정 문체라 문체 자체는 유지하고, 로그인 오류는 행동을 말하는 형태 검토. 추천 `/impeccable clarify`, 공유 자원 아니오.
- **P2 참석 확인이 계정 버튼 뒤**: Layout.vue:35-36, 148-158. 칩에 표시·미응답 알림 없음. 추천 `/impeccable shape`, 공유 자원 예.
- **P2 첫 PIN 설정 창 정보량**: App.vue:187-204 안내 4항목 중 2개 중복, PIN 보기 토글 없음. 추천 `/impeccable distill`, 공유 자원 예.

### 남은 P3 / 신규 P3
- Badge `text-xs`(Badge.vue:7)가 표 안 등급·구분 배지에 사용됨. `/impeccable typeset`, 공유 자원 예.
- AdminLogs.vue:337 사용자 에이전트 문자열 `text-xs`. 상세 창 보조 정보라 영향 작음.
- index.css:39-40 주석이 xs를 "모바일 44px·14px, sm 이상 32px·12px"로 기술. 실제 Button/Select는 32px·13px(기확정). 주석만 정정 필요(`/impeccable document`). 공유 자원 예.
- index.css:160-164 전역 `:focus-visible { border-radius }`가 원형·pill 요소 모서리를 바꿈. 공유 자원 예.
- 신규: Toaster.vue:44 동작 버튼 `min-h-9`(36px), 나머지 터치 요소 44px 기준 미달. 공유 자원 예.
- 신규: Layout.vue:127 `text-white`(bg-warning 위), Dialog 백드롭 `bg-black/50` 하드코딩. 현재 대비는 충족.
- Login.vue:109-121 `<Label for="member-select">`가 로딩 중 div를 가리킴. Login.vue:164 관리자 실명 하드코딩. Dialog 첫 포커스가 닫기 버튼으로 가는 경우, 더보기가 중앙 모달인 점은 이전 판정 그대로 유지.
- NotFound.vue는 이번에 재열람하지 않아 이전 P3-3 판정 유지(미확인).

## 6. 권장 순서
1. (사용자 결정) 보류 P1: Input/Select iOS 16px 예외 여부
2. `/impeccable harden`: 토스트 일시정지, 폼 모달 바깥 닫기 옵션, 유휴 로그아웃 안내 유지, 시작월 입력
3. `/impeccable typeset`: DropdownMenu hint 대비·크기, Badge
4. `/impeccable adapt`: body `min-h-dvh` 실기기 확인
5. `/impeccable extract`: LoginForm 추출
6. `/impeccable document`: index.css 규약 주석 정정

## 7. 한계
- 375px 렌더 실측 없음. 대비 수치는 oklch 값 기준 추정이며, iOS 확대·이중 스크롤·탭 라벨 줄바꿈은 실기기 확인 필요.
- 점수 재산정은 이전 보고서의 항목 체계를 기준으로 하되, 이전에 보지 않은 파일(NotFound.vue 등)은 변동 없음으로 둠.
