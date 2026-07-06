'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemDefinition, listAdminGrantItems } = require('../../src/v2/items/itemCatalog');
const { applyLevelUpCoupon } = require('../../src/v2/services/levelUpCouponService');

function makeCharacter(level = 10, exp = 1234) {
  return {
    progression: {
      level,
      exp,
      unspentStatPoints: 0,
      unspentSkillPoints: 0,
      totalSkillPointsEarned: 0
    },
    stats: {
      grit: 4,
      processingSpeed: 4,
      workKnowledge: 4,
      awareness: 4
    },
    job: {
      departmentId: 'unassigned',
      advancementTier: 0
    },
    skills: {
      levels: {}
    },
    resources: {
      currentHp: 176,
      maxHp: 176,
      currentMp: 104,
      maxMp: 104,
      hpGrowthSkillBonus: 0,
      mpGrowthSkillBonus: 0,
      maxResourceBuffPercentApplied: 0
    },
    markModified() {}
  };
}

test('level-up coupon is a nontradeable admin cash item', () => {
  const item = getItemDefinition('level_up_coupon');
  assert.equal(item.category, 'cash');
  assert.equal(item.itemType, 'level-up');
  assert.equal(item.tradeable, false);
  assert.equal(item.adminGrantOnly, true);
  assert.ok(listAdminGrantItems().some((entry) => entry.id === item.id));
});

test('level-up coupon advances exactly one level and resets experience', () => {
  const character = makeCharacter(10, 999999);
  const result = applyLevelUpCoupon(character);

  assert.equal(result.previousLevel, 10);
  assert.equal(result.level, 11);
  assert.equal(character.progression.level, 11);
  assert.equal(character.progression.exp, 0);
  assert.equal(character.progression.unspentStatPoints, 5);
  assert.equal(character.progression.unspentSkillPoints, 3);
  assert.equal(character.progression.totalSkillPointsEarned, 3);
  assert.equal(character.resources.maxHp, 190);
  assert.equal(character.resources.maxMp, 115);
});

test('level-up coupon cannot be used at level 200', () => {
  const character = makeCharacter(200, 0);
  assert.throws(
    () => applyLevelUpCoupon(character),
    /만렙/
  );
  assert.equal(character.progression.level, 200);
  assert.equal(character.progression.exp, 0);
});
