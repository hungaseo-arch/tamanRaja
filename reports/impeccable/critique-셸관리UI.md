# impeccable critique: 셸·로그인·관리·UI

Method: design review only, 단일 컨텍스트(읽기 전용 진단, 서브에이전트·브라우저·detector 미실행). 소스 정독 기반이며 렌더 확인은 하지 않음.
모드: Operate. 대상: App.vue, Layout.vue, LoginModal.vue, PinChangeForm.vue, Login.vue, NotFound.vue, AdminMembers.vue, AdminLogs.vue, components/ui/*.vue, index.css
제외(알려진 의도): Button/Select xs 모바일 32px·13px, 헤더 로고 홈 링크, 하단 탭 lg 미만.

## 휴리스틱 점수: 28/40 (Good, 하단)

| # | 휴리스틱 | 점수 | 핵심 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | AsyncState 3상태·스켈레톤·저장 중 라벨 우수. 유휴 로그아웃 안내는 6초 토스트뿐 |
| 2 | 현실 세계 일치 | 3 | 모임 용어 일관. 전반이 개조식 명사형 종결이라 중장년에게 딱딱함 |
| 3 | 사용자 통제 | 3 | Esc·취소·뒤로가기 처리 좋음. 입력 중 바깥 클릭으로 폼 소실 |
| 4 | 일관성·표준 | 3 | 토큰·Dialog·Table 체계 일관. 로그인 폼 2벌 중복, 표 글자 규약 위반 |
| 5 | 오류 예방 | 3 | 막힘 규칙·삭제 선차단 좋음. 등급 승격 무확인, 월 자유입력 |
| 6 | 인식 우선 | 3 | 탭 라벨 병기 좋음. 참석 확인이 계정 버튼 뒤에 숨음 |
| 7 | 유연성·효율 | 2 | 관리자 일괄 작업·검색 없음, 필터 기본 외 기억 없음 |
| 8 | 미니멀 | 3 | 표·카드 절제. 모바일 상시 크롬(헤더+푸터+탭) 과다 |
| 9 | 오류 인식·복구 | 3 | 서버 사유 노출·재시도 좋음. 폼 오류가 낭독·시야 밖 |
| 10 | 도움말 | 2 | 인라인 힌트는 있으나 PIN 분실 안내 외 도움 경로 없음 |

집계: P0 0건, P1 3건, P2 11건, P3 8건.

## 디자인 특이성

잔디 초록 hue 145 토큰, 숫자 고정폭, 의미색 분리, 한국어 주석이 이 모임 도구에만 맞는 성격을 준다. 셸은 shadcn 기본 골격이지만 Operate 모드에 맞고 결함이 아니다. 가장 큰 기회는 모바일 실사용 장면(375px, 야외, 한 손)에서의 글자 크기와 터치 마감이다.

## 잘 된 점

- AsyncState가 로딩·오류·빈 상태를 하나로 모아 사유를 감추지 않음. 재시도 직후 로딩이 오류를 덮는 순서도 정확.
- Dialog 포커스 관리(진입·트랩·복귀), 비해제 모드, Checkbox 20px 시각 + 44px 히트 영역 확장.
- 임시 PIN 1회 표시 창: 큰 글자, 복사, "닫으면 다시 볼 수 없음", 해제 불가 처리.
- DropdownMenu가 막힌 이유를 hint 글자로 보여줌(손가락엔 title 불가라는 판단).

## 항목

범례: 공유 자원 = 여러 화면이 쓰는 컴포넌트·토큰이라 수정이 파급됨.

### P1

**P1-1. 모바일에서 토스트가 왼쪽으로 16px 잘림**
- 위치: src/components/ui/Toaster.vue:15
- 문제: 컨테이너가 `fixed right-4 w-full max-w-sm`이고 left 지정이 없음. 375px 뷰포트에서 폭 375px가 오른쪽 16px 기준으로 놓여 왼쪽 가장자리가 화면 밖(-16px)으로 나감. 본문 글자가 화면 끝에 붙거나 잘림. 저장 완료·실패·자동 로그아웃 등 모든 피드백이 대상.
- 추천: `/impeccable layout` (left-4 지정 또는 `w-[calc(100%-2rem)]`, sm 이상에서 right 정렬)
- 공유 자원: 예 (Toaster, 앱 전역)

**P1-2. 회원 관리 표가 모바일에서 12px**
- 위치: src/pages/AdminMembers.vue:550, 654
- 문제: `text-xs sm:text-sm`으로 모바일 표 글자가 12px. index.css:41-44의 "모바일 표 14px" 규약, PRODUCT 원칙 1(본문 14px 이상), 중장년 기준과 충돌. AdminLogs는 `text-sm`이라 두 관리 화면이 서로 다름. 하단 요약 문구도 text-xs.
- 추천: `/impeccable typeset` (모바일 text-sm로 올리고 AdminLogs와 통일)
- 공유 자원: 아니오 (화면 단독). 단 규약 문서는 index.css와 연동.

**P1-3. 입력 칸 글자 14px로 iOS 확대 발생 가능**
- 위치: src/components/ui/Input.vue:70, src/components/ui/Select.vue:47(default 크기)
- 문제: Input/Select(default) 글자가 text-sm 14px. iOS Safari는 16px 미만 입력에 포커스하면 화면을 자동 확대함. viewport에 maximum-scale 제한은 없으므로(index.html:5) 확대 후 되돌리기가 필요. 로그인·PIN 변경·회원 추가 등 모든 입력의 첫 접촉에서 발생. 알려진 xs 크기는 제외, default 크기만 대상.
- 추천: `/impeccable adapt` (모바일 `text-base`, sm 이상 `text-sm`)
- 공유 자원: 예 (Input, Select, 로그인·PIN·관리 전반)

### P2

**P2-1. 모바일 상시 크롬이 화면의 약 25%**
- 위치: src/components/Layout.vue:90, 166-168, 172-205
- 문제: 헤더 56px + 푸터 약 52px(py-4 + 줄) + 탭바 56px+안전영역 = 667px 높이 기준 164px 이상. 푸터 "Copyright © ASEOA"는 스크롤 영역 밖에 고정돼 표 가시 영역만 줄임. 순위·기록 조회 서비스에서 가장 비싼 자리.
- 추천: `/impeccable distill` (푸터를 main 스크롤 끝으로 이동 또는 제거)
- 공유 자원: 예 (Layout, 전 화면)

**P2-2. 참석 확인이 계정 버튼 뒤에 숨음**
- 위치: src/components/Layout.vue:35-36, 138-148 / src/components/LoginModal.vue:85-87
- 문제: PRODUCT 성공 기준(참석 상태 확인)의 핵심 작업이 이름 버튼 하나 아래 첫 탭에 있음. 이름 칩은 열린다는 표시(화살표·라벨)가 없고, 미응답 상태 알림도 없음. 월 1회 쓰는 기능이라 위치를 잊기 쉬움.
- 추천: `/impeccable clarify` 후 `/impeccable shape` (칩에 "참석" 라벨 또는 미정 점 표시)
- 공유 자원: 예 (Layout, LoginModal)

**P2-3. 유휴 자동 로그아웃 안내가 사라진 뒤 돌아오는 사용자에게 없음**
- 위치: src/App.vue:125-135
- 문제: 6초 토스트가 사용자 부재 중 지나감. 3시간 뒤 돌아오면 이유 없이 로그인 화면. 중장년은 오류로 오해할 가능성이 큼.
- 추천: `/impeccable harden` (로그인 화면에 "자동 로그아웃됨" 안내를 사용자가 닫을 때까지 유지)
- 공유 자원: 아니오 (App, Login)

**P2-4. 로그인 폼이 Login.vue와 LoginModal.vue에 중복**
- 위치: src/pages/Login.vue:27-166, src/components/LoginModal.vue:47-253
- 문제: 회원 선택·PIN·유지 체크·불러오기 실패 블록·onlyDigits·오류 처리가 거의 그대로 2벌. 문구나 오류 규칙을 고칠 때 한쪽만 바뀌면 어긋남. 같은 id(member-select, pin-input)를 두 곳이 씀.
- 추천: `/impeccable extract` (LoginForm 컴포넌트 추출)
- 공유 자원: 예 (추출 시 신규 공유 자원)

**P2-5. 표시 문구가 전반적으로 개조식 명사 종결**
- 위치: Login.vue:102, 132, 164 / LoginModal.vue:112, 118, 220 / PinChangeForm.vue:106 / AdminMembers.vue 전반 / NotFound.vue:21
- 문제: "PIN 4자리 숫자 입력 필요", "이 창을 닫으면 다시 볼 수 없음" 같은 보고서체가 회원 대면 화면에까지 쓰임. 중장년 회원에게 명령조·메모조로 읽혀 거리감. 관리자 화면은 허용 범위, 로그인·PIN·404는 해요체가 적합.
- 추천: `/impeccable clarify` (회원 대면 화면부터 "PIN 4자리를 입력해 주세요" 형태)
- 공유 자원: 아니오 (문구), 단 describeLoginError 등 useAuth 문구는 별도 확인 필요.

**P2-6. 회원 추가 폼의 자유 입력과 오류 위치**
- 위치: src/pages/AdminMembers.vue:684 (시작월), 674 (기준핸디), 697 (오류), 668-704
- 문제: 시작월을 "YYYY-MM" 텍스트로 직접 입력. 기준핸디 0~54 범위는 오류 사유로만 나오고 입력 시점 힌트가 없음. 오류 `<p>`가 role/aria-live 없이 폼 맨 아래에 떠서, 모바일 키보드가 열려 있으면 화면 밖이고 낭독도 안 됨. 휴면 시작월(718)도 같음.
- 추천: `/impeccable harden` (type="month" 또는 Select, 범위 힌트, 오류에 role="alert")
- 공유 자원: 아니오

**P2-7. 입력 중 바깥 클릭·Esc로 폼 소실**
- 위치: src/components/ui/Dialog.vue:118-119 (`@click.self="close"`), 45-47
- 문제: 회원 추가 등 입력 폼 모달이 바깥 터치 한 번에 닫히고 값이 초기화됨(openAdd가 열 때 비움). 스크롤 중 실수 터치가 흔한 모바일에서 손해가 큼.
- 추천: `/impeccable harden` (입력 폼 모달은 바깥 클릭 닫기 비활성 옵션 `closeOnBackdrop`)
- 공유 자원: 예 (Dialog)

**P2-8. 등급 승격·강등이 확인 없이 즉시 실행**
- 위치: src/pages/AdminMembers.vue:248-271, 467-472, 609-614
- 문제: "관리자로 올리기"는 쓰기 권한 부여인데 한 번 누르면 바로 적용. PIN 초기화·삭제는 확인창이 있어 위험도 대비 불균형. 드롭다운에서 휴면·PIN 초기화와 이웃해 오탭 위험.
- 추천: `/impeccable harden` (승격은 확인 대화상자 또는 실행 취소 토스트)
- 공유 자원: 아니오

**P2-9. 드롭다운 메뉴 항목이 44px 미만, 막힘 설명이 흐림**
- 위치: src/components/ui/DropdownMenu.vue:132-139
- 문제: 항목 `py-2 text-sm`로 높이 약 36px(원칙 1의 44px 미달). 막힌 항목은 `opacity-50`이 항목 전체에 걸려 hint(`text-xs text-muted-foreground`)가 약 2:1 수준으로 흐려짐. 이유를 보이게 하려던 hint가 가장 읽기 어려움.
- 추천: `/impeccable adapt` (항목 min-h-11, hint는 opacity 분리 후 text-sm)
- 공유 자원: 예 (DropdownMenu)

**P2-10. 토스트 닫기 "×"의 터치 영역과 오류 낭독 수준**
- 위치: src/components/ui/Toaster.vue:49-56, 16-18
- 문제: 닫기 버튼이 글자 크기만(약 12x20px)이라 터치 어려움. 컨테이너는 `role="status"`(polite)라 저장 실패 같은 오류도 정중하게만 읽힘.
- 추천: `/impeccable adapt` (min 44px 히트 영역, destructive는 role="alert")
- 공유 자원: 예 (Toaster)

**P2-11. 하단 탭의 활성 표시가 색만**
- 위치: src/components/Layout.vue:182-184, 194-196, 115-119 / 같은 파일 45, 215
- 문제: 활성 탭이 text-primary 색 변화뿐(아이콘·글자 굵기·막대 변화 없음). PRODUCT의 "색만으로 전달 금지"와 충돌. "27년 핸디"는 주의색(warning)으로 "확정 전"을 전달하는데 라벨에 "안" 표기가 없어 색 의미가 글자로 확인되지 않음. 연도 "27년"도 하드코딩.
- 추천: `/impeccable colorize` (활성 막대/굵기 병행, 라벨에 "(안)")
- 공유 자원: 예 (Layout, warning 토큰 의미)

**P2-12. body min-h-screen과 h-dvh 셸 충돌 가능**
- 위치: src/index.css:232, src/components/Layout.vue:84
- 문제: body는 `min-h-screen`(100vh), 셸은 `h-dvh`. iOS Safari에서 주소창이 보이면 100vh가 dvh보다 커서 body가 문서 스크롤을 만들어 main 스크롤과 이중 스크롤·하단 탭 가림 가능. 렌더 미확인이라 확인 필요.
- 추천: `/impeccable audit` 로 실기기 확인 후 `min-h-dvh`
- 공유 자원: 예 (index.css 전역)

**P2-13. 첫 PIN 설정 창의 정보량**
- 위치: src/App.vue:187-204, src/components/PinChangeForm.vue:104-173
- 문제: 처음 쓰는 회원이 만나는 가장 중요한 순간에 안내 상자(항목 4개) + 힌트 + 입력 3칸 + 로그아웃 버튼이 한 창에 있음. 항목 4개 중 2개는 중복(임시 PIN 설명, 다음 로그인부터 새 PIN). PIN 값에 보기 토글이 없어 password 3칸 입력 오타를 확인하기 어려움.
- 추천: `/impeccable distill` (안내 2줄로 축약, 보기 토글)
- 공유 자원: 예 (PinChangeForm)

**P2-14. Badge 12px**
- 위치: src/components/ui/Badge.vue:7
- 문제: `text-xs`로 등급·접속 구분 뱃지가 12px. 의미를 전달하는 글자인데 중장년 기준 14px 미만.
- 추천: `/impeccable typeset`
- 공유 자원: 예 (Badge, 관리 화면·시상 뱃지)

### P3

- **P3-1.** Dialog 첫 포커스가 입력이 없으면 "닫기" 버튼으로 가서 링 표시(참석 탭 진입 시). Dialog.vue:76-78. `/impeccable polish`. 공유 자원: 예.
- **P3-2.** 더보기가 화면 중앙 모달. 엄지 도달과 맥락 면에서 하단 시트가 적합. Layout.vue:207-224. `/impeccable layout`. 공유 자원: 예(Dialog 변형).
- **P3-3.** NotFound가 `#/주소`를 mono 12px로 노출하고 제목이 "페이지 없음". 회원에겐 의미 없는 정보. NotFound.vue:20-23. `/impeccable clarify`. 공유 자원: 아니오.
- **P3-4.** 관리자 실명 "서종환·조학영"이 Login.vue:164에 하드코딩. 관리자 변경 시 낡음. `/impeccable harden`. 공유 자원: 아니오.
- **P3-5.** index.css:41-44 주석이 xs를 "모바일 44px·14px"로 기술하는데 Button/Select 실제값(32px·13px)과 불일치. 알려진 의도는 그대로 두고 주석만 정정. `/impeccable document`. 공유 자원: 예(규약 문서).
- **P3-6.** index.css:100-115 chart·sidebar 토큰, 187-197 `.fab-position`, 181-185 `scrollbar-none`은 사용처가 보이지 않음(확인 필요). 정리 시 주석의 "토큰이 유일한 출처" 신뢰도 상승. `/impeccable distill`. 공유 자원: 예.
- **P3-7.** `:focus-visible { border-radius: .25rem }` 전역 지정이 포커스 시 rounded-md/rounded-lg 요소의 모서리를 바꿔 미세한 모양 점프. index.css:212-216. `/impeccable polish`. 공유 자원: 예.
- **P3-8.** AsyncState 빈 상태 힌트 `text-muted-foreground/80`은 4.5:1 미달 가능, 로딩 스켈레톤이 모든 화면에서 표 모양. AsyncState.vue:78, App.vue:162-171. `/impeccable polish`. 공유 자원: 예.

## 페르소나 레드 플래그

**따만라자 일반 회원(60대, 아이폰 한 손)**: 로그인 첫 입력에서 iOS 확대(P1-3). 저장 토스트가 왼쪽에서 잘림(P1-1). 참석 확인 위치를 이름 칩에서 추론해야 함(P2-2). 3시간 후 돌아와 이유 없는 로그아웃(P2-3). 오류 문구가 메모체(P2-5).

**관리자 Alex형(월 1회 기록 입력)**: 회원 추가 시 월 직접 타이핑, 오류가 키보드 아래(P2-6). 승격 오탭 즉시 적용(P2-8). 모바일 표 12px(P1-2). 일괄 작업·검색 없음(H7).

**Sam형(키보드·낭독)**: 폼 오류 `<p>` 낭독 안 됨(P2-6), 오류 토스트가 polite(P2-10), 활성 탭 색 단독(P2-11). 포커스 트랩·skip link는 양호.

## 소소한 관찰

- 헤더 이모지 로고(🏌️)는 플랫폼별 모양이 다름. 브랜드 일관성을 원하면 SVG 마크.
- AdminLogs 기본 필터 "최근 7일" 선택이 세션 간 유지되지 않음.
- PinChangeForm 라벨 `sm:w-20`(80px)에 "새 PIN 확인"이 한 줄로 들어가는지 확인 필요.

## 고민해 볼 질문

- 푸터를 없애고 그 56px을 표에 돌려주면 모바일 첫 화면에서 몇 줄이 더 보이는가?
- 참석 확인을 "이번 달 참석하시나요?" 한 줄 배너로 월간 기록 맨 위에 두면 계정 창 진입이 필요한가?
- 폼 모달에서 닫기와 저장 사이의 오탭 비용을 얼마로 볼 것인가?

## 권장 순서

1. `/impeccable layout` Toaster 잘림 (P1-1), 푸터 이동 (P2-1)
2. `/impeccable typeset` AdminMembers 12px, Badge (P1-2, P2-14)
3. `/impeccable adapt` Input/Select 16px, DropdownMenu 44px, 토스트 닫기 (P1-3, P2-9, P2-10)
4. `/impeccable harden` 회원 추가 폼, Dialog 바깥 클릭, 승격 확인, 유휴 로그아웃 안내
5. `/impeccable extract` LoginForm
6. `/impeccable polish`

Questions skipped: 읽기 전용 진단 위임이라 사용자 질의 불가(호출자에게 위임).
