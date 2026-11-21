# Impeccable audit 3차: 핸디 정책·산정결과 (2026-11-21)

대상: `src/pages/HandicapPolicy.vue`(1036줄), `src/components/HandicapResultsTable.vue`(880줄), `src/components/PolicySection.vue`(75줄), `src/components/MemberHandicapTrend.vue`(173줄)
기준: `reaudit2-핸디정책.md`, `term-consistency.md`, `00_통합표.md`. 작업트리 기준(미커밋 변경은 `MonthlyTable.vue`뿐, 대상 4파일은 HEAD와 동일). 코드 수정 없음.
방식: 소스 판독 + `impeccable detect`(안티패턴 0건, 어드바이저리 6건). **375px 렌더·대비·터치 실측 없음.** 아래 대비·터치·줄바꿈은 코드 기반 추정.
제외(확정): Button/Select xs 32px·13px, 한도 빨강, 본문 14px, 삭제 안내문구 복원, 모바일 Input·Select 16px, '25년' 표기, 정렬 화살표 제거, 인간미 청록, 범례 번호 원 들여쓰기, 추이 그래프 9px/8.5px·표 없는 선 그래프·빈 점. 모바일 캡션·상세 패널·범례의 인상/인하 글자(의도적 유지).
점수 표기: 항목마다 감점 차원(0-4 점수 기준)을 적고, 총점(0-20)은 1절에 둠.

## 1. Audit Health Score: 15/20 (Good, 약한 차원 보완)

| # | 차원 | 점수 | 핵심 |
|---|---|---|---|
| 1 | 접근성 | 3 | 토글 `aria-label`이 보이는 이름과 불일치(N-1 잔존). 표 10여 개에 이름(caption) 없음 |
| 2 | 성능 | 3 | 정적 데이터 표 다수가 마운트 시 전부 렌더(접힌 섹션도 `v-show`). 실해 없음 |
| 3 | 테마 | 3 | 빨강 한 색에 의미 3~4종이 겹침(인상·한도·불리·채택). 전역 클래스 `.pp-up`·`.policy-flag` 공유 |
| 4 | 반응형 | 3 | 모바일 12px 핵심값(P2-c 잔존), `.policy-ref` 터치 높이 약 38px(N-5), 관리자 입력 셀 32~36px |
| 5 | 구현 정합성 | 3 | 정적 회원 수치와 DB 값 혼재(P2-e), 죽은 함수 1건 |
| **합계** | | **15/20** | 2차 재감사(17)보다 낮은 것은 코드 퇴보가 아니라 감점 기준을 엄격히 잡은 결과임. 4파일은 HEAD와 동일 |

### 구현 정합성 판정: 통과(조건부)
모임 전용 어휘(인간미·제안·한도 적용·휴면)와 `--std-accent`·`--humanity`·`--delta-*` 토큰이 일관됨. 범용 템플릿 흔적 없음. 결과 표는 "DB 값을 다시 계산하지 않는다"는 원칙을 지키나 정책 페이지 쪽은 정적 회원 수치(WHS·한도 적용자·코스 지수)가 섞여 있음. detector 어드바이저리 6건은 전부 기존 DESIGN.md 척도 밖 값(1rem·999px·0.1875rem·0.625rem 인쇄 표)이며 그래프 9px/8.5px 2건은 확정 제외.

## 2. 건수 (신규 + 잔존 합산)

| 등급 | 신규 | 잔존(이전 보고서) | 합계 |
|---|---|---|---|
| P0 | 0 | 0 | 0 |
| P1 | 0 | 0 | 0 |
| P2 | 4 | 11 | 15 |
| P3 | 6 | 11 | 17 |

P0·P1 없음. 단 375px 렌더 실측을 하지 않아 접근성·터치 항목은 실측 후 상향 가능.

## 3. 신규 P2

### [P2] A3-1. 빨강의 뜻이 한 페이지에서 반대로 쓰임: "불리"가 빨강, "인상(유리)"도 빨강
- 위치: `HandicapPolicy.vue:493-494`(`class="num pp-up"` + "2.6타 불리", "3.2타 불리"), 범례 `HandicapResultsTable.vue:363`("빨강 인상 = 타수를 더 받는 쪽(유리)")
- 문제: 같은 화면에서 빨강이 "유리(인상)"와 "불리"를 동시에 가리킴. 중장년 독자가 범례를 기억한 채 3타 인상 설명을 읽으면 "불리 = 손해"로 읽어 인상이 혜택이라는 바로 위 문장(`:477`)과 충돌. PRODUCT 원칙 3(의미색을 섞지 않음) 위반. 글자("불리")가 있어 색만으로 전달은 아님
- 추천: 이 두 칸의 색 제거(중립 글자 + 굵게) 또는 `--warning`계열로 분리
- 추천 명령: `/impeccable colorize`
- 공유 자원: 예. `.pp-up`은 표·모달·WHS 표가 공유(색 정의 변경 금지, 이 두 칸의 클래스만 제거)
- 감점 차원: 테마(3)

### [P2] A3-2. "채택" 배지가 한도·인상과 같은 빨강
- 위치: `HandicapPolicy.vue:388`(`<span class="policy-flag">채택</span>`), 기본 정의 `:977-987`(`border/color: var(--pp-up)`)
- 문제: `.policy-flag` 기본값이 빨강이라 긍정 의미 "채택(×6 선택)"이 한도 적용(`:469`)과 같은 경고색으로 나옴. 같은 표 안에서 선택된 행이 가장 위험해 보임
- 추천: 채택 전용 변형(`policy-flag-ok`, `--primary`) 추가 또는 배지 대신 굵은 글자와 행 배경
- 추천 명령: `/impeccable colorize`
- 공유 자원: 예. `.policy-flag`는 표 파일(`.pp-results .policy-flag`)과 한도 목록이 공유. 기본 색 변경 금지, 변형 클래스만 추가
- 감점 차원: 테마(3)

### [P2] A3-3. "표본 부족"의 색이 표와 상세 창에서 다름
- 위치: 표 `HandicapResultsTable.vue:409`(주황 `.pp-flag-low`, 정의 `:755-758`), 상세 창 `:572`(`pp-up` 빨강)
- 문제: 같은 상태가 표에서는 주황, 상세 창에서는 빨강. 빨강은 한도 적용 전용이라는 확정 결정과도 어긋나 한도와 구분이 사라짐
- 추천: `:572`를 `.pp-flag-low`와 같은 `--warning` 색으로 맞춤(한도 줄 `:569` 빨강은 확정 결정이라 유지)
- 추천 명령: `/impeccable polish`
- 공유 자원: 아니오(같은 파일)
- 감점 차원: 구현 정합성(3)

### [P2] A3-4. 인간미 수정 중 "인간미"·"27년 제안" 정렬이면 입력 칸이 키 입력마다 이동
- 위치: `HandicapResultsTable.vue:122-145`(`humanityOf`가 draft를 읽고 `sorted`가 그 값으로 정렬), `:138`, `:430`(입력 칸)
- 문제: 정렬 키가 `humanity`·`proposal`일 때 한 글자 입력으로 순서가 바뀌어 행이 다른 위치로 이동. 포커스가 DOM 이동으로 풀리거나 방금 입력한 회원이 화면 밖으로 사라질 수 있음. 관리자 입력 안정성 원칙(PRODUCT 원칙 4)과 상충. 기본 정렬(27년 기준)에서는 발생 안 함
- 추천: 수정 모드 진입 시 정렬 순서를 고정(스냅샷)하고 저장·취소 후 갱신
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오
- 감점 차원: 구현 정합성(3)

## 4. 신규 P3

| ID | 문제 | 위치 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|
| A3-5 | 총합 문구가 "증가·감소·중립"(`totalLabel`)인데 같은 화면 용어는 인상·인하. `term-consistency` 목록에 없는 추가 변종 | `HandicapResultsTable.vue:231-234, 461, 464` | `/impeccable clarify` | 아니오 |
| A3-6 | `fmtSigned`가 정의만 있고 호출 없음(죽은 코드). 이름이 유사한 `fmtSigned2`·`fmtSigned3`·`fmtSignedInt`와 혼동 유발 | `HandicapResultsTable.vue:177-183` | `/impeccable distill` | 아니오 |
| A3-7 | 표본 부족 배지에 `title="표본 부족"`. 보이는 글자와 같은 툴팁이라 스크린리더가 중복 낭독하고 터치에선 무의미 | `HandicapResultsTable.vue:409` | `/impeccable polish` | 아니오 |
| A3-8 | 정책 표 10여 개와 결과 표에 `caption`·`aria-label` 없음. 표 탐색 시 이름 없는 표로 나열. 하위 제목(예시·계수 6 이유·표본 부족 보완·이성남 안내)이 `<p class="policy-card-title">`이라 제목 구조에 안 잡힘 | `HandicapPolicy.vue:280, 309, 339, 378, 413, 445, 482, 518, 563, 599`, 소제목 `:371, 435, 663`, `HandicapResultsTable.vue:380` | `/impeccable harden` | 표 파일은 `policy-table` 공유(클래스 변경 없이 속성만 추가) |
| A3-9 | 관리자 입력 영역 터치·글자: 모바일 입력 칸 높이 36px(`h-9`), 셀 버튼 최소 32px, 오류 문구 12px. WCAG 2.5.8(24px)은 충족하나 PRODUCT 44px·14px 미달. 관리자 소수라 낮게 판정. 입력도 자유 숫자라 5개 값(−2~+2)을 선택형으로 받으면 오입력 자체가 사라짐 | `HandicapResultsTable.vue:430, 711-717, 703-706, 375` | `/impeccable adapt` | 아니오(Input·Button 공유 컴포넌트는 건드리지 않고 이 파일 클래스만) |
| A3-10 | 상세 창 휴면 안내 문단이 `text-align: right`로 긴 문장(참조 버튼 포함)을 우측 정렬해 줄 시작이 들쭉날쭉. 값 칸용 스타일을 문장에 재사용 | `HandicapResultsTable.vue:850-854, 566, 572` | `/impeccable layout` | `.pp-note-text`는 이 파일 안에서만 사용 |

## 5. 잔존 항목 (이전 보고서 미해결, 코드 변동 없음)

| ID | 등급 | 상태 | 위치(현재) | 추천 명령 | 공유 자원 |
|---|---|---|---|---|---|
| N-1 토글 aria-label이 보이는 이름과 불일치(WCAG 2.5.3) | P2 | 잔존 | `PolicySection.vue:31, 61, 66-67` | `/impeccable harden` | 예. 9개 섹션 전부 |
| P2-a 27년 기준·제안이 같은 보라 굵은 글씨, 구분은 8% 배경뿐 | P2 | 잔존 | `HandicapResultsTable.vue:595-597, 621-625` | `/impeccable layout` | `.pp-std`는 상세 창·WHS 표도 사용 |
| P2-b 연도 표기 혼재("26년 기준" 열 vs "2026" 캡션·정책 표) | P2 | 잔존 | `HandicapResultsTable.vue:336, 417` · `HandicapPolicy.vue:486, 604-605` | `/impeccable clarify` | 아니오 |
| P2-c 모바일 핵심값 12px(머리글·캡션·배지) | P2 | 잔존 | `HandicapResultsTable.vue:603, 649, 671-674` | `/impeccable typeset` | 아니오 |
| P2-d 12px 의미색 배지 대비 미실측(`--warning` 가장 불리) | P2 | 잔존 | `HandicapResultsTable.vue:755-758` | `/impeccable audit`(실측) | 토큰은 전역 |
| P2-e 하드코딩 잔존("1.1타", "13명은 분모 11", "60.0%", "17개 모임", "3.00") | P2 | 잔존 | `HandicapPolicy.vue:302, 404, 431, 645` · `HandicapResultsTable.vue:364` | `/impeccable harden` | 아니오 |
| P2-f 컴포넌트 스타일이 페이지 파일에 묶임(`.pp-up`·`.policy-ref`·`.policy-flag`) | P2 | 잔존 | `HandicapPolicy.vue:684-1036` · `HandicapResultsTable.vue:614-620` | `/impeccable document` | 예 |
| P2-g 9개 접이식 섹션, 전체 펼침·목차 없음 | P2 | 잔존 | `PolicySection.vue:17-27` | `/impeccable layout` | 예 |
| P2-h 적용 일정이 맨 끝, 이의 경로 없음 | P2 | 잔존 | `HandicapPolicy.vue:649-679` | `/impeccable clarify` | 아니오 |
| P2-i 문체 혼재("임·함" 종결) | P2 | 잔존 | `HandicapPolicy.vue:477-478, 665-676` | `/impeccable clarify` | 아니오 |
| P2-j 모바일 표 가로 스크롤 단서 없음 | P2 | 잔존 | `HandicapPolicy.vue:819-823` | `/impeccable adapt` | 예. `.policy-table-wrap` 전 표 |
| N-5 `.policy-ref` 터치 높이 약 38px(인라인 음수 margin 무효) | P3 | 잔존 | `HandicapPolicy.vue:717-727` | `/impeccable adapt` | 예. 표 파일 모달도 사용 |
| N-3 150ms `setTimeout` 미해제·모달 전환 시간과 숫자 결합 | P3 | 잔존 | `HandicapResultsTable.vue:155-158` | `/impeccable harden` | `Dialog.vue` 전역 |
| N-2 `toggleLabel` 비반응(1회 계산) | P3 | 잔존 | `PolicySection.vue:31` | `/impeccable harden` | 예 |
| N-4 `sec-dormant-note` 포커스 대상이 이름 없는 div, tabindex 영구 잔존 | P3 | 잔존 | `HandicapPolicy.vue:662` · `PolicySection.vue:44` | `/impeccable harden` | 예(PolicySection) |
| N-6 참조 이동 뒤 되돌아갈 수단 없음 | P3 | 잔존 | `HandicapPolicy.vue:270, 656` | `/impeccable clarify` | 아니오 |
| 앱 내 이동 시 수정 중 입력 소실(beforeunload는 탭 닫기만 처리) | P3 | 잔존 | `HandicapResultsTable.vue:324-331` | `/impeccable harden` | 아니오 |
| 추이 상·하반기 분리가 2026 하드코딩, 월별 조회 실패는 조용히 폴백 | P3 | 잔존 | `MemberHandicapTrend.vue:20-21, 60-66` | `/impeccable harden` | 아니오 |
| 추이 aria-label의 "(안)" 접미 용어 | P3 | 잔존 | `MemberHandicapTrend.vue:129` | `/impeccable clarify` | 아니오 |
| detector 어드바이저리(1rem·999px·0.1875rem·0.625rem) | P3 | 잔존 | `HandicapPolicy.vue:740, 754` · `HandicapResultsTable.vue:648, 866` | `/impeccable document` | DESIGN.md 척도 확장 시 전역 |

## 6. 이번 변경(증감 칸 인상/인하 글자 삭제) 검증

| 확인 | 결과 |
|---|---|
| 색만으로 전달 위반 여부 | 아님. 증감 칸(`HandicapResultsTable.vue:448-450`)은 `+`·`−` 부호와 숫자가 그대로 있고 0은 무색. 인간미 칸(`:423, 444-445`)도 부호 병기 |
| 범례와 칸의 정합 | 범례(`:363`)의 "빨강 인상 / 파랑 인하"가 색 해설로 남아 칸에는 없는 낱말을 설명. 증감 머리글과 부호로 연결되므로 문제 없음. 범례에 "+는 빨강" 식 부호 연결은 없음(P3 수준, 별도 항목 안 만듦) |
| 죽은 코드 발생 | `deltaLabel`은 캡션(`:419`)·상세 창(`:539`)에서 계속 사용되어 정상. 죽은 코드는 이번 변경과 무관한 `fmtSigned`(A3-6)뿐 |
| 인쇄 표 | `:487-488`은 원래 숫자만. 변경 영향 없음 |
| 모바일 캡션 | `2026 10 +0.50 인상` 유지(의도적). 다만 데스크톱 칸에는 글자가 없어 같은 값이 화면 폭에 따라 다르게 표기되나 확정 결정 범위 |

## 7. 잘 되어 있는 점

- 증감·인간미·WHS 차이 전부 부호 문자 병기라 색 의존 없음(`fmtSigned2`, `fmtDiff`).
- 참조 버튼화·섹션 펼침·포커스 이동(`PolicySection.vue:33-48`)과 `prefers-reduced-motion` 존중이 동작함.
- 저장 전 확인 창(`:281-297, 513-528`), 서버 재조회(`:312`), 범위 검증과 `role="alert"`로 관리자 입력 안전장치가 갖춰짐.
- 정렬 헤더 버튼 + `aria-sort`, 모바일 정렬·성명 버튼 최소 44px(`:822-827`).
- 인쇄 전용 근거 표와 `beforeprint` 펼침 처리로 종이 출력 완결.
- 추이 그래프: `loadSeq` 경합 방지, 한국어 고정 오류 문구, `role="img"` + 값 포함 `aria-label`.

## 8. 권장 순서

1. `/impeccable colorize`: A3-1, A3-2 (빨강 의미 분리. `.pp-up`·`.policy-flag` 기본값은 두고 두 칸·배지에만 변형 적용)
2. `/impeccable harden`: A3-4, A3-8, N-1·N-2(sr-only 방식), N-3·N-4
3. `/impeccable polish`: A3-3, A3-7
4. `/impeccable clarify`: A3-5, P2-b, P2-i, P2-h, N-6
5. `/impeccable adapt`: A3-9, N-5, P2-j (375px 렌더·터치 실측 병행)
6. `/impeccable typeset`: P2-c, 이어서 `/impeccable audit`로 P2-d 대비 실측
7. `/impeccable distill`: A3-6
8. `/impeccable document` 후 `/impeccable polish`: P2-f, detector 어드바이저리 정리
