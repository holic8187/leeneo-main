'use strict';

const DefaultTcgAccount = require('./models/TcgAccount');
const DefaultTcgPersonalRaidDaily = require('./models/TcgPersonalRaidDaily');
const DefaultTcgPlayerState = require('./models/TcgPlayerState');
const {
  PersonalRaidError,
  dispatchPersonalRaid,
  getPersonalRaidRanking,
  getPersonalRaidState,
  serializePersonalRaidState,
  validatePersonalRaidSquad
} = require('./services/personalRaidService');
const {
  PlayerStateError,
  assertActivePlaySession,
  heartbeatPlaySession,
  openPlaySession,
  releasePlaySession,
  saveGameState,
  takeoverPlaySession
} = require('./services/playerStateService');
const {
  MailboxError,
  claimMailbox,
  deliverAdminMail,
  getMailbox,
  markMailboxRead
} = require('./services/mailboxService');

const TCG_TOKEN_KIND = 'tcg';
const TCG_TOKEN_ISSUER = 'working-hoi-server';
const TCG_TOKEN_AUDIENCE = 'hoi-card-desk';
const DEFAULT_TOKEN_EXPIRES_IN = null;
const TCG_ADMIN_TOKEN_KIND = 'tcg-admin';
const TCG_ADMIN_TOKEN_ISSUER = 'working-hoi-server';
const TCG_ADMIN_TOKEN_AUDIENCE = 'hoi-card-desk-admin';
const TCG_ADMIN_TOKEN_EXPIRES_IN = '30m';
const MAX_RATE_LIMIT_KEYS = 10_000;
const DEFAULT_RATE_LIMITS = Object.freeze({
  availability: Object.freeze({ windowMs: 60_000, max: 60 }),
  register: Object.freeze({ windowMs: 10 * 60_000, max: 8 }),
  login: Object.freeze({ windowMs: 5 * 60_000, max: 20 }),
  adminLogin: Object.freeze({ windowMs: 15 * 60_000, max: 8 })
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
  const options = {
    algorithm: 'HS256',
    issuer: TCG_TOKEN_ISSUER,
    audience: TCG_TOKEN_AUDIENCE
  };
  if (expiresIn !== null && expiresIn !== undefined && String(expiresIn).trim()) {
    options.expiresIn = expiresIn;
  }
  return jwt.sign({
    sub: String(account._id || account.id),
    kind: TCG_TOKEN_KIND,
    tokenVersion: Math.max(0, Number(account.tokenVersion) || 0)
  }, jwtSecret, options);
}

function signAdminToken(username, jwt, jwtSecret) {
  return jwt.sign({
    sub: String(username || ''),
    kind: TCG_ADMIN_TOKEN_KIND
  }, jwtSecret, {
    algorithm: 'HS256',
    issuer: TCG_ADMIN_TOKEN_ISSUER,
    audience: TCG_ADMIN_TOKEN_AUDIENCE,
    expiresIn: TCG_ADMIN_TOKEN_EXPIRES_IN
  });
}

function registerTcgRoutes({
  app,
  bcrypt,
  jwt,
  jwtSecret,
  adminUsername = '',
  adminPasswordHash = '',
  adminJwtSecret = jwtSecret,
  tokenExpiresIn = DEFAULT_TOKEN_EXPIRES_IN,
  rateLimitOptions = {},
  TcgAccount = DefaultTcgAccount,
  TcgPersonalRaidDaily = DefaultTcgPersonalRaidDaily,
  TcgPlayerState = DefaultTcgPlayerState,
  now = Date.now,
  random = undefined
}) {
  if (!app || !bcrypt || !jwt || !jwtSecret || !TcgAccount || !TcgPersonalRaidDaily || !TcgPlayerState) {
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
  const adminLoginRateLimit = createIpRateLimiter({
    ...DEFAULT_RATE_LIMITS.adminLogin,
    ...(rateLimitOptions.adminLogin || {})
  });
  const normalizedAdminUsername = normalizeUsername(adminUsername);
  const normalizedAdminPasswordHash = String(adminPasswordHash || '').trim();
  const normalizedAdminJwtSecret = String(adminJwtSecret || jwtSecret || '');
  const adminConfigured = Boolean(
    normalizedAdminUsername
    && normalizedAdminPasswordHash
    && normalizedAdminJwtSecret
  );

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

  function requireTcgAdmin(req, res) {
    if (!adminConfigured) {
      res.status(503).json({ code: 'ADMIN_NOT_CONFIGURED', msg: '관리자 모드가 아직 설정되지 않았습니다.' });
      return null;
    }
    try {
      const token = getBearerToken(req);
      if (!token) {
        res.status(401).json({ code: 'ADMIN_AUTH_REQUIRED', msg: '관리자 인증이 필요합니다.' });
        return null;
      }
      const payload = jwt.verify(token, normalizedAdminJwtSecret, {
        algorithms: ['HS256'],
        issuer: TCG_ADMIN_TOKEN_ISSUER,
        audience: TCG_ADMIN_TOKEN_AUDIENCE
      });
      if (payload?.kind !== TCG_ADMIN_TOKEN_KIND || payload?.sub !== normalizedAdminUsername) {
        res.status(403).json({ code: 'ADMIN_FORBIDDEN', msg: '관리자 권한이 없습니다.' });
        return null;
      }
      return payload;
    } catch {
      res.status(401).json({ code: 'INVALID_ADMIN_TOKEN', msg: '관리자 로그인이 만료되었습니다.' });
      return null;
    }
  }

  function sendMailboxError(error, res) {
    if (!(error instanceof MailboxError)) return false;
    res.status(error.status).json({
      code: error.code,
      msg: error.message,
      ...error.details
    });
    return true;
  }

  async function resolveQuery(queryOrValue) {
    if (queryOrValue && typeof queryOrValue.lean === 'function') return queryOrValue.lean();
    return queryOrValue;
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
    const token = signAccountToken(account, jwt, jwtSecret, tokenExpiresIn);
    return res.json({ token, account: serializeAccount(account) });
  });

  app.post('/api/tcg/admin/auth/login', async (req, res) => {
    if (!adminLoginRateLimit(req, res)) return;
    if (!adminConfigured) {
      return res.status(503).json({
        code: 'ADMIN_NOT_CONFIGURED',
        msg: '관리자 모드가 아직 설정되지 않았습니다.'
      });
    }
    try {
      const username = normalizeUsername(req.body?.username);
      const password = normalizePasswordInput(req.body?.password);
      if (!username || !password) {
        return res.status(400).json({ code: 'INVALID_ADMIN_CREDENTIALS', msg: '아이디와 비밀번호를 입력해주세요.' });
      }
      const passwordMatches = await bcrypt.compare(password, normalizedAdminPasswordHash);
      if (canonicalizeIdentity(username) !== canonicalizeIdentity(normalizedAdminUsername) || !passwordMatches) {
        return res.status(401).json({
          code: 'INVALID_ADMIN_CREDENTIALS',
          msg: '관리자 아이디 또는 비밀번호가 올바르지 않습니다.'
        });
      }
      const token = signAdminToken(normalizedAdminUsername, jwt, normalizedAdminJwtSecret);
      return res.json({
        token,
        expiresInSeconds: 30 * 60,
        admin: { username: normalizedAdminUsername, displayName: '운영자' }
      });
    } catch (error) {
      console.error('TCG admin login error:', error);
      return res.status(500).json({ code: 'ADMIN_LOGIN_FAILED', msg: '관리자 로그인을 처리하지 못했습니다.' });
    }
  });

  function sendPlayerStateError(error, res) {
    if (!(error instanceof PlayerStateError)) return false;
    res.status(error.status).json({
      code: error.code,
      msg: error.message,
      ...error.details
    });
    return true;
  }

  async function runPlayerStateAction(req, res, action, fallback) {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      const payload = await action({
        TcgPlayerState,
        accountId: account._id || account.id,
        request: req.body || {},
        now: now()
      });
      return res.json(payload);
    } catch (error) {
      if (sendPlayerStateError(error, res)) return;
      console.error(`TCG ${fallback.operation} error:`, error);
      return res.status(500).json({ code: fallback.code, msg: fallback.message });
    }
  }

  app.post('/api/tcg/play-session/open', async (req, res) => (
    runPlayerStateAction(req, res, openPlaySession, {
      operation: 'play session open',
      code: 'PLAY_SESSION_OPEN_FAILED',
      message: '플레이 기록을 연결하지 못했습니다.'
    })
  ));

  app.post('/api/tcg/play-session/takeover', async (req, res) => (
    runPlayerStateAction(req, res, takeoverPlaySession, {
      operation: 'play session takeover',
      code: 'PLAY_SESSION_TAKEOVER_FAILED',
      message: '이 기기로 플레이를 전환하지 못했습니다.'
    })
  ));

  app.post('/api/tcg/play-session/heartbeat', async (req, res) => (
    runPlayerStateAction(req, res, heartbeatPlaySession, {
      operation: 'play session heartbeat',
      code: 'PLAY_SESSION_HEARTBEAT_FAILED',
      message: '플레이 연결 상태를 확인하지 못했습니다.'
    })
  ));

  app.post('/api/tcg/play-session/release', async (req, res) => (
    runPlayerStateAction(req, res, releasePlaySession, {
      operation: 'play session release',
      code: 'PLAY_SESSION_RELEASE_FAILED',
      message: '플레이 연결을 종료하지 못했습니다.'
    })
  ));

  app.put('/api/tcg/game-state', async (req, res) => (
    runPlayerStateAction(req, res, saveGameState, {
      operation: 'game state save',
      code: 'GAME_STATE_SAVE_FAILED',
      message: '게임 진행 기록을 저장하지 못했습니다.'
    })
  ));

  app.get('/api/tcg/mail', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      return res.json(await getMailbox({
        TcgPlayerState,
        accountId: account._id || account.id,
        now: now()
      }));
    } catch (error) {
      if (sendMailboxError(error, res)) return;
      console.error('TCG mailbox list error:', error);
      return res.status(500).json({ code: 'MAILBOX_LOAD_FAILED', msg: '우편함을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/tcg/mail/read', async (req, res) => {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      return res.json(await markMailboxRead({
        TcgPlayerState,
        accountId: account._id || account.id,
        mailId: req.body?.mailId,
        now: now()
      }));
    } catch (error) {
      if (sendMailboxError(error, res)) return;
      console.error('TCG mailbox read error:', error);
      return res.status(500).json({ code: 'MAIL_READ_FAILED', msg: '우편을 읽음 처리하지 못했습니다.' });
    }
  });

  async function handleMailboxClaim(req, res, claimAll) {
    const account = await requireTcgAccount(req, res);
    if (!account) return;
    try {
      return res.json(await claimMailbox({
        TcgPlayerState,
        accountId: account._id || account.id,
        request: req.body || {},
        mailId: req.body?.mailId,
        claimAll,
        now: now()
      }));
    } catch (error) {
      if (sendPlayerStateError(error, res)) return;
      if (sendMailboxError(error, res)) return;
      console.error(`TCG mailbox ${claimAll ? 'claim all' : 'claim'} error:`, error);
      return res.status(500).json({ code: 'MAIL_CLAIM_FAILED', msg: '우편 보상을 수령하지 못했습니다.' });
    }
  }

  app.post('/api/tcg/mail/claim', async (req, res) => handleMailboxClaim(req, res, false));
  app.post('/api/tcg/mail/claim-all', async (req, res) => handleMailboxClaim(req, res, true));

  app.get('/api/tcg/admin/users', async (req, res) => {
    if (!requireTcgAdmin(req, res)) return;
    try {
      let query = TcgAccount.find({ status: 'active' });
      if (typeof query?.sort === 'function') query = query.sort({ nickname: 1, username: 1 });
      if (typeof query?.select === 'function') query = query.select('username nickname status createdAt');
      const accounts = await resolveQuery(query) || [];
      return res.json({
        users: accounts.map((account) => ({
          id: String(account._id || account.id || ''),
          username: String(account.username || ''),
          nickname: String(account.nickname || ''),
          label: account.nickname ? `${account.nickname} (${account.username})` : String(account.username || '')
        }))
      });
    } catch (error) {
      console.error('TCG admin user list error:', error);
      return res.status(500).json({ code: 'ADMIN_USER_LIST_FAILED', msg: '사용자 목록을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/tcg/admin/mail/send', async (req, res) => {
    const admin = requireTcgAdmin(req, res);
    if (!admin) return;
    try {
      const targetMode = String(req.body?.targetMode || '').trim();
      if (!['single', 'all'].includes(targetMode)) {
        return res.status(400).json({ code: 'INVALID_MAIL_TARGET', msg: '발송 대상이 올바르지 않습니다.' });
      }
      let accounts = [];
      if (targetMode === 'all') {
        let query = TcgAccount.find({ status: 'active' });
        if (typeof query?.select === 'function') query = query.select('_id');
        accounts = await resolveQuery(query) || [];
      } else {
        const targetAccountId = String(req.body?.targetAccountId || '').trim();
        if (!targetAccountId) {
          return res.status(400).json({ code: 'INVALID_MAIL_TARGET', msg: '발송할 사용자를 선택해주세요.' });
        }
        let query = TcgAccount.findById(targetAccountId);
        if (typeof query?.select === 'function') query = query.select('_id status');
        const account = await resolveQuery(query);
        if (account?.status === 'active') accounts = [account];
      }
      const accountIds = accounts.map((account) => account._id || account.id).filter(Boolean);
      const result = await deliverAdminMail({
        TcgPlayerState,
        accountIds,
        payload: {
          ...(req.body || {}),
          idempotencyScope: targetMode === 'all'
            ? 'all'
            : `single:${String(accountIds[0] || '')}`
        },
        now: now()
      });
      return res.json({
        success: true,
        targetMode,
        deliveredCount: result.recipientCount,
        newlyDeliveredCount: result.insertedCount,
        mail: result.mail
      });
    } catch (error) {
      if (sendMailboxError(error, res)) return;
      if (error?.name === 'CastError') {
        return res.status(404).json({ code: 'MAIL_RECIPIENT_NOT_FOUND', msg: '우편을 보낼 사용자를 찾을 수 없습니다.' });
      }
      console.error('TCG admin mail send error:', error);
      return res.status(500).json({ code: 'ADMIN_MAIL_SEND_FAILED', msg: '우편을 발송하지 못했습니다.' });
    }
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
      const request = req.body || {};
      const currentTime = now();
      const validateSession = async () => {
        const player = await assertActivePlaySession({
          TcgPlayerState,
          accountId: account._id || account.id,
          request,
          now: currentTime
        });
        const hasExplicitSquad = Array.isArray(request.squad);
        const squad = hasExplicitSquad
          ? request.squad
          : (player.state?.selectedRaidSquad || player.state?.selectedSquad || []);
        return validatePersonalRaidSquad({
          playerState: player.state,
          squad,
          submittedScore: hasExplicitSquad ? request.squadScore : undefined,
          allowImplicitEnhancement: !hasExplicitSquad,
          skipUnavailable: !hasExplicitSquad,
          now: currentTime
        });
      };
      const dispatched = await dispatchPersonalRaid({
        TcgPersonalRaidDaily,
        account,
        bossId: request.bossId,
        squadScore: request.squadScore,
        now: currentTime,
        validateSession,
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
      if (sendPlayerStateError(error, res)) return;
      if (sendPersonalRaidError(error, res)) return;
      console.error('TCG personal raid dispatch error:', error);
      return res.status(500).json({ code: 'RAID_DISPATCH_FAILED', msg: '개인 레이드 파견을 처리하지 못했습니다.' });
    }
  });
}

module.exports = {
  DEFAULT_TOKEN_EXPIRES_IN,
  DEFAULT_RATE_LIMITS,
  TCG_ADMIN_TOKEN_AUDIENCE,
  TCG_ADMIN_TOKEN_EXPIRES_IN,
  TCG_ADMIN_TOKEN_ISSUER,
  TCG_ADMIN_TOKEN_KIND,
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
  signAdminToken,
  signAccountToken,
  validateNickname,
  validatePassword,
  validateRegistrationPayload,
  validateUsername
};
