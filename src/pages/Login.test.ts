import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 로그인 화면 두 곳(전용 페이지·계정 창)이 같은 약속을 지키는지 소스로 확인하는 정적 테스트.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const page = read('./Login.vue');
const modal = read('../components/LoginModal.vue');
const input = read('../components/ui/Input.vue');
const pinForm = read('../components/PinChangeForm.vue');

describe('로그인 화면 정적 점검', () => {
  it('회원 목록이 비면 불러오는 중·실패 사유·다시 시도를 보여 주고 로그인을 막는다', () => {
    for (const src of [page, modal]) {
      expect(src).toContain('membersLoading');
      expect(src).toContain('dataError');
      expect(src).toContain('다시 시도');
      expect(src).toMatch(/:disabled="\w+ \|\| membersUnavailable"/);
    }
  });

  it('임시 PIN 안내가 로그인 화면·계정 창·PIN 변경 폼에 있다', () => {
    expect(page).toContain('처음이면 관리자에게 받은 임시 PIN 입력');
    expect(modal).toContain('처음이면 관리자에게 받은 임시 PIN 입력');
    expect(pinForm).toContain('1111, 1234 같은 쉬운 숫자는 불가');
  });

  it('remember 기본값은 두 곳 모두 true', () => {
    expect(page).toMatch(/const remember = ref\(true\)/);
    expect(modal).toMatch(/const remember = ref<boolean>\(true\)/);
    expect(modal).toContain('remember.value = true;');
  });

  it('제목은 모임명 고정 표기', () => {
    expect(page).toContain('따만라자 골프모임</h1>');
  });

  it('Input 은 모바일 44px·16px, 데스크톱 40px·14px', () => {
    expect(input).toContain('h-11');
    expect(input).toContain('text-base');
    expect(input).toContain('sm:h-10');
    expect(input).toContain('sm:text-sm');
  });
});
