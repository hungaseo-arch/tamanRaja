// 브라우저 탭·기록·홈 화면 전환기에 보이는 문서 제목 (4-5).
// "화면명 · 사이트명" 순서 — 탭이 좁아 잘려도 어느 화면인지가 먼저 남는다.
export const SITE_NAME = '따만라자 모임';

export function setPageTitle(name?: string): void {
  document.title = name ? `${name} · ${SITE_NAME}` : SITE_NAME;
}
