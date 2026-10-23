import { withDeadline } from '../core/promiseDeadline.js';
import { normalizePlaySessionPayload } from './playSessionGateway.js';

export class PvpGatewayError extends Error {
  constructor(message, { code = '', status = 0, payload = {} } = {}) {
    super(message); this.name = 'PvpGatewayError'; this.code = code; this.status = status; this.payload = payload;
    this.snapshot = payload.state ? normalizePlaySessionPayload(payload) : null;
  }
}
export function createPvpGateway({ apiBase = '', fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const base = String(apiBase).trim().replace(/\/+$/, '');
  async function request(operation, token, body) {
    if (!base) throw new PvpGatewayError('대전 서버가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    if (!token) throw new PvpGatewayError('로그인이 필요합니다.', { code: 'AUTH_REQUIRED', status: 401 });
    const controller = new AbortController();
    try {
      return await withDeadline(async () => {
        const response = await fetchImpl(`${base}/api/tcg/pvp/${operation}`, {
          method: ['state', 'rankings'].includes(operation) ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new PvpGatewayError(payload.message || payload.msg || '대전 요청에 실패했습니다.', { code: payload.code, status: response.status, payload });
        if (!['idle', 'queued', 'ready', 'battle', 'finished'].includes(payload.pvp?.phase)) throw new PvpGatewayError('대전 응답을 확인할 수 없습니다.', { code: 'INVALID_RESPONSE' });
        return { ...payload, ...(payload.snapshot ? { snapshot: normalizePlaySessionPayload(payload.snapshot) } : {}) };
      }, { timeoutMs, onTimeout: () => controller.abort(), timeoutError: () => new PvpGatewayError('서버 응답이 늦습니다. 다시 확인해주세요.', { code: 'TIMEOUT' }) });
    } catch (error) {
      if (error instanceof PvpGatewayError) throw error;
      throw new PvpGatewayError('대전 서버에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' });
    }
  }
  const gateway = Object.fromEntries(['state', 'queue', 'leave', 'accept', 'action', 'claim', 'rankings'].map(operation => [operation, (token, body) => request(operation, token, body)]));
  for (const operation of ['action', 'claim']) gateway[operation] = async (token, body) => {
    try { return await request(operation, token, body); }
    catch (error) {
      if (!['TIMEOUT', 'NETWORK_ERROR'].includes(error.code)) throw error;
      return request(operation, token, body);
    }
  };
  return gateway;
}
export const pvpGateway = createPvpGateway({ apiBase: import.meta.env?.VITE_TCG_API_BASE || '' });
