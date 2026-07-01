'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeaponRequirements,
  canEquipWeapon
} = require('../../src/v2/items/weaponRequirements');

test('weapon secondary requirements are derived automatically from required level', () => {
  assert.deepEqual(buildWeaponRequirements('bow', 60).stats, { grit: 65 });
  assert.deepEqual(buildWeaponRequirements('crossbow', 60).stats, { grit: 60 });
  assert.deepEqual(buildWeaponRequirements('staff', 60).stats, { awareness: 63 });
  assert.deepEqual(buildWeaponRequirements('wand', 60).stats, { awareness: 62 });
  assert.deepEqual(buildWeaponRequirements('claw', 60).stats, { processingSpeed: 100 });
  assert.deepEqual(buildWeaponRequirements('dagger', 60).stats, { processingSpeed: 100 });
  assert.deepEqual(buildWeaponRequirements('twoHandedSword', 60).stats, {});
});

test('weapon equip validation checks both level and mapped V2 stats', () => {
  const item = { weaponType: 'claw', requiredLevel: 60 };
  assert.equal(canEquipWeapon({
    progression: { level: 60 },
    stats: { processingSpeed: 99 }
  }, item), false);
  assert.equal(canEquipWeapon({
    progression: { level: 60 },
    stats: { processingSpeed: 100 }
  }, item), true);
});
