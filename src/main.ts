import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { setupPWA } from './lib/pwa';
import './index.css';

createApp(App).use(router).mount('#app');

// 화면을 먼저 띄우고 나서 등록한다. 서비스 워커 설치가 첫 렌더를 붙잡지 않도록.
setupPWA();
