'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeaponRequirements,
  getWeaponEquipFailureReason,
  getEquipmentEquipFailureReason,
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
    job: { departmentId: 'sales' },
    stats: { processingSpeed: 99 }
  }, item), false);
  assert.equal(canEquipWeapon({
    progression: { level: 60 },
    job: { departmentId: 'sales' },
    stats: { processingSpeed: 100 }
  }, item), true);
});

test('weapon equip validation rejects weapons outside the character job archetype', () => {
  const sword = { weaponType: 'oneHandedSword', requiredLevel: 1 };
  const bow = { weaponType: 'bow', requiredLevel: 1 };
  const warrior = {
    progression: { level: 10 },
    job: { departmentId: 'hr' },
    stats: { grit: 10, processingSpeed: 10 }
  };
  const archer = {
    progression: { level: 10 },
    job: { departmentId: 'accounting' },
    stats: { grit: 10, processingSpeed: 10 }
  };
  assert.equal(canEquipWeapon(warrior, sword), true);
  assert.equal(canEquipWeapon(warrior, bow), false);
  assert.equal(canEquipWeapon(archer, sword), false);
  assert.match(getWeaponEquipFailureReason(archer, sword), /전사/);
});

test('future shared weapons can declare more than one allowed archetype', () => {
  const sharedWeapon = {
    weaponType: 'prototypeShared',
    requirements: {
      level: 1,
      stats: {},
      allowedArchetypes: ['warrior', 'thief']
    }
  };
  assert.equal(canEquipWeapon({
    progression: { level: 1 },
    job: { departmentId: 'hr' },
    stats: {}
  }, sharedWeapon), true);
  assert.equal(canEquipWeapon({
    progression: { level: 1 },
    job: { departmentId: 'sales' },
    stats: {}
  }, sharedWeapon), true);
  assert.equal(canEquipWeapon({
    progression: { level: 1 },
    job: { departmentId: 'accounting' },
    stats: {}
  }, sharedWeapon), false);
});

test('earrings and capes are common equipment even when old data contains job requirements', () => {
  const character = {
    progression: { level: 130 },
    job: { departmentId: 'accounting' },
    stats: { grit: 4, processingSpeed: 4, workKnowledge: 4, awareness: 4 }
  };
  const legacyEarrings = {
    itemType: 'armor',
    equipmentSlot: 'earrings',
    requiredLevel: 100,
    requirements: {
      level: 100,
      allowedArchetypes: ['warrior'],
      stats: { grit: 999 }
    }
  };
  assert.equal(getEquipmentEquipFailureReason(character, legacyEarrings), '');
});
