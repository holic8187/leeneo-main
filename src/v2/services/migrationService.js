'use strict';

const crypto = require('crypto');
const LegacyUserSnapshot = require('../models/LegacyUserSnapshot');
const V2Account = require('../models/V2Account');
const V2Character = require('../models/V2Character');
const { mapLegacyLevelToV2, getStatPointsForLevel, getSkillPointsForLevel } = require('../progression/levelMigration');
const { getAvailableAdvancementQuest } = require('../jobs/advancementRules');
const { resolveCombatMotion } = require('../combat/weaponMotion');
const { getRequiredExpV2 } = require('../constants/experienceTable');

const MIGRATION_VERSION = 1;

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
          grit: 0,
          processingSpeed: 0,
          workKnowledge: 0,
          awareness: 0
        },
        job: {
          departmentId: 'unassigned',
          advancementTier: 0
        },
        resources: {
          currentHp: 0,
          maxHp: 0,
          currentMp: 0,
          maxMp: 0
        },
        actionPoints: {
          current: Math.min(sourceActionPoints, sourceMaxActionPoints),
          max: sourceMaxActionPoints
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

function buildCharacterResponse(character) {
  if (!character) return null;
  const plain = toPlainObject(character);
  return {
    id: String(plain._id),
    displayName: plain.displayName,
    progression: {
      ...plain.progression,
      expToNextLevel: getRequiredExpV2(plain.progression?.level)
    },
    stats: plain.stats,
    job: plain.job,
    resources: plain.resources,
    actionPoints: plain.actionPoints,
    economy: plain.economy,
    combatPresentation: resolveCombatMotion({
      weaponType: plain.loadout?.weaponType,
      departmentId: plain.job?.departmentId
    }),
    advancementQuest: getAvailableAdvancementQuest(plain),
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
  buildCharacterResponse
};
