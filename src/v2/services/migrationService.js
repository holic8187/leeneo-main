'use strict';

const crypto = require('crypto');
const LegacyUserSnapshot = require('../models/LegacyUserSnapshot');
const V2Account = require('../models/V2Account');
const V2Character = require('../models/V2Character');
const { mapLegacyLevelToV2, getStatPointsForLevel, getSkillPointsForLevel } = require('../progression/levelMigration');
const {
  DEPARTMENTS,
  getAvailableAdvancementQuest,
  getSkillAccessProfile,
  getJobName
} = require('../jobs/advancementRules');
const { resolveCombatMotion } = require('../combat/weaponMotion');
const { buildDerivedStats } = require('../combat/derivedStats');
const {
  ensureSkillState,
  getActiveSkillEffects,
  buildSkillTree
} = require('../skills/skillService');
const { getRequiredExpV2 } = require('../constants/experienceTable');
const {
  BASE_STATS,
  RESOURCE_GROWTH_VERSION,
  calculateReferenceResources,
  applyReferenceResources
} = require('../progression/resourceGrowth');
const { buildInventoryView, getPendingMail } = require('./inventoryService');
const { reconcileHpGrowthSkillBonus } = require('./hpGrowthBonusService');

const MIGRATION_VERSION = 1;
const TEMPORARY_RESOURCE_DEFAULTS = Object.freeze({
  maxHp: 50,
  maxMp: 5
});
const EQUIPMENT_SLOT_KEYS = Object.freeze([
  'weapon',
  'helmet',
  'gloves',
  'shoes',
  'cape',
  'top',
  'bottom',
  'necklace',
  'earrings'
]);

const SNAPSHOT_FIELDS = Object.freeze([
  'username',
  'nickname',
  'workHours',
  'gameState',
  'inventory',
  'cards',
  'enhancedCards',
  'lockedCards',
  'equipments',
  'equippedEquipment',
  'equippedCardId',
  'equippedCardLevel',
  'raidExtraCardSelection',
  'pvpStats',
  'infiniteOvertime',
  'branchOffice',
  'buffs',
  'titles',
  'emblems',
  'pendingStockInvestment',
  'stockPortfolio',
  'shopState',
  'meta'
]);

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, flattenMaps: true });
  }
  return JSON.parse(JSON.stringify(value));
}

function buildLegacyPayload(user) {
  const plain = toPlainObject(user);
  const payload = {
    sourceUserId: String(plain._id || user._id),
    capturedSchema: 'v1'
  };
  for (const field of SNAPSHOT_FIELDS) {
    if (plain[field] !== undefined) payload[field] = plain[field];
  }
  return payload;
}

function stableChecksum(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function buildV2AccountSeed(user) {
  const plain = toPlainObject(user);
  const passwordHash = String(plain.password || '');
  if (!passwordHash) {
    throw new Error('V2 계정 이관에 필요한 비밀번호 해시가 없습니다.');
  }
  return {
    sourceUserId: user._id || plain._id,
    migrationVersion: MIGRATION_VERSION,
    username: String(plain.username || ''),
    passwordHash,
    nickname: String(plain.nickname || ''),
    migratedAt: new Date()
  };
}

function sumQuantity(entries) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (sum, entry) => sum + Math.max(0, Math.floor(Number(entry?.quantity) || 0)),
    0
  );
}

function buildMigrationPreview(user) {
  const plain = toPlainObject(user);
  const sourceLevel = Math.max(1, Math.floor(Number(plain.gameState?.level) || 1));
  const mappedLevel = mapLegacyLevelToV2(sourceLevel);
  const cardCount = sumQuantity(plain.cards);
  const enhancedCardCount = sumQuantity(plain.enhancedCards);
  const equipmentCount = Array.isArray(plain.equipments) ? plain.equipments.length : 0;
  const inventoryQuantity = sumQuantity(plain.inventory);

  return {
    sourceLevel,
    mappedLevel,
    expToNextLevel: getRequiredExpV2(mappedLevel),
    statPoints: getStatPointsForLevel(mappedLevel),
    skillPoints: getSkillPointsForLevel(mappedLevel, 0),
    reset: {
      moneyBefore: Math.max(0, Number(plain.gameState?.money) || 0),
      moneyAfter: 0,
      stockHoldingCountBefore: Array.isArray(plain.stockPortfolio) ? plain.stockPortfolio.length : 0,
      stockHoldingCountAfter: 0
    },
    preserved: {
      cardCount,
      enhancedCardCount,
      equipmentCount,
      inventoryQuantity,
      companyData: Boolean(plain.branchOffice?.isFounded)
    }
  };
}

async function ensureV2MigrationForUser(user) {
  const payload = buildLegacyPayload(user);
  const preview = buildMigrationPreview(user);
  const checksum = stableChecksum(payload);
  const displayName = String(user.nickname || user.username || '이름 미설정');
  const accountSeed = buildV2AccountSeed(user);

  await V2Account.findOneAndUpdate(
    { sourceUserId: user._id },
    { $setOnInsert: accountSeed },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const snapshot = await LegacyUserSnapshot.findOneAndUpdate(
    { sourceUserId: user._id, migrationVersion: MIGRATION_VERSION },
    {
      $setOnInsert: {
        sourceUserId: user._id,
        migrationVersion: MIGRATION_VERSION,
        username: String(user.username || ''),
        nickname: String(user.nickname || ''),
        sourceLevel: preview.sourceLevel,
        mappedV2Level: preview.mappedLevel,
        checksum,
        payload,
        capturedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const sourceActionPoints = Math.max(0, Number(user.gameState?.stamina) || 0);
  const sourceMaxActionPoints = Math.max(1, Number(user.gameState?.maxStamina) || 10);
  const initialResources = calculateReferenceResources({
    level: preview.mappedLevel,
    departmentId: 'unassigned',
    advancementTier: 0,
    archetype: 'beginner'
  });
  const character = await V2Character.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        schemaVersion: 1,
        displayName,
        progression: {
          level: preview.mappedLevel,
          exp: 0,
          unspentStatPoints: preview.statPoints,
          unspentSkillPoints: preview.skillPoints,
          totalSkillPointsEarned: preview.skillPoints,
          skillPointGrantVersion: 1
        },
        stats: {
          ...BASE_STATS
        },
        job: {
          departmentId: 'unassigned',
          advancementTier: 0
        },
        skills: {
          levels: {},
          activePreset: [],
          unlockedQuestSkills: [],
          activeBuffs: [],
          summon: null,
          comboCount: 0
        },
        inventory: {
          items: [],
          potions: [],
          slotCapacities: {
            equipment: 20,
            consumable: 20,
            misc: 20,
            cash: 20
          },
          quickSlots: { hp: '', mp: '' }
        },
        mailbox: [],
        resources: {
          currentHp: initialResources.maxHp,
          maxHp: initialResources.maxHp,
          currentMp: initialResources.maxMp,
          maxMp: initialResources.maxMp,
          growthVersion: RESOURCE_GROWTH_VERSION,
          provisional: initialResources.provisional
        },
        actionPoints: {
          current: Math.min(sourceActionPoints, sourceMaxActionPoints),
          max: sourceMaxActionPoints
        },
        worldState: {
          mapId: 'main_lobby',
          x: 8,
          floor: 0
        },
        economy: {
          money: 0,
          stockPortfolio: []
        },
        migration: {
          status: 'prepared',
          migrationVersion: MIGRATION_VERSION,
          sourceSnapshotId: snapshot._id,
          sourceLevel: preview.sourceLevel,
          legacyCardCount: preview.preserved.cardCount,
          legacyEnhancedCardCount: preview.preserved.enhancedCardCount,
          legacyEquipmentCount: preview.preserved.equipmentCount,
          legacyInventoryQuantity: preview.preserved.inventoryQuantity,
          legacyCompanyPreserved: preview.preserved.companyData,
          cardsConversionStatus: 'pending',
          equipmentConversionStatus: 'pending',
          companyConversionStatus: 'pending',
          preparedAt: new Date()
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await ensureV2SkillPointGrant(character);
  await ensureV2CharacterFoundation(character);
  return { snapshot, character, preview };
}

async function ensureV2SkillPointGrant(character) {
  if (!character || Number(character.progression?.skillPointGrantVersion) >= 1) return character;
  const expected = getSkillPointsForLevel(
    character.progression?.level,
    character.job?.advancementTier
  );
  character.progression.unspentSkillPoints = expected;
  character.progression.totalSkillPointsEarned = expected;
  character.progression.skillPointGrantVersion = 1;
  await character.save();
  return character;
}

async function ensureV2CharacterFoundation(character) {
  if (!character) return character;
  let changed = false;
  if (!character.skills || typeof character.skills !== 'object') {
    ensureSkillState(character);
    changed = true;
  }
  for (const [stat, baseline] of Object.entries(BASE_STATS)) {
    if (Number(character.stats?.[stat]) >= baseline) continue;
    character.stats[stat] = baseline;
    changed = true;
  }

  if (Number(character.resources?.growthVersion) < RESOURCE_GROWTH_VERSION) {
    const department = DEPARTMENTS[character.job?.departmentId];
    const reference = calculateReferenceResources({
      level: character.progression?.level,
      departmentId: character.job?.departmentId,
      advancementTier: character.job?.advancementTier,
      archetype: department?.archetype || 'beginner'
    });
    character.resources.hpGrowthSkillBonus = 0;
    applyReferenceResources(character, reference);
    changed = true;
  }
  const hpGrowth = reconcileHpGrowthSkillBonus(character);
  if (hpGrowth.delta !== 0) changed = true;

  if (changed) await character.save();
  return character;
}

function buildResourceResponse(resources = {}) {
  const storedMaxHp = Math.max(0, Number(resources.maxHp) || 0);
  const storedMaxMp = Math.max(0, Number(resources.maxMp) || 0);
  const maxHp = storedMaxHp || TEMPORARY_RESOURCE_DEFAULTS.maxHp;
  const maxMp = storedMaxMp || TEMPORARY_RESOURCE_DEFAULTS.maxMp;
  return {
    currentHp: storedMaxHp
      ? Math.max(0, Math.min(maxHp, Number(resources.currentHp) || 0))
      : maxHp,
    maxHp,
    currentMp: storedMaxMp
      ? Math.max(0, Math.min(maxMp, Number(resources.currentMp) || 0))
      : maxMp,
    maxMp,
    growthVersion: Math.max(0, Number(resources.growthVersion) || 0),
    provisional: Boolean(resources.provisional || !storedMaxHp || !storedMaxMp)
  };
}

function buildEquipmentLoadout(loadout = {}) {
  return Object.fromEntries(EQUIPMENT_SLOT_KEYS.map((slot) => [slot, loadout[slot] || null]));
}

function buildCharacterResponse(character) {
  if (!character) return null;
  const plain = toPlainObject(character);
  const equipmentLoadout = buildEquipmentLoadout(plain.loadout);
  const combatPresentation = resolveCombatMotion({
    weaponType: equipmentLoadout.weapon?.weaponType || plain.loadout?.weaponType,
    departmentId: plain.job?.departmentId
  });
  const normalizedStats = Object.fromEntries(
    Object.entries(BASE_STATS).map(([key, baseline]) => [
      key,
      Math.max(baseline, Number(plain.stats?.[key]) || 0)
    ])
  );
  const skillEffects = getActiveSkillEffects(plain);
  const derivedStats = buildDerivedStats({
    progression: plain.progression,
    stats: normalizedStats,
    job: plain.job,
    loadout: equipmentLoadout,
    skillEffects
  });
  return {
    id: String(plain._id),
    displayName: plain.displayName,
    progression: {
      ...plain.progression,
      expToNextLevel: getRequiredExpV2(plain.progression?.level)
    },
    stats: normalizedStats,
    job: {
      ...plain.job,
      departmentName: DEPARTMENTS[plain.job?.departmentId]?.name || '미전직',
      jobName: getJobName(plain.job?.departmentId, plain.job?.advancementTier)
    },
    resources: buildResourceResponse(plain.resources),
    inventory: buildInventoryView(plain),
    pendingMailCount: getPendingMail(plain).length,
    equipmentLoadout,
    worldState: {
      mapId: String(plain.worldState?.mapId || 'main_lobby'),
      x: Math.max(0, Math.min(94, Number(plain.worldState?.x) || 8)),
      floor: Number(plain.worldState?.floor) === 1 ? 1 : 0
    },
    actionPoints: plain.actionPoints,
    economy: plain.economy,
    combatPresentation,
    derivedStats,
    advancementQuest: getAvailableAdvancementQuest(plain),
    skillAccess: getSkillAccessProfile(plain),
    skillTree: buildSkillTree(plain),
    skillEffects,
    migration: plain.migration,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

module.exports = {
  MIGRATION_VERSION,
  SNAPSHOT_FIELDS,
  buildLegacyPayload,
  buildV2AccountSeed,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  ensureV2SkillPointGrant,
  ensureV2CharacterFoundation,
  buildResourceResponse,
  buildEquipmentLoadout,
  buildCharacterResponse
};
