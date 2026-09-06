# 따만라자 골프모임 — Vue 3

React + shadcn-ui 원본을 **Vue 3 + Composition API + TypeScript + TailwindCSS v4 + VueUse + Supabase** 로 마이그레이션한 골프모임 기록 관리 웹앱.

월별 모임 기록, 핸디캡 자동 보정, 연간 랭킹, 회원별 PIN 인증을 제공한다. 데이터는 **Supabase(PostgreSQL)** 에서 로드되며, GitHub Pages 정적 배포에 맞춰 HashHistory 라우팅을 사용한다.

---

## 빠르게 시작 / Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
npm run type-check   # vue-tsc --noEmit
npm run build        # production build (vue-tsc + vite build)
npm run deploy       # build 후 gh-pages 배포
```

### 환경 변수 / Environment Variables

`.env` 파일에 Supabase 접속 정보가 필요하다 (`src/lib/supabase.ts`).

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## 기술 스택 / Tech Stack

| 영역 | 사용 기술 |
|------|-----------|
| 프레임워크 | Vue 3.5 (Composition API, `<script setup>`) |
| 언어 | TypeScript 5.5 |
| 빌드 | Vite 5.4 |
| 스타일 | TailwindCSS v4 (`@tailwindcss/vite`), tw-animate-css |
| 라우팅 | vue-router 4 (HashHistory) |
| 데이터 | Supabase JS 2.x (PostgreSQL) |
| 유틸 | VueUse, clsx, tailwind-merge, class-variance-authority |
| 아이콘 | lucide-vue-next |
| 배포 | gh-pages |

---

## 디렉터리 구조 / Directory Structure

```
golf-vue/
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── env.d.ts
└── src/
    ├── main.ts              # Vue app 부트스트랩 (createApp + router)
    ├── App.vue              # 루트 컴포넌트 · 데이터 로드 · 전역 모달
    ├── index.css            # Tailwind v4 + 디자인 토큰
    ├── router/index.ts      # vue-router (HashHistory) · 인증 가드
    ├── lib/
    │   ├── index.ts         # 도메인 타입 · ADMIN_NAMES · ROUTE_PATHS
    │   ├── supabase.ts      # Supabase 클라이언트
    │   └── utils.ts         # cn() (clsx + tailwind-merge)
    ├── data/index.ts        # Supabase 로드 · 핸디캡/랭킹 계산 로직
    ├── composables/
    │   ├── useAuth.ts        # 로그인 · 로그아웃 · PIN 변경
    │   ├── useAttendance.ts  # 미래월 참석 확인 (Supabase + localStorage)
    │   └── useToast.ts       # 토스트 상태
    ├── components/
    │   ├── Layout.vue        # 고정 헤더 + 네비 + 푸터
    │   ├── LoginModal.vue    # 로그인 + PIN 변경 모달
    │   ├── ScoreInputModal.vue  # 다음 달 참석 확인 모달
    │   ├── MonthlyTable.vue  # 월별 기록 테이블 + 자동 계산
    │   └── ui/               # shadcn-vue 스타일 UI 원자 컴포넌트 (~25개)
    └── pages/
        ├── Login.vue         # 로그인 페이지 (홈, `/`)
        ├── Monthly.vue       # 월간 기록 대시보드
        ├── YearlyRanking.vue # 연간 랭킹
        └── MyProfile.vue     # 나의 기록 · PIN 변경
```

---

## 라우팅 / Routes

HashHistory(`#/path`) 기반. 홈(`/`)은 로그인 페이지이며 Layout 없이 렌더링된다. 나머지 경로는 `Layout.vue`로 감싸지고 인증 가드(`router.beforeEach`)가 적용된다.

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/` | `Login.vue` | 불필요 |
| `/monthlyRecord/` | `Monthly.vue` | 필요 |
| `/ranking` | `YearlyRanking.vue` | 필요 |
| `/profile` | `MyProfile.vue` | 필요 |

인증 상태는 `sessionStorage`(키: `golf_auth_member`)로 관리한다.

---

## 동작하는 화면 / Working Pages

- **월간 기록 (`/monthlyRecord/`)** — 월 선택, 모임 정보(날짜·골프장), 참석 인원, Winner/Medalist 표시, 회원별 기준핸디·당월핸디·차월핸디·스코어·Net Score 테이블. 미래월에는 관리자가 스코어를 입력하면 결과 그룹·차월 핸디·시상이 자동 계산된다.
- **연간 랭킹 (`/ranking`)** — 연도 선택, 회원별 평균 Net Score 기준 순위, Winner/Medalist/Host 횟수 집계.
- **나의 기록 (`/profile`)** — 로그인 회원 본인의 월별 히스토리 및 PIN 변경.
- **로그인 / PIN 변경 모달** — `sessionStorage` + Supabase 기반.
- **참석 확인 모달** — 로그인 회원이 다음 달 참석 여부(참석/미정/불참)를 선택.

---

## 데이터 모델 / Supabase Tables

`src/data/index.ts`의 `loadData()`가 앱 시작 시 다음 6개 테이블을 병렬 로드한다.

| 테이블 | 용도 |
|--------|------|
| `golf_courses` | 골프장 정보 (id, name) |
| `meetings` | 월별 모임 (year_month, meeting_date, course_id, host_member_id) |
| `monthly_handicaps` | 월별 핸디캡 (std_hc, app_hc, next_hc) · members 조인 |
| `meeting_results` | 경기 결과 (attended, score, result_group, result_rank) |
| `member_pins` | 회원 PIN |
| `attendance_confirmations` | 미래월 참석 확인 |

> **참고:** `members` 테이블은 RLS로 직접 접근이 제한되어 있어, `monthly_handicaps` 조인을 통해 회원 정보를 추출한다. 로드는 실패 시 최대 3회(1.5초 간격 증가) 재시도한다.

---

## 핸디캡 계산 / Handicap Logic

세 가지 핸디캡 개념을 사용한다.

| 용어 | 필드 | 의미 |
|------|------|------|
| 기준 핸디 (Standard) | `std_hc` | 기본 핸디 · 리셋 기준점 |
| 당월 핸디 (Applied) | `app_hc` | 이번 달 Net Score 계산에 적용 |
| 차월 핸디 (Next) | `next_hc` | 이번 달 성적으로 산출된 다음 달 핸디 |

### Net Score

```
Net Score = 스코어(score) − 당월 핸디(app_hc)   (낮을수록 우수)
```

당월 핸디는 ① 해당 월 핸디 레코드가 있으면 그 값, ② 없으면 **직전 달의 `next_hc`를 승계**한다.

### 자동 보정 규칙

스코어 저장 시 **DB 트리거 `recompute_next_hc`** 가 차월 핸디를 계산·저장하고, 그 값이 다음 달 `app_hc`로 승계된다. 입력 화면의 `MonthlyTable.vue → computeAutoFields()`는 동일 규칙의 실시간 미리보기.

1. **조 편성** — Net Score 오름차순 정렬 후 상위 절반(`floor(인원/2)`)은 **1등조**, 나머지는 **2등조**.
2. **차월 핸디 조정 (`next_hc`)** — 모임 규정표 그대로
   - **직전 라운드와 같은 조**: 1등조 → `app_hc − 1`, 2등조 → `app_hc + 1` (홀수 핸디 인정)
   - **조가 바뀐 경우**: `next_hc = std_hc` (기준 핸디로 복귀). 계속 1등조라 핸디가 내려가 있어도 **단 1회** 2등조에 들면 기준 핸디로 돌아온다. 2등조도 반대로 같다.
   - **기준 핸디로 복귀하면 모든 것이 초기화된다**: 당월 핸디가 기준 핸디와 같은 달(`app_hc = std_hc` — 매년 1월, 기준 핸디를 새로 정한 달(예: 2026-07), 조 변경으로 복귀한 다음 달)은 직전 라운드와 견주지 않고 그 달 결과만으로 ±1 한다. 예) 8월 조 변경 → 9월 당월 = 기준, 9월 2등조 → 10월 = 기준 + 1.
   - **직전 라운드** = 그 회원이 마지막으로 조에 편성된 달. 불참한 달은 건너뛰고 비교한다(달력상 직전 달이 아님).
   - 미참석·스코어 없음: `app_hc` 유지
   - 규칙 전문은 월간 기록 화면의 **핸디 규칙** 버튼에서 볼 수 있다.
3. **시상**
   - **Winner** — 최저 Net Score
   - **Medalist** — 최저 Raw Score (Winner 제외)
   - **Host** — 최고 Net Score (Winner와 다를 경우만) · 다음 달 주최자

### 연간 랭킹 (`getYearlySummary()`)

회원별 출석 경기의 Net Score 평균을 오름차순 정렬해 순위를 매기고, Winner/Medalist/Host 횟수를 함께 집계한다.

---

## 권한 및 회원 설정 / Configuration

코드에 하드코딩된 설정값. 회원 변동 시 직접 수정해야 한다.

- **관리자** (`src/lib/index.ts` → `ADMIN_NAMES`): `서종환`, `조학영`. 추가로 **전월 Host**는 해당 월 편집 권한을 가진다.
- **휴면 회원** (`src/data/index.ts` → `DORMANT`): `이성남`, `박재현` (`2026-04`부터). 지정 월 이후 대시보드·랭킹에서 제외된다.
- **기본 PIN**: `2322` (DB값이 `0000`이면 기본값으로 매핑).

---

## 인증 / Authentication

- 4자리 숫자 PIN 방식. 회원 선택 + PIN 입력으로 로그인.
- 세션: `sessionStorage` (`golf_auth_member`). 미래월 참석: `localStorage` (`golf_future_attendance`) + Supabase 동기화.
- PIN 변경: `useAuth.changePin()` → `member_pins` 테이블 업데이트.

> ⚠️ **보안 주의** — 로그인 검증이 클라이언트에서 수행된다. `loadData()`가 전 회원 PIN을 브라우저로 내려받아 메모리에서 비교하므로, 개발자도구에서 PIN이 노출될 수 있다. 친목 모임 용도에는 수용 가능하나, 강화하려면 Supabase RLS 정책 + 서버측 인증(Edge Function)으로 이전을 권장한다.

---

## 배포 / Deployment

GitHub Pages(브랜치 `gh-pages`)로 정적 배포한다.

```bash
git add -A
git commit -m "커밋 메시지"
git push origin main      # 소스 커밋

npm run deploy            # = npm run build && gh-pages -d dist
```

- `gh-pages` 브랜치에는 **dist 산출물 + `.nojekyll`만** 두고, 불필요한 파일은 넣지 않는다.
- 핸디캡 트리거(`recompute_next_hc`)와 `monthly_handicaps`는 **Supabase**에 있으며 git에 포함되지 않는다.

---

## 알려진 제한 / Known Limitations

- 미래월 저장 시 기존 `meeting_results`를 삭제 후 재삽입하는 구간이 트랜잭션으로 묶여 있지 않아, 네트워크 오류 시 결과 유실 가능성이 있다.
- 관리자·휴면 회원 명단이 소스코드에 하드코딩되어 있어 변경 시 재배포가 필요하다.

---

Copyright © ASEOA
