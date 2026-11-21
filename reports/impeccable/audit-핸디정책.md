# Impeccable Audit: 핸디 정책 (2026-11-20)

대상: `src/pages/HandicapPolicy.vue`, `src/components/PolicySection.vue`, `src/components/HandicapResultsTable.vue`
방식: 소스 정독 + `impeccable detect`(어드바이저리 5건). 렌더링·터치 합성은 실행하지 않았고, 대비는 oklch 명도로 추정한 값임(실측 필요 표시).
제외(의도, 재론 안 함): 11px 라벨, 12px 관리자 버튼, 섹션 본문 글만 번호 원 중심 정렬, 첫 줄 들여쓰기 없음.

## 점수: 15 / 20 (Good, 약한 차원 보완)

| # | 차원 | 점수 | 핵심 |
|---|------|------|------|
| 1 | 접근성 | 3 | 표 `scope`, `aria-sort`, `aria-expanded/controls`, 색+부호+라벨 병기가 잘 되어 있음. 의미색 대비가 경계선 |
| 2 | 성능 | 3 | 정적 데이터 위주로 가벼움. 닫힌 섹션 데이터도 마운트 시 조회 |
| 3 | 테마 | 3 | 토큰 중심. 별칭 이름이 실제 뜻과 어긋나고 전역 CSS가 섹션 밖으로 샘 |
| 4 | 반응형 | 3 | 375px 대응(열 숨김·캡션 이동)이 촘촘함. 큰 글씨 배율 검증 필요 |
| 5 | 구현 정합성 | 3 | 모임 전용 체계는 일관. 본문 크기가 DESIGN.md와 불일치, 값 하드코딩 중복 |
| **합계** | | **15/20** | **Good** |

건수: P0 0 / P1 0 / P2 6 / P3 3

## 구현 정합성 판정: 통과
초록 토큰 체계, `font-mono` 숫자, 표 중심, 부호+라벨 병기가 DESIGN.md 규칙과 맞음. 범용 템플릿 흔적 없음. detector 5건은 모두 어드바이저리이며 아래 P3 와 겹침(1rem 토글 글자, 999px 번호 원, 0.1875rem·0.6875rem 배지, 0.625rem 인쇄 표). 인쇄 표 0.625rem 은 인쇄 전용이라 허용 가능.

## 요약
- 막힘(P0)·주요(P1) 없음. 다음 정리 대상은 P2 여섯 건.
- 상위 이슈: (1) 본문 14px vs DESIGN.md "본문 16px" 불일치, (2) 의미색 소형 글자 대비 경계선, (3) 정책 수치·회원 명단 하드코딩 중복, (4) 닫힌 `details` 인쇄 노출 위험, (5) 결과 표 CSS가 페이지 파일에 묶임.

## 상세 결과

### [P2] 본문 14px: DESIGN.md "본문 16px" 규칙과 어긋남
- 위치: `HandicapPolicy.vue:713-717`(.policy-body 0.875rem), `:752-755`(.policy-note), `:777`(.policy-table), `:917`(.policy-list)
- 분류: 구현 정합성 / 타이포
- 영향: 이 화면은 Read 성격이라 긴 한글 문단을 중장년이 스마트폰에서 읽음. DESIGN.md Do 항목은 "컨트롤 14px, 본문 16px"인데 Typography 절은 본문 14px로 적어 문서 자체가 모순. 화면은 14px 쪽을 따름.
- 표준: 해당 없음(WCAG 최소 크기 규정 없음, 제품 원칙 위반)
- 추천: 문단·`policy-note`·목록만 16px, 표·수식은 14px 유지. 먼저 DESIGN.md 모순을 정리.
- 추천 명령: `/impeccable typeset`, 이어서 `/impeccable document`
- 공유 자원: 아니오(이 페이지 CSS). 단 DESIGN.md 정정은 전역 문서

### [P2] 의미색 소형 글자 대비 경계선
- 위치: `HandicapResultsTable.vue:683-694`(한도 빨강·부족 주황·휴면 회색 11px 배지), `:560-566`(`pp-delta-label` 12px), `HandicapPolicy.vue:925-936`(`policy-flag`)
- 분류: 접근성
- 영향: `--delta-up`(L .55), `--warning`(L .554), `--delta-down`(L .546)을 카드 배경(L .98)에 놓으면 명도 기준 약 4.5~4.7:1로 추정. 11~12px 글자는 4.5:1 필요라 여유가 거의 없음. 주황 `--warning`이 가장 불리할 수 있음(실측 필요).
- 표준: WCAG 1.4.3 (AA 4.5:1), 추정치이므로 렌더링 후 실측
- 추천: 실제 색값으로 대비 실측. 4.5 미만이면 배지 글자는 `--foreground`, 테두리만 의미색으로 분리.
- 추천 명령: `/impeccable audit`(재측정), `/impeccable colorize`
- 공유 자원: 예. `--warning`, `--delta-up`, `--delta-down` 은 `src/index.css` 전역 토큰. 토큰 값을 바꾸면 다른 화면에 영향. 배지 쪽만 고치면 이 파일 한정

### [P2] 정책 수치·명단 하드코딩 중복(드리프트 위험)
- 위치: `HandicapPolicy.vue:80-97`(시상 예시), `:122-128`(한도 적용 5명), `:131-139`(코스 난이도), `:143-158`(WHS 14명), `:430`("5명"), `:611`("1.1타", "활동회원 14명", 휴면 3명 이름), `:271-273`, `:371-372`
- 분류: 구현 정합성
- 영향: 주석이 "DB handicap_annual 과 동일"이라고 적었지만 코드로 보장되지 않음. 결과 표는 DB에서 읽고 설명·예시는 상수라, 데이터가 갱신되면 같은 화면 안에서 값이 엇갈림. 특히 `:611`의 "1.1타"는 계산식(`meanAbsDiff`)과 별개 하드코딩이고 `:430`의 "5명"은 `CAPPED_MEMBERS.length`를 안 씀.
- 추천: 개수·평균은 상수에서 파생(`CAPPED_MEMBERS.length` 등). 확정 후 정적 근거 자료임을 파일 머리에 명시하거나 DB 조회로 통일.
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오

### [P2] 닫힌 `<details>` 가 인쇄에서 빠질 수 있음
- 위치: `HandicapPolicy.vue:973-976`(`.policy-details > :not(summary) { display: block }`), 대상 `:306`, `:440`, `:518`
- 분류: 반응형(인쇄) / 구현
- 영향: 이 화면은 "인쇄용 근거" 목적(PRODUCT.md). 최근 Chromium 은 닫힌 details 내용을 `display` 덮어쓰기로 되살리지 못하는 경우가 있어, 박영진 예시·3타 인상 설명·Course Rating 표가 종이에서 누락될 수 있음.
- 추천: 인쇄 전 `beforeprint`에서 `details`에 `open` 속성을 부여하고 `afterprint`에 복구. 실제 인쇄 미리보기로 확인.
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오

### [P2] 결과 표가 페이지 파일의 전역 CSS에 의존
- 위치: `HandicapResultsTable.vue` 전체(`policy-table`, `policy-note`, `policy-flag`, `--pp-*` 사용) ↔ `HandicapPolicy.vue:650-980`, `PolicySection.vue`(`policy-section/toggle/no/body` 스타일이 전부 페이지 파일에 있음)
- 분류: 구현 정합성 / 테마
- 영향: 두 컴포넌트는 `<style>`(비-scoped)로 페이지 클래스를 가정함. 컴포넌트 단독으로 쓰면 깨지고, `.pp-up` 등 전역 클래스가 앱 전체에 노출됨. `.policy-page` 밖의 모달(body로 이동)은 `var(--pp-up, var(--delta-up))` 폴백으로 간신히 맞춤.
- 추천: `PolicySection`의 스타일을 컴포넌트로 옮기고, 표·배지 공통 스타일은 한 곳(파일 하나)으로 추출. 모달 쪽은 `:root` 토큰만 쓰도록 통일.
- 추천 명령: `/impeccable extract`는 목록 밖이므로 `/impeccable document`(경계 기록) 후 `/impeccable polish`
- 공유 자원: 예. `.policy-table`, `.policy-flag`, `.pp-up/.pp-down/.pp-std` 는 다른 화면(RowDetailDialog 등)이 공유 중일 수 있음. 이동 전에 사용처 검색 필요

### [P2] 조회 오류 문구를 그대로 노출
- 위치: `HandicapPolicy.vue:211-213`, `:524-527`(`불러오기 실패 : {{ courseRatingsError }}`)
- 분류: 접근성(오류 안내) / 구현
- 영향: Supabase 원문 메시지가 회원 화면에 나옴. 결과 표는 `AsyncState`+`describeError` 계열인데 Course Rating 부분만 다른 방식이라 일관성 없음.
- 표준: WCAG 3.3.1 취지(오류를 이해 가능한 문구로)
- 추천: `describeError(e, '구장 정보를 불러오지 못했음')`로 통일, 재시도 버튼 유지.
- 추천 명령: `/impeccable clarify`
- 공유 자원: 예(`@/lib/errors`는 공유 함수, 호출만 바꾸면 됨)

### [P3] 별칭 이름이 실제 값과 반대로 읽힘
- 위치: `HandicapPolicy.vue:651-668`(`--pp-blue: var(--muted)`, `--pp-grey: var(--card)`, `--pp-sage: var(--secondary)`, 주석 "파스텔·60-30-10")
- 분류: 테마
- 영향: 이름은 파랑·회색인데 값은 초록 계열 토큰. 의미색(파랑 `--delta-down`)과 혼동해 이후 수정 시 잘못 쓰기 쉬움. 주석도 현재 구현과 맞지 않음.
- 추천: `--pp-head`, `--pp-surface`, `--pp-foot` 등 역할 이름으로 변경, 주석 갱신.
- 추천 명령: `/impeccable polish`
- 공유 자원: 아니오(`.policy-page` 범위. 단 `HandicapResultsTable.vue`가 `--pp-blue/grey/sage` 참조)

### [P3] 닫힌 섹션이어도 마운트 때 Course Rating 조회
- 위치: `HandicapPolicy.vue:8-11`, `:202-219`
- 분류: 성능
- 영향: 7번 섹션 안의 접이식 참고 자료인데 페이지 진입마다 요청 1건. 데이터량이 작아 체감은 미미. 인쇄 전용 13열 표도 항상 DOM에 있음.
- 추천: `details` 첫 `toggle` 시 지연 조회(인쇄 시에는 `beforeprint`에서 선로딩).
- 추천 명령: `/impeccable optimize`
- 공유 자원: 아니오

### [P3] 단계 목록 `list-style:none` 으로 목록 의미 손실 가능
- 위치: `HandicapPolicy.vue:239-245`(`<ol class="list-none">`), 번호 `①`은 `aria-hidden`
- 분류: 접근성
- 영향: Safari/VoiceOver 는 `list-style:none` 목록을 목록으로 읽지 않는 경우가 있고, 번호도 `aria-hidden`이라 "8단계 순서"가 전달되지 않을 수 있음.
- 추천: `<ol role="list">` 추가. 번호 글자는 보이게 두고 `aria-hidden`을 제거하거나 단계명에 "1단계" 식으로 포함.
- 추천 명령: `/impeccable harden`
- 공유 자원: 아니오

## 패턴 및 구조 문제
- 이 화면의 표 대비·크기 결정이 의미색 토큰(`--warning`, `--delta-*`)에 기대고 있어, 토큰 하나가 약해지면 11~12px 배지가 한꺼번에 기준 미달이 됨.
- 페이지 파일(980줄 중 330줄이 전역 CSS)이 컴포넌트 스타일을 소유하는 구조라 `HandicapResultsTable`·`PolicySection` 이 독립 부품이 아님.
- 정적 상수와 DB 조회 값이 한 화면에 섞여 있어 갱신 때 불일치 가능.

## 잘 된 점
- 표 접근성: `th scope="col/row"`, 정렬 열 `aria-sort`, `aria-expanded`/`aria-controls`, 인쇄 전용 표 `aria-hidden`.
- 색만으로 뜻 전달하지 않음: 증감은 부호+"인상/인하", 인간미는 부호 글자, 배지는 "한도/부족/휴면" 글자.
- 터치 영역: 섹션 토글(약 48px), `summary`(44px 확보), 모바일 정렬·상세 버튼 44px, 다시 시도 링크의 보이지 않는 히트 영역.
- 375px 대응: 열 숨김 + `pw-only` 캡션으로 정보 유지, `word-break: keep-all`, 가로 스크롤 안전망(`overflow-x:auto`).
- 이동 감소: 전역 규칙에 위임, 새 애니메이션 없음(회전 0.15s 한 곳).
- 고정폭 숫자·`U+2212` 마이너스·`padPct` 자릿수 정렬 등 숫자 가독성 처리.
- 관리자 입력: 범위 검증, 저장 전 확인 창, 서버 재조회로 DB와 화면 일치.

## 권장 조치 순서
1. [P2] `/impeccable typeset`: 본문 16px 적용 범위 결정(DESIGN.md 모순 먼저 정리)
2. [P2] `/impeccable audit`: 의미색 배지 대비 실측 후 필요 시 `/impeccable colorize`
3. [P2] `/impeccable harden`: 하드코딩 수치 파생화, 인쇄 시 `details` 펼침, 오류 문구, `ol` 의미
4. [P2] `/impeccable document`: 전역 CSS 경계(공유 클래스 사용처) 기록 후 구조 정리
5. [P3] `/impeccable optimize`: Course Rating 지연 조회
6. 마지막 `/impeccable polish`: 별칭 이름·주석 정리, detector 어드바이저리 점검
