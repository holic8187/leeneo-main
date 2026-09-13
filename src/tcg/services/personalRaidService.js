'use strict';

const crypto = require('crypto');
const CARD_COMBAT_POWER = Object.freeze(require('../data/cardCombatPower.json'));

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PERSONAL_RAID_COOLDOWN_MS = 60 * 1000;
const PERSONAL_RAID_MAX_DAILY_CLEARS = 2;
const PERSONAL_RAID_MIN_SQUAD_SCORE = 1;
const PERSONAL_RAID_MAX_SQUAD_SCORE = 100_000;
const PERSONAL_RAID_MAX_SQUAD_SIZE = 3;
const MAX_CARD_ENHANCEMENT = 5;
const ENHANCEMENT_TOTAL_BONUSES = Object.freeze([0, 0.04, 0.10, 0.18, 0.28, 0.40]);
const DEFAULT_RANKING_LIMIT = 50;
const MAX_RANKING_LIMIT = 100;
const MAX_CAS_ATTEMPTS = 5;
const PERSONAL_RAID_CLEAR_REWARD = Object.freeze({ coins: 5_000, packs: 1 });

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

function positiveInteger(value) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function enhancementCountsForCard(collection, cardEnhancements, cardId) {
  const counts = Array(MAX_CARD_ENHANCEMENT + 1).fill(0);
  let remaining = positiveInteger(collection?.[cardId]);
  const saved = cardEnhancements?.[cardId];
  for (let stage = MAX_CARD_ENHANCEMENT; stage >= 1; stage -= 1) {
    const requested = Array.isArray(saved)
      ? positiveInteger(saved[stage])
      : positiveInteger(saved?.[stage]);
    counts[stage] = Math.min(requested, remaining);
    remaining -= counts[stage];
  }
  counts[0] = remaining;
  return counts;
}

function activeExpeditionLocks(playerState, now = Date.now()) {
  const expedition = playerState?.expedition;
  if (!expedition || typeof expedition !== 'object') return {};
  const endsAt = Number(expedition.endsAt);
  if (Number.isFinite(endsAt) && endsAt <= toTimestamp(now)) return {};

  const collection = playerState?.collection || {};
  const cardEnhancements = playerState?.cardEnhancements || {};
  const locks = {};
  for (const rawCardId of Array.isArray(expedition.squad) ? expedition.squad : []) {
    const cardId = String(rawCardId || '').trim();
    if (!cardId) continue;
    const owned = enhancementCountsForCard(collection, cardEnhancements, cardId);
    const locked = locks[cardId] || Array(MAX_CARD_ENHANCEMENT + 1).fill(0);
    const rawSavedStage = expedition.enhancementStages?.[cardId];
    const savedStage = rawSavedStage == null ? -1 : Number(rawSavedStage);
    if (Number.isSafeInteger(savedStage)
      && savedStage >= 0
      && savedStage <= MAX_CARD_ENHANCEMENT
      && owned[savedStage] > locked[savedStage]) {
      locked[savedStage] += 1;
      locks[cardId] = locked;
      continue;
    }
    for (let stage = MAX_CARD_ENHANCEMENT; stage >= 0; stage -= 1) {
      if (owned[stage] > locked[stage]) {
        locked[stage] += 1;
        locks[cardId] = locked;
        break;
      }
    }
  }
  return locks;
}

function enhancedCardPower(basePower, enhancement) {
  return Math.round(basePower * (1 + ENHANCEMENT_TOTAL_BONUSES[enhancement]));
}

function invalidRaidSquad(message, details = {}) {
  return new PersonalRaidError('INVALID_RAID_SQUAD', message, 400, details);
}

function validatePersonalRaidSquad({
  playerState,
  squad,
  submittedScore,
  allowImplicitEnhancement = false,
  skipUnavailable = false,
  now = Date.now()
} = {}) {
  if (!playerState || typeof playerState !== 'object' || Array.isArray(playerState)) {
    throw new PersonalRaidError(
      'RAID_PLAYER_STATE_UNAVAILABLE',
      '클라우드에 저장된 카드 정보를 불러온 뒤 다시 시도해 주세요.',
      409
    );
  }
  if (!Array.isArray(squad) || squad.length < 1 || squad.length > PERSONAL_RAID_MAX_SQUAD_SIZE) {
    throw invalidRaidSquad(`개인 레이드에는 서로 다른 카드를 1~${PERSONAL_RAID_MAX_SQUAD_SIZE}장 편성해 주세요.`, {
      maximumSquadSize: PERSONAL_RAID_MAX_SQUAD_SIZE
    });
  }

  const collection = playerState.collection;
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
    throw new PersonalRaidError(
      'RAID_PLAYER_STATE_UNAVAILABLE',
      '클라우드 카드 보유 정보를 불러온 뒤 다시 시도해 주세요.',
      409
    );
  }
  const cardEnhancements = playerState.cardEnhancements || {};
  const locks = activeExpeditionLocks(playerState, now);
  const seen = new Set();
  const verifiedSquad = [];
  let squadScore = 0;

  for (const rawDescriptor of squad) {
    const descriptor = typeof rawDescriptor === 'string'
      ? { cardId: rawDescriptor }
      : rawDescriptor;
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      throw invalidRaidSquad('레이드 카드 편성 정보가 올바르지 않습니다.');
    }
    const cardId = String(descriptor.cardId || '').trim();
    const hasClaimedEnhancement = Object.prototype.hasOwnProperty.call(descriptor, 'enhancement');
    const enhancement = hasClaimedEnhancement ? Number(descriptor.enhancement) : null;
    if (!cardId || (!allowImplicitEnhancement && !hasClaimedEnhancement)
      || (hasClaimedEnhancement && (!Number.isSafeInteger(enhancement)
        || enhancement < 0 || enhancement > MAX_CARD_ENHANCEMENT))) {
      throw invalidRaidSquad('레이드 카드 또는 강화 단계 정보가 올바르지 않습니다.');
    }
    if (seen.has(cardId)) {
      throw invalidRaidSquad('같은 종류의 카드는 강화 단계가 달라도 한 덱에 중복 편성할 수 없습니다.', {
        cardId
      });
    }
    seen.add(cardId);

    const basePower = Number(CARD_COMBAT_POWER[cardId]);
    if (!Number.isSafeInteger(basePower) || basePower < 1) {
      if (skipUnavailable) continue;
      throw invalidRaidSquad('현재 레이드에서 사용할 수 없는 카드가 포함되어 있습니다.', { cardId });
    }
    const owned = enhancementCountsForCard(collection, cardEnhancements, cardId);
    const locked = locks[cardId] || [];
    let expectedEnhancement = -1;
    for (let stage = MAX_CARD_ENHANCEMENT; stage >= 0; stage -= 1) {
      if (owned[stage] > (locked[stage] || 0)) {
        expectedEnhancement = stage;
        break;
      }
    }
    if (expectedEnhancement < 0) {
      if (skipUnavailable) continue;
      throw new PersonalRaidError(
        'RAID_CARD_UNAVAILABLE',
        '보유하지 않았거나 모험에 참여 중인 카드는 레이드에 편성할 수 없습니다.',
        409,
        { cardId }
      );
    }
    if (hasClaimedEnhancement && enhancement !== expectedEnhancement) {
      throw new PersonalRaidError(
        'RAID_CARD_STAGE_MISMATCH',
        '카드 강화 정보가 클라우드 기록과 일치하지 않습니다. 잠시 후 다시 시도해 주세요.',
        409,
        { cardId, expectedEnhancement }
      );
    }

    const power = enhancedCardPower(basePower, expectedEnhancement);
    squadScore += power;
    verifiedSquad.push({ cardId, enhancement: expectedEnhancement, power });
  }

  if (!verifiedSquad.length) {
    throw invalidRaidSquad('개인 레이드에 사용할 수 있는 카드를 1장 이상 편성해 주세요.');
  }
  squadScore = parseSquadScore(squadScore);
  if (submittedScore !== undefined && submittedScore !== null
    && parseSquadScore(submittedScore) !== squadScore) {
    throw new PersonalRaidError(
      'RAID_SQUAD_SCORE_MISMATCH',
      '전투력이 클라우드 카드 기록과 일치하지 않습니다. 최신 기록을 불러온 뒤 다시 시도해 주세요.',
      409,
      { verifiedSquadScore: squadScore }
    );
  }
  return { squad: verifiedSquad, squadScore };
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
    rewardKey: `${window.dayKey}:${boss.id}`,
    earnedRewards: {
      coins: clears * PERSONAL_RAID_CLEAR_REWARD.coins,
      packs: clears * PERSONAL_RAID_CLEAR_REWARD.packs
    },
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
  random = secureRandom,
  validateSession = null
}) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) {
    throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스 정보를 찾을 수 없습니다.', 404);
  }
  let score = null;
  async function validateDispatchRequest() {
    const validation = typeof validateSession === 'function' ? await validateSession() : null;
    const candidate = validation && Object.prototype.hasOwnProperty.call(validation, 'squadScore')
      ? validation.squadScore
      : squadScore;
    const verifiedScore = parseSquadScore(candidate);
    if (score !== null && verifiedScore !== score) {
      throw new PersonalRaidError(
        'RAID_SQUAD_CHANGED',
        '레이드 처리 중 카드 편성이 변경되었습니다. 다시 시도해 주세요.',
        409
      );
    }
    score = verifiedScore;
  }
  await validateDispatchRequest();
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

    // The lease can move to another device while damage is being calculated.
    // Recheck immediately before the raid row is committed.
    await validateDispatchRequest();
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
          coins: cleared ? PERSONAL_RAID_CLEAR_REWARD.coins : 0,
          packs: cleared ? PERSONAL_RAID_CLEAR_REWARD.packs : 0
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
  PERSONAL_RAID_CLEAR_REWARD,
  PERSONAL_RAID_COOLDOWN_MS,
  PERSONAL_RAID_MAX_DAILY_CLEARS,
  PERSONAL_RAID_MAX_SQUAD_SIZE,
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
  serializePersonalRaidState,
  validatePersonalRaidSquad
};
