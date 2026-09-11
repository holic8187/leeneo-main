import assert from 'node:assert/strict';
import test from 'node:test';
import { RaidGatewayError, createRaidGateway } from '../src/services/raidGateway.js';

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

test('raid gateway sends bearer-authenticated state, ranking, and dispatch requests', async () => {
  const calls = [];
  const payload = {
    state: { id: 'deadline-dragon-raid', hp: 100, maxHp: 200, totalContribution: 50, cooldownMs: 60000 },
    ranking: { dayKey: '2026-09-10', resetsAt: 123, entries: [{ nickname: '호이', contribution: 50 }] },
  };
  const gateway = createRaidGateway({
    apiBase: 'https://cards.example.com/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/ranking')) return response(payload.ranking);
      return response(payload);
    },
  });

  assert.equal((await gateway.state('token')).state.hp, 100);
  assert.equal((await gateway.ranking('token')).entries[0].nickname, '호이');
  const dispatched = await gateway.dispatch('token', {
    bossId: 'deadline-dragon-raid',
    squadScore: 12000,
    leaseId: 'lease-1',
    deviceId: 'device-1',
    generation: 7,
  });
  assert.equal(dispatched.state.totalContribution, 50);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    bossId: 'deadline-dragon-raid',
    squadScore: 12000,
    leaseId: 'lease-1',
    deviceId: 'device-1',
    generation: 7,
  });
});

test('raid gateway exposes server limits and rejects missing authentication', async () => {
  const gateway = createRaidGateway({
    apiBase: 'https://cards.example.com',
    fetchImpl: async () => response({ code: 'RAID_COOLDOWN', msg: '재정비 중입니다.', retryAfterSeconds: 30 }, 429),
  });
  await assert.rejects(
    gateway.dispatch('token', { bossId: 'deadline-dragon-raid', squadScore: 1 }),
    (error) => error instanceof RaidGatewayError
      && error.code === 'RAID_COOLDOWN'
      && error.retryAfterSeconds === 30,
  );
  await assert.rejects(
    gateway.state(''),
    (error) => error instanceof RaidGatewayError && error.code === 'AUTH_REQUIRED',
  );
});
