'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WEAPON_CONSTANTS,
  calculatePhysicalAttackRange,
  calculateAttackEquivalentMainStat,
  calculateMagicDamageRange,
  calculateAccuracy,
  calculateEvasion,
  calculateRequiredAccuracy,
  calculateHitChance,
  calculateMissChance,
  calculatePhysicalDamageAfterDefense,
  calculateMagicDamageAfterDefense
} = require('../../src/v2/combat/combatFormulas');

test('weapon constants preserve the V2 design values', () => {
  assert.equal(WEAPON_CONSTANTS.oneHandedSword, 4);
  assert.equal(WEAPON_CONSTANTS.twoHandedSword, 4.6);
  assert.equal(WEAPON_CONSTANTS.spear, 5);
  assert.equal(WEAPON_CONSTANTS.bow, 3.4);
  assert.equal(WEAPON_CONSTANTS.knuckle, 4.8);
});

test('physical attack range uses weapon constant and mastery', () => {
  const range = calculatePhysicalAttackRange({
    archetype: 'warrior',
    weaponType: 'oneHandedSword',
    stats: { grit: 100, processingSpeed: 20 },
    totalAttack: 50,
    mastery: 70
  });
  assert.equal(range.maximum, 210);
  assert.equal(range.minimum, 147);
});

test('attack equivalent main stat follows the attack plus one formula', () => {
  const value = calculateAttackEquivalentMainStat({
    archetype: 'warrior',
    weaponType: 'oneHandedSword',
    stats: { strength: 100, dexterity: 20 },
    totalAttack: 50
  });
  assert.ok(Math.abs(value - (420 / 51 / 4)) < 1e-12);
});

test('magic damage uses squared magic and mastery', () => {
  const range = calculateMagicDamageRange({
    magic: 500,
    workKnowledge: 400,
    skillAttack: 100,
    mastery: 60
  });
  assert.equal(range.maximum, 2700);
  assert.ok(Math.abs(range.minimum - 1933.3333333333335) < 1e-9);
});

test('accuracy, evasion, and required accuracy use class coefficients', () => {
  const stats = { processingSpeed: 100, awareness: 40 };
  assert.equal(calculateAccuracy({ group: 'standard', stats, bonusAccuracy: 5 }), 105);
  assert.equal(calculateEvasion({ group: 'brawler', stats, bonusEvasion: 5 }), 175);
  assert.equal(calculateRequiredAccuracy({
    characterLevel: 50,
    monsterLevel: 55,
    monsterEvasion: 30
  }), 130);
});

test('physical defense is applied before skill percentage', () => {
  const range = calculatePhysicalDamageAfterDefense({
    attackRange: { minimum: 700, maximum: 1000 },
    characterLevel: 50,
    monsterLevel: 55,
    physicalDefense: 100,
    skillPercent: 150
  });
  assert.equal(range.minimum, 907.5);
  assert.equal(range.maximum, 1350);
});

test('magic defense is applied after skill damage', () => {
  const range = calculateMagicDamageAfterDefense({
    skillDamageRange: { minimum: 2000, maximum: 2700 },
    characterLevel: 50,
    monsterLevel: 55,
    magicDefense: 100
  });
  assert.equal(range.minimum, 1937);
  assert.equal(range.maximum, 2647.5);
});


test('hit chance follows the accuracy ratio curve with a five percent floor', () => {
  assert.equal(calculateHitChance({ accuracy: 100, requiredAccuracy: 100 }), 1);
  assert.equal(calculateHitChance({ accuracy: 0, requiredAccuracy: 100 }), 0.05);
  assert.ok(Math.abs(
    calculateHitChance({ accuracy: 75, requiredAccuracy: 100 }) - (0.75 ** 1.25)
  ) < 1e-12);
  assert.ok(Math.abs(
    calculateMissChance({ accuracy: 50, requiredAccuracy: 100 }) - (1 - 0.5 ** 1.25)
  ) < 1e-12);
});
