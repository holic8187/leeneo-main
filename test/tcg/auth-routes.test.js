'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const TcgAccountModel = require('../../src/tcg/models/TcgAccount');
const {
  TCG_TOKEN_AUDIENCE,
  TCG_TOKEN_ISSUER,
  canonicalizeIdentity,
  createIpRateLimiter,
  registerTcgRoutes,
  validateNickname,
  validatePassword,
  validateRegistrationPayload
} = require('../../src/tcg/registerTcgRoutes');

const JWT_SECRET = 'tcg-test-secret-with-enough-entropy';

const fakeBcrypt = {
  async hash(value, rounds) {
    assert.equal(rounds, 10);
    return `hash:${value}`;
  },
  async compare(value, hash) {
    return hash === `hash:${value}`;
  }
};

function createFakeAccountModel(seed = [], options = {}) {
  const records = [];
  let nextId = 1;
  let throwDuplicateOnNextInsert = Boolean(options.throwDuplicateOnNextInsert);

  class FakeAccount {
    constructor(fields = {}) {
      Object.assign(this, fields);
      this._id ||= `account-${nextId++}`;
      this.createdAt ||= new Date('2026-09-09T00:00:00.000Z');
    }

    async save() {
      if (!records.includes(this)) {
        if (throwDuplicateOnNextInsert) {
          throwDuplicateOnNextInsert = false;
          const error = new Error('duplicate key nicknameCanonical');
          error.code = 11000;
          error.keyPattern = { nicknameCanonical: 1 };
          throw error;
        }
        records.push(this);
      }
      return this;
    }

    static async exists(query) {
      return records.some((record) => Object.entries(query).every(([key, value]) => record[key] === value))
        ? { _id: 'existing' }
        : null;
    }

    static findOne(query) {
      const account = records.find((record) => (
        Object.entries(query).every(([key, value]) => record[key] === value)
      )) || null;
      return {
        async select() {
          return account;
        }
      };
    }

    static async findById(id) {
      return records.find((record) => String(record._id) === String(id)) || null;
    }
  }

  for (const entry of seed) {
    records.push(new FakeAccount({
      status: 'active',
      tokenVersion: 0,
      ...entry
    }));
  }

  FakeAccount.records = records;
  return FakeAccount;
}

function createRouteHarness(TcgAccount, options = {}) {
  const routes = new Map();
  const app = {
    post(path, handler) {
      routes.set(`POST ${path}`, handler);
    },
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    }
  };
  registerTcgRoutes({
    app,
    bcrypt: fakeBcrypt,
    jwt,
    jwtSecret: JWT_SECRET,
    TcgAccount,
    ...options
  });

  return {
    routes,
    async request(method, path, { body = {}, headers = {}, ip = '127.0.0.1' } = {}) {
      const handler = routes.get(`${method} ${path}`);
      assert.ok(handler, `missing route: ${method} ${path}`);
      const response = {
        statusCode: 200,
        payload: undefined,
        headers: {},
        status(code) {
          this.statusCode = code;
          return this;
        },
        set(name, value) {
          this.headers[name] = value;
          return this;
        },
        json(payload) {
          this.payload = payload;
          return this;
        }
      };
      await handler({ body, headers, ip }, response);
      return response;
    }
  };
}

test('TCG account model keeps canonical identities unique and password hashes private', () => {
  assert.equal(TcgAccountModel.schema.path('usernameCanonical').options.unique, true);
  assert.equal(TcgAccountModel.schema.path('nicknameCanonical').options.unique, true);
  assert.equal(TcgAccountModel.schema.path('passwordHash').options.select, false);
  assert.equal(TcgAccountModel.schema.options.collection, 'tcg_accounts');
});

test('registration validation canonicalizes case and enforces nickname and bcrypt byte limits', () => {
  const composed = 'café12';
  const result = validateRegistrationPayload({
    username: ' Employee_01 ',
    nickname: ' 새싹A ',
    password: composed,
    passwordConfirm: composed.normalize('NFD')
  });
  assert.equal(result.valid, true);
  assert.equal(result.usernameCanonical, 'employee_01');
  assert.equal(result.nicknameCanonical, '새싹a');
  assert.equal(validateNickname('한글_Ab12'), '');
  assert.notEqual(validateNickname('공백 닉네임'), '');
  assert.notEqual(validatePassword('가'.repeat(25)), '');
  assert.equal(canonicalizeIdentity(' Nick_NAME '), 'nick_name');
});

test('all four TCG authentication routes are registered', () => {
  const harness = createRouteHarness(createFakeAccountModel());
  assert.deepEqual([...harness.routes.keys()], [
    'POST /api/tcg/auth/check-availability',
    'POST /api/tcg/auth/register',
    'POST /api/tcg/auth/login',
    'GET /api/tcg/auth/me'
  ]);
});

test('availability checks username and nickname case-insensitively in either request shape', async () => {
  const Account = createFakeAccountModel([{
    username: 'Employee01',
    usernameCanonical: 'employee01',
    nickname: 'CardHero',
    nicknameCanonical: 'cardhero',
    passwordHash: 'hash:secret12'
  }]);
  const harness = createRouteHarness(Account);
  const both = await harness.request('POST', '/api/tcg/auth/check-availability', {
    body: { username: 'EMPLOYEE01', nickname: 'cardHERO' }
  });
  assert.equal(both.statusCode, 200);
  assert.equal(both.payload.username.available, false);
  assert.equal(both.payload.nickname.available, false);

  const single = await harness.request('POST', '/api/tcg/auth/check-availability', {
    body: { field: 'nickname', value: '새닉네임' }
  });
  assert.deepEqual(single.payload, {
    field: 'nickname',
    value: '새닉네임',
    valid: true,
    available: true,
    message: ''
  });
});

test('register rechecks both canonical identities and returns a scoped TCG token', async () => {
  const Account = createFakeAccountModel();
  const harness = createRouteHarness(Account);
  const registered = await harness.request('POST', '/api/tcg/auth/register', {
    body: {
      username: 'Employee_02',
      nickname: '카드대리',
      password: 'secret12',
      passwordConfirm: 'secret12'
    }
  });
  assert.equal(registered.statusCode, 201);
  assert.deepEqual(registered.payload.account, {
    id: 'account-1',
    username: 'Employee_02',
    nickname: '카드대리',
    createdAt: new Date('2026-09-09T00:00:00.000Z')
  });
  assert.equal(Object.hasOwn(registered.payload.account, 'passwordHash'), false);
  assert.equal(Account.records[0].usernameCanonical, 'employee_02');
  assert.equal(Account.records[0].nicknameCanonical, '카드대리');
  assert.equal(Account.records[0].passwordHash, 'hash:secret12');

  const payload = jwt.verify(registered.payload.token, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE
  });
  assert.equal(payload.sub, 'account-1');
  assert.equal(payload.kind, 'tcg');
  assert.equal(payload.tokenVersion, 0);
  assert.equal(Object.hasOwn(payload, 'id'), false);

  const duplicate = await harness.request('POST', '/api/tcg/auth/register', {
    body: {
      username: 'employee_02',
      nickname: '다른닉네임',
      password: 'secret12',
      passwordConfirm: 'secret12'
    }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.deepEqual(duplicate.payload.fields, ['username']);
});

test('register converts a final Mongo unique-index race into a field conflict', async () => {
  const Account = createFakeAccountModel([], { throwDuplicateOnNextInsert: true });
  const harness = createRouteHarness(Account);
  const response = await harness.request('POST', '/api/tcg/auth/register', {
    body: {
      username: 'employee03',
      nickname: '세번째사원',
      password: 'secret12',
      passwordConfirm: 'secret12'
    }
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.code, 'DUPLICATE_NICKNAME');
  assert.deepEqual(response.payload.fields, ['nickname']);
});

test('login is case-insensitive, returns generic credential failures, and updates last login', async () => {
  const Account = createFakeAccountModel([{
    _id: 'login-account',
    username: 'Employee04',
    usernameCanonical: 'employee04',
    nickname: '로그인사원',
    nicknameCanonical: '로그인사원',
    passwordHash: 'hash:secret12'
  }]);
  const harness = createRouteHarness(Account);
  const rejected = await harness.request('POST', '/api/tcg/auth/login', {
    body: { username: 'missing', password: 'secret12' }
  });
  assert.equal(rejected.statusCode, 401);
  assert.equal(rejected.payload.code, 'INVALID_CREDENTIALS');

  const accepted = await harness.request('POST', '/api/tcg/auth/login', {
    body: { username: 'EMPLOYEE04', password: 'secret12' }
  });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.payload.account.id, 'login-account');
  assert.ok(Account.records[0].lastLoginAt instanceof Date);
});

test('login rejects passwords over 72 bytes before bcrypt can truncate them', async () => {
  const seventyTwoBytes = 'a'.repeat(72);
  const Account = createFakeAccountModel([{
    _id: 'long-password-account',
    username: 'employee06',
    usernameCanonical: 'employee06',
    nickname: '긴암호사원',
    nicknameCanonical: '긴암호사원',
    passwordHash: `hash:${seventyTwoBytes}`
  }]);
  let compareCalls = 0;
  const truncatingBcrypt = {
    ...fakeBcrypt,
    async compare(value, hash) {
      compareCalls += 1;
      return hash === `hash:${Buffer.from(value, 'utf8').subarray(0, 72).toString('utf8')}`;
    }
  };
  const harness = createRouteHarness(Account, { bcrypt: truncatingBcrypt });
  const response = await harness.request('POST', '/api/tcg/auth/login', {
    body: { username: 'employee06', password: `${seventyTwoBytes}x` }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.code, 'INVALID_CREDENTIALS');
  assert.equal(compareCalls, 0);
});

test('me accepts only current TCG tokens and rejects legacy, wrong-version, and disabled sessions', async () => {
  const Account = createFakeAccountModel([{
    _id: 'me-account',
    username: 'employee05',
    usernameCanonical: 'employee05',
    nickname: '조회사원',
    nicknameCanonical: '조회사원',
    passwordHash: 'hash:secret12',
    tokenVersion: 2
  }]);
  const harness = createRouteHarness(Account);
  const legacyToken = jwt.sign({ id: 'me-account' }, JWT_SECRET, { expiresIn: '1d' });
  const legacy = await harness.request('GET', '/api/tcg/auth/me', {
    headers: { authorization: `Bearer ${legacyToken}` }
  });
  assert.equal(legacy.statusCode, 401);

  const staleToken = jwt.sign({ sub: 'me-account', kind: 'tcg', tokenVersion: 1 }, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE,
    expiresIn: '1d'
  });
  const stale = await harness.request('GET', '/api/tcg/auth/me', {
    headers: { authorization: `Bearer ${staleToken}` }
  });
  assert.equal(stale.statusCode, 401);

  const currentToken = jwt.sign({ sub: 'me-account', kind: 'tcg', tokenVersion: 2 }, JWT_SECRET, {
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE,
    expiresIn: '1d'
  });
  const current = await harness.request('GET', '/api/tcg/auth/me', {
    headers: { authorization: `Bearer ${currentToken}` }
  });
  assert.equal(current.statusCode, 200);
  assert.equal(current.payload.account.nickname, '조회사원');

  Account.records[0].status = 'disabled';
  const disabled = await harness.request('GET', '/api/tcg/auth/me', {
    headers: { authorization: `Bearer ${currentToken}` }
  });
  assert.equal(disabled.statusCode, 403);
  assert.equal(disabled.payload.code, 'ACCOUNT_DISABLED');
});

test('IP rate limiter returns retry metadata and resets after its window', () => {
  let currentTime = 1_000;
  const limiter = createIpRateLimiter({ windowMs: 1_000, max: 2, now: () => currentTime });
  const req = { ip: '192.0.2.10' };
  const responses = [];
  const createResponse = () => ({
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(payload) { this.payload = payload; responses.push(payload); return this; }
  });
  assert.equal(limiter(req, createResponse()), true);
  assert.equal(limiter(req, createResponse()), true);
  const limitedResponse = createResponse();
  assert.equal(limiter(req, limitedResponse), false);
  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.headers['Retry-After'], '1');
  assert.equal(responses[0].code, 'RATE_LIMITED');
  currentTime = 2_001;
  assert.equal(limiter(req, createResponse()), true);
});
