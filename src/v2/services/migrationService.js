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
const { addInventoryItem, buildInventoryView, getPendingMail } = require('./inventoryService');
const { getItemDefinition } = require('../items/itemCatalog');
const { buildEnhancementView } = require('./equipmentEnhancementService');
const { reconcileHpGrowthSkillBonus } = require('./hpGrowthBonusService');
const { reconcileMpGrowthSkillBonus } = require('./mpGrowthBonusService');
const { reconcileMaxResourceBuff } = require('./maxResourceBuffService');

const MIGRATION_VERSION = 1;
const LEGACY_EXCHANGE_FORMULA_VERSION = 2;
const SKILL_POINT_GRANT_VERSION = 2;
const TEMPORARY_RESOURCE_DEFAULTS = Object.freeze({
  maxHp: 50,
  maxMp: 5
});
const LEGACY_EXCHANGE_COUPON_ID = 'legacy_exchange_coupon';
const EQUIPMENT_SLOT_KEYS = Object.freeze([
  'weapon', 'shield',
  'helmet',
  'gloves',
  'shoes',
  'cape',
  'top',
  'bottom',
  'necklace',
  'ring',
  'earrings'
]);
const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  cape: Object.freeze(['cape', 'cloak', 'mantle'])
});

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

function getLegacyQuantity(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  for (const key of ['quantity', 'count', 'amount', 'qty']) {
    const value = Number(entry[key]);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return 1;
}

function legacyText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return [
    entry.id,
    entry.itemId,
    entry.cardId,
    entry.name,
    entry.cardName,
    entry.displayName,
    entry.type,
    entry.itemType
  ].filter(Boolean).map(String).join(' ').toLowerCase();
}

function flattenLegacyEntries(value, depth = 0) {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenLegacyEntries(entry, depth + 1));
  }
  if (typeof value !== 'object') return [];
  const directKeys = ['id', 'itemId', 'cardId', 'name', 'cardName', 'displayName', 'grade', 'tier', 'rank'];
  const hasDirectIdentity = directKeys.some((key) => value[key] !== undefined);
  const nested = Object.entries(value)
    .filter(([key, entry]) => !['_id', 'createdAt', 'updatedAt'].includes(key) && typeof entry === 'object')
    .flatMap(([, entry]) => flattenLegacyEntries(entry, depth + 1));
  return hasDirectIdentity ? [value, ...nested] : nested;
}

function countLegacySCards(plain = {}) {
  const entries = [
    ...flattenLegacyEntries(plain.cards),
    ...flattenLegacyEntries(plain.enhancedCards),
    ...flattenLegacyEntries(plain.lockedCards)
  ];
  return entries.reduce((sum, entry) => {
    const grade = String(entry.grade || entry.tier || entry.rank || '').trim().toUpperCase();
    const text = legacyText(entry);
    const isSGrade = grade === 'S'
      || grade === 'S급'
      || /\bgrade[:_\s-]?s\b/.test(text)
      || /\bs[-_\s]?grade\b/.test(text)
      || text.includes('s급');
    return sum + (isSGrade ? getLegacyQuantity(entry) : 0);
  }, 0);
}

function countLegacyItems(plain = {}, matcher) {
  const entries = [
    ...flattenLegacyEntries(plain.inventory),
    ...flattenLegacyEntries(plain.gameState),
    ...flattenLegacyEntries(plain.shopState)
  ];
  return entries.reduce((sum, entry) => (
    matcher(entry, legacyText(entry)) ? sum + getLegacyQuantity(entry) : sum
  ), 0);
}

function normalizeLegacyFieldKey(key) {
  return String(key || '').toLowerCase().replace(/[\s._-]+/g, '');
}

function sumLegacyNumericFields(value, matcher, depth = 0) {
  if (!value || depth > 7 || typeof value !== 'object') return 0;
  return Object.entries(value).reduce((sum, [key, entry]) => {
    const normalizedKey = normalizeLegacyFieldKey(key);
    if (typeof entry === 'number' && matcher(normalizedKey, key)) {
      return sum + Math.max(0, Math.floor(entry));
    }
    if (entry && typeof entry === 'object') {
      return sum + sumLegacyNumericFields(entry, matcher, depth + 1);
    }
    return sum;
  }, 0);
}

function looksLikeLegacyBusinessCardField(key, rawKey = '') {
  const text = `${key} ${rawKey}`.toLowerCase();
  return text.includes('businesscard')
    || text.includes('businesscards')
    || text.includes('namecard')
    || text.includes('namecards')
    || text.includes('cardpack')
    || text.includes('cardpacks')
    || text.includes('명함');
}

function looksLikeLegacyBacchusField(key, rawKey = '') {
  const text = `${key} ${rawKey}`.toLowerCase();
  return text.includes('bacchus')
    || text.includes('bakus')
    || text.includes('bakas')
    || text.includes('박카스');
}

function countLegacySCardsRobust(plain = {}) {
  const entries = [
    ...flattenLegacyEntries(plain.cards),
    ...flattenLegacyEntries(plain.enhancedCards),
    ...flattenLegacyEntries(plain.lockedCards)
  ];
  return entries.reduce((sum, entry) => {
    const grade = String(
      entry.grade
      || entry.tier
      || entry.rank
      || entry.rarity
      || entry.cardGrade
      || entry.cardTier
      || entry.gradeName
      || ''
    ).trim();
    const normalizedGrade = normalizeLegacyFieldKey(grade);
    const text = `${legacyText(entry)} ${grade.toLowerCase()}`;
    const isSGrade = normalizedGrade === 's'
      || normalizedGrade === 'sgrade'
      || normalizedGrade === 'srank'
      || normalizedGrade === 'sclass'
      || normalizedGrade === 's급'
      || normalizedGrade === 's등급'
      || /\bs\s*(grade|rank|class)\b/.test(text)
      || text.includes('s급')
      || text.includes('s등급');
    return sum + (isSGrade ? getLegacyQuantity(entry) : 0);
  }, 0);
}

function calculateLegacyExchangeCoupons(user) {
  const plain = toPlainObject(user);
  const sCardCount = Math.max(countLegacySCards(plain), countLegacySCardsRobust(plain));
  const businessCardCount = countLegacyItems(plain, (entry, text) => (
    text.includes('business_card')
    || text.includes('namecard')
    || text.includes('card_pack')
    || text.includes('명함')
  ));
  const bacchusCount = countLegacyItems(plain, (entry, text) => (
    text.includes('bacchus')
    || text.includes('bakas')
    || text.includes('박카스')
  ));
  const totalBusinessCardCount = businessCardCount
    + sumLegacyNumericFields(plain, looksLikeLegacyBusinessCardField);
  const totalBacchusCount = bacchusCount
    + sumLegacyNumericFields(plain, looksLikeLegacyBacchusField);
  const couponCount = sCardCount
    + Math.floor(totalBusinessCardCount / 50)
    + Math.floor(totalBacchusCount / 50);
  return {
    sCardCount,
    businessCardCount: totalBusinessCardCount,
    bacchusCount: totalBacchusCount,
    couponCount: Math.max(0, couponCount)
  };
}

function buildMigrationPreview(user) {
  const plain = toPlainObject(user);
  const sourceLevel = Math.max(1, Math.floor(Number(plain.gameState?.level) || 1));
  const mappedLevel = mapLegacyLevelToV2(sourceLevel);
  const cardCount = sumQuantity(plain.cards);
  const enhancedCardCount = sumQuantity(plain.enhancedCards);
  const equipmentCount = Array.isArray(plain.equipments) ? plain.equipments.length : 0;
  const inventoryQuantity = sumQuantity(plain.inventory);
  const legacyExchange = calculateLegacyExchangeCoupons(user);

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
      companyData: Boolean(plain.branchOffice?.isFounded),
      legacyExchange
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
          skillPointGrantVersion: SKILL_POINT_GRANT_VERSION
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
          legacyExchangeCouponCount: 0,
          legacyExchangeFormulaVersion: 0,
          cardsConversionStatus: 'pending',
          equipmentConversionStatus: 'pending',
          companyConversionStatus: 'pending',
          preparedAt: new Date()
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await ensureV2CharacterFoundation(character);
  await ensureV2SkillPointGrant(character);
  await ensureLegacyExchangeCoupons(character, preview.preserved.legacyExchange);
  return { snapshot, character, preview };
}

async function ensureLegacyExchangeCoupons(character, conversion = {}) {
  if (!character) return { granted: 0, target: 0 };
  const target = Math.max(0, Math.floor(Number(conversion.couponCount) || 0));
  const alreadyGranted = Math.max(
    0,
    Math.floor(Number(character.migration?.legacyExchangeCouponCount) || 0)
  );
  const grantCount = Math.max(0, target - alreadyGranted);
  const formulaVersion = Math.max(
    0,
    Math.floor(Number(character.migration?.legacyExchangeFormulaVersion) || 0)
  );
  if (grantCount > 0) {
    addInventoryItem(character, LEGACY_EXCHANGE_COUPON_ID, grantCount);
  }
  if (
    grantCount > 0
    || alreadyGranted !== target
    || formulaVersion !== LEGACY_EXCHANGE_FORMULA_VERSION
  ) {
    character.migration.legacyExchangeCouponCount = target;
    character.migration.legacyExchangeFormulaVersion = LEGACY_EXCHANGE_FORMULA_VERSION;
    if (typeof character.markModified === 'function') character.markModified('migration');
    await character.save();
  }
  return { granted: grantCount, target };
}

async function repairV2StatBaselines(character) {
  if (!character) return false;
  const baselineUpdate = {};
  let changed = false;
  for (const [stat, baseline] of Object.entries(BASE_STATS)) {
    if (Number(character.stats?.[stat]) >= baseline) continue;
    if (!character.stats || typeof character.stats !== 'object') character.stats = {};
    character.stats[stat] = baseline;
    baselineUpdate[`stats.${stat}`] = baseline;
    changed = true;
  }
  if (!changed) return false;
  if (typeof character.markModified === 'function') character.markModified('stats');
  if (character._id) {
    // Old V2 documents can contain zero stats that fail schema validation before
    // normal save hooks run. $max repairs those fields without validating the
    // still-invalid in-memory document, after which normal saves are safe.
    await V2Character.updateOne(
      { _id: character._id },
      { $max: baselineUpdate },
      { runValidators: false }
    );
  }
  return true;
}

async function repairV2CharacterStatBaselinesByUserId(userId) {
  if (!userId) return { matchedCount: 0, modifiedCount: 0 };
  return V2Character.updateOne(
    { userId },
    {
      $max: Object.fromEntries(
        Object.entries(BASE_STATS).map(([stat, baseline]) => [`stats.${stat}`, baseline])
      )
    },
    { runValidators: false }
  );
}

async function ensureV2SkillPointGrant(character) {
  await repairV2StatBaselines(character);
  if (
    !character
    || Number(character.progression?.skillPointGrantVersion) >= SKILL_POINT_GRANT_VERSION
  ) return character;
  const expected = getSkillPointsForLevel(
    character.progression?.level,
    character.job?.advancementTier
  );
  const invested = Object.values(character.skills?.levels || {}).reduce(
    (total, level) => total + Math.max(0, Math.floor(Number(level) || 0)),
    0
  );
  character.progression.unspentSkillPoints = Math.max(0, expected - invested);
  character.progression.totalSkillPointsEarned = expected;
  character.progression.skillPointGrantVersion = SKILL_POINT_GRANT_VERSION;
  await character.save();
  return character;
}

async function ensureV2CharacterFoundation(character) {
  if (!character) return character;
  let changed = await repairV2StatBaselines(character);
  if (!character.skills || typeof character.skills !== 'object') {
    ensureSkillState(character);
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
    character.resources.mpGrowthSkillBonus = 0;
    applyReferenceResources(character, reference);
    changed = true;
  }
  const hpGrowth = reconcileHpGrowthSkillBonus(character);
  if (hpGrowth.delta !== 0) changed = true;
  const mpGrowth = reconcileMpGrowthSkillBonus(character);
  if (mpGrowth.delta !== 0) changed = true;
  const resourceBuff = reconcileMaxResourceBuff(character);
  if (resourceBuff.changed) changed = true;

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
  return Object.fromEntries(EQUIPMENT_SLOT_KEYS.map((slot) => {
    const aliases = EQUIPMENT_SLOT_ALIASES[slot] || [slot];
    const stored = aliases.map((key) => loadout[key]).find(Boolean) || null;
    if (!stored) return [slot, null];
    const definition = getItemDefinition(stored.itemId || stored.id);
    const equipment = {
      ...stored,
      ...(definition || {}),
      itemId: stored.itemId || stored.id,
      instanceData: stored.instanceData || null,
      stats: { ...(stored.stats || definition?.stats || {}) },
      requirements: {
        ...(definition?.requirements || {}),
        ...(stored.requirements || {}),
        stats: {
          ...(definition?.requirements?.stats || {}),
          ...(stored.requirements?.stats || {})
        }
      }
    };
    equipment.enhancement = buildEnhancementView(equipment);
    return [slot, equipment];
  }));
}

function buildOfflineSummaryView(summary = null) {
  if (!summary || typeof summary !== 'object') return null;
  const items = Array.isArray(summary.items) ? summary.items : [];
  const normalizedItems = items
    .map((entry) => {
      const definition = getItemDefinition(entry.itemId);
      return {
        itemId: String(entry.itemId || ''),
        name: entry.name || definition?.name || String(entry.itemId || ''),
        icon: entry.icon || definition?.icon || '?',
        quantity: Math.max(0, Math.floor(Number(entry.quantity) || 0)),
        stored: entry.stored !== false
      };
    })
    .filter((entry) => entry.itemId && entry.quantity > 0);
  return {
    startedAt: summary.startedAt || null,
    updatedAt: summary.updatedAt || null,
    elapsedSeconds: Math.max(0, Math.floor(Number(summary.elapsedSeconds) || 0)),
    kills: Math.max(0, Math.floor(Number(summary.kills) || 0)),
    skillUses: Math.max(0, Math.floor(Number(summary.skillUses) || 0)),
    exp: Math.max(0, Math.floor(Number(summary.exp) || 0)),
    money: Math.max(0, Math.floor(Number(summary.money) || 0)),
    items: normalizedItems
  };
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
  const baseResources = buildResourceResponse(plain.resources);
  const adjustedMaxHp = Math.max(
    1,
    baseResources.maxHp + Math.max(0, Number(derivedStats.maxHpBonus) || 0)
  );
  const adjustedMaxMp = Math.max(
    0,
    baseResources.maxMp + Math.max(0, Number(derivedStats.maxMpBonus) || 0)
  );
  const hasStoredCurrentHp = plain.resources?.currentHp !== null
    && plain.resources?.currentHp !== undefined;
  const hasStoredCurrentMp = plain.resources?.currentMp !== null
    && plain.resources?.currentMp !== undefined;
  const hasStoredHpPool = Number(plain.resources?.maxHp) > 0;
  const hasStoredMpPool = Number(plain.resources?.maxMp) > 0;
  const storedCurrentHp = Number(plain.resources?.currentHp);
  const storedCurrentMp = Number(plain.resources?.currentMp);
  const resources = {
    ...baseResources,
    currentHp: Math.max(0, Math.min(
      adjustedMaxHp,
      hasStoredHpPool && hasStoredCurrentHp && Number.isFinite(storedCurrentHp)
        ? storedCurrentHp
        : baseResources.currentHp
    )),
    maxHp: adjustedMaxHp,
    currentMp: Math.max(0, Math.min(
      adjustedMaxMp,
      hasStoredMpPool && hasStoredCurrentMp && Number.isFinite(storedCurrentMp)
        ? storedCurrentMp
        : baseResources.currentMp
    )),
    maxMp: adjustedMaxMp
  };
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
    resources,
    inventory: buildInventoryView(plain),
    pendingMailCount: getPendingMail(plain).length,
    equipmentLoadout,
    worldState: {
      mapId: String(plain.worldState?.mapId || 'main_lobby'),
      x: Math.max(0, Math.min(94, Number(plain.worldState?.x) || 8)),
      floor: Number(plain.worldState?.floor) === 1 ? 1 : 0
    },
    huntingTime: {
      remainingSeconds: Math.max(0, Number(plain.huntingTime?.remainingSeconds) || 0),
      maximumSeconds: 24000,
      enabled: Boolean(plain.huntingTime?.enabled),
      lastDailyGrantDate: String(plain.huntingTime?.lastDailyGrantDate || ''),
      offlineSummary: buildOfflineSummaryView(plain.huntingTime?.offlineSummary)
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
  LEGACY_EXCHANGE_FORMULA_VERSION,
  SNAPSHOT_FIELDS,
  buildLegacyPayload,
  buildV2AccountSeed,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  repairV2CharacterStatBaselinesByUserId,
  ensureV2SkillPointGrant,
  ensureV2CharacterFoundation,
  ensureLegacyExchangeCoupons,
  buildResourceResponse,
  buildEquipmentLoadout,
  buildCharacterResponse
};
