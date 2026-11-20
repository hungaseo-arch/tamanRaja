import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 모달·컨트롤 공통 기준을 소스 문자열로 지킨다. 실제 렌더는 실기기에서 확인한다.
const read = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const button = read('components/ui/Button.vue');
const select = read('components/ui/Select.vue');
const input = read('components/ui/Input.vue');
const dialog = read('components/ui/Dialog.vue');
const footer = read('components/ui/DialogFooter.vue');
const title = read('components/ui/DialogTitle.vue');
const tabsTrigger = read('components/ui/TabsTrigger.vue');
const loginModal = read('components/LoginModal.vue');
const attendance = read('components/AttendancePanel.vue');
const monthlyTable = read('components/MonthlyTable.vue');

describe('컨트롤 글자 크기', () => {
  it('Button xs·Select 는 모든 폭에서 13px, Input 은 text-base 가 아니다', () => {
    expect(button).toMatch(/xs: '[^']*text-\[13px\][^']*'/);
    expect(select).toMatch(/xs: '[^']*text-\[13px\]/);
    expect(button).not.toMatch(/xs: '[^']*sm:text-xs/);
    expect(select).not.toContain('text-base');
    expect(select).not.toContain('sm:text-xs');
    expect(input).not.toContain('text-base');
  });

  it('MonthlyTable 툴바는 Select 글자 크기를 따로 덮어쓰지 않는다', () => {
    expect(monthlyTable).not.toContain('select-class="text-sm sm:text-xs"');
  });
});

describe('모달 구조', () => {
  it('제목은 18px 굵게, 닫기 버튼(44px) 자리를 비운다', () => {
    expect(title).toContain('text-lg');
    expect(title).toContain('font-bold');
    expect(title).toContain('pr-12');
  });

  it('하단 버튼 줄은 버튼 높이 44px, 모바일 두 칸', () => {
    expect(footer).toContain('[&>button]:h-11');
    expect(footer).toContain('grid-cols-2');
  });

  it('닫기 버튼은 44px 고정, 모달은 화면 높이 안에서 스크롤', () => {
    expect(dialog).toContain('h-11 w-11');
    expect(dialog).toContain('max-h-[calc(100dvh-2rem)]');
  });

  it('활성 탭은 그림자 대신 테두리', () => {
    expect(tabsTrigger).not.toContain('shadow-sm');
  });

  it('계정 창은 로그아웃을 이름 옆에 묶고 닫기 자리를 비운다', () => {
    expect(loginModal).toMatch(/flex items-center gap-3 pr-12/);
  });

  it('참석 패널은 이모지 대신 아이콘, 12px 라벨 없음', () => {
    expect(attendance).not.toMatch(/✅|🤔|❌/);
    expect(attendance).not.toContain('text-xs');
    expect(attendance).toContain('<DialogFooter>');
  });
});
