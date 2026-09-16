'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const TcgPersonalRaidDailyModel = require('../../src/tcg/models/TcgPersonalRaidDaily');
const {
  PERSONAL_RAID_BOSSES,
  RAID_SCHEMA_VERSION,
  STAGE_HP,
  PersonalRaidError,
  finishPersonalRaid,
  getBossStage,
  getKstRaidWeekWindow,
  getPersonalRaidRanking,
  getPersonalRaidState,
  startPersonalRaid,
  validatePersonalRaidSquad
} = require('../../src/tcg/services/personalRaidService');
const { TCG_TOKEN_AUDIENCE, TCG_TOKEN_ISSUER, registerTcgRoutes } = require('../../src/tcg/registerTcgRoutes');

const TEST_SECRET = 'personal-raid-test-secret-with-entropy';

function clone(value) {
  if (value == null) return value;
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(clone);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  return value;
}

function getPath(value, path) { return path.split('.').reduce((current, key) => current?.[key], value); }
function same(left, right) {
  if (left instanceof Date || right instanceof Date) return new Date(left).getTime() === new Date(right).getTime();
  return String(left) === String(right);
}
function matches(record, query) {
  return Object.entries(query).every(([path, expected]) => {
    const actual = getPath(record, path);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if (Object.hasOwn(expected, '$gt')) return Number(actual) > Number(expected.$gt);
      return false;
    }
    return same(actual, expected);
  });
}

function createFakeRaidModel(seed = []) {
  const records = seed.map((entry, index) => ({
    _id: entry._id || `raid-${index + 1}`,
    revision: 0,
    createdAt: new Date('2026-09-15T00:00:00Z'),
    updatedAt: new Date('2026-09-15T00:00:00Z'),
    ...clone(entry)
  }));
  let nextId = records.length + 1;
  class FakeRaid {
    static async updateOne(query, update, options = {}) {
      if (records.some((record) => matches(record, query)) || !options.upsert) return { matchedCount: 1 };
      records.push({ _id: `raid-${nextId++}`, createdAt: new Date(), updatedAt: new Date(), ...clone(update.$setOnInsert || {}) });
      return { upsertedCount: 1 };
    }
    static findOne(query) {
      return { async lean() { const found = records.find((record) => matches(record, query)); return found ? clone(found) : null; } };
    }
    static async findOneAndUpdate(query, update) {
      await Promise.resolve();
      const found = records.find((record) => matches(record, query));
      if (!found) return null;
      Object.assign(found, clone(update.$set || {}));
      for (const [key, amount] of Object.entries(update.$inc || {})) found[key] = (Number(found[key]) || 0) + Number(amount);
      return clone(found);
    }
    static find(query) {
      return {
        spec: {}, maximum: Infinity,
        sort(spec) { this.spec = spec; return this; },
        limit(maximum) { this.maximum = maximum; return this; },
        async lean() {
          const selected = records.filter((record) => matches(record, query));
          selected.sort((left, right) => {
            for (const [key, direction] of Object.entries(this.spec)) {
              const a = getPath(left, key); const b = getPath(right, key);
              if (a < b) return -direction;
              if (a > b) return direction;
            }
            return 0;
          });
          return selected.slice(0, this.maximum).map(clone);
        }
      };
    }
    static async countDocuments(query) { return records.filter((record) => matches(record, query)).length; }
  }
  FakeRaid.records = records;
  return FakeRaid;
}

function account(id = 'account-1', nickname = '레이더') { return { _id: id, nickname, status: 'active', tokenVersion: 0 }; }
function verifiedSquad() {
  return {
    squad: [
      { slot: 1, cardId: 'simsim-c', enhancement: 0, power: 1800 },
      { slot: 2, cardId: 'winter-c', enhancement: 0, power: 2148 },
      { slot: 3, cardId: 'kkamdung-c', enhancement: 0, power: 2496 }
    ],
    squadScore: 6444
  };
}

test('model preserves the production unique index and adds a weekly ranking index', () => {
  assert.equal(TcgPersonalRaidDailyModel.schema.options.collection, 'tcg_personal_raid_daily');
  const indexes = TcgPersonalRaidDailyModel.schema.indexes();
  const unique = indexes.find(([, options]) => options.name === 'one_personal_raid_state_per_account_day');
  assert.deepEqual(unique[0], { accountId: 1, dayKey: 1, bossId: 1 });
  assert.equal(unique[1].unique, true);
  const ranking = indexes.find(([, options]) => options.name === 'personal_raid_weekly_ranking');
  assert.deepEqual(ranking[0], { weekKey: 1, bossId: 1, schemaVersion: 1, contribution: -1, updatedAt: 1 });
});

test('weekly reset interprets Monday 24:00 as Tuesday 00:00 KST', () => {
  const before = getKstRaidWeekWindow(new Date('2026-09-14T14:59:59.999Z')); // Mon 23:59:59.999 KST
  assert.equal(before.weekKey, '2026-09-08');
  assert.equal(before.resetsAt.toISOString(), '2026-09-14T15:00:00.000Z');
  const after = getKstRaidWeekWindow(new Date('2026-09-14T15:00:00.000Z')); // Tue 00:00 KST
  assert.equal(after.weekKey, '2026-09-15');
  assert.equal(after.startsAt.toISOString(), '2026-09-14T15:00:00.000Z');
  assert.equal(after.resetRule, 'MONDAY_24_KST');
});

test('deadline dragon exposes eight doubling HP stages and cumulative skills', () => {
  const boss = PERSONAL_RAID_BOSSES['deadline-dragon-raid'];
  assert.deepEqual(boss.stageHp, STAGE_HP);
  assert.equal(getBossStage(boss, 1).basicAttack.damage, 10);
  assert.equal(getBossStage(boss, 2).skills[0].damage, 30);
  assert.equal(getBossStage(boss, 2).skills[0].cooldownTurns, 3);
  assert.equal(getBossStage(boss, 3).skills.length, 2);
  assert.equal(getBossStage(boss, 8).skills.length, 7);
  assert.equal(getBossStage(boss, 8).maxHp, 12_800_000);
});

test('squad validation preserves selection order, verifies enhancement, and blocks expedition cards', () => {
  const playerState = {
    collection: { 'simsim-c': 1, 'winter-c': 2, 'kkamdung-c': 1, 'mango-c': 1 },
    cardEnhancements: { 'winter-c': { 2: 1 } },
    expedition: { squad: ['kkamdung-c'], enhancementStages: { 'kkamdung-c': 0 }, endsAt: Date.parse('2026-09-16T10:00:00Z') }
  };
  const verified = validatePersonalRaidSquad({
    playerState,
    squad: [{ cardId: 'winter-c', enhancement: 2 }, { cardId: 'simsim-c', enhancement: 0 }, { cardId: 'mango-c', enhancement: 0 }],
    now: Date.parse('2026-09-16T09:00:00Z')
  });
  assert.deepEqual(verified.squad.map((card) => [card.slot, card.cardId, card.enhancement]), [[1, 'winter-c', 2], [2, 'simsim-c', 0], [3, 'mango-c', 0]]);
  assert.throws(() => validatePersonalRaidSquad({ playerState, squad: [{ cardId: 'kkamdung-c', enhancement: 0 }, { cardId: 'simsim-c', enhancement: 0 }, { cardId: 'winter-c', enhancement: 2 }] }), (error) => error.code === 'RAID_CARD_UNAVAILABLE');
});

test('start consumes one daily entry, creates a bound session, and prevents parallel starts', async () => {
  const Model = createFakeRaidModel(); const user = account(); const now = Date.parse('2026-09-16T03:00:00Z');
  const started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now });
  assert.equal(started.session.stage, 1);
  assert.equal(started.session.bossHpBefore, 100_000);
  assert.equal(started.session.squad[0].slot, 1);
  assert.equal(Model.records[0].dailyEntryCount, 1);
  await assert.rejects(() => startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now: now + 1000 }), (error) => error.code === 'RAID_SESSION_ACTIVE');
});

test('finish validates HP math, caps damage, advances stages, and rejects duplicate submissions', async () => {
  const Model = createFakeRaidModel(); const user = account(); let now = Date.parse('2026-09-16T03:00:00Z');
  const started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now });
  await assert.rejects(() => finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 100_001, now: now + 1000 }), (error) => error.code === 'RAID_DAMAGE_EXCEEDS_LIMIT' && error.details.maximumDamage === 100_000);
  await assert.rejects(() => finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 70_000, bossHpRemaining: 20_000, now: now + 1000 }), (error) => error.code === 'RAID_HP_MISMATCH');
  await assert.rejects(() => finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 0, bossHpRemaining: 100_000, turns: 8, now: now + 1000 }), (error) => error.code === 'INVALID_RAID_TURNS' && error.details.maximumTurns === 7);
  const finished = await finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 100_000, bossHpRemaining: 0, turns: 4, battleLog: [], now: now + 1000 });
  assert.equal(finished.result.cleared, true);
  assert.equal(finished.record.currentStage, 2);
  assert.equal(finished.record.currentHp, 200_000);
  assert.equal(finished.record.contribution, 100_000);
  await assert.rejects(() => finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 100_000, now: now + 2000 }), (error) => error.code === 'RAID_SESSION_ALREADY_FINISHED');
});

test('ranking score equals cleared-stage HP plus accumulated current-stage damage', async () => {
  const Model = createFakeRaidModel(); const user = account('me', '나'); let now = Date.parse('2026-09-16T03:00:00Z');
  let started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now });
  await finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 100_000, bossHpRemaining: 0, now: now + 1000 });
  now += 2000;
  started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now });
  await finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 70_000, bossHpRemaining: 130_000, now: now + 1000 });
  const state = await getPersonalRaidState({ TcgPersonalRaidDaily: Model, account: user, now: now + 2000 });
  const ranking = await getPersonalRaidRanking({ TcgPersonalRaidDaily: Model, account: user, now: now + 2000 });
  assert.equal(state.state.stage, 2);
  assert.equal(state.state.hp, 130_000);
  assert.equal(state.state.score, 170_000);
  assert.equal(ranking.myEntry.score, 170_000);
  assert.equal(ranking.myRank, 1);
});

test('daily entry count resets at KST midnight while weekly progress remains', async () => {
  const Model = createFakeRaidModel(); const user = account(); const dayOne = Date.parse('2026-09-16T14:50:00Z');
  let started;
  for (let entry = 0; entry < 5; entry += 1) {
    const at = dayOne + entry * 1000;
    started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now: at });
    await finishPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, sessionId: started.session.sessionId, damageDealt: 0, bossHpRemaining: 100_000, now: at + 500 });
  }
  await assert.rejects(() => startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now: dayOne + 6000 }), (error) => error.code === 'DAILY_ENTRY_LIMIT');
  const nextDay = Date.parse('2026-09-16T15:00:00Z');
  started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now: nextDay });
  assert.equal(Model.records[0].dailyEntryCount, 1);
  assert.equal(started.session.stage, 1);
});

test('legacy daily record is reset into v2 weekly progress at the first start', async () => {
  const user = account(); const now = Date.parse('2026-09-15T03:00:00Z');
  const Model = createFakeRaidModel([{
    accountId: user._id, dayKey: '2026-09-15', bossId: 'deadline-dragon-raid', nickname: user.nickname,
    currentHp: 2_000_000, contribution: 800_000, dispatchCount: 3, clearCount: 1, schemaVersion: 1
  }]);
  const started = await startPersonalRaid({ TcgPersonalRaidDaily: Model, account: user, verifiedSquad: verifiedSquad(), now });
  assert.equal(started.session.stage, 1);
  assert.equal(started.session.bossHpBefore, 100_000);
  assert.equal(Model.records[0].schemaVersion, RAID_SCHEMA_VERSION);
  assert.equal(Model.records[0].contribution, 0);
});

function routeHarness() {
  let now = Date.parse('2026-09-16T06:00:00Z');
  const user = account('route-account', 'API레이더');
  const Model = createFakeRaidModel(); const routes = new Map();
  const app = { get(path, fn) { routes.set(`GET ${path}`, fn); }, post(path, fn) { routes.set(`POST ${path}`, fn); }, put(path, fn) { routes.set(`PUT ${path}`, fn); } };
  const TcgAccount = { async findById(id) { return String(id) === user._id ? user : null; }, async exists() { return null; }, findOne() { return { async select() { return null; } }; } };
  class PlayerState {
    static async findOne() {
      return {
        accountId: user._id, initialized: true, revision: 1,
        state: { collection: { 'simsim-c': 1, 'winter-c': 1, 'kkamdung-c': 1 }, cardEnhancements: {}, selectedRaidSquad: ['simsim-c', 'winter-c', 'kkamdung-c'] },
        activeLease: { leaseId: 'lease', deviceId: 'device', platform: 'pc', generation: 1, heartbeatAt: new Date(now), expiresAt: new Date(now + 60_000), appVersion: '1.0.0' }
      };
    }
  }
  registerTcgRoutes({ app, bcrypt: { hash: async () => '', compare: async () => false }, jwt, jwtSecret: TEST_SECRET, TcgAccount, TcgPersonalRaidDaily: Model, TcgPlayerState: PlayerState, now: () => now });
  const token = jwt.sign({ sub: user._id, kind: 'tcg', tokenVersion: 0 }, TEST_SECRET, { issuer: TCG_TOKEN_ISSUER, audience: TCG_TOKEN_AUDIENCE, expiresIn: '1h' });
  async function request(method, path, body = {}, authorized = true) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(payload) { this.payload = payload; return this; } };
    await routes.get(`${method} ${path}`)({ body, query: {}, headers: authorized ? { authorization: `Bearer ${token}` } : {}, ip: '127.0.0.1' }, response);
    return response;
  }
  return { Model, routes, request, setNow(value) { now = value; } };
}

test('start and finish routes expose the agreed battle contract', async () => {
  const harness = routeHarness();
  assert.ok(harness.routes.has('POST /api/tcg/raids/personal/start'));
  assert.ok(harness.routes.has('POST /api/tcg/raids/personal/finish'));
  const unauthorized = await harness.request('POST', '/api/tcg/raids/personal/start', {}, false);
  assert.equal(unauthorized.statusCode, 401);
  const common = { bossId: 'deadline-dragon-raid', leaseId: 'lease', deviceId: 'device', generation: 1 };
  const started = await harness.request('POST', '/api/tcg/raids/personal/start', { ...common, squad: [{ cardId: 'simsim-c', enhancement: 0 }, { cardId: 'winter-c', enhancement: 0 }, { cardId: 'kkamdung-c', enhancement: 0 }], squadScore: 6444 });
  assert.equal(started.statusCode, 200);
  assert.equal(started.payload.battle.bossMaxHp, 100_000);
  assert.equal(started.payload.battle.bossHp, 100_000);
  assert.equal(started.payload.battle.squad[0].slot, 1);
  assert.equal(started.payload.state.entriesToday, 1);
  const finished = await harness.request('POST', '/api/tcg/raids/personal/finish', { ...common, sessionId: started.payload.battle.sessionId, damageDealt: 70_000, bossHpRemaining: 30_000, turns: 4, battleLog: [] });
  assert.equal(finished.statusCode, 200);
  assert.equal(finished.payload.result.damageDealt, 70_000);
  assert.equal(finished.payload.state.score, 70_000);
  assert.equal(finished.payload.ranking.myRank, 1);
});

test('legacy dispatch route explicitly directs clients to turn battle endpoints', async () => {
  const harness = routeHarness();
  const response = await harness.request('POST', '/api/tcg/raids/personal/dispatch', {});
  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.code, 'RAID_BATTLE_REQUIRED');
  assert.equal(response.payload.startEndpoint, '/api/tcg/raids/personal/start');
});
