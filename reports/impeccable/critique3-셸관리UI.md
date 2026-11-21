⚠️ DEGRADED: single-context (서브에이전트 도구 없음, 브라우저 렌더 미실행. 소스 판독 + `impeccable detect` 로만 진단)

# impeccable critique 3차: 셸·관리·공용 UI

- 모드: Operate. 대상: App.vue, components/Layout.vue, LoginModal.vue, PinChangeForm.vue, pages/Login.vue, AdminLogs.vue, AdminMembers.vue, NotFound.vue, components/ui/*
- 기준: PRODUCT.md, DESIGN.md, critique.md 레퍼런스. 비교 대상: critique-셸관리UI.md, reaudit-셸관리UI.md, 00_통합표.md
- 제외(확정 결정): Button/Select xs 32px·13px(sm 이상), 한도 빨강, 본문 14px, 삭제한 안내문구 복원, 모바일 Input·Select 16px
- 코드 수정 없음. 작업 트리 미커밋 변경은 MonthlyTable.vue뿐이라 이 영역 판정에 영향 없음.
- 한계: 375px 렌더 실측 없음. 대비·키보드 가림·이중 스크롤은 코드 기준 추정.

## 1. 요약

| 항목 | 값 |
|---|---|
| 휴리스틱 합계 | 29/40 (Good, 하단) |
| 건수 | P0 0 / P1 0 / P2 11 / P3 14 |
| detector | advisory 2건(Button.vue:23, Select.vue:48의 13px). 확정 결정이라 제외. 안티패턴 0건 |

- 이전 P1(토스트 잘림, 오류 토스트 소멸, 탭 색 단독, 표 12px)과 보류 P1(입력 iOS 확대)은 모두 해소됨. 입력 `text-base sm:text-sm`(Input.vue:70, Select.vue:47-48) 확인.
- 이번 회차 신규 중 가장 큰 것은 P2-5(Select 오류 상태 없음)와 P2-6(로그인 폼 이중 구현이 이미 어긋남).
- P1 경계 후보: P2-1(자동 로그아웃 안내). 3시간 뒤 돌아온 회원이 이유 없이 로그인 화면을 보는 건 문의 가능성이 있으나, 재로그인으로 복구되어 P2로 둠.

## 2. 휴리스틱 점수

| # | 휴리스틱 | 점수 | 핵심 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | AsyncState 3상태, 저장 중 라벨 양호. 유휴 로그아웃 안내 6초(App.vue:134), 토스트 일시정지 없음 |
| 2 | 현실 세계 일치 | 3 | 모임 용어 일관. "접속 시간", "기획 이력" 등 관리 용어는 설명 없음 |
| 3 | 사용자 통제 | 3 | Esc·취소 양호. 입력 폼 모달이 바깥 터치·저장 중 Esc로 닫힘(Dialog.vue:45-52,119) |
| 4 | 일관성·표준 | 3 | 토큰·Dialog·Table 일관. 로그인 폼 2벌이 이미 어긋남, Select만 오류 상태 없음 |
| 5 | 오류 예방 | 3 | 막힘 규칙·등급 확인 창 양호. 시작월 자유 입력, PIN 3칸 가림 입력 |
| 6 | 인식 우선 | 3 | 탭 라벨 병기 양호. 참석 확인이 계정 버튼 뒤 |
| 7 | 유연성·효율 | 2 | 회원 검색·정렬 없음, Enter 제출 불가(AdminMembers 폼), 접속 기록 기본 필터 미기억 |
| 8 | 미니멀 | 4 | 푸터 lg 한정, 표·카드 절제. 상시 크롬 헤더 56px + 탭 56px |
| 9 | 오류 인식·복구 | 3 | 서버 사유 노출·재시도 양호. PIN 변경 네트워크 실패는 "저장 실패"뿐(PinChangeForm.vue:96) |
| 10 | 도움말 | 2 | 입력 힌트 있음. 로그인 모달에는 PIN 분실 안내 없음, 관리 용어 도움말 없음 |
| **합계** | | **29/40** | **Good** |

## 3. 디자인 특이성

- 판단: 숫자 고정폭, 초록 hue 145 토큰, 막힌 이유를 글자로 보이는 DropdownMenu, 임시 PIN 1회 표시 창이 이 모임 도구에 맞는 성격을 줌. 셸 골격은 shadcn 계열이나 Operate 모드에 맞음.
- 남은 기회: 모바일 한 손 사용 장면. 입력 폼 모달 안전장치(바깥 터치, Enter 제출), 키보드가 올라온 상태의 오류 위치.

## 4. 잘 된 점

- 입력 모바일 16px 전환이 Input·Select에 `text-base sm:text-sm`로 한 번에 적용됨. 터치 높이(h-11)와 짝이 맞음.
- Toaster가 left-4 right-4와 destructive `role="alert"`, 닫기 44px로 정리됨. AdminMembers 오류도 Alert로 통일됨.
- 등급 변경·PIN 초기화·삭제가 확인 창을 거치고, 삭제 불가 회원에게는 버튼을 아예 내놓지 않음(AdminMembers.vue:511,665).

## 5. 항목

범례: 공유 자원 = 여러 화면이 쓰는 컴포넌트·토큰이라 수정이 다른 화면에 파급됨. 휴리스틱 = 가장 관련된 번호.

### P0

- 없음.

### P1

- 없음.

### P2

**P2-1. 유휴 자동 로그아웃 안내가 6초 토스트뿐**
- 파일:라인: src/App.vue:126-136
- 문제: 회원 3시간·관리자 30분 부재 후 돌아오면 안내가 이미 사라지고 이유 없는 로그인 화면만 보임. 중장년은 오류로 오해할 가능성이 큼. 재감사에서 잔존 판정, 미해결.
- 추천 명령: `/impeccable harden` (로그인 화면에 닫을 때까지 남는 안내 한 줄)
- 공유 자원: 아니오 (App, Login)
- 휴리스틱: H1, H9

**P2-2. 토스트가 호버·포커스 중에도 닫히고 성공 토스트가 3초**
- 파일:라인: src/composables/useToast.ts:36,60-63, src/components/ui/Toaster.vue:28-36
- 문제: 타이머가 고정이라 읽는 도중 사라짐. 성공 3초는 중장년에게 짧음(WCAG 2.2.1). 모달 포커스 트랩 안에서는 토스트 닫기 버튼에 키보드로 닿지 못함.
- 추천 명령: `/impeccable harden` (호버·포커스 시 일시정지, 기본 4~5초)
- 공유 자원: 예 (useToast, Toaster, 앱 전역)
- 휴리스틱: H1, H3

**P2-3. 입력 폼 모달이 바깥 터치·Esc로 닫혀 입력값이 사라짐, 저장 중에도 닫힘**
- 파일:라인: src/components/ui/Dialog.vue:45-52,119 / src/pages/AdminMembers.vue:689,728,757,774
- 문제: `closeOnBackdrop` 옵션 없음(`dismissible`은 전부 막는 용도뿐). 회원 추가 폼은 스크롤 중 실수 터치로 닫히고 `openAdd`가 값을 비움. 저장 요청이 나간 뒤 닫으면 실패 사유(Alert)를 볼 수 없음. 재감사에서 잔존 판정, 미해결.
- 추천 명령: `/impeccable harden` (입력 폼 모달은 바깥 클릭 닫기 끔, 저장 중 Esc·X 잠금)
- 공유 자원: 예 (Dialog)
- 휴리스틱: H3, H5

**P2-4. 회원 추가·휴면 폼이 `<form>`이 아니고 시작월이 자유 입력**
- 파일:라인: src/pages/AdminMembers.vue:689-734,757-780 (시작월 709, 766, 가입연도 703)
- 문제: Enter로 제출되지 않고 모바일 키보드의 "이동" 키도 동작 없음. 시작월은 `YYYY-MM` 텍스트라 오타는 제출 후에야 사유가 나옴. 가입연도는 서버 사유 코드가 없어 잘못 넣어도 알 수 없음. 시작월 입력은 재감사에서 잔존 판정, 미해결.
- 추천 명령: `/impeccable harden` (form + submit, 월은 Select 또는 `type="month"`, 범위 힌트)
- 공유 자원: 아니오
- 휴리스틱: H5, H7

**P2-5. Select에 오류 상태가 없어 "회원 선택 필요" 오류가 칸과 연결되지 않음 (신규)**
- 파일:라인: src/components/ui/Select.vue:65-86, src/pages/Login.vue:63-67,122-128, src/components/LoginModal.vue:111-115,209-215
- 문제: Input은 `ariaInvalid`로 빨간 테두리와 `aria-describedby`가 있으나 Select는 둘 다 없음. 로그인에서 회원을 안 고르면 `errorField='member'`가 포커스 이동에만 쓰이고, 화면 낭독기는 오류와 칸의 관계를 못 읽음. 오류 Alert가 버튼 아래라 키보드가 열려 있으면 시야 밖일 수 있음(추정).
- 추천 명령: `/impeccable harden` (Select에 aria-invalid·테두리 상태 추가, Alert 연결)
- 공유 자원: 예 (Select)
- 휴리스틱: H4, H9

**P2-6. 로그인 폼 이중 구현이 이미 어긋남 (재감사 P2 승격 근거 확인)**
- 파일:라인: src/pages/Login.vue:107-166 / src/components/LoginModal.vue:193-253
- 문제: Login.vue에만 "PIN 분실 시 관리자에게 초기화 요청"(163-165)이 있고 LoginModal.vue에는 없음. 헤더 "로그인" 버튼으로 연 사용자는 분실 시 갈 곳을 모름. 오류 블록 간격·`py-1` 유무도 다름. 같은 id(member-select, pin-input)를 두 곳이 사용.
- 추천 명령: `/impeccable extract` (LoginForm 추출 후 분실 안내 포함). 임시 조치는 `/impeccable clarify`.
- 공유 자원: 예 (추출 시 신규 공유 컴포넌트)
- 휴리스틱: H4, H10

**P2-7. DropdownMenu 막힘 hint가 12px에 항목 전체 opacity-50**
- 파일:라인: src/components/ui/DropdownMenu.vue:133,139
- 문제: 막힌 이유를 보이게 하려는 hint가 `text-xs` + 부모 `disabled:opacity-50`으로 대비 약 2:1 추정. 가장 읽기 어려운 글자가 가장 필요한 설명임. 재감사에서 잔존 판정, 미해결.
- 추천 명령: `/impeccable typeset` (opacity를 label에만 적용, hint는 text-sm)
- 공유 자원: 예 (DropdownMenu, 회원 관리)
- 휴리스틱: H1, H6

**P2-8. Badge 12px가 표 안 핵심 정보(등급·구분)에 쓰임**
- 파일:라인: src/components/ui/Badge.vue:7 (사용: AdminLogs.vue:295,329, AdminMembers.vue:602)
- 문제: 같은 행의 텍스트가 14px인데 의미를 가진 배지가 12px로 더 작음. PRODUCT 원칙 1(14px 이상)과 어긋남. 재감사 P3였으나 접속 기록의 "구분" 열이 이 배지 하나로 읽혀 P2로 올림.
- 추천 명령: `/impeccable typeset` (text-sm, 또는 표 안 배지만 `text-[13px]`로 xs 규격과 통일)
- 공유 자원: 예 (Badge)
- 휴리스틱: H8, H6

**P2-9. PIN 변경 폼: 가림 입력 3칸, 실패 원인 없는 "저장 실패", 중복 안내 (재감사 잔존 + 신규)**
- 파일:라인: src/components/PinChangeForm.vue:95-97,106-156 / src/App.vue:191-198,119
- 문제: (a) 새 PIN을 password 3칸에 눈 없이 입력, 불일치는 제출 후에야 알림. (b) 네트워크 실패 `catch`가 "저장 실패"만 띄우고 포커스·재시도 안내가 없음(`errorField=null`). (c) 처음 쓰는 PIN 창 안내 4항목 중 "다음 로그인부터 새 PIN 사용"이 힌트·완료 토스트(119)와 중복.
- 추천 명령: `/impeccable distill` (안내 2줄), `/impeccable harden` (보기 토글, catch 문구에 "네트워크 확인 후 다시 시도")
- 공유 자원: 예 (PinChangeForm)
- 휴리스틱: H9, H5

**P2-10. body `min-h-screen`과 셸 `h-dvh` 혼용 (재감사 잔존)**
- 파일:라인: src/index.css:182, src/components/Layout.vue:94, src/pages/NotFound.vue:17 (`min-h-[60vh]`)
- 문제: iOS Safari 주소창이 보일 때 100vh가 dvh보다 커서 문서 스크롤이 생기고 main 스크롤과 이중 스크롤·하단 탭 가림 가능(렌더 확인 필요).
- 추천 명령: `/impeccable adapt` (`min-h-dvh`, 실기기 확인)
- 공유 자원: 예 (index.css 전역)
- 휴리스틱: H4

**P2-11. 참석 확인이 계정 버튼 뒤에 있고 상태 표시 없음 (재감사 잔존)**
- 파일:라인: src/components/Layout.vue:35-36,148-158 / src/components/LoginModal.vue:87,167-171
- 문제: PRODUCT 성공 기준(참석 상태 확인)의 핵심 동작이 이름 칩 아래 첫 탭. 칩에 미응답 표시·열림 단서 없음. 월 1회 쓰는 기능이라 위치를 잊기 쉬움.
- 추천 명령: `/impeccable shape` 후 `/impeccable clarify`
- 공유 자원: 예 (Layout, LoginModal)
- 휴리스틱: H6

### P3

- **P3-1.** Layout.vue:28 `tabLabel` 필드와 23-26 주석이 사용처 없는 죽은 코드. 41-43 "27년" 하드코딩, accent(주의색) 의미가 라벨에 "안" 없이 색으로만 전달. `/impeccable harden`, 공유 자원 예(Layout).
- **P3-2.** Toaster.vue:44 동작 버튼 `min-h-9`(36px)로 터치 44px 기준 미달. `/impeccable adapt`, 공유 자원 예.
- **P3-3.** index.css:38-39 규약 주석이 xs를 "모바일 44px·14px·선택 상자 16px, sm 이상 32px·12px"로 기술. 실제는 Button.vue:23, Select.vue:48(32px·13px)이고 확정 결정과도 불일치. 주석만 정정. `/impeccable document`, 공유 자원 예.
- **P3-4.** index.css:162-166 전역 `:focus-visible { border-radius: .25rem }`가 pill·원형 요소 모서리를 바꿈(재감사 잔존). `/impeccable polish`, 공유 자원 예.
- **P3-5.** Select.vue:81이 disabled 옵션 뒤에 "(예정)"을 붙임. 도메인 문구가 공용 컴포넌트에 박혀 있음. `/impeccable clarify`, 공유 자원 예.
- **P3-6.** Dialog.vue:39-43 인스턴스마다 `useScrollLock`을 만들고 Esc 리스너(45-47)도 인스턴스별. 모달이 겹쳐 열리면 잠금 해제 순서에 따라 body 스크롤이 잠긴 채 남을 가능성(확인 필요, 실측 없음). `/impeccable harden`, 공유 자원 예.
- **P3-7.** AdminLogs.vue:57-65 `pin_reset`이 `logout`과 같은 secondary, `idle_timeout`·`expired`가 같은 outline. 라벨은 다르나 관리자 개입(PIN 초기화)이 색으로 구분되지 않음. `/impeccable colorize`, 공유 자원 아니오.
- **P3-8.** AdminLogs.vue:82 기본 필터 "최근 7일"이 방문마다 초기화, 300건 상한에 페이지 이동 없음(310 안내만). `/impeccable harden`, 공유 자원 아니오.
- **P3-9.** AdminMembers.vue:635-639 데스크톱 버튼 "회원으로/관리자로"가 모바일 메뉴 "회원으로 내리기/관리자로 올리기"(493)보다 모호. 막힘 이유가 `title`뿐(635,645,653)이라 터치 노트북·태블릿에서 안 보임. `/impeccable clarify`, 공유 자원 아니오.
- **P3-10.** AdminLogs.vue:337 사용자 에이전트 원문 `text-xs`, NotFound.vue:23 주소 `text-xs font-mono`. 보조 정보라 영향 작음. `/impeccable typeset`, 공유 자원 아니오.
- **P3-11.** Login.vue:164 관리자 실명 하드코딩, Login.vue:109 / LoginModal.vue:196 `<Label for="member-select">`가 로딩 중 div를 가리킴(재감사 잔존). `/impeccable harden`, 공유 자원 아니오.
- **P3-12.** Layout.vue:127 `text-white`, Dialog.vue:118 `bg-black/50` 하드코딩(재감사 잔존, 현재 대비 충족). `/impeccable colorize`, 공유 자원 예.
- **P3-13.** Layout.vue:226 더보기가 화면 중앙 모달. 관리자는 접속 기록·회원 관리에 2번 터치가 필요하고 엄지 도달도 약함. `/impeccable layout`, 공유 자원 예(Dialog 변형).
- **P3-14.** App.vue:158 로그인 상태로 홈 주소에 오면 Login.vue가 한 프레임 그려진 뒤 replace됨(Login.vue:22). `/impeccable polish`, 공유 자원 아니오.

## 6. 페르소나 레드 플래그

**따만라자 회원(60대, 아이폰 한 손)**
- 3시간 후 돌아오면 이유 없는 로그인 화면(P2-1).
- 헤더 "로그인"으로 연 창에서 PIN을 잊으면 분실 안내가 없음(P2-6).
- 회원을 안 고르고 누르면 칸이 빨갛게 변하지 않음(P2-5).
- 새 PIN을 눈 없이 3번 입력, 실패 시 "저장 실패"뿐(P2-9).
- 토스트가 읽는 도중 사라짐(P2-2).

**관리자(월 1회 입력, 모바일)**
- 회원 추가 중 바깥 터치로 폼이 사라짐(P2-3). Enter가 안 먹음(P2-4).
- 막힌 메뉴 이유가 12px 흐림(P2-7).
- 회원 검색·정렬 없음(H7).

**Sam형(키보드·낭독)**
- 오류 Alert가 Select와 연결되지 않음(P2-5).
- 모달 안에서 토스트 닫기에 닿지 못함(P2-2).
- 포커스 트랩·skip link·Table 키보드 스크롤은 양호.

## 7. 권장 순서

1. `/impeccable harden`: P2-3(Dialog 옵션), P2-5(Select 오류), P2-1, P2-2, P2-4, P2-9. 공유 자원이라 순차 처리 권장(Dialog, Select, useToast, PinChangeForm).
2. `/impeccable extract`: P2-6 LoginForm. 분실 안내 누락은 추출 전에 한 줄 임시 반영 가능.
3. `/impeccable typeset`: P2-7, P2-8(DropdownMenu, Badge).
4. `/impeccable adapt`: P2-10 실기기 확인, P3-2.
5. `/impeccable shape`: P2-11.
6. `/impeccable document`, `/impeccable polish`: P3-3, P3-4 등 마감.

공유 자원 파일(파급 큼): Dialog.vue, Select.vue, Toaster.vue, useToast.ts, DropdownMenu.vue, Badge.vue, PinChangeForm.vue, Layout.vue, index.css.
단독 화면 파일: App.vue, Login.vue, AdminMembers.vue, AdminLogs.vue, NotFound.vue.
