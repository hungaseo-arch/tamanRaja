# Impeccable 2차 재감사: 핸디 정책 (2026-11-20)

대상: `src/pages/HandicapPolicy.vue`(1036줄), `src/components/HandicapResultsTable.vue`(891줄), `src/components/PolicySection.vue`(75줄)
기준: `reaudit-핸디정책.md`(1차 재감사). 코드 수정 없음.
방식: 소스 판독 + `impeccable detect`(regex 규칙만, .vue 요소 규칙 미실행, 어드바이저리 4건, 안티패턴 0건). **375px 렌더 실측 없음.** 대비·터치 크기·줄바꿈·스크롤 동작은 모두 추정.
기확정(대상 제외): '25년' 표기, 인간미 청록, 범례 번호 원 중심 들여쓰기, 삭제 안내문구 복원 금지, 정렬 화살표 제거, 한도 빨강, 본문 14px, xs 32px·13px.

## 1. 점수 이전 → 현재

### audit (20점)
| 차원 | 이전 | 현재 | 근거 |
|---|---|---|---|
| 접근성 | 3 | 4 | 참조 버튼화, 토글 이름에 번호 포함. 단 label-in-name 불일치(N-1) 잔존 |
| 성능 | 3 | 3 | 변화 없음 (Course Rating 마운트 조회) |
| 테마 | 3 | 3 | `.policy-ref`가 페이지 전역 CSS에 있고 표 컴포넌트가 사용(P2-f 연장) |
| 반응형 | 4 | 4 | 변화 없음 |
| 구현 정합성 | 3 | 3 | 변화 없음. 참조 id 5종은 `handicapPolicy.test.ts:311`이 검증 |
| **합계** | **16** | **17** | Good |

### critique (40점 환산)
| # | 휴리스틱 | 이전 | 현재 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | 3 |
| 2 | 현실 세계 일치 | 3 | 3 |
| 3 | 사용자 제어 | 3 | 3 |
| 4 | 일관성·표준 | 3 | 3 |
| 5 | 오류 예방 | 3 | 3 |
| 6 | 인식 우선 | 3 | 3 |
| 7 | 유연성·효율 | 2 | 3 (참조에서 대상 섹션으로 바로 이동) |
| 8 | 미니멀 디자인 | 2 | 2 |
| 9 | 오류 복구 | 4 | 4 |
| 10 | 도움말 | 2 | 3 (산식 ③④⑤⑦·휴면 안내 연결) |
| **합계** | | **28** | **30** |

## 2. 건수 (audit+critique 통합, 중복 제거)
| 등급 | 이전 | 현재 | 비고 |
|---|---|---|---|
| P0 | 0 | 0 | |
| P1 | 1 | 0 | R-1 해결 |
| P2 | 10 | 11 | 신규 1 (N-1) |
| P3 | 6 | 11 | 신규 5 (N-2~N-6) |

## 3. 잔여 P1 해결 여부: R-1 해결 (종결)
| 항목 | 판정 | 근거 |
|---|---|---|
| 교차참조가 링크 아님 | 해결 | `HandicapPolicy.vue:270`(산식 ③④⑤⑦ 4건), `:656`(아래 안내문), `HandicapResultsTable.vue:567`(9번 섹션)이 `<button class="policy-ref">`로 바뀜. `PolicySection.vue:6-8` window 이벤트 + `:33-48` 펼침·스크롤·포커스. 해시 라우터라 `#앵커` 불가한 제약에 맞는 방식 |
| 번호 aria-hidden으로 대상 식별 불가 | 해결 | `PolicySection.vue:31, 61` 토글 이름 "3번 구간 가중" 형태. 참조 문구 "3번 섹션"과 이름이 대응 |
| 접힌 섹션 도달 | 해결 | `:37` open=true 후 nextTick 스크롤. 대상이 섹션 내부 요소(`sec-dormant-note`)여도 `rootEl.contains` 로 소유 섹션만 반응(`:36`) |
| 포커스 이동 | 해결 | 섹션이면 토글 버튼(`:42`), 내부 요소면 tabindex=-1 부여 후 포커스(`:44-45`). 스크롤은 `preventScroll`로 이중 스크롤 방지, `prefers-reduced-motion` 존중(`:39`) |
| 9번 이동 150ms setTimeout | 동작함, 취약 (N-3) | `Dialog.vue`: 닫힘 시 `lastFocused.focus()` 즉시, 스크롤 잠금 즉시 해제, 이탈 전환 150ms. 뒤에 실행되는 섹션 포커스가 최종 승리하므로 포커스는 9번 토글에 안착. 타이머와 전환 시간이 같은 숫자라 우연히 맞는 구조 |
| 인쇄 | 이상 없음 | `HandicapPolicy.vue:1014-1018` 참조 버튼은 밑줄·색 제거돼 본문 글자로 인쇄. 접힌 섹션은 `.policy-body{display:block !important}`가 인라인 `v-show`를 이김. `openAllDetails`는 `<details>`만 담당 |

## 4. 남은·신규 P0·P1
P0 없음. P1 없음.

## 5. 신규 P2

### [P2] N-1. 토글 `aria-label`이 보이는 이름과 불일치 (WCAG 2.5.3 Label in Name)
- 위치: `PolicySection.vue:31`(toggleLabel), `:61`(`:aria-label`), `:66-67`(보이는 글자 "3" + 제목)
- 문제: 보이는 이름은 "3 구간 가중", 접근 가능한 이름은 "3번 구간 가중". 음성 제어("3 구간 가중 누르기")는 연속 문자열이 달라 실패할 수 있음. `aria-label`이 내부 텍스트를 통째로 덮어 제목 변경 시 이중 관리. 스크린리더 사용자에겐 이득이 크고 영향 범위는 좁음(P1 아님)
- 추천: `aria-label` 제거, 번호 원 안에 `<span class="sr-only">번</span>` 또는 번호 원 aria-hidden 해제하고 "3" 뒤 sr-only "번 " 추가해 보이는 글자가 이름에 그대로 포함되게 함
- 추천 명령: `/impeccable harden`
- 공유 자원: 예. `PolicySection`은 페이지 9개 섹션 전부. 클래스명(`policy-toggle`, `policy-no`)은 페이지 CSS 소유라 변경 금지. `handicapPolicy.test.ts`가 이름을 검증하면 함께 갱신

## 6. 신규 P3
| ID | 문제 | 위치 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|
| N-2 | `toggleLabel`이 setup 시 1회 계산(비반응). props 변경 시 갱신 안 됨. 현재 정적 사용이라 실해 없음 | `PolicySection.vue:31` | `/impeccable harden` (N-1 수정 시 소멸) | 예 |
| N-3 | 150ms `setTimeout` 미해제(언마운트 시), 모달 이탈 전환(150ms)과 숫자 결합. 전환 시간 변경 시 포커스 경쟁 가능 | `HandicapResultsTable.vue:155-158`, `Dialog.vue` 이탈 전환 | `/impeccable harden` (모달 `after-leave` 이벤트 또는 `nextTick` 기반으로) | 예. `Dialog.vue`는 앱 전역 |
| N-4 | `sec-dormant-note` 포커스 대상이 이름 없는 `div`. 스크린리더가 "그룹"조차 안내 못 함. tabindex=-1이 DOM에 영구 잔존 | `HandicapPolicy.vue:662`, `PolicySection.vue:44` | `/impeccable harden` (`role="group" aria-labelledby`) | 아니오 |
| N-5 | `.policy-ref` 터치 높이 추정 약 38px(줄 높이 + 패딩 상하 0.5rem). 인라인 요소의 음수 margin은 무효. 줄바꿈 시 인접 줄과 히트 영역 겹침. 원칙 44px 미달 | `HandicapPolicy.vue:717-727` | `/impeccable adapt` (`.policy-link::after` 방식 재사용) | 예. 표 파일 모달도 사용 |
| N-6 | 참조로 이동한 뒤 돌아갈 수단 없음(되돌아가기·원래 위치 복귀). 참조 라벨 "3번 섹션"만으로는 목적 불명 | `HandicapPolicy.vue:55-82` | `/impeccable clarify` | 아니오 |

## 7. 기존 P2·P3 변동
- P2-g(9개 접이식 섹션, 전체 펼침·목차 없음): 직링크는 참조 버튼으로 부분 해소됐으나 목차·전체 펼침은 없음. 유지
- P2-f(컴포넌트 스타일이 페이지 파일에 묶임): `.policy-ref`가 추가 사례. 유지
- 그 외 P2-a~e, h~j, 기존 P3 6건 변동 없음. detector 어드바이저리 4건 줄번호만 이동(`HandicapPolicy.vue:740, 754`, `HandicapResultsTable.vue:656, 877`)

## 8. 권장 순서
1. `/impeccable harden`: N-1·N-2(sr-only로 전환), N-3·N-4
2. `/impeccable adapt`: N-5 (375px 렌더 실측으로 터치 높이 확인)
3. 이후 1차 재감사 8절 순서(layout → typeset/colorize → document/polish)
