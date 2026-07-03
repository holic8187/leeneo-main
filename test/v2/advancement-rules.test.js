'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ADVANCEMENT_LEVELS,
  DEPARTMENTS,
  getAdvancementBonusSkillPoints,
  getJobName,
  getNextAdvancementRequirement,
  getAvailableAdvancementQuest,
  getSkillAccessProfile,
  applyAdvancement
} = require('../../src/v2/jobs/advancementRules');
const { getSkillPointsForLevel } = require('../../src/v2/progression/levelMigration');

test('advancement levels and ten departments match the V2 design table', () => {
  assert.deepEqual(ADVANCEMENT_LEVELS, [10, 30, 70, 120]);
  assert.equal(Object.keys(DEPARTMENTS).length, 10);
  assert.equal(DEPARTMENTS.hr.jobs[3], '최고인사책임자');
  assert.equal(DEPARTMENTS.development.jobs[0], '주니어개발자');
});

test('skill points grant one before level ten, then three, plus one per advancement', () => {
  assert.equal(getSkillPointsForLevel(1, 0), 0);
  assert.equal(getSkillPointsForLevel(10, 0), 9);
  assert.equal(getSkillPointsForLevel(10, 1), 10);
  assert.equal(getSkillPointsForLevel(120, 4), 343);
  assert.equal(getAdvancementBonusSkillPoints(8), 4);
});

test('advancement quest appears only after the required level', () => {
  assert.equal(getAvailableAdvancementQuest({
    progression: { level: 9 },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  }), null);

  const firstQuest = getAvailableAdvancementQuest({
    progression: { level: 10 },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  });
  assert.equal(firstQuest.targetTier, 1);
  assert.equal(firstQuest.departmentSelectionRequired, true);
  assert.equal(firstQuest.bonusSkillPoints, 1);

  const thirdQuest = getAvailableAdvancementQuest({
    progression: { level: 70 },
    job: { departmentId: 'development', advancementTier: 2 }
  });
  assert.equal(thirdQuest.targetTier, 3);
  assert.equal(thirdQuest.nextJobName, '시니어개발자');
});

test('completed fourth advancement has no next requirement', () => {
  assert.equal(getNextAdvancementRequirement({ level: 200, advancementTier: 4 }), null);
  assert.equal(getJobName('accounting', 4), '재무총괄');
});

test('advancement selects a department once and grants one skill point', () => {
  const character = {
    progression: {
      level: 130,
      unspentSkillPoints: 387,
      totalSkillPointsEarned: 387
    },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  };
  const result = applyAdvancement(character, 'quality');
  assert.equal(result.jobName, '품질검사원');
  assert.equal(character.job.departmentId, 'quality');
  assert.equal(character.job.advancementTier, 1);
  assert.equal(character.progression.unspentSkillPoints, 388);
  assert.equal(getSkillAccessProfile(character).unlockedTier, 1);
});
