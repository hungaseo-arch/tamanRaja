import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 나의 기록의 연도별 핸디 추이가 본인 행만 읽고, 쓰기 없이 화면에만 쓰이는지 정적으로 점검한다.
const trend = readFileSync('src/components/MemberHandicapTrend.vue', 'utf-8');
const profile = readFileSync('src/pages/MyProfile.vue', 'utf-8');

describe('나의 기록 연도별 핸디 추이', () => {
  it('handicap_annual 에서 본인(member_id) 행만 연도순으로 읽는다', () => {
    expect(trend).toMatch(/\.from\('handicap_annual'\)/);
    expect(trend).toMatch(/\.eq\('member_id', id\)/);
    expect(trend).toMatch(/\.order\('year', \{ ascending: true \}\)/);
  });
  it('회원 ID 를 정수로 읽지 못하면 조회하지 않는다', () => {
    expect(trend).toMatch(/Number\.isInteger\(id\)/);
  });
  it('읽기 전용이다 (insert·update·delete·rpc 없음)', () => {
    expect(trend).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });
  it('확정 전 연도는 확정 전 으로 표시하고 개조식 문구를 쓴다', () => {
    expect(trend).toMatch(/status !== 'confirmed'/);
    expect(trend).toContain('확정 전');
    expect(trend).not.toMatch(/입니다|합니다/);
  });
  it('데이터가 없어도 카드를 숨기지 않고 안내를 보인다', () => {
    expect(trend).not.toMatch(/<Card v-if/);
    expect(trend).toMatch(/:empty="view\.length === 0"/);
  });
  it('나의 기록에서 로그인한 본인의 id 로 붙인다', () => {
    expect(profile).toMatch(/<MemberHandicapTrend :member-id="currentMember\.id"/);
  });
});
