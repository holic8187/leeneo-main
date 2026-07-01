'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');
const {
  WEAPON_CONSTANTS,
  calculatePhysicalAttackRange,
  calculateAccuracy,
  calculateEvasion
} = require('./combatFormulas');
const { DEFAULT_WEAPON_RANGES } = require('./weaponMotion');

const LOADOUT_SLOT_KEYS = Object.freeze([
  'weapon',
  'helmet',
  'gloves',
  'shoes',
  'cape',
  'top',
  'bottom',
  'necklace',
  'earrings'
]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getItemStat(item, ...keys) {
  for (const key of keys) {
    const value = finite(item?.stats?.[key] ?? item?.[key]);
    if (value) return value;
  }
  return 0;
}

function sumLoadoutStat(loadout, ...keys) {
  return LOADOUT_SLOT_KEYS.reduce(
    (sum, slot) => sum + getItemStat(loadout?.[slot], ...keys),
    0
  );
}

function getAccuracyGroup(archetype) {
  return archetype === 'archer' || archetype === 'thief' ? 'ranged' : 'standard';
}

function getEvasionGroup() {
  return 'standard';
}

function roundStat(value) {
  return Math.round(Math.max(0, finite(value)) * 100) / 100;
}

function buildDerivedStats({ progression = {}, stats = {}, job = {}, loadout = {} } = {}) {
  const department = DEPARTMENTS[job.departmentId];
  const archetype = department?.archetype || 'warrior';
  const weapon = loadout.weapon || null;
  const weaponType = weapon?.weaponType || null;
  const totalAttack = sumLoadoutStat(loadout, 'attack', 'weaponAttack');
  const mastery = getItemStat(weapon, 'mastery');
  let attackRange = { minimum: 0, maximum: 0 };

  if (weaponType && WEAPON_CONSTANTS[weaponType] && archetype !== 'mage') {
    attackRange = calculatePhysicalAttackRange({
      archetype,
      weaponType,
      stats,
      totalAttack,
      mastery
    });
  }

  const accuracy = calculateAccuracy({
    group: getAccuracyGroup(archetype),
    stats,
    bonusAccuracy: sumLoadoutStat(loadout, 'accuracy')
  });
  const evasion = calculateEvasion({
    group: getEvasionGroup(archetype),
    stats,
    bonusEvasion: sumLoadoutStat(loadout, 'evasion')
  });

  return {
    attackMinimum: roundStat(attackRange.minimum),
    attackMaximum: roundStat(attackRange.maximum),
    defense: roundStat(sumLoadoutStat(loadout, 'defense', 'physicalDefense')),
    magic: roundStat(sumLoadoutStat(loadout, 'magic', 'magicAttack')),
    accuracy: roundStat(accuracy),
    evasion: roundStat(evasion),
    movementSpeed: roundStat(100 + sumLoadoutStat(loadout, 'movementSpeed')),
    attackRange: Math.max(0, finite(DEFAULT_WEAPON_RANGES[weaponType]
      || (job.departmentId === 'unassigned' ? 22 : 55))),
    weaponType,
    level: Math.max(1, Math.floor(finite(progression.level) || 1)),
    provisionalRange: true
  };
}

module.exports = {
  LOADOUT_SLOT_KEYS,
  buildDerivedStats,
  sumLoadoutStat,
  getAccuracyGroup,
  getEvasionGroup
};
