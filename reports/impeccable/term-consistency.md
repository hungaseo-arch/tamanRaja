# 화면 문구 용어 정합성 검증

- 기준: 메인 작업 트리 읽기 전용 점검(2026-11-20). 소스 수정 없음
- 대상: src/pages/*.vue, src/components/*.vue, src/components/ui/*.vue (테스트·주석 제외)
- 용어 기준 문서: PRODUCT.md "용어 고정" 항목(기준핸디, 인간미 −2~+2 정수, Net, 가중평균 오버파, 시상 Winner·Medalist·Host), PRODUCT.md "Brand Commitments"(모임명 "따만라자 골프모임"), DESIGN.md 의미색 절(기준핸디, 당월·차월 핸디, Net)
- 제외(확정된 결정): 정책 화면 '25년/26년/27년' 연도 표기, 인간미 청록, 삭제된 안내문구
- 개수: 주석·스크립트 식별자를 뺀 줄 단위 grep 근거. 같은 줄 중복은 1건. 범위 표기(예: 40~54)는 해당 구간의 다수 줄

## 1. 용어군별 사용 현황

### 1-1. 핸디군

| 용어 | 사용 위치 | 개수 |
|---|---|---|
| 기준핸디(붙임) | AdminMembers.vue:120, 698 · HandicapPolicy.vue:77, 82, 83, 259, 471, 588, 644 · HandicapResultsTable.vue:524 · MemberHandicapTrend.vue:70, 129, 136, 142, 144, 145 | 약 20 |
| 기준 핸디(띄움) | MyProfile.vue:324, 430 · YearlyRanking.vue:515, 518, 653, 689 · AttendancePanel.vue:132 · MonthlyTable.vue:805, 1047, 1098, 1131, 1135, 1142, 1143, 1144 | 약 15 |
| 핸디캡 | HandicapPolicy.vue:10, 251 · AttendancePanel.vue:142, 143 | 4 |
| 핸디(단독 제목·메뉴) | Layout.vue:41, 43 · MonthlyTable.vue:733, 734, 738, 1092, 1093 | 7 |
| 당월 핸디 | MyProfile.vue:325, 431 · MonthlyTable.vue:754, 808, 859, 860, 1017, 1050, 1100, 1101, 1103, 1123, 1127, 1144, 1146 | 16 |
| 차월 핸디 | MyProfile.vue:326, 432 · MonthlyTable.vue:337, 809, 859, 860, 881, 1054, 1102, 1110, 1117 | 12 |
| 적용 핸디(금회·이번 모임) | HandicapPolicy.vue:644("금회적용 핸디") · AttendancePanel.vue:136("이번 모임 적용 핸디") | 2 |
| 다음 달 핸디(풀어쓴 말) | MonthlyTable.vue:1103("다음 달의 당월 핸디") | 1 |
| 산출핸디 | HandicapPolicy.vue:70, 77 · HandicapResultsTable.vue:479, 549 | 4 |
| HC / handicap(화면 노출) | 없음. 식별자·id 에만 존재(`add-std-hc` 등) | 0 |

### 1-2. 점수·Net·순위군

| 용어 | 사용 위치 | 개수 |
|---|---|---|
| 스코어 | MonthlyTable.vue:306, 762, 798, 811, 903, 1018, 1059, 1101 · MyProfile.vue:307, 315, 327, 436 · YearlyRanking.vue:127, 421, 555, 558, 661 | 약 26 |
| 평균 스코어 | YearlyRanking.vue:127, 421, 555, 558, 661 | 5 |
| 오버파 / 실오버파 / 보정 오버파 / 가중평균 오버파 | MonthlyTable.vue:306, 762, 811 · HandicapPolicy.vue:40~54, 71, 72, 478, 516, 526 · HandicapResultsTable.vue:334, 536 | 약 16 |
| 타수 / 총타수 | HandicapPolicy.vue:42, 365, 468 · HandicapResultsTable.vue:356 · MonthlyTable.vue:762 | 5 |
| NET(대문자) | MonthlyTable.vue:813, 1063, 1101, 1105 · MyProfile.vue:328, 439 | 6 |
| Net(혼합) · 평균 Net | MyProfile.vue:263 · YearlyRanking.vue:127, 428, 538, 656 · HandicapPolicy.vue:479("실질 Net"), 502, 505, 517, 526 | 약 10 |
| 넷 | 없음 | 0 |
| 순위 | YearlyRanking.vue:482, 597, 648, 650, 689 · MonthlyTable.vue:1083("연간 순위") | 6 |
| 등수 | 화면 노출 없음(YearlyRanking.vue:412 주석뿐) | 0 |
| 랭킹 | Layout.vue:33 · YearlyRanking.vue:49, 366, 388, 389, 457, 473 · AdminMembers.vue:762 | 8 |

### 1-3. 조·시상·참석·회원군

| 용어 | 사용 위치 | 개수 |
|---|---|---|
| 1등조/2등조 | MonthlyTable.vue:336, 953, 954, 960, 961, 991, 992, 1071, 1072, 1105, 1122~1144 · MyProfile.vue:380, 449 · HandicapPolicy.vue:644 | 18 |
| 결과 그룹(헤더·라벨) | MonthlyTable.vue:814, 1070 | 2 |
| 조 편성 / 조 변경 / 직접 지정한 조 | MonthlyTable.vue:342, 765, 1104, 1144, 1145 | 5 |
| 시상 / 시상보정 / 시상횟수 | HandicapPolicy.vue:58~71, 298, 304, 319~334, 494 · HandicapResultsTable.vue:476~478, 544~548 · MonthlyTable.vue:342, 765, 972 · YearlyRanking.vue:398 | 약 25 |
| Winner / Medalist / Host | MyProfile.vue:276~289 · YearlyRanking.vue:439~441, 567~569, 667~678 · MonthlyTable.vue:333~335, 977~979 · HandicapPolicy.vue:98~100 | 약 30 |
| W/M/H 약칭 | HandicapResultsTable.vue:476, 544 | 2 |
| 우승 · 상(단독) | 화면 노출 없음 | 0 |
| 참석(상태) | MonthlyTable.vue:479, 485, 804, 871, 1044 · AttendancePanel.vue:49, 94 · MyProfile.vue:427 | 8 |
| 참석(횟수·열 제목) | YearlyRanking.vue:498, 437, 652 · AdminMembers.vue:584, 863 · MyProfile.vue:257("참석 횟수") | 6 |
| 참석인원 / 참석 예정 인원 / N명 참석 | MonthlyTable.vue:332, 612, 617 | 3 |
| 참석률 | HandicapPolicy.vue:77, 408, 421 · HandicapResultsTable.vue:335, 537, 550 | 6 |
| 참가 · 출석 | 화면 노출 없음 | 0 |
| 미정 | AttendancePanel.vue:50 · MonthlyTable.vue:480, 859, 881, 1052 | 5 |
| 미응답 | MonthlyTable.vue:482 | 1 |
| 불참 | AttendancePanel.vue:51 · MonthlyTable.vue:481, 486, 1145, 1146 · MyProfile.vue:428 · AdminMembers.vue:866 · HandicapPolicy.vue:423 | 9 |
| 휴면 / 현역 | AdminMembers.vue:321~358, 483, 502, 655, 757~776 · HandicapResultsTable.vue:187, 357, 399, 559 · HandicapPolicy.vue:391, 396, 647, 656 | 약 20 |
| 회원 | 전 화면(AdminMembers, Login, LoginModal, AdminLogs, MonthlyTable 등) | 약 70 |
| 멤버 | 화면 노출 없음 | 0 |
| 님 | AdminMembers.vue:835 · Layout.vue:153 | 2 |
| 관리자 | AdminMembers, AdminLogs, Login 외 | 약 23 |
| 운영진 | HandicapResultsTable.vue:355 | 1 |

### 1-4. 증감·제안·확정군

| 용어 | 사용 위치 | 개수 |
|---|---|---|
| 인상 / 인하 | HandicapResultsTable.vue:217, 218, 356 · HandicapPolicy.vue:139, 140, 466, 468, 490, 495, 659 | 약 10 |
| 축소 / 확대(핸디 방향) | HandicapPolicy.vue:98, 100 | 2 |
| 상향 / 하향(가중) | HandicapPolicy.vue:270 | 1 |
| 증감 | HandicapPolicy.vue:319, 434 · HandicapResultsTable.vue:357, 481, 482, 531, 553, 556 | 약 8 |
| 인간미 | HandicapResultsTable.vue:308, 355, 361, 368, 427, 435, 507~510, 529 | 14 |
| 보정(단독) | HandicapPolicy.vue:40, 64, 71 · HandicapResultsTable.vue:355("가감하는 보정값"), 478, 548 | 6 |
| 제안 | HandicapResultsTable.vue:332, 355, 530 | 3(+식별자 proposal) |
| (안) | HandicapPolicy.vue:10, 251, 254, 596, 598, 636 · HandicapResultsTable.vue:524, 528, 530 | 8 |
| 확정 전 | MemberHandicapTrend.vue:129 | 1 |
| 확정된 기록 | MonthlyTable.vue:1170 | 1 |
| draft(화면 노출) | 없음. 식별자만 존재(HandicapResultsTable.vue:259, MemberHandicapTrend.vue:92) | 0 |
| 임시 PIN | AdminMembers.vue:155, 660, 718, 791, 833, 835 · Login.vue:132 · LoginModal.vue:220 | 8 |

### 1-5. 연도·날짜·단위

| 표기 | 사용 위치 | 개수 |
|---|---|---|
| `2026년 7월`(formatYearMonth) | format.ts:41~44 → AttendancePanel.vue:72, 90, 94 | 3 |
| `7월` 단독 | MyProfile.vue:183~184 · Monthly.vue:143 | 3 |
| `2026-07` 원형 노출 | Monthly.vue:97(문서 제목), 303(토스트) · AdminMembers.vue:334, 483 | 4 |
| `2026년`(연간 랭킹·나의 기록) | YearlyRanking.vue:388, 389, 462, 473, 645, 687 · MyProfile.vue:244, 245, 422 | 9 |
| `27년 / 26년 / 25년`(정책 화면, 확정 결정) | Layout.vue:41, 42 · HandicapResultsTable.vue:328~335, 349, 355 | 제외 |
| 단위 `회` | MyProfile.vue:277~289 · YearlyRanking.vue:437, 473, 618~626, 652, 688 · AdminMembers.vue:864 | 약 15 |
| 단위 `경기` | YearlyRanking.vue:473, 687 · MonthlyTable.vue:788("경기 결과") | 3 |
| 단위 `건` | Monthly.vue:303 · HandicapResultsTable.vue:308, 365, 509 · AdminMembers.vue:456, 866 · MonthlyTable.vue:337 | 약 7 |
| 단위 `명` | MonthlyTable.vue:332, 336, 613, 618 · HandicapPolicy.vue:455 | 약 6 |
| 단위 `타` | HandicapPolicy.vue:139, 140, 636 | 소수 |

### 1-6. 문체·버튼·진행 문구

| 항목 | 사용 위치 | 개수 |
|---|---|---|
| 취소 | AdminMembers.vue:728, 748, 774, 799, 824 · HandicapResultsTable.vue:367, 518 · AttendancePanel.vue:149 · MonthlyTable.vue:682, 1028, 1189 | 11 |
| 닫기 | AdminMembers.vue:849("확인했음 · 닫기") · Dialog.vue:146 · Toaster.vue:53 | 3 |
| 저장 | MonthlyTable.vue:313, 673, 1034 · AttendancePanel.vue:153 · HandicapResultsTable.vue:365, 519 · Monthly.vue:310 | 약 10 |
| 저장하기 | 없음 | 0 |
| 진행 `...`(ASCII 3점) | Login.vue:118, 161 · LoginModal.vue:205, 251 · AttendancePanel.vue:153 · PinChangeForm.vue:171 · MonthlyTable.vue:673, 1034 · AsyncState.vue:52 | 9 |
| 진행 `…`(유니코드) | AdminMembers.vue:730, 750, 776, 801, 826 | 5 |
| 진행 점 없음 | HandicapResultsTable.vue:365("저장 중") | 1 |
| 존댓말·서술형(해 주세요/합니다/하시나요) | MonthlyTable.vue:306, 384, 754, 762, 788, 1018, 1170, 1172 · AttendancePanel.vue:90, 146 · Monthly.vue:349 | 11 |
| 개조식(명사형 종결) | AdminMembers.vue:156, 171, 681, 716~720, 744~745 · MemberHandicapTrend.vue:70, 145 · PinChangeForm.vue:71, 75, 96, 167 · HandicapResultsTable.vue:349, 510 | 다수 |
| 오류 문구 `~ 실패` | AdminMembers.vue:90, 240, 278, 323, 344, 448, 457 · Monthly.vue:284, 310 · AdminLogs.vue:135 · AsyncState.vue:62 | 약 11 |
| 오류 문구 `~ 필요/불가` | AdminMembers.vue:118~126, 171 · Login.vue:64 · LoginModal.vue:112 · PinChangeForm.vue:71 | 약 9 |
| 오류 문구 `저장 중 오류 발생` | PinChangeForm.vue:96 | 1 |

## 2. 불일치 목록

### 상: 뜻을 오해할 수 있음

| # | 위치 | 문제 | 권장 통일안 |
|---|---|---|---|
| 상-1 | MonthlyTable.vue:762, 811, 1101 · MyProfile.vue:327, 436 · YearlyRanking.vue:421, 558, 661 · HandicapPolicy.vue:42, 516 | '스코어'가 화면마다 다른 값처럼 읽힘. 월간 기록은 "총타수가 아니라 오버파를 입력"(MonthlyTable.vue:762)이라 스코어 = 오버파. 정책 화면은 같은 값을 '실오버파'(516), 별도 값을 '보정 오버파'(40)로 부름. 연간 랭킹 '평균 스코어'는 코드 주석(YearlyRanking.vue:117~120)상 "친 그대로". '타수/총타수'(HandicapPolicy.vue:42, MonthlyTable.vue:762)는 Par 가산 전 값이라 스코어와 뜻이 다름. 일반 독자는 스코어를 총타수로 읽기 쉬움 | 회원 화면 전체에서 '스코어' = 오버파(Par 대비)로 고정하고 월간 기록 용어 창(MonthlyTable.vue:1096~1106)에 한 줄 정의 추가. 정책 화면 '실오버파'는 '스코어(오버파)'와 병기. '총타수'는 Par 가산 전 값에만 사용 |
| 상-2 | AttendancePanel.vue:136, 137 · MonthlyTable.vue:808, 1100~1103 · MyProfile.vue:325 · HandicapPolicy.vue:644 | 같은 값(이번 달 경기에 적용되는 핸디)이 '이번 모임 적용 핸디'(AttendancePanel), '당월 핸디'(월간·나의 기록), '금회적용 핸디'(정책)로 3종 표기. AttendancePanel 의 값은 `handicap.next_hc`(137행)라 '차월 핸디' 필드를 '이번 모임'으로 부름. 시점이 반대인 두 용어가 한 필드에 붙음 | 표준 '당월 핸디'. AttendancePanel.vue:136 과 HandicapPolicy.vue:644 도 '당월 핸디'로 통일. MonthlyTable.vue:1103 풀이문 '다음 달'은 '차월'로 |
| 상-3 | AttendancePanel.vue:50 · MonthlyTable.vue:480, 859, 881, 1052 | '미정'이 두 뜻으로 쓰임. 참석 응답 '미정(아직 정하지 못함)'(AttendancePanel.vue:50, MonthlyTable.vue:480)과 핸디 '미정(아직 산정 안 됨)'(MonthlyTable.vue:859, 881, 1052)이 같은 표 안에 공존. 상세창에서 1044 '참석'과 1052 '미정(직전 달 결과 저장 후)'이 이어져 혼동 | 핸디 쪽은 '산정 전'으로 변경. '미정'은 참석 응답 전용 |
| 상-4 | HandicapResultsTable.vue:330, 332, 355, 524, 528, 530 · HandicapPolicy.vue:596, 598 · MemberHandicapTrend.vue:129 | '안' 계열 표기가 갈리고 뜻이 겹침. 열은 '27년 기준'(330)·'27년 제안'(332), 상세창은 '27년 기준(안)'(528)·'27년 제안(안)'(530), 정책 표는 '2027 기준(안)'(596), 추이는 '확정 전'(129). '제안'은 기준 + 인간미(355)인데 '제안(안)'은 이중 표기. '기준(안)'과 '제안'이 모두 "아직 확정 아님"으로 읽혀 어느 쪽이 최종값인지 모호 | '27년 기준'(인간미 전)과 '27년 제안'(인간미 반영) 두 이름으로 고정하고 '(안)' 접미는 화면 제목·부제 한 곳에만 둠. 확정 전 표기는 '(안)' 하나로 통일하고 MemberHandicapTrend.vue:129 '(확정 전)'을 '(안)'으로 |
| 상-5 | Layout.vue:41 · HandicapPolicy.vue:10, 251 · AttendancePanel.vue:142, 143 | '핸디'/'핸디캡' 혼용. 메뉴 '27년 핸디', 화면 제목 '27년 핸디캡 (안)', 참석 창 '핸디캡 정보 없음'. 다른 화면은 모두 '핸디'. 제목의 '핸디캡'이 본문 '기준핸디'와 다른 지표처럼 읽힘 | 표준 '핸디'. 제목은 '27년 기준핸디 (안)', AttendancePanel 은 '핸디 정보 없음' |

### 중: 같은 뜻 다른 말

| # | 위치 | 문제 | 권장 통일안 |
|---|---|---|---|
| 중-1 | 붙임: AdminMembers.vue:120, 698 · HandicapPolicy.vue 다수 · HandicapResultsTable.vue:524 · MemberHandicapTrend.vue 다수. 띄움: MonthlyTable.vue:805, 1047, 1098 외 · MyProfile.vue:324, 430 · YearlyRanking.vue:515, 518, 653 · AttendancePanel.vue:132 | '기준핸디'(약 20)와 '기준 핸디'(약 15)로 양분. PRODUCT.md "용어 고정"은 붙임 | '기준핸디'(붙임). 월간·나의 기록·연간 랭킹·참석 창 15곳 수정 |
| 중-2 | MonthlyTable.vue:813, 1063, 1101, 1105 · MyProfile.vue:328, 439 vs YearlyRanking.vue:428, 538, 656 · MyProfile.vue:263 · HandicapPolicy.vue:479, 502 | 'NET'(대문자)과 'Net' 혼용. 열 이름도 'NET 스코어' / '평균 Net' / '실질 Net'. PRODUCT.md 는 'Net' | 'Net'. 'NET 스코어'는 'Net'으로 줄이고 집계는 '평균 Net' |
| 중-3 | HandicapPolicy.vue:98, 100 vs 139, 140, 466~468, 490 · HandicapResultsTable.vue:217, 218 | 핸디 방향이 '축소/확대'(98, 100)와 '인하/인상'으로 이중화. 270 '상향/하향'은 가중치 쪽이라 별개 대상이지만 같은 계열 어휘 | 핸디 변화는 '인상/인하'. 가중치는 '높임/낮춤'으로 분리 |
| 중-4 | MonthlyTable.vue:814, 1070 vs 336, 765, 953, 954, 1104, 1105, 1144 | '결과 그룹'(열·라벨)과 '1등조/2등조·조 편성·조 변경'. 같은 개념이 '그룹'과 '조' 두 이름 | '조'로 통일(값 이름이 '1등조'). 열 제목은 '결과조' |
| 중-5 | HandicapResultsTable.vue:355 vs 관리자 문구 전체 | '운영진'(1곳)과 '관리자'(약 23곳). 같은 권한 주체 | '관리자' |
| 중-6 | MonthlyTable.vue:754, 1052 '직전 달' vs 1115, 1144, 1145 '직전 라운드' | 같은 창에서 '직전 달'과 '직전 라운드'가 별개 뜻(마지막 조 편성 달, 1145)이라 오독 여지. '라운드'는 정책 화면 '가중 라운드'(HandicapResultsTable.vue:475)에도 쓰여 의미 3종 | '직전 라운드'를 '마지막 편성 달'로 풀어 쓰고 '라운드'는 정책 화면 용어로 한정 |
| 중-7 | MyProfile.vue:323, 425 · MonthlyTable.vue:649, 650, 659 vs HandicapPolicy.vue:42, 502, 540 | '골프장'(기록 화면, 9곳)과 '구장'(정책 화면, 9곳) | '골프장'. 정책 화면 9곳 수정 |
| 중-8 | Layout.vue:112, 115 '따만라자 모임' vs Login.vue:101 '따만라자 골프모임' | 앱 이름 이중 표기. PRODUCT.md "Brand Commitments"는 '따만라자 골프모임' | '따만라자 골프모임'. 좁은 헤더 폭 때문이면 줄임 규칙을 DESIGN.md 에 명시 |
| 중-9 | YearlyRanking.vue:498, 437, 652 · AdminMembers.vue:584, 863 vs MonthlyTable.vue:804, 479 vs MyProfile.vue:257 | '참석' 한 단어가 횟수(연간 랭킹·회원 관리 열)와 상태(월간 열)를 뜻함. 나의 기록은 '참석 횟수'로 구분하나 연간 랭킹·회원 관리 열은 '참석' 단독. 정책 화면 '참석률'은 비율 | 횟수 열은 '참석 횟수', 상태 열은 '참석 여부', 비율은 '참석률' |
| 중-10 | MonthlyTable.vue:612 '참석 예정 인원', 617 '참석인원', 332 'N명 참석' | 인원 표기 3종, 띄어쓰기도 불일치 | '참석 인원'. 미래 달은 '참석 예정 인원' 유지 |
| 중-11 | Monthly.vue:97, 303 · AdminMembers.vue:334, 483 vs AttendancePanel.vue:72, 90 vs MyProfile.vue:183, Monthly.vue:143 | 연월 표기 3종(`2026-07` 원형, `2026년 7월`, `7월`). 문서 제목·토스트·휴면 문구가 `YYYY-MM` 을 그대로 노출. format.ts 의 formatYearMonth 를 쓰지 않음 | 사용자 노출 문구는 formatYearMonth(`2026년 7월`). 연도 선택 창 안의 월 버튼만 `7월` 허용 |
| 중-12 | YearlyRanking.vue:473, 687 '경기' vs 같은 줄 '회' · AttendancePanel.vue:90 '모임' | "치른 N경기 중 ... (N회) 참석자"로 경기·회가 한 문장에 섞임. MonthlyTable.vue:788 '경기 결과'와 AttendancePanel.vue:90·MonthlyTable.vue:640 '모임'은 같은 대상 | 월 1회 행사는 '모임', 횟수 단위는 '회'. 단위로서의 '경기'는 쓰지 않음 |
| 중-13 | HandicapResultsTable.vue:481, 482 '한도 전 증감'/'한도 후 증감' vs 553, 556 '한도 적용 전/후 증감' | 같은 열을 표와 상세창이 다르게 부름 | '한도 적용 전 증감' / '한도 적용 후 증감' |
| 중-14 | HandicapResultsTable.vue:187, 357, 401 '한도' · 357 '부족' vs 187 '표본 부족' · 562 '한도 적용' · HandicapPolicy.vue:460 '한도 적용' | 상태 뱃지(한도·부족)와 상세 라벨(한도 적용·표본 부족)이 달라 범례(357)와 뱃지가 1:1 대응 안 됨 | 뱃지·범례·상세 모두 '한도 적용'·'표본 부족' |
| 중-15 | AdminMembers.vue:835 · Layout.vue:153 '님' vs 나머지 '회원' · HandicapPolicy.vue:654 '이성남 회원' | 호칭 3종('님', '회원', 이름 단독) | '회원'(이름 + 회원) 기본. 계정 창 인사만 '님' 허용 |

### 하: 문체

| # | 위치 | 문제 | 권장 통일안 |
|---|---|---|---|
| 하-1 | MonthlyTable.vue:306, 384, 754, 762, 788, 1018, 1170, 1172 · AttendancePanel.vue:90, 146 · Monthly.vue:349 vs AdminMembers·PinChangeForm·MemberHandicapTrend 의 명사형 | 존댓말·서술형 11곳이 개조식 다수와 혼재. 화면 단위로 갈림(월간 기록·참석 = 서술형, 관리자·정책 = 개조식) | 오류·안내 문구는 개조식으로 통일. 참석 질문(AttendancePanel.vue:90)만 대화형 예외 허용 |
| 하-2 | 진행 문구 `...`(9곳) vs `…`(AdminMembers 5곳) vs 점 없음(HandicapResultsTable.vue:365) | 줄임표 3종 | `…`(유니코드) 하나 |
| 하-3 | AdminMembers.vue:849 '확인했음 · 닫기' vs Dialog.vue:146 · Toaster.vue:53 '닫기' vs '취소' 11곳 | 닫기/취소/확인 구분 규칙이 문서에 없음 | 변경 창 = '취소', 정보 창 = '닫기', 일회성 확인 = '확인' |
| 하-4 | Monthly.vue:302, 303 | 토스트 제목과 설명 모두 '저장 완료' 중복 | 제목 '저장 완료', 설명은 `2026년 7월 기록 N건`으로 |
| 하-5 | 오류 어조: `~ 실패`(약 11) vs `~ 필요/불가`(약 9) vs PinChangeForm.vue:96 '저장 중 오류 발생' | 결과형과 요구형은 구분 흔적이 있으나 PinChangeForm.vue:96 만 '오류 발생' | 결과 = `~ 실패`, 요구 = `~ 필요`로 고정하고 96행을 '저장 실패'로 |
| 하-6 | HandicapResultsTable.vue:476, 544 'W/M/H' | 약칭이 다른 화면의 Winner·Medalist·Host 전체 표기와 다름. 범례 부재 | 약칭 옆에 풀어 쓴 범례 병기 |

## 3. 판단 보류 항목(확정 결정과의 경계)

- 정책 화면 본문의 '2026년 기준핸디'(HandicapPolicy.vue:77, 83, 471), '2026 기준'(477, 595), '2027 기준(안)'(596), '2027년 기준핸디'(82)와 결과 표 열 '25년 기준'(HandicapResultsTable.vue:328)이 섞여 있음. 확정 결정은 결과 표의 '25년' 형식(커밋 fe1caca)이라, 본문·WHS 비교 표까지 확대할지는 사용자 결정 필요. 위반으로 세지 않음
- 인간미 청록과 삭제된 안내문구는 점검 제외

## 4. 권장 용어집 초안

| 개념 | 표준 표기 | 쓰지 않는 표기 |
|---|---|---|
| 해마다 1월에 정하는 기본 핸디 | 기준핸디 | 기준 핸디, 기본 핸디 |
| 이번 달 경기에 적용하는 핸디 | 당월 핸디 | 적용 핸디, 이번 모임 적용 핸디, 금회적용 핸디 |
| 이번 달 결과로 정해지는 다음 달 핸디 | 차월 핸디 | 다음 달 핸디, 다음달핸디 |
| 핸디 일반 | 핸디 | 핸디캡, HC, handicap |
| 개별 라운드 점수 | 스코어(오버파) | 총타수와 혼용 |
| 핸디 반영 후 점수 | Net | NET, 넷 |
| Net 평균 | 평균 Net | 평균 넷 |
| 월 1회 행사 | 모임 | 경기, 라운드('가중 라운드' 제외) |
| 골프장 | 골프장 | 구장, 코스 |
| 연간 순위표 화면 | 연간 랭킹 | 연간 순위(화면명) |
| 개인 순번 값 | 순위 | 등수 |
| 결과 구분 | 1등조 / 2등조 (총칭 '조') | 결과 그룹 |
| 시상 구분 | Winner / Medalist / Host (총칭 '시상') | 우승, 상 |
| 핸디 방향 | 인상 / 인하 (총칭 '증감') | 상향, 하향, 축소, 확대 |
| 관리자 보정값 | 인간미(−2 ~ +2 정수) | 보정(단독) |
| 확정 전 값 | (안) | 확정 전, 제안(안), draft |
| 인간미 반영 후 값 | 27년 제안 | 제안(안) |
| 참석 응답 | 참석 / 미정 / 불참 (응답 없음 = 미응답) | 참가, 출석 |
| 핸디 산정 대기 | 산정 전 | 미정(핸디 쪽) |
| 참석 지표 | 참석 횟수 / 참석 여부 / 참석률 / 참석 인원 | 참석(단독 열), 참석인원 |
| 휴면 상태 | 휴면 / 현역 | |
| 사람 지칭 | 회원 | 멤버, 님(계정 인사 제외) |
| 권한 주체 | 관리자 | 운영진 |
| 앱 이름 | 따만라자 골프모임 | 따만라자 모임 |
| 연월(사용자 노출) | 2026년 7월(formatYearMonth) | 2026-07 원형 |
| 단위 | 회(횟수), 명(인원), 건(저장·기록), 타(핸디·한도) | 경기(단위) |
| 진행 문구 | `… 중…`(유니코드 줄임표) | `...` |
| 버튼 | 저장 / 취소(변경 창) / 닫기(정보 창) / 다시 시도 | 저장하기, 확인했음 · 닫기 |
| 오류 문구 | `~ 실패`(결과), `~ 필요`(요구), 개조식 | 존댓말·서술형 |
