'use strict';

const crypto = require('crypto');

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PERSONAL_RAID_COOLDOWN_MS = 60 * 1000;
const PERSONAL_RAID_MAX_DAILY_CLEARS = 2;
const PERSONAL_RAID_MIN_SQUAD_SCORE = 1;
const PERSONAL_RAID_MAX_SQUAD_SCORE = 60_000;
const DEFAULT_RANKING_LIMIT = 50;
const MAX_RANKING_LIMIT = 100;
const MAX_CAS_ATTEMPTS = 5;

const PERSONAL_RAID_BOSSES = Object.freeze({
  'deadline-dragon-raid': Object.freeze({
    id: 'deadline-dragon-raid',
    name: '마감기한 드래곤',
    maxHp: 2_800_000,
    damageMultiplier: 145,
    cooldownMs: PERSONAL_RAID_COOLDOWN_MS,
    maxDailyClears: PERSONAL_RAID_MAX_DAILY_CLEARS
  })
});

class PersonalRaidError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'PersonalRaidError';
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

function getKstDayWindow(now = Date.now()) {
  const nowMs = toTimestamp(now);
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const startsAtMs = Date.UTC(year, monthIndex, day) - KST_OFFSET_MS;
  const resetsAtMs = Date.UTC(year, monthIndex, day + 1) - KST_OFFSET_MS;
  return {
    dayKey,
    startsAt: new Date(startsAtMs),
    resetsAt: new Date(resetsAtMs)
  };
}

function getPersonalRaidBoss(bossId = 'deadline-dragon-raid') {
  return PERSONAL_RAID_BOSSES[String(bossId || '')] || null;
}

function parseSquadScore(value) {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && value.trim() === '')) {
    throw new PersonalRaidError(
      'INVALID_SQUAD_SCORE',
      `합산 전투력은 ${PERSONAL_RAID_MIN_SQUAD_SCORE.toLocaleString('ko-KR')}~${PERSONAL_RAID_MAX_SQUAD_SCORE.toLocaleString('ko-KR')} 사이의 정수여야 합니다.`,
      400,
      { minimum: PERSONAL_RAID_MIN_SQUAD_SCORE, maximum: PERSONAL_RAID_MAX_SQUAD_SCORE }
    );
  }
  const score = Number(value);
  if (!Number.isSafeInteger(score)
    || score < PERSONAL_RAID_MIN_SQUAD_SCORE
    || score > PERSONAL_RAID_MAX_SQUAD_SCORE) {
    throw new PersonalRaidError(
      'INVALID_SQUAD_SCORE',
      `합산 전투력은 ${PERSONAL_RAID_MIN_SQUAD_SCORE.toLocaleString('ko-KR')}~${PERSONAL_RAID_MAX_SQUAD_SCORE.toLocaleString('ko-KR')} 사이의 정수여야 합니다.`,
      400,
      { minimum: PERSONAL_RAID_MIN_SQUAD_SCORE, maximum: PERSONAL_RAID_MAX_SQUAD_SCORE }
    );
  }
  return score;
}

function secureRandom() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function calculatePersonalRaidDamage(squadScore, boss, random = secureRandom) {
  const score = parseSquadScore(squadScore);
  const roll = Math.min(0.999999, Math.max(0, Number(random()) || 0));
  const variance = 0.85 + (roll * 0.30);
  return Math.max(1, Math.floor(score * boss.damageMultiplier * variance));
}

function getRemainingCooldownMs(record, boss, now = Date.now()) {
  const lastDispatchAt = record?.lastDispatchAt ? new Date(record.lastDispatchAt).getTime() : 0;
  if (!Number.isFinite(lastDispatchAt) || lastDispatchAt <= 0) return 0;
  return Math.max(0, boss.cooldownMs - (toTimestamp(now) - lastDispatchAt));
}

function createEmptyState(account, boss, window, now = Date.now()) {
  return serializePersonalRaidState(null, account, boss, window, now);
}

function serializePersonalRaidState(record, account, boss, window, now = Date.now()) {
  const clears = Math.max(0, Number(record?.clearCount) || 0);
  const limitReached = clears >= boss.maxDailyClears;
  const remainingCooldownMs = getRemainingCooldownMs(record, boss, now);
  const currentHp = record
    ? Math.max(0, Math.min(boss.maxHp, Number(record.currentHp) || 0))
    : boss.maxHp;
  const lastDispatchAt = record?.lastDispatchAt ? new Date(record.lastDispatchAt) : null;
  return {
    mode: 'personal',
    dayKey: window.dayKey,
    resetsAt: window.resetsAt.getTime(),
    serverNow: toTimestamp(now),
    accountId: String(account?._id || account?.id || ''),
    nickname: String(account?.nickname || record?.nickname || ''),
    id: boss.id,
    bossId: boss.id,
    bossName: boss.name,
    hp: currentHp,
    maxHp: boss.maxHp,
    contribution: Math.max(0, Number(record?.contribution) || 0),
    totalContribution: Math.max(0, Number(record?.contribution) || 0),
    dispatches: Math.max(0, Number(record?.dispatchCount) || 0),
    clears,
    maxClears: boss.maxDailyClears,
    maxDailyClears: boss.maxDailyClears,
    cooldownMs: boss.cooldownMs,
    lastDispatchAt: lastDispatchAt ? lastDispatchAt.getTime() : 0,
    nextDispatchAt: lastDispatchAt ? lastDispatchAt.getTime() + boss.cooldownMs : 0,
    remainingCooldownMs,
    limitReached,
    canDispatch: !limitReached && remainingCooldownMs === 0
  };
}

async function resolveLean(queryOrValue) {
  if (queryOrValue && typeof queryOrValue.lean === 'function') return queryOrValue.lean();
  return queryOrValue;
}

async function findDailyRecord(TcgPersonalRaidDaily, key) {
  return resolveLean(TcgPersonalRaidDaily.findOne(key));
}

async function ensureDailyRecord(TcgPersonalRaidDaily, key, account, boss) {
  try {
    await TcgPersonalRaidDaily.updateOne(key, {
      $setOnInsert: {
        ...key,
        nickname: String(account.nickname || ''),
        currentHp: boss.maxHp,
        contribution: 0,
        dispatchCount: 0,
        clearCount: 0,
        lastDispatchAt: null,
        lastDamage: 0,
        lastSquadScore: 0,
        revision: 0
      }
    }, { upsert: true });
  } catch (error) {
    // Two first dispatches can race to create the same daily row. The unique index
    // picks one winner; the other request continues against that row.
    if (error?.code !== 11000) throw error;
  }
}

function assertDispatchAllowed(record, boss, nowMs) {
  const clears = Math.max(0, Number(record?.clearCount) || 0);
  if (clears >= boss.maxDailyClears) {
    throw new PersonalRaidError(
      'DAILY_CLEAR_LIMIT',
      `${boss.name}은 하루에 최대 ${boss.maxDailyClears}회까지만 클리어할 수 있습니다.`,
      429,
      { clears, maxDailyClears: boss.maxDailyClears }
    );
  }
  const remainingCooldownMs = getRemainingCooldownMs(record, boss, nowMs);
  if (remainingCooldownMs > 0) {
    throw new PersonalRaidError(
      'RAID_COOLDOWN',
      `다음 개인 레이드 파견까지 ${Math.ceil(remainingCooldownMs / 1000)}초 남았습니다.`,
      429,
      { remainingCooldownMs }
    );
  }
}

async function dispatchPersonalRaid({
  TcgPersonalRaidDaily,
  account,
  bossId = 'deadline-dragon-raid',
  squadScore,
  now = Date.now(),
  random = secureRandom
}) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) {
    throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스 정보를 찾을 수 없습니다.', 404);
  }
  const score = parseSquadScore(squadScore);
  const nowMs = toTimestamp(now);
  const nowDate = new Date(nowMs);
  const window = getKstDayWindow(nowMs);
  const accountId = account?._id || account?.id;
  const key = { accountId, dayKey: window.dayKey, bossId: boss.id };
  const rolledDamage = calculatePersonalRaidDamage(score, boss, random);

  await ensureDailyRecord(TcgPersonalRaidDaily, key, account, boss);

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findDailyRecord(TcgPersonalRaidDaily, key);
    if (!snapshot) continue;
    assertDispatchAllowed(snapshot, boss, nowMs);

    const previousHp = Math.max(1, Math.min(boss.maxHp, Number(snapshot.currentHp) || boss.maxHp));
    const damage = Math.min(previousHp, rolledDamage);
    const hpAfterHit = previousHp - damage;
    const cleared = hpAfterHit <= 0;
    const previousClears = Math.max(0, Number(snapshot.clearCount) || 0);
    const clearsAfter = previousClears + (cleared ? 1 : 0);
    const storedHp = cleared && clearsAfter < boss.maxDailyClears ? boss.maxHp : hpAfterHit;
    const revision = Math.max(0, Number(snapshot.revision) || 0);
    const lastDispatchAt = snapshot.lastDispatchAt ? new Date(snapshot.lastDispatchAt) : null;

    const updated = await TcgPersonalRaidDaily.findOneAndUpdate({
      _id: snapshot._id,
      revision,
      clearCount: previousClears,
      lastDispatchAt
    }, {
      $set: {
        nickname: String(account.nickname || snapshot.nickname || ''),
        currentHp: storedHp,
        lastDispatchAt: nowDate,
        lastDamage: damage,
        lastSquadScore: score,
        updatedAt: nowDate
      },
      $inc: {
        contribution: damage,
        dispatchCount: 1,
        clearCount: cleared ? 1 : 0,
        revision: 1
      }
    }, { new: true, runValidators: true });

    if (!updated) continue;
    return {
      record: typeof updated.toObject === 'function' ? updated.toObject() : updated,
      boss,
      window,
      result: {
        squadScore: score,
        damage,
        rolledDamage,
        bossHpBefore: previousHp,
        bossHpAfter: hpAfterHit,
        cleared,
        clearNumber: cleared ? clearsAfter : null,
        reward: {
          coins: cleared ? 5_000 : 0,
          packs: cleared ? 1 : 0
        }
      }
    };
  }

  throw new PersonalRaidError(
    'RAID_BUSY',
    '동시에 처리 중인 개인 레이드 요청이 있습니다. 잠시 후 다시 시도해주세요.',
    409
  );
}

async function getPersonalRaidState({
  TcgPersonalRaidDaily,
  account,
  bossId = 'deadline-dragon-raid',
  now = Date.now()
}) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스 정보를 찾을 수 없습니다.', 404);
  const nowMs = toTimestamp(now);
  const window = getKstDayWindow(nowMs);
  const record = await findDailyRecord(TcgPersonalRaidDaily, {
    accountId: account?._id || account?.id,
    dayKey: window.dayKey,
    bossId: boss.id
  });
  return {
    record,
    boss,
    window,
    state: serializePersonalRaidState(record, account, boss, window, nowMs)
  };
}

function normalizeRankingLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_RANKING_LIMIT), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RANKING_LIMIT;
  return Math.max(1, Math.min(MAX_RANKING_LIMIT, parsed));
}

async function getPersonalRaidRanking({
  TcgPersonalRaidDaily,
  account,
  bossId = 'deadline-dragon-raid',
  now = Date.now(),
  limit = DEFAULT_RANKING_LIMIT,
  ownRecord = undefined
}) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스 정보를 찾을 수 없습니다.', 404);
  const nowMs = toTimestamp(now);
  const window = getKstDayWindow(nowMs);
  const query = { dayKey: window.dayKey, bossId: boss.id, contribution: { $gt: 0 } };
  const rankingQuery = TcgPersonalRaidDaily.find(query)
    .sort({ contribution: -1, updatedAt: 1, _id: 1 })
    .limit(normalizeRankingLimit(limit));
  const records = await resolveLean(rankingQuery);
  const accountId = String(account?._id || account?.id || '');
  const mine = ownRecord === undefined
    ? await findDailyRecord(TcgPersonalRaidDaily, {
      accountId: account?._id || account?.id,
      dayKey: window.dayKey,
      bossId: boss.id
    })
    : ownRecord;
  const myContribution = Math.max(0, Number(mine?.contribution) || 0);
  const myRank = myContribution > 0
    ? (await TcgPersonalRaidDaily.countDocuments({
      dayKey: window.dayKey,
      bossId: boss.id,
      contribution: { $gt: myContribution }
    })) + 1
    : null;
  let previousContribution = null;
  let currentRank = 0;
  const entries = (records || []).map((record, index) => {
    const contribution = Math.max(0, Number(record.contribution) || 0);
    if (contribution !== previousContribution) currentRank = index + 1;
    previousContribution = contribution;
    return {
      rank: currentRank,
      accountId: String(record.accountId || ''),
      nickname: String(record.nickname || ''),
      contribution,
      clears: Math.max(0, Number(record.clearCount) || 0),
      dispatches: Math.max(0, Number(record.dispatchCount) || 0),
      isMe: String(record.accountId || '') === accountId
    };
  });
  const myEntry = myContribution > 0 ? {
    rank: myRank,
    accountId,
    nickname: String(account?.nickname || mine?.nickname || ''),
    contribution: myContribution,
    clears: Math.max(0, Number(mine?.clearCount) || 0),
    dispatches: Math.max(0, Number(mine?.dispatchCount) || 0),
    isMe: true
  } : null;

  return {
    mode: 'personal',
    bossId: boss.id,
    dayKey: window.dayKey,
    resetsAt: window.resetsAt.getTime(),
    serverNow: nowMs,
    entries,
    myRank,
    myEntry
  };
}

module.exports = {
  DEFAULT_RANKING_LIMIT,
  KST_OFFSET_MS,
  MAX_RANKING_LIMIT,
  PERSONAL_RAID_BOSSES,
  PERSONAL_RAID_COOLDOWN_MS,
  PERSONAL_RAID_MAX_DAILY_CLEARS,
  PERSONAL_RAID_MAX_SQUAD_SCORE,
  PERSONAL_RAID_MIN_SQUAD_SCORE,
  PersonalRaidError,
  calculatePersonalRaidDamage,
  createEmptyState,
  dispatchPersonalRaid,
  getKstDayWindow,
  getPersonalRaidBoss,
  getPersonalRaidRanking,
  getPersonalRaidState,
  getRemainingCooldownMs,
  normalizeRankingLimit,
  parseSquadScore,
  serializePersonalRaidState
};
