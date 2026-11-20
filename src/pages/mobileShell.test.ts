import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 모바일(375px) 가독성 규칙을 소스 문자열로 지킨다. 실제 렌더 폭은 실기기에서 확인한다.
const read = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const layout = read('components/Layout.vue');
const ranking = read('pages/YearlyRanking.vue');
const profile = read('pages/MyProfile.vue');
const logs = read('pages/AdminLogs.vue');

describe('모바일 14px 기준', () => {
  it('표 글자가 모바일에서 12px 로 내려가지 않는다', () => {
    for (const src of [ranking, profile, logs]) {
      expect(src).not.toContain('text-xs sm:text-sm');
    }
  });

  it('하단 탭 라벨은 text-sm 이다', () => {
    const tabBar = layout.slice(layout.indexOf('<!-- 하단 탭 바 (sm 미만)'));
    expect(tabBar).toContain('text-center text-sm');
    expect(tabBar).not.toContain('text-center text-xs');
  });

  it('탭 전용 라벨은 14px 한 줄(칸당 약 71px, 한글 5~6자) 안에 든다', () => {
    const labels = [...layout.matchAll(/tabLabel: '([^']+)'/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l.length).toBeLessThanOrEqual(6);
  });
});

describe('헤더 로그인·계정 버튼', () => {
  it('좁은 폭에서 글자를 숨기지 않는다', () => {
    expect(layout).not.toContain('hidden sm:inline">로그인');
    expect(layout).not.toContain('hidden sm:inline font-medium');
    expect(layout).toContain('truncate');
  });
});

describe('연간 랭킹', () => {
  it('상위 카드에 text-shadow 장식이 없다', () => {
    expect(ranking).not.toContain('text-shadow');
  });

  it('현재 기준 안내가 표보다 앞에 있다', () => {
    expect(ranking.indexOf('현재 기준')).toBeGreaterThan(-1);
    expect(ranking.indexOf('현재 기준')).toBeLessThan(ranking.indexOf('<Table\n'));
  });

  it('정렬 버튼 4개는 모바일에서 44px', () => {
    expect(ranking.split('min-h-11 sm:min-h-0').length - 1).toBe(4);
  });
});

describe('나의 기록', () => {
  it('저장값 불일치 배지는 관리자에게만 보인다', () => {
    expect(profile).toContain('v-if="isAdmin && detailRow.next_hc_mismatch"');
  });
});
