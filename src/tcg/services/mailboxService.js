'use strict';

const { createHash, randomUUID } = require('node:crypto');
const {
  PLAYER_LEASE_DURATION_MS,
  PlayerStateError,
  assertActivePlaySession,
  normalizeGameState,
  serializePlayerState
} = require('./playerStateService');

const DEFAULT_MAIL_EXPIRY_HOURS = 30 * 24;
const MAX_MAIL_EXPIRY_HOURS = 90 * 24;
const MAX_MAIL_COINS = 1_000_000_000;
const MAX_MAIL_STANDARD_PACKS = 100_000;
const MAX_MAIL_TITLE_LENGTH = 80;
const MAX_MAIL_MESSAGE_LENGTH = 1_000;
const MAX_STORED_MAILS = 200;
const MAX_SAFE_BALANCE = Number.MAX_SAFE_INTEGER;
const MAILBOX_EPOCH_START = new Date(0);

const ADMIN_GRANT_PACKAGES = Object.freeze([
  Object.freeze({
    id: 'tester-package-1',
    name: '테스터 패키지',
    priceKrw: 5_000,
    rewards: Object.freeze({ coins: 0, standardPacks: 6 })
  }),
  Object.freeze({
    id: 'tester-package-2',
    name: '테스터 패키지2',
    priceKrw: 10_000,
    rewards: Object.freeze({ coins: 1_500, standardPacks: 15 })
  }),
  Object.freeze({
    id: 'tester-package-3',
    name: '테스터 패키지3',
    priceKrw: 30_000,
    rewards: Object.freeze({ coins: 7_000, standardPacks: 50 })
  })
]);

class MailboxError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'MailboxError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function toTimestamp(value = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('A valid date is required.');
  return timestamp;
}

function normalizeNonNegativeInteger(value, field, maximum) {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum) {
    throw new MailboxError('INVALID_MAIL_REWARD', `${field} 보상 수량이 올바르지 않습니다.`);
  }
  return amount;
}

function normalizeMailRewards(value = {}) {
  const rewards = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    coins: normalizeNonNegativeInteger(rewards.coins, '코인', MAX_MAIL_COINS),
    standardPacks: normalizeNonNegativeInteger(
      rewards.standardPacks ?? rewards.packs?.standard,
      '표준 카드팩',
      MAX_MAIL_STANDARD_PACKS
    )
  };
}

function adminGrantCatalog() {
  return {
    packages: ADMIN_GRANT_PACKAGES.map((entry) => clone(entry)),
    limits: {
      coins: MAX_MAIL_COINS,
      standardPacks: MAX_MAIL_STANDARD_PACKS
    }
  };
}

function resolveAdminGrantPackage(value = '') {
  const presetId = String(value || '').normalize('NFKC').trim();
  if (!presetId) return null;
  const preset = ADMIN_GRANT_PACKAGES.find((entry) => entry.id === presetId);
  if (!preset) {
    throw new MailboxError('INVALID_GRANT_PACKAGE', '선택한 지급 패키지가 올바르지 않습니다.');
  }
  return preset;
}

function normalizeRequestId(value = '') {
  const requestId = String(value || '').normalize('NFKC').trim();
  if (!requestId) return randomUUID();
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(requestId)) {
    throw new MailboxError('INVALID_MAIL_REQUEST_ID', '발송 요청 ID가 올바르지 않습니다.');
  }
  return requestId;
}

function normalizeAdminMail(payload = {}, now = Date.now()) {
  const nowMs = toTimestamp(now);
  const requestId = normalizeRequestId(payload.requestId);
  const title = String(payload.title || '').normalize('NFKC').trim().slice(0, MAX_MAIL_TITLE_LENGTH);
  const message = String(payload.message || '').replace(/\r\n/g, '\n').trim().slice(0, MAX_MAIL_MESSAGE_LENGTH);
  const grantPackage = resolveAdminGrantPackage(payload.presetId);
  const rewards = normalizeMailRewards(grantPackage?.rewards || payload.rewards || {
    coins: payload.coins,
    standardPacks: payload.standardPacks
  });
  if (!title) throw new MailboxError('INVALID_MAIL_TITLE', '우편 제목을 입력해주세요.');
  if (!message && rewards.coins === 0 && rewards.standardPacks === 0) {
    throw new MailboxError('EMPTY_MAIL', '메시지 또는 보상을 하나 이상 입력해주세요.');
  }
  const expiresInHours = Number(payload.expiresInHours ?? DEFAULT_MAIL_EXPIRY_HOURS);
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > MAX_MAIL_EXPIRY_HOURS) {
    throw new MailboxError('INVALID_MAIL_EXPIRY', '우편 보관 기간이 올바르지 않습니다.');
  }
  const normalized = {
    id: `admin:${requestId}`,
    sender: '운영자',
    title,
    message,
    rewards,
    createdAt: new Date(nowMs),
    expiresAt: new Date(nowMs + expiresInHours * 60 * 60 * 1000),
    readAt: null,
    claimedAt: null
  };
  normalized.requestHash = createHash('sha256').update(JSON.stringify({
    idempotencyScope: String(payload.idempotencyScope || ''),
    presetId: grantPackage?.id || '',
    title,
    message,
    rewards,
    expiresInHours
  })).digest('hex');
  return normalized;
}

function serializeMail(entry, now = Date.now()) {
  const nowMs = toTimestamp(now);
  const claimedAt = entry?.claimedAt ? new Date(entry.claimedAt) : null;
  const readAt = entry?.readAt ? new Date(entry.readAt) : null;
  const expiresAt = new Date(entry?.expiresAt || 0);
  const expired = !claimedAt && expiresAt.getTime() <= nowMs;
  return {
    id: String(entry?.id || ''),
    sender: String(entry?.sender || '운영자'),
    title: String(entry?.title || ''),
    message: String(entry?.message || ''),
    rewards: normalizeMailRewards(entry?.rewards),
    createdAt: entry?.createdAt || null,
    expiresAt: entry?.expiresAt || null,
    readAt,
    claimedAt,
    status: claimedAt ? 'claimed' : (expired ? 'expired' : 'pending')
  };
}

function serializeMailbox(entries = [], now = Date.now()) {
  const mails = (Array.isArray(entries) ? entries : [])
    .map((entry) => serializeMail(entry, now))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  return {
    mails,
    pendingCount: mails.filter((mail) => mail.status === 'pending').length,
    unreadCount: mails.filter((mail) => mail.status === 'pending' && !mail.readAt).length
  };
}

function isPendingMailboxEntry(entry, now = Date.now()) {
  const nowMs = toTimestamp(now);
  return !entry?.claimedAt && new Date(entry?.expiresAt || 0).getTime() > nowMs;
}

function pruneMailboxEntries(entries = [], now = Date.now()) {
  const nowMs = toTimestamp(now);
  return (Array.isArray(entries) ? entries : []).filter((entry) => isPendingMailboxEntry(entry, nowMs));
}

function terminalMailboxQuery(nowDate) {
  return {
    $or: [
      { claimedAt: { $gt: MAILBOX_EPOCH_START } },
      { expiresAt: { $lte: nowDate } }
    ]
  };
}

async function resolveLean(queryOrValue) {
  if (queryOrValue && typeof queryOrValue.lean === 'function') return queryOrValue.lean();
  return queryOrValue;
}

function plainDocument(value) {
  if (!value) return null;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

async function findPlayerState(TcgPlayerState, accountId) {
  return plainDocument(await resolveLean(TcgPlayerState.findOne({ accountId })));
}

async function getMailbox({ TcgPlayerState, accountId, now = Date.now() }) {
  const player = await findPlayerState(TcgPlayerState, accountId);
  return serializeMailbox(player?.mailbox, now);
}

async function markMailboxRead({ TcgPlayerState, accountId, mailId, now = Date.now() }) {
  const normalizedMailId = String(mailId || '').trim();
  if (!normalizedMailId) throw new MailboxError('INVALID_MAIL_ID', '읽음 처리할 우편을 선택해주세요.');
  const nowDate = new Date(toTimestamp(now));
  const updated = await TcgPlayerState.findOneAndUpdate(
    {
      accountId,
      mailbox: { $elemMatch: { id: normalizedMailId, readAt: null } }
    },
    { $set: { 'mailbox.$[mail].readAt': nowDate } },
    {
      arrayFilters: [{ 'mail.id': normalizedMailId, 'mail.readAt': null }],
      returnDocument: 'after',
      runValidators: true
    }
  );
  if (updated) return serializeMailbox(plainDocument(updated).mailbox, nowDate);
  const current = await findPlayerState(TcgPlayerState, accountId);
  const exists = (current?.mailbox || []).some((mail) => String(mail?.id || '') === normalizedMailId);
  if (!exists) throw new MailboxError('MAIL_NOT_FOUND', '우편을 찾을 수 없습니다.', 404);
  return serializeMailbox(current.mailbox, nowDate);
}

function addSafeBalance(currentValue, amount, label) {
  const current = Math.max(0, Math.floor(Number(currentValue) || 0));
  if (!Number.isSafeInteger(current) || current > MAX_SAFE_BALANCE - amount) {
    throw new MailboxError('MAIL_REWARD_OVERFLOW', `${label} 보상을 지급하기엔 보유량이 너무 많습니다.`, 409);
  }
  return current + amount;
}

function applyMailRewards(state, mails) {
  const nextState = clone(state);
  if (!nextState || typeof nextState !== 'object' || Array.isArray(nextState)) {
    throw new PlayerStateError('CLOUD_SAVE_MIGRATION_REQUIRED', '플레이 기록을 먼저 불러와주세요.', 428);
  }
  const total = (Array.isArray(mails) ? mails : []).reduce((sum, mail) => {
    const rewards = normalizeMailRewards(mail?.rewards);
    return {
      coins: sum.coins + rewards.coins,
      standardPacks: sum.standardPacks + rewards.standardPacks
    };
  }, { coins: 0, standardPacks: 0 });
  if (!nextState.wallet || typeof nextState.wallet !== 'object' || Array.isArray(nextState.wallet)) {
    nextState.wallet = {};
  }
  if (!nextState.packs || typeof nextState.packs !== 'object' || Array.isArray(nextState.packs)) {
    nextState.packs = {};
  }
  nextState.wallet.coins = addSafeBalance(nextState.wallet.coins, total.coins, '코인');
  nextState.packs.standard = addSafeBalance(nextState.packs.standard, total.standardPacks, '표준 카드팩');
  return { state: normalizeGameState(nextState), rewards: total };
}

function normalizedClaimRequest(request = {}) {
  const baseRevision = Number(request.baseRevision);
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    throw new PlayerStateError('INVALID_BASE_REVISION', 'baseRevision 값이 올바르지 않습니다.');
  }
  return {
    leaseId: String(request.leaseId || '').trim(),
    deviceId: String(request.deviceId || '').normalize('NFKC').trim(),
    generation: Number(request.generation),
    baseRevision
  };
}

function claimFilter(accountId, request, nowDate, mailIds) {
  const ids = [...new Set(mailIds.map((id) => String(id || '').trim()).filter(Boolean))];
  return {
    accountId,
    initialized: true,
    revision: request.baseRevision,
    'activeLease.leaseId': request.leaseId,
    'activeLease.deviceId': request.deviceId,
    'activeLease.generation': request.generation,
    'activeLease.expiresAt': { $gt: nowDate },
    mailbox: {
      $elemMatch: {
        id: ids.length === 1 ? ids[0] : { $in: ids },
        claimedAt: null,
        expiresAt: { $gt: nowDate }
      }
    }
  };
}

async function explainClaimFailure({ TcgPlayerState, accountId, request, now, requestedMailId = '' }) {
  const active = await assertActivePlaySession({ TcgPlayerState, accountId, request, now });
  if (Number(active.revision) !== Number(request.baseRevision)) {
    throw new PlayerStateError(
      'SAVE_CONFLICT',
      '다른 저장이 먼저 반영되었습니다. 최신 진행 기록을 다시 불러와 주세요.',
      409,
      active
    );
  }
  const current = await findPlayerState(TcgPlayerState, accountId);
  if (requestedMailId) {
    const mail = (current?.mailbox || []).find((entry) => String(entry?.id || '') === requestedMailId);
    if (!mail) throw new MailboxError('MAIL_NOT_FOUND', '우편을 찾을 수 없습니다.', 404);
    if (mail.claimedAt) throw new MailboxError('MAIL_ALREADY_CLAIMED', '이미 수령한 우편입니다.', 409);
    if (new Date(mail.expiresAt || 0).getTime() <= toTimestamp(now)) {
      throw new MailboxError('MAIL_EXPIRED', '보관 기간이 지난 우편입니다.', 410);
    }
  }
  throw new PlayerStateError('PLAYER_STATE_BUSY', '우편함을 갱신하는 중입니다. 다시 시도해 주세요.', 409);
}

async function claimMailbox({
  TcgPlayerState,
  accountId,
  request = {},
  mailId = '',
  claimAll = false,
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const nowDate = new Date(nowMs);
  const normalizedRequest = normalizedClaimRequest(request);
  await assertActivePlaySession({ TcgPlayerState, accountId, request, now: nowMs });
  const snapshot = await findPlayerState(TcgPlayerState, accountId);
  if (!snapshot || Number(snapshot.revision) !== normalizedRequest.baseRevision) {
    return explainClaimFailure({ TcgPlayerState, accountId, request: normalizedRequest, now: nowMs });
  }
  const normalizedMailId = String(mailId || '').trim();
  if (!claimAll && !normalizedMailId) {
    throw new MailboxError('INVALID_MAIL_ID', '수령할 우편을 선택해주세요.');
  }
  const claimable = (Array.isArray(snapshot.mailbox) ? snapshot.mailbox : []).filter((entry) => (
    !entry?.claimedAt
    && new Date(entry?.expiresAt || 0).getTime() > nowMs
    && (claimAll || String(entry?.id || '') === normalizedMailId)
  ));
  if (!claimable.length) {
    if (claimAll) {
      return {
        ...serializePlayerState(snapshot, nowMs),
        ...serializeMailbox(snapshot.mailbox, nowMs),
        claimedCount: 0,
        claimedMailIds: [],
        rewards: { coins: 0, standardPacks: 0 }
      };
    }
    return explainClaimFailure({
      TcgPlayerState,
      accountId,
      request: normalizedRequest,
      now: nowMs,
      requestedMailId: normalizedMailId
    });
  }
  const claimIds = claimable.map((entry) => String(entry.id));
  const applied = applyMailRewards(snapshot.state, claimable);
  const updated = await TcgPlayerState.findOneAndUpdate(
    claimFilter(accountId, normalizedRequest, nowDate, claimIds),
    {
      $set: {
        state: applied.state,
        'activeLease.heartbeatAt': nowDate,
        'activeLease.expiresAt': new Date(nowMs + PLAYER_LEASE_DURATION_MS),
        'mailbox.$[mail].readAt': nowDate,
        'mailbox.$[mail].claimedAt': nowDate
      },
      $inc: { revision: 1 }
    },
    {
      arrayFilters: [{
        'mail.id': { $in: claimIds },
        'mail.claimedAt': null,
        'mail.expiresAt': { $gt: nowDate }
      }],
      returnDocument: 'after',
      runValidators: true
    }
  );
  if (!updated) {
    return explainClaimFailure({
      TcgPlayerState,
      accountId,
      request: normalizedRequest,
      now: nowMs,
      requestedMailId: claimAll ? '' : normalizedMailId
    });
  }
  const document = plainDocument(updated);
  return {
    ...serializePlayerState(document, nowMs),
    ...serializeMailbox(document.mailbox, nowMs),
    claimedCount: claimIds.length,
    claimedMailIds: claimIds,
    rewards: applied.rewards
  };
}

function initialPlayerState(accountId) {
  return {
    accountId,
    state: null,
    revision: 0,
    initialized: false,
    mailbox: [],
    activeLease: {
      leaseId: '',
      deviceId: '',
      platform: null,
      generation: 0,
      heartbeatAt: null,
      expiresAt: null,
      appVersion: ''
    }
  };
}

async function deliverMailToAccount({ TcgPlayerState, accountId, mail, now = Date.now() }) {
  await TcgPlayerState.updateOne(
    { accountId },
    { $setOnInsert: initialPlayerState(accountId) },
    { upsert: true, runValidators: true }
  );
  const current = await findPlayerState(TcgPlayerState, accountId);
  const existing = (current?.mailbox || []).find((entry) => String(entry?.id || '') === mail.id);
  if (existing) {
    if (existing.requestHash && existing.requestHash !== mail.requestHash) {
      throw new MailboxError(
        'MAIL_REQUEST_REUSED',
        '같은 발송 요청 ID가 다른 내용에 사용되었습니다.',
        409
      );
    }
    return false;
  }
  const nowDate = new Date(toTimestamp(now));
  // Terminal entries may be removed to make room. Pending entries are never
  // included in this cleanup, so an account with 200 unclaimed mails is
  // rejected instead of silently losing an item.
  await TcgPlayerState.updateOne(
    { accountId },
    { $pull: { mailbox: terminalMailboxQuery(nowDate) } },
    { runValidators: true }
  );
  const result = await TcgPlayerState.updateOne(
    {
      accountId,
      'mailbox.id': { $ne: mail.id },
      $expr: {
        $lt: [
          { $size: { $ifNull: ['$mailbox', []] } },
          MAX_STORED_MAILS
        ]
      }
    },
    {
      $push: { mailbox: clone(mail) }
    },
    { runValidators: true }
  );
  if (Number(result?.modifiedCount || result?.nModified || 0) > 0) return true;
  const raced = await findPlayerState(TcgPlayerState, accountId);
  const racedMail = (raced?.mailbox || []).find((entry) => String(entry?.id || '') === mail.id);
  if (racedMail?.requestHash && racedMail.requestHash !== mail.requestHash) {
    throw new MailboxError('MAIL_REQUEST_REUSED', '같은 발송 요청 ID가 다른 내용에 사용되었습니다.', 409);
  }
  if (pruneMailboxEntries(raced?.mailbox, nowDate).length >= MAX_STORED_MAILS) {
    throw new MailboxError(
      'MAILBOX_FULL',
      `우편함에 미수령 우편이 ${MAX_STORED_MAILS}개 있어 새 우편을 보낼 수 없습니다.`,
      409,
      { maxStoredMails: MAX_STORED_MAILS }
    );
  }
  return false;
}

async function deliverAdminMail({ TcgPlayerState, accountIds, payload = {}, now = Date.now() }) {
  const uniqueAccountIds = [...new Map(
    (Array.isArray(accountIds) ? accountIds : [])
      .filter(Boolean)
      .map((accountId) => [String(accountId), accountId])
  ).values()];
  if (!uniqueAccountIds.length) throw new MailboxError('MAIL_RECIPIENT_NOT_FOUND', '우편을 보낼 사용자를 찾을 수 없습니다.', 404);
  const mail = normalizeAdminMail(payload, now);
  let insertedCount = 0;
  for (let index = 0; index < uniqueAccountIds.length; index += 25) {
    const batch = uniqueAccountIds.slice(index, index + 25);
    const results = await Promise.all(batch.map((accountId) => deliverMailToAccount({
      TcgPlayerState,
      accountId,
      mail,
      now
    })));
    insertedCount += results.filter(Boolean).length;
  }
  return {
    mail: serializeMail(mail, now),
    recipientCount: uniqueAccountIds.length,
    insertedCount
  };
}

module.exports = {
  ADMIN_GRANT_PACKAGES,
  DEFAULT_MAIL_EXPIRY_HOURS,
  MAX_MAIL_COINS,
  MAX_MAIL_EXPIRY_HOURS,
  MAX_MAIL_STANDARD_PACKS,
  MAX_STORED_MAILS,
  MailboxError,
  adminGrantCatalog,
  applyMailRewards,
  claimMailbox,
  deliverAdminMail,
  getMailbox,
  markMailboxRead,
  normalizeAdminMail,
  normalizeMailRewards,
  isPendingMailboxEntry,
  pruneMailboxEntries,
  resolveAdminGrantPackage,
  serializeMail,
  serializeMailbox
};
