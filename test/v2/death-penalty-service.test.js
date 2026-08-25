'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEATH_EXP_PROTECTION_ITEM_ID,
  isRaidDeathContext,
  calculateDeathExpLoss,
  applyDeathExpPenalty
} = require('../../src/v2/services/deathPenaltyService');

function characterFixture({ exp = 900_000, blood = 0 } = {}) {
  return {
    progression: { exp },
    inventory: {
      items: blood > 0
        ? [{ stackId: 'blood-stack', itemId: DEATH_EXP_PROTECTION_ITEM_ID, quantity: blood }]
        : [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', consumables: ['', '', '', ''] }
    },
    markModified() {}
  };
}

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

test('Gyeo manager blood consumes one item and prevents one normal or raid exp loss', () => {
  const character = characterFixture({ blood: 2 });

  const normalDeath = applyDeathExpPenalty(character, {
    requiredExp: 1_000_000
  });
  assert.equal(normalDeath.expLost, 0);
  assert.equal(normalDeath.protectedByItem, true);
  assert.equal(normalDeath.remainingProtectionItems, 1);
  assert.equal(character.progression.exp, 900_000);

  const raidDeath = applyDeathExpPenalty(character, {
    requiredExp: 1_000_000,
    raidDeath: true
  });
  assert.equal(raidDeath.expLost, 0);
  assert.equal(raidDeath.protectedByItem, true);
  assert.equal(raidDeath.remainingProtectionItems, 0);
  assert.equal(character.progression.exp, 900_000);

  const unprotectedDeath = applyDeathExpPenalty(character, {
    requiredExp: 1_000_000
  });
  assert.equal(unprotectedDeath.expLost, 100_000);
  assert.equal(unprotectedDeath.protectedByItem, false);
  assert.equal(character.progression.exp, 800_000);
});

test('Gyeo manager blood is not consumed when there is no experience to lose', () => {
  const character = characterFixture({ exp: 0, blood: 1 });
  const result = applyDeathExpPenalty(character, { requiredExp: 1_000_000 });

  assert.equal(result.expLost, 0);
  assert.equal(result.protectedByItem, false);
  assert.equal(result.remainingProtectionItems, 1);
});
