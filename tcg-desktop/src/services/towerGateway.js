import { withDeadline } from '../core/promiseDeadline.js';
import { normalizePlaySessionPayload } from './playSessionGateway.js';

export class TowerGatewayError extends Error {
  constructor(message, { code = '', status = 0, payload = null } = {}) {
    super(message); this.name = 'TowerGatewayError'; this.code = code; this.status = status; this.payload = payload;
    this.snapshot = payload?.state ? normalizePlaySessionPayload(payload) : null;
  }
}

export function createTowerGateway({ apiBase = '', fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const base = String(apiBase).trim().replace(/\/+$/, '');
  async function request(operation, token, body) {
    if (!base) throw new TowerGatewayError('무한의 탑 서버가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    if (!token) throw new TowerGatewayError('로그인이 필요합니다.', { code: 'AUTH_REQUIRED', status: 401 });
    const read = ['state', 'ranking'].includes(operation), controller = new AbortController();
    try {
      return await withDeadline(async () => {
        const response = await fetchImpl(`${base}/api/tcg/tower/${operation}`, { method: read ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, signal: controller.signal,
          ...(!read ? { body: JSON.stringify(body || {}) } : {}),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new TowerGatewayError(payload.msg || payload.message || '무한의 탑 요청에 실패했습니다.', { code: payload.code, status: response.status, payload });
        if (operation === 'ranking' ? !Array.isArray(payload.ranking?.entries) : !Number.isSafeInteger(payload.tower?.revision) || !payload.tower?.seasonKey) throw new TowerGatewayError('탑 응답을 확인할 수 없습니다.', { code: 'INVALID_RESPONSE' });
        return payload;
      }, { timeoutMs, onTimeout: () => controller.abort(), timeoutError: () => new TowerGatewayError('탑 서버 응답이 늦습니다. 다시 연결해 주세요.', { code: 'TIMEOUT' }) });
    } catch (error) {
      if (error instanceof TowerGatewayError) throw error;
      throw new TowerGatewayError('탑 서버에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' });
    }
  }
  return Object.fromEntries(['state', 'ranking', 'choose', 'reroll', 'enter', 'action', 'abandon'].map(operation => [operation, (token, body) => request(operation, token, body)]));
}
export const towerGateway = createTowerGateway({ apiBase: import.meta.env?.VITE_TCG_API_BASE || '' });
