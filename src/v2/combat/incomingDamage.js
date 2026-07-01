'use strict';

const { normalizeStats } = require('./combatFormulas');

const STANDARD_PDD_TABLES = Object.freeze({
  beginner: Object.freeze([
    [1, 7], [5, 17], [8, 19]
  ]),
  warrior: Object.freeze([
    [10, 54], [12, 57], [15, 83], [20, 106], [22, 109], [25, 129],
    [30, 154], [35, 179], [40, 203], [47, 208], [50, 261], [55, 267],
    [60, 305], [65, 308], [70, 359], [75, 356], [80, 382], [85, 388],
    [90, 440], [95, 446], [100, 494]
  ]),
  mage: Object.freeze([
    [8, 25], [10, 31], [13, 40], [15, 49], [18, 54], [20, 56],
    [25, 60], [28, 64], [30, 75], [33, 91], [35, 98], [40, 99],
    [48, 107], [50, 131], [55, 134], [58, 142], [60, 159], [65, 162],
    [68, 170], [70, 184], [75, 190], [78, 198], [80, 212], [85, 218],
    [88, 226], [90, 240], [95, 246], [98, 254], [100, 266]
  ]),
  archer: Object.freeze([
    [10, 32], [15, 49], [20, 65], [25, 80], [30, 95], [35, 110],
    [40, 125], [50, 145], [55, 148], [60, 177], [65, 180], [70, 206],
    [75, 212], [80, 238], [85, 244], [90, 270], [95, 276], [100, 298]
  ]),
  thief: Object.freeze([
    [15, 60], [20, 76], [22, 85], [25, 100], [30, 115], [32, 116],
    [35, 131], [37, 132], [40, 147], [50, 184], [55, 187], [60, 220],
    [65, 223], [70, 257], [75, 263], [80, 291], [85, 297], [90, 325],
    [95, 331], [100, 331]
  ])
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value)));
}

function normalizeDefenseArchetype(archetype) {
  if (STANDARD_PDD_TABLES[archetype]) return archetype;
  if (archetype === 'knucklePirate' || archetype === 'gunPirate' || archetype === 'pirate') {
    return 'beginner';
  }
  return 'beginner';
}

function getStandardPdd(archetype, level) {
  const table = STANDARD_PDD_TABLES[normalizeDefenseArchetype(archetype)];
  const resolvedLevel = Math.max(1, Math.floor(finite(level) || 1));
  if (resolvedLevel <= table[0][0]) return table[0][1];

  for (let index = 1; index < table.length; index += 1) {
    const [rightLevel, rightPdd] = table[index];
    const [leftLevel, leftPdd] = table[index - 1];
    if (resolvedLevel <= rightLevel) {
      const progress = (resolvedLevel - leftLevel) / (rightLevel - leftLevel);
      return leftPdd + (rightPdd - leftPdd) * progress;
    }
  }

  // The supplied reference ends at level 100. Keep the last verified value
  // instead of inventing a 101-200 curve.
  return table[table.length - 1][1];
}

function rollBetween(minimum, maximum, random = Math.random) {
  const ratio = clamp(typeof random === 'function' ? random() : random, 0, 1);
  return minimum + (maximum - minimum) * ratio;
}

function getPhysicalDefenseBase(archetype, stats = {}) {
  const normalized = normalizeStats(stats);
  if (archetype === 'warrior') {
    return Math.floor(
      (normalized.luck + normalized.dexterity) / 4
      + normalized.intelligence / 9
      + normalized.strength * 2 / 7
    );
  }
  return Math.floor(
    normalized.intelligence / 9
    + normalized.dexterity * 2 / 7
    + normalized.strength * 0.4
    + normalized.luck / 4
  );
}

function applyIncomingModifiers(rawDamage, {
  invinciblePercent = 0,
  damageTakenPercent = null,
  maximumDamage = Number.MAX_SAFE_INTEGER
} = {}) {
  let damage = nonNegative(rawDamage);
  damage -= damage * clamp(invinciblePercent, 0, 100) / 100;
  if (damageTakenPercent !== null && damageTakenPercent !== undefined) {
    damage *= nonNegative(damageTakenPercent) / 100;
  }
  return Math.min(
    Math.max(1, Math.floor(damage)),
    Math.max(1, Math.floor(nonNegative(maximumDamage) || Number.MAX_SAFE_INTEGER))
  );
}

function calculateIncomingPhysicalDamage({
  monsterAttack,
  monsterLevel,
  playerLevel,
  playerStats = {},
  physicalDefense,
  archetype = 'beginner',
  invinciblePercent = 0,
  damageTakenPercent = null,
  maximumDamage,
  random = Math.random
} = {}) {
  const pad = nonNegative(monsterAttack);
  if (pad <= 0) return {
    damage: 0,
    rolledAttack: 0,
    physicalDefense: nonNegative(physicalDefense),
    standardPdd: getStandardPdd(archetype, playerLevel),
    defenseFactor: 0
  };

  const level = Math.max(1, Math.floor(finite(playerLevel) || 1));
  const targetLevel = Math.max(1, Math.floor(finite(monsterLevel) || 1));
  const pdd = nonNegative(physicalDefense);
  const standardPdd = getStandardPdd(archetype, level);
  const rolledAttack = rollBetween(pad * 0.8, pad * 0.85, random);
  const base = getPhysicalDefenseBase(archetype, playerStats);
  const statModifier = base * 0.00125;
  let defenseFactor;

  if (pdd < standardPdd) {
    const option = level / 550 + statModifier + 0.28;
    defenseFactor = level >= targetLevel
      ? option * (pdd - standardPdd) * 13 / ((level - targetLevel) + 13)
      : option * (pdd - standardPdd) * 1.3;
  } else {
    defenseFactor = base / 900
      + ((level / 1300) + 0.28) * (pdd - standardPdd) * 0.7;
  }

  const rawDamage = rolledAttack - (
    defenseFactor + (statModifier + 0.28) * pdd
  );
  return {
    damage: applyIncomingModifiers(rawDamage, {
      invinciblePercent,
      damageTakenPercent,
      maximumDamage
    }),
    rawDamage,
    rolledAttack,
    physicalDefense: pdd,
    standardPdd,
    defenseFactor,
    statModifier,
    defenseBase: base
  };
}

function calculateIncomingMagicDamage({
  monsterMagicAttack,
  playerStats = {},
  magicDefense,
  archetype = 'beginner',
  damageTakenPercent = null,
  maximumDamage,
  random = Math.random
} = {}) {
  const mad = nonNegative(monsterMagicAttack);
  if (mad <= 0) return {
    damage: 0,
    rolledAttack: 0,
    magicDefense: nonNegative(magicDefense),
    defenseModifier: 0
  };

  const normalized = normalizeStats(playerStats);
  const mdd = nonNegative(magicDefense);
  const rolledAttack = rollBetween(mad * 0.75, mad * 0.8, random);
  const attackTerm = rolledAttack * mad * 0.01;
  const defenseBase = normalized.strength / 7
    + normalized.luck / 5
    + normalized.dexterity / 6
    + mdd;
  const defenseCoefficient = archetype === 'mage' ? 0.3 : 0.25;
  const defenseModifier = defenseBase * defenseCoefficient;
  const rawDamage = attackTerm - defenseModifier;

  return {
    damage: applyIncomingModifiers(rawDamage, {
      damageTakenPercent,
      maximumDamage
    }),
    rawDamage,
    rolledAttack,
    magicDefense: mdd,
    defenseBase,
    defenseCoefficient,
    defenseModifier
  };
}

module.exports = {
  STANDARD_PDD_TABLES,
  normalizeDefenseArchetype,
  getStandardPdd,
  getPhysicalDefenseBase,
  calculateIncomingPhysicalDamage,
  calculateIncomingMagicDamage
};
