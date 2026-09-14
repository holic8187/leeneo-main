'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const TcgPlayerStateModel = require('../../src/tcg/models/TcgPlayerState');
const {
  TCG_ADMIN_TOKEN_AUDIENCE,
  TCG_ADMIN_TOKEN_ISSUER,
  registerTcgRoutes,
  signAccountToken
} = require('../../src/tcg/registerTcgRoutes');
const {
  MAX_STORED_MAILS,
  normalizeAdminMail
} = require('../../src/tcg/services/mailboxService');

const USER_SECRET = 'mailbox-user-secret-with-enough-entropy';
const ADMIN_SECRET = 'mailbox-admin-secret-with-enough-entropy';
const ADMIN_USERNAME = 'test-mail-admin';
const ADMIN_PASSWORD = 'test-mail-password';

const clone = (value) => JSON.parse(JSON.stringify(value));

function pathValue(value, pathName) {
  return String(pathName).split('.').reduce((current, key) => current?.[key], value);
}

function matchValue(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(expected, '$gt')) {
      return new Date(actual).getTime() > new Date(expected.$gt).getTime();
    }
    if (Object.prototype.hasOwnProperty.call(expected, '$lte')) {
      return new Date(actual).getTime() <= new Date(expected.$lte).getTime();
    }
    if (Object.prototype.hasOwnProperty.call(expected, '$ne')) return String(actual) !== String(expected.$ne);
    if (Object.prototype.hasOwnProperty.call(expected, '$in')) {
      return expected.$in.some((candidate) => String(actual) === String(candidate));
    }
  }
  if (expected === null) return actual == null;
  return String(actual) === String(expected);
}

function matches(record, query) {
  return Object.entries(query || {}).every(([pathName, expected]) => {
    if (pathName === '$or') return expected.some((branch) => matches(record, branch));
    if (pathName === '$and') return expected.every((branch) => matches(record, branch));
    if (pathName === '$expr') {
      const expression = expected?.$lt;
      if (!Array.isArray(expression) || expression.length !== 2) return false;
      const left = expression[0]?.$size?.$ifNull;
      return Array.isArray(left)
        && Array.isArray(record.mailbox || [])
        && record.mailbox.length < Number(expression[1]);
    }
    if (pathName === 'mailbox' && expected?.$elemMatch) {
      return (record.mailbox || []).some((entry) => matches(entry, expected.$elemMatch));
    }
    if (pathName === 'mailbox.id') {
      const ids = (record.mailbox || []).map((entry) => entry.id);
      if (expected?.$ne !== undefined) return ids.every((id) => String(id) !== String(expected.$ne));
      return ids.some((id) => matchValue(id, expected));
    }
    return matchValue(pathValue(record, pathName), expected);
  });
}

function setPath(value, pathName, nextValue) {
  const parts = String(pathName).split('.');
  let target = value;
  for (const part of parts.slice(0, -1)) {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part];
  }
  target[parts.at(-1)] = clone(nextValue);
}

function matchesArrayFilter(entry, filter = {}) {
  return Object.entries(filter).every(([pathName, expected]) => (
    matchValue(pathValue(entry, pathName.replace(/^mail\./, '')), expected)
  ));
}

function applyUpdate(record, update, options = {}) {
  const arrayFilter = options.arrayFilters?.[0] || {};
  for (const [pathName, value] of Object.entries(update.$set || {})) {
    if (pathName.startsWith('mailbox.$[mail].')) {
      const nestedPath = pathName.slice('mailbox.$[mail].'.length);
      for (const entry of record.mailbox || []) {
        if (matchesArrayFilter(entry, arrayFilter)) setPath(entry, nestedPath, value);
      }
    } else {
      setPath(record, pathName, value);
    }
  }
  for (const [pathName, amount] of Object.entries(update.$inc || {})) {
    setPath(record, pathName, Number(pathValue(record, pathName) || 0) + Number(amount));
  }
  for (const [pathName, predicate] of Object.entries(update.$pull || {})) {
    if (!Array.isArray(record[pathName])) continue;
    record[pathName] = record[pathName].filter((entry) => !matches(entry, predicate));
  }
  for (const [pathName, value] of Object.entries(update.$push || {})) {
    if (!Array.isArray(record[pathName])) record[pathName] = [];
    if (value && Array.isArray(value.$each)) {
      record[pathName].push(...value.$each.map(clone));
      if (Number.isInteger(value.$slice)) {
        record[pathName] = value.$slice < 0
          ? record[pathName].slice(value.$slice)
          : record[pathName].slice(0, value.$slice);
      }
    } else {
      record[pathName].push(clone(value));
    }
  }
}

function createFakePlayerStateModel(seed = []) {
  const records = seed.map(clone);
  let nextId = records.length + 1;
  return class FakePlayerState {
    static records = records;

    static async findOne(query) {
      const record = records.find((candidate) => matches(candidate, query));
      return record ? clone(record) : null;
    }

    static async updateOne(query, update, options = {}) {
      let record = records.find((candidate) => matches(candidate, query));
      if (!record && options.upsert) {
        record = {
          _id: `player-state-${nextId++}`,
          ...(update.$setOnInsert ? clone(update.$setOnInsert) : {})
        };
        records.push(record);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      if (!record) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      const hasMutation = Boolean(update.$set || update.$inc || update.$push || update.$pull);
      if (hasMutation) applyUpdate(record, update, options);
      return { acknowledged: true, matchedCount: 1, modifiedCount: hasMutation ? 1 : 0 };
    }

    static async findOneAndUpdate(query, update, options = {}) {
      const record = records.find((candidate) => matches(candidate, query));
      if (!record) return null;
      applyUpdate(record, update, options);
      return clone(record);
    }
  };
}

function createQuery(value) {
  let result = value;
  return {
    select() { return this; },
    sort(sortBy) {
      if (Array.isArray(result)) {
        const keys = Object.keys(sortBy || {});
        result = [...result].sort((left, right) => {
          for (const key of keys) {
            const comparison = String(left[key] || '').localeCompare(String(right[key] || ''), 'ko');
            if (comparison) return comparison * Number(sortBy[key] || 1);
          }
          return 0;
        });
      }
      return this;
    },
    lean() { return Promise.resolve(clone(result)); },
    then(resolve, reject) { return Promise.resolve(clone(result)).then(resolve, reject); }
  };
}

function createHarness() {
  const nowMs = Date.parse('2026-09-14T03:00:00.000Z');
  const accounts = [
    {
      _id: 'account-mail-1', username: 'mailone', nickname: '우편하나',
      status: 'active', tokenVersion: 0, createdAt: new Date(nowMs - 1000)
    },
    {
      _id: 'account-mail-2', username: 'mailtwo', nickname: '우편둘',
      status: 'active', tokenVersion: 0, createdAt: new Date(nowMs - 1000)
    }
  ];
  const TcgAccount = {
    find(query = {}) {
      return createQuery(accounts.filter((account) => (
        !query.status || account.status === query.status
      )));
    },
    findById(id) {
      return createQuery(accounts.find((account) => String(account._id) === String(id)) || null);
    }
  };
  const TcgPlayerState = createFakePlayerStateModel([{
    _id: 'player-state-1',
    accountId: accounts[0]._id,
    state: { wallet: { coins: 25 }, packs: { standard: 1 }, collection: {} },
    revision: 4,
    initialized: true,
    mailbox: [],
    activeLease: {
      leaseId: 'lease-mail-1',
      deviceId: 'device-mail-1',
      platform: 'pc',
      generation: 2,
      heartbeatAt: new Date(nowMs),
      expiresAt: new Date(nowMs + 30_000),
      appVersion: '0.7.0'
    }
  }]);
  const routes = new Map();
  const app = {
    get(route, handler) { routes.set(`GET ${route}`, handler); },
    post(route, handler) { routes.set(`POST ${route}`, handler); },
    put(route, handler) { routes.set(`PUT ${route}`, handler); }
  };
  const bcrypt = {
    async hash(value) { return `hash:${value}`; },
    async compare(value, hash) { return hash === `hash:${value}`; }
  };
  registerTcgRoutes({
    app,
    bcrypt,
    jwt,
    jwtSecret: USER_SECRET,
    adminUsername: ADMIN_USERNAME,
    adminPasswordHash: `hash:${ADMIN_PASSWORD}`,
    adminJwtSecret: ADMIN_SECRET,
    TcgAccount,
    TcgPersonalRaidDaily: {},
    TcgPlayerState,
    now: () => nowMs
  });
  const userToken = signAccountToken(accounts[0], jwt, USER_SECRET, null);

  return {
    accounts,
    routes,
    TcgPlayerState,
    userToken,
    nowMs,
    async request(method, route, { body = {}, bearer = '' } = {}) {
      const handler = routes.get(`${method} ${route}`);
      assert.ok(handler, `missing route: ${method} ${route}`);
      const response = {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        set() { return this; },
        json(payload) { this.payload = payload; return this; }
      };
      await handler({
        body,
        query: {},
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
        ip: '127.0.0.1'
      }, response);
      return response;
    }
  };
}

test('TCG player state embeds server-owned mailbox rewards and claim timestamps', () => {
  assert.equal(TcgPlayerStateModel.schema.path('mailbox').instance, 'Array');
  assert.equal(TcgPlayerStateModel.schema.path('mailbox.rewards.coins').options.min, 0);
  assert.equal(TcgPlayerStateModel.schema.path('mailbox.rewards.standardPacks').options.min, 0);
  assert.equal(TcgPlayerStateModel.schema.path('mailbox.claimedAt').options.default, null);
});

test('admin credentials remain server-only and admin tokens use a separate audience', async () => {
  const harness = createHarness();
  const sourceFiles = [
    path.join(__dirname, '../../src/tcg/registerTcgRoutes.js'),
    path.join(__dirname, '../../src/tcg/services/mailboxService.js')
  ].map((filename) => fs.readFileSync(filename, 'utf8')).join('\n');
  assert.equal(sourceFiles.includes('dinguree1'), false);

  const rejected = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: 'wrong-password' }
  });
  assert.equal(rejected.statusCode, 401);
  assert.equal(rejected.payload.code, 'INVALID_ADMIN_CREDENTIALS');

  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME.toUpperCase(), password: ADMIN_PASSWORD }
  });
  assert.equal(login.statusCode, 200);
  assert.ok(login.payload.token);
  const payload = jwt.verify(login.payload.token, ADMIN_SECRET, {
    issuer: TCG_ADMIN_TOKEN_ISSUER,
    audience: TCG_ADMIN_TOKEN_AUDIENCE
  });
  assert.equal(payload.kind, 'tcg-admin');
  assert.equal(payload.sub, ADMIN_USERNAME);

  const userTokenRejected = await harness.request('GET', '/api/tcg/admin/users', {
    bearer: harness.userToken
  });
  assert.equal(userTokenRejected.statusCode, 401);
});

test('admin mail can be sent once, read, and atomically claimed into cloud state', async () => {
  const harness = createHarness();
  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const adminToken = login.payload.token;
  const sendBody = {
    requestId: 'mail-request-0001',
    targetMode: 'single',
    targetAccountId: harness.accounts[0]._id,
    title: '점검 보상',
    message: '기다려주셔서 감사합니다.',
    rewards: { coins: 500, standardPacks: 2 }
  };
  const sent = await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: adminToken,
    body: sendBody
  });
  assert.equal(sent.statusCode, 200);
  assert.equal(sent.payload.deliveredCount, 1);
  assert.equal(sent.payload.newlyDeliveredCount, 1);
  assert.equal(sent.payload.mail.rewards.coins, 500);

  const repeated = await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: adminToken,
    body: sendBody
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.payload.newlyDeliveredCount, 0);

  const listed = await harness.request('GET', '/api/tcg/mail', { bearer: harness.userToken });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.payload.pendingCount, 1);
  assert.equal(listed.payload.unreadCount, 1);
  const mailId = listed.payload.mails[0].id;

  const read = await harness.request('POST', '/api/tcg/mail/read', {
    bearer: harness.userToken,
    body: { mailId }
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.payload.unreadCount, 0);

  const claimed = await harness.request('POST', '/api/tcg/mail/claim', {
    bearer: harness.userToken,
    body: {
      mailId,
      leaseId: 'lease-mail-1',
      deviceId: 'device-mail-1',
      generation: 2,
      baseRevision: 4
    }
  });
  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.payload.claimedCount, 1);
  assert.equal(claimed.payload.revision, 5);
  assert.equal(claimed.payload.state.wallet.coins, 525);
  assert.equal(claimed.payload.state.packs.standard, 3);
  assert.equal(claimed.payload.mails[0].status, 'claimed');

  const repeatedClaim = await harness.request('POST', '/api/tcg/mail/claim', {
    bearer: harness.userToken,
    body: {
      mailId,
      leaseId: 'lease-mail-1',
      deviceId: 'device-mail-1',
      generation: 2,
      baseRevision: 5
    }
  });
  assert.equal(repeatedClaim.statusCode, 409);
  assert.equal(repeatedClaim.payload.code, 'MAIL_ALREADY_CLAIMED');
  const record = harness.TcgPlayerState.records[0];
  assert.equal(record.state.wallet.coins, 525);
  assert.equal(record.state.packs.standard, 3);
});

test('claim requires the active lease and exact cloud revision', async () => {
  const harness = createHarness();
  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: login.payload.token,
    body: {
      requestId: 'mail-request-0002',
      targetMode: 'single',
      targetAccountId: harness.accounts[0]._id,
      title: '보상',
      rewards: { coins: 10, standardPacks: 1 }
    }
  });
  const mailId = (await harness.request('GET', '/api/tcg/mail', {
    bearer: harness.userToken
  })).payload.mails[0].id;

  const stale = await harness.request('POST', '/api/tcg/mail/claim', {
    bearer: harness.userToken,
    body: {
      mailId,
      leaseId: 'lease-mail-1',
      deviceId: 'device-mail-1',
      generation: 2,
      baseRevision: 3
    }
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.payload.code, 'SAVE_CONFLICT');

  const otherDevice = await harness.request('POST', '/api/tcg/mail/claim', {
    bearer: harness.userToken,
    body: {
      mailId,
      leaseId: 'lease-mail-1',
      deviceId: 'another-device',
      generation: 2,
      baseRevision: 4
    }
  });
  assert.equal(otherDevice.statusCode, 409);
  assert.equal(otherDevice.payload.code, 'PLAY_SESSION_LOST');
  assert.equal(harness.TcgPlayerState.records[0].state.wallet.coins, 25);
  assert.equal(harness.TcgPlayerState.records[0].mailbox[0].claimedAt, null);
});

test('all-recipient delivery initializes unopened accounts without overwriting game state', async () => {
  const harness = createHarness();
  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const sent = await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: login.payload.token,
    body: {
      requestId: 'mail-request-all-1',
      targetMode: 'all',
      title: '전체 보상',
      rewards: { coins: 100, standardPacks: 1 }
    }
  });
  assert.equal(sent.statusCode, 200);
  assert.equal(sent.payload.deliveredCount, 2);
  assert.equal(harness.TcgPlayerState.records.length, 2);
  assert.equal(harness.TcgPlayerState.records[0].state.wallet.coins, 25);
  const unopened = harness.TcgPlayerState.records.find((record) => record.accountId === 'account-mail-2');
  assert.equal(unopened.initialized, false);
  assert.equal(unopened.state, null);
  assert.equal(unopened.mailbox.length, 1);
});

test('mail delivery prunes terminal entries but preserves every pending mail', async () => {
  const harness = createHarness();
  const record = harness.TcgPlayerState.records[0];
  const pendingMails = Array.from({ length: MAX_STORED_MAILS - 1 }, (_, index) => normalizeAdminMail({
    requestId: `pending-${String(index).padStart(3, '0')}`,
    title: `대기 우편 ${index}`,
    message: '아직 수령하지 않은 우편입니다.',
    rewards: { coins: 1 },
  }, harness.nowMs - index * 1000));
  const claimedMail = normalizeAdminMail({
    requestId: 'claimed-0001',
    title: '이미 받은 우편',
    message: '정리 대상입니다.',
    rewards: { coins: 1 },
  }, harness.nowMs - 100_000);
  claimedMail.claimedAt = new Date(harness.nowMs - 50_000);
  record.mailbox = [...pendingMails, claimedMail];

  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const sent = await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: login.payload.token,
    body: {
      requestId: 'pending-new-001',
      targetMode: 'single',
      targetAccountId: harness.accounts[0]._id,
      title: '새 우편',
      message: '새 우편입니다.',
      rewards: { coins: 5 }
    }
  });

  assert.equal(sent.statusCode, 200);
  assert.equal(record.mailbox.length, MAX_STORED_MAILS);
  assert.equal(record.mailbox.some((mail) => mail.id === claimedMail.id), false);
  assert.equal(record.mailbox.filter((mail) => !mail.claimedAt).length, MAX_STORED_MAILS);
  assert.equal(record.mailbox.some((mail) => mail.id === 'admin:pending-new-001'), true);
  for (const mail of pendingMails) assert.equal(record.mailbox.some((entry) => entry.id === mail.id), true);
});

test('mail delivery rejects a full mailbox instead of deleting pending mail', async () => {
  const harness = createHarness();
  const record = harness.TcgPlayerState.records[0];
  record.mailbox = Array.from({ length: MAX_STORED_MAILS }, (_, index) => normalizeAdminMail({
    requestId: `full-${String(index).padStart(3, '0')}`,
    title: `대기 우편 ${index}`,
    message: '수령 전 우편입니다.',
    rewards: { coins: 1 },
  }, harness.nowMs - index * 1000));
  const idsBefore = record.mailbox.map((mail) => mail.id);

  const login = await harness.request('POST', '/api/tcg/admin/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const sent = await harness.request('POST', '/api/tcg/admin/mail/send', {
    bearer: login.payload.token,
    body: {
      requestId: 'full-new-001',
      targetMode: 'single',
      targetAccountId: harness.accounts[0]._id,
      title: '가득 찬 우편함 테스트',
      message: '미수령 우편을 보존해야 합니다.',
      rewards: { coins: 5 }
    }
  });

  assert.equal(sent.statusCode, 409);
  assert.equal(sent.payload.code, 'MAILBOX_FULL');
  assert.deepEqual(record.mailbox.map((mail) => mail.id), idsBefore);
  assert.equal(record.mailbox.length, MAX_STORED_MAILS);
});
