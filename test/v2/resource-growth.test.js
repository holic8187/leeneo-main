'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateReferenceResources
} = require('../../src/v2/progression/resourceGrowth');

test('beginner resource averages match the supplied level 1 through 10 table', () => {
  assert.deepEqual(
    calculateReferenceResources({ level: 1 }),
    { maxHp: 50, maxMp: 5, provisional: false, growthVersion: 2 }
  );
  assert.equal(calculateReferenceResources({ level: 10 }).maxHp, 176);
  assert.equal(calculateReferenceResources({ level: 10 }).maxMp, 104);
});

test('warrior reference excludes the separately reconciled HP growth passive', () => {
  const firstJob = calculateReferenceResources({
    level: 30,
    departmentId: 'hr',
    advancementTier: 1,
    archetype: 'warrior'
  });
  assert.equal(firstJob.maxHp, 920);
  assert.equal(firstJob.maxMp, 204);

  const talentManager = calculateReferenceResources({
    level: 30,
    departmentId: 'hr',
    advancementTier: 2,
    archetype: 'warrior'
  });
  assert.equal(talentManager.maxHp, 1250);
  assert.equal(talentManager.maxMp, 204);

  const fieldWorker = calculateReferenceResources({
    level: 60,
    departmentId: 'field_operations',
    advancementTier: 2,
    archetype: 'warrior'
  });
  assert.equal(fieldWorker.maxHp, 1830);
  assert.equal(fieldWorker.maxMp, 474);
});

test('archer and thief reference averages share the supplied progression', () => {
  const archer = calculateReferenceResources({
    level: 120,
    departmentId: 'accounting',
    advancementTier: 4,
    archetype: 'archer'
  });
  assert.equal(archer.maxHp, 3040);
  assert.equal(archer.maxMp, 1970);
});
