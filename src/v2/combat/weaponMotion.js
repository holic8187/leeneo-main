'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');

const WEAPON_COMBAT_MOTIONS = Object.freeze({
  oneHandedSword: 'slash',
  twoHandedSword: 'slash',
  oneHandedAxe: 'slash',
  oneHandedBlunt: 'slash',
  twoHandedAxe: 'slash',
  twoHandedBlunt: 'slash',
  spear: 'slash',
  polearm: 'slash',
  dagger: 'slash',
  knuckle: 'slash',
  bow: 'shoot',
  crossbow: 'shoot',
  gun: 'shoot',
  claw: 'throw',
  wand: 'staff-swing',
  staff: 'staff-swing'
});

const ARCHETYPE_COMBAT_MOTIONS = Object.freeze({
  warrior: 'slash',
  archer: 'shoot',
  thief: 'throw',
  mage: 'staff-swing'
});

const COMBAT_MOTION_LABELS = Object.freeze({
  slash: '베기',
  shoot: '쏘기',
  throw: '날리기',
  'staff-swing': '완드·스태프 휘두르기'
});

function resolveCombatMotion({ weaponType, departmentId } = {}) {
  const weaponMotion = WEAPON_COMBAT_MOTIONS[weaponType];
  if (weaponMotion) {
    return {
      motion: weaponMotion,
      label: COMBAT_MOTION_LABELS[weaponMotion],
      source: 'weapon',
      weaponType
    };
  }

  const archetype = DEPARTMENTS[departmentId]?.archetype;
  const jobMotion = ARCHETYPE_COMBAT_MOTIONS[archetype];
  if (jobMotion) {
    return {
      motion: jobMotion,
      label: COMBAT_MOTION_LABELS[jobMotion],
      source: 'department-preview',
      weaponType: null
    };
  }

  return {
    motion: 'slash',
    label: '연습용 베기',
    source: 'trainee-preview',
    weaponType: null
  };
}

module.exports = {
  WEAPON_COMBAT_MOTIONS,
  ARCHETYPE_COMBAT_MOTIONS,
  COMBAT_MOTION_LABELS,
  resolveCombatMotion
};
