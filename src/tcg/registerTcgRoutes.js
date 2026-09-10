'use strict';

const DefaultTcgAccount = require('./models/TcgAccount');
const DefaultTcgPersonalRaidDaily = require('./models/TcgPersonalRaidDaily');
const {
  PersonalRaidError,
  dispatchPersonalRaid,
  getPersonalRaidRanking,
  getPersonalRaidState,
  serializePersonalRaidState
} = require('./services/personalRaidService');

const TCG_TOKEN_KIND = 'tcg';
const TCG_TOKEN_ISSUER = 'working-hoi-server';
const TCG_TOKEN_AUDIENCE = 'hoi-card-desk';
const DEFAULT_TOKEN_EXPIRES_IN = '7d';
const MAX_RATE_LIMIT_KEYS = 10_000;
const DEFAULT_RATE_LIMITS = Object.freeze({
  availability: Object.freeze({ windowMs: 60_000, max: 60 }),
  register: Object.freeze({ windowMs: 10 * 60_000, max: 8 }),
  login: Object.freeze({ windowMs: 5 * 60_000, max: 20 })
});

function normalizeUsername(value = '') {
  return String(value).normalize('NFKC').trim();
}

function normalizeNickname(value = '') {
  return String(value).normalize('NFKC').trim();
}

function canonicalizeIdentity(value = '') {
  return String(value).normalize('NFKC').trim().toLowerCase();
}

function normalizePasswordInput(value = '') {
  return String(value).normalize('NFC');
}

function validateUsername(username) {
  return /^[A-Za-z0-9_]{3,24}$/.test(username)
    ? ''
    : '아이디는 영문, 숫자, 밑줄을 사용해 3~24자로 입력해주세요.';
}

function validateNickname(nickname) {
  return /^[가-힣A-Za-z0-9_]{2,12}$/u.test(nickname)
    ? ''
    : '닉네임은 한글, 영문, 숫자, 밑줄을 사용해 2~12자로 입력해주세요.';
}

function validatePassword(password) {
  if (password.length < 6) return '비밀번호는 6자 이상 입력해주세요.';
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return '비밀번호는 UTF-8 기준 72바이트 이하로 입력해주세요.';
  }
  return '';
}

function validateRegistrationPayload(payload = {}) {
  const username = normalizeUsername(payload.username);
  const nickname = normalizeNickname(payload.nickname);
  const password = normalizePasswordInput(payload.password);
  const passwordConfirm = normalizePasswordInput(payload.passwordConfirm);
  const usernameError = validateUsername(username);
  if (usernameError) return { valid: false, field: 'username', message: usernameError };
  const nicknameError = validateNickname(nickname);
  if (nicknameError) return { valid: false, field: 'nickname', message: nicknameError };
  const passwordError = validatePassword(password);
  if (passwordError) return { valid: false, field: 'password', message: passwordError };
  if (password !== passwordConfirm) {
    return { valid: false, field: 'passwordConfirm', message: '비밀번호 확인이 일치하지 않습니다.' };
  }
  return {
    valid: true,
    username,
    usernameCanonical: canonicalizeIdentity(username),
    nickname,
    nicknameCanonical: canonicalizeIdentity(nickname),
    password
  };
}

function getBearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || '').trim());
  return match ? match[1].trim() : null;
}

function getRequestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function createIpRateLimiter(options = {}) {
  const windowMs = Math.max(1, Number(options.windowMs) || 60_000);
  const maximum = Math.max(1, Math.floor(Number(options.max) || 10));
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const buckets = new Map();
  let nextSweepAt = now() + windowMs;

  function sweepExpired(currentTime) {
    if (currentTime < nextSweepAt && buckets.size < MAX_RATE_LIMIT_KEYS) return;
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= currentTime) buckets.delete(key);
    }
    while (buckets.size >= MAX_RATE_LIMIT_KEYS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
    nextSweepAt = currentTime + windowMs;
  }

  return function checkRateLimit(req, res) {
    const currentTime = now();
    sweepExpired(currentTime);
    const key = getRequestIp(req);
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count <= maximum) return true;
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
    if (typeof res.set === 'function') res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      code: 'RATE_LIMITED',
      msg: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfterSeconds
    });
    return false;
  };
}

function serializeAccount(account) {
  return {
    id: String(account?._id || account?.id || ''),
    username: String(account?.username || ''),
    nickname: String(account?.nickname || ''),
    createdAt: account?.createdAt || null
  };
}

async function inspectAvailability(TcgAccount, values = {}) {
  const hasUsername = Object.prototype.hasOwnProperty.call(values, 'username');
  const hasNickname = Object.prototype.hasOwnProperty.call(values, 'nickname');
  const username = hasUsername ? normalizeUsername(values.username) : '';
  const nickname = hasNickname ? normalizeNickname(values.nickname) : '';
  const usernameMessage = hasUsername ? validateUsername(username) : '';
  const nicknameMessage = hasNickname ? validateNickname(nickname) : '';
  const [usernameDuplicate, nicknameDuplicate] = await Promise.all([
    hasUsername && !usernameMessage
      ? TcgAccount.exists({ usernameCanonical: canonicalizeIdentity(username) })
      : null,
    hasNickname && !nicknameMessage
      ? TcgAccount.exists({ nicknameCanonical: canonicalizeIdentity(nickname) })
      : null
  ]);

  return {
    username: hasUsername ? {
      value: username,
      valid: !usernameMessage,
      available: !usernameMessage && !usernameDuplicate,
      message: usernameMessage || (usernameDuplicate ? '이미 사용 중인 아이디입니다.' : '')
    } : null,
    nickname: hasNickname ? {
      value: nickname,
      valid: !nicknameMessage,
      available: !nicknameMessage && !nicknameDuplicate,
      message: nicknameMessage || (nicknameDuplicate ? '이미 사용 중인 닉네임입니다.' : '')
    } : null
  };
}

function duplicateResponse(fields) {
  const uniqueFields = [...new Set(fields)];
  let message = '이미 사용 중인 아이디 또는 닉네임입니다.';
  if (uniqueFields.length === 1 && uniqueFields[0] === 'username') message = '이미 사용 중인 아이디입니다.';
  if (uniqueFields.length === 1 && uniqueFields[0] === 'nickname') message = '이미 사용 중인 닉네임입니다.';
  return {
    code: uniqueFields.length === 1
      ? `DUPLICATE_${uniqueFields[0].toUpperCase()}`
      : 'DUPLICATE_ACCOUNT_FIELDS',
    fields: uniqueFields,
    msg: message
  };
}

function getMongoDuplicateFields(error) {
  if (error?.code !== 11000) return [];
  const keys = new Set([
    ...Object.keys(error.keyPattern || {}),
    ...Object.keys(error.keyValue || {})
  ]);
  const message = String(error?.message || '');
  const fields = [];
  if (keys.has('usernameCanonical') || message.includes('usernameCanonical')) fields.push('username');
  if (keys.has('nicknameCanonical') || message.includes('nicknameCanonical')) fields.push('nickname');
  return fields.length ? fields : ['username', 'nickname'];
}

function signAccountToken(account, jwt, jwtSecret, expiresIn) {
  return jwt.sign({
    sub: String(account._id || account.id),
    kind: TCG_TOKEN_KIND,
    tokenVersion: Math.max(0, Number(account.tokenVersion) || 0)
  }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn,
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE
  });
}

function registerTcgRoutes({
  app,
  bcrypt,
  jwt,
  jwtSecret,
  tokenExpiresIn = DEFAULT_TOKEN_EXPIRES_IN,
  rateLimitOptions = {},
  TcgAccount = DefaultTcgAccount,
  TcgPersonalRaidDaily = DefaultTcgPersonalRaidDaily,
  now = Date.now,
  random = undefined
}) {
  if (!app || !bcrypt || !jwt || !jwtSecret || !TcgAccount || !TcgPersonalRaidDaily) {
    throw new Error('TCG authentication dependencies are not configured.');
  }
  const availabilityRateLimit = createIpRateLimiter({
    ...DEFAULT_RATE_LIMITS.availability,
    ...(rateLimitOptions.availability || {})
  });
  const registerRateLimit = createIpRateLimiter({
    ...DEFAULT_RATE_LIMITS.register,
    ...(rateLimitOptions.register || {})
  });
  const loginRateLimit = createIpRateLimiter({
    ...DEFAULT_RATE_LIMITS.login,
    ...(rateLimitOptions.login || {})
  });

  async function requireTcgAccount(req, res) {
    try {
      const token = getBearerToken(req);
      if (!token) {
        res.status(401).json({ code: 'AUTH_REQUIRED', msg: '로그인이 필요합니다.' });
        return null;
      }
      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        issuer: TCG_TOKEN_ISSUER,
        audience: TCG_TOKEN_AUDIENCE
      });
      if (!payload?.sub || payload.kind !== TCG_TOKEN_KIND) {
        res.status(401).json({ code: 'INVALID_TOKEN', msg: '로그인 정보가 올바르지 않습니다.' });
        return null;
      }
      const account = await TcgAccount.findById(payload.sub);
      if (!account || Number(account.tokenVersion || 0) !== Number(payload.tokenVersion || 0)) {
        res.status(401).json({ code: 'INVALID_TOKEN', msg: '로그인이 만료되었습니다.' });
        return null;
      }
      if (account.status !== 'active') {
        res.status(403).json({ code: 'ACCOUNT_DISABLED', msg: '사용할 수 없는 계정입니다.' });
        return null;
      }
      return account;
    } catch (error) {
      res.status(401).json({ code: 'INVALID_TOKEN', msg: '로그인이 만료되었습니다.' });
      return null;
    }
  }

  app.post('/api/tcg/auth/check-availability', async (req, res) => {
    if (!availabilityRateLimit(req, res)) return;
    try {
      const requestedField = String(req.body?.field || '').trim();
      if (requestedField && !['username', 'nickname'].includes(requestedField)) {
        return res.status(400).json({ msg: '확인할 항목이 올바르지 않습니다.' });
      }
      const values = requestedField
        ? { [requestedField]: req.body?.value }
        : (req.body || {});
      const hasUsername = Object.prototype.hasOwnProperty.call(values, 'username');
      const hasNickname = Object.prototype.hasOwnProperty.call(values, 'nickname');
      if (!hasUsername && !hasNickname) {
        return res.status(400).json({ msg: '확인할 아이디 또는 닉네임을 입력해주세요.' });
      }
      const availability = await inspectAvailability(TcgAccount, values);
      if (requestedField) {
        return res.json({ field: requestedField, ...availability[requestedField] });
      }
      return res.json(availability);
    } catch (error) {
      console.error('TCG account availability error:', error);
      return res.status(500).json({ msg: '중복 여부를 확인하지 못했습니다.' });
    }
  });

  app.post('/api/tcg/auth/register', async (req, res) => {
    if (!registerRateLimit(req, res)) return;
    try {
      const validation = validateRegistrationPayload(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          code: `INVALID_${validation.field.toUpperCase()}`,
          field: validation.field,
          msg: validation.message
        });
      }

      const availability = await inspectAvailability(TcgAccount, {
        username: validation.username,
        nickname: validation.nickname
      });
      const duplicateFields = [];
      if (!availability.username.available) duplicateFields.push('username');
      if (!availability.nickname.available) duplicateFields.push('nickname');
      if (duplicateFields.length) return res.status(409).json(duplicateResponse(duplicateFields));

      const passwordHash = await bcrypt.hash(validation.password, 10);
      const account = new TcgAccount({
        username: validation.username,
        usernameCanonical: validation.usernameCanonical,
        nickname: validation.nickname,
        nicknameCanonical: validation.nicknameCanonical,
        passwordHash,
        status: 'active',
        tokenVersion: 0,
        lastLoginAt: new Date()
      });
      await account.save();
      const token = signAccountToken(account, jwt, jwtSecret, tokenExpiresIn);
      return res.status(201).json({ token, account: serializeAccount(account) });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json(duplicateResponse(getMongoDuplicateFields(error)));
      }
      console.error('TCG account registration error:', error);
      return res.status(500).json({ msg: '회원가입 중 서버 오류가 발생했습니다.' });
    }
  });

  app.post('/api/tcg/auth/login', async (req, res) => {
    if (!loginRateLimit(req, res)) return;
    try {
      const username = normalizeUsername(req.body?.username);
      const password = normalizePasswordInput(req.body?.password);
      if (!username || !password) {
        return res.status(400).json({ msg: '아이디와 비밀번호를 입력해주세요.' });
      }
      if (validatePassword(password)) {
        return res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          msg: '아이디 또는 비밀번호가 올바르지 않습니다.'
        });
      }
      const account = await TcgAccount
        .findOne({ usernameCanonical: canonicalizeIdentity(username) })
        .select('+passwordHash');
      if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        return res.status(401).json({ code: 'INVALID_CREDENTIALS', msg: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }
      if (account.status !== 'active') {
        return res.status(403).json({ code: 'ACCOUNT_DISABLED', msg: '사용할 수 없는 계정입니다.' });
      }
      account.lastLoginAt = new Date();
      await account.save();
      const token = signAccountToken(account, jwt, jwtSecret, tokenExpiresIn);
      return res.json({ token, account: serializeAccount(account) });
    } catch (error) {
      console.error('TCG account login error:', error);
      return res.status(500).json({ msg: '로그인 중 서버 오류가 발생했습니다.' });
    }
  });

  app.get('/api/tcg/auth/me', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    return res.json({ account: serializeAccount(account) });
  });

  function sendPersonalRaidError(error, res) {
    if (!(error instanceof PersonalRaidError)) return false;
    if (error.code === 'RAID_COOLDOWN' && typeof res.set === 'function') {
      res.set('Retry-After', String(Math.max(1, Math.ceil(Number(error.details?.remainingCooldownMs || 0) / 1000))));
    }
    const retryAfterSeconds = error.code === 'RAID_COOLDOWN'
      ? Math.max(1, Math.ceil(Number(error.details?.remainingCooldownMs || 0) / 1000))
      : 0;
    res.status(error.status).json({
      code: error.code,
      msg: error.message,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      ...error.details
    });
    return true;
  }

  async function loadPersonalRaidPayload(account, request = {}) {
    const bossId = String(request.bossId || 'deadline-dragon-raid');
    const currentTime = now();
    const raidState = await getPersonalRaidState({
      TcgPersonalRaidDaily,
      account,
      bossId,
      now: currentTime
    });
    const ranking = await getPersonalRaidRanking({
      TcgPersonalRaidDaily,
      account,
      bossId,
      now: currentTime,
      limit: request.limit,
      ownRecord: raidState.record
    });
    return { state: raidState.state, ranking };
  }

  app.get('/api/tcg/raids/personal/state', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      return res.json(await loadPersonalRaidPayload(account, req.query || {}));
    } catch (error) {
      if (sendPersonalRaidError(error, res)) return;
      console.error('TCG personal raid state error:', error);
      return res.status(500).json({ code: 'RAID_STATE_FAILED', msg: '개인 레이드 정보를 불러오지 못했습니다.' });
    }
  });

  app.get('/api/tcg/raids/personal/ranking', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      const bossId = String(req.query?.bossId || 'deadline-dragon-raid');
      const ranking = await getPersonalRaidRanking({
        TcgPersonalRaidDaily,
        account,
        bossId,
        now: now(),
        limit: req.query?.limit
      });
      return res.json({ ranking });
    } catch (error) {
      if (sendPersonalRaidError(error, res)) return;
      console.error('TCG personal raid ranking error:', error);
      return res.status(500).json({ code: 'RAID_RANKING_FAILED', msg: '오늘의 개인 레이드 랭킹을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/tcg/raids/personal/dispatch', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      const currentTime = now();
      const dispatched = await dispatchPersonalRaid({
        TcgPersonalRaidDaily,
        account,
        bossId: req.body?.bossId,
        squadScore: req.body?.squadScore,
        now: currentTime,
        ...(typeof random === 'function' ? { random } : {})
      });
      const state = serializePersonalRaidState(
        dispatched.record,
        account,
        dispatched.boss,
        dispatched.window,
        currentTime
      );
      const ranking = await getPersonalRaidRanking({
        TcgPersonalRaidDaily,
        account,
        bossId: dispatched.boss.id,
        now: currentTime,
        ownRecord: dispatched.record
      });
      return res.json({ result: dispatched.result, state, ranking });
    } catch (error) {
      if (sendPersonalRaidError(error, res)) return;
      console.error('TCG personal raid dispatch error:', error);
      return res.status(500).json({ code: 'RAID_DISPATCH_FAILED', msg: '개인 레이드 파견을 처리하지 못했습니다.' });
    }
  });
}

module.exports = {
  DEFAULT_TOKEN_EXPIRES_IN,
  DEFAULT_RATE_LIMITS,
  TCG_TOKEN_AUDIENCE,
  TCG_TOKEN_ISSUER,
  TCG_TOKEN_KIND,
  canonicalizeIdentity,
  createIpRateLimiter,
  getMongoDuplicateFields,
  inspectAvailability,
  normalizeNickname,
  normalizePasswordInput,
  normalizeUsername,
  registerTcgRoutes,
  serializeAccount,
  signAccountToken,
  validateNickname,
  validatePassword,
  validateRegistrationPayload,
  validateUsername
};
