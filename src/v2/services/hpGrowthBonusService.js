'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');
const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');
const { getSkillLevel, resolveSkillValues } = require('../skills/skillService');

const HP_GROWTH_SKILL_ID = 'hp_growth_improvement';
const FIRST_WARRIOR_ADVANCEMENT_LEVEL = 10;
const BASE_STAT_VALUE = 4;

function getInvestedStatPointCount(character = {}) {
  return ['grit', 'processingSpeed', 'workKnowledge', 'awareness'].reduce(
    (total, stat) => total + Math.max(0, Math.floor(Number(character.stats?.[stat]) || 0) - BASE_STAT_VALUE),
    0
  );
}

function calculateHpGrowthSkillBonus(character = {}) {
  const department = DEPARTMENTS[character.job?.departmentId];
  if (department?.archetype !== 'warrior') return 0;
  const skillLevel = getSkillLevel(character, HP_GROWTH_SKILL_ID);
  if (skillLevel <= 0) return 0;
  const values = resolveSkillValues(SKILL_DEFINITIONS[HP_GROWTH_SKILL_ID], skillLevel);
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  const eligibleLevelUps = Math.max(0, level - FIRST_WARRIOR_ADVANCEMENT_LEVEL);
  const investedStatPoints = getInvestedStatPointCount(character);
  return Math.max(0, Math.floor(
    eligibleLevelUps * (Number(values.levelUpHp) || 0)
    + investedStatPoints * (Number(values.statPointHp) || 0)
  ));
}

function reconcileHpGrowthSkillBonus(character = {}, { resetAppliedBonus = false } = {}) {
  if (!character.resources || typeof character.resources !== 'object') character.resources = {};
  const previous = resetAppliedBonus
    ? 0
    : Math.max(0, Math.floor(Number(character.resources.hpGrowthSkillBonus) || 0));
  const desired = calculateHpGrowthSkillBonus(character);
  const delta = desired - previous;
  const previousMaxHp = Math.max(1, Number(character.resources.maxHp) || 1);
  const previousCurrentHp = Math.max(0, Number(character.resources.currentHp) || 0);
  const resourceBuffPercent = Math.max(
    0,
    Number(character.resources.maxResourceBuffPercentApplied) || 0
  );
  if (resourceBuffPercent > 0 && Number(character.resources.maxResourceBuffBaseHp) > 0) {
    character.resources.maxResourceBuffBaseHp = Math.max(
      1,
      Number(character.resources.maxResourceBuffBaseHp) + delta
    );
    character.resources.maxHp = Math.max(
      1,
      Math.round(
        Number(character.resources.maxResourceBuffBaseHp)
          * (1 + resourceBuffPercent / 100)
      )
    );
  } else {
    character.resources.maxHp = Math.max(1, previousMaxHp + delta);
  }
  const effectiveDelta = character.resources.maxHp - previousMaxHp;
  character.resources.currentHp = Math.max(
    0,
    Math.min(character.resources.maxHp, previousCurrentHp + effectiveDelta)
  );
  character.resources.hpGrowthSkillBonus = desired;
  if (typeof character.markModified === 'function') character.markModified('resources');
  return {
    previous,
    desired,
    delta,
    effectiveDelta,
    eligibleLevelUps: Math.max(
      0,
      Math.floor(Number(character.progression?.level) || 1) - FIRST_WARRIOR_ADVANCEMENT_LEVEL
    ),
    investedStatPoints: getInvestedStatPointCount(character)
  };
}

module.exports = {
  HP_GROWTH_SKILL_ID,
  FIRST_WARRIOR_ADVANCEMENT_LEVEL,
  getInvestedStatPointCount,
  calculateHpGrowthSkillBonus,
  reconcileHpGrowthSkillBonus
};
