import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PlaySessionGatewayError,
  createPlaySessionGateway,
  normalizePlaySessionPayload,
} from '../src/services/playSessionGateway.js';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

test('play session gateway uses the lease API contract and keeps cloud state metadata', async () => {
  const calls = [];
  const gateway = createPlaySessionGateway({
    apiBase: 'https://cards.example.com/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        leaseId: 'lease-1',
        generation: 4,
        expiresAt: '2026-09-11T03:00:00.000Z',
        serverNow: 1000,
        revision: 7,
        initialized: true,
        state: { wallet: { coins: 9000 } },
      });
    },
  });

  const opened = await gateway.open('token-1', {
    deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0', allowBootstrap: false,
  });
  assert.equal(opened.leaseId, 'lease-1');
  assert.equal(opened.generation, 4);
  assert.equal(opened.revision, 7);
  assert.equal(opened.initialized, true);
  assert.deepEqual(opened.state, { wallet: { coins: 9000 } });
  assert.equal(calls[0].url, 'https://cards.example.com/api/tcg/play-session/open');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');

  await gateway.saveState('token-1', {
    leaseId: 'lease-1', deviceId: 'device-123456789', generation: 4, baseRevision: 7, state: opened.state,
  });
  assert.equal(calls[1].url, 'https://cards.example.com/api/tcg/game-state');
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(JSON.parse(calls[1].options.body).baseRevision, 7);
});

test('play session errors preserve every server conflict detail', async () => {
  const gateway = createPlaySessionGateway({
    apiBase: 'https://cards.example.com',
    fetchImpl: async () => jsonResponse({
      code: 'PLAYING_ELSEWHERE',
      msg: '다른 기기에서 플레이 중입니다.',
      activePlatform: 'android',
      generation: 11,
      expiresAt: 123456,
      customReason: 'new-login',
    }, 409),
  });

  await assert.rejects(
    gateway.heartbeat('token', {}),
    (error) => error instanceof PlaySessionGatewayError
      && error.status === 409
      && error.code === 'PLAYING_ELSEWHERE'
      && error.activePlatform === 'android'
      && error.generation === 11
      && error.expiresAt === 123456
      && error.customReason === 'new-login'
      && error.details.customReason === 'new-login',
  );
});

test('nested lease and game-state responses are normalized', () => {
  const normalized = normalizePlaySessionPayload({
    lease: { id: 'nested-lease', generation: 2, expiresAt: 5000, platform: 'pc' },
    gameState: { revision: 9, initialized: true, payload: { packs: { standard: 4 } } },
    now: 4000,
  });
  assert.equal(normalized.leaseId, 'nested-lease');
  assert.equal(normalized.generation, 2);
  assert.equal(normalized.activePlatform, 'pc');
  assert.equal(normalized.revision, 9);
  assert.deepEqual(normalized.state, { packs: { standard: 4 } });
});

test('play session timeout completes even when the platform fetch ignores abort', async () => {
  const gateway = createPlaySessionGateway({
    apiBase: 'https://cards.example.com',
    fetchImpl: () => new Promise(() => {}),
    timeoutMs: 5,
  });

  await assert.rejects(
    gateway.open('token', { deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.1' }),
    (error) => error instanceof PlaySessionGatewayError
      && error.code === 'TIMEOUT'
      && /응답이 늦어/.test(error.message),
  );
});
