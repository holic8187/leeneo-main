'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canUseBasicAttack } = require('../../src/v2/combat/basicAttackPolicy');

test('basic attacks are limited to unadvanced players below level ten', () => {
  assert.equal(canUseBasicAttack({
    progression: { level: 9 },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  }), true);

  assert.equal(canUseBasicAttack({
    progression: { level: 10 },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  }), false);

  assert.equal(canUseBasicAttack({
    progression: { level: 9 },
    job: { departmentId: 'hr', advancementTier: 1 }
  }), false);
});
