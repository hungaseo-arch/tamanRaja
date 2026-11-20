import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 인간미 보정(-2 ~ +2)의 서버·화면 규칙이 서로 어긋나지 않는지 정적으로 점검한다.
const sql = readFileSync('supabase/migrations/20261120000100_p13_handicap_humanity.sql', 'utf-8');
const vue = readFileSync('src/components/HandicapResultsTable.vue', 'utf-8');
const code = sql.replace(/--.*$/gm, '');

describe('인간미 마이그레이션', () => {
  it('테이블이 -2 ~ 2 정수만 허용한다', () => {
    expect(code).toMatch(/adj\s+smallint\s+not null check \(adj between -2 and 2\)/);
  });
  it('쓰기 정책 없이 SELECT 정책만 둔다 (로그인 회원만)', () => {
    expect(code).toMatch(/create policy handicap_humanity_read[\s\S]*?for select[\s\S]*?app\.current_member_id\(\) is not null/);
    expect(code).not.toMatch(/for (insert|update|delete|all)/i);
    expect(code).not.toMatch(/grant\s+(insert|update|delete)/i);
  });
  it('저장 RPC 는 관리자만, 범위·정수를 서버에서 다시 검증한다', () => {
    const fn = code.slice(code.indexOf('create or replace function public.save_handicap_humanity'));
    expect(fn).toMatch(/security definer/);
    expect(fn.indexOf('app.require_admin()')).toBeGreaterThan(-1);
    expect(fn).toMatch(/v_adj <> trunc\(v_adj\) or v_adj < -2 or v_adj > 2/);
    expect(code).toMatch(/revoke all on function public\.save_handicap_humanity/);
  });
});

describe('인간미 화면', () => {
  it('화면 범위가 서버와 같다', () => {
    expect(vue).toMatch(/HUMANITY_MIN = -2;/);
    expect(vue).toMatch(/HUMANITY_MAX = 2;/);
  });
  it('2027 제안은 저장하지 않고 기준 + 인간미로 계산한다', () => {
    expect(vue).toMatch(/return r\.std_hc \+ \(humanityOf\(r\) \?\? 0\);/);
    expect(sql).not.toMatch(/proposal/i);
  });
  it('수정·저장은 관리자에게만 보인다', () => {
    expect(vue).toMatch(/v-if="isAdmin" class="pp-edit-bar"/);
    // 관리자는 인간미 셀을 직접 눌러 편집 모드로 들어갈 수 있다.
    expect(vue).toMatch(/v-else-if="isAdmin"[\s\S]*?@click="startEdit\(r\.member_id\)"/);
  });
  it('number 입력이 숫자로 들어와도 파싱한다 (v-model 은 type=number 를 숫자로 바꾼다)', () => {
    expect(vue).toMatch(/String\(raw \?\? ''\)\.trim\(\)/);
  });
  it('저장은 RPC 로만 한다 (테이블 직접 쓰기 없음)', () => {
    expect(vue).toMatch(/supabase\.rpc\('save_handicap_humanity'/);
    expect(vue).not.toMatch(/from\('handicap_humanity'\)\s*\.(insert|update|upsert|delete)/);
  });
  it('푸터 colspan 이 열 수와 맞다 (넓은 화면 9, 좁은 화면 4)', () => {
    expect(vue).toMatch(/colspan="9" class="pp-hide-sm"/);
    expect(vue).toMatch(/colspan="4" class="pp-foot-sm"/);
  });
});
