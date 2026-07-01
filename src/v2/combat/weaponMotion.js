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

// Temporary pixel ranges. Balance values can be replaced without changing combat movement.
const DEFAULT_WEAPON_RANGES = Object.freeze({
  oneHandedSword: 60,
  twoHandedSword: 68,
  oneHandedAxe: 58,
  oneHandedBlunt: 58,
  twoHandedAxe: 70,
  twoHandedBlunt: 70,
  spear: 96,
  polearm: 104,
  bow: 240,
  crossbow: 260,
  claw: 200,
  dagger: 46,
  knuckle: 52,
  gun: 230,
  wand: 210,
  staff: 225
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
      weaponType,
      rangePx: DEFAULT_WEAPON_RANGES[weaponType] || 55
    };
  }

  const archetype = DEPARTMENTS[departmentId]?.archetype;
  const jobMotion = ARCHETYPE_COMBAT_MOTIONS[archetype];
  if (jobMotion) {
    return {
      motion: jobMotion,
      label: COMBAT_MOTION_LABELS[jobMotion],
      source: 'department-preview',
      weaponType: null,
      rangePx: jobMotion === 'slash' ? 55 : (jobMotion === 'throw' ? 200 : 225)
    };
  }

  return {
    motion: 'slash',
    label: '연습용 베기',
    source: 'trainee-preview',
    weaponType: null,
    rangePx: 22
  };
}

module.exports = {
  WEAPON_COMBAT_MOTIONS,
  DEFAULT_WEAPON_RANGES,
  ARCHETYPE_COMBAT_MOTIONS,
  COMBAT_MOTION_LABELS,
  resolveCombatMotion
};
