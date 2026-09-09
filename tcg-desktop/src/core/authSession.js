import { normalizeAuthAccount } from '../services/authGateway.js';

export const AUTH_SESSION_KEY = 'hoi-card-desk-auth-v1';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function hydrateAuthSession(value) {
  if (!value || typeof value !== 'object') return null;
  const token = String(value.token || value.accessToken || '').trim();
  const account = normalizeAuthAccount(value.account || value.user);
  if (!token || !account) return null;
  return { token, account };
}

export function createAuthSessionStore(storage = globalThis.localStorage) {
  let session = null;
  try {
    const saved = storage?.getItem?.(AUTH_SESSION_KEY);
    session = hydrateAuthSession(saved ? JSON.parse(saved) : null);
  } catch {
    session = null;
  }

  return {
    get() {
      return session ? clone(session) : null;
    },
    save(value) {
      const next = hydrateAuthSession(value);
      if (!next) throw new Error('저장할 로그인 정보가 올바르지 않습니다.');
      storage?.setItem?.(AUTH_SESSION_KEY, JSON.stringify(next));
      session = next;
      return clone(session);
    },
    clear() {
      storage?.removeItem?.(AUTH_SESSION_KEY);
      session = null;
    },
  };
}
