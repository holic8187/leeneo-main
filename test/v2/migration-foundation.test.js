'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const {
  SNAPSHOT_FIELDS,
  buildLegacyPayload,
  buildV2AccountSeed,
  buildMigrationPreview,
  buildCharacterResponse,
  ensureV2SkillPointGrant
} = require('../../src/v2/services/migrationService');
const {
  registerV2Routes,
  validateSignupPayload,
  shouldRollSkillCriticalPerHit,
  buildProfileMagicDamageRange,
  MARKETPLACE_LISTING_HOURS,
  getMarketplaceListingExpiresAt,
  getMarketplaceArchetypeItemIds
} = require('../../src/v2/registerV2Routes');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');
const V2Character = require('../../src/v2/models/V2Character');
const {
  getIncompleteMigrationIds,
  getOrphanedDeletedIds
} = require('../../src/v2/services/automaticMigrationService');

test('multi-hit and follow-up skill attacks request independent critical rolls', () => {
  assert.equal(shouldRollSkillCriticalPerHit({
    effect: 'damage',
    hitCount: 3,
    hasFollowUpAttack: true
  }), true);
  assert.equal(shouldRollSkillCriticalPerHit({
    effect: 'damage',
    hitCount: 1,
    hasFollowUpAttack: true
  }), true);
  assert.equal(shouldRollSkillCriticalPerHit({
    effect: 'damage',
    hitCount: 1
  }), false);
  assert.equal(shouldRollSkillCriticalPerHit({
    effect: 'fixed-damage',
    hitCount: 6,
    hasFollowUpAttack: true
  }), false);
});

test('skill-specific magic mastery overrides equipment mastery for its damage range', () => {
  const profile = {
    derivedStats: {
      magic: 500,
      weaponMastery: 10,
      effectiveStats: { workKnowledge: 400 }
    }
  };
  const levelOneRange = buildProfileMagicDamageRange(profile, 100, 35);
  const masterLevelRange = buildProfileMagicDamageRange(profile, 100, 80);

  assert.equal(levelOneRange.mastery, 0.35);
  assert.equal(masterLevelRange.mastery, 0.8);
  assert.ok(masterLevelRange.minimum > levelOneRange.minimum);
  assert.equal(masterLevelRange.maximum, levelOneRange.maximum);
});

function createLegacyUser(overrides = {}) {
  return {
    _id: 'legacy-user-id',
    username: 'employee01',
    password: 'must-not-be-snapshotted',
    nickname: '테스트사원',
    gameState: {
      level: 1900,
      exp: 123,
      money: 987654321,
      stamina: 8,
      maxStamina: 12
    },
    inventory: [{ itemId: 'item-a', quantity: 7 }],
    cards: [{ cardId: 'card-a', quantity: 10 }],
    enhancedCards: [{ cardId: 'card-b', level: 3, quantity: 2 }],
    equipments: [{ equipmentId: 'equipment-a' }],
    stockPortfolio: [{ companyId: 'company-a', shares: 99 }],
    branchOffice: { isFounded: true, companyName: '테스트회사' },
    ...overrides
  };
}

test('legacy snapshot excludes credentials and retains conversion source data', () => {
  const payload = buildLegacyPayload(createLegacyUser());
  assert.equal(payload.password, undefined);
  assert.equal(SNAPSHOT_FIELDS.includes('password'), false);
  assert.equal(payload.username, 'employee01');
  assert.equal(payload.cards[0].quantity, 10);
  assert.equal(payload.equipments.length, 1);
  assert.equal(payload.branchOffice.companyName, '테스트회사');
});

test('V2 account migration preserves the bcrypt hash outside the gameplay snapshot', () => {
  const user = createLegacyUser();
  const account = buildV2AccountSeed(user);
  const snapshot = buildLegacyPayload(user);
  assert.equal(account.username, 'employee01');
  assert.equal(account.passwordHash, 'must-not-be-snapshotted');
  assert.equal(snapshot.password, undefined);
  assert.equal(snapshot.passwordHash, undefined);
});

test('migration preview resets V2 money and stocks while preserving source counts', () => {
  const preview = buildMigrationPreview(createLegacyUser());
  assert.equal(preview.sourceLevel, 1900);
  assert.equal(preview.mappedLevel, 130);
  assert.equal(preview.statPoints, 645);
  assert.equal(preview.reset.moneyBefore, 987654321);
  assert.equal(preview.reset.moneyAfter, 0);
  assert.equal(preview.reset.stockHoldingCountBefore, 1);
  assert.equal(preview.reset.stockHoldingCountAfter, 0);
  assert.equal(preview.preserved.cardCount, 10);
  assert.equal(preview.preserved.enhancedCardCount, 2);
  assert.equal(preview.preserved.equipmentCount, 1);
  assert.equal(preview.preserved.companyData, true);
});

test('legacy exchange preview includes S cards and numeric consumable balances', () => {
  const preview = buildMigrationPreview(createLegacyUser({
    gameState: {
      level: 1900,
      exp: 123,
      money: 987654321,
      stamina: 8,
      maxStamina: 12,
      businessCards: 450,
      bacchus: 250
    },
    cards: [{ cardId: 'legacy-s-card', cardGrade: 'S rank', quantity: 3 }],
    enhancedCards: [],
    lockedCards: []
  }));
  assert.deepEqual(preview.preserved.legacyExchange, {
    sCardCount: 3,
    businessCardCount: 450,
    bacchusCount: 250,
    couponCount: 17
  });
});

test('V2 character response supplies provisional resources, EXP target, and empty equipment slots', () => {
  const response = buildCharacterResponse({
    _id: 'character-id',
    displayName: '테스트사원',
    progression: { level: 50, exp: 1234 },
    stats: {},
    job: { departmentId: 'unassigned', advancementTier: 0 },
    resources: { currentHp: 0, maxHp: 0, currentMp: 0, maxMp: 0 },
    actionPoints: { current: 10, max: 10 },
    economy: { money: 0, stockPortfolio: [] },
    migration: { status: 'prepared' }
  });
  assert.deepEqual(response.resources, {
    currentHp: 50,
    maxHp: 50,
    currentMp: 5,
    maxMp: 5,
    growthVersion: 0,
    provisional: true
  });
  assert.deepEqual(response.stats, {
    grit: 4,
    processingSpeed: 4,
    workKnowledge: 4,
    awareness: 4
  });
  assert.equal(response.progression.expToNextLevel, 709716);
  assert.deepEqual(response.inventory.items, []);
  assert.equal(response.inventory.categories.equipment.capacity, 20);
  assert.equal(response.inventory.categories.consumable.capacity, 20);
  assert.equal(response.inventory.categories.misc.capacity, 20);
  assert.equal(response.inventory.categories.cash.capacity, 20);
  assert.deepEqual(response.inventory.quickSlots, { hp: null, mp: null });
  assert.equal(response.pendingMailCount, 0);
  assert.deepEqual(response.worldState, {
    mapId: 'main_lobby',
    x: 8,
    floor: 0,
    returnMapId: '',
    raidBossId: '',
    raidPartyNumber: 0,
    raidStartedAt: 0,
    raidDeadAt: 0,
    busDepartureAt: 0,
    busOriginMapId: '',
    busDestinationMapId: ''
  });
  assert.equal(response.equipmentLoadout.weapon, null);
  assert.equal(response.equipmentLoadout.earrings, null);
});

test('legacy zero stats are repaired before the skill-point migration performs its first save', async () => {
  const savedStats = [];
  const character = {
    stats: { grit: 0, processingSpeed: 0, workKnowledge: 0, awareness: 0 },
    progression: {
      level: 20,
      unspentSkillPoints: 0,
      totalSkillPointsEarned: 0,
      skillPointGrantVersion: 0
    },
    job: { departmentId: 'unassigned', advancementTier: 0 },
    skills: { levels: {} },
    async save() {
      savedStats.push({ ...this.stats });
    }
  };
  await ensureV2SkillPointGrant(character);
  assert.equal(savedStats.length, 1);
  assert.deepEqual(savedStats[0], {
    grit: 4,
    processingSpeed: 4,
    workKnowledge: 4,
    awareness: 4
  });
});

test('V2 signup fields require matching passwords and a signup code', () => {
  assert.equal(validateSignupPayload({
    username: 'employee_01',
    password: 'secret12',
    passwordConfirm: 'secret12',
    signupCode: 'HOI2026',
    nickname: '신입사원'
  }).valid, true);
  assert.equal(validateSignupPayload({
    username: 'employee_01',
    password: 'secret12',
    passwordConfirm: 'different',
    signupCode: 'HOI2026',
    nickname: '신입사원'
  }).valid, false);
});

test('characters saved on upper map floors remain valid login documents', () => {
  const character = new V2Character({
    userId: new mongoose.Types.ObjectId(),
    displayName: '다층맵사원',
    worldState: { mapId: 'peach_factory_core', x: 50, floor: 3 },
    migration: {
      sourceSnapshotId: new mongoose.Types.ObjectId(),
      sourceLevel: 150
    }
  });
  assert.equal(character.validateSync(), undefined);
});

test('existing V2 characters do not rerun the full legacy migration during login', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/v2/registerV2Routes.js'),
    'utf8'
  );
  const loginRoute = source.slice(
    source.indexOf("app.post('/api/v2/login'"),
    source.indexOf("app.post('/api/v2/presence/heartbeat'")
  );
  assert.equal((loginRoute.match(/ensureV2MigrationForUser\(sourceUser\)/g) || []).length, 1);
  assert.match(loginRoute, /else \{\s*await ensureV2CharacterFoundation\(character\);/);
});

test('V2 signup treats visually identical normalized passwords as matching', () => {
  const composed = 'café비밀번호';
  const decomposed = composed.normalize('NFD');
  const result = validateSignupPayload({
    username: 'employee_02',
    password: composed,
    passwordConfirm: decomposed,
    signupCode: 'HOI2026',
    nickname: '정규화사원'
  });

  assert.equal(result.valid, true);
  assert.equal(result.password, composed.normalize('NFC'));
});

test('V2 signup reports short matching passwords as too short, not mismatched', () => {
  const result = validateSignupPayload({
    username: 'employee_03',
    password: '1',
    passwordConfirm: '1',
    signupCode: 'HOI2026',
    nickname: '길이검사'
  });

  assert.equal(result.valid, false);
  assert.equal(result.message, '비밀번호는 6~72자로 입력해주세요.');
});

test('V2 marketplace listings stay active for sixty hours', () => {
  const baseTime = Date.UTC(2026, 6, 28, 0, 0, 0);
  assert.equal(MARKETPLACE_LISTING_HOURS, 60);
  assert.equal(getMarketplaceListingExpiresAt(baseTime).getTime() - baseTime, 60 * 60 * 60 * 1000);
});

test('V2 marketplace archetype filters resolve to compatible equipment only', () => {
  const archerItemIds = getMarketplaceArchetypeItemIds('archer');
  assert.ok(archerItemIds.length > 0);
  assert.equal(getMarketplaceArchetypeItemIds('all'), null);
  assert.equal(getMarketplaceArchetypeItemIds('unknown'), null);
  assert.ok(archerItemIds.every((itemId) => {
    const item = getItemDefinition(itemId);
    const allowed = item.requirements?.allowedArchetypes || [];
    return item.category === 'equipment'
      && (!Array.isArray(allowed) || !allowed.length || allowed.includes('archer'));
  }));
});

test('V2 router exposes the current migration, world, inventory, and shop endpoints', () => {
  const registered = [];
  const app = {
    get(path) { registered.push(`GET ${path}`); },
    post(path) { registered.push(`POST ${path}`); }
  };
  registerV2Routes({
    app,
    User: {},
    bcrypt: {},
    jwt: {},
    jwtSecret: 'test',
    adminUsername: 'admin',
    adminPassword: 'password',
    requireAdmin: () => true
  });
  assert.deepEqual(registered, [
    'GET /api/v2/meta',
    'GET /api/v2/signup/config',
    'POST /api/v2/signup/validate-code',
    'POST /api/v2/signup',
    'POST /api/v2/login',
    'POST /api/v2/presence/heartbeat',
    'GET /api/v2/migration/preview',
    'POST /api/v2/migration/prepare',
    'GET /api/v2/world/maps',
    'GET /api/v2/bus/status',
    'POST /api/v2/bus/ticket/purchase',
    'POST /api/v2/bus/board',
    'POST /api/v2/bus/exit',
    'GET /api/v2/quests',
    'GET /api/v2/npcs/:npcId',
    'GET /api/v2/daily-augment',
    'POST /api/v2/daily-augment/reroll',
    'POST /api/v2/daily-augment/select',
    'POST /api/v2/quests/accept',
    'POST /api/v2/quests/visit',
    'POST /api/v2/quests/claim',
    'GET /api/v2/patch-notes',
    'POST /api/v2/patch-notes/seen',
    'GET /api/v2/me',
    'POST /api/v2/stats/allocate',
    'POST /api/v2/advancement',
    'POST /api/v2/skills/invest',
    'POST /api/v2/skills/preset',
    'POST /api/v2/skills/auto-preset',
    'POST /api/v2/skills/use',
    'GET /api/v2/inventory',
    'POST /api/v2/inventory/sort',
    'POST /api/v2/inventory/quick-slot',
    'GET /api/v2/storage',
    'POST /api/v2/storage/deposit',
    'POST /api/v2/storage/withdraw',
    'POST /api/v2/inventory/consumable-quick-slot',
    'POST /api/v2/inventory/use-consumable-slot',
    'POST /api/v2/inventory/auto-potion',
    'POST /api/v2/inventory/use-potion',
    'POST /api/v2/inventory/expand',
    'POST /api/v2/inventory/use-job-change',
    'POST /api/v2/equipment/equip',
    'POST /api/v2/equipment/unequip',
    'POST /api/v2/equipment/enhance',
    'POST /api/v2/inventory/use-stat-reset',
    'GET /api/v2/event/settlement-support',
    'POST /api/v2/event/settlement-support/buy',
    'GET /api/v2/event/late-summer-yard',
    'POST /api/v2/event/late-summer-yard/open',
    'GET /api/v2/marketplace',
    'POST /api/v2/marketplace/list',
    'POST /api/v2/marketplace/buy',
    'POST /api/v2/marketplace/cancel',
    'POST /api/v2/marketplace/settle',
    'GET /api/v2/shop',
    'POST /api/v2/shop/buy',
    'POST /api/v2/shop/sell',
    'POST /api/v2/shop/recharge-throwing-star',
    'GET /api/v2/special-actions/crafting',
    'POST /api/v2/special-actions/crafting/craft',
    'POST /api/v2/special-actions/salary-lupin',
    'POST /api/v2/special-actions/shout',
    'GET /api/v2/cash-shop',
    'POST /api/v2/cash-shop/buy',
    'POST /api/v2/inventory/use-item',
    'GET /api/v2/mail',
    'GET /api/v2/mail/status',
    'POST /api/v2/mail/claim',
    'POST /api/v2/mail/claim-all',
    'POST /api/v2/world/claim-control',
    'GET /api/v2/ranking',
    'GET /api/v2/party',
    'POST /api/v2/hunting-time/toggle',
    'POST /api/v2/hunting-time/tick',
    'POST /api/v2/hunting-time/offline-summary/seen',
    'POST /api/v2/party/invite',
    'POST /api/v2/party/accept',
    'POST /api/v2/party/decline',
    'POST /api/v2/party/leave',
    'POST /api/v2/party/kick',
    'GET /api/v2/trade',
    'POST /api/v2/trade/request',
    'POST /api/v2/trade/respond',
    'POST /api/v2/trade/offer',
    'POST /api/v2/trade/confirm',
    'POST /api/v2/trade/cancel',
    'POST /api/v2/world/heartbeat',
    'POST /api/v2/world/party-portal/use',
    'POST /api/v2/world/attack',
    'POST /api/v2/world/revive',
    'POST /api/v2/world/leave',
    'GET /api/v2/admin/grant-items',
    'GET /api/v2/boss-expeditions',
    'POST /api/v2/boss-expeditions/slot',
    'POST /api/v2/boss-expeditions/leadership',
    'POST /api/v2/boss-expeditions/parties',
    'POST /api/v2/boss-expeditions/start',
    'POST /api/v2/boss-expeditions/respond',
    'POST /api/v2/boss-raids/leave',
    'POST /api/v2/boss-raids/abandon',
    'POST /api/v2/admin/cash/grant',
    'POST /api/v2/admin/mail/send',
    'POST /api/v2/admin/account/delete',
    'GET /api/v2/admin/signup-code',
    'POST /api/v2/admin/signup-code',
    'GET /api/v2/admin/migration-summary',
    'POST /api/v2/admin/snapshot-batch'
  ]);
});

test('mail claims refresh the mutable world cache after saving rewards', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/v2/registerV2Routes.js'),
    'utf8'
  );
  const singleStart = source.indexOf("app.post('/api/v2/mail/claim'");
  const allStart = source.indexOf("app.post('/api/v2/mail/claim-all'");
  const nextRoute = source.indexOf("app.post('/api/v2/world/claim-control'", allStart);
  assert.match(
    source.slice(singleStart, allStart),
    /await character\.save\(\);\s*cacheWorldProfile\(character\);/
  );
  assert.match(
    source.slice(allStart, nextRoute),
    /await character\.save\(\);\s*cacheWorldProfile\(character\);/
  );
});


test('automatic migration only selects users with incomplete V2 records', () => {
  const incomplete = getIncompleteMigrationIds(
    ['user-a', 'user-b', 'user-c'],
    ['user-a', 'user-b'],
    ['user-a', 'user-c'],
    ['user-a', 'user-b', 'user-c']
  );
  assert.deepEqual(incomplete, ['user-b', 'user-c']);
});

test('automatic migration permanently excludes admin-deleted users', () => {
  const incomplete = getIncompleteMigrationIds(
    ['user-a', 'user-b', 'user-c'],
    ['user-a'],
    ['user-a', 'user-b'],
    ['user-a'],
    ['user-b']
  );
  assert.deepEqual(incomplete, ['user-c']);
});

test('a leftover snapshot without an account and character is recognized as a pre-patch deletion', () => {
  const orphaned = getOrphanedDeletedIds(
    ['user-a', 'user-b', 'user-c'],
    ['user-a'],
    ['user-a', 'user-b', 'user-c'],
    ['user-a', 'user-c']
  );
  assert.deepEqual(orphaned, ['user-b']);
});
