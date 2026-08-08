/**
 * 실패 객체에서 사람이 읽을 문장만 뽑아낸다.
 *
 * supabase-js 가 돌려주는 오류(PostgrestError)는 Error 인스턴스가 아니라 그냥
 * 객체다. String() 을 씌우면 "[object Object]" 가 되어 사용자에게 그대로
 * 나가므로, message 필드를 가진 객체도 Error 와 똑같이 다룬다.
 */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const { message, error_description, error } = err as Record<string, unknown>;
    for (const cand of [message, error_description, error]) {
      if (typeof cand === 'string' && cand) return cand;
    }
    return '';
  }
  return String(err ?? '');
}

/**
 * 사용자에게 보여줄 실패 사유 한 줄.
 *
 * 브라우저가 주는 연결 실패 문구는 "Failed to fetch" 한 줄뿐이라 그대로 띄우면
 * 기다려야 할지 다시 눌러야 할지 알 수가 없다. 연결 문제로 보이면 우리말
 * 안내로 바꾸고, 그 외에는 서버가 준 메시지를 감추지 않고 그대로 전한다.
 */
export function describeError(err: unknown, fallback = '오류가 발생했습니다.'): string {
  const raw = messageOf(err);
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(raw)) {
    return '서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return raw || fallback;
}
