const DEFAULT_TIMEOUT_MS = 12000;

const RESERVED_ERROR_FIELDS = new Set(['name', 'message', 'stack', 'status', 'code', 'details', 'payload']);

function errorMessage(payload, fallback) {
  return String(payload?.message || payload?.msg || payload?.error || fallback);
}

function timestamp(value) {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export class PlaySessionGatewayError extends Error {
  constructor(message, { status = 0, code = '', payload = {} } = {}) {
    super(message);
    this.name = 'PlaySessionGatewayError';
    this.status = Math.max(0, Number(status) || 0);
    this.code = String(code || payload?.code || '');
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
    this.details = { ...this.payload };
    for (const [key, value] of Object.entries(this.payload)) {
      if (!RESERVED_ERROR_FIELDS.has(key)) this[key] = value;
    }
  }
}

export function normalizePlaySessionPayload(payload) {
  const value = payload && typeof payload === 'object' ? payload : {};
  return {
    ...value,
    leaseId: String(value.leaseId || value.lease?.id || ''),
    generation: Math.max(0, Math.floor(Number(value.generation ?? value.lease?.generation) || 0)),
    expiresAt: timestamp(value.expiresAt ?? value.lease?.expiresAt),
    serverNow: timestamp(value.serverNow ?? value.now),
    revision: Math.max(0, Math.floor(Number(value.revision ?? value.gameState?.revision) || 0)),
    state: value.state ?? value.gameState?.state ?? value.gameState?.payload ?? null,
    initialized: value.initialized === true || value.gameState?.initialized === true,
    activePlatform: String(value.activePlatform || value.lease?.platform || ''),
  };
}

export function createPlaySessionGateway({
  apiBase = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = String(apiBase || '').trim().replace(/\/+$/, '');

  async function request(path, { method = 'POST', token = '', body } = {}) {
    if (!base) {
      throw new PlaySessionGatewayError('클라우드 저장 서버 주소가 설정되지 않았습니다.', {
        code: 'UNCONFIGURED',
      });
    }
    if (!token) {
      throw new PlaySessionGatewayError('로그인이 필요합니다.', { status: 401, code: 'AUTH_REQUIRED' });
    }
    if (typeof fetchImpl !== 'function') {
      throw new PlaySessionGatewayError('클라우드 저장 서버에 연결할 수 없습니다.', {
        code: 'FETCH_UNAVAILABLE',
      });
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new PlaySessionGatewayError(errorMessage(payload, '플레이 세션 요청을 처리하지 못했습니다.'), {
          status: response.status,
          code: payload?.code,
          payload,
        });
      }
      return normalizePlaySessionPayload(payload);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new PlaySessionGatewayError('서버 응답이 늦어 연결을 중단했습니다.', { code: 'TIMEOUT' });
      }
      if (error instanceof PlaySessionGatewayError) throw error;
      throw new PlaySessionGatewayError('클라우드 저장 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.', {
        code: 'NETWORK_ERROR',
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    isConfigured: () => Boolean(base),
    open(token, body) {
      return request('/api/tcg/play-session/open', { token, body });
    },
    takeover(token, body) {
      return request('/api/tcg/play-session/takeover', { token, body });
    },
    heartbeat(token, body) {
      return request('/api/tcg/play-session/heartbeat', { token, body });
    },
    release(token, body) {
      return request('/api/tcg/play-session/release', { token, body });
    },
    saveState(token, body) {
      return request('/api/tcg/game-state', { method: 'PUT', token, body });
    },
  };
}

const configuredBase = String(import.meta.env?.VITE_TCG_API_BASE || '').trim();
const playSessionGateway = createPlaySessionGateway({ apiBase: configuredBase });

export const isPlaySessionGatewayConfigured = playSessionGateway.isConfigured;
export const openPlaySession = playSessionGateway.open;
export const takeoverPlaySession = playSessionGateway.takeover;
export const heartbeatPlaySession = playSessionGateway.heartbeat;
export const releasePlaySession = playSessionGateway.release;
export const saveCloudGameState = playSessionGateway.saveState;
