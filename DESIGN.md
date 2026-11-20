---
name: 따만라자 골프모임
description: 잔디 위의 스코어카드. 조용한 초록과 정돈된 숫자 표로 월례 모임 기록을 보여주는 앱.
colors:
  background: "oklch(0.99 0.005 145)"
  foreground: "oklch(0.15 0.01 145)"
  card: "oklch(0.98 0.008 145)"
  primary: "oklch(0.52 0.15 145)"
  primary-foreground: "oklch(0.98 0.005 145)"
  secondary: "oklch(0.92 0.02 145)"
  muted: "oklch(0.95 0.01 145)"
  muted-foreground: "oklch(0.48 0.015 145)"
  accent: "oklch(0.88 0.03 145)"
  border: "oklch(0.88 0.015 145)"
  destructive: "oklch(0.55 0.22 25)"
  net-plus: "oklch(0.546 0.245 262.881)"
  net-minus: "oklch(0.553 0.195 38.402)"
  delta-up: "oklch(0.55 0.22 25)"
  delta-down: "oklch(0.546 0.245 262.881)"
  std-accent: "oklch(0.491 0.27 292.581)"
typography:
  body:
    fontFamily: "Noto Sans KR, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  title:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  table:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
  numeric:
    fontFamily: "JetBrains Mono, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  screen-gap: "0.75rem"
  gutter: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 16px"
  button-toolbar:
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 8px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 12px"
---

# Design System: 따만라자 골프모임

## Overview

**Creative North Star: "잔디 위의 스코어카드"**

골프장 잔디의 초록과 종이 스코어카드의 정돈된 숫자 표를 모델로 한 단일 라이트 테마. 분위기는 차분하고 가독성이 우선임. 회원 다수가 스마트폰(375px 전후)으로, 중장년 사용자가 큰 글씨로 읽는 것을 기준으로 함. 장식보다 숫자와 순위가 먼저 보이게 하고, 색은 뜻이 있을 때만 씀.

깊이는 테두리와 면 색으로 표현함. 그림자는 카드에 아주 약하게만 있음. 화려한 그라데이션, 네온, 게임 같은 연출, 과한 그림자는 이 시스템에서 쓰지 않기로 확인함.

**Key Characteristics:**
- 초록(hue 145) 단일 브랜드 계열. 토큰이 유일한 출처
- 밝은 화면 하나만 사용. 다크 팔레트 없음
- 본문 Noto Sans KR, 숫자 JetBrains Mono로 자릿수를 세로 정렬
- 평평하고 테두리 중심의 면 구성
- 표가 중심 컴포넌트. 열 색에 약속된 뜻이 있음

## Colors

초록 한 계열이 면과 강조를 모두 맡고, 숫자의 뜻을 나타내는 의미색만 파랑·주황·빨강·보라로 따로 둠.

### Primary
- **잔디 초록** (oklch(0.52 0.15 145)): 기본 버튼, 링크, 포커스 링, 선택 상태. `--primary`, `--ring`, `--sidebar-primary`가 같은 값

### Neutral
- **옅은 잔디 종이** (oklch(0.99 0.005 145)): 페이지 배경
- **카드 종이** (oklch(0.98 0.008 145)): 카드 면
- **먹색 잉크** (oklch(0.15 0.01 145)): 본문 글자
- **흐린 잉크** (oklch(0.48 0.015 145)): 보조 글자, 표 머리글, Medalist 숫자
- **연한 풀빛 테두리** (oklch(0.88 0.015 145)): 카드·입력·표 구분선
- **연한 풀빛 면** (oklch(0.92 0.02 145) / oklch(0.88 0.03 145)): secondary, accent(호버)

### 의미색 (화면에 직접 값을 쓰지 않고 토큰으로만 사용)
- **Net 플러스 파랑** (oklch(0.546 0.245 262.881)): Net·평균 Net이 0 이상, 핸디 인하. `--net-plus`, `--delta-down`
- **Net 마이너스 주황** (oklch(0.553 0.195 38.402)): Net·평균 Net이 음수. `--net-minus`
- **핸디 인상 빨강** (oklch(0.55 0.22 25)): 핸디 인상, 오류, 파괴적 동작. `--delta-up`, `--destructive`
- **2027 기준핸디 보라** (oklch(0.491 0.27 292.581)): 2027 기준핸디 강조. `--std-accent`

### Named Rules
**The 열 색 약속 Rule.** 기준핸디는 주황, 당월·차월 핸디와 Net은 파랑, 원점수는 무채색. 열마다 정해진 색을 다른 뜻으로 재사용하지 않음.
**The 토큰 단일 출처 Rule.** 의미색은 `:root` 토큰에서만 정함. 화면에 `blue-600`, `#2563eb` 같은 값을 직접 쓰지 않음.
**The 시상 배지 한 곳 Rule.** Winner(금)·Medalist(은)·Host(보라) 색은 `src/lib/rank.ts`에서만 정함. 2027 기준핸디 보라와 뜻이 다르므로 합치지 않음.

## Typography

**Body Font:** Noto Sans KR (-apple-system, system-ui 폴백)
**Numeric Font:** JetBrains Mono (Courier New 폴백)

**Character:** 한글이 촘촘한 표에서도 읽히는 고딕과, 점수·핸디·순위 자릿수를 맞추는 고정폭 숫자의 조합.

### Hierarchy
- **Title** (700, 1.125rem / text-lg): 화면 제목 h1
- **Body** (400, 0.875rem / text-sm): 메뉴, 본문. 메뉴는 14px
- **Table** (400, 0.75rem → sm 이상 0.875rem): 표 안 글자만 한 칸 작음
- **Numeric** (500, font-mono): 점수·핸디·순위 칸. `font-mono`를 빠뜨리지 않음

### Named Rules
**The 숫자는 고정폭 Rule.** 숫자 칸에는 항상 `font-mono`를 적용해 자릿수가 세로로 맞게 함.

## Layout

화면 컨테이너는 `container mx-auto px-4 max-w-5xl`(1024px). 폭은 각 화면이 정하고 Layout의 main은 자르지 않음. 세로 간격은 `space-y-3`. 세로 스크롤 상자는 Layout의 main 하나뿐이고 표는 스스로 스크롤하지 않음(`Table scroll=false`), 열 제목만 sticky로 남음. 가로로 넓은 표는 첫 두 열(순위·이름)을 sticky로 고정함. 모바일에서는 보조 열을 `pp-hide-sm`처럼 숨겨 375px 가로 넘침을 막음.

## Elevation & Depth

평평하고 테두리 중심. 카드만 `shadow-sm`과 1px 테두리를 가짐. 상태 변화(호버·선택)는 면 색과 테두리 색으로 표현하고 그림자를 늘리지 않음.

### Named Rules
**The Flat-By-Default Rule.** 면은 평평하게 두고, 깊이가 필요하면 테두리나 면 색 차이로 표현함. 새 그림자 값을 추가하지 않음.

## Shapes

둥근 모서리는 `--radius` 0.5rem을 기준으로 sm 4px, md 6px, lg 8px, xl 12px. 버튼·입력은 md(6px), 카드는 lg(8px). 테두리는 1px `--border`. 장식용 도형이나 클리핑 없음.

## Components

### Buttons
- **Shape:** 6px 모서리, `inline-flex`, 글자 text-sm font-medium
- **Primary:** 잔디 초록 면 + 밝은 글자, 높이 40px, 패딩 8px 16px. 호버 시 90% 투명도
- **Variants:** destructive, outline(테두리+배경), secondary, ghost, link
- **툴바 규격:** `size="xs"`(높이 32px, text-xs). 화면마다 h-7/h-8을 덮어쓰지 않음
- **Focus:** `ring-2 ring-ring` + offset 2px. 전역 `:focus-visible`이 2px 아웃라인을 받침

### Cards / Containers
- **Corner Style:** 8px
- **Background:** 카드 종이색, 1px 테두리, `shadow-sm`
- **Internal Padding:** CardHeader·CardContent 컴포넌트 기준

### Inputs / Fields
- **Style:** 높이 40px, 1px `--input` 테두리, 6px 모서리, 배경색은 페이지 배경
- **Focus:** `ring-2 ring-ring` + offset 2px
- **Error:** `border-destructive bg-destructive/10`, `aria-invalid` 병행

### Tables
- **Style:** 글자 text-xs sm:text-sm, 열 제목 sticky, 숫자 칸 font-mono, 첫 두 열 sticky
- **정렬:** 열 제목 버튼으로 정렬. `aria-sort` 표시

### Badges
- 6px 모서리, text-xs font-semibold. default/secondary/destructive/outline 변형
- 시상 배지(Winner·Medalist·Host)는 `RankBadge`와 `rank.ts`가 담당

## Do's and Don'ts

### Do:
- **Do** 숫자와 순위를 먼저 읽히게 하고, 숫자 칸에 `font-mono`를 쓴다.
- **Do** 의미색은 `--net-plus` 같은 토큰으로만 쓰고, 부호·라벨을 함께 둔다(색만으로 뜻 전달 금지).
- **Do** 터치 영역 44px 이상, 본문 14px 이상, 텍스트 대비 AA 4.5 이상을 목표로 한다. 예외로 표 안 라벨(11px)과 산정결과 표의 관리자 버튼(12px, 32px)은 밀도를 위해 작게 둔다.
- **Do** 움직임은 `prefers-reduced-motion: reduce` 에서 전역으로 꺼진다(`index.css` base). 새 애니메이션도 이 규칙에 맡긴다.
- **Do** 브라우저 표면 색(`theme-color`, manifest `theme_color`, favicon)은 `--primary`(#1b7e2a)와 같은 값을 쓴다.
- **Do** 컨트롤(Input, Select, Button xs)은 14px, 본문은 16px이다. 산정결과 라벨은 한도 빨강, 부족 주황, 휴면 회색으로 구분한다.
- **Do** 모달은 `body`로 옮겨지므로 화면 전용 변수가 아니라 `:root` 토큰을 쓴다.

### Don't:
- **Don't** 화려한 그라데이션, 네온, 게임 같은 연출, 과한 그림자를 쓰지 않는다. (시상 배지의 기존 그라데이션은 `rank.ts` 한 곳에 한정된 예외)
- **Don't** 다크 팔레트를 켜는 코드 없이 다크 변수를 추가하지 않는다.
- **Don't** ASCENDO 사내 BI(파랑 #0062C6)를 이 앱에 적용하지 않는다.
- **Don't** 표 안에서 세로 스크롤을 만들지 않는다(sticky 머리글이 깨짐).
- **Don't** Layout의 main에 `max-w`를 두지 않는다. 화면 쪽 선언이 무시됨.
