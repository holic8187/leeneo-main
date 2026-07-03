'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SKILL_DEFINITIONS } = require('../../src/v2/skills/skillDefinitions');
const {
  calculateMpGrowthSkillBonus,
  reconcileMpGrowthSkillBonus
} = require('../../src/v2/services/mpGrowthBonusService');

function makeCharacter() {
  const definition = Object.values(SKILL_DEFINITIONS)
    .find((skill) => skill.name === '정신력 증가량 향상');
  return {
    progression: { level: 80 },
    job: { departmentId: 'development', advancementTier: 3 },
    stats: { grit: 4, processingSpeed: 4, workKnowledge: 100, awareness: 4 },
    skills: {
      levels: { [definition.id]: 10 },
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      summon: null,
      comboCount: 0
    },
    resources: {
      currentMp: 500,
      maxMp: 1000,
      mpGrowthSkillBonus: 0
    }
  };
}

test('learning MP growth late retroactively grants level-up and invested-stat bonuses', () => {
  const character = makeCharacter();
  const expected = (80 - 8) * 20 + (100 - 4) * 10;
  assert.equal(calculateMpGrowthSkillBonus(character), expected);
  const result = reconcileMpGrowthSkillBonus(character);
  assert.equal(result.delta, expected);
  assert.equal(character.resources.maxMp, 1000 + expected);
  assert.equal(character.resources.currentMp, 500 + expected);
  assert.equal(character.resources.mpGrowthSkillBonus, expected);
  assert.equal(reconcileMpGrowthSkillBonus(character).delta, 0);
});
