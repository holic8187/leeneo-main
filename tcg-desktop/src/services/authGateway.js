const DEFAULT_TIMEOUT_MS = 10000;

export class AuthGatewayError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'AuthGatewayError';
    this.status = Number(status) || 0;
    this.code = String(code || '');
  }
}

export function normalizeAuthAccount(payload) {
  const value = payload?.account || payload?.user || payload;
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || value._id || '').trim();
  const username = String(value.username || '').trim();
  const nickname = String(value.nickname || value.displayName || username).trim();
  if (!id || !username || !nickname) return null;
  return { id, username, nickname };
}

function errorMessage(payload, fallback) {
  return String(payload?.message || payload?.msg || payload?.error || fallback);
}

export function createAuthGateway({
  apiBase = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = String(apiBase || '').trim().replace(/\/+$/, '');

  async function request(path, { method = 'GET', token = '', body } = {}) {
    if (!base) {
      throw new AuthGatewayError('로그인 서버 주소가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    }
    if (typeof fetchImpl !== 'function') {
      throw new AuthGatewayError('로그인 서버에 연결할 수 없습니다.', { code: 'FETCH_UNAVAILABLE' });
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AuthGatewayError(errorMessage(payload, '요청을 처리하지 못했습니다.'), {
          status: response.status,
          code: payload?.code,
        });
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new AuthGatewayError('로그인 서버 응답이 늦어 연결을 중단했습니다.', { code: 'TIMEOUT' });
      }
      if (error instanceof AuthGatewayError) throw error;
      throw new AuthGatewayError('로그인 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.', {
        code: 'NETWORK_ERROR',
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    isConfigured: () => Boolean(base),
    async checkAvailability(field, value) {
      if (!['username', 'nickname'].includes(field)) {
        throw new AuthGatewayError('중복 확인 항목이 올바르지 않습니다.', { code: 'INVALID_FIELD' });
      }
      const normalizedValue = String(value || '').trim();
      const payload = await request('/api/tcg/auth/check-availability', {
        method: 'POST',
        body: { field, value: normalizedValue, [field]: normalizedValue },
      });
      const nested = payload?.availability?.[field] ?? payload?.[field];
      const available = typeof payload?.available === 'boolean'
        ? payload.available
        : typeof nested?.available === 'boolean'
          ? nested.available
          : typeof nested === 'boolean'
            ? nested
            : null;
      if (available === null) {
        throw new AuthGatewayError('중복 확인 응답이 올바르지 않습니다.', { code: 'INVALID_RESPONSE' });
      }
      return {
        available,
        message: String(nested?.message || errorMessage(payload, available ? '사용할 수 있습니다.' : '이미 사용 중입니다.')),
      };
    },
    async register(credentials) {
      const payload = await request('/api/tcg/auth/register', { method: 'POST', body: credentials });
      const token = String(payload?.token || payload?.accessToken || '');
      const account = normalizeAuthAccount(payload);
      if (!token || !account) {
        throw new AuthGatewayError('회원가입 응답에 계정 정보가 없습니다.', { code: 'INVALID_RESPONSE' });
      }
      return { token, account, message: errorMessage(payload, '회원가입이 완료되었습니다.') };
    },
    async login(credentials) {
      const payload = await request('/api/tcg/auth/login', { method: 'POST', body: credentials });
      const token = String(payload?.token || payload?.accessToken || '');
      const account = normalizeAuthAccount(payload);
      if (!token || !account) {
        throw new AuthGatewayError('로그인 응답에 계정 정보가 없습니다.', { code: 'INVALID_RESPONSE' });
      }
      return { token, account };
    },
    async me(token) {
      const payload = await request('/api/tcg/auth/me', { token });
      const account = normalizeAuthAccount(payload);
      if (!account) {
        throw new AuthGatewayError('계정 확인 응답이 올바르지 않습니다.', { code: 'INVALID_RESPONSE' });
      }
      return account;
    },
  };
}

const configuredBase = String(import.meta.env?.VITE_TCG_API_BASE || '').trim();
const authGateway = createAuthGateway({ apiBase: configuredBase });

export const isAuthGatewayConfigured = authGateway.isConfigured;
export const checkAccountAvailability = authGateway.checkAvailability;
export const registerTcgAccount = authGateway.register;
export const loginTcgAccount = authGateway.login;
export const loadCurrentTcgAccount = authGateway.me;
