import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_SESSION_KEY,
  createAuthSessionStore,
  hydrateAuthSession,
} from '../src/core/authSession.js';
import {
  ACCOUNT_STORAGE_PREFIX,
  LEGACY_MIGRATION_KEY,
  STORAGE_KEY,
  createGameStore,
  hasStoredGameState,
  storageKeyForUser,
} from '../src/core/gameState.js';
import {
  AuthGatewayError,
  createAuthGateway,
  normalizeAuthAccount,
} from '../src/services/authGateway.js';

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test('auth session persists only the token and normalized public account fields', () => {
  const storage = createMemoryStorage();
  const sessions = createAuthSessionStore(storage);
  const saved = sessions.save({
    token: 'signed-token',
    password: 'must-not-persist',
    account: {
      _id: 'account-1',
      username: 'employee01',
      nickname: '카드대리',
      passwordHash: 'must-not-persist',
    },
  });

  assert.deepEqual(saved, {
    token: 'signed-token',
    account: { id: 'account-1', username: 'employee01', nickname: '카드대리' },
  });
  assert.deepEqual(JSON.parse(storage.snapshot()[AUTH_SESSION_KEY]), saved);
  assert.equal(storage.snapshot()[AUTH_SESSION_KEY].includes('password'), false);

  sessions.clear();
  assert.equal(sessions.get(), null);
  assert.equal(storage.getItem(AUTH_SESSION_KEY), null);
});

test('damaged or incomplete saved sessions are ignored', () => {
  assert.equal(hydrateAuthSession(null), null);
  assert.equal(hydrateAuthSession({ token: 'x', account: { username: 'missing-id' } }), null);
  const storage = createMemoryStorage({ [AUTH_SESSION_KEY]: '{broken-json' });
  assert.equal(createAuthSessionStore(storage).get(), null);
});

test('auth gateway sends registration, login, availability, and bearer requests to the configured API', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/check-availability')) {
      return jsonResponse({ field: 'nickname', value: '카드대리', valid: true, available: true, message: '' });
    }
    if (url.endsWith('/register')) {
      return jsonResponse({ token: 'register-token', account: { id: 'a1', username: 'employee01', nickname: '카드대리' } }, 201);
    }
    if (url.endsWith('/login')) {
      return jsonResponse({ token: 'login-token', account: { id: 'a1', username: 'employee01', nickname: '카드대리' } });
    }
    return jsonResponse({
      token: 'refreshed-token',
      account: { id: 'a1', username: 'employee01', nickname: '카드대리' },
    });
  };
  const gateway = createAuthGateway({ apiBase: 'https://cards.example.com/', fetchImpl });

  assert.deepEqual(await gateway.checkAvailability('nickname', '카드대리'), {
    available: true,
    message: '사용할 수 있습니다.',
  });
  const registered = await gateway.register({
    username: 'employee01', nickname: '카드대리', password: 'secret12', passwordConfirm: 'secret12',
  });
  assert.equal(registered.token, 'register-token');
  assert.equal(registered.account.nickname, '카드대리');
  assert.equal((await gateway.login({ username: 'employee01', password: 'secret12' })).token, 'login-token');
  const restored = await gateway.me('login-token');
  assert.equal(restored.username, 'employee01');
  assert.equal(restored.account.nickname, '카드대리');
  assert.equal(restored.token, 'refreshed-token');

  assert.equal(calls[0].url, 'https://cards.example.com/api/tcg/auth/check-availability');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    field: 'nickname', value: '카드대리', nickname: '카드대리',
  });
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer login-token');
});

test('auth gateway exposes server conflicts and rejects malformed successful responses', async () => {
  const conflictGateway = createAuthGateway({
    apiBase: 'https://cards.example.com',
    fetchImpl: async () => jsonResponse({ code: 'DUPLICATE_NICKNAME', msg: '이미 사용 중인 닉네임입니다.' }, 409),
  });
  await assert.rejects(
    conflictGateway.register({}),
    (error) => error instanceof AuthGatewayError
      && error.status === 409
      && error.code === 'DUPLICATE_NICKNAME'
      && /닉네임/.test(error.message),
  );

  const malformedGateway = createAuthGateway({
    apiBase: 'https://cards.example.com',
    fetchImpl: async () => jsonResponse({ token: 'missing-account' }, 201),
  });
  await assert.rejects(
    malformedGateway.register({}),
    (error) => error instanceof AuthGatewayError && error.code === 'INVALID_RESPONSE',
  );
});

test('auth gateway refuses requests when the public server URL is absent', async () => {
  const gateway = createAuthGateway();
  assert.equal(gateway.isConfigured(), false);
  await assert.rejects(
    gateway.login({ username: 'employee01', password: 'secret12' }),
    (error) => error instanceof AuthGatewayError && error.code === 'UNCONFIGURED',
  );
  assert.deepEqual(normalizeAuthAccount({ user: { _id: 'x', username: 'user', displayName: '닉네임' } }), {
    id: 'x', username: 'user', nickname: '닉네임',
  });
});

test('game progress is isolated by account and legacy progress migrates only once', () => {
  const legacyState = JSON.stringify({ wallet: { coins: 1234 }, packs: { standard: 9 } });
  const storage = createMemoryStorage({ [STORAGE_KEY]: legacyState });

  const first = createGameStore(storage, { userId: 'account/A' });
  assert.equal(first.storageKey, `${ACCOUNT_STORAGE_PREFIX}account%2FA`);
  assert.equal(first.getState().wallet.coins, 1234);
  first.update((draft) => { draft.wallet.coins = 2222; });

  const second = createGameStore(storage, { userId: 'account-B' });
  assert.equal(second.getState().wallet.coins, 7200);
  second.update((draft) => { draft.wallet.coins = 3333; });

  assert.equal(createGameStore(storage, { userId: 'account/A' }).getState().wallet.coins, 2222);
  assert.equal(createGameStore(storage, { userId: 'account-B' }).getState().wallet.coins, 3333);
  assert.equal(storage.getItem(LEGACY_MIGRATION_KEY), 'account/A');
  assert.equal(storageKeyForUser('account/A'), `${ACCOUNT_STORAGE_PREFIX}account%2FA`);
});

test('cloud bootstrap detection includes valid legacy progress before account migration', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({ wallet: { coins: 4567 } }),
  });
  assert.equal(hasStoredGameState(storage, 'legacy-owner'), true);
  createGameStore(storage, { userId: 'legacy-owner' });
  assert.equal(hasStoredGameState(storage, 'legacy-owner'), true);
  assert.equal(hasStoredGameState(storage, 'another-account'), false);
  assert.equal(hasStoredGameState(createMemoryStorage({ [STORAGE_KEY]: '{broken' }), 'broken-owner'), false);
});
