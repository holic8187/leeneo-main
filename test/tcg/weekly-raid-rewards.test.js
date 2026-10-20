'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RAID_SCHEMA_VERSION } = require('../../src/tcg/services/personalRaidService');
const { weeklyRaidRewardsForRank, weeklyRaidRewardPolicy } = require('../../src/tcg/services/weeklyRaidRewardPolicy');
const { settleWeeklyRaidRewards, startWeeklyRaidRewardScheduler } = require('../../src/tcg/services/weeklyRaidRewardService');
const { applyMailRewards, MAX_STORED_MAILS } = require('../../src/tcg/services/mailboxService');

const NOW = Date.parse('2026-10-26T00:00:00+09:00');
const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const pathValue = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);
function matchValue(actual, expected) {
  if (expected == null) return actual == null;
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    return Object.entries(expected).every(([operator, target]) => {
      const value = target instanceof Date ? new Date(actual).getTime() : actual;
      const compared = target instanceof Date ? target.getTime() : target;
      if (operator === '$gt') return value > compared;
      if (operator === '$gte') return value >= compared;
      if (operator === '$lt') return value < compared;
      if (operator === '$lte') return value <= compared;
      if (operator === '$ne') return Array.isArray(actual) ? !actual.includes(target) : actual !== target;
      throw new Error(`Unexpected operator ${operator}`);
    });
  }
  return String(actual) === String(expected);
}
function matches(record, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matches(record, branch));
    if (key === '$expr') return (record.mailbox || []).length < expected.$lt[1];
    if (key === 'mailbox.id') return (record.mailbox || []).every((entry) => matchValue(entry.id, expected));
    return matchValue(pathValue(record, key), expected);
  });
}
function mutate(record, update) {
  Object.assign(record, copy(update.$set || {}));
  for (const [key, value] of Object.entries(update.$push || {})) (record[key] ||= []).push(copy(value));
  for (const [key, query] of Object.entries(update.$pull || {})) record[key] = (record[key] || []).filter((entry) => !matches(entry, query));
}
function fakeModel(seed = []) {
  const records = copy(seed);
  return class Model {
    static records = records;
    static failMarkerOnce = false;
    static find(query) {
      let result = records.filter((record) => matches(record, query));
      return {
        sort(spec) { result.sort((a, b) => { for (const [key, direction] of Object.entries(spec)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; } return 0; }); return this; },
        limit(count) { result = result.slice(0, count); return this; },
        async lean() { return copy(result); }
      };
    }
    static async findOne(query) { return copy(records.find((record) => matches(record, query))); }
    static async countDocuments(query) { return records.filter((record) => matches(record, query)).length; }
    static async updateMany(query, update) { for (const record of records.filter((entry) => matches(entry, query))) mutate(record, update); }
    static async updateOne(query, update, options = {}) {
      if (this.failMarkerOnce && update.$set?.rankingRewardSettledAt) { this.failMarkerOnce = false; throw new Error('simulated crash after mail append'); }
      let record = records.find((entry) => matches(entry, query));
      if (!record && options.upsert) { record = { _id: `state-${records.length}`, ...copy(update.$setOnInsert || {}) }; records.push(record); return { upsertedCount: 1 }; }
      if (!record) return { modifiedCount: 0 };
      mutate(record, update); return { modifiedCount: 1 };
    }
  };
}
function raid(accountId, score, overrides = {}) {
  return { _id: `raid-${accountId}`, accountId, nickname: accountId, weekKey: '2026-10-19', dayKey: '2026-10-19', bossId: 'deadline-dragon-raid', schemaVersion: RAID_SCHEMA_VERSION, contribution: score, rankingFrozenAt: null, rankingRewardSettledAt: null, ...overrides };
}
function dependencies(records) { return { TcgPersonalRaidDaily: fakeModel(records), TcgPlayerState: fakeModel() }; }

test('weekly reward tiers descend from five SR+ packs and exclude nonparticipants', () => {
  for (let rank = 1; rank <= 10; rank += 1) assert.deepEqual(weeklyRaidRewardsForRank(rank), { srPremiumPacks: 6 - Math.ceil(rank / 2) });
  assert.deepEqual(weeklyRaidRewardsForRank(11), { premiumPacks: 3, coins: 6000 });
  assert.deepEqual(weeklyRaidRewardsForRank(30), { premiumPacks: 3, coins: 6000 });
  assert.deepEqual(weeklyRaidRewardsForRank(31), { premiumPacks: 2, coins: 3000 });
  assert.deepEqual(weeklyRaidRewardsForRank(100), { premiumPacks: 2, coins: 3000 });
  assert.deepEqual(weeklyRaidRewardsForRank(101), { standardPacks: 2, coins: 1000 });
  for (const rank of [0, -1, null, undefined, 1.5]) assert.equal(weeklyRaidRewardsForRank(rank), null);
  assert.equal(weeklyRaidRewardPolicy().firstSettlementAt, NOW);
});

test('client reward preview and server payouts share the same reward policy', async () => {
  const client = await import('../../tcg-desktop/src/core/weeklyRankingRewards.js');
  assert.deepEqual(client.WEEKLY_REWARD_TIERS, weeklyRaidRewardPolicy().bands);
  assert.equal(client.WEEKLY_REWARD_FIRST_SETTLEMENT_AT, NOW);
  for (const rank of [1, 2, 3, 5, 7, 9, 10, 11, 30, 31, 100, 101, 10000]) assert.deepEqual(client.rewardForRank(rank), weeklyRaidRewardsForRank(rank));
});

test('the Monday boundary closes last week and never pays unfinished, legacy, or zero-score records', async () => {
  const deps = dependencies([
    raid('winner', 1000), raid('zero', 0), raid('current', 9000, { weekKey: '2026-10-26' }),
    raid('historic', 10000, { weekKey: '2026-10-12' }), raid('legacy', 10000, { schemaVersion: 1 })
  ]);
  assert.equal((await settleWeeklyRaidRewards({ ...deps, now: NOW - 1 })).deliveredCount, 0);
  assert.equal((await settleWeeklyRaidRewards({ ...deps, now: NOW })).deliveredCount, 1);
  assert.equal(deps.TcgPlayerState.records[0].accountId, 'winner');
  const mail = deps.TcgPlayerState.records[0].mailbox[0];
  assert.equal(mail.rewards.srPremiumPacks, 5);
  assert.equal(applyMailRewards({ wallet: {}, packs: {} }, [mail]).state.packs.srPremium, 5);
  assert.ok(deps.TcgPersonalRaidDaily.records.find((entry) => entry.accountId === 'zero').rankingFrozenAt);
  assert.equal(deps.TcgPersonalRaidDaily.records.find((entry) => entry.accountId === 'current').rankingFrozenAt, null);
});

test('every rank receives its exact tier including ranks outside the visible top 100', async () => {
  const deps = dependencies(Array.from({ length: 105 }, (_, index) => raid(`player-${index + 1}`, 1000 - index)));
  assert.equal((await settleWeeklyRaidRewards({ ...deps, now: NOW })).deliveredCount, 105);
  for (const player of deps.TcgPlayerState.records) {
    const rank = Number(player.accountId.split('-')[1]);
    const reward = player.mailbox[0].rewards;
    for (const [key, expected] of Object.entries(weeklyRaidRewardsForRank(rank))) assert.equal(reward[key], expected, `${rank}: ${key}`);
  }
});

test('tied scores receive the same competition rank and reward', async () => {
  const deps = dependencies([raid('a', 1000), raid('b', 1000), raid('c', 900)]);
  await settleWeeklyRaidRewards({ ...deps, now: NOW });
  assert.deepEqual(deps.TcgPersonalRaidDaily.records.map((record) => record.rankingReward.rank), [1, 1, 3]);
  assert.deepEqual(deps.TcgPlayerState.records.map((record) => record.mailbox[0].rewards.srPremiumPacks), [5, 5, 4]);
});

test('simultaneous workers and retries cannot duplicate a ranking mail', async () => {
  const deps = dependencies([raid('a', 1000)]);
  await Promise.all([settleWeeklyRaidRewards({ ...deps, now: NOW }), settleWeeklyRaidRewards({ ...deps, now: NOW })]);
  assert.equal(deps.TcgPlayerState.records.length, 1);
  assert.equal(deps.TcgPlayerState.records[0].mailbox.length, 1);
  assert.equal(deps.TcgPlayerState.records[0].weeklyRaidRewardReceipts.length, 1);
  assert.equal((await settleWeeklyRaidRewards({ ...deps, now: NOW })).checkedCount, 0);
});

test('a crash after mail commit can recover even after the mail is claimed and pruned', async () => {
  const deps = dependencies([raid('a', 1000)]);
  deps.TcgPersonalRaidDaily.failMarkerOnce = true;
  const first = await settleWeeklyRaidRewards({ ...deps, now: NOW });
  assert.equal(first.deferredCount, 1);
  const player = deps.TcgPlayerState.records[0];
  assert.equal(player.mailbox.length, 1);
  player.mailbox = [];
  const retry = await settleWeeklyRaidRewards({ ...deps, accountId: 'a', now: NOW + 1000 });
  assert.equal(retry.recoveredCount, 1);
  assert.equal(player.mailbox.length, 0);
  assert.equal(player.weeklyRaidRewardReceipts.length, 1);
  assert.ok(deps.TcgPersonalRaidDaily.records[0].rankingRewardSettledAt);
});

test('full mailboxes defer only that player and recover when space is made', async () => {
  const deps = dependencies([raid('full', 1000), raid('other', 900)]);
  deps.TcgPlayerState.records.push({ accountId: 'full', mailbox: Array.from({ length: MAX_STORED_MAILS }, (_, index) => ({ id: `mail-${index}`, expiresAt: new Date(NOW + 86400000).toISOString(), claimedAt: null })) });
  const first = await settleWeeklyRaidRewards({ ...deps, now: NOW });
  assert.equal(first.deferredCount, 1); assert.equal(first.deliveredCount, 1);
  assert.equal(deps.TcgPlayerState.records[0].weeklyRaidRewardReceipts, undefined);
  assert.equal((await settleWeeklyRaidRewards({ ...deps, now: NOW + 1000 })).checkedCount, 0);
  deps.TcgPlayerState.records[0].mailbox = [];
  const retry = await settleWeeklyRaidRewards({ ...deps, accountId: 'full', now: NOW + 2000 });
  assert.equal(retry.deliveredCount, 1);
  assert.equal(deps.TcgPlayerState.records[0].mailbox[0].rewards.srPremiumPacks, 5);
});

test('the background scheduler can settle offline users after database connection', async () => {
  const deps = dependencies([raid('offline', 1000)]);
  let connected = false;
  const scheduler = startWeeklyRaidRewardScheduler({ ...deps, now: () => NOW, canRun: () => connected });
  try {
    await scheduler.sweep(); assert.equal(deps.TcgPlayerState.records.length, 0);
    connected = true;
    await scheduler.sweep(); assert.equal(deps.TcgPlayerState.records[0].mailbox.length, 1);
  } finally { scheduler.stop(); }
});
