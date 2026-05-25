# 따만라자 골프모임 — Vue 3

React + shadcn-ui 원본을 **Vue 3 + Composition API + TypeScript + TailwindCSS v4 + VueUse*

## 빠르게 시작 / Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
npm run type-check   # vue-tsc --noEmit
npm run build        # production build
```

## 디렉터리 구조

```
golf-vue/
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── env.d.ts
├── MIGRATION.md             # React → Vue 마이그레이션 가이드
└── src/
    ├── main.ts              # Vue app 부트스트랩
    ├── App.vue              # 루트 컴포넌트
    ├── index.css            # Tailwind v4 + 디자인 토큰
    ├── router/index.ts      # vue-router (HashHistory)
    ├── lib/
    │   ├── index.ts         # 타입 + ROUTE_PATHS
    │   └── utils.ts         # cn()
    ├── data/index.ts        # MEMBERS/MEETINGS/HANDICAPS/... (원본 그대로)
    ├── composables/
    │   ├── useAuth.ts       # 인증 상태 (React hook 변환)
    │   └── useToast.ts      # 토스트 상태
    ├── components/
    │   ├── Layout.vue
    │   ├── LoginModal.vue
    │   ├── ScoreInputModal.vue
    │   ├── DashboardTable.vue
    │   └── ui/              # shadcn-vue 스타일 핵심 UI
    └── pages/
        ├── Dashboard.vue       # 완료
        ├── YearlyRanking.vue   # TODO (stub)
        └── MyProfile.vue       # TODO (stub)
```

## 동작하는 화면 / Working Pages
- 대시보드 (`/`) — 월 선택, 모임 정보, Winner/Medalist/Host, 회원별 핸디캡·점수·Net Score 테이블
- 로그인/PIN 변경 모달 — `sessionStorage` + `localStorage` 기반 (React 원본과 동일)
- 점수 입력 모달 — 로그인 회원 전용

## 남은 작업 / TODO
1. `YearlyRanking.vue` — `src/data/index.ts` 의 `getYearlySummary()` 호출
2. `MyProfile.vue` — 본인 월별 히스토리, PIN 변경 폼 재사용
3. Supabase 연동 (현재 데이터는 정적 시드)

자세한 변환 패턴은 [`MIGRATION.md`](./MIGRATION.md) 참고.
# tamanRaja
# tamanRaja
