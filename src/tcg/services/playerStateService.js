'use strict';

const { randomUUID } = require('node:crypto');

const PLAYER_LEASE_DURATION_MS = 45_000;
const MAX_GAME_STATE_BYTES = 512 * 1024;
const MAX_PLAYER_STATE_CAS_ATTEMPTS = 8;
const PLAYER_PLATFORMS = Object.freeze(['pc', 'android', 'ios', 'web']);
const FORBIDDEN_STATE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

class PlayerStateError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'PlayerStateError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function toTimestamp(value = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('A valid date is required.');
  return timestamp;
}

function normalizeRequiredText(value, field, maximum = 128) {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > maximum) {
    throw new PlayerStateError(
      `INVALID_${field.replaceAll(/([A-Z])/g, '_$1').toUpperCase()}`,
      `${field} 값이 올바르지 않습니다.`,
      400
    );
  }
  return normalized;
}

function normalizePlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (!PLAYER_PLATFORMS.includes(platform)) {
    throw new PlayerStateError('INVALID_PLATFORM', '지원하지 않는 플레이 환경입니다.', 400, {
      allowedPlatforms: PLAYER_PLATFORMS
    });
  }
  return platform;
}

function normalizeAppVersion(value) {
  const appVersion = String(value ?? '').normalize('NFKC').trim();
  if (appVersion.length > 64) {
    throw new PlayerStateError('INVALID_APP_VERSION', '앱 버전 정보가 올바르지 않습니다.');
  }
  return appVersion;
}

function normalizeGeneration(value, field = 'generation') {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !value.trim())) {
    throw new PlayerStateError(
      `INVALID_${field.replaceAll(/([A-Z])/g, '_$1').toUpperCase()}`,
      `${field} 값이 올바르지 않습니다.`
    );
  }
  const generation = Number(value);
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new PlayerStateError(
      `INVALID_${field.replaceAll(/([A-Z])/g, '_$1').toUpperCase()}`,
      `${field} 값이 올바르지 않습니다.`
    );
  }
  return generation;
}

function assertJsonValue(value, path = 'state', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new PlayerStateError('INVALID_GAME_STATE', `${path}에 저장할 수 없는 숫자가 있습니다.`);
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new PlayerStateError('INVALID_GAME_STATE', `${path}에 JSON으로 저장할 수 없는 값이 있습니다.`);
  }
  if (seen.has(value)) {
    throw new PlayerStateError('INVALID_GAME_STATE', `${path}에 순환 참조가 있습니다.`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, seen));
    seen.delete(value);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new PlayerStateError('INVALID_GAME_STATE', `${path}는 일반 JSON 객체여야 합니다.`);
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_STATE_KEYS.has(key)) {
      throw new PlayerStateError('INVALID_GAME_STATE', `${path}에 허용되지 않는 키가 있습니다.`);
    }
    assertJsonValue(value[key], `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function normalizeGameState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PlayerStateError('INVALID_GAME_STATE', '게임 저장 데이터는 JSON 객체여야 합니다.');
  }
  assertJsonValue(value);
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PlayerStateError('INVALID_GAME_STATE', '게임 저장 데이터를 JSON으로 변환할 수 없습니다.');
  }
  const byteLength = Buffer.byteLength(serialized, 'utf8');
  if (byteLength > MAX_GAME_STATE_BYTES) {
    throw new PlayerStateError(
      'GAME_STATE_TOO_LARGE',
      '게임 저장 데이터의 크기가 512KB를 초과했습니다.',
      413,
      { maximumBytes: MAX_GAME_STATE_BYTES, actualBytes: byteLength }
    );
  }
  return JSON.parse(serialized);
}

function plainDocument(value) {
  if (!value) return null;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

async function resolveLean(queryOrValue) {
  if (queryOrValue && typeof queryOrValue.lean === 'function') return queryOrValue.lean();
  return queryOrValue;
}

function emptyLease(generation = 0, nowMs = 0) {
  return {
    leaseId: '',
    deviceId: '',
    platform: null,
    generation: Math.max(0, Number(generation) || 0),
    heartbeatAt: nowMs ? new Date(nowMs) : null,
    expiresAt: nowMs ? new Date(nowMs) : null,
    appVersion: ''
  };
}

function normalizeLease(lease) {
  return {
    ...emptyLease(),
    ...(lease && typeof lease === 'object' ? lease : {}),
    leaseId: String(lease?.leaseId || ''),
    deviceId: String(lease?.deviceId || ''),
    platform: PLAYER_PLATFORMS.includes(String(lease?.platform || '')) ? String(lease.platform) : null,
    generation: Math.max(0, Number(lease?.generation) || 0),
    appVersion: String(lease?.appVersion || '')
  };
}

function leaseExpiresAt(lease) {
  const timestamp = lease?.expiresAt instanceof Date
    ? lease.expiresAt.getTime()
    : new Date(lease?.expiresAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isLiveLease(lease, now = Date.now()) {
  const normalized = normalizeLease(lease);
  return Boolean(normalized.leaseId && normalized.deviceId && leaseExpiresAt(normalized) > toTimestamp(now));
}

function cloneState(state) {
  if (state == null) return null;
  return JSON.parse(JSON.stringify(state));
}

function serializePlayerState(playerState, now = Date.now()) {
  const document = plainDocument(playerState) || {};
  const nowMs = toTimestamp(now);
  const lease = normalizeLease(document.activeLease);
  const live = isLiveLease(lease, nowMs);
  return {
    leaseId: live ? lease.leaseId : '',
    generation: lease.generation,
    expiresAt: live ? leaseExpiresAt(lease) : 0,
    serverNow: nowMs,
    revision: Math.max(0, Number(document.revision) || 0),
    state: document.initialized ? cloneState(document.state) : null,
    initialized: Boolean(document.initialized),
    platform: live ? lease.platform : null
  };
}

async function findPlayerState(TcgPlayerState, accountId) {
  return plainDocument(await resolveLean(TcgPlayerState.findOne({ accountId })));
}

async function ensurePlayerState(TcgPlayerState, accountId) {
  try {
    await TcgPlayerState.updateOne({ accountId }, {
      $setOnInsert: {
        accountId,
        state: null,
        revision: 0,
        initialized: false,
        activeLease: emptyLease()
      }
    }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  return findPlayerState(TcgPlayerState, accountId);
}

function snapshotFilter(snapshot) {
  const lease = normalizeLease(snapshot?.activeLease);
  return {
    _id: snapshot._id,
    revision: Math.max(0, Number(snapshot.revision) || 0),
    initialized: Boolean(snapshot.initialized),
    'activeLease.leaseId': lease.leaseId,
    'activeLease.generation': lease.generation
  };
}

function newLease({ deviceId, platform, appVersion, generation, nowMs, leaseId = randomUUID() }) {
  return {
    leaseId: leaseId || randomUUID(),
    deviceId,
    platform,
    generation,
    heartbeatAt: new Date(nowMs),
    expiresAt: new Date(nowMs + PLAYER_LEASE_DURATION_MS),
    appVersion
  };
}

function migrationRequired() {
  return new PlayerStateError(
    'CLOUD_SAVE_MIGRATION_REQUIRED',
    '기존 PC의 최신 버전을 한 번 실행해 진행 기록을 클라우드로 가져와 주세요.',
    428
  );
}

function platformLabel(platform) {
  return platform === 'android' || platform === 'ios' ? '모바일' : 'PC';
}

function playingElsewhere(snapshot, nowMs) {
  const lease = normalizeLease(snapshot.activeLease);
  return new PlayerStateError(
    'PLAYING_ELSEWHERE',
    `${platformLabel(lease.platform)}로 플레이 중이에요!`,
    409,
    {
      activePlatform: lease.platform,
      generation: lease.generation,
      expiresAt: leaseExpiresAt(lease),
      serverNow: nowMs
    }
  );
}

function sessionLost(snapshot, nowMs) {
  const lease = normalizeLease(snapshot?.activeLease);
  const live = isLiveLease(lease, nowMs);
  return new PlayerStateError(
    'PLAY_SESSION_LOST',
    live
      ? `${platformLabel(lease.platform)}로 플레이 중이에요!`
      : '플레이 연결이 만료되었습니다. 다시 연결해 주세요.',
    409,
    {
      activePlatform: live ? lease.platform : null,
      generation: lease.generation,
      expiresAt: live ? leaseExpiresAt(lease) : 0,
      serverNow: nowMs,
      revision: Math.max(0, Number(snapshot?.revision) || 0)
    }
  );
}

function normalizeLeaseRequest(input = {}, { requireLease = false } = {}) {
  const deviceId = normalizeRequiredText(input.deviceId, 'deviceId');
  const platform = input.platform === undefined ? null : normalizePlatform(input.platform);
  const appVersion = normalizeAppVersion(input.appVersion);
  const leaseId = requireLease ? normalizeRequiredText(input.leaseId, 'leaseId') : '';
  const generation = requireLease ? normalizeGeneration(input.generation) : 0;
  return { deviceId, platform, appVersion, leaseId, generation };
}

async function openPlaySession({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const device = normalizeLeaseRequest(request);
  const canBootstrap = request.allowBootstrap === true
    && Object.prototype.hasOwnProperty.call(request, 'bootstrapState');
  const bootstrapState = canBootstrap ? normalizeGameState(request.bootstrapState) : null;
  await ensurePlayerState(TcgPlayerState, accountId);

  for (let attempt = 0; attempt < MAX_PLAYER_STATE_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findPlayerState(TcgPlayerState, accountId);
    if (!snapshot) continue;
    const currentLease = normalizeLease(snapshot.activeLease);
    if (isLiveLease(currentLease, nowMs) && currentLease.deviceId !== device.deviceId) {
      throw playingElsewhere(snapshot, nowMs);
    }
    if (!snapshot.initialized && !canBootstrap) throw migrationRequired();

    const keepLease = isLiveLease(currentLease, nowMs) && currentLease.deviceId === device.deviceId;
    const lease = newLease({
      ...device,
      generation: keepLease ? currentLease.generation : currentLease.generation + 1,
      nowMs,
      ...(keepLease ? { leaseId: currentLease.leaseId } : {})
    });
    const update = { $set: { activeLease: lease } };
    if (!snapshot.initialized) {
      update.$set.state = bootstrapState;
      update.$set.initialized = true;
      update.$inc = { revision: 1 };
    }
    const updated = await TcgPlayerState.findOneAndUpdate(
      snapshotFilter(snapshot),
      update,
      { new: true, runValidators: true }
    );
    if (updated) return serializePlayerState(updated, nowMs);
  }
  throw new PlayerStateError('PLAYER_STATE_BUSY', '플레이 기록을 연결하는 중입니다. 다시 시도해 주세요.', 409);
}

async function takeoverPlaySession({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const device = normalizeLeaseRequest(request);
  const hasExpectedGeneration = request.expectedGeneration !== undefined
    && request.expectedGeneration !== null;
  const expectedGeneration = hasExpectedGeneration
    ? normalizeGeneration(request.expectedGeneration, 'expectedGeneration')
    : null;
  await ensurePlayerState(TcgPlayerState, accountId);

  for (let attempt = 0; attempt < MAX_PLAYER_STATE_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findPlayerState(TcgPlayerState, accountId);
    if (!snapshot) continue;
    if (!snapshot.initialized) throw migrationRequired();
    const currentLease = normalizeLease(snapshot.activeLease);
    if (hasExpectedGeneration && currentLease.generation !== expectedGeneration) {
      throw new PlayerStateError(
        'PLAY_SESSION_CHANGED',
        '플레이 중인 기기가 바뀌었습니다. 현재 상태를 다시 확인해 주세요.',
        409,
        {
          activePlatform: isLiveLease(currentLease, nowMs) ? currentLease.platform : null,
          generation: currentLease.generation,
          expiresAt: isLiveLease(currentLease, nowMs) ? leaseExpiresAt(currentLease) : 0,
          serverNow: nowMs
        }
      );
    }
    const lease = newLease({
      ...device,
      generation: currentLease.generation + 1,
      nowMs
    });
    const updated = await TcgPlayerState.findOneAndUpdate(
      snapshotFilter(snapshot),
      { $set: { activeLease: lease } },
      { new: true, runValidators: true }
    );
    if (updated) return serializePlayerState(updated, nowMs);
  }
  throw new PlayerStateError('PLAYER_STATE_BUSY', '플레이 기기를 전환하는 중입니다. 다시 시도해 주세요.', 409);
}

function exactLeaseFilter(accountId, lease, nowMs, { requireLive = true } = {}) {
  return {
    accountId,
    initialized: true,
    'activeLease.leaseId': lease.leaseId,
    'activeLease.deviceId': lease.deviceId,
    'activeLease.generation': lease.generation,
    ...(requireLive ? { 'activeLease.expiresAt': { $gt: new Date(nowMs) } } : {})
  };
}

async function assertActivePlaySession({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const lease = normalizeLeaseRequest(request, { requireLease: true });
  const active = await resolveLean(TcgPlayerState.findOne(
    exactLeaseFilter(accountId, lease, nowMs)
  ));
  if (active) return serializePlayerState(active, nowMs);
  throw sessionLost(await findPlayerState(TcgPlayerState, accountId), nowMs);
}

async function heartbeatPlaySession({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const lease = normalizeLeaseRequest(request, { requireLease: true });
  const updated = await TcgPlayerState.findOneAndUpdate(
    exactLeaseFilter(accountId, lease, nowMs),
    {
      $set: {
        'activeLease.heartbeatAt': new Date(nowMs),
        'activeLease.expiresAt': new Date(nowMs + PLAYER_LEASE_DURATION_MS)
      }
    },
    { new: true, runValidators: true }
  );
  if (updated) return serializePlayerState(updated, nowMs);
  throw sessionLost(await findPlayerState(TcgPlayerState, accountId), nowMs);
}

async function releasePlaySession({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const lease = normalizeLeaseRequest(request, { requireLease: true });
  for (let attempt = 0; attempt < MAX_PLAYER_STATE_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findPlayerState(TcgPlayerState, accountId);
    if (!snapshot || !snapshot.initialized) throw sessionLost(snapshot, nowMs);
    const currentLease = normalizeLease(snapshot.activeLease);
    if (currentLease.deviceId !== lease.deviceId
      || currentLease.leaseId !== lease.leaseId
      || currentLease.generation !== lease.generation) {
      throw sessionLost(snapshot, nowMs);
    }
    const updated = await TcgPlayerState.findOneAndUpdate(
      {
        ...snapshotFilter(snapshot),
        'activeLease.deviceId': lease.deviceId
      },
      {
        $set: {
          activeLease: emptyLease(currentLease.generation + 1, nowMs)
        }
      },
      { new: true, runValidators: true }
    );
    if (updated) return serializePlayerState(updated, nowMs);
  }
  throw new PlayerStateError('PLAYER_STATE_BUSY', '플레이 연결을 종료하는 중입니다. 다시 시도해 주세요.', 409);
}

async function saveGameState({
  TcgPlayerState,
  accountId,
  request = {},
  now = Date.now()
}) {
  const nowMs = toTimestamp(now);
  const lease = normalizeLeaseRequest(request, { requireLease: true });
  const baseRevision = normalizeGeneration(request.baseRevision, 'baseRevision');
  const state = normalizeGameState(request.state);
  const updated = await TcgPlayerState.findOneAndUpdate(
    {
      ...exactLeaseFilter(accountId, lease, nowMs),
      revision: baseRevision
    },
    {
      $set: {
        state,
        'activeLease.heartbeatAt': new Date(nowMs),
        'activeLease.expiresAt': new Date(nowMs + PLAYER_LEASE_DURATION_MS)
      },
      $inc: { revision: 1 }
    },
    { new: true, runValidators: true }
  );
  if (updated) return serializePlayerState(updated, nowMs);

  const snapshot = await findPlayerState(TcgPlayerState, accountId);
  const currentLease = normalizeLease(snapshot?.activeLease);
  const ownsLiveLease = Boolean(
    snapshot?.initialized
    && isLiveLease(currentLease, nowMs)
    && currentLease.leaseId === lease.leaseId
    && currentLease.deviceId === lease.deviceId
    && currentLease.generation === lease.generation
  );
  if (!ownsLiveLease) throw sessionLost(snapshot, nowMs);
  throw new PlayerStateError(
    'SAVE_CONFLICT',
    '다른 저장이 먼저 반영되었습니다. 최신 진행 기록을 다시 불러와 주세요.',
    409,
    serializePlayerState(snapshot, nowMs)
  );
}

module.exports = {
  MAX_GAME_STATE_BYTES,
  MAX_PLAYER_STATE_CAS_ATTEMPTS,
  PLAYER_LEASE_DURATION_MS,
  PLAYER_PLATFORMS,
  PlayerStateError,
  assertActivePlaySession,
  heartbeatPlaySession,
  isLiveLease,
  normalizeGameState,
  normalizePlatform,
  openPlaySession,
  releasePlaySession,
  saveGameState,
  serializePlayerState,
  takeoverPlaySession
};
