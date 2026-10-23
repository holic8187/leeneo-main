'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTowerService } = require('../../src/tcg/services/towerService');
const { settleTowerRewards, startTowerRewardScheduler } = require('../../src/tcg/services/towerRewardService');
const { loadTowerModules } = require('../../src/tcg/services/towerModules');
const { MAX_STORED_MAILS } = require('../../src/tcg/services/mailboxService');

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const at = (row, key) => key.split('.').reduce((v, k) => v?.[k], row);
function put(row, key, value) { const parts = key.split('.'), last = parts.pop(); for (const part of parts) row = row[part] ||= {}; row[last] = copy(value); }
function equal(value, query) {
  if (query == null) return value == null;
  if (query && typeof query === 'object' && !(query instanceof Date)) return Object.entries(query).every(([operator, target]) => {
    const actual = target instanceof Date ? new Date(value).getTime() : value, expected = target instanceof Date ? target.getTime() : target;
    if (operator === '$gt') return actual > expected;
    if (operator === '$gte') return actual >= expected;
    if (operator === '$lt') return actual < expected;
    if (operator === '$lte') return actual <= expected;
    if (operator === '$ne') return Array.isArray(value) ? !value.includes(target) : value !== target;
    throw new Error(`unsupported ${operator}`);
  });
  return String(value) === String(query);
}
function matches(row, query) { return Object.entries(query).every(([key, expected]) => {
  if (key === '$or') return expected.some(branch => matches(row, branch));
  if (key === '$expr') return (row.mailbox || []).length < expected.$lt[1];
  if (key === 'mailbox.id') return (row.mailbox || []).every(mail => equal(mail.id, expected));
  return equal(at(row, key), expected);
}); }
function update(row, change) {
  for (const [key, value] of Object.entries(change.$set || {})) put(row, key, value);
  for (const [key, value] of Object.entries(change.$inc || {})) put(row, key, (at(row, key) || 0) + value);
  for (const [key, value] of Object.entries(change.$push || {})) (row[key] ||= []).push(copy(value));
  for (const [key, query] of Object.entries(change.$pull || {})) row[key] = (row[key] || []).filter(entry => !matches(entry, query));
}
function memoryModel(seed = []) {
  return {
    rows: copy(seed), failMarkerOnce: false,
    async findOne(query) { return copy(this.rows.find(row => matches(row, query)) || null); },
    find(query) {
      let rows = this.rows.filter(row => matches(row, query));
      return { sort(spec) { rows.sort((a, b) => { for (const [key, direction] of Object.entries(spec)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; } return 0; }); return this; }, limit(limit) { rows = rows.slice(0, limit); return this; }, async lean() { return copy(rows); } };
    },
    async countDocuments(query) { return this.rows.filter(row => matches(row, query)).length; },
    async updateMany(query, change) { for (const row of this.rows.filter(row => matches(row, query))) update(row, change); },
    async updateOne(query, change, options = {}) {
      if (this.failMarkerOnce && change.$set?.rankingRewardSettledAt) { this.failMarkerOnce = false; throw new Error('crash after durable mail append'); }
      let row = this.rows.find(row => matches(row, query));
      if (!row && options.upsert) { row = { _id: `record-${this.rows.length}`, ...copy(change.$setOnInsert || {}) }; this.rows.push(row); return { upsertedCount: 1 }; }
      if (!row) return { modifiedCount: 0 };
      update(row, change); return { modifiedCount: 1 };
    },
    async findOneAndUpdate(query, change) { const row = this.rows.find(row => matches(row, query)); if (!row) return null; update(row, change); return copy(row); },
  };
}
const START = Date.parse('2026-10-23T12:00:00+09:00'), RESET = Date.parse('2026-11-01T00:00:00+09:00');
const IDS = ['mango-c', 'winter-c', 'shanghai-c', 'meongpeu-c'];
function harness() {
  let time = START;
  const account = { _id: 'player-a', nickname: '도전자' };
  const lease = { deviceId: 'pc-a', leaseId: 'lease-a', generation: 1 };
  const deps = { TcgTowerSeason: memoryModel(), TcgPlayerState: memoryModel([{ _id: 'state-a', accountId: account._id, initialized: true, revision: 0, state: { collection: Object.fromEntries([...IDS, 'winter-u'].map(id => [id, 1])), cardEnhancements: {}, cardProgression: {} }, activeLease: { ...lease, platform: 'pc', expiresAt: new Date(RESET + 86400000).toISOString() }, mailbox: [] }]), now: () => time, random: () => .5 };
  let service = createTowerService(deps), data;
  async function call(method, body = {}) { const result = await service[method]({ account, request: { ...lease, seasonKey: data?.seasonKey, expectedRevision: data?.revision, battleId: data?.battleId, ...body } }); if (result.tower) data = result.tower; return result; }
  async function ready() { await call('state'); await call('choose', { augmentId: data.offer.options[0] }); }
  async function enter() { await call('enter', { squad: IDS.map(cardId => ({ cardId, enhancement: 0 })) }); await call('action', { action: { type: 'start' } }); }
  return { deps, account, lease, call, ready, enter, data: () => data, row: () => deps.TcgTowerSeason.rows.find(r => r.seasonKey === data.seasonKey), setNow: value => { time = value; }, advance: (ms = 1001) => { time += ms; }, restart: () => { service = createTowerService(deps); } };
}

test('server owns offers and monthly progress; repeated GET does not reroll; choices use CAS', async () => {
  const h = harness(); await h.call('state'); const offer = copy(h.data().offer); await h.call('state'); assert.deepEqual(h.data().offer, offer);
  await assert.rejects(h.call('choose', { augmentId: 'not-offered' }), { code: 'TOWER_INVALID_AUGMENT' });
  const revision = h.data().revision;
  const results = await Promise.allSettled([h.call('choose', { augmentId: offer.options[0], expectedRevision: revision }), h.call('choose', { augmentId: offer.options[1], expectedRevision: revision })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(h.row().augments.length, 1);
});
test('slot rerolls cannot be repeated and monthly choices persist across service restart', async () => {
  const h = harness(); await h.call('state'); await h.call('reroll', { slot: 0 });
  await assert.rejects(h.call('reroll', { slot: 0 }), { code: 'TOWER_REROLL_USED' });
  const id = h.data().offer.options[0]; await h.call('choose', { augmentId: id }); h.restart(); await h.call('state');
  assert.deepEqual(h.data().augments, [id]); assert.equal(h.data().offer, null);
});
test('entry checks exact 4-person deck, ownership, enhancement and active expedition lock', async () => {
  const h = harness(); await h.ready(); const squad = IDS.map(cardId => ({ cardId, enhancement: 0 }));
  await assert.rejects(h.call('enter', { squad: squad.slice(0, 3) }), { code: 'INVALID_RAID_SQUAD' });
  await assert.rejects(h.call('enter', { squad: [{ cardId: 'winter-u', enhancement: 0 }, ...squad.slice(1)] }), { code: 'INVALID_RAID_SQUAD' });
  await assert.rejects(h.call('enter', { squad: [{ cardId: 'mango-c', enhancement: 5 }, ...squad.slice(1)] }), { code: 'RAID_CARD_STAGE_MISMATCH' });
  h.deps.TcgPlayerState.rows[0].state.expedition = { endsAt: START + 60000, squad: ['mango-c'], enhancementStages: { 'mango-c': 0 } };
  await assert.rejects(h.call('enter', { squad }), { code: 'RAID_CARD_UNAVAILABLE' });
  h.advance(60001); await h.call('enter', { squad }); assert.equal(h.data().battle.cards.length, 4);
});
test('forged power/damage/results cannot advance floors; actual shared engine victory can', async () => {
  const h = harness(); await h.ready(); await h.enter();
  const actorPower = h.data().battle.cards[0].attack;
  await h.call('action', { damage: 999999999, clearedFloor: 500, battle: { result: 'victory' }, action: { type: 'basic', power: 999999 } });
  assert.equal(h.data().clearedFloor, 0); assert.ok(h.data().battle.totalDamage < actorPower * 3);
  assert.equal(h.data().battle.seed, undefined);
  for (let step = 0; step < 100 && h.data().battle.status !== 'finished'; step++) {
    if (h.data().battle.currentActor === 'card') await h.call('action', { action: { type: 'basic' } });
    else { h.advance(); await h.call('state'); }
  }
  assert.equal(h.data().battle.result, 'victory'); assert.equal(h.data().clearedFloor, 1); assert.equal(h.data().rankingScore, 1000000);
  await h.call('state'); assert.equal(h.data().clearedFloor, 1);
});
test('expired player turns auto attack; boss waits 1 second; stale actions and takeover are blocked', async () => {
  const h = harness(); await h.ready(); await h.enter(); h.advance(20000);
  await assert.rejects(h.call('action', { action: { type: 'skill' } }), { code: 'TOWER_TURN_EXPIRED' });
  await h.call('state'); assert.equal(h.data().battle.currentActor, 'boss');
  const rev = h.data().revision; h.advance(999); await h.call('state'); assert.equal(h.data().revision, rev);
  h.advance(1); await h.call('state'); assert.equal(h.data().battle.currentActor, 'card');
  await assert.rejects(h.call('action', { expectedRevision: rev, action: { type: 'basic' } }), { code: 'TOWER_CONFLICT' });
  await assert.rejects(h.call('action', { deviceId: 'another-device', action: { type: 'basic' } }), { code: 'PLAY_SESSION_LOST' });
});

test('reconnecting after a long absence replays original deadlines to the same bounded result as live timeouts', async () => {
  const offline=harness(),live=harness();
  for(const h of [offline,live]){await h.ready();await h.enter();h.row().battle.boss.maxHp=1_000_000;h.row().battle.boss.hp=1_000_000;}
  offline.advance(2*3600000);await offline.call('state');
  for(let step=0;step<100&&live.data().battle.status!=='finished';step++){
    const battle=live.data().battle;
    live.setNow(battle.currentActor==='card'?battle.turnDeadlineAt:battle.turnStartedAt+1000);
    await live.call('state');
  }
  assert.equal(offline.data().battle.status,'finished');
  assert.equal(offline.data().battle.finishedAt,live.data().battle.finishedAt);
  assert.equal(offline.data().battle.playerActionCount,live.data().battle.playerActionCount);
  assert.equal(offline.data().battle.totalDamage,live.data().battle.totalDamage);
  assert.deepEqual(offline.data().battle.cards,live.data().battle.cards);
  assert.equal(offline.data().rankingScore,live.data().rankingScore);
  assert.ok(offline.data().battle.log.length<=100);
  assert.ok(Buffer.byteLength(JSON.stringify(offline.row()))<256*1024);
});

test('same winning action cannot be counted twice under concurrent requests or stale retries', async () => {
  const h=harness();await h.ready();await h.enter();h.row().battle.boss.hp=1;
  const revision=h.data().revision,request={expectedRevision:revision,action:{type:'basic'}};
  const results=await Promise.allSettled([h.call('action',request),h.call('action',request)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(h.row().clearedFloor,1);assert.equal(h.row().rankingScore,1_000_000);
  await assert.rejects(h.call('action',request),{code:'TOWER_CONFLICT'});
  assert.equal(h.row().clearedFloor,1);
});

test('month rollover during request preparation rejects the old battle and preserves frozen progress', async () => {
  const h=harness();await h.ready();await h.enter();const old=h.row(),revision=old.revision;
  const model=h.deps.TcgPlayerState,find=model.findOne.bind(model);let reads=0;
  model.findOne=async query=>{const result=await find(query);if(query['activeLease.leaseId']&&++reads===2)h.setNow(RESET);return result;};
  await assert.rejects(h.call('action',{action:{type:'basic'}}),{code:'TOWER_SEASON_CHANGED'});
  assert.equal(old.revision,revision);assert.equal(old.battle.playerActionCount,0);
  await h.call('state');assert.equal(h.data().seasonKey,'2026-11');assert.ok(old.rankingFrozenAt);
});

test('tower skill options are bounded enums and invalid choices never enter saved snapshots', async () => {
  const h=harness();await h.ready();await h.enter();const revision=h.row().revision;
  for(const choice of ['x'.repeat(100000),{selected:'charge'},['release']])
    await assert.rejects(h.call('action',{action:{type:'skill',choice}}),{code:'TOWER_INVALID_ACTION'});
  assert.equal(h.row().revision,revision);assert.equal(h.row().battle.lastCopyableSkill,null);
});
test('five cleared floors yield exactly one accumulated next offer and failed retries cannot add score', async () => {
  const h = harness(); await h.ready();
  for (let floor = 1; floor <= 5; floor++) { await h.enter(); h.row().battle.boss.hp = 1; await h.call('action', { action: { type: 'basic' } }); }
  assert.equal(h.data().clearedFloor, 5); assert.equal(h.data().offer.checkpoint, 5); assert.equal(h.data().offer.tier, 'gold');
  await h.call('choose', { augmentId: h.data().offer.options[0] }); assert.equal(h.data().augments.length, 2);
  await h.enter(); await h.call('action', { action: { type: 'basic' } }); await h.call('abandon');
  const score = h.data().rankingScore;
  await h.enter(); await h.call('action', { action: { type: 'basic' } }); await h.call('abandon'); assert.equal(h.data().rankingScore, score);
});
test('KST month reset preserves the frozen old score and pays before starting a fresh run', async () => {
  const h = harness(); await h.ready(); await h.enter(); await h.call('action', { action: { type: 'basic' } }); await h.call('abandon');
  const old = h.row(), oldSeason = old.seasonKey; h.setNow(RESET); await h.call('state');
  assert.equal(h.data().seasonKey, '2026-11'); assert.equal(h.data().clearedFloor, 0); assert.equal(h.data().augments.length, 0); assert.ok(h.data().offer);
  assert.ok(old.rankingFrozenAt); assert.ok(old.rankingRewardSettledAt); assert.equal(h.deps.TcgPlayerState.rows[0].mailbox.length, 1);
  await assert.rejects(h.call('choose', { seasonKey: oldSeason, augmentId: h.data().offer.options[0] }), { code: 'TOWER_SEASON_CHANGED' });
});

function closed(accountId, score, overrides = {}) { return { _id: `tower-${accountId}`, accountId, nickname: accountId, seasonKey: '2026-10', rankingScore: score, clearedFloor: Math.floor(score / 1000000), bestProgress: score % 1000000, rankingFrozenAt: null, rankingRewardSettledAt: null, rankingRewardRetryAt: null, rankingReward: null, ...overrides }; }
function rewards(rows) { return { TcgTowerSeason: memoryModel(rows), TcgPlayerState: memoryModel() }; }
test('monthly tied rankings share rewards; zero and current month records are excluded', async () => {
  const deps = rewards([closed('a', 4000000), closed('b', 4000000), closed('c', 3000000), closed('none', 0), closed('current', 9000000, { seasonKey: '2026-11' })]);
  assert.equal((await settleTowerRewards({ ...deps, now: RESET - 1 })).checkedCount, 0);
  assert.equal((await settleTowerRewards({ ...deps, now: RESET })).deliveredCount, 3);
  assert.deepEqual(deps.TcgTowerSeason.rows.slice(0, 3).map(row => row.rankingReward.rank), [1, 1, 3]);
  assert.deepEqual(deps.TcgPlayerState.rows.map(row => row.mailbox[0].rewards.srPremiumPacks), [5, 5, 3]);
});
test('concurrent settlement/crash/pruned mail retries use durable receipts and original reward policy', async () => {
  const deps = rewards([closed('a', 1000000)]); deps.TcgTowerSeason.failMarkerOnce = true;
  await Promise.all([settleTowerRewards({ ...deps, now: RESET }), settleTowerRewards({ ...deps, now: RESET })]);
  assert.equal(deps.TcgPlayerState.rows[0].mailbox.length, 1); assert.equal(deps.TcgPlayerState.rows[0].weeklyRaidRewardReceipts.length, 1);
  deps.TcgPlayerState.rows[0].mailbox = []; deps.TcgTowerSeason.rows[0].rankingRewardSettledAt = null;
  const retry = await settleTowerRewards({ ...deps, accountId: 'a', now: RESET + 100, rewardTiers: [{ maxRank: null, rewards: { coins: 1 } }] });
  assert.equal(retry.recoveredCount, 1); assert.equal(deps.TcgPlayerState.rows[0].mailbox.length, 0); assert.equal(deps.TcgTowerSeason.rows[0].rankingReward.mail.rewards.srPremiumPacks, 5);
});
test('full inbox cannot block other rewards; delayed delivery gets a fresh expiry and scheduler supports offline users', async () => {
  const deps = rewards([closed('a', 1000000), closed('b', 100)]);
  deps.TcgPlayerState.rows.push({ accountId: 'a', mailbox: Array.from({ length: MAX_STORED_MAILS }, (_, i) => ({ id: String(i), expiresAt: new Date(RESET + 365 * 86400000).toISOString(), claimedAt: null })) });
  const result = await settleTowerRewards({ ...deps, now: RESET }); assert.equal(result.deferredCount, 1); assert.equal(result.deliveredCount, 1);
  deps.TcgPlayerState.rows[0].mailbox = [];
  let canRun = false; const late = RESET + 45 * 86400000;
  const scheduler = startTowerRewardScheduler({ ...deps, now: () => late, canRun: () => canRun });
  try { await scheduler.sweep(); assert.equal(deps.TcgPlayerState.rows[0].mailbox.length, 0); canRun = true; await scheduler.sweep(); assert.ok(new Date(deps.TcgPlayerState.rows[0].mailbox[0].expiresAt).getTime() > late); }
  finally { scheduler.stop(); }
});
test('rankings match server score, shared client reward tiers and private account ids stay private', async () => {
  const h = harness(); await h.ready(); h.row().rankingScore = 2000000; h.row().clearedFloor = 2;
  const result = await h.call('ranking'); assert.equal(result.ranking.ownRank, 1); assert.equal(result.ranking.entries[0].own, true); assert.equal(result.ranking.entries[0].accountId, undefined);
  const modules = await loadTowerModules(); assert.deepEqual(result.ranking.rewardTiers, modules.rules.TOWER_MONTHLY_REWARD_TIERS);
});
