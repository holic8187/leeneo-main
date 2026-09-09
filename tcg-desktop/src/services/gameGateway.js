const API_BASE = String(import.meta.env.VITE_HOI_API_BASE || '').replace(/\/$/, '');

export function isLinkGatewayConfigured() {
  return Boolean(API_BASE);
}

export async function claimHoiLink(linkCode) {
  if (!API_BASE) {
    throw new Error('연동 서버가 아직 설정되지 않았습니다.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE}/api/tcg/link/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkCode }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || '연동 코드를 확인할 수 없습니다.');
    }
    if (!payload.nickname) {
      throw new Error('연동 응답에 캐릭터 정보가 없습니다.');
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('연동 서버 응답이 늦어 연결을 중단했습니다.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
