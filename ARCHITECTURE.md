# 구조

이 앱이 어떻게 짜여 있고, 왜 그렇게 짰는지 적는다. 쓰는 법은
[README.md](README.md), 고칠 때의 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md) 에 있다.

---

## 1. 전체 그림

서버가 없다. 브라우저에서 도는 정적 SPA 하나와 Supabase(PostgreSQL) 뿐이다.

```
브라우저 (GitHub Pages 의 정적 파일)
  │
  │  supabase-js
  │  헤더: apikey(공개 anon 키) + x-taman-session(로그인 토큰)
  ▼
Supabase / PostgREST
  │
  ▼
PostgreSQL
   ├─ RLS 정책        누가 무엇을 읽고 쓰는가
   ├─ 뷰 · 함수        Net 계산 · 연간 랭킹 집계
   └─ 트리거          차월핸디 산출과 이월
```

핵심 결정은 하나다. **규칙과 권한은 DB 에 둔다.** 프런트엔드는 GitHub Pages 에
그대로 올라가는 파일 묶음이라 그 안의 무엇도 신뢰 경계가 되지 못한다. 번들에
든 anon 키는 누구나 꺼내 쓸 수 있으므로, 그 키만으로 할 수 있는 일이 곧 익명
사용자가 할 수 있는 일이다.

그래서 다음이 따라온다.

- 로그인 검증은 DB 함수 안에서만 일어난다.
- 읽기·쓰기 허용 여부는 RLS 가 정한다. 화면의 조건문은 편의일 뿐이다.
- 랭킹과 핸디 같은 도메인 규칙은 DB 에 정본을 둔다. 프런트에도 같은 계산이
  있는 곳은 실시간 미리보기 용도이며, 저장된 값의 근거는 언제나 DB 쪽이다.

---

## 2. 인증

Supabase Auth 를 쓰지 않는다. 회원 15명이 4자리 PIN 으로 들어오는 모임 앱에
이메일 계정 체계는 과하고, 회원 명단 자체가 이미 DB 에 있다.

### 흐름

```
1. 로그인 화면        members 에서 (id, name, dormant_from) 만 읽어 목록을 만든다
2. verify_pin()       회원 + PIN 을 넘긴다. bcrypt 대조는 서버 안에서만 일어난다
3. 토큰 발급          불투명 문자열. 서버는 sha256 해시만 저장한다
4. 이후 모든 요청     헤더 x-taman-session 에 토큰을 실어 보낸다
5. RLS 안에서         app.current_member_id() 가 그 토큰으로 호출자를 찾는다
```

### 관련 객체

| 객체 | 하는 일 |
|------|---------|
| `app.member_credentials` | PIN 의 bcrypt 해시, 실패 횟수, 잠금 시각 |
| `app.member_sessions` | 토큰의 sha256 해시, 회원, 만료 시각 |
| `app.session_token()` | 요청 헤더에서 토큰을 꺼낸다 |
| `app.current_member_id()` | 살아 있는 세션이면 회원 id, 아니면 NULL |
| `app.is_admin()` | 그 회원이 관리자인가 |
| `public.verify_pin()` | 로그인. 실패 5회면 15분 잠금 |
| `public.session_member()` | 지금 토큰의 회원과 권한 |
| `public.change_pin()` | PIN 변경 |
| `public.logout()` | 세션 행 삭제 |

`app` 스키마는 PostgREST 가 노출하지 않는다(`public` 과 `graphql_public` 만
노출된다). 자격 증명과 세션 테이블은 REST 로 아예 닿을 수 없고, 두 테이블
모두 정책이 하나도 없는 채로 RLS 가 켜져 있다. 정책 없는 RLS = 전면 차단이다.
접근은 위의 `SECURITY DEFINER` 함수를 통해서만 이뤄진다.

### 프런트엔드 쪽

- `src/lib/supabase.ts` 가 `fetch` 를 감싸 매 요청에 `x-taman-session` 을 붙인다.
  supabase-js 의 세션 기능(`persistSession`, `autoRefreshToken`)은 전부 꺼 둔다.
- `src/lib/session.ts` 가 토큰을 보관한다. 기본은 `sessionStorage`(탭을 닫으면
  사라짐), "이 기기에서 로그인 유지"를 고르면 `localStorage`. 서버 토큰은
  어느 쪽이든 30일짜리다 — 저장 위치가 정하는 건 이 브라우저가 얼마나 오래
  들고 있느냐뿐이다.
- 이 모듈은 `supabase.ts` 를 import 하지 않는다. `supabase.ts` 가 요청마다
  `getSessionToken()` 을 부르므로 순환 참조가 되기 때문이다.
- 브라우저에 남기는 키는 전부 `taman:` 접두사를 쓴다. 로그아웃 때 접두사로
  훑어 한 번에 지운다. 접두사 규칙 이전의 옛 키도 함께 지운다 — 남겨 두면
  다음 사용자에게 보인다.
- `expiresAt` 은 UI 편의값이다. 만료가 뻔한 토큰을 미리 버리는 데만 쓰고,
  만료 판정의 최종 권한은 서버에 있다.

---

## 3. 권한 경계

### 읽기

기록 테이블(`meetings`, `meeting_results`, `monthly_handicaps`, `golf_courses`,
`attendance_confirmations`, `app_settings`)은 `app.current_member_id() is not null`
일 때만 읽힌다. 로그인하지 않으면 0행이다.

`members` 만 예외로 열려 있다. 로그인 화면의 회원 선택 목록에 필요하기
때문이다. 대신 컬럼 단위로 권한을 준다 — 익명은 `role` 을 볼 수 없다.

### 쓰기

기준은 하나다. **관리자이거나, 그 달의 전월 Host 이거나.**

```
app.can_manage_month(year_month)
  관리자면 true
  아니면, 전월 모임의 host_member_id 또는 result_rank='Host' 인 사람이면 true
app.can_manage_meeting(meeting_id)
  meeting 을 통해 위를 다시 부른다 (meeting_results 에는 year_month 가 없다)
```

전월 Host 가 다음 모임을 기획하는 동작이 실제로 쓰이고 있어, 지침서의
"관리자 전용" 보다 넓게 잡았다. 중요한 것은 화면의 `isManager` 계산과 서버
정책이 **같은 규칙을 공유한다**는 점이다. `Monthly.vue` 의 `isManager` 는 편집
버튼을 보여줄지 정할 뿐이고, 실제 허용은 서버가 다시 판정한다.

`members` 와 `monthly_handicaps` 는 SELECT 만 열려 있다. 핸디 값은 사람이
직접 쓰는 것이 아니라 트리거가 쓴다.

### 뷰의 함정

뷰는 기본이 `security definer` 라 만든 사람(RLS 를 무시하는 postgres) 권한으로
기반 테이블을 읽는다. 그대로 두면 뷰 하나가 읽기 정책을 통째로 우회해, 번들에
든 익명 키만으로 전 회원의 점수와 핸디가 새어 나간다. `v_yearly_summary` 에서
실제로 겪은 구멍이고, 이후 모든 뷰는 `security_invoker = on` 으로 만든다.

---

## 4. 데이터 모델

```
members ─┬─ monthly_handicaps  (member_id, year_month)  std_hc / app_hc / next_hc
         ├─ meeting_results    (meeting_id, member_id)  attended / score / group / rank
         └─ attendance_confirmations (year_month, member_id)

meetings ── golf_courses
  year_month · meeting_date · course_id · host_member_id · notes
```

몇 가지 함정이 있다.

- `meeting_results.score` 는 **총타수가 아니라 파 기준 오버**다. 총타수는
  `score + course.par` 이고, 코스가 정해지지 않은 모임은 계산할 수 없다.
- `meetings.year_month` 와 `meeting_date` 의 월이 다른 모임이 있다. 같은 달에
  두 번 열려 빈 달로 옮겨 적은 경우다(4건). `v_meeting_scores` 가
  `is_reassigned` 로 표시하며, 화면은 그런 모임에 실제 개최일을 함께 보여야 한다.
- `meeting_results` 에는 `year_month` 가 없다. 기간으로 거르려면 `meetings` 를
  거쳐야 한다.
- 휴면은 참/거짓이 아니라 **시작월**이다(`members.dormant_from`). 그 달부터의
  경기만 집계에서 빠지고, 그 전 기록은 통산 랭킹에 그대로 남는다.

### 뷰와 함수

| 이름 | 하는 일 |
|------|---------|
| `v_meeting_scores` | 모임별 개인 성적. Net 계산과 휴면 필터를 여기 한 곳에 못박았다 |
| `v_member_stats` | 연도별 + 통산 집계. `GROUPING SETS` 로 한 번에 내며 `year IS NULL` 행이 통산 |
| `v_yearly_summary` | 연간 요약 |
| `yearly_ranking(year)` | 연간 랭킹 집계 |
| `recompute_next_hc()` | `meeting_results` 트리거. 차월핸디 산출과 다음 달 이월 |

뷰를 만든 이유는 전송량이 아니라 **규칙의 단일화**다. 예전에는 프런트가 세
테이블을 각각 받아 브라우저에서 조인했는데, 조인 키가 두 개(`member_id`,
`year_month`)인 데다 휴면 필터까지 겹쳐 화면마다 규칙이 조금씩 달라지기 쉬웠다.

Net 계산에서 `coalesce(app_hc, 0)` 같은 처리는 하지 않는다. 핸디 0 은 실제로
있는 값이라, 0 을 채우면 Net 이 조용히 Gross 와 같아진다. 값이 없으면 NULL 이다.

---

## 5. 프런트엔드 데이터 흐름

두 갈래다.

### 기본 로드 — `src/data/index.ts`

로그인한 뒤 `loadData()` 가 필요한 테이블을 병렬로 받아 반응형 배열에 채운다.
화면은 이 배열에서 계산해 그린다. 실패하면 간격을 늘려 가며 재시도한다.

범위 제한이 하나 있다. 기록(`monthly_handicaps`, `meeting_results`,
`attendance_confirmations`)은 **최근 2년**만 받는다. 1년이 아닌 이유는
`resolveHandicap()` 이 직전 기록으로 폴백하고, 나의 기록·연간 랭킹이 이전
연도를 참조하기 때문이다. `meetings` 만 전 기간을 받는다 — 50여 행짜리 목차라
전송량이 없다시피 하고, 연도 탭과 월 드롭다운이 "어떤 달에 모임이 있었나"를
알아야 만들어진다.

`app_settings` 는 오류를 삼킨다. 테이블이 아직 없는 서버에 새 프런트를 먼저
배포해도 나머지 화면이 그대로 떠야 하기 때문이다. 문구 하나 때문에 기록이
안 보이면 바꾼 보람이 없다.

### 과거 기록 — `src/data/history.ts`

2022년부터의 기록은 전부 받지 않는다. 연간 랭킹의 연도 탭이나 개인 기록에서
필요해진 시점에 그 연도·그 회원만 뷰에서 지연 로드하고 캐시한다. 저장이
일어나면 캐시를 버린다.

### 화면 상태

전역 상태 라이브러리를 쓰지 않는다. `reactive` 배열과 composable 함수만으로
충분한 규모다.

| composable | 하는 일 |
|------------|---------|
| `useAuth` | 로그인·로그아웃·PIN 변경·세션 재검증. 잠금 남은 시간도 문구로 만든다 |
| `useAttendance` | 익월 참석 확인. 로컬 상태와 DB 를 함께 본다 |
| `useRecordExport` | 월간·랭킹·개인 기록 CSV 내보내기 |
| `useCompactTable` | 화면 폭에 따라 표를 축약할지 정한다 |
| `useToast` | 토스트 |

---

## 6. 핸디캡 파이프라인

이 앱에서 가장 복잡한 부분이고, 규칙이 네 곳에 나타난다. 넷은 반드시 같아야 한다.

| 위치 | 역할 |
|------|------|
| `recompute_next_hc()` 트리거 | **정본.** 저장되는 값을 정한다 |
| `MonthlyTable.vue` 의 `computeAutoFields()` | 편집 중 실시간 미리보기 |
| 월간 기록 화면의 **핸디 규칙** 창 | 회원에게 보이는 설명 |
| README 의 핸디캡 절 | 개발자용 설명 |

### 저장할 때 벌어지는 일

```
사용자가 스코어를 넣고 저장
  → meeting_results 를 지우고 다시 넣는다
    → 트리거 recompute_next_hc 가 돈다
      (A) 그 달 monthly_handicaps.next_hc 를 다시 계산해 쓴다
      (B) 다음 달에 아직 결과가 없으면 next_hc 를 다음 달 app_hc 로 이월한다
  → loadData() 로 다시 받아 화면을 갱신한다
```

(B) 에 조건이 붙은 이유는, 다음 달 경기가 이미 치러졌다면 그 달의 핸디는
이미 확정된 값이라 덮어써서는 안 되기 때문이다.

### 규칙

1. Net 오름차순으로 세우고 상위 `floor(인원/2)` 가 1등조, 나머지가 2등조.
2. 차월핸디
   - 당월핸디 = 기준핸디이거나(초기화 상태) 직전 라운드와 같은 조 → ±1
   - 조가 바뀌었으면 → 기준핸디로 복귀
   - 미참석·스코어 없음 → 당월핸디 유지
3. Winner = 최저 Net, Medalist = Winner 를 뺀 최저 스코어,
   Host = 최고 Net(Winner 와 다를 때만).

두 가지 해석이 실제 운영과 맞춰 확정됐다.

- **직전 '라운드'다, 직전 '달'이 아니다.** 규정표의 "계속 1등조가 되어 … 단
  1회라도 2등조에 들면" 은 달력이 아니라 경기를 세는 말이다. 직전 달만 보면
  그 달 쉰 사람은 비교할 조가 없어 전부 조 변경으로 몰리고, 이어지던 1등조
  행진이 기준핸디로 되돌아가 버린다. 그래서 불참한 달은 건너뛴다.
- **기준핸디로 복귀하면 모든 것이 초기화된다.** 당월핸디가 기준핸디와 같은 달
  (매년 1월, 기준핸디를 새로 정한 달, 조 변경으로 복귀한 다음 달)은 직전 조와
  견주지 않고 그 달 결과만으로 ±1 한다. 이 해석 없이는 조가 바뀐 다음 달에도
  다시 비교가 걸려 기준핸디에 한 번 더 묶인다.

### 미확정 값을 감추는 규칙

`resolveHandicap()` 은 아직 정해지지 않은 값을 NULL 로 돌려준다. 당월핸디는
직전 달 결과로, 차월핸디는 그 달 결과로 정해지므로, 해당 달에 스코어가 하나도
없으면 그 값은 아직 없는 것이다. 계산되지 않은 값이 확정된 것처럼 보이면 안 된다.

판정은 회원별이 아니라 **달 단위**다. 불참한 사람은 스코어가 없을 뿐 그 달
결과는 나왔다. 회원별로 보면 불참한 달마다 다음 달 핸디가 사라져 버린다.
모임 자체가 없던 달은 핸디가 그대로 넘어가므로 확정으로 본다.

---

## 7. 라우팅과 셸

HashHistory 를 쓴다. GitHub Pages 는 임의 경로를 `index.html` 로 돌려주지
못하므로 `#/monthly` 형태여야 새로고침과 직접 링크가 산다.

- 각 화면은 지연 로드한다. 첫 화면(로그인)에 나머지 코드가 딸려오지 않는다.
- `/monthlyRecord/` 는 옛 경로다. 쿼리를 유지한 채 리다이렉트만 남긴다.
  단톡방에 돌아다니는 링크가 아직 살아 있다.
- `/attendance` 는 모달이지만 주소를 갖는다. 링크로 열 수 있어야 하고,
  뒤로가기가 곧 닫기여야 하기 때문이다. 앱 안에서 열었으면 `router.back()`,
  링크로 바로 들어왔으면 갈 곳이 없으므로 그 달 기록으로 바꿔 준다.
- 없는 경로는 홈으로 튕기지 않고 404 를 보여준다. 튕기면 주소가 틀렸다는
  사실 자체를 알 수 없다.
- `Layout.vue` 는 고정 높이 셸이다. 본문만 스크롤되므로 긴 표에서도 열 제목이
  항상 보인다.

---

## 8. PWA

`vite-plugin-pwa` 를 쓰되 등록은 `src/lib/pwa.ts` 가 직접 한다. 화면을 먼저
띄우고 나서 등록해, 서비스 워커 설치가 첫 렌더를 붙잡지 않게 한다.

- `registerType: 'prompt'`. 새 버전을 발견하면 토스트로 물어본다.
  `autoUpdate` 는 말없이 새로고침하는데, 이 앱은 점수를 표에 입력하는 중일 수
  있어서 쓸 수 없다.
- **Supabase 응답에는 캐시 규칙을 두지 않는다.** 규칙이 없으면 서비스 워커가
  손대지 않고 그대로 네트워크로 나간다. 점수·참석 같은 기록이 오래된 사본으로
  보이는 일이 절대 없어야 한다.
- 구글 폰트만 캐시한다. 매번 네트워크를 타면 오프라인에서 한글이 시스템
  폰트로 튄다.
- `vite.config.ts` 의 `BASE` 와 manifest 의 `start_url`·`scope` 는 같아야 한다.
  다르면 안드로이드가 설치를 제안하지 않고 iOS 홈 화면 아이콘도 밖으로 나간다.

---

## 9. 남은 약점

- **월 기록 저장이 원자적이지 않다.** 기존 `meeting_results` 를 지우고 다시
  넣는데 이 둘이 한 트랜잭션이 아니다. 중간에 끊기면 그 달 결과가 빈다.
  RPC 하나로 묶는 것이 정공법이다.
- **규칙이 프런트와 DB 두 곳에 있다.** 차월핸디와 연간 랭킹이 그렇다. 미리보기와
  집계 성능을 위한 의도된 중복이지만, 한쪽만 고치면 조용히 갈라진다.
- **자동화된 테스트가 없다.** 핸디 규칙처럼 경우의 수가 많은 로직은 SQL 로
  전 회원·전 월을 다시 계산해 저장값과 대조하는 식으로 검증해 왔다.
- **골프장 이름이 자유 입력이다.** 같은 코스가 다른 이름으로 들어갈 수 있다.
