'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isRaidDeathContext,
  calculateDeathExpLoss
} = require('../../src/v2/services/deathPenaltyService');

test('raid deaths always use one percent of the level requirement', () => {
  assert.equal(calculateDeathExpLoss({
    currentExp: 900_000,
    requiredExp: 1_000_000,
    raidDeath: true
  }), 10_000);
});

test('normal deaths use ten percent and losses never exceed current experience', () => {
  assert.equal(calculateDeathExpLoss({
    currentExp: 900_000,
    requiredExp: 1_000_000
  }), 100_000);
  assert.equal(calculateDeathExpLoss({
    currentExp: 3_000,
    requiredExp: 1_000_000,
    raidDeath: true
  }), 3_000);
});

test('stored raid state preserves the raid penalty even when map lookup is unavailable', () => {
  assert.equal(isRaidDeathContext({ worldState: { raidBossId: 'bald_kim_manager' } }, null), true);
  assert.equal(isRaidDeathContext({}, { raidBossId: 'bald_kim_manager' }), true);
  assert.equal(isRaidDeathContext({}, {}), false);
});
