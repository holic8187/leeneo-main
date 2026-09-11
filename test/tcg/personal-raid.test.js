'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const TcgPersonalRaidDailyModel = require('../../src/tcg/models/TcgPersonalRaidDaily');
const {
  PERSONAL_RAID_BOSSES,
  PERSONAL_RAID_COOLDOWN_MS,
  PersonalRaidError,
  calculatePersonalRaidDamage,
  dispatchPersonalRaid,
  getKstDayWindow,
  getPersonalRaidRanking,
  getPersonalRaidState,
  parseSquadScore
} = require('../../src/tcg/services/personalRaidService');
const {
  TCG_TOKEN_AUDIENCE,
  TCG_TOKEN_ISSUER,
  registerTcgRoutes
} = require('../../src/tcg/registerTcgRoutes');

const TEST_SECRET = 'personal-raid-test-secret-with-entropy';

function clone(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(clone);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function sameValue(left, right) {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return String(left) === String(right);
}

function matches(record, query) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = record[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if (Object.hasOwn(expected, '$gt')) return Number(actual) > Number(expected.$gt);
      return false;
    }
    return sameValue(actual, expected);
  });
}

function createFakeRaidModel(seed = []) {
  const records = seed.map((entry, index) => ({
    _id: entry._id || `daily-${index + 1}`,
    revision: 0,
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
    updatedAt: new Date('2026-09-10T00:00:00.000Z'),
    ...clone(entry)
  }));
  let nextId = records.length + 1;

  class FakeRaidDaily {
    static async updateOne(query, update, options = {}) {
      const existing = records.find((record) => matches(record, query));
      if (existing || !options.upsert) return { acknowledged: true, matchedCount: existing ? 1 : 0 };
      if (Object.hasOwn(update.$setOnInsert || {}, 'updatedAt')) {
        const error = new Error("Updating the path 'updatedAt' would create a conflict at 'updatedAt'");
        error.code = 40;
        throw error;
      }
      const inserted = {
        _id: `daily-${nextId++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...clone(update.$setOnInsert || {})
      };
      records.push(inserted);
      return { acknowledged: true, upsertedId: inserted._id };
    }

    static findOne(query) {
      return {
        async lean() {
          const record = records.find((candidate) => matches(candidate, query));
          return record ? clone(record) : null;
        }
      };
    }

    static async findOneAndUpdate(query, update) {
      // Yield once so Promise.all callers can read the same revision first.
      await Promise.resolve();
      const record = records.find((candidate) => matches(candidate, query));
      if (!record) return null;
      Object.assign(record, clone(update.$set || {}));
      for (const [key, amount] of Object.entries(update.$inc || {})) {
        record[key] = (Number(record[key]) || 0) + Number(amount);
      }
      return clone(record);
    }

    static find(query) {
      const chain = {
        sortSpec: {},
        maximum: Number.POSITIVE_INFINITY,
        sort(spec) {
          this.sortSpec = spec;
          return this;
        },
        limit(value) {
          this.maximum = value;
          return this;
        },
        async lean() {
          const selected = records.filter((record) => matches(record, query));
          selected.sort((left, right) => {
            for (const [key, direction] of Object.entries(this.sortSpec)) {
              const leftValue = left[key] instanceof Date ? left[key].getTime() : left[key];
              const rightValue = right[key] instanceof Date ? right[key].getTime() : right[key];
              if (leftValue < rightValue) return -1 * direction;
              if (leftValue > rightValue) return direction;
            }
            return 0;
          });
          return selected.slice(0, this.maximum).map(clone);
        }
      };
      return chain;
    }

    static async countDocuments(query) {
      return records.filter((record) => matches(record, query)).length;
    }
  }

  FakeRaidDaily.records = records;
  return FakeRaidDaily;
}

function createAccount(id = 'account-1', nickname = '레이드사원') {
  return { _id: id, nickname, status: 'active', tokenVersion: 0 };
}

test('personal raid daily model has one row per account, KST day, and boss', () => {
  assert.equal(TcgPersonalRaidDailyModel.schema.options.collection, 'tcg_personal_raid_daily');
  const indexes = TcgPersonalRaidDailyModel.schema.indexes();
  const unique = indexes.find(([, options]) => options.name === 'one_personal_raid_state_per_account_day');
  assert.deepEqual(unique[0], { accountId: 1, dayKey: 1, bossId: 1 });
  assert.equal(unique[1].unique, true);
  const ranking = indexes.find(([, options]) => options.name === 'personal_raid_daily_ranking');
  assert.deepEqual(ranking[0], { dayKey: 1, bossId: 1, contribution: -1, updatedAt: 1 });
});

test('KST raid day rolls over exactly at Korea midnight', () => {
  const before = getKstDayWindow(new Date('2026-09-10T14:59:59.999Z'));
  assert.equal(before.dayKey, '2026-09-10');
  assert.equal(before.resetsAt.toISOString(), '2026-09-10T15:00:00.000Z');

  const after = getKstDayWindow(new Date('2026-09-10T15:00:00.000Z'));
  assert.equal(after.dayKey, '2026-09-11');
  assert.equal(after.startsAt.toISOString(), '2026-09-10T15:00:00.000Z');
});

test('squad score validation rejects forged ranges and damage variance is server controlled', () => {
  assert.equal(parseSquadScore('54000'), 54_000);
  for (const invalid of [0, -1, 60_001, 1.5, 'not-a-score', '', null, true]) {
    assert.throws(() => parseSquadScore(invalid), (error) => (
      error instanceof PersonalRaidError && error.code === 'INVALID_SQUAD_SCORE'
    ));
  }
  const boss = PERSONAL_RAID_BOSSES['deadline-dragon-raid'];
  assert.equal(calculatePersonalRaidDamage(10_000, boss, () => 0), 1_232_500);
  assert.equal(calculatePersonalRaidDamage(10_000, boss, () => 0.999999), 1_667_499);
});

test('dispatch enforces a 60-second cooldown and two deadline-dragon clears per KST day', async () => {
  const RaidDaily = createFakeRaidModel();
  const account = createAccount();
  const firstAt = Date.parse('2026-09-10T03:00:00.000Z');
  const first = await dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 60_000,
    now: firstAt,
    random: () => 0
  });
  assert.equal(first.result.cleared, true);
  assert.equal(first.result.damage, 2_800_000);
  assert.deepEqual(first.result.reward, { coins: 5_000, packs: 1 });
  assert.equal(first.record.clearCount, 1);
  assert.equal(first.record.currentHp, 2_800_000, 'the second daily attempt is prepared after a clear');
  const firstState = await getPersonalRaidState({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    now: firstAt
  });
  assert.equal(firstState.state.rewardKey, '2026-09-10:deadline-dragon-raid');
  assert.deepEqual(firstState.state.earnedRewards, { coins: 5_000, packs: 1 });

  await assert.rejects(() => dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 60_000,
    now: firstAt + 59_999,
    random: () => 0
  }), (error) => error.code === 'RAID_COOLDOWN' && error.details.remainingCooldownMs === 1);

  const second = await dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 60_000,
    now: firstAt + PERSONAL_RAID_COOLDOWN_MS,
    random: () => 0
  });
  assert.equal(second.record.clearCount, 2);
  assert.equal(second.record.currentHp, 0);
  assert.equal(second.record.contribution, 5_600_000);
  const secondState = await getPersonalRaidState({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    now: firstAt + PERSONAL_RAID_COOLDOWN_MS
  });
  assert.deepEqual(secondState.state.earnedRewards, { coins: 10_000, packs: 2 });

  await assert.rejects(() => dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 60_000,
    now: firstAt + (2 * PERSONAL_RAID_COOLDOWN_MS),
    random: () => 0
  }), (error) => error.code === 'DAILY_CLEAR_LIMIT');
});

test('optimistic atomic revision permits only one concurrent dispatch', async () => {
  const RaidDaily = createFakeRaidModel();
  const account = createAccount('concurrent-account');
  const now = Date.parse('2026-09-10T05:00:00.000Z');
  const requests = await Promise.allSettled([
    dispatchPersonalRaid({ TcgPersonalRaidDaily: RaidDaily, account, squadScore: 1_000, now, random: () => 0 }),
    dispatchPersonalRaid({ TcgPersonalRaidDaily: RaidDaily, account, squadScore: 1_000, now, random: () => 0 })
  ]);
  assert.equal(requests.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = requests.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'RAID_COOLDOWN');
  assert.equal(RaidDaily.records[0].dispatchCount, 1);
  assert.equal(RaidDaily.records[0].contribution, 123_250);
});

test('dispatch revalidates an attached play session immediately before committing damage', async () => {
  const RaidDaily = createFakeRaidModel();
  const account = createAccount('session-race-account');
  let checks = 0;
  await assert.rejects(() => dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 1_000,
    now: Date.parse('2026-09-10T05:30:00.000Z'),
    random: () => 0,
    validateSession: async () => {
      checks += 1;
      if (checks === 2) {
        throw new PersonalRaidError('PLAY_SESSION_LOST_FOR_TEST', 'session moved', 409);
      }
    }
  }), (error) => error.code === 'PLAY_SESSION_LOST_FOR_TEST');
  assert.equal(checks, 2);
  assert.equal(RaidDaily.records.length, 1);
  assert.equal(RaidDaily.records[0].dispatchCount, 0);
  assert.equal(RaidDaily.records[0].contribution, 0);
});

test('a new KST day gets a fresh raid state even when yesterday reached its limit', async () => {
  const RaidDaily = createFakeRaidModel();
  const account = createAccount('rollover-account');
  const beforeMidnight = Date.parse('2026-09-10T14:59:00.000Z');
  await dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 60_000,
    now: beforeMidnight,
    random: () => 0
  });
  const afterMidnight = Date.parse('2026-09-10T15:00:00.000Z');
  const nextDay = await dispatchPersonalRaid({
    TcgPersonalRaidDaily: RaidDaily,
    account,
    squadScore: 1_000,
    now: afterMidnight,
    random: () => 0
  });
  assert.equal(nextDay.window.dayKey, '2026-09-11');
  assert.equal(nextDay.record.dispatchCount, 1);
  assert.equal(RaidDaily.records.length, 2);
});

test('daily ranking returns top contributors, tie ranks, and the requesting account rank', async () => {
  const dayKey = '2026-09-10';
  const bossId = 'deadline-dragon-raid';
  const RaidDaily = createFakeRaidModel([
    { accountId: 'a', nickname: '일등', dayKey, bossId, contribution: 900, clearCount: 1, dispatchCount: 3 },
    { accountId: 'b', nickname: '공동이등', dayKey, bossId, contribution: 700, clearCount: 0, dispatchCount: 2 },
    { accountId: 'c', nickname: '나도이등', dayKey, bossId, contribution: 700, clearCount: 0, dispatchCount: 2 },
    { accountId: 'old', nickname: '어제왕', dayKey: '2026-09-09', bossId, contribution: 99_999, clearCount: 2, dispatchCount: 8 }
  ]);
  const ranking = await getPersonalRaidRanking({
    TcgPersonalRaidDaily: RaidDaily,
    account: createAccount('c', '나도이등'),
    now: Date.parse('2026-09-10T04:00:00.000Z')
  });
  assert.deepEqual(ranking.entries.map((entry) => [entry.rank, entry.nickname, entry.contribution]), [
    [1, '일등', 900],
    [2, '공동이등', 700],
    [2, '나도이등', 700]
  ]);
  assert.equal(ranking.myRank, 2);
  assert.equal(ranking.myEntry.isMe, true);
  assert.equal(ranking.resetsAt, Date.parse('2026-09-10T15:00:00.000Z'));
});

function createRaidRouteHarness({ now, random = () => 0, TcgPlayerState } = {}) {
  const account = createAccount('route-account', 'API검증');
  const RaidDaily = createFakeRaidModel();
  const routes = new Map();
  const app = {
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    put(path, handler) { routes.set(`PUT ${path}`, handler); }
  };
  const TcgAccount = {
    async findById(id) { return String(id) === String(account._id) ? account : null; },
    async exists() { return null; },
    findOne() { return { async select() { return null; } }; }
  };
  registerTcgRoutes({
    app,
    bcrypt: { hash: async () => '', compare: async () => false },
    jwt,
    jwtSecret: TEST_SECRET,
    TcgAccount,
    TcgPersonalRaidDaily: RaidDaily,
    ...(TcgPlayerState ? { TcgPlayerState } : {}),
    now,
    random
  });
  const token = jwt.sign({ sub: account._id, kind: 'tcg', tokenVersion: 0 }, TEST_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE,
    expiresIn: '1h'
  });
  return {
    RaidDaily,
    routes,
    token,
    async request(method, path, { body = {}, query = {}, authorized = true } = {}) {
      const response = {
        statusCode: 200,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        set(name, value) { this.headers[name] = value; return this; },
        json(payload) { this.payload = payload; return this; }
      };
      await routes.get(`${method} ${path}`)({
        body,
        query,
        headers: authorized ? { authorization: `Bearer ${token}` } : {},
        ip: '127.0.0.1'
      }, response);
      return response;
    }
  };
}

test('personal raid routes require auth and return state, ranking, cooldown metadata', async () => {
  let currentTime = Date.parse('2026-09-10T06:00:00.000Z');
  const harness = createRaidRouteHarness({ now: () => currentTime });
  assert.ok(harness.routes.has('GET /api/tcg/raids/personal/state'));
  assert.ok(harness.routes.has('GET /api/tcg/raids/personal/ranking'));
  assert.ok(harness.routes.has('POST /api/tcg/raids/personal/dispatch'));

  const unauthorized = await harness.request('GET', '/api/tcg/raids/personal/state', { authorized: false });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.payload.code, 'AUTH_REQUIRED');

  const initial = await harness.request('GET', '/api/tcg/raids/personal/state');
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.payload.state.id, 'deadline-dragon-raid');
  assert.equal(initial.payload.state.hp, 2_800_000);
  assert.equal(initial.payload.state.totalContribution, 0);
  assert.equal(initial.payload.state.rewardKey, '2026-09-10:deadline-dragon-raid');
  assert.deepEqual(initial.payload.state.earnedRewards, { coins: 0, packs: 0 });
  assert.equal(initial.payload.state.maxClears, 2);
  assert.equal(initial.payload.state.lastDispatchAt, 0);
  assert.equal(typeof initial.payload.state.resetsAt, 'number');
  assert.deepEqual(initial.payload.ranking.entries, []);

  const dispatched = await harness.request('POST', '/api/tcg/raids/personal/dispatch', {
    body: { bossId: 'deadline-dragon-raid', squadScore: 1_000 }
  });
  assert.equal(dispatched.statusCode, 200);
  assert.equal(dispatched.payload.result.damage, 123_250);
  assert.deepEqual(dispatched.payload.result.reward, { coins: 0, packs: 0 });
  assert.equal(dispatched.payload.ranking.myRank, 1);

  currentTime += 15_000;
  const cooldown = await harness.request('POST', '/api/tcg/raids/personal/dispatch', {
    body: { bossId: 'deadline-dragon-raid', squadScore: 1_000 }
  });
  assert.equal(cooldown.statusCode, 429);
  assert.equal(cooldown.payload.code, 'RAID_COOLDOWN');
  assert.equal(cooldown.payload.remainingCooldownMs, 45_000);
  assert.equal(cooldown.payload.retryAfterSeconds, 45);
  assert.equal(cooldown.headers['Retry-After'], '45');
});

test('leased raid dispatch is rejected when another device takes over before the raid write', async () => {
  const currentTime = Date.parse('2026-09-10T07:00:00.000Z');
  const playerState = {
    _id: 'player-state-route-account',
    accountId: 'route-account',
    initialized: true,
    revision: 4,
    state: { wallet: { coins: 100 } },
    activeLease: {
      leaseId: 'pc-lease',
      deviceId: 'pc-device',
      platform: 'pc',
      generation: 3,
      heartbeatAt: new Date(currentTime),
      expiresAt: new Date(currentTime + 45_000),
      appVersion: '0.5.0'
    }
  };
  class SwitchingPlayerState {
    static exactChecks = 0;

    static async findOne(query) {
      if (Object.prototype.hasOwnProperty.call(query, 'activeLease.leaseId')) {
        this.exactChecks += 1;
        if (this.exactChecks === 1) return clone(playerState);
        playerState.activeLease = {
          leaseId: 'android-lease',
          deviceId: 'android-device',
          platform: 'android',
          generation: 4,
          heartbeatAt: new Date(currentTime),
          expiresAt: new Date(currentTime + 45_000),
          appVersion: '0.5.0'
        };
        return null;
      }
      return clone(playerState);
    }
  }

  const harness = createRaidRouteHarness({
    now: () => currentTime,
    TcgPlayerState: SwitchingPlayerState
  });
  const response = await harness.request('POST', '/api/tcg/raids/personal/dispatch', {
    body: {
      bossId: 'deadline-dragon-raid',
      squadScore: 1_000,
      leaseId: 'pc-lease',
      deviceId: 'pc-device',
      generation: 3
    }
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.code, 'PLAY_SESSION_LOST');
  assert.equal(response.payload.activePlatform, 'android');
  assert.equal(SwitchingPlayerState.exactChecks, 2);
  assert.equal(harness.RaidDaily.records[0].dispatchCount, 0);
  assert.equal(harness.RaidDaily.records[0].contribution, 0);
});

test('state is account scoped and exposes a null rank before first contribution', async () => {
  const RaidDaily = createFakeRaidModel();
  const account = createAccount('new-account', '신입');
  const now = Date.parse('2026-09-10T08:00:00.000Z');
  const state = await getPersonalRaidState({ TcgPersonalRaidDaily: RaidDaily, account, now });
  const ranking = await getPersonalRaidRanking({ TcgPersonalRaidDaily: RaidDaily, account, now });
  assert.equal(state.state.accountId, 'new-account');
  assert.equal(state.state.canDispatch, true);
  assert.equal(ranking.myRank, null);
  assert.equal(ranking.myEntry, null);
});
