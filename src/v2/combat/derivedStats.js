'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');
const {
  WEAPON_CONSTANTS,
  PHYSICAL_ARCHETYPES,
  calculatePhysicalAttackRange,
  calculateAccuracy,
  calculateEvasion,
  normalizeStats
} = require('./combatFormulas');
const { getStandardPdd } = require('./incomingDamage');
const { DEFAULT_WEAPON_RANGES } = require('./weaponMotion');

const LOADOUT_SLOT_KEYS = Object.freeze([
  'weapon', 'shield', 'helmet', 'gloves', 'shoes', 'cape',
  'top', 'bottom', 'necklace', 'ring', 'earrings'
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

function buildEffectiveStats(stats = {}, loadout = {}, allStatsPercent = 0) {
  const multiplier = 1 + Math.max(0, finite(allStatsPercent)) / 100;
  const boostedBase = (value) => Math.floor(Math.max(0, finite(value)) * multiplier);
  return {
    grit: boostedBase(stats.grit ?? stats.strength)
      + sumLoadoutStat(loadout, 'grit', 'strength'),
    processingSpeed: boostedBase(stats.processingSpeed ?? stats.dexterity)
      + sumLoadoutStat(loadout, 'processingSpeed', 'dexterity'),
    workKnowledge: boostedBase(stats.workKnowledge ?? stats.intelligence)
      + sumLoadoutStat(loadout, 'workKnowledge', 'intelligence'),
    awareness: boostedBase(stats.awareness ?? stats.luck)
      + sumLoadoutStat(loadout, 'awareness', 'luck')
  };
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

function calculateBasePhysicalDefense(archetype, stats = {}) {
  const normalized = normalizeStats(stats);
  if (archetype === 'warrior') {
    return Math.max(4, Math.floor(
      (normalized.luck + normalized.dexterity) / 4
      + normalized.intelligence / 9
      + normalized.strength * 2 / 7
    ));
  }
  return Math.max(4, Math.floor(
    normalized.intelligence / 9
    + normalized.dexterity * 2 / 7
    + normalized.strength * 0.4
    + normalized.luck / 4
  ));
}

function buildDerivedStats({
  progression = {},
  stats = {},
  job = {},
  loadout = {},
  skillEffects = {}
} = {}) {
  const department = DEPARTMENTS[job.departmentId];
  const archetype = department?.archetype || 'beginner';
  const weapon = loadout.weapon || null;
  const weaponType = weapon?.weaponType || null;
  const effectiveStats = buildEffectiveStats(stats, loadout, skillEffects.allStatsPercent);
  const equipmentStatBonuses = {
    grit: sumLoadoutStat(loadout, 'grit', 'strength'),
    processingSpeed: sumLoadoutStat(loadout, 'processingSpeed', 'dexterity'),
    workKnowledge: sumLoadoutStat(loadout, 'workKnowledge', 'intelligence'),
    awareness: sumLoadoutStat(loadout, 'awareness', 'luck')
  };
  const activeBuffStatBonuses = Object.fromEntries(
    Object.keys(equipmentStatBonuses).map((key) => [
      key,
      Math.max(
        0,
        Number(effectiveStats[key])
          - Math.max(0, finite(stats[key]))
          - Number(equipmentStatBonuses[key] || 0)
      )
    ])
  );
  const totalAttack = sumLoadoutStat(loadout, 'attack', 'weaponAttack')
    + finite(skillEffects.attackIncrease);
  const mastery = Math.max(
    getItemStat(weapon, 'mastery'),
    finite(skillEffects.weaponMastery)
  );
  let attackRange;

  if (weaponType && WEAPON_CONSTANTS[weaponType] && PHYSICAL_ARCHETYPES[archetype]) {
    attackRange = calculatePhysicalAttackRange({
      archetype,
      weaponType,
      stats: effectiveStats,
      totalAttack,
      mastery
    });
  } else {
    const baseAttack = Math.max(4, finite(effectiveStats.grit));
    attackRange = { minimum: baseAttack, maximum: baseAttack };
  }

  const physicalAccuracy = calculateAccuracy({
    group: getAccuracyGroup(archetype),
    stats: effectiveStats,
    bonusAccuracy: sumLoadoutStat(loadout, 'accuracy') + finite(skillEffects.accuracyIncrease)
  });
  const magicAccuracy = Math.floor(Math.max(0, finite(effectiveStats.workKnowledge)) / 10)
    + Math.floor(Math.max(0, finite(effectiveStats.awareness)) / 10)
    + sumLoadoutStat(loadout, 'accuracy')
    + finite(skillEffects.accuracyIncrease)
    + 21;
  const accuracy = archetype === 'mage' ? magicAccuracy : physicalAccuracy;
  const evasion = 1 + calculateEvasion({
    group: getEvasionGroup(archetype),
    stats: effectiveStats,
    bonusEvasion: sumLoadoutStat(loadout, 'evasion') + finite(skillEffects.evasionIncrease)
  });
  const basePhysicalDefense = calculateBasePhysicalDefense(archetype, effectiveStats);
  const equipmentDefense = sumLoadoutStat(loadout, 'defense', 'physicalDefense');
  const shieldMultiplier = 1 + finite(skillEffects.shieldDefensePercent) / 100;
  const shieldDefense = getItemStat(loadout?.shield, 'defense', 'physicalDefense')
    * Math.max(0, shieldMultiplier - 1);
  const physicalDefense = roundStat(
    basePhysicalDefense
    + equipmentDefense
    + shieldDefense
    + finite(skillEffects.defenseIncrease)
  );
  const magicDefense = roundStat(
    Math.max(4, finite(effectiveStats.workKnowledge))
    + sumLoadoutStat(loadout, 'magicDefense')
    + finite(skillEffects.magicDefenseIncrease)
  );
  const level = Math.max(1, Math.floor(finite(progression.level) || 1));
  const magic = roundStat(
    Math.max(4, finite(effectiveStats.workKnowledge))
    + sumLoadoutStat(loadout, 'magic', 'magicAttack')
  );

  return {
    attackMinimum: roundStat(attackRange.minimum),
    attackMaximum: roundStat(attackRange.maximum),
    defense: physicalDefense,
    basePhysicalDefense,
    physicalDefense,
    magicDefense,
    standardPhysicalDefense: roundStat(getStandardPdd(archetype, level)),
    magic,
    accuracy: roundStat(accuracy),
    physicalAccuracy: roundStat(physicalAccuracy),
    magicAccuracy: roundStat(magicAccuracy),
    evasion: roundStat(evasion),
    movementSpeed: roundStat(
      100
      + sumLoadoutStat(loadout, 'movementSpeed')
      + finite(skillEffects.movementSpeedIncrease)
    ),
    criticalChance: Math.max(0, Math.min(100, finite(skillEffects.criticalChance))),
    criticalDamagePercent: Math.max(100, finite(skillEffects.criticalDamagePercent) || 200),
    attackRange: Math.max(
      0,
      finite(DEFAULT_WEAPON_RANGES[weaponType] || 100)
        + finite(skillEffects.attackRangeIncrease)
    ),
    attackSpeedStage: Math.max(1, Math.floor(1 + finite(skillEffects.attackSpeedStage))),
    attackSpeedMultiplier: Math.max(0.1, finite(weapon?.attackSpeedMultiplier) || 1),
    weaponConstant: Number(attackRange.weaponConstant) || null,
    weaponMastery: roundStat((Number(attackRange.mastery) || 0) * 100),
    weaponType,
    level,
    archetype,
    effectiveStats,
    equipmentStatBonuses,
    activeBuffStatBonuses,
    maxHpBonus: roundStat(sumLoadoutStat(loadout, 'maxHp')),
    maxMpBonus: roundStat(sumLoadoutStat(loadout, 'maxMp')),
    provisionalRange: true
  };
}

module.exports = {
  LOADOUT_SLOT_KEYS,
  buildDerivedStats,
  sumLoadoutStat,
  buildEffectiveStats,
  getAccuracyGroup,
  getEvasionGroup,
  calculateBasePhysicalDefense
};
