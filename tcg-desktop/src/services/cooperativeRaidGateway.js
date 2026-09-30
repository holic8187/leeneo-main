import { withDeadline } from '../core/promiseDeadline.js';
import { normalizePlaySessionPayload } from './playSessionGateway.js';

export class CooperativeRaidError extends Error {
  constructor(message, { code = '', status = 0, payload = null } = {}) {
    super(message);
    this.name = 'CooperativeRaidError';
    this.code = code;
    this.status = status;
    this.payload = payload;
    this.snapshot = payload?.state ? normalizePlaySessionPayload(payload) : null;
  }
}

export function createCooperativeRaidGateway({ apiBase = '', fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const base = String(apiBase).trim().replace(/\/+$/, '');
  async function request(endpoint, token, body) {
    if (!base) throw new CooperativeRaidError('협동 레이드 서버가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    if (!token) throw new CooperativeRaidError('로그인이 필요합니다.', { code: 'AUTH_REQUIRED', status: 401 });
    const controller = new AbortController();
    try {
      return await withDeadline(async () => {
        const response = await fetchImpl(`${base}/api/tcg/raids/cooperative/${endpoint}`, {
          method: endpoint === 'state' ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new CooperativeRaidError(payload.message || payload.msg || payload.error || '협동 레이드 요청에 실패했습니다.', { code: payload.code || '', status: response.status, payload });
        if (!['idle', 'queued', 'ready', 'battle', 'finished'].includes(payload.cooperative?.phase)) {
          throw new CooperativeRaidError('협동 레이드 응답을 확인할 수 없습니다.', { code: 'INVALID_RESPONSE' });
        }
        return { ...payload, ...(payload.snapshot ? { snapshot: normalizePlaySessionPayload(payload.snapshot) } : {}) };
      }, {
        timeoutMs,
        onTimeout: () => controller.abort(),
        timeoutError: () => new CooperativeRaidError('서버 응답이 늦습니다. 연결 상태를 다시 확인합니다.', { code: 'TIMEOUT' }),
      });
    } catch (error) {
      if (error instanceof CooperativeRaidError) throw error;
      throw new CooperativeRaidError('협동 레이드 서버에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' });
    }
  }
  const gateway = Object.fromEntries(['state', 'queue', 'leave', 'accept', 'action', 'claim'].map((name) => [name, (token, body) => request(name, token, body)]));
  // A reward may be saved even when the response is lost. Reuse its immutable
  // room receipt to recover the snapshot; never create a second reward request.
  gateway.claim = async (token, body) => {
    try { return await request('claim', token, body); }
    catch (error) {
      if (!['NETWORK_ERROR', 'TIMEOUT'].includes(error.code)) throw error;
      return request('claim', token, body);
    }
  };
  return gateway;
}

export const cooperativeRaidGateway = createCooperativeRaidGateway({ apiBase: import.meta.env?.VITE_TCG_API_BASE || '' });
