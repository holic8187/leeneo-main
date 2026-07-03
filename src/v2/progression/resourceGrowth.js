'use strict';

const RESOURCE_GROWTH_VERSION = 2;
const BASE_STATS = Object.freeze({
  grit: 4,
  processingSpeed: 4,
  workKnowledge: 4,
  awareness: 4
});

const WARRIOR_FIRST_ADVANCEMENT_RESOURCES = Object.freeze({ maxHp: 400, maxMp: 104 });

const SECOND_ADVANCEMENT_BONUSES = Object.freeze({
  hr: Object.freeze({ maxHp: 330, maxMp: 0 }),
  field_operations: Object.freeze({ maxHp: 130, maxMp: 120 }),
  quality: Object.freeze({ maxHp: 130, maxMp: 0 }),
  accounting: Object.freeze({ maxHp: 320, maxMp: 175 }),
  marketing: Object.freeze({ maxHp: 320, maxMp: 175 }),
  sales: Object.freeze({ maxHp: 320, maxMp: 175 }),
  facilities: Object.freeze({ maxHp: 320, maxMp: 175 }),
  // The reference confirms an additional MP grant but not its exact range.
  // Keep this deterministic average isolated so it can be replaced later.
  management_support: Object.freeze({ maxHp: 0, maxMp: 175, provisional: true }),
  development: Object.freeze({ maxHp: 0, maxMp: 175, provisional: true }),
  research: Object.freeze({ maxHp: 0, maxMp: 175, provisional: true })
});

function normalizeLevel(value) {
  return Math.max(1, Math.min(200, Math.floor(Number(value) || 1)));
}

function getBeginnerResources(level) {
  const safeLevel = normalizeLevel(level);
  return {
    maxHp: 50 + (safeLevel - 1) * 14,
    maxMp: 5 + (safeLevel - 1) * 11,
    provisional: false
  };
}

function getWarriorResources(level) {
  const safeLevel = normalizeLevel(level);
  if (safeLevel < 10) return getBeginnerResources(safeLevel);
  return {
    // HP growth improvement is reconciled separately so late learners receive
    // the same retroactive benefit without embedding the passive twice.
    maxHp: WARRIOR_FIRST_ADVANCEMENT_RESOURCES.maxHp + (safeLevel - 10) * 26,
    maxMp: WARRIOR_FIRST_ADVANCEMENT_RESOURCES.maxMp + (safeLevel - 10) * 5,
    provisional: false
  };
}

function getArcherOrThiefResources(level) {
  const safeLevel = normalizeLevel(level);
  if (safeLevel < 10) return getBeginnerResources(safeLevel);
  return {
    maxHp: 300 + (safeLevel - 10) * 22,
    maxMp: 145 + (safeLevel - 10) * 15,
    provisional: false
  };
}

function getMageResources(level) {
  const safeLevel = normalizeLevel(level);
  if (safeLevel < 8) return getBeginnerResources(safeLevel);
  return {
    maxHp: 148 + (safeLevel - 8) * 12,
    maxMp: 212 + (safeLevel - 8) * 23,
    provisional: true
  };
}

function getArchetypeResources(archetype, level) {
  if (archetype === 'warrior') return getWarriorResources(level);
  if (archetype === 'archer' || archetype === 'thief') {
    return getArcherOrThiefResources(level);
  }
  if (archetype === 'mage') return getMageResources(level);
  return getBeginnerResources(level);
}

function calculateReferenceResources({
  level,
  departmentId = 'unassigned',
  advancementTier = 0,
  archetype = 'beginner'
} = {}) {
  const safeLevel = normalizeLevel(level);
  const tier = Math.max(0, Math.min(4, Math.floor(Number(advancementTier) || 0)));
  const resolvedArchetype = tier > 0 ? archetype : 'beginner';
  const base = getArchetypeResources(resolvedArchetype, safeLevel);
  const secondBonus = tier >= 2
    ? (SECOND_ADVANCEMENT_BONUSES[departmentId] || { maxHp: 0, maxMp: 0 })
    : { maxHp: 0, maxMp: 0 };
  return {
    maxHp: Math.max(1, Math.floor(base.maxHp + secondBonus.maxHp)),
    maxMp: Math.max(0, Math.floor(base.maxMp + secondBonus.maxMp)),
    provisional: Boolean(base.provisional || secondBonus.provisional),
    growthVersion: RESOURCE_GROWTH_VERSION
  };
}

function applyReferenceResources(character, reference, { fullyRestore = false } = {}) {
  const previousMaxHp = Math.max(1, Number(character.resources?.maxHp) || reference.maxHp);
  const previousMaxMp = Math.max(0, Number(character.resources?.maxMp) || reference.maxMp);
  const currentHp = Math.max(0, Number(character.resources?.currentHp) || 0);
  const currentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
  const hpRatio = currentHp / previousMaxHp;
  const mpRatio = previousMaxMp > 0 ? currentMp / previousMaxMp : 1;
  const resourceBuffPercent = Math.max(
    0,
    Number(character.resources?.maxResourceBuffPercentApplied) || 0
  );
  const resourceMultiplier = 1 + resourceBuffPercent / 100;
  const effectiveMaxHp = Math.max(1, Math.round(reference.maxHp * resourceMultiplier));
  const effectiveMaxMp = Math.max(0, Math.round(reference.maxMp * resourceMultiplier));

  character.resources.maxHp = effectiveMaxHp;
  character.resources.maxMp = effectiveMaxMp;
  character.resources.currentHp = fullyRestore
    ? effectiveMaxHp
    : Math.max(0, Math.min(effectiveMaxHp, Math.round(effectiveMaxHp * hpRatio)));
  character.resources.currentMp = fullyRestore
    ? effectiveMaxMp
    : Math.max(0, Math.min(effectiveMaxMp, Math.round(effectiveMaxMp * mpRatio)));
  character.resources.maxResourceBuffBaseHp = resourceBuffPercent ? reference.maxHp : 0;
  character.resources.maxResourceBuffBaseMp = resourceBuffPercent ? reference.maxMp : 0;
  character.resources.growthVersion = RESOURCE_GROWTH_VERSION;
  character.resources.provisional = Boolean(reference.provisional);
  return reference;
}

function applyLevelGrowth(character, {
  previousLevel,
  archetype,
  departmentId,
  advancementTier
}) {
  const before = calculateReferenceResources({
    level: previousLevel,
    archetype,
    departmentId,
    advancementTier
  });
  const after = calculateReferenceResources({
    level: character.progression?.level,
    archetype,
    departmentId,
    advancementTier
  });
  const hpGain = Math.max(0, after.maxHp - before.maxHp);
  const mpGain = Math.max(0, after.maxMp - before.maxMp);
  const previousMaxHp = Math.max(1, Number(character.resources?.maxHp) || before.maxHp);
  const previousMaxMp = Math.max(0, Number(character.resources?.maxMp) || before.maxMp);
  const resourceBuffPercent = Math.max(
    0,
    Number(character.resources?.maxResourceBuffPercentApplied) || 0
  );
  if (resourceBuffPercent > 0) {
    const multiplier = 1 + resourceBuffPercent / 100;
    character.resources.maxResourceBuffBaseHp = Math.max(
      1,
      Number(character.resources?.maxResourceBuffBaseHp) || Math.round(previousMaxHp / multiplier)
    ) + hpGain;
    character.resources.maxResourceBuffBaseMp = Math.max(
      0,
      Number(character.resources?.maxResourceBuffBaseMp) || Math.round(previousMaxMp / multiplier)
    ) + mpGain;
    character.resources.maxHp = Math.max(
      1,
      Math.round(character.resources.maxResourceBuffBaseHp * multiplier)
    );
    character.resources.maxMp = Math.max(
      0,
      Math.round(character.resources.maxResourceBuffBaseMp * multiplier)
    );
  } else {
    character.resources.maxHp = previousMaxHp + hpGain;
    character.resources.maxMp = previousMaxMp + mpGain;
  }
  const effectiveHpGain = character.resources.maxHp - previousMaxHp;
  const effectiveMpGain = character.resources.maxMp - previousMaxMp;
  character.resources.currentHp = Math.min(
    character.resources.maxHp,
    Math.max(0, Number(character.resources?.currentHp) || 0) + effectiveHpGain
  );
  character.resources.currentMp = Math.min(
    character.resources.maxMp,
    Math.max(0, Number(character.resources?.currentMp) || 0) + effectiveMpGain
  );
  character.resources.growthVersion = RESOURCE_GROWTH_VERSION;
  return { hpGain, mpGain };
}

module.exports = {
  RESOURCE_GROWTH_VERSION,
  BASE_STATS,
  WARRIOR_FIRST_ADVANCEMENT_RESOURCES,
  SECOND_ADVANCEMENT_BONUSES,
  calculateReferenceResources,
  applyReferenceResources,
  applyLevelGrowth
};
