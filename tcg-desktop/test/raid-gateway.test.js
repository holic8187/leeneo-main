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
    squad: [{ cardId: 'winter-r', enhancement: 2 }],
    leaseId: 'lease-1',
    deviceId: 'device-1',
    generation: 7,
  });
  assert.equal(dispatched.state.totalContribution, 50);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    bossId: 'deadline-dragon-raid',
    squad: [{ cardId: 'winter-r', enhancement: 2 }],
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
    gateway.dispatch('token', { bossId: 'deadline-dragon-raid', squad: [] }),
    (error) => error instanceof RaidGatewayError
      && error.code === 'RAID_COOLDOWN'
      && error.retryAfterSeconds === 30,
  );
  await assert.rejects(
    gateway.state(''),
    (error) => error instanceof RaidGatewayError && error.code === 'AUTH_REQUIRED',
  );
});

test('raid gateway preserves weekly stages, daily entries, zero rewards, and battle sessions', async () => {
  const calls = [];
  const state = {
    id: 'deadline-dragon-raid', bossId: 'deadline-dragon-raid', bossName: '마감기한 드래곤',
    stage: 3, maxStage: 10, hp: 175000, currentHp: 175000, maxHp: 400000,
    contribution: 370000, totalContribution: 370000,
    entriesToday: 2, remainingEntries: 3, maxDailyEntries: 5,
    canEnter: true, weeklyCompleted: false, cooldownMs: 0,
    weekKey: '2026-09-15', dayKey: '2026-09-16',
    resetsAt: 9000, dailyResetsAt: 8000,
    earnedRewards: {
      coins: 0,
      packs: 0,
      bonuses: [{ id: 'bonus-1', type: 'relic', relicId: 'luxury-bag', quantity: 1, stage: 5 }],
    },
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/start')) return response({
      state,
      battle: {
        sessionId: 'session-1', stage: 3, bossHp: 175000, bossMaxHp: 400000,
        stageConfig: { stage: 3, maxHp: 400000, skills: [] }, squad: [],
      },
      ranking: { period: 'weekly', weekKey: '2026-09-15', resetsAt: 9000, entries: [] },
    });
    return response({ state, result: { damageDealt: 50000 }, ranking: { period: 'weekly', entries: [] } });
  };
  const gateway = createRaidGateway({ apiBase: 'https://cards.example.com', fetchImpl });
  const started = await gateway.start('token', {
    bossId: state.id, squad: [], squadScore: 1, leaseId: 'lease', deviceId: 'device', generation: 1,
  });
  assert.equal(started.state.stage, 3);
  assert.equal(started.state.remainingEntries, 3);
  assert.equal(started.state.cooldownMs, 0);
  assert.deepEqual(started.state.earnedRewards, {
    coins: 0,
    packs: 0,
    bonuses: [{ id: 'bonus-1', type: 'relic', relicId: 'luxury-bag', quantity: 1, stage: 5 }],
  });
  assert.equal(started.battle.sessionId, 'session-1');
  assert.equal(started.ranking.period, 'weekly');
  await gateway.finish('token', {
    sessionId: 'session-1', bossHpRemaining: 125000, damageDealt: 50000,
    turns: 7, battleLog: [], leaseId: 'lease', deviceId: 'device', generation: 1,
  });
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).turns, 7);
});
