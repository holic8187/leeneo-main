'use strict';

const crypto = require('crypto');
const CARD_COMBAT_POWER = Object.freeze(require('../data/cardCombatPower.json'));
const CARD_ROLES = Object.freeze(require('../data/cardRoles.json'));

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERSONAL_RAID_MAX_DAILY_ENTRIES = 5;
const PERSONAL_RAID_MAX_STAGE = 10;
const PERSONAL_RAID_MAX_TURNS = 7;
const PERSONAL_RAID_SESSION_MS = 30 * 60 * 1000;
const PERSONAL_RAID_MIN_SQUAD_SCORE = 1;
const PERSONAL_RAID_MAX_SQUAD_SCORE = 200_000;
const PERSONAL_RAID_MAX_SQUAD_SIZE = 4;
const MAX_CARD_ENHANCEMENT = 5;
const ENHANCEMENT_TOTAL_BONUSES = Object.freeze([0, 0.04, 0.10, 0.18, 0.28, 0.40]);
const DEFAULT_RANKING_LIMIT = 50;
const MAX_RANKING_LIMIT = 100;
const MAX_CAS_ATTEMPTS = 6;
const RAID_SCHEMA_VERSION = 3;
const PERSONAL_RAID_CLEAR_REWARD = Object.freeze({ coins: 0, packs: 3 });
const PERSONAL_RAID_COOLDOWN_MS = 0; // v1 compatibility export
const PERSONAL_RAID_MAX_DAILY_CLEARS = PERSONAL_RAID_MAX_DAILY_ENTRIES; // v1 compatibility export
const CARD_RARITY_SUFFIXES = new Set(['c', 'u', 'r', 'rr', 'rrr', 'sr', 'hr', 'ur', 'ssr']);
const RAID_RELIC_ID = 'luxury-bag';
const MAX_RAID_BONUS_REWARDS = PERSONAL_RAID_MAX_STAGE * 2;
const RAID_SR_PLUS_RARITY_WEIGHTS = Object.freeze([
  Object.freeze({ rarity: 'sr', weight: 70 }),
  Object.freeze({ rarity: 'hr', weight: 22 }),
  Object.freeze({ rarity: 'ur', weight: 7 }),
  Object.freeze({ rarity: 'ssr', weight: 1 })
]);
const RAID_SR_PLUS_CARD_POOLS = Object.freeze(Object.fromEntries(
  RAID_SR_PLUS_RARITY_WEIGHTS.map(({ rarity }) => [
    rarity,
    Object.freeze(Object.keys(CARD_COMBAT_POWER).filter((cardId) => cardId.endsWith(`-${rarity}`)))
  ])
));

function cardCharacterKey(cardId) {
  const normalized = String(cardId || '').trim();
  const separator = normalized.lastIndexOf('-');
  if (separator <= 0 || !CARD_RARITY_SUFFIXES.has(normalized.slice(separator + 1))) return normalized;
  return normalized.slice(0, separator);
}

const STAGE_HP = Object.freeze([0, 100_000, 200_000, 400_000, 800_000, 1_600_000, 3_200_000, 6_400_000, 12_800_000, 25_600_000, 51_200_000]);
const DEADLINE_DRAGON_SKILLS = Object.freeze([
  Object.freeze({ id: 'deadline-swipe', name: '마감의 휩쓸기', unlockStage: 2, cooldownTurns: 3, target: 'random-two-living-cards', damage: 30, description: '무작위 생존 카드 2장에게 각각 30의 피해를 줍니다.' }),
  Object.freeze({ id: 'overtime-order', name: '야근 명령', unlockStage: 3, cooldownTurns: 4, target: 'all-living-cards', damage: 18, description: '생존한 모든 카드에게 18의 피해를 줍니다.' }),
  Object.freeze({ id: 'urgent-revision', name: '긴급 수정 요청', unlockStage: 4, cooldownTurns: 4, target: 'highest-power-living-card', damage: 42, status: Object.freeze({ id: 'seal', turns: 1 }), description: '전투력이 가장 높은 생존 카드에게 42의 피해를 주고 다음 스킬 사용을 1회 봉인합니다.' }),
  Object.freeze({ id: 'deadline-roar', name: '마감 폭주', unlockStage: 5, cooldownTurns: 5, target: 'self', buff: Object.freeze({ id: 'attack-up', percent: 25, bossActions: 3 }), description: '자신의 공격 피해를 다음 3회 행동 동안 25% 높입니다.' }),
  Object.freeze({ id: 'burning-overtime', name: '불타는 야근', unlockStage: 6, cooldownTurns: 4, target: 'all-living-cards', damage: 24, status: Object.freeze({ id: 'burn', damage: 8, turns: 2 }), description: '생존한 모든 카드에게 24의 피해를 주고 2턴 동안 턴마다 8의 화상 피해를 줍니다.' }),
  Object.freeze({ id: 'final-inspection', name: '최종 검수', unlockStage: 7, cooldownTurns: 5, target: 'self', shieldPercentOfStageHp: 5, description: '단계 최대 HP의 5%만큼 보호막을 얻습니다.' }),
  Object.freeze({ id: 'absolute-deadline', name: '절대 마감', unlockStage: 8, cooldownTurns: 5, target: 'all-living-cards', damage: 38, status: Object.freeze({ id: 'damage-down', percent: 20, turns: 2 }), description: '생존한 모든 카드에게 38의 피해를 주고 2턴 동안 피해량을 20% 낮춥니다.' })
]);

const PERSONAL_RAID_BOSSES = Object.freeze({
  'deadline-dragon-raid': Object.freeze({
    id: 'deadline-dragon-raid',
    name: '마감기한 드래곤',
    maxStage: PERSONAL_RAID_MAX_STAGE,
    stageHp: STAGE_HP,
    basicAttack: Object.freeze({ target: 'random-living-card', damageFormula: '9 + stage' }),
    skills: DEADLINE_DRAGON_SKILLS,
    maxDailyEntries: PERSONAL_RAID_MAX_DAILY_ENTRIES
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
  const result = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(result)) throw new TypeError('A valid date is required.');
  return result;
}

function formatShiftedDate(shifted) {
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function getKstDayWindow(now = Date.now()) {
  const nowMs = toTimestamp(now);
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const startsAt = new Date(midnightShifted - KST_OFFSET_MS);
  return { dayKey: formatShiftedDate(shifted), startsAt, resetsAt: new Date(startsAt.getTime() + DAY_MS) };
}

function getKstRaidWeekWindow(now = Date.now()) {
  const nowMs = toTimestamp(now);
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  const startsAt = new Date(midnightShifted - (daysSinceMonday * DAY_MS) - KST_OFFSET_MS);
  const weekKey = formatShiftedDate(new Date(startsAt.getTime() + KST_OFFSET_MS));
  return { weekKey, startsAt, resetsAt: new Date(startsAt.getTime() + (7 * DAY_MS)), resetRule: 'MONDAY_00_KST' };
}

function clearRewardForStage(stage) {
  return { coins: 0, packs: Math.max(1, Math.min(PERSONAL_RAID_MAX_STAGE, Math.floor(Number(stage) || 1))) * 3 };
}

function cumulativeClearRewards(clearCount) {
  const clears = Math.max(0, Math.min(PERSONAL_RAID_MAX_STAGE, Math.floor(Number(clearCount) || 0)));
  return { coins: 0, packs: 3 * clears * (clears + 1) / 2 };
}

function randomUnit(random = Math.random) {
  return Math.min(0.999999, Math.max(0, Number(random()) || 0));
}

function relicDropChanceForStage(stage) {
  const normalized = Math.max(1, Math.min(PERSONAL_RAID_MAX_STAGE, Math.floor(Number(stage) || 1)));
  return normalized >= 5 ? (normalized - 4) * 0.005 : 0;
}

function stageBonusRewardId(weekKey, bossId, stage, type) {
  return `${String(weekKey || '').trim()}:${String(bossId || '').trim()}:stage-${stage}:${type}`.slice(0, 200);
}

function normalizeRaidBonusRewards(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || normalized.length >= MAX_RAID_BONUS_REWARDS) continue;
    const id = String(raw.id || '').trim().slice(0, 200);
    const type = String(raw.type || '').trim();
    const stage = Math.max(1, Math.min(PERSONAL_RAID_MAX_STAGE, Math.floor(Number(raw.stage) || 1)));
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(raw.quantity) || 1)));
    if (!id || seen.has(id)) continue;
    if (type === 'relic') {
      const relicId = String(raw.relicId || '').trim().slice(0, 120);
      if (!relicId) continue;
      normalized.push({ id, type, relicId, quantity, stage });
    } else if (type === 'card') {
      const cardId = String(raw.cardId || '').trim().slice(0, 120);
      const rarity = String(raw.rarity || cardId.slice(cardId.lastIndexOf('-') + 1)).trim().toLowerCase();
      if (!cardId || !RAID_SR_PLUS_CARD_POOLS[rarity]?.includes(cardId)) continue;
      normalized.push({ id, type, cardId, rarity, quantity, stage });
    } else {
      continue;
    }
    seen.add(id);
  }
  return normalized;
}

function rollSrPlusRarity(random = Math.random) {
  const roll = randomUnit(random) * 100;
  let threshold = 0;
  for (const entry of RAID_SR_PLUS_RARITY_WEIGHTS) {
    threshold += entry.weight;
    if (roll < threshold) return entry.rarity;
  }
  return 'ssr';
}

function rollStageClearBonuses({ stage, weekKey, bossId, random = Math.random } = {}) {
  const normalizedStage = Math.max(1, Math.min(PERSONAL_RAID_MAX_STAGE, Math.floor(Number(stage) || 1)));
  const bonuses = [];
  const relicChance = relicDropChanceForStage(normalizedStage);
  if (relicChance > 0 && randomUnit(random) < relicChance) {
    bonuses.push({
      id: stageBonusRewardId(weekKey, bossId, normalizedStage, 'relic'),
      type: 'relic',
      relicId: RAID_RELIC_ID,
      quantity: 1,
      stage: normalizedStage
    });
  }
  if (normalizedStage >= 8) {
    const rarity = rollSrPlusRarity(random);
    const pool = RAID_SR_PLUS_CARD_POOLS[rarity] || [];
    if (pool.length) {
      const cardId = pool[Math.floor(randomUnit(random) * pool.length)];
      bonuses.push({
        id: stageBonusRewardId(weekKey, bossId, normalizedStage, 'card'),
        type: 'card',
        cardId,
        rarity,
        quantity: 1,
        stage: normalizedStage
      });
    }
  }
  return bonuses;
}

function appendRaidBonusRewards(existing, additions) {
  return normalizeRaidBonusRewards([...normalizeRaidBonusRewards(existing), ...additions]);
}

function playerCardLevel(playerState, cardId) {
  return Math.max(1, Math.min(100, Math.floor(Number(playerState?.cardProgression?.[cardId]?.level) || 1)));
}

function levelAttackBonus(playerState, cardId) {
  const gainedLevels = playerCardLevel(playerState, cardId) - 1;
  if (CARD_ROLES[cardId] === 'attack') return gainedLevels * 2;
  if (CARD_ROLES[cardId] === 'support') return gainedLevels;
  return 0;
}

function selectedRaidWeaponMultiplier(playerState) {
  const equipmentId = String(playerState?.selectedRaidEquipmentId || '');
  const equipment = Array.isArray(playerState?.equipmentInventory)
    ? playerState.equipmentInventory.find((item) => String(item?.id || '') === equipmentId)
    : null;
  if (equipment?.type !== 'weapon') return 1;
  return 1 + Math.max(0, Math.min(100, Number(equipment.bonusPercent) || 0)) / 100;
}

function getPersonalRaidBoss(bossId = 'deadline-dragon-raid') {
  return PERSONAL_RAID_BOSSES[String(bossId || '')] || null;
}

function getBossStage(boss, value) {
  const stage = Math.max(1, Math.min(boss.maxStage, Math.floor(Number(value) || 1)));
  return {
    stage,
    maxHp: boss.stageHp[stage],
    basicAttack: { target: boss.basicAttack.target, damage: 9 + stage, description: `무작위 생존 카드 1장에게 ${9 + stage}의 피해를 줍니다.` },
    skills: boss.skills.filter((skill) => skill.unlockStage <= stage)
  };
}

function parseSquadScore(value) {
  const score = Number(value);
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())
    || !Number.isSafeInteger(score) || score < PERSONAL_RAID_MIN_SQUAD_SCORE || score > PERSONAL_RAID_MAX_SQUAD_SCORE) {
    throw new PersonalRaidError('INVALID_SQUAD_SCORE', '합산 전투력이 올바르지 않습니다.', 400, { minimum: 1, maximum: PERSONAL_RAID_MAX_SQUAD_SCORE });
  }
  return score;
}

function parseSubmittedDamage(value) {
  const damage = Number(value);
  if (!Number.isSafeInteger(damage) || damage < 0) throw new PersonalRaidError('INVALID_RAID_DAMAGE', '레이드 피해량은 0 이상의 정수여야 합니다.', 400);
  return damage;
}

function positiveInteger(value) {
  const result = Math.floor(Number(value));
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function enhancementCountsForCard(collection, enhancements, cardId) {
  const counts = Array(MAX_CARD_ENHANCEMENT + 1).fill(0);
  let remaining = positiveInteger(collection?.[cardId]);
  const saved = enhancements?.[cardId];
  for (let stage = MAX_CARD_ENHANCEMENT; stage >= 1; stage -= 1) {
    counts[stage] = Math.min(positiveInteger(saved?.[stage]), remaining);
    remaining -= counts[stage];
  }
  counts[0] = remaining;
  return counts;
}

function activeExpeditionLocks(playerState, now) {
  const expedition = playerState?.expedition;
  if (!expedition || typeof expedition !== 'object') return {};
  if (Number.isFinite(Number(expedition.endsAt)) && Number(expedition.endsAt) <= toTimestamp(now)) return {};
  const locks = {};
  for (const rawId of Array.isArray(expedition.squad) ? expedition.squad : []) {
    const cardId = String(rawId || '').trim();
    if (!cardId) continue;
    const owned = enhancementCountsForCard(playerState.collection, playerState.cardEnhancements, cardId);
    const locked = locks[cardId] || Array(MAX_CARD_ENHANCEMENT + 1).fill(0);
    const savedStage = Number(expedition.enhancementStages?.[cardId]);
    if (Number.isSafeInteger(savedStage) && savedStage >= 0 && savedStage <= MAX_CARD_ENHANCEMENT && owned[savedStage] > locked[savedStage]) {
      locked[savedStage] += 1;
    } else {
      for (let stage = MAX_CARD_ENHANCEMENT; stage >= 0; stage -= 1) {
        if (owned[stage] > locked[stage]) { locked[stage] += 1; break; }
      }
    }
    locks[cardId] = locked;
  }
  return locks;
}

function validatePersonalRaidSquad({ playerState, squad, submittedScore, allowImplicitEnhancement = false, skipUnavailable = false, now = Date.now() } = {}) {
  if (!playerState || typeof playerState !== 'object' || Array.isArray(playerState) || !playerState.collection || Array.isArray(playerState.collection)) {
    throw new PersonalRaidError('RAID_PLAYER_STATE_UNAVAILABLE', '클라우드 카드 보유 정보를 불러온 뒤 다시 시도해 주세요.', 409);
  }
  if (!Array.isArray(squad) || squad.length !== PERSONAL_RAID_MAX_SQUAD_SIZE) {
    throw new PersonalRaidError('INVALID_RAID_SQUAD', '개인 레이드에는 서로 다른 카드 4장을 편성해 주세요.', 400, { requiredSquadSize: 4, maximumSquadSize: 4 });
  }
  const locks = activeExpeditionLocks(playerState, now);
  const seen = new Set();
  const seenCharacters = new Set();
  const verifiedSquad = [];
  let squadScore = 0;
  const weaponMultiplier = selectedRaidWeaponMultiplier(playerState);
  for (const raw of squad) {
    const descriptor = typeof raw === 'string' ? { cardId: raw } : raw;
    const cardId = String(descriptor?.cardId || '').trim();
    const hasStage = Boolean(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'enhancement'));
    const claimedStage = Number(descriptor?.enhancement);
    if (!cardId || (!hasStage && !allowImplicitEnhancement) || (hasStage && (!Number.isSafeInteger(claimedStage) || claimedStage < 0 || claimedStage > 5))) {
      throw new PersonalRaidError('INVALID_RAID_SQUAD', '레이드 카드 또는 강화 단계 정보가 올바르지 않습니다.', 400);
    }
    if (seen.has(cardId)) throw new PersonalRaidError('INVALID_RAID_SQUAD', '같은 종류의 카드는 한 덱에 중복 편성할 수 없습니다.', 400, { cardId });
    seen.add(cardId);
    const characterKey = cardCharacterKey(cardId);
    if (seenCharacters.has(characterKey)) throw new PersonalRaidError('INVALID_RAID_SQUAD', '등급이 달라도 같은 인물은 한 파티에 중복 편성할 수 없습니다.', 400, { cardId, characterId: characterKey });
    seenCharacters.add(characterKey);
    const basePower = Number(CARD_COMBAT_POWER[cardId]);
    if (!Number.isSafeInteger(basePower) || basePower < 1) {
      if (skipUnavailable) continue;
      throw new PersonalRaidError('INVALID_RAID_SQUAD', '현재 레이드에서 사용할 수 없는 카드가 포함되어 있습니다.', 400, { cardId });
    }
    const owned = enhancementCountsForCard(playerState.collection, playerState.cardEnhancements || {}, cardId);
    const locked = locks[cardId] || [];
    let expectedStage = -1;
    for (let stage = 5; stage >= 0; stage -= 1) if (owned[stage] > (locked[stage] || 0)) { expectedStage = stage; break; }
    if (expectedStage < 0) {
      if (skipUnavailable) continue;
      throw new PersonalRaidError('RAID_CARD_UNAVAILABLE', '보유하지 않았거나 모험에 참여 중인 카드는 레이드에 편성할 수 없습니다.', 409, { cardId });
    }
    if (hasStage && claimedStage !== expectedStage) throw new PersonalRaidError('RAID_CARD_STAGE_MISMATCH', '카드 강화 정보가 클라우드 기록과 일치하지 않습니다.', 409, { cardId, expectedEnhancement: expectedStage });
    const power = Math.round((Math.round(basePower * (1 + ENHANCEMENT_TOTAL_BONUSES[expectedStage])) + levelAttackBonus(playerState, cardId)) * weaponMultiplier);
    squadScore += power;
    verifiedSquad.push({ slot: verifiedSquad.length + 1, cardId, enhancement: expectedStage, power });
  }
  if (!verifiedSquad.length) throw new PersonalRaidError('INVALID_RAID_SQUAD', '레이드에 사용할 수 있는 카드가 없습니다.', 400);
  squadScore = parseSquadScore(squadScore);
  if (submittedScore != null && parseSquadScore(submittedScore) !== squadScore) {
    throw new PersonalRaidError('RAID_SQUAD_SCORE_MISMATCH', '전투력이 클라우드 카드 기록과 일치하지 않습니다.', 409, { verifiedSquadScore: squadScore });
  }
  return { squad: verifiedSquad, squadScore };
}

function calculatePersonalRaidDamage(squadScore, boss, random = Math.random) {
  const roll = Math.min(0.999999, Math.max(0, Number(random()) || 0));
  return Math.max(1, Math.floor(parseSquadScore(squadScore) * 10 * (0.85 + (roll * 0.30))));
}

function normalizedProgress(record, boss) {
  if (Number(record?.schemaVersion) !== RAID_SCHEMA_VERSION) return { stage: 1, hp: boss.stageHp[1], contribution: 0, completed: false };
  const stage = Math.max(1, Math.min(boss.maxStage, Math.floor(Number(record.currentStage) || 1)));
  const maxHp = boss.stageHp[stage];
  const rawHp = Math.max(0, Math.min(maxHp, Math.floor(Number(record.currentHp) || 0)));
  return { stage, hp: record.weeklyCompleted ? 0 : (rawHp || maxHp), contribution: Math.max(0, Math.floor(Number(record.contribution) || 0)), completed: Boolean(record.weeklyCompleted) };
}

async function resolveLean(value) { return value && typeof value.lean === 'function' ? value.lean() : value; }
async function findRecord(Model, key) { return resolveLean(Model.findOne(key)); }

async function ensureWeeklyRecord(Model, key, account, boss) {
  try {
    await Model.updateOne(key, { $setOnInsert: {
      ...key, weekKey: key.dayKey, schemaVersion: RAID_SCHEMA_VERSION, nickname: String(account.nickname || ''),
      currentStage: 1, currentHp: boss.stageHp[1], contribution: 0, dispatchCount: 0, clearCount: 0,
      dailyEntryDayKey: '', dailyEntryCount: 0, activeSession: null, lastFinishedSessionId: '',
      lastDamage: 0, lastSquadScore: 0, bonusRewards: [], weeklyCompleted: false, revision: 0
    } }, { upsert: true });
  } catch (error) { if (error?.code !== 11000) throw error; }
}

function sessionPublicView(session) {
  if (!session) return null;
  return {
    sessionId: String(session.sessionId || ''), stage: Number(session.stage) || 1,
    bossHpBefore: Number(session.bossHpBefore) || 0, stageMaxHp: Number(session.stageMaxHp) || 0,
    squad: Array.isArray(session.squad) ? session.squad : [], squadScore: Number(session.squadScore) || 0,
    startedAt: new Date(session.startedAt).getTime(), expiresAt: new Date(session.expiresAt).getTime()
  };
}

function serializePersonalRaidState(record, account, boss, window, now = Date.now()) {
  const nowMs = toTimestamp(now);
  const week = window?.weekKey ? window : getKstRaidWeekWindow(nowMs);
  const day = getKstDayWindow(nowMs);
  const currentRules = Number(record?.schemaVersion) === RAID_SCHEMA_VERSION;
  const progress = normalizedProgress(record, boss);
  const entriesToday = record?.dailyEntryDayKey === day.dayKey ? Math.max(0, Number(record.dailyEntryCount) || 0) : 0;
  const activeSession = currentRules && record?.activeSession && new Date(record.activeSession.expiresAt).getTime() > nowMs ? sessionPublicView(record.activeSession) : null;
  const clears = currentRules ? Math.max(0, Number(record?.clearCount) || 0) : 0;
  const dispatches = currentRules ? Math.max(0, Number(record?.dispatchCount) || 0) : 0;
  const stageConfig = getBossStage(boss, progress.stage);
  const canEnter = !progress.completed && entriesToday < boss.maxDailyEntries && !activeSession;
  return {
    mode: 'personal', rulesVersion: RAID_SCHEMA_VERSION, resetRule: week.resetRule, weekKey: week.weekKey, dayKey: day.dayKey,
    resetsAt: week.resetsAt.getTime(), dailyResetsAt: day.resetsAt.getTime(), serverNow: nowMs,
    accountId: String(account?._id || account?.id || ''), nickname: String(account?.nickname || record?.nickname || ''),
    id: boss.id, bossId: boss.id, bossName: boss.name, stage: progress.stage, maxStage: boss.maxStage,
    hp: progress.hp, currentHp: progress.hp, maxHp: stageConfig.maxHp, boss: stageConfig,
    contribution: progress.contribution, totalContribution: progress.contribution, score: progress.contribution,
    entriesToday, remainingEntries: Math.max(0, boss.maxDailyEntries - entriesToday), maxDailyEntries: boss.maxDailyEntries,
    dispatches, clears,
    weeklyCompleted: progress.completed, activeSession, canEnter, canDispatch: canEnter,
    limitReached: entriesToday >= boss.maxDailyEntries, cooldownMs: 0, remainingCooldownMs: 0,
    rewardKey: `${week.weekKey}:${boss.id}`,
    earnedRewards: {
      ...cumulativeClearRewards(clears),
      bonuses: currentRules ? normalizeRaidBonusRewards(record?.bonusRewards) : []
    }
  };
}

function createEmptyState(account, boss, window, now) { return serializePersonalRaidState(null, account, boss, window, now); }

async function startPersonalRaid({ TcgPersonalRaidDaily, account, bossId = 'deadline-dragon-raid', verifiedSquad, now = Date.now(), validateSession = null }) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스를 찾을 수 없습니다.', 404);
  const nowMs = toTimestamp(now); const nowDate = new Date(nowMs); const week = getKstRaidWeekWindow(nowMs); const day = getKstDayWindow(nowMs);
  const key = { accountId: account?._id || account?.id, dayKey: week.weekKey, bossId: boss.id };
  let verified = verifiedSquad;
  const revalidate = async () => {
    if (typeof validateSession === 'function') verified = await validateSession();
    if (!verified?.squad?.length) throw new PersonalRaidError('INVALID_RAID_SQUAD', '개인 레이드 덱을 확인할 수 없습니다.', 400);
    parseSquadScore(verified.squadScore);
  };
  await revalidate();
  await ensureWeeklyRecord(TcgPersonalRaidDaily, key, account, boss);
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findRecord(TcgPersonalRaidDaily, key); if (!snapshot) continue;
    const migrating = Number(snapshot.schemaVersion) !== RAID_SCHEMA_VERSION;
    const progress = normalizedProgress(snapshot, boss);
    if (progress.completed) throw new PersonalRaidError('RAID_WEEKLY_COMPLETE', `이번 주 개인 레이드 ${boss.maxStage}단계를 모두 완료했습니다.`, 409);
    if (!migrating && snapshot.activeSession && new Date(snapshot.activeSession.expiresAt).getTime() > nowMs) throw new PersonalRaidError('RAID_SESSION_ACTIVE', '이미 진행 중인 개인 레이드가 있습니다.', 409, { activeSession: sessionPublicView(snapshot.activeSession) });
    const used = snapshot.dailyEntryDayKey === day.dayKey ? Math.max(0, Number(snapshot.dailyEntryCount) || 0) : 0;
    if (used >= boss.maxDailyEntries) throw new PersonalRaidError('DAILY_ENTRY_LIMIT', '개인 레이드는 하루에 5회까지 입장할 수 있습니다.', 429, { entriesToday: used, maxDailyEntries: 5, dailyResetsAt: day.resetsAt.getTime() });
    const session = { sessionId: crypto.randomUUID(), stage: progress.stage, bossHpBefore: progress.hp, stageMaxHp: boss.stageHp[progress.stage], squad: verified.squad, squadScore: verified.squadScore, startedAt: nowDate, expiresAt: new Date(nowMs + PERSONAL_RAID_SESSION_MS), dayKey: day.dayKey };
    await revalidate();
    const resetFields = migrating ? {
      clearCount: 0,
      dispatchCount: 1,
      lastFinishedSessionId: '',
      lastFinishedResult: null,
      lastDamage: 0,
      bonusRewards: []
    } : {};
    const incrementFields = migrating ? { revision: 1 } : { dispatchCount: 1, revision: 1 };
    const updated = await TcgPersonalRaidDaily.findOneAndUpdate({ _id: snapshot._id, revision: Number(snapshot.revision) || 0 }, { $set: {
      ...resetFields,
      schemaVersion: RAID_SCHEMA_VERSION, weekKey: week.weekKey, nickname: String(account.nickname || snapshot.nickname || ''),
      currentStage: progress.stage, currentHp: progress.hp, contribution: progress.contribution, weeklyCompleted: false,
      dailyEntryDayKey: day.dayKey, dailyEntryCount: used + 1, activeSession: session,
      lastSquadScore: verified.squadScore, lastDispatchAt: nowDate, updatedAt: nowDate
    }, $inc: incrementFields }, { new: true, runValidators: true });
    if (!updated) continue;
    return { record: typeof updated.toObject === 'function' ? updated.toObject() : updated, boss, window: week, session: sessionPublicView(session) };
  }
  throw new PersonalRaidError('RAID_BUSY', '동시에 처리 중인 레이드 요청이 있습니다.', 409);
}

async function finishPersonalRaid({ TcgPersonalRaidDaily, account, bossId = 'deadline-dragon-raid', sessionId, damageDealt, bossHpRemaining, turns, battleLog, now = Date.now(), validateSession = null, random = Math.random }) {
  const boss = getPersonalRaidBoss(bossId);
  if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스를 찾을 수 없습니다.', 404);
  const damage = parseSubmittedDamage(damageDealt); const id = String(sessionId || '').trim();
  if (!id) throw new PersonalRaidError('RAID_SESSION_REQUIRED', '레이드 전투 세션이 필요합니다.', 400);
  if (turns != null && (!Number.isSafeInteger(Number(turns)) || Number(turns) < 0 || Number(turns) > PERSONAL_RAID_MAX_TURNS)) {
    throw new PersonalRaidError('INVALID_RAID_TURNS', `개인 레이드는 최대 ${PERSONAL_RAID_MAX_TURNS}턴까지 진행할 수 있습니다.`, 400, { maximumTurns: PERSONAL_RAID_MAX_TURNS });
  }
  if (battleLog != null && (!Array.isArray(battleLog) || battleLog.length > 20_000)) throw new PersonalRaidError('INVALID_RAID_LOG', '전투 기록이 올바르지 않습니다.', 400);
  const nowMs = toTimestamp(now); const nowDate = new Date(nowMs); const week = getKstRaidWeekWindow(nowMs);
  const key = { accountId: account?._id || account?.id, dayKey: week.weekKey, bossId: boss.id };
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const snapshot = await findRecord(TcgPersonalRaidDaily, key);
    if (!snapshot) throw new PersonalRaidError('RAID_SESSION_NOT_FOUND', '진행 중인 레이드를 찾을 수 없습니다.', 404);
    if (String(snapshot.lastFinishedSessionId || '') === id) {
      if (snapshot.lastFinishedResult && typeof snapshot.lastFinishedResult === 'object') {
        return { record: snapshot, boss, window: week, result: snapshot.lastFinishedResult };
      }
      throw new PersonalRaidError('RAID_SESSION_ALREADY_FINISHED', '이미 반영된 레이드 결과입니다.', 409);
    }
    const session = snapshot.activeSession;
    if (!session || String(session.sessionId || '') !== id) throw new PersonalRaidError('RAID_SESSION_MISMATCH', '현재 진행 중인 레이드와 일치하지 않습니다.', 409);
    if (new Date(session.expiresAt).getTime() <= nowMs) throw new PersonalRaidError('RAID_SESSION_EXPIRED', '레이드 전투 시간이 만료되었습니다.', 409);
    const progress = normalizedProgress(snapshot, boss);
    if (Number(session.stage) !== progress.stage || Number(session.bossHpBefore) !== progress.hp) throw new PersonalRaidError('RAID_PROGRESS_CHANGED', '레이드 진행 기록이 변경되었습니다.', 409);
    const limit = Math.min(boss.stageHp[progress.stage], progress.hp, Number(session.bossHpBefore));
    if (damage > limit) throw new PersonalRaidError('RAID_DAMAGE_EXCEEDS_LIMIT', '제출한 피해량이 현재 보스 HP를 초과합니다.', 400, { maximumDamage: limit, stageMaxHp: boss.stageHp[progress.stage], bossHpBefore: progress.hp });
    const remaining = progress.hp - damage;
    if (bossHpRemaining != null && (!Number.isSafeInteger(Number(bossHpRemaining)) || Number(bossHpRemaining) !== remaining)) throw new PersonalRaidError('RAID_HP_MISMATCH', '남은 보스 HP와 피해량이 일치하지 않습니다.', 409, { expectedBossHpRemaining: remaining });
    if (typeof validateSession === 'function') await validateSession();
    const cleared = remaining === 0; const completed = cleared && progress.stage === boss.maxStage;
    const nextStage = cleared && !completed ? progress.stage + 1 : progress.stage;
    const storedHp = cleared ? (completed ? 0 : boss.stageHp[nextStage]) : remaining;
    const bonuses = cleared ? rollStageClearBonuses({
      stage: progress.stage,
      weekKey: week.weekKey,
      bossId: boss.id,
      random
    }) : [];
    const bonusRewards = appendRaidBonusRewards(snapshot.bonusRewards, bonuses);
    const result = { sessionId: id, stage: progress.stage, squadScore: Number(session.squadScore) || 0, damage, damageDealt: damage, bossHpBefore: progress.hp, bossHpAfter: remaining, bossHpRemaining: remaining, turns: Number(turns) || 0, cleared, weeklyCompleted: completed, nextStage, totalContribution: progress.contribution + damage, reward: { ...(cleared ? clearRewardForStage(progress.stage) : { coins: 0, packs: 0 }), bonuses } };
    const updated = await TcgPersonalRaidDaily.findOneAndUpdate({ _id: snapshot._id, revision: Number(snapshot.revision) || 0, 'activeSession.sessionId': id }, { $set: {
      nickname: String(account.nickname || snapshot.nickname || ''), currentStage: nextStage, currentHp: storedHp,
      weeklyCompleted: completed, activeSession: null, lastFinishedSessionId: id, lastFinishedResult: result,
      lastDamage: damage, bonusRewards, updatedAt: nowDate
    }, $inc: { contribution: damage, clearCount: cleared ? 1 : 0, revision: 1 } }, { new: true, runValidators: true });
    if (!updated) continue;
    return { record: typeof updated.toObject === 'function' ? updated.toObject() : updated, boss, window: week, result };
  }
  throw new PersonalRaidError('RAID_BUSY', '레이드 결과를 동시에 처리 중입니다.', 409);
}

async function dispatchPersonalRaid() {
  throw new PersonalRaidError('RAID_BATTLE_REQUIRED', '개인 레이드가 턴제 전투로 변경되었습니다.', 409, { startEndpoint: '/api/tcg/raids/personal/start', finishEndpoint: '/api/tcg/raids/personal/finish' });
}

async function getPersonalRaidState({ TcgPersonalRaidDaily, account, bossId = 'deadline-dragon-raid', now = Date.now() }) {
  const boss = getPersonalRaidBoss(bossId); if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스를 찾을 수 없습니다.', 404);
  const window = getKstRaidWeekWindow(now); const record = await findRecord(TcgPersonalRaidDaily, { accountId: account?._id || account?.id, dayKey: window.weekKey, bossId: boss.id });
  return { record, boss, window, state: serializePersonalRaidState(record, account, boss, window, now) };
}

function normalizeRankingLimit(value) { const parsed = Number.parseInt(String(value ?? DEFAULT_RANKING_LIMIT), 10); return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_RANKING_LIMIT, parsed)) : DEFAULT_RANKING_LIMIT; }

async function getPersonalRaidRanking({ TcgPersonalRaidDaily, account, bossId = 'deadline-dragon-raid', now = Date.now(), limit = DEFAULT_RANKING_LIMIT, ownRecord }) {
  const boss = getPersonalRaidBoss(bossId); if (!boss) throw new PersonalRaidError('UNKNOWN_RAID_BOSS', '개인 레이드 보스를 찾을 수 없습니다.', 404);
  const nowMs = toTimestamp(now); const window = getKstRaidWeekWindow(nowMs);
  const query = { weekKey: window.weekKey, bossId: boss.id, schemaVersion: RAID_SCHEMA_VERSION, contribution: { $gt: 0 } };
  const records = await resolveLean(TcgPersonalRaidDaily.find(query).sort({ contribution: -1, updatedAt: 1, _id: 1 }).limit(normalizeRankingLimit(limit)));
  const mine = ownRecord === undefined ? await findRecord(TcgPersonalRaidDaily, { accountId: account?._id || account?.id, dayKey: window.weekKey, bossId: boss.id }) : ownRecord;
  const myScore = Number(mine?.schemaVersion) === RAID_SCHEMA_VERSION ? Math.max(0, Number(mine.contribution) || 0) : 0;
  const myRank = myScore > 0 ? (await TcgPersonalRaidDaily.countDocuments({ ...query, contribution: { $gt: myScore } })) + 1 : null;
  const accountId = String(account?._id || account?.id || ''); let previous = null; let rank = 0;
  const entries = (records || []).map((record, index) => { const score = Math.max(0, Number(record.contribution) || 0); if (score !== previous) rank = index + 1; previous = score; return { rank, accountId: String(record.accountId || ''), nickname: String(record.nickname || ''), contribution: score, score, stage: Math.max(1, Number(record.currentStage) || 1), clears: Math.max(0, Number(record.clearCount) || 0), entries: Math.max(0, Number(record.dispatchCount) || 0), isMe: String(record.accountId || '') === accountId }; });
  const myEntry = myScore > 0 ? { rank: myRank, accountId, nickname: String(account?.nickname || mine?.nickname || ''), contribution: myScore, score: myScore, stage: Math.max(1, Number(mine.currentStage) || 1), clears: Math.max(0, Number(mine.clearCount) || 0), entries: Math.max(0, Number(mine.dispatchCount) || 0), isMe: true } : null;
  return { mode: 'personal', period: 'weekly', resetRule: window.resetRule, bossId: boss.id, weekKey: window.weekKey, dayKey: window.weekKey, resetsAt: window.resetsAt.getTime(), serverNow: nowMs, entries, myRank, myEntry };
}

function getRemainingCooldownMs() { return 0; }

module.exports = {
  DEFAULT_RANKING_LIMIT, KST_OFFSET_MS, MAX_RANKING_LIMIT, PERSONAL_RAID_BOSSES, PERSONAL_RAID_CLEAR_REWARD,
  PERSONAL_RAID_COOLDOWN_MS, PERSONAL_RAID_MAX_DAILY_CLEARS, PERSONAL_RAID_MAX_DAILY_ENTRIES,
  PERSONAL_RAID_MAX_STAGE, PERSONAL_RAID_MAX_SQUAD_SIZE, PERSONAL_RAID_MAX_SQUAD_SCORE,
  PERSONAL_RAID_MAX_TURNS, PERSONAL_RAID_MIN_SQUAD_SCORE, PERSONAL_RAID_SESSION_MS, RAID_RELIC_ID,
  RAID_SCHEMA_VERSION, RAID_SR_PLUS_CARD_POOLS, RAID_SR_PLUS_RARITY_WEIGHTS, STAGE_HP,
  PersonalRaidError, calculatePersonalRaidDamage, clearRewardForStage, cumulativeClearRewards, createEmptyState, dispatchPersonalRaid, finishPersonalRaid,
  getBossStage, getKstDayWindow, getKstRaidWeekWindow, getPersonalRaidBoss, getPersonalRaidRanking,
  getPersonalRaidState, getRemainingCooldownMs, normalizeRaidBonusRewards, normalizeRankingLimit, parseSquadScore,
  parseSubmittedDamage, relicDropChanceForStage, rollStageClearBonuses, serializePersonalRaidState,
  startPersonalRaid, validatePersonalRaidSquad
};
