# 따만라자 골프모임

월례 골프모임의 기록을 관리하는 웹앱. 월간 기록, 핸디캡 자동 보정, 연간 랭킹,
개인 기록, 참석 확인을 한 화면 묶음으로 제공한다.

**Vue 3 + TypeScript + TailwindCSS v4 + Supabase(PostgreSQL)** 로 만들었고,
GitHub Pages 에 정적 배포한다. 서버 코드는 없고, 권한·집계 규칙은 전부
Supabase 의 RLS 정책과 함수에 들어 있다.

- 배포 주소: `https://<user>.github.io/tamanRaja/`
- 설계 문서: [ARCHITECTURE.md](ARCHITECTURE.md) · 개발 규칙: [CONTRIBUTING.md](CONTRIBUTING.md) · 변경 이력: [CHANGELOG.md](CHANGELOG.md)

---

## 빠르게 시작

```bash
npm install
npm run dev          # http://localhost:5173
npm run type-check   # vue-tsc -b
npm run build        # vue-tsc -b && vite build
npm run deploy       # build 후 gh-pages 브랜치로 배포
```

### 환경 변수

`.env` 에 Supabase 접속 정보를 둔다. 두 값 모두 공개 키이며, 이 키만으로는
로그인 전 어떤 기록도 읽을 수 없다 (아래 [인증](#인증) 참고).

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`service_role` 키는 어떤 경우에도 프런트엔드나 저장소에 넣지 않는다.

---

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 프레임워크 | Vue 3.5 (Composition API, `<script setup>`) |
| 언어 | TypeScript 5.5 (`strictTemplates` 켬) |
| 빌드 | Vite 5.4 |
| 스타일 | TailwindCSS v4 (`@tailwindcss/vite`), tw-animate-css |
| 라우팅 | vue-router 4 (HashHistory) |
| 데이터 | Supabase JS 2.x (PostgreSQL) |
| PWA | vite-plugin-pwa (`registerType: 'prompt'`) |
| 유틸 | VueUse, clsx, tailwind-merge, class-variance-authority |
| 아이콘 | lucide-vue-next |
| 배포 | gh-pages |

---

## 디렉터리 구조

```
tamanRaja/
├── index.html
├── vite.config.ts            # base '/tamanRaja/' · PWA manifest · workbox
├── public/                   # 아이콘 · og-image
├── supabase/migrations/      # 스키마·RLS·함수 마이그레이션 (SQL)
└── src/
    ├── main.ts               # createApp + router + 서비스워커 등록
    ├── App.vue               # 데이터 로드 · 계정/참석 모달 · 세션 재검증
    ├── index.css             # Tailwind v4 + 디자인 토큰
    ├── router/index.ts       # HashHistory · 지연 로딩 · 로그인 가드 · 404
    ├── lib/
    │   ├── index.ts          # 도메인 타입 · ROUTE_PATHS · LEGACY_ROUTE_PATHS
    │   ├── supabase.ts       # x-taman-session 헤더를 붙이는 클라이언트
    │   ├── session.ts        # 세션 토큰 보관 (taman: 접두사) · 마지막 활동 시각
    │   ├── csv.ts            # CSV 생성·다운로드
    │   ├── rank.ts           # 순위 표기 규칙
    │   ├── errors.ts         # 사용자에게 보일 오류 문구
    │   ├── format.ts         # 숫자·날짜 표기
    │   ├── pwa.ts            # 새 버전 알림
    │   └── utils.ts          # cn() (clsx + tailwind-merge)
    ├── data/
    │   ├── index.ts          # 기본 로드 · 핸디 해석 · 월간/연간 집계
    │   └── history.ts        # 과거 기록 뷰 조회 (연도·회원 단위 지연 로드)
    ├── composables/
    │   ├── useAuth.ts        # verify_pin / logout / change_pin / session_member
    │   ├── useAttendance.ts  # 익월 참석 확인
    │   ├── useRecordExport.ts# 월간·랭킹·개인 기록 CSV 내보내기
    │   ├── useIdleLogout.ts   # 30분 무활동 자동 로그아웃 · 활동 보고
    │   ├── useCompactTable.ts# 화면 폭에 따른 표 축약
    │   └── useToast.ts       # 토스트 상태
    ├── components/
    │   ├── Layout.vue        # 고정 헤더 + 네비 + 푸터 (고정 높이 셸)
    │   ├── LoginModal.vue    # 계정 창 (로그인 · PIN 변경 · 참석 확인 탭)
    │   ├── AttendancePanel.vue # 익월 참석 선택 패널
    │   ├── MonthlyTable.vue  # 월간 표 · 편집 · 자동 계산 · 핸디 규칙 도움말
    │   └── ui/               # shadcn 스타일 UI 원자 (~30개)
    └── pages/
        ├── Login.vue         # 홈(`/`) — 로그인
        ├── Monthly.vue       # 월간 기록
        ├── YearlyRanking.vue # 연간 랭킹
        ├── MyProfile.vue     # 나의 기록
        ├── AdminLogs.vue     # 접속 기록 (관리자 전용)
        ├── AdminMembers.vue  # 회원 관리 (관리자 전용)
        └── NotFound.vue      # 404
```

---

## 라우팅

HashHistory(`#/path`) 기반이다. GitHub Pages 는 임의 경로를 index.html 로
돌려주지 못하므로 해시를 쓴다. 홈(`/`)은 로그인 화면이고, 나머지는
`Layout.vue` 로 감싸이며 로그인 가드가 걸린다.

| 경로 | 화면 | 로그인 |
|------|------|--------|
| `/` | `Login.vue` | 불필요 |
| `/monthly` | `Monthly.vue` | 필요 |
| `/ranking` | `YearlyRanking.vue` | 필요 |
| `/profile` | `MyProfile.vue` | 필요 |
| `/attendance` | `Monthly.vue` + 참석 확인 창 | 필요 |
| `/admin/logs` | `AdminLogs.vue` — 접속 기록 | 필요 (관리자) |
| `/admin/members` | `AdminMembers.vue` — 회원 관리 | 필요 (관리자) |
| 그 외 | `NotFound.vue` | 불필요 |

- `/monthlyRecord/` 는 예전 경로다. 북마크·공유 링크가 살아 있도록 쿼리를
  유지한 채 `/monthly` 로 리다이렉트한다.
- `/attendance` 는 모달이지만 주소를 갖는다. 단톡방에 링크로 돌리고 뒤로가기로
  닫을 수 있어야 하기 때문이다.
- 라우터 가드는 편의일 뿐 권한 경계가 아니다. 실제 접근 통제는 서버 RLS 가 한다.

---

## 화면

- **월간 기록 (`/monthly`)** — 월 선택, 모임 정보(날짜·골프장), 회원별
  기준핸디·당월핸디·차월핸디·스코어·Net·조·시상. 편집 권한이 있으면 스코어를
  넣는 즉시 조 편성·차월핸디·시상이 미리 계산돼 보인다. 좁은 화면에서는 이름을
  눌러 그 줄의 상세를 창으로 본다. **핸디 규칙** 버튼으로 모임 규정 전문을 볼 수 있다.
- **연간 랭킹 (`/ranking`)** — 연도 선택, 평균 스코어(기본) 또는 평균 Net 기준
  순위, Winner/Medalist/Host 횟수. 상위 4명은 카드로 따로 보여준다.
  순위는 그 해 이미 치른 경기의 50% 이상 참석한 회원에게만 부여한다.
- **나의 기록 (`/profile`)** — 본인의 1월~12월 기록과 통산 집계, PIN 변경.
- **참석 확인** — 계정 창의 탭. 익월 참석/불참/미정을 고른다.
- **접속 기록 (`/admin/logs`)** — 관리자에게만 보인다. 회원·기간·구분으로 걸러
  로그인 · PIN 실패 · 잠금 · 로그아웃 · 자동 로그아웃 · 세션 만료를 시간순으로
  본다. 로그인과 그 세션의 종료를 짝지어 체류 시간도 함께 낸다. 메뉴를 감추는
  것은 편의일 뿐이고, 실제 차단은 조회 RPC 안의 `app.is_admin()` 이 한다.
- **회원 관리 (`/admin/members`)** — 관리자에게만 보인다. 회원 추가 · 등급 변경
  (관리자 ↔ 회원) · 휴면/복귀 · 삭제를 한 화면에서 한다. 회원을 추가하면
  로그인 정보와 시작월의 기준핸디가 함께 생긴다. **경기 기록이 있는 회원은
  삭제되지 않는다** — 명단에서 빼는 정상 경로는 휴면이다.
- **엑셀(CSV) 내려받기** — 월간 기록·연간 랭킹·나의 기록 각 화면에서 지원한다.
- **PWA** — 홈 화면에 설치할 수 있고, 새 버전이 올라오면 토스트로 물어본다.
  점수를 입력하는 중에 말없이 새로고침되지 않도록 `prompt` 방식을 쓴다.

---

## 데이터 모델

### 테이블 (`public`)

| 테이블 | 용도 |
|--------|------|
| `members` | 회원 (name, display_order, role, dormant_from, is_active) |
| `golf_courses` | 골프장 (name, tee_box, par) |
| `meetings` | 월별 모임 (year_month, meeting_date, course_id, host_member_id, notes) |
| `monthly_handicaps` | 월별 핸디 (member_id, year_month, std_hc, app_hc, next_hc) |
| `meeting_results` | 경기 결과 (attended, score, result_group, result_rank, note) |
| `attendance_confirmations` | 익월 참석 확인 |
| `app_settings` | 코드 배포 없이 바꾸는 화면 문구 (key/value) |

`app` 스키마에는 `member_credentials`(PIN 해시), `member_sessions`(세션 해시),
`member_auth_events`(인증 이력)가 있다. PostgREST 는 `public` 만 노출하므로 이
세 테이블은 REST 로 접근할 수 없고, RLS 도 정책을 하나도 두지 않은 채 켜 두어
SECURITY DEFINER 함수를 거치지 않으면 아무도 읽지 못한다.

### 뷰·함수

| 이름 | 종류 | 용도 |
|------|------|------|
| `v_meeting_scores` | 뷰 | 모임별 개인 성적. Net 계산과 휴면 필터를 뷰 한 곳에 못박았다 |
| `v_member_stats` | 뷰 | 연도별 + 통산 집계 (`year IS NULL` 행이 통산) |
| `v_yearly_summary` | 뷰 | 연간 요약 |
| `yearly_ranking(year)` | 함수 | 연간 랭킹 집계 |
| `save_meeting_results(...)` | RPC | 월 기록(골프장·모임·결과) 저장을 한 트랜잭션으로. `security invoker` 라 권한은 기존 RLS. 입력 검증(스코어 -20~60, 시상, Host 1명, 당월 핸디 유무) |
| `recompute_next_hc_stmt()` | 트리거 | `meeting_results` 저장 시 차월핸디 산출·이월. 문장 단위 — 본문은 `app.recompute_next_hc_for_meeting()` |

뷰는 모두 `security_invoker = on` 이다. 끄면 뷰가 읽기 RLS 를 통째로 우회해
익명 키만으로 전 회원 기록이 새어 나간다.

### 로드 방식

`src/data/index.ts` 의 `loadData()` 가 로그인 이후에 기본 테이블을 병렬로
받는다. 실패하면 간격을 늘려 가며 재시도한다. 2022년부터의 과거 기록은 전부
받지 않고, `src/data/history.ts` 가 필요한 연도·회원만 뷰에서 지연 로드한다.

---

## 핸디캡 계산

세 가지 핸디 개념을 쓴다.

| 용어 | 필드 | 의미 |
|------|------|------|
| 기준 핸디 | `std_hc` | 복귀 기준점 |
| 당월 핸디 | `app_hc` | 이번 달 Net 계산에 적용 |
| 차월 핸디 | `next_hc` | 이번 달 성적으로 정해지는 다음 달 핸디 |

### Net

```
Net = 스코어(score) − 당월 핸디(app_hc)      낮을수록 우수
```

당월 핸디는 그 달 레코드가 있으면 그 값을, 없으면 직전 달의 `next_hc` 를 승계한다.

### 자동 보정

스코어를 저장하면 DB 트리거(`recompute_next_hc_stmt` → `app.recompute_next_hc_for_meeting`)가 차월핸디를 계산해 저장하고,
그 값을 다음 달 `app_hc` 로 이월한다 (다음 달에 아직 결과가 없을 때만).
`MonthlyTable.vue` 의 `computeAutoFields()` 는 같은 규칙의 실시간 미리보기다.
두 곳은 반드시 같은 규칙이어야 한다.

1. **조 편성** — Net 오름차순으로 세우고 상위 절반(`floor(인원/2)`)이 **1등조**,
   나머지가 **2등조**. 스코어가 없는 회원은 조 편성에서 빠지고 핸디도 그대로다.
2. **차월 핸디**
   - **직전 라운드와 같은 조**: 1등조 → `app_hc − 1`, 2등조 → `app_hc + 1`
   - **조가 바뀐 경우**: `next_hc = std_hc`. 계속 1등조라 핸디가 내려가 있어도
     단 한 번 2등조에 들면 기준 핸디로 돌아온다. 2등조도 반대로 같다.
   - **기준 핸디로 복귀하면 모든 것이 초기화된다**: 당월 핸디가 기준 핸디와 같은 달
     (`app_hc = std_hc` — 매년 1월, 기준 핸디를 새로 정한 달, 조 변경으로 복귀한
     다음 달)은 직전 라운드와 견주지 않고 그 달 결과만으로 ±1 한다.
     예) 8월 조 변경 → 9월 당월 = 기준, 9월 2등조 → 10월 = 기준 + 1.
   - **직전 라운드**는 달력상 직전 달이 아니라 그 회원이 마지막으로 조에 편성된
     달이다. 쉰 달은 건너뛴다. 직전 달만 보면 그 달 쉰 사람이 전부 조 변경으로 몰린다.
   - 미참석·스코어 없음 → `app_hc` 유지
3. **시상**
   - **Winner** — 최저 Net
   - **Medalist** — 최저 스코어 (Winner 제외)
   - **Host** — 최고 Net (Winner 와 다를 때만) · 다음 달 주최자

규칙 전문은 월간 기록 화면의 **핸디 규칙** 버튼에서 볼 수 있다.

### 연간 랭킹

`yearly_ranking(year)` 함수가 집계한다. 규칙은 프런트의 `getYearlySummary()` 와
같아야 한다.

- 대상 회원 — 그 해 안에 휴면으로 바뀐 회원은 제외
- 대상 라운드 — 참석했고 스코어가 0보다 큰 경우
- 순위 — 평균 스코어 오름차순, 동점이면 평균 Net 이 낮은 쪽
- 순위 부여 조건 — 그 해 이미 치른 경기의 50% 이상 참석

---

## 인증

Supabase Auth 를 쓰지 않는다. 회원 선택 + 4자리 PIN 방식이며, 검증은 전부
서버에서 한다.

| RPC | 하는 일 |
|-----|---------|
| `verify_pin(member_id, pin, ...)` | PIN 대조 후 세션 토큰 발급. 실패가 쌓이면 잠근다. 임시 PIN 이면 `must_change: true` |
| `session_member()` | 지금 토큰의 회원과 권한, `must_change` 를 돌려준다 |
| `change_pin(old, new)` | PIN 변경. 쉬운 PIN 은 `weak` 로 거절, 성공하면 `must_change` 해제 |
| `logout(reason?)` | 세션 폐기. `reason='idle'` 이면 자동 로그아웃으로 기록 |
| `touch_session()` | 활동 보고. 유휴 시계를 되돌리고, 끝난 세션이면 `{ok:false}` |
| `auth_events(...)` | 접속 기록 조회. 관리자가 아니면 거절(42501) |
| `admin_members()` | 관리자용 회원 목록(등급·기록 수·마지막 로그인) |
| `add_member(...)` | 회원 추가 + 로그인 정보 + 시작월 기준핸디. 무작위 임시 PIN 을 응답에 한 번만 싣는다 |
| `set_member_role(id, role)` | 등급 변경. 본인·마지막 관리자 강등은 막는다 |
| `set_member_dormant(id, from?)` | 휴면 시작월 지정, `null` 이면 복귀 |
| `delete_member(id)` | 기록 없는 회원만 삭제 |
| `reset_member_pin(id)` | 임시 PIN 재발급 + 변경 강제 + 그 회원 세션 전부 폐기. 본인은 거절 |

- PIN 은 `app.member_credentials` 에 bcrypt 해시로만 있다. 평문 PIN 테이블
  (`member_pins`)은 제거했다.
- **공통 초기 PIN 은 없다.** 회원 추가 때 서버가 무작위 4자리 임시 PIN 을 만들어
  관리자 화면에 한 번만 보여주고, 해시만 남긴다. 임시 PIN 상태
  (`member_credentials.must_change`)인 회원은 로그인하자마자 닫을 수 없는 PIN
  변경 창을 만난다. 같은 숫자 반복·연속 숫자·옛 공통 기본값은 새 PIN 으로 쓸 수 없다.
- 세션 토큰은 서버가 발급한 불투명 문자열이다. 저장은 sha256 해시로 하며,
  프런트는 요청 헤더 `x-taman-session` 에 실어 보내기만 한다.
  `src/lib/supabase.ts` 가 fetch 를 감싸 매 요청에 붙인다.
- 브라우저 보관 위치는 기본이 `sessionStorage`(탭을 닫으면 사라짐), "이 기기에서
  로그인 유지"를 고르면 `localStorage`. 키는 전부 `taman:` 접두사를 쓰고
  로그아웃 때 한 번에 지운다. 서버 토큰 자체는 30일짜리다.
- 그 30일과 별개로 **마지막 조작 이후 30분이 지나면 자동으로 로그아웃**한다.
  "로그인 유지"를 켰든 껐든 똑같이 걸린다 — 켜 둔 기기가 그대로 열려 있지
  않게 하려는 것이라 예외를 두면 의미가 없다. 30분을 재는 것은 프런트
  (`useIdleLogout`)이고, 서버는 `app.idle_timeout()`(35분)으로 뒷단속만 한다.
  프런트가 활동을 5분에 한 번씩 묶어 보고하므로 서버가 정확히 30분에 자르면
  실제로 쓰고 있는 사람이 끊긴다.
- 로그인 · PIN 실패 · 잠금 · 로그아웃 · 자동 로그아웃 · 세션 만료 · PIN 초기화는
  `app.member_auth_events` 에 남는다. PIN 초기화는 처리한 관리자(`actor_member_id`)도 남는다. PIN 값과 IP 는 남기지 않고 기기 문자열만
  적으며, 180일이 지난 기록은 다음 로그인 때 함께 지워진다.
- RLS 안에서는 `app.current_member_id()` 가 헤더의 토큰으로 호출자를 식별한다.
  로그인하지 않으면 기록 테이블은 0행이 나온다. `members` 만 로그인 화면의
  회원 목록용으로 열려 있고, 노출 컬럼은 `id`·`name`·`dormant_from` 뿐이다.

### 쓰기 권한

관리자(`members.role = 'admin'`) 또는 **해당 월의 전월 Host** 만 그 달을 편집할
수 있다. 화면의 편집 버튼 노출과 서버 정책(`app.can_manage_month`)이 같은 규칙을
공유하며, 최종 판정은 서버가 한다. `members` 와 `monthly_handicaps` 는 SELECT 만
열려 있고, 핸디 값은 트리거로만 바뀐다.

---

## 설정

코드 배포 없이 바꿀 수 있는 값들이다. 예전에는 소스에 하드코딩돼 있었다.

| 대상 | 위치 |
|------|------|
| 관리자 | `members.role` (`'admin'` / `'member'`) |
| 휴면 회원 | `members.dormant_from` (YYYY-MM, 이 달부터 집계 제외) |
| 화면 공지 문구 | `app_settings` 테이블 (예: `handicap_notice`) |

---

## 배포

GitHub Pages(`gh-pages` 브랜치)로 정적 배포한다.

```bash
git status                # 커밋되지 않은 변경이 함께 나간다. 반드시 먼저 확인
npm run deploy            # = npm run build && gh-pages -d dist
```

- `npm run deploy` 는 커밋이 아니라 **작업 트리를 그대로** 빌드해 올린다.
- 프런트와 RLS 를 함께 바꾸는 변경은 프런트를 먼저 배포해 반영을 확인한 뒤
  정책을 적용한다. 반대로 하면 구버전 사용자에게 빈 화면이 나간다.
- `vite.config.ts` 의 `BASE` 와 PWA manifest 의 `start_url`·`scope` 는 항상
  같아야 한다. 다르면 안드로이드가 설치를 제안하지 않는다.

자세한 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md) 를 본다.

---

## 알려진 제한

- 골프장 이름은 자유 입력이라 표기가 갈릴 수 있다.
- 자동화된 테스트가 없다. 검증은 타입 검사(`npm run type-check`)와 수동 확인에 의존한다.

---

Copyright © ASEOA
