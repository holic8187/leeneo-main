'use strict';

const WEAPON_CONSTANTS = Object.freeze({
  oneHandedSword: 4,
  twoHandedSword: 4.6,
  oneHandedAxe: 4.4,
  oneHandedBlunt: 4.4,
  twoHandedAxe: 4.8,
  twoHandedBlunt: 4.8,
  spear: 5,
  polearm: 5,
  bow: 3.4,
  crossbow: 3.6,
  claw: 3.6,
  dagger: 3.6,
  knuckle: 4.8,
  gun: 3.6
});

const WEAPON_LABELS = Object.freeze({
  oneHandedSword: '한손검',
  twoHandedSword: '두손검',
  oneHandedAxe: '한손도끼',
  oneHandedBlunt: '한손둔기',
  twoHandedAxe: '두손도끼',
  twoHandedBlunt: '두손둔기',
  spear: '창',
  polearm: '폴암',
  bow: '활',
  crossbow: '석궁',
  claw: '아대',
  dagger: '단검',
  knuckle: '너클',
  gun: '건'
});

const PHYSICAL_ARCHETYPES = Object.freeze({
  warrior: 'warrior',
  archer: 'archer',
  thief: 'thief',
  knucklePirate: 'knucklePirate',
  gunPirate: 'gunPirate'
});

const ACCURACY_GROUPS = Object.freeze({
  standard: { dexterity: 0.8, luck: 0.5 },
  brawler: { dexterity: 0.9, luck: 0.3 },
  ranged: { dexterity: 0.6, luck: 0.3 }
});

const EVASION_GROUPS = Object.freeze({
  standard: { dexterity: 0.25, luck: 0.5 },
  brawler: { dexterity: 1.5, luck: 0.5 },
  gunslinger: { dexterity: 0.125, luck: 0.5 }
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function normalizeMastery(value) {
  const mastery = nonNegative(value);
  return Math.min(1, mastery > 1 ? mastery / 100 : mastery);
}

function normalizeStats(stats = {}) {
  return {
    strength: nonNegative(stats.strength ?? stats.grit),
    dexterity: nonNegative(stats.dexterity ?? stats.processingSpeed),
    intelligence: nonNegative(stats.intelligence ?? stats.workKnowledge),
    luck: nonNegative(stats.luck ?? stats.awareness)
  };
}

function getWeaponConstant(weaponType) {
  if (typeof weaponType === 'number') return nonNegative(weaponType);
  const constant = WEAPON_CONSTANTS[weaponType];
  if (!constant) throw new Error(`지원하지 않는 무기 종류입니다: ${weaponType}`);
  return constant;
}

function getPhysicalStatNumerator(archetype, stats, weaponConstant) {
  const normalized = normalizeStats(stats);
  switch (archetype) {
    case PHYSICAL_ARCHETYPES.warrior:
    case PHYSICAL_ARCHETYPES.knucklePirate:
      return normalized.strength * weaponConstant + normalized.dexterity;
    case PHYSICAL_ARCHETYPES.archer:
    case PHYSICAL_ARCHETYPES.gunPirate:
      return normalized.dexterity * weaponConstant + normalized.strength;
    case PHYSICAL_ARCHETYPES.thief:
      return normalized.luck * weaponConstant + normalized.strength + normalized.dexterity;
    default:
      throw new Error(`지원하지 않는 물리 공격 계열입니다: ${archetype}`);
  }
}

function calculatePhysicalAttackRange({
  archetype,
  weaponType,
  stats,
  totalAttack,
  mastery
}) {
  const weaponConstant = getWeaponConstant(weaponType);
  const numerator = getPhysicalStatNumerator(archetype, stats, weaponConstant);
  const maximum = numerator * nonNegative(totalAttack) / 100;
  const normalizedMastery = normalizeMastery(mastery);
  return {
    minimum: maximum * normalizedMastery,
    maximum,
    mastery: normalizedMastery,
    weaponConstant
  };
}

function calculateAttackEquivalentMainStat({
  archetype,
  weaponType,
  stats,
  totalAttack
}) {
  const weaponConstant = getWeaponConstant(weaponType);
  const numerator = getPhysicalStatNumerator(archetype, stats, weaponConstant);
  return numerator / (nonNegative(totalAttack) + 1) / weaponConstant;
}

function calculateMagicDamageRange({
  magic,
  intelligence,
  workKnowledge,
  skillAttack,
  mastery
}) {
  const magicValue = nonNegative(magic);
  const intelligenceValue = nonNegative(intelligence ?? workKnowledge);
  const skillAttackValue = nonNegative(skillAttack);
  const normalizedMastery = normalizeMastery(mastery);
  const common = (magicValue ** 2) / 1000;
  const statTerm = intelligenceValue / 200;
  return {
    minimum: ((common + magicValue * 0.9 * normalizedMastery) / 30 + statTerm) * skillAttackValue,
    maximum: ((common + magicValue) / 30 + statTerm) * skillAttackValue,
    mastery: normalizedMastery
  };
}

function calculateAccuracy({ group, stats, bonusAccuracy = 0 }) {
  const coefficients = ACCURACY_GROUPS[group];
  if (!coefficients) throw new Error(`지원하지 않는 명중 계열입니다: ${group}`);
  const normalized = normalizeStats(stats);
  return normalized.dexterity * coefficients.dexterity
    + normalized.luck * coefficients.luck
    + finite(bonusAccuracy);
}

function calculateEvasion({ group, stats, bonusEvasion = 0 }) {
  const coefficients = EVASION_GROUPS[group];
  if (!coefficients) throw new Error(`지원하지 않는 회피 계열입니다: ${group}`);
  const normalized = normalizeStats(stats);
  return normalized.dexterity * coefficients.dexterity
    + normalized.luck * coefficients.luck
    + finite(bonusEvasion);
}

function getLevelDifference(characterLevel, monsterLevel) {
  return Math.max(0, Math.floor(finite(monsterLevel) - finite(characterLevel)));
}

function calculateRequiredAccuracy({
  characterLevel,
  monsterLevel,
  monsterEvasion
}) {
  const difference = getLevelDifference(characterLevel, monsterLevel);
  return (55 + 2 * difference) * nonNegative(monsterEvasion) / 15;
}

function calculateHitChance({ accuracy, requiredAccuracy, minimumHitChance = 0.05 }) {
  const required = nonNegative(requiredAccuracy);
  if (required === 0) return 1;
  const floor = Math.max(0, Math.min(1, finite(minimumHitChance)));
  const ratio = Math.max(0, nonNegative(accuracy) / required);
  if (ratio >= 1) return 1;
  return Math.max(floor, Math.min(1, ratio ** 1.25));
}

function calculateMissChance(options) {
  return 1 - calculateHitChance(options);
}

function normalizeRange(range = {}) {
  const minimum = nonNegative(range.minimum);
  const maximum = nonNegative(range.maximum);
  return minimum <= maximum
    ? { minimum, maximum }
    : { minimum: maximum, maximum: minimum };
}

function calculatePhysicalDamageAfterDefense({
  attackRange,
  characterLevel,
  monsterLevel,
  physicalDefense,
  skillPercent = 100
}) {
  const range = normalizeRange(attackRange);
  const difference = getLevelDifference(characterLevel, monsterLevel);
  const levelFactor = Math.max(0, 1 - 0.01 * difference);
  const defense = nonNegative(physicalDefense);
  const skillMultiplier = nonNegative(skillPercent) / 100;
  return {
    minimum: Math.max(0, range.minimum * levelFactor - defense * 0.6) * skillMultiplier,
    maximum: Math.max(0, range.maximum * levelFactor - defense * 0.5) * skillMultiplier,
    levelDifference: difference
  };
}

function calculateMagicDamageAfterDefense({
  skillDamageRange,
  characterLevel,
  monsterLevel,
  magicDefense
}) {
  const range = normalizeRange(skillDamageRange);
  const difference = getLevelDifference(characterLevel, monsterLevel);
  const levelFactor = 1 + 0.01 * difference;
  const defense = nonNegative(magicDefense);
  return {
    minimum: Math.max(0, range.minimum - defense * 0.6 * levelFactor),
    maximum: Math.max(0, range.maximum - defense * 0.5 * levelFactor),
    levelDifference: difference
  };
}

module.exports = {
  WEAPON_CONSTANTS,
  WEAPON_LABELS,
  PHYSICAL_ARCHETYPES,
  ACCURACY_GROUPS,
  EVASION_GROUPS,
  normalizeMastery,
  normalizeStats,
  getWeaponConstant,
  calculatePhysicalAttackRange,
  calculateAttackEquivalentMainStat,
  calculateMagicDamageRange,
  calculateAccuracy,
  calculateEvasion,
  getLevelDifference,
  calculateRequiredAccuracy,
  calculateHitChance,
  calculateMissChance,
  calculatePhysicalDamageAfterDefense,
  calculateMagicDamageAfterDefense
};
