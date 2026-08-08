import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// GitHub Pages 하위 경로. manifest 의 start_url·scope 와 반드시 같아야 한다 —
// 다르면 안드로이드가 "설치" 를 제안하지 않고 iOS 홈 화면 아이콘도 밖으로 나간다.
const BASE = '/tamanRaja/';

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // 'prompt' — 새 버전을 발견하면 사용자에게 물어본다. 'autoUpdate' 는 말없이
      // 새로고침하는데, 이 앱은 점수를 표에 입력하는 중일 수 있어서 안 된다.
      registerType: 'prompt',
      injectRegister: null, // 등록은 src/lib/pwa.ts 에서 직접 한다
      manifest: {
        name: '따만라자 모임',
        short_name: '따만라자',
        description: '따만라자 골프모임 대시보드 — 월간 기록, 연간 랭킹, 핸디캡 관리',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1f8a3b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // maskable 은 안드로이드가 원·사각형 등 임의 모양으로 잘라낸다.
          // 별도 파일로 두어야 한다 — 같은 그림을 쓰면 가장자리가 잘린다.
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 공유 카드용 이미지는 크롤러만 가져간다. 220KB 를 사용자 기기에
        // 미리 받아 둘 이유가 없다.
        globIgnores: ['**/og-image.png'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          // 구글 폰트는 index.css 가 @import 로 가져온다. 매번 네트워크를 타면
          // 오프라인에서 한글이 시스템 폰트로 튄다.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // supabase 응답에는 어떤 캐시 규칙도 두지 않는다. 규칙이 없으면 서비스
        // 워커가 손대지 않고 그대로 네트워크로 나간다 — 점수·참석 같은 기록이
        // 오래된 사본으로 보이는 일이 절대 없어야 한다.
      },
      devOptions: {
        // dev 서버에서는 서비스 워커를 끈다. 켜면 HMR 이 캐시에 막힌다.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: false, // HMR 오버레이 비활성화 (선택)
    },
  },
});
