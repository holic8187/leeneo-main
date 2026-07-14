'use strict';

const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');
const { getMasteryBookRule } = require('../skills/masteryBookConfig');
const {
  getSkillLevel,
  getSkillInvestmentCap,
  getMasteryFailureCount,
  setMasteryFailureCount,
  unlockSkillCap
} = require('../skills/skillService');

function validateMasteryBookUse(character, item) {
  if (!item || item.itemType !== 'mastery-book') {
    throw new Error('사용할 수 있는 마스터리북이 아닙니다.');
  }
  const departmentId = String(character.job?.departmentId || '');
  const skillId = String(item.masterySkillId || '');
  const stage = Math.floor(Number(item.masteryStage) || 0);
  const definition = SKILL_DEFINITIONS[skillId];
  const rule = getMasteryBookRule(skillId, departmentId);
  if (!definition || !rule || !rule.stages.includes(stage)) {
    throw new Error('현재 부서에서는 이 마스터리북을 사용할 수 없습니다.');
  }
  const cap = getSkillInvestmentCap(character, definition, departmentId);
  if (cap >= stage) throw new Error(`이미 ${stage}레벨 상한이 해금되어 있습니다.`);
  const requiredCap = stage <= 20 ? 10 : 20;
  if (cap < requiredCap) {
    throw new Error(`먼저 ${requiredCap}레벨 상한을 해금해야 합니다.`);
  }
  const requiredSkillLevel = stage <= 20 ? 5 : 15;
  const skillLevel = getSkillLevel(character, skillId);
  if (skillLevel < requiredSkillLevel) {
    throw new Error(`${definition.name} ${requiredSkillLevel}레벨부터 사용할 수 있습니다.`);
  }
  const failures = getMasteryFailureCount(character, skillId, stage, departmentId);
  const baseSuccessRate = Math.max(0, Number(item.baseSuccessRate) || (stage <= 20 ? 90 : 70));
  return {
    departmentId,
    skillId,
    skillName: definition.name,
    stage,
    failures,
    successRate: Math.min(100, baseSuccessRate + failures)
  };
}

function resolveMasteryBookUse(character, validation, random = Math.random) {
  const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * 100;
  const success = roll < validation.successRate;
  if (success) {
    unlockSkillCap(
      character,
      validation.skillId,
      validation.stage,
      validation.departmentId
    );
    setMasteryFailureCount(
      character,
      validation.skillId,
      validation.stage,
      0,
      validation.departmentId
    );
    return {
      ...validation,
      success: true,
      nextSuccessRate: validation.successRate,
      message: `마스터리북의 지식이 스킬에 완전히 전해졌습니다. 이제 ${validation.skillName}을(를) 최대 ${validation.stage}레벨까지 올릴 수 있습니다.`
    };
  }
  const nextFailures = setMasteryFailureCount(
    character,
    validation.skillId,
    validation.stage,
    validation.failures + 1,
    validation.departmentId
  );
  const nextSuccessRate = Math.min(100, validation.successRate + 1);
  return {
    ...validation,
    success: false,
    failures: nextFailures,
    nextSuccessRate,
    message: `마스터리북의 지식이 흩어졌습니다. 다음 성공 확률이 ${nextSuccessRate}%로 상승했습니다.`
  };
}

module.exports = {
  validateMasteryBookUse,
  resolveMasteryBookUse
};
