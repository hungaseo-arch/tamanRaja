import { registerSW } from 'virtual:pwa-register';
import { useToast } from '@/composables/useToast';

/**
 * 서비스 워커 등록.
 *
 * 새 버전을 자동으로 적용하지 않는 이유: 이 앱은 월간 표에 점수를 여러 명분
 * 입력하는 중일 수 있다. 말없이 새로고침하면 그 입력이 통째로 사라진다.
 * 그래서 발견 사실만 알리고 새로고침 시점은 사용자가 고르게 한다.
 *
 * 다만 미룬 채로 화면을 계속 쓰면 예전 번들이 남아, 배포로 사라진 코드 조각을
 * 뒤늦게 불러오다 실패할 수 있다. 안내 토스트는 스스로 사라지지 않게 두어
 * (duration 0) 새로고침할 때까지 눈에 남긴다.
 */
export function setupPWA(): void {
  if (import.meta.env.DEV) return;

  const { toast } = useToast();

  const updateSW = registerSW({
    onNeedRefresh() {
      toast({
        title: '새 버전이 있습니다',
        description: '새로고침하면 최신 화면으로 바뀝니다.',
        duration: 0,
        action: { label: '새로고침', onClick: () => updateSW(true) },
      });
    },
    onOfflineReady() {
      toast({ title: '오프라인에서도 열립니다', description: '기록 조회는 연결이 필요합니다.' });
    },
  });
}
