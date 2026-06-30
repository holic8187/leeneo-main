'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SNAPSHOT_FIELDS,
  buildLegacyPayload,
  buildV2AccountSeed,
  buildMigrationPreview
} = require('../../src/v2/services/migrationService');
const { registerV2Routes } = require('../../src/v2/registerV2Routes');
const { getIncompleteMigrationIds } = require('../../src/v2/services/automaticMigrationService');

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

test('V2 router exposes only the migration foundation endpoints in phase one', () => {
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
    'POST /api/v2/login',
    'GET /api/v2/migration/preview',
    'POST /api/v2/migration/prepare',
    'GET /api/v2/me',
    'GET /api/v2/admin/migration-summary',
    'POST /api/v2/admin/snapshot-batch'
  ]);
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
