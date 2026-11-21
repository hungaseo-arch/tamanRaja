# Impeccable 재감사: 핸디 정책 (2026-11-20)

대상: `src/pages/HandicapPolicy.vue`(1006줄), `src/components/HandicapResultsTable.vue`(877줄), `src/components/PolicySection.vue`(38줄)
기준: 이전 `audit-핸디정책.md`, `critique-핸디정책.md`
방식: 소스 판독 + `impeccable detect`(regex 규칙만, .vue 요소 규칙 미실행, 어드바이저리 4건). 375px 렌더 실측 없음. 대비·터치·줄바꿈은 모두 추정.
주의: 작업 트리에 미커밋 변경 있음(`HandicapResultsTable.vue`, `src/index.css`). 아래 판정은 작업 트리 기준.
기확정(대상 제외): Button/Select xs 32px·13px, 한도 빨강, 본문 14px, 삭제된 안내문구 복원 금지, '25년' 표기, 정렬 화살표 제거. 11px 라벨·12px 관리자 버튼·번호 원 정렬·첫 줄 들여쓰기 없음도 제외.

## 1. 점수 이전 → 현재

### audit (20점)
| 차원 | 이전 | 현재 | 근거 |
|---|---|---|---|
| 접근성 | 3 | 3 | `ol role=list` + sr-only 단계 번호 해결. 섹션 번호 aria-hidden·교차 참조 잔존. 12px 배지 대비 미실측 |
| 성능 | 3 | 3 | Course Rating 마운트 조회 그대로 |
| 테마 | 3 | 3 | `--pp-blue/grey/sage` 별칭 잔존. 컴포넌트 스타일이 페이지 파일에 묶임 |
| 반응형 | 3 | 4 | 모바일 증감 캡션, 인쇄 전 details 펼침, 이름 열 sticky 추가 |
| 구현 정합성 | 3 | 3 | 수치 일부 파생화(`CAPPED_MEMBERS.length`, `DORMANT_NAMES`). "1.1타" 등 잔존 |
| **합계** | **15** | **16** | Good |

### critique (40점)
| # | 휴리스틱 | 이전 | 현재 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | 3 |
| 2 | 현실 세계 일치 | 2 | 3 (범례가 인간미·제안·한도·부족·휴면 정의) |
| 3 | 사용자 제어 | 3 | 3 (새로고침 경고 추가. 앱 내 이동 가드 없음) |
| 4 | 일관성·표준 | 3 | 3 |
| 5 | 오류 예방 | 3 | 3 |
| 6 | 인식 우선 | 2 | 3 (모바일 캡션으로 증감 노출) |
| 7 | 유연성·효율 | 2 | 2 |
| 8 | 미니멀 디자인 | 2 | 2 |
| 9 | 오류 복구 | 3 | 4 (`describeError` 통일) |
| 10 | 도움말 | 2 | 2 |
| **합계** | | **25** | **28** (Good 28~35 진입) |

## 2. 건수 (audit+critique 통합, 중복 제거)

| 등급 | 이전 | 현재 |
|---|---|---|
| P0 | 0 | 0 |
| P1 | 4 (critique) | 1 |
| P2 | 13 (audit 6 + critique 7) | 10 |
| P3 | 7 (audit 3 + critique 4) | 6 |

## 3. 이전 P1 해결 여부

| 이전 P1 | 판정 | 근거 |
|---|---|---|
| P1-1 인간미·제안 설명 부재, 보라 두 열 동일 | 부분 해결 (P2 로 강등) | 범례 `HandicapResultsTable.vue:355`가 "제안 = 기준 + 인간미"와 인간미 정의. 제안 열 8% 배경 `:589-591`. 단 두 열 모두 `.pp-std` 보라 굵은 글씨(`:406`, `:440`) |
| P1-2 모바일에서 증감 숨김 | 해결 | `:409-414` 27년 기준 칸 아래 캡션에 26년 값과 증감·인상/인하 병합. 표 foot 도 4열 대응(`:454`) |
| P1-3 교차 참조 비링크, 번호 aria-hidden | 미해결 | 아래 R-1 |
| P1-4 한도·인상 같은 빨강 | 종결 | 기확정 결정(한도 빨강 유지) |

## 4. 남은·신규 P0·P1

P0 없음.

### [P1] R-1. 섹션 교차 참조가 링크가 아니고 번호가 스크린리더에 안 읽힘 (이전 P1-3 잔존)
- 위치: `PolicySection.vue:29`(번호 `aria-hidden`), `:34`(`v-show` 접힘), `HandicapPolicy.vue:54, 60, 66, 78`("3번·4번·5번 섹션 참조"), `:647`("아래 안내문 참조"), `HandicapResultsTable.vue:151`(DORMANT_TIP "9번 섹션")
- 문제: 참조 대상은 기본 접힘(1·2번만 `default-open`). 이동·펼침 수단 없음. 제목 텍스트에 번호가 없어 스크린리더 사용자는 "3번 섹션"이 어느 것인지 알 수 없음. 중장년 사용자도 번호 원을 눈으로 찾아 직접 펼쳐야 함. 산식 ③④⑤⑦ 핵심 설명이 이 참조에 의존.
- 추천: 번호를 `aria-label` 또는 sr-only 텍스트로 제목에 포함. 참조를 버튼화해 해당 섹션 펼침+스크롤(`PolicySection`에 외부 제어 prop/emit).
- 추천 명령: `/impeccable harden`, 이어서 `/impeccable clarify`
- 공유 자원: 예. `PolicySection` 변경은 `HandicapPolicy.vue`와 `HandicapResultsTable.vue`(모달 문구) 양쪽에 영향. 번호 외 클래스명(`policy-toggle` 등)은 페이지 파일 CSS가 소유하므로 이름 변경 금지

신규 P1 없음.

## 5. P2 (참고, 상세 생략)

| ID | 문제 | 위치 | 추천 명령 | 공유 자원 |
|---|---|---|---|---|
| P2-a | 27년 기준·27년 제안 모두 보라 굵은 글씨. 구분은 8% 배경뿐(P1-1 잔존분) | `HandicapResultsTable.vue:406, 440, 589-591, 615-619` | `/impeccable layout` | `.pp-std`는 `RowDetailDialog`·WHS 표도 사용. 열 단위 클래스 분리, `--std-accent` 토큰 불변 |
| P2-b | 연도 표기 불일치: '25년' 확정 후에도 "2026 기준", "2027 기준(안)", "(2026)" 남음 | `HandicapResultsTable.vue:410`, `HandicapPolicy.vue:477, 595-598, 636` | `/impeccable clarify` | 아니오 |
| P2-c | 모바일 핵심 값이 12px: 머리글, 증감 캡션, 배지, 증감 라벨. PRODUCT 원칙 14px 미만 | `HandicapResultsTable.vue:597, 624, 650, 673-675` | `/impeccable typeset` | 아니오(이 파일 CSS) |
| P2-d | 12px 의미색 배지 대비 미실측(`--warning` L .554 가 가장 불리, 추정 4.5 전후) | `HandicapResultsTable.vue:745-752`, `HandicapPolicy.vue:951-961` | `/impeccable audit`(실측) 후 `/impeccable colorize` | 토큰(`--warning`, `--delta-*`)은 전역. 배지 쪽만 고치면 한정 |
| P2-e | 하드코딩 잔존: "1.1타", "13명은 분모 11", "60.0%", "17개 모임", 범례의 "3.00" | `HandicapPolicy.vue:636, 395, 293, 423`, `HandicapResultsTable.vue:357` | `/impeccable harden` | 아니오 |
| P2-f | 컴포넌트 스타일이 페이지 파일에 묶임. `.pp-up/.pp-down`은 표 파일 정의, 페이지·모달이 사용 | `HandicapPolicy.vue:699-1006`, `HandicapResultsTable.vue:608-614` | `/impeccable document` 후 `/impeccable polish` | 예. 사용처 검색 후 이동 |
| P2-g | 9개 접이식 섹션: 전체 펼침·목차·직링크 없음 | `PolicySection.vue:16-34`, `HandicapPolicy.vue:254-670` | `/impeccable layout`, `/impeccable distill` | `PolicySection`(R-1 과 동일) |
| P2-h | 적용 일정(9번)이 맨 끝, 의견·이의 경로 없음 | `HandicapPolicy.vue:640-670` | `/impeccable clarify` | 아니오 |
| P2-i | 문체 혼재("임/함" 종결과 개조식) | `HandicapPolicy.vue:468-471, 656-667` | `/impeccable clarify` | 아니오 |
| P2-j | 모바일 표 가로 스크롤 단서 없음(전역 `overflow-x:auto`만) | `HandicapPolicy.vue:793-797` | `/impeccable adapt` | `.policy-table-wrap` 전 표 공유 |

## 6. P3

- 별칭 이름 `--pp-blue/grey/sage`가 실제 값(muted/card/secondary)과 반대로 읽힘: `HandicapPolicy.vue:680-682`. 표 파일이 참조(`HandicapResultsTable.vue:783, 787, 831`)
- Course Rating 마운트 시 조회: `HandicapPolicy.vue:11`
- detector 어드바이저리 4건: `HandicapPolicy.vue:714`(1rem), `:728`(999px), `HandicapResultsTable.vue:649`(0.1875rem), `:863`(0.625rem, 인쇄 전용). DESIGN.md 척도 확장 또는 정리 필요
- 오래된 주석: `HandicapResultsTable.vue:631`("성명 90px · 2027 기준 90px")이 실제 값(80/56/64px)과 어긋남
- 범례 3줄이 모바일에서 표 위를 길게 차지(`HandicapResultsTable.vue:354-358`). 줄 수 축소 검토
- 한도 목록의 "채택" 표시가 빨강 `policy-flag`(`HandicapPolicy.vue:379`)라 빨강 뜻이 한 번 더 섞임. 중립 톤 검토

## 7. 이전 이슈 판정 일람

| 이전 이슈 | 판정 |
|---|---|
| audit P2 본문 14px | 종결(결정) |
| audit P2 의미색 대비 | 미해결(P2-d) |
| audit P2 하드코딩 | 부분 해결(P2-e) |
| audit P2 인쇄 details | 해결 (`HandicapPolicy.vue:12-34` beforeprint/afterprint). 실제 인쇄 미리보기 확인 권장 |
| audit P2 전역 CSS 의존 | 미해결(P2-f) |
| audit P2 오류 원문 노출 | 해결 (`:237` `describeError`) |
| audit P3 별칭·지연 조회 | 미해결 |
| audit P3 `ol` 의미 | 해결 (`:260-262` role + sr-only n단계) |
| critique P2-1 확정 전 안 표시 | 종결(의도 삭제, h1 "(안)" 유지) |
| critique P2-2 빨강 범례 | 해결 (`ResultsTable:356`) |
| critique P2-3 섹션 구조 | 미해결(P2-g) |
| critique P2-4 일정·문의 | 미해결(P2-h) |
| critique P2-5 배지 뜻 | 해결 (범례 `:357`) |
| critique P2-6 문체 | 미해결(P2-i) |
| critique P2-7 머리글 12px·스크롤 | 부분 해결. 640px 이상 14px, 모바일 12px 잔존(P2-c, P2-j) |
| critique P3-1 정렬 표시 | 종결(결정) |
| critique P3-2 이탈 가드 | 부분 해결 (`ResultsTable:99, 317` beforeunload. 앱 내 이동은 미처리) |
| critique P3-3 detector | 미해결 |
| critique P3-4 오류 원문 | 해결 |

## 8. 권장 순서
1. `/impeccable harden` + `clarify`: R-1 (번호 접근성, 참조 버튼화), P2-b, P2-e, P2-i
2. `/impeccable layout`: P2-a, P2-g
3. `/impeccable audit`(대비 실측, 375px 렌더) 후 `colorize`/`typeset`: P2-c, P2-d
4. `/impeccable document` → `polish`: P2-f, P3 정리
