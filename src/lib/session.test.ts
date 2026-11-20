import { describe, expect, it } from 'vitest';
import { idleTimeoutLabel, idleTimeoutMs } from '@/lib/session';

describe('역할별 유휴 한도', () => {
  it('회원은 3시간, 관리자는 30분', () => {
    expect(idleTimeoutMs('member')).toBe(3 * 60 * 60 * 1000);
    expect(idleTimeoutMs('admin')).toBe(30 * 60 * 1000);
  });
  it('역할을 모르면 회원 기준', () => {
    expect(idleTimeoutMs(undefined)).toBe(3 * 60 * 60 * 1000);
  });
  it('안내 문구', () => {
    expect(idleTimeoutLabel('member')).toBe('3시간');
    expect(idleTimeoutLabel('admin')).toBe('30분');
  });
});
