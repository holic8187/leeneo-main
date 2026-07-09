'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateHpGrowthSkillBonus,
  reconcileHpGrowthSkillBonus
} = require('../../src/v2/services/hpGrowthBonusService');

function makeCharacter() {
  return {
    progression: { level: 132 },
    job: { departmentId: 'hr', advancementTier: 4 },
    stats: { grit: 100, processingSpeed: 4, workKnowledge: 4, awareness: 4 },
    skills: {
      levels: { hp_growth_improvement: 10 },
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      summon: null,
      comboCount: 0
    },
    resources: {
      currentHp: 500,
      maxHp: 1000,
      hpGrowthSkillBonus: 0
    }
  };
}

test('learning HP growth late retroactively grants level-up bonuses only', () => {
  const character = makeCharacter();
  const expected = (132 - 10) * 40;
  assert.equal(calculateHpGrowthSkillBonus(character), expected);
  const result = reconcileHpGrowthSkillBonus(character);
  assert.equal(result.delta, expected);
  assert.equal(character.resources.maxHp, 1000 + expected);
  assert.equal(character.resources.currentHp, 500 + expected);
  assert.equal(character.resources.hpGrowthSkillBonus, expected);
});

test('HP growth reconciliation is idempotent and only adds later changes', () => {
  const character = makeCharacter();
  reconcileHpGrowthSkillBonus(character);
  const maxAfterFirst = character.resources.maxHp;
  assert.equal(reconcileHpGrowthSkillBonus(character).delta, 0);
  assert.equal(character.resources.maxHp, maxAfterFirst);

  character.stats.grit += 5;
  assert.equal(reconcileHpGrowthSkillBonus(character).delta, 0);
  character.progression.level += 1;
  assert.equal(reconcileHpGrowthSkillBonus(character).delta, 40);
});

test('non-warrior jobs never receive the warrior HP growth bonus', () => {
  const character = makeCharacter();
  character.job.departmentId = 'accounting';
  assert.equal(calculateHpGrowthSkillBonus(character), 0);
});
