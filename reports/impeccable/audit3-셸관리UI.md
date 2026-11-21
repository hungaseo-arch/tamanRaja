# Impeccable audit3: 셸·관리·공용 UI

- 대상 : App, Layout, LoginModal, PinChangeForm, Login, AdminLogs, AdminMembers, NotFound, ui/*, index.css
- 방식 : 소스 판독 + detect(안티패턴 0건). 렌더 실측 없음. 서브에이전트 작성본을 메인이 저장
- 점수 : 16/20 (접근성 3, 성능 4, 테마 3, 반응형 3, 구현 무결성 3)
- 건수 : P0 0 / P1 0 / P2 9 / P3 10
- 이전 대비 : 모바일 Input·Select 16px 해소로 이전 보류 P1 종결. xs Select 여백과 chevron 겹침 없음

## P2

| # | 파일:라인 | 문제 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|
| 1 | Dialog.vue:118-119,140 | 폼 모달이 바깥 터치·드래그 이탈로 닫혀 입력값 소실 | harden | 예(Dialog) |
| 2 | LoginModal.vue:111-115, Login.vue:63-67, Select.vue | 회원 선택 오류가 Select 에 연결되지 않음(errorField 죽은 코드) | harden | 예(Select) |
| 3 | DropdownMenu.vue:133,139 | 막힘 이유 hint 12px, opacity-50 으로 대비 약함 | typeset | 예 |
| 4 | useToast.ts:60-63 | hover·focus 중에도 토스트 타이머 진행(WCAG 2.2.1) | harden | 예 |
| 5 | index.css:182, Layout.vue:94 | body min-h-screen 과 셸 h-dvh 충돌(iOS 이중 스크롤 가능, 실기기 확인 필요) | adapt | 예 |
| 6 | App.vue:131-135 | 유휴 자동 로그아웃 안내가 6초 토스트뿐 | harden | 아니오 |
| 7 | AdminMembers.vue:574 | compact 표 scroll 로 열 제목 sticky 무력화(신규) | adapt | 아니오 |
| 8 | AdminMembers.vue:709,766 | 회원 추가·휴면 시작월이 YYYY-MM 자유 텍스트 | harden | 아니오 |
| 9 | Login.vue:107-166 / LoginModal.vue:193-253 | 로그인 폼 이중 구현 | extract | 예 |

## 의심(렌더 확인 필요)

- AdminMembers.vue:629 버튼 4개: 640~약 900px 에서 표 최소폭이 컨테이너를 넘길 수 있음 (adapt)

## P3 (10건)

1. Badge·UA 원문·NotFound 경로 text-xs (typeset)
2. index.css:39-40 주석이 현재 규격과 다름 (document)
3. index.css:170-179 reduced-motion 전역 차단으로 spin 단서 정지 (animate)
4. index.css:162-166 전역 focus-visible border-radius (polish)
5. shadow-md: RankBadge, Toaster, DropdownMenu (quieter)
6. 하드코딩 text-white, bg-black/50, Toaster 동작 버튼 36px (polish)
7. Label for 가 로딩 중 div 를 가리킴, 관리자 실명 하드코딩 (harden)
8. 로그인 오류 문구 상태 나열형, PIN 보기 토글 없음 (clarify)
9. PinChangeForm 성공 Alert role=alert (distill/harden)
10. Layout "27년 핸디" 하드코딩, Dialog 포커스 복원 대상 소실 (harden)

## 권장 순서

1. harden: 1, 2, 4, 6, 8
2. adapt: 7, 5, 640~900px 확인
3. typeset: DropdownMenu hint, Badge
4. extract: LoginForm
5. document 후 polish
