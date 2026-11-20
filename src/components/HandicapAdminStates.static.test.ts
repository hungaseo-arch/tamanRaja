import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 핸디 산정결과 표·관리자 회원 화면의 상태 표시와 확인 단계를 정적으로 점검한다.
const table = readFileSync('src/components/HandicapResultsTable.vue', 'utf-8');
const admin = readFileSync('src/pages/AdminMembers.vue', 'utf-8');
const policy = readFileSync('src/pages/HandicapPolicy.vue', 'utf-8');
const attend = readFileSync('src/components/AttendancePanel.vue', 'utf-8');

describe('인간미 저장 확인', () => {
  it('저장 버튼과 Enter 는 확인 창을 먼저 연다', () => {
    expect(table).toMatch(/@click="requestSave"/);
    expect(table).toMatch(/@keydown\.enter\.prevent="requestSave"/);
    expect(table).not.toMatch(/@click="saveEdit"/);
  });
  it('확인 후에만 RPC 를 부르고 서버 재조회를 유지한다', () => {
    expect(table).toMatch(/async function confirmSave[\s\S]*await saveEdit\(\)/);
    expect(table).toMatch(/rpc\('save_handicap_humanity'[\s\S]*await load\(\)/);
  });
});

describe('상태 표시 통일', () => {
  it('산정결과 표는 AsyncState 와 emptyHint 를 쓴다', () => {
    expect(table).toMatch(/<AsyncState[\s\S]*empty-hint=/);
    expect(table).not.toContain('산정결과 불러오는 중</p>');
  });
  it('회원 없음·핸디캡 정보 없음에 이유 한 줄이 있다', () => {
    expect(admin).toMatch(/empty-title="회원 없음"\s+empty-hint=/);
    expect(attend).toContain('직전 달 핸디캡이 등록되면 표시');
  });
});

describe('임시 PIN 창', () => {
  it('바깥 클릭·Esc·X 로 닫히지 않고 버튼으로만 닫힌다', () => {
    expect(admin).toMatch(/v-model:open="tempPinOpen"[^>]*:dismissible="false"/);
    expect(admin).toContain('확인했음 · 닫기');
  });
});

describe('글자 크기', () => {
  it('관리자 회원 창 오류 문구는 text-sm 이다', () => {
    expect(admin).not.toMatch(/text-xs text-destructive/);
  });
  it('핸디 정책 화면용 표는 모바일 14px 이고 인쇄 스타일은 그대로다', () => {
    const screen = policy.slice(0, policy.indexOf('@media print'));
    expect(screen).toMatch(/\.policy-table\.pp-whs \{\s+font-size: 0\.875rem;/);
    expect(policy).toMatch(/@media print/);
  });
});
