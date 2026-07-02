'use strict';

const { DEPARTMENTS, getJobName } = require('../jobs/advancementRules');
const {
  getStatPointsForLevel,
  getSkillPointsForLevel
} = require('../progression/levelMigration');
const {
  calculateReferenceResources,
  applyReferenceResources
} = require('../progression/resourceGrowth');
const { consumeInventoryItem, getItemQuantity } = require('./inventoryService');

const JOB_CHANGE_TICKET_ID = 'job_change_ticket';
const BASE_STAT_VALUE = 4;

function changeDepartment(character, departmentId) {
  const targetId = String(departmentId || '');
  const target = DEPARTMENTS[targetId];
  if (!target) throw new Error('변경할 보직을 선택해주세요.');
  const tier = Math.max(0, Math.min(4, Math.floor(Number(character.job?.advancementTier) || 0)));
  if (tier <= 0) throw new Error('1차 전직 이후부터 이직 쿠폰을 사용할 수 있습니다.');
  if (String(character.job?.departmentId) === targetId) {
    throw new Error('현재 소속과 다른 보직을 선택해주세요.');
  }
  if (getItemQuantity(character, JOB_CHANGE_TICKET_ID) <= 0) {
    throw new Error('이직 쿠폰이 부족합니다.');
  }

  const level = Math.max(1, Math.min(200, Math.floor(Number(character.progression?.level) || 1)));
  character.stats.grit = BASE_STAT_VALUE;
  character.stats.processingSpeed = BASE_STAT_VALUE;
  character.stats.workKnowledge = BASE_STAT_VALUE;
  character.stats.awareness = BASE_STAT_VALUE;
  character.progression.unspentStatPoints = getStatPointsForLevel(level);
  const skillPoints = getSkillPointsForLevel(level, tier);
  character.progression.unspentSkillPoints = skillPoints;
  character.progression.totalSkillPointsEarned = skillPoints;
  character.job.departmentId = targetId;
  character.job.advancementTier = tier;
  character.skills = {
    levels: {},
    activePreset: [],
    unlockedQuestSkills: [],
    activeBuffs: [],
    summon: null,
    comboCount: 0
  };

  const reference = calculateReferenceResources({
    level,
    departmentId: targetId,
    advancementTier: tier,
    archetype: target.archetype
  });
  applyReferenceResources(character, reference, { fullyRestore: true });
  consumeInventoryItem(character, JOB_CHANGE_TICKET_ID, 1);
  if (typeof character.markModified === 'function') {
    character.markModified('stats');
    character.markModified('job');
    character.markModified('skills');
    character.markModified('progression');
    character.markModified('resources');
  }
  return {
    departmentId: targetId,
    departmentName: target.name,
    advancementTier: tier,
    jobName: getJobName(targetId, tier),
    refundedStatPoints: character.progression.unspentStatPoints,
    refundedSkillPoints: skillPoints,
    remainingTickets: getItemQuantity(character, JOB_CHANGE_TICKET_ID)
  };
}

module.exports = {
  JOB_CHANGE_TICKET_ID,
  BASE_STAT_VALUE,
  changeDepartment
};
