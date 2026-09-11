'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const TcgPlayerStateModel = require('../../src/tcg/models/TcgPlayerState');
const {
  DEFAULT_TOKEN_EXPIRES_IN,
  TCG_TOKEN_AUDIENCE,
  TCG_TOKEN_ISSUER,
  registerTcgRoutes,
  signAccountToken
} = require('../../src/tcg/registerTcgRoutes');
const {
  MAX_GAME_STATE_BYTES,
  PLAYER_LEASE_DURATION_MS,
  normalizeGameState
} = require('../../src/tcg/services/playerStateService');

const JWT_SECRET = 'tcg-cloud-save-test-secret-with-enough-entropy';

const clone = (value) => JSON.parse(JSON.stringify(value));

function pathValue(value, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], value);
}

function setPath(value, path, nextValue) {
  const parts = String(path).split('.');
  let target = value;
  for (const part of parts.slice(0, -1)) {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part];
  }
  target[parts.at(-1)] = clone(nextValue);
}

function matches(record, query) {
  return Object.entries(query || {}).every(([path, expected]) => {
    const actual = pathValue(record, path);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.prototype.hasOwnProperty.call(expected, '$gt')) {
        return new Date(actual).getTime() > new Date(expected.$gt).getTime();
      }
    }
    return String(actual) === String(expected);
  });
}

function applyUpdate(record, update) {
  for (const [path, value] of Object.entries(update.$set || {})) setPath(record, path, value);
  for (const [path, amount] of Object.entries(update.$inc || {})) {
    setPath(record, path, Number(pathValue(record, path) || 0) + Number(amount));
  }
  return record;
}

function createFakePlayerStateModel() {
  const records = [];
  let nextId = 1;

  return class FakePlayerState {
    static records = records;

    static async updateOne(query, update, options = {}) {
      let record = records.find((candidate) => matches(candidate, query));
      if (!record && options.upsert) {
        record = {
          _id: `player-state-${nextId++}`,
          ...(update.$setOnInsert ? clone(update.$setOnInsert) : {})
        };
        records.push(record);
        return { acknowledged: true, upsertedCount: 1 };
      }
      if (record) applyUpdate(record, update);
      return { acknowledged: true, matchedCount: record ? 1 : 0 };
    }

    static async findOne(query) {
      const record = records.find((candidate) => matches(candidate, query));
      return record ? clone(record) : null;
    }

    static async findOneAndUpdate(query, update) {
      const record = records.find((candidate) => matches(candidate, query));
      if (!record) return null;
      applyUpdate(record, update);
      return clone(record);
    }
  };
}

function createHarness({ tokenExpiresIn = null } = {}) {
  const routes = new Map();
  const account = {
    _id: 'account-cloud-1',
    username: 'clouduser',
    nickname: '구름사원',
    status: 'active',
    tokenVersion: 3,
    createdAt: new Date('2026-09-11T00:00:00.000Z')
  };
  const TcgAccount = {
    async findById(id) {
      return String(id) === account._id ? account : null;
    }
  };
  const TcgPlayerState = createFakePlayerStateModel();
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    put(path, handler) { routes.set(`PUT ${path}`, handler); }
  };
  let nowMs = Date.parse('2026-09-11T01:00:00.000Z');
  registerTcgRoutes({
    app,
    bcrypt: { hash: async () => '', compare: async () => false },
    jwt,
    jwtSecret: JWT_SECRET,
    tokenExpiresIn,
    TcgAccount,
    TcgPersonalRaidDaily: {},
    TcgPlayerState,
    now: () => nowMs
  });
  const token = signAccountToken(account, jwt, JWT_SECRET, null);

  return {
    account,
    routes,
    token,
    TcgPlayerState,
    setNow(value) { nowMs = Number(value); },
    get now() { return nowMs; },
    async request(method, path, { body = {}, bearer = token } = {}) {
      const handler = routes.get(`${method} ${path}`);
      assert.ok(handler, `missing route: ${method} ${path}`);
      const response = {
        statusCode: 200,
        payload: undefined,
        status(code) { this.statusCode = code; return this; },
        set() { return this; },
        json(payload) { this.payload = payload; return this; }
      };
      await handler({
        body,
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
        ip: '127.0.0.1'
      }, response);
      return response;
    }
  };
}

function leaseBody(response, deviceId) {
  return {
    leaseId: response.payload.leaseId,
    deviceId,
    generation: response.payload.generation
  };
}

test('TCG player state model keeps one versioned save and active lease per account', () => {
  assert.equal(TcgPlayerStateModel.schema.options.collection, 'tcg_player_states');
  assert.equal(TcgPlayerStateModel.schema.path('state').instance, 'Mixed');
  assert.equal(TcgPlayerStateModel.schema.path('revision').options.default, 0);
  assert.equal(TcgPlayerStateModel.schema.path('initialized').options.default, false);
  const accountIndex = TcgPlayerStateModel.schema.indexes().find(([fields]) => fields.accountId === 1);
  assert.ok(accountIndex);
  assert.equal(accountIndex[1].unique, true);
  assert.deepEqual(
    TcgPlayerStateModel.schema.path('activeLease.platform').options.enum,
    ['pc', 'android', 'ios', 'web', null]
  );
});

test('game state validator accepts plain JSON and rejects arrays, pollution keys, and oversized saves', () => {
  const state = { wallet: { coins: 10 }, cards: ['one', 'two'], enabled: true };
  assert.deepEqual(normalizeGameState(state), state);
  assert.throws(() => normalizeGameState([]), (error) => error.code === 'INVALID_GAME_STATE');
  const polluted = JSON.parse('{"nested":{"__proto__":{"admin":true}}}');
  assert.throws(() => normalizeGameState(polluted), (error) => error.code === 'INVALID_GAME_STATE');
  assert.throws(
    () => normalizeGameState({ value: '가'.repeat(MAX_GAME_STATE_BYTES) }),
    (error) => error.code === 'GAME_STATE_TOO_LARGE' && error.status === 413
  );
});

test('default TCG tokens do not expire and me rotates an older valid token', async () => {
  assert.equal(DEFAULT_TOKEN_EXPIRES_IN, null);
  const harness = createHarness();
  const emptyExpiryToken = signAccountToken(harness.account, jwt, JWT_SECRET, '');
  assert.equal(Object.prototype.hasOwnProperty.call(jwt.decode(emptyExpiryToken), 'exp'), false);
  const persistentPayload = jwt.verify(harness.token, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE
  });
  assert.equal(Object.prototype.hasOwnProperty.call(persistentPayload, 'exp'), false);

  const oldToken = jwt.sign({
    sub: harness.account._id,
    kind: 'tcg',
    tokenVersion: harness.account.tokenVersion
  }, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE,
    expiresIn: '7d'
  });
  const response = await harness.request('GET', '/api/tcg/auth/me', { bearer: oldToken });
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.account.nickname, '구름사원');
  const rotated = jwt.verify(response.payload.token, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE
  });
  assert.equal(Object.prototype.hasOwnProperty.call(rotated, 'exp'), false);
  assert.equal(rotated.tokenVersion, 3);
});

test('simultaneous bootstrap and takeover requests have one atomic winner', async () => {
  const harness = createHarness();
  const bootstrapRequest = (deviceId, platform, coins) => harness.request(
    'POST',
    '/api/tcg/play-session/open',
    {
      body: {
        deviceId,
        platform,
        appVersion: '0.5.0',
        allowBootstrap: true,
        bootstrapState: { wallet: { coins } }
      }
    }
  );
  const bootstrapResponses = await Promise.all([
    bootstrapRequest('bootstrap-pc', 'pc', 100),
    bootstrapRequest('bootstrap-mobile', 'android', 200)
  ]);
  const bootstrapWinner = bootstrapResponses.find((response) => response.statusCode === 200);
  const bootstrapLoser = bootstrapResponses.find((response) => response.statusCode === 409);
  assert.ok(bootstrapWinner);
  assert.equal(bootstrapLoser?.payload.code, 'PLAYING_ELSEWHERE');
  assert.ok([100, 200].includes(bootstrapWinner.payload.state.wallet.coins));

  const takeover = (deviceId, platform) => harness.request('POST', '/api/tcg/play-session/takeover', {
    body: {
      deviceId,
      platform,
      appVersion: '0.5.0',
      expectedGeneration: bootstrapWinner.payload.generation
    }
  });
  const takeoverResponses = await Promise.all([
    takeover('takeover-pc', 'pc'),
    takeover('takeover-ios', 'ios')
  ]);
  const takeoverWinner = takeoverResponses.find((response) => response.statusCode === 200);
  const takeoverLoser = takeoverResponses.find((response) => response.statusCode === 409);
  assert.equal(takeoverWinner?.payload.generation, 2);
  assert.equal(takeoverLoser?.payload.code, 'PLAY_SESSION_CHANGED');
  assert.deepEqual(takeoverWinner.payload.state, bootstrapWinner.payload.state);
});

test('open requires migration, bootstraps once, blocks another device, and takeover invalidates the old lease', async () => {
  const harness = createHarness();
  const migration = await harness.request('POST', '/api/tcg/play-session/open', {
    body: { deviceId: 'desktop-device', platform: 'pc', appVersion: '0.5.0' }
  });
  assert.equal(migration.statusCode, 428);
  assert.equal(migration.payload.code, 'CLOUD_SAVE_MIGRATION_REQUIRED');

  const desktop = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'desktop-device',
      platform: 'pc',
      appVersion: '0.5.0',
      allowBootstrap: true,
      bootstrapState: { wallet: { coins: 7200 }, expedition: null }
    }
  });
  assert.equal(desktop.statusCode, 200);
  assert.match(desktop.payload.leaseId, /^[0-9a-f-]{36}$/);
  assert.equal(desktop.payload.generation, 1);
  assert.equal(desktop.payload.revision, 1);
  assert.equal(desktop.payload.initialized, true);
  assert.equal(desktop.payload.expiresAt, harness.now + PLAYER_LEASE_DURATION_MS);

  const blocked = await harness.request('POST', '/api/tcg/play-session/open', {
    body: { deviceId: 'android-device', platform: 'android', appVersion: '0.5.0' }
  });
  assert.equal(blocked.statusCode, 409);
  assert.deepEqual(
    { code: blocked.payload.code, activePlatform: blocked.payload.activePlatform, generation: blocked.payload.generation },
    { code: 'PLAYING_ELSEWHERE', activePlatform: 'pc', generation: 1 }
  );

  const changed = await harness.request('POST', '/api/tcg/play-session/takeover', {
    body: { deviceId: 'android-device', platform: 'android', appVersion: '0.5.0', expectedGeneration: 0 }
  });
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.payload.code, 'PLAY_SESSION_CHANGED');

  const mobile = await harness.request('POST', '/api/tcg/play-session/takeover', {
    body: { deviceId: 'android-device', platform: 'android', appVersion: '0.5.0', expectedGeneration: 1 }
  });
  assert.equal(mobile.statusCode, 200);
  assert.equal(mobile.payload.generation, 2);
  assert.equal(mobile.payload.platform, 'android');
  assert.deepEqual(mobile.payload.state, desktop.payload.state);

  const oldHeartbeat = await harness.request('POST', '/api/tcg/play-session/heartbeat', {
    body: leaseBody(desktop, 'desktop-device')
  });
  assert.equal(oldHeartbeat.statusCode, 409);
  assert.equal(oldHeartbeat.payload.code, 'PLAY_SESSION_LOST');
  assert.equal(oldHeartbeat.payload.activePlatform, 'android');

  const oldSave = await harness.request('PUT', '/api/tcg/game-state', {
    body: {
      ...leaseBody(desktop, 'desktop-device'),
      baseRevision: desktop.payload.revision,
      state: { wallet: { coins: 999999 } }
    }
  });
  assert.equal(oldSave.statusCode, 409);
  assert.equal(oldSave.payload.code, 'PLAY_SESSION_LOST');
});

test('active lease heartbeats, saves by revision, reports conflicts, and releases without losing state', async () => {
  const harness = createHarness();
  const opened = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'ios-device', platform: 'ios', appVersion: '0.5.0',
      allowBootstrap: true, bootstrapState: { wallet: { coins: 100 } }
    }
  });
  harness.setNow(harness.now + 10_000);
  const heartbeat = await harness.request('POST', '/api/tcg/play-session/heartbeat', {
    body: leaseBody(opened, 'ios-device')
  });
  assert.equal(heartbeat.statusCode, 200);
  assert.equal(heartbeat.payload.expiresAt, harness.now + PLAYER_LEASE_DURATION_MS);
  assert.deepEqual(heartbeat.payload.state, { wallet: { coins: 100 } });

  const saved = await harness.request('PUT', '/api/tcg/game-state', {
    body: {
      ...leaseBody(opened, 'ios-device'),
      baseRevision: opened.payload.revision,
      state: { wallet: { coins: 125 }, pendingPackOpening: { id: 'pack-1' } }
    }
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.payload.revision, 2);
  assert.equal(saved.payload.state.wallet.coins, 125);

  const conflict = await harness.request('PUT', '/api/tcg/game-state', {
    body: {
      ...leaseBody(opened, 'ios-device'),
      baseRevision: opened.payload.revision,
      state: { wallet: { coins: 1 } }
    }
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.payload.code, 'SAVE_CONFLICT');
  assert.equal(conflict.payload.revision, 2);
  assert.equal(conflict.payload.state.wallet.coins, 125);

  const released = await harness.request('POST', '/api/tcg/play-session/release', {
    body: leaseBody(opened, 'ios-device')
  });
  assert.equal(released.statusCode, 200);
  assert.equal(released.payload.leaseId, '');
  assert.equal(released.payload.generation, 2);
  assert.equal(released.payload.expiresAt, 0);
  assert.equal(released.payload.state.wallet.coins, 125);

  const afterRelease = await harness.request('POST', '/api/tcg/play-session/heartbeat', {
    body: leaseBody(opened, 'ios-device')
  });
  assert.equal(afterRelease.statusCode, 409);
  assert.equal(afterRelease.payload.code, 'PLAY_SESSION_LOST');
});

test('an expired lease can be acquired by another device and bootstrap data never overwrites an initialized save', async () => {
  const harness = createHarness();
  const first = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'web-device', platform: 'web', appVersion: '0.5.0',
      allowBootstrap: true, bootstrapState: { wallet: { coins: 333 }, collection: { 'winter-c': 1 } }
    }
  });
  harness.setNow(first.payload.expiresAt + 1);
  const second = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'pc-device-two', platform: 'pc', appVersion: '0.5.1',
      allowBootstrap: true, bootstrapState: { wallet: { coins: 999999 } }
    }
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.payload.generation, 2);
  assert.equal(second.payload.platform, 'pc');
  assert.deepEqual(second.payload.state, { wallet: { coins: 333 }, collection: { 'winter-c': 1 } });
  assert.equal(second.payload.revision, 1);
});

test('cloud state routes require a current bearer token and validate platform and bootstrap payloads', async () => {
  const harness = createHarness();
  const unauthenticated = await harness.request('POST', '/api/tcg/play-session/open', {
    bearer: '',
    body: { deviceId: 'desktop-device', platform: 'pc', appVersion: '0.5.0' }
  });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.payload.code, 'AUTH_REQUIRED');

  const badPlatform = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'desktop-device', platform: 'console', appVersion: '0.5.0',
      allowBootstrap: true, bootstrapState: {}
    }
  });
  assert.equal(badPlatform.statusCode, 400);
  assert.equal(badPlatform.payload.code, 'INVALID_PLATFORM');

  const badState = await harness.request('POST', '/api/tcg/play-session/open', {
    body: {
      deviceId: 'desktop-device', platform: 'pc', appVersion: '0.5.0',
      allowBootstrap: true, bootstrapState: []
    }
  });
  assert.equal(badState.statusCode, 400);
  assert.equal(badState.payload.code, 'INVALID_GAME_STATE');
});
