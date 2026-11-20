import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 화면 가드(취소·월 전환·저장 확인)와 모바일 터치·글자 규칙을 소스에서 직접 확인하는 정적 테스트.
const table = readFileSync('src/components/MonthlyTable.vue', 'utf8');
const page = readFileSync('src/pages/Monthly.vue', 'utf8');
const detailButton = readFileSync('src/components/ui/RowDetailButton.vue', 'utf8');

describe('월간 기록 표 가드', () => {
  it('취소 버튼은 편집 모드면 항상 보이고 변경분이 있으면 폐기 확인을 거친다', () => {
    expect(table).not.toMatch(/v-if="isEditing && unlockReason !== null"/);
    expect(table).toMatch(/@click="requestCancel"/);
    expect(table).toContain('저장하지 않은 입력이 있습니다. 취소하면 입력한 내용이 사라집니다.');
  });

  it('저장은 요약 확인을 거쳐 doSave 에서 내보낸다', () => {
    expect(table).toMatch(/onOk: doSave/);
    expect(table).toMatch(/명 참석/);
    expect(table).toMatch(/function doSave\(\)[\s\S]*emit\('save'/);
  });

  it('달 전환은 변경분이 있으면 requestMonth 에서 막고 새로고침은 beforeunload 로 경고한다', () => {
    expect(page).toMatch(/function requestMonth/);
    expect(page).toMatch(/beforeunload/);
    expect(page).toMatch(/v-model:selected-month="monthModel"/);
    expect(page).not.toMatch(/selectedMonth\.value = m;/);
    expect(table).toMatch(/emit\('dirty-change'/);
  });
});

describe('월간 기록 표 모바일 규칙', () => {
  it('표 글자는 모바일에서도 text-sm 이다', () => {
    expect(table).not.toContain('text-xs sm:text-sm');
  });

  it('이름·참석 버튼은 모바일 44px 이다', () => {
    expect(table).toMatch(/ATTENDANCE_BUTTON_CLASS =\s*'[^']*min-h-11 sm:min-h-0/);
    expect(detailButton).toContain('min-h-11');
  });

  it('좁은 폭 읽기 모드에서도 이름 아래 보조 줄에 당월·차월 핸디를 보인다', () => {
    expect(table).toMatch(/isEditing \? 'md:hidden' : 'sm:hidden'/);
    expect(table).toContain("당월 {{ row.app_hc ?? '미정' }} · 차월");
  });

  it('저장 실패 문구를 하단 고정 저장 줄에 alert 로 보인다', () => {
    expect(table).toMatch(/saveError\?: string \| null/);
    expect(table).toMatch(/:role="props\.saveState === 'error' \? 'alert' : undefined"/);
    expect(page).toContain(':save-error="saveError"');
  });

  it('편집 진입 때 저장된 조·시상이 자동 계산과 다르면 수동 지정으로 보존한다', () => {
    expect(table).toMatch(/function preserveStoredManual/);
    expect(table).toMatch(/function enterEdit\(\)[\s\S]*preserveStoredManual\(\)/);
  });

  it('표 위 NET 설명·이름 안내 문구는 두지 않는다', () => {
    expect(table).not.toContain('낮을수록 좋음');
    expect(table).not.toContain('이름을 누르면 숨은 열까지');
  });
});

describe('월간 툴바', () => {
  it('이전·다음 달 화살표 버튼은 없고 월은 선택 상자로만 바꾼다', () => {
    expect(table).not.toContain('aria-label="이전 달"');
    expect(table).not.toContain('aria-label="다음 달"');
    expect(page).toMatch(/set: \(v: string\) => requestMonth\(v\)/);
  });

  it('Winner·Medalist 는 읽기 모드에서 모바일에도 보이고 편집 모드에서만 숨는다', () => {
    expect(table).toMatch(/isEditing \? 'hidden sm:flex' : 'flex'/);
  });

  it('제목은 truncate 로 자르지 않고 줄바꿈한다', () => {
    expect(table).not.toMatch(/CardTitle as="h1"[^>]*truncate/);
  });
});
