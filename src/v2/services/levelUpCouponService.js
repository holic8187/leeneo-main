'use strict';

const { MAX_LEVEL } = require('../constants/experienceTable');
const { DEPARTMENTS } = require('../jobs/advancementRules');
const { applyLevelGrowth } = require('../progression/resourceGrowth');
const { reconcileHpGrowthSkillBonus } = require('./hpGrowthBonusService');
const { reconcileMpGrowthSkillBonus } = require('./mpGrowthBonusService');

function applyLevelUpCoupon(character) {
  if (!character?.progression) throw new Error('캐릭터 성장 정보를 찾을 수 없습니다.');

  const previousLevel = Math.max(1, Math.floor(Number(character.progression.level) || 1));
  if (previousLevel >= MAX_LEVEL) {
    throw new Error('만렙에서는 레벨업 쿠폰을 사용할 수 없습니다.');
  }

  character.progression.level = previousLevel + 1;
  character.progression.exp = 0;
  character.progression.unspentStatPoints = Math.max(
    0,
    Number(character.progression.unspentStatPoints) || 0
  ) + 5;

  const earnedSkillPoints = character.progression.level <= 10 ? 1 : 3;
  character.progression.unspentSkillPoints = Math.max(
    0,
    Number(character.progression.unspentSkillPoints) || 0
  ) + earnedSkillPoints;
  character.progression.totalSkillPointsEarned = Math.max(
    0,
    Number(character.progression.totalSkillPointsEarned) || 0
  ) + earnedSkillPoints;

  const department = DEPARTMENTS[character.job?.departmentId];
  applyLevelGrowth(character, {
    previousLevel,
    archetype: department?.archetype || 'beginner',
    departmentId: character.job?.departmentId,
    advancementTier: character.job?.advancementTier
  });
  reconcileHpGrowthSkillBonus(character);
  reconcileMpGrowthSkillBonus(character);
  character.markModified?.('progression');
  character.markModified?.('resources');

  return {
    previousLevel,
    level: character.progression.level,
    earnedStatPoints: 5,
    earnedSkillPoints
  };
}

module.exports = {
  applyLevelUpCoupon
};
