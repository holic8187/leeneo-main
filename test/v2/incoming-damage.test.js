'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStandardPdd,
  calculateIncomingPhysicalDamage,
  calculateIncomingMagicDamage
} = require('../../src/v2/combat/incomingDamage');

test('standard PDD interpolates supplied reference points and clamps after level 100', () => {
  assert.equal(getStandardPdd('beginner', 1), 7);
  assert.equal(getStandardPdd('beginner', 3), 12);
  assert.equal(getStandardPdd('warrior', 10), 54);
  assert.equal(getStandardPdd('warrior', 11), 55.5);
  assert.equal(getStandardPdd('warrior', 200), 494);
});

test('physical incoming damage uses PAD roll, class PDD, and V2 stat aliases', () => {
  const result = calculateIncomingPhysicalDamage({
    monsterAttack: 100,
    monsterLevel: 20,
    playerLevel: 20,
    playerStats: {
      grit: 50,
      processingSpeed: 20,
      workKnowledge: 10,
      awareness: 8
    },
    physicalDefense: 106,
    archetype: 'warrior',
    random: () => 0
  });

  assert.equal(result.rolledAttack, 80);
  assert.equal(result.standardPdd, 106);
  assert.equal(result.defenseBase, 22);
  assert.equal(result.damage, 47);
});

test('physical damage becomes harsher below the level PDD requirement', () => {
  const common = {
    monsterAttack: 100,
    monsterLevel: 20,
    playerLevel: 20,
    playerStats: { grit: 50, processingSpeed: 20 },
    archetype: 'warrior',
    random: () => 0
  };
  const below = calculateIncomingPhysicalDamage({ ...common, physicalDefense: 20 });
  const met = calculateIncomingPhysicalDamage({ ...common, physicalDefense: 106 });
  assert.ok(below.damage > met.damage);
});

test('magic incoming damage applies the larger mage defense coefficient', () => {
  const common = {
    monsterMagicAttack: 100,
    playerStats: { grit: 20, processingSpeed: 20, awareness: 20 },
    magicDefense: 30,
    random: () => 0
  };
  const mage = calculateIncomingMagicDamage({ ...common, archetype: 'mage' });
  const warrior = calculateIncomingMagicDamage({ ...common, archetype: 'warrior' });

  assert.equal(mage.rolledAttack, 75);
  assert.equal(mage.defenseCoefficient, 0.3);
  assert.equal(warrior.defenseCoefficient, 0.25);
  assert.ok(mage.damage < warrior.damage);
});
