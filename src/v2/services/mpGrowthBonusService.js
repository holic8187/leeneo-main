'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');
const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');
const {
  getSkillLevel,
  resolveSkillValues
} = require('../skills/skillService');
const { getInvestedStatPointCount } = require('./hpGrowthBonusService');

const FIRST_MAGE_ADVANCEMENT_LEVEL = 8;

function getMpGrowthDefinition(character = {}) {
  const departmentId = String(character.job?.departmentId || '');
  return Object.values(SKILL_DEFINITIONS).find((definition) => (
    definition.passive
      && definition.effect === 'mp-growth'
      && definition.departments.includes(departmentId)
  )) || null;
}

function calculateMpGrowthSkillBonus(character = {}) {
  const department = DEPARTMENTS[character.job?.departmentId];
  if (department?.archetype !== 'mage') return 0;
  const definition = getMpGrowthDefinition(character);
  if (!definition) return 0;
  const skillLevel = getSkillLevel(character, definition.id);
  if (skillLevel <= 0) return 0;
  const values = resolveSkillValues(definition, skillLevel);
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  const eligibleLevelUps = Math.max(0, level - FIRST_MAGE_ADVANCEMENT_LEVEL);
  return Math.max(0, Math.floor(
    eligibleLevelUps * (Number(values.levelUpMp) || 0)
      + getInvestedStatPointCount(character) * (Number(values.statPointMp) || 0)
  ));
}

function reconcileMpGrowthSkillBonus(character = {}, { resetAppliedBonus = false } = {}) {
  if (!character.resources || typeof character.resources !== 'object') character.resources = {};
  const previous = resetAppliedBonus
    ? 0
    : Math.max(0, Math.floor(Number(character.resources.mpGrowthSkillBonus) || 0));
  const desired = calculateMpGrowthSkillBonus(character);
  const delta = desired - previous;
  const previousMaxMp = Math.max(0, Number(character.resources.maxMp) || 0);
  const previousCurrentMp = Math.max(0, Number(character.resources.currentMp) || 0);
  const resourceBuffPercent = Math.max(
    0,
    Number(character.resources.maxResourceBuffPercentApplied) || 0
  );
  if (resourceBuffPercent > 0 && Number(character.resources.maxResourceBuffBaseMp) > 0) {
    character.resources.maxResourceBuffBaseMp = Math.max(
      0,
      Number(character.resources.maxResourceBuffBaseMp) + delta
    );
    character.resources.maxMp = Math.max(
      0,
      Math.round(
        Number(character.resources.maxResourceBuffBaseMp)
          * (1 + resourceBuffPercent / 100)
      )
    );
  } else {
    character.resources.maxMp = Math.max(0, previousMaxMp + delta);
  }
  const effectiveDelta = character.resources.maxMp - previousMaxMp;
  character.resources.currentMp = Math.max(
    0,
    Math.min(character.resources.maxMp, previousCurrentMp + effectiveDelta)
  );
  character.resources.mpGrowthSkillBonus = desired;
  if (typeof character.markModified === 'function') character.markModified('resources');
  return { previous, desired, delta, effectiveDelta };
}

module.exports = {
  FIRST_MAGE_ADVANCEMENT_LEVEL,
  getMpGrowthDefinition,
  calculateMpGrowthSkillBonus,
  reconcileMpGrowthSkillBonus
};
