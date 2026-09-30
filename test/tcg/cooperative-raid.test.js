'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const {
  COORDINATOR_ID, createCooperativeRaidService, applyCooperativeReward, validateRepresentatives, loadCooperativeModules
} = require('../../src/tcg/services/cooperativeRaidService');
const { getKstDayWindow, getKstRaidWeekWindow, RAID_SCHEMA_VERSION } = require('../../src/tcg/services/personalRaidService');

const copy = (value) => JSON.parse(JSON.stringify(value));
const at = (object, key) => key.split('.').reduce((value, part) => Array.isArray(value) ? value.map((entry) => entry?.[part]) : value?.[part], object);
function put(object, key, value) {
  const parts = key.split('.'); const last = parts.pop();
  for (const part of parts) { object[part] ||= {}; object = object[part]; }
  object[last] = copy(value);
}
function matches(row, query) {
  return Object.entries(query).every(([key, expected]) => {
    const value = at(row, key);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$gt' in expected) return new Date(value).getTime() > new Date(expected.$gt).getTime();
      if ('$ne' in expected) return Array.isArray(value) ? !value.includes(expected.$ne) : value !== expected.$ne;
      if ('$nin' in expected) return !expected.$nin.includes(value);
    }
    return Array.isArray(value) ? value.includes(expected) : String(value) === String(expected);
  });
}
function model(seed = []) {
  return {
    records: copy(seed),
    async findOne(query) { return copy(this.records.find((row) => matches(row, query)) || null); },
    async updateOne(query, update, options = {}) {
      if (!this.records.some((row) => matches(row, query)) && options.upsert) this.records.push({ ...copy(query), ...copy(update.$setOnInsert || {}) });
      return { modifiedCount: 1 };
    },
    async findOneAndUpdate(query, update) {
      const row = this.records.find((entry) => matches(entry, query)); if (!row) return null;
      for (const [key, value] of Object.entries(update.$set || {})) put(row, key, value);
      for (const [key, value] of Object.entries(update.$inc || {})) put(row, key, (Number(at(row, key)) || 0) + value);
      for (const [key, value] of Object.entries(update.$push || {})) { const array = at(row, key) || []; put(row, key, [...array, value]); }
      return copy(row);
    }
  };
}

async function testModules() {
  const load = (file) => import(pathToFileURL(path.resolve(__dirname, '../../tcg-desktop/src', file)).href);
  const [engine, catalog, progression, equipment, relics] = await Promise.all([
    load('core/turnRaidEngine.js'), load('data/cardCatalog.js'), load('core/cardProgression.js'), load('core/equipment.js'), load('core/relics.js')
  ]);
  const characterIdForCard = (id) => id.replace(/-(c|u|r|rr|rrr|sr|hr|ur|ssr)$/, '');
  const rules = {
    characterIdForCard,
    selectCooperativeParty(players) {
      function choose(index, used, selected) {
        if (index === players.length) return selected;
        for (const card of players[index].cards) {
          if (used.has(characterIdForCard(card.cardId))) continue;
          const found = choose(index + 1, new Set([...used, characterIdForCard(card.cardId)]), [...selected, { ...players[index], card }]);
          if (found) return found;
        }
        return null;
      }
      return choose(0, new Set(), []);
    },
    createCooperativeBoss(stageSum) { return { id: 'test-coop', name: '협동 테스트', maxHp: stageSum * 20_000, baseDamage: 1, skills: [] }; },
    rollCooperativeRewards(stageSum) { return { coins: stageSum * 500, standardPacks: Math.ceil(stageSum / 4), cards: stageSum >= 24 ? [{ cardId: 'winter-sr', quantity: 1 }] : [], relics: [{ relicId: 'luxury-bag', quantity: 1 }], equipment: [] }; }
  };
  return { engine, catalog, progression, equipment, relics, rules };
}

async function harness({ count = 4, now = Date.parse('2026-09-30T01:00:00Z'), stages = [] } = {}) {
  const modules = await testModules();
  const cardIds = ['winter-c', 'kkamdung-c', 'nanche-c', 'morae-c', 'mango-c'];
  const accounts = Array.from({ length: count }, (_, i) => ({ _id: `account-${i}`, nickname: `동료${i}` }));
  const TcgPlayerState = model(accounts.map((account) => ({
    accountId: account._id, initialized: true, revision: 0, cooperativeRewardClaims: [],
    activeLease: { leaseId: `lease-${account._id}`, deviceId: `device-${account._id}`, generation: 1, expiresAt: new Date(now + 86_400_000).toISOString(), platform: 'web' },
    state: { wallet: { coins: 0 }, packs: { standard: 0 }, collection: Object.fromEntries(cardIds.map((id) => [id, 1])), cardEnhancements: {}, cardProgression: {}, equipmentInventory: [], relicInventory: {} }
  })));
  const TcgPersonalRaidDaily = model(accounts.map((account, i) => ({ accountId: account._id, bossId: 'deadline-dragon-raid', dayKey: getKstRaidWeekWindow(now).weekKey, schemaVersion: RAID_SCHEMA_VERSION, currentStage: stages[i] || 1, currentHp: 100_000 })));
  const TcgCooperativeRaid = model();
  const deps = { TcgPlayerState, TcgPersonalRaidDaily, TcgCooperativeRaid, modules, random: () => .25 };
  let service = createCooperativeRaidService(deps);
  const request = (index, extra = {}) => ({ leaseId: `lease-account-${index}`, deviceId: `device-account-${index}`, generation: 1, ...extra });
  const call = (operation, index, extra = {}, time = now) => service[operation]({ account: accounts[index], request: request(index, extra), now: time });
  const cards = (ids = cardIds.slice(0, 3)) => ids.map((cardId) => ({ cardId, enhancement: 0 }));
  const data = () => TcgCooperativeRaid.records.find((row) => row._id === COORDINATOR_ID)?.data;
  async function ready() {
    for (let i = 0; i < 4; i += 1) await call('queue', i, { cards: cards(i === 3 ? cardIds.slice(1, 4) : cardIds.slice(0, 3)) });
    return (await call('state', 0)).cooperative.match;
  }
  async function enter() { const match = await ready(); for (let i = 0; i < 4; i += 1) await call('accept', i, { matchId: match.id }); return data().rooms[0]; }
  return { deps, accounts, modules, call, cards, ready, enter, data, request, now, restart() { service = createCooperativeRaidService(deps); } };
}

test('representatives require three distinct people, owned enhancement, and available expedition copies', async () => {
  const h = await harness();
  await assert.rejects(h.call('queue', 0, { cards: h.cards(['winter-c', 'winter-u', 'mango-c']) }), { code: 'COOP_INVALID_REPRESENTATIVES' });
  await assert.rejects(h.call('queue', 0, { cards: [{ cardId: 'winter-c', enhancement: 5 }, ...h.cards().slice(1)] }), { code: 'COOP_CARD_UNAVAILABLE' });
  const state = h.deps.TcgPlayerState.records[0].state;
  state.expedition = { endsAt: h.now + 10000, squad: ['winter-c'], enhancementStages: { 'winter-c': 0 } };
  assert.throws(() => validateRepresentatives(state, h.cards(), h.modules, 'account-0', h.now), { code: 'COOP_CARD_UNAVAILABLE' });
});

test('matchmaking searches beyond an impossible first four and never duplicates characters', async () => {
  const h = await harness({ count: 5 });
  for (let i = 0; i < 4; i += 1) await h.call('queue', i, { cards: h.cards() });
  assert.equal(h.data().matches.length, 0);
  assert.equal((await h.call('state', 0)).cooperative.phase, 'queued');
  await h.call('queue', 4, { cards: h.cards(['morae-c', 'mango-c', 'winter-c']) });
  assert.equal(h.data().matches.length, 1);
  assert.equal(new Set(h.data().matches[0].participants.map((p) => p.card.characterId)).size, 4);
});

test('ready timeout removes nonresponders, requeues acceptors, and charges no entry', async () => {
  const h = await harness(); const match = await h.ready();
  await h.call('accept', 0, { matchId: match.id });
  const result = await h.call('state', 0, {}, h.now + 30_001);
  assert.equal(result.cooperative.phase, 'queued'); assert.equal(result.cooperative.entriesUsed, 0);
  assert.deepEqual(h.data().queue.map((p) => p.accountId), ['account-0']);
  assert.equal((await h.call('state', 1, {}, h.now + 30_001)).cooperative.phase, 'idle');
});

test('parallel accepts create one durable room and charge each daily entry exactly once', async () => {
  const h = await harness({ stages: [2, 5, 8, 10] }); const match = await h.ready();
  await Promise.all([0, 1, 2, 3, 3].map((i) => h.call('accept', i, { matchId: match.id })));
  assert.equal(h.data().rooms.length, 1); assert.equal(h.data().rooms[0].stageSum, 25);
  assert.deepEqual(Object.values(h.data().entries), [1, 1, 1, 1]);
  h.restart(); const restored = (await h.call('state', 0)).cooperative;
  assert.equal(restored.phase, 'battle'); assert.equal(restored.room.stageSum, 25);
  assert.equal(restored.room.battle.boss.maxHp, 500_000);
  await assert.rejects(h.call('queue', 0, { cards: h.cards() }), { code: 'COOP_ALREADY_PARTICIPATING' });
});

test('only active owner acts; action receipts and revision reject duplicate or stale damage', async () => {
  const h = await harness(); await h.enter();
  const first = (await h.call('state', 0)).cooperative.room;
  const owner = Number(first.activeAccountId.split('-').at(-1)); const other = (owner + 1) % 4;
  const request = { roomId: first.id, expectedRevision: first.revision, actionId: 'action-first-1', action: 'basic' };
  await assert.rejects(h.call('action', other, request), { code: 'COOP_NOT_YOUR_TURN' });
  const result = await h.call('action', owner, request);
  const damage = result.cooperative.room.battle.totalDamage;
  assert.ok(damage > 0);
  await h.call('action', owner, request);
  assert.equal(h.data().rooms[0].battle.totalDamage, damage);
  await assert.rejects(h.call('action', owner, { ...request, actionId: 'action-stale-2' }), { code: 'COOP_STALE_TURN' });
});

test('disconnected turns automatically advance from persisted deadlines after restart', async () => {
  const h = await harness(); await h.enter(); h.restart();
  const result = await h.call('state', 0, {}, h.now + 20_001);
  assert.equal(result.cooperative.room.battle.playerActionCount, 1);
  assert.ok(result.cooperative.room.battle.totalDamage > 0);
  const finished = await h.call('state', 0, {}, h.now + 30 * 60_000);
  assert.equal(finished.cooperative.phase, 'finished'); assert.ok(finished.cooperative.reward);
});

test('reward inventory and server-owned receipt commit atomically; retries cannot duplicate loot', async () => {
  const h = await harness({ stages: [6, 6, 6, 6] }); const room = await h.enter();
  room.battle.boss.hp = 1;
  const status = (await h.call('state', 0)).cooperative.room;
  const owner = Number(status.activeAccountId.split('-').at(-1));
  await h.call('action', owner, { roomId: room.id, expectedRevision: status.revision, actionId: 'victory-action', action: 'basic' });
  const [one, two] = await Promise.all([h.call('claim', 0, { roomId: room.id, baseRevision: 0 }), h.call('claim', 0, { roomId: room.id, baseRevision: 0 })]);
  assert.equal(one.snapshot.state.wallet.coins, 12000); assert.equal(two.snapshot.state.wallet.coins, 12000);
  assert.equal(one.snapshot.state.collection['winter-sr'], 1); assert.equal(one.snapshot.state.relicInventory['luxury-bag'], 1);
  assert.equal(one.snapshot.state.packs.standard, 6);
  const saved = h.deps.TcgPlayerState.records[0];
  assert.deepEqual(saved.cooperativeRewardClaims, [room.id]); assert.equal(saved.revision, 1);
  const selectedCardId = room.participants.find((p) => p.accountId === 'account-0').cardId;
  const progressionAfter = copy(saved.state.cardProgression[selectedCardId]);
  assert.ok(progressionAfter.level > 1 || progressionAfter.experience > 0);
  const archive = h.deps.TcgCooperativeRaid.records.find((entry) => entry._id === `archive:${room.id}`);
  assert.ok(archive); assert.equal(h.data().rooms.length, 0);
  archive.data.claimedAccountIds = []; // immutable archive does not need a second receipt write
  h.restart(); await h.call('claim', 0, { roomId: room.id, baseRevision: 0 });
  assert.equal(saved.state.wallet.coins, 12000); assert.equal((await h.call('state', 0)).cooperative.phase, 'idle');
  assert.deepEqual(saved.state.cardProgression[selectedCardId], progressionAfter);
  assert.equal((await h.call('state', 1)).cooperative.phase, 'finished');
  await assert.rejects(h.call('queue', 1, { cards: h.cards() }), { code: 'COOP_REWARD_PENDING' });
});

test('entry caps use admission-day KST midnight; old days cannot block a new day', async () => {
  const now = Date.parse('2026-09-30T14:59:59Z'); const h = await harness({ now });
  await h.call('state', 0); h.data().entries['account-0'] = 2;
  await assert.rejects(h.call('queue', 0, { cards: h.cards() }), { code: 'COOP_DAILY_LIMIT' });
  const next = await h.call('state', 0, {}, now + 1000);
  assert.equal(next.cooperative.entriesRemaining, 2); assert.equal(h.data().entryDay, getKstDayWindow(now + 1000).dayKey);
  h.data().entries['account-0'] = 2;
  const delayed = await h.call('state', 0, {}, now);
  assert.equal(h.data().entryDay, getKstDayWindow(now + 1000).dayKey);
  assert.equal(delayed.cooperative.entriesRemaining, 0);
  await assert.rejects(h.call('queue', 0, { cards: h.cards() }, now), { code: 'COOP_DAILY_LIMIT' });
});

test('abandoned finished rewards are archived and cannot globally exhaust active room capacity', async () => {
  const h = await harness({ count: 8 });
  await h.enter(); const original = copy(h.data().rooms[0]);
  original.battle.status = 'finished'; original.battle.result = 'victory';
  original.rewards = Object.fromEntries(original.participants.map((p) => [p.accountId, { coins: 100, standardPacks: 1, cards: [], relics: [], equipment: [] }]));
  h.data().rooms = Array.from({ length: 64 }, (_, i) => ({ ...copy(original), id: `abandoned-${i}` }));
  for (let i = 4; i < 8; i += 1) await h.call('queue', i, { cards: h.cards(i === 7 ? ['morae-c', 'mango-c', 'winter-c'] : undefined) });
  assert.equal(h.data().rooms.length, 0); assert.equal(h.data().matches.length, 1);
  assert.equal(h.deps.TcgCooperativeRaid.records.filter((row) => row._id.startsWith('archive:')).length, 64);
  h.restart(); assert.equal((await h.call('state', 0)).cooperative.phase, 'finished');
  const claimed = await h.call('claim', 0, { roomId: 'abandoned-0', baseRevision: 0 });
  assert.equal(claimed.snapshot.state.wallet.coins, 100);
  assert.equal((await h.call('state', 4)).cooperative.phase, 'ready');
});

test('cards and weekly reached stages are revalidated when the fourth player accepts', async () => {
  const h = await harness({ stages: [10, 10, 10, 10] }); const match = await h.ready();
  for (let i = 0; i < 3; i += 1) await h.call('accept', i, { matchId: match.id });
  h.deps.TcgPersonalRaidDaily.records.forEach((row) => { row.currentStage = 1; });
  await h.call('accept', 3, { matchId: match.id });
  assert.equal(h.data().rooms[0].stageSum, 4);
  const h2 = await harness(); const match2 = await h2.ready();
  for (let i = 0; i < 3; i += 1) await h2.call('accept', i, { matchId: match2.id });
  h2.deps.TcgPlayerState.records[0].state.collection['winter-c'] = 0;
  await h2.call('accept', 3, { matchId: match2.id });
  assert.equal(h2.data().rooms.length, 0); assert.deepEqual(h2.data().entries, {});
  assert.equal((await h2.call('state', 0)).cooperative.phase, 'idle');
});

test('claim rewards merge every inventory type and preserve existing enhancement/progression', () => {
  const state = { wallet: { coins: 1 }, packs: { standard: 1 }, collection: { 'winter-sr': 2 }, cardProgression: { 'winter-sr': { level: 12, experience: 9 } }, cardEnhancements: { 'winter-sr': [1, 1] }, equipmentInventory: [{ id: 'old' }], relicInventory: { 'luxury-bag': 1 } };
  const result = applyCooperativeReward(state, { coins: 9, standardPacks: 2, cards: [{ cardId: 'winter-sr', quantity: 1 }], relics: [{ relicId: 'luxury-bag', quantity: 1 }], equipment: [{ id: 'new' }] });
  assert.equal(result.collection['winter-sr'], 3); assert.equal(result.cardProgression['winter-sr'].level, 12);
  assert.equal(result.equipmentInventory.length, 2); assert.equal(result.relicInventory['luxury-bag'], 2);
  assert.equal(state.wallet.coins, 1);
});

test('production shared modules run four authenticated clients through matching and authoritative combat', async () => {
  const jwt = require('jsonwebtoken');
  const { registerTcgRoutes, signAccountToken } = require('../../src/tcg/registerTcgRoutes');
  const h = await harness({ stages: [8, 8, 8, 8] });
  const shared = await loadCooperativeModules();
  assert.equal(shared.rules.createCooperativeBoss(32).skills.length, 5);
  const routes = new Map();
  const secret = 'cooperative-integration-secret';
  for (const account of h.accounts) Object.assign(account, { status: 'active', tokenVersion: 0 });
  registerTcgRoutes({
    app: { get(route, handler) { routes.set(`GET ${route}`, handler); }, post(route, handler) { routes.set(`POST ${route}`, handler); }, put() {} },
    bcrypt: {}, jwt, jwtSecret: secret, now: () => h.now, random: () => .25,
    TcgAccount: { async findById(id) { return h.accounts.find((account) => account._id === id); } },
    TcgPlayerState: h.deps.TcgPlayerState, TcgPersonalRaidDaily: h.deps.TcgPersonalRaidDaily,
    TcgCooperativeRaid: h.deps.TcgCooperativeRaid
  });
  async function call(operation, index, extra = {}, authorization = true) {
    const token = signAccountToken(h.accounts[index], jwt, secret);
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    await routes.get(`${operation === 'state' ? 'GET' : 'POST'} /api/tcg/raids/cooperative/${operation}`)({ headers: authorization ? { authorization: `Bearer ${token}` } : {}, body: h.request(index, extra) }, response);
    return response;
  }
  assert.equal((await call('state', 0, {}, false)).statusCode, 401);
  for (let i = 0; i < 4; i += 1) {
    const response = await call('queue', i, { cards: h.cards(i === 3 ? ['morae-c', 'mango-c', 'winter-c'] : undefined), stage: 999, attack: 999999999 });
    assert.equal(response.statusCode, 200);
  }
  const match = (await call('state', 0)).body.cooperative.match;
  assert.equal(match.stageSum, 32);
  for (let i = 0; i < 4; i += 1) assert.equal((await call('accept', i, { matchId: match.id })).statusCode, 200);
  const room = (await call('state', 0)).body.cooperative.room;
  assert.equal(room.battle.boss.id, 'coop-tetra'); assert.equal(room.battle.boss.maxHp, shared.rules.getCooperativeDifficulty(32).maxHp);
  assert.equal(new Set(room.participants.map((p) => shared.rules.characterIdForCard(p.cardId))).size, 4);
  const owner = Number(room.activeAccountId.split('-').at(-1));
  const action = await call('action', owner, { roomId: room.id, expectedRevision: room.revision, actionId: 'integration-action', action: 'basic', damage: 99999999 });
  assert.equal(action.statusCode, 200);
  assert.ok(action.body.cooperative.room.battle.totalDamage > 0);
  assert.ok(action.body.cooperative.room.battle.totalDamage < 99999999);
  assert.ok(action.body.cooperative.room.battle.log.some((entry) => entry.type === 'boss-skill'));
});
