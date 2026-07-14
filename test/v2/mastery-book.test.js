'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MASTERY_BOOK_ITEMS } = require('../../src/v2/items/masteryBookCatalog');
const {
  validateMasteryBookUse,
  resolveMasteryBookUse
} = require('../../src/v2/services/masteryBookService');
const {
  ensureSkillState,
  getSkillInvestmentCap,
  getMasteryFailureCount
} = require('../../src/v2/skills/skillService');
const { SKILL_DEFINITIONS } = require('../../src/v2/skills/skillDefinitions');

function characterFixture() {
  return {
    job: { departmentId: 'hr', advancementTier: 4 },
    skills: {
      levels: { firm_will_hr: 5 },
      activePreset: [], autoPreset: [], unlockedQuestSkills: [], unlockProgress: {},
      unlockMigrationVersion: 0, activeBuffs: [], cooldowns: {}, summon: null, comboCount: 0
    },
    markModified() {}
  };
}

function masteryBook(skillId, stage) {
  return MASTERY_BOOK_ITEMS.find((item) => (
    item.masterySkillId === skillId && item.masteryStage === stage
  ));
}

test('mastery book 20 succeeds after level five and expands the cap', () => {
  const character = characterFixture();
  ensureSkillState(character);
  const validation = validateMasteryBookUse(character, masteryBook('firm_will_hr', 20));
  assert.equal(validation.successRate, 90);
  const result = resolveMasteryBookUse(character, validation, () => 0);
  assert.equal(result.success, true);
  assert.equal(
    getSkillInvestmentCap(character, SKILL_DEFINITIONS.firm_will_hr, 'hr'),
    20
  );
});

test('failed mastery books add one percentage point to the next attempt', () => {
  const character = characterFixture();
  const item = masteryBook('firm_will_hr', 20);
  const first = resolveMasteryBookUse(
    character,
    validateMasteryBookUse(character, item),
    () => 0.99
  );
  assert.equal(first.success, false);
  assert.equal(first.nextSuccessRate, 91);
  assert.equal(getMasteryFailureCount(character, 'firm_will_hr', 20, 'hr'), 1);
  assert.equal(validateMasteryBookUse(character, item).successRate, 91);
});

test('mastery book 30 requires both cap twenty and skill level fifteen', () => {
  const character = characterFixture();
  const item20 = masteryBook('firm_will_hr', 20);
  resolveMasteryBookUse(character, validateMasteryBookUse(character, item20), () => 0);
  const item30 = masteryBook('firm_will_hr', 30);
  assert.throws(() => validateMasteryBookUse(character, item30));
  character.skills.levels.firm_will_hr = 15;
  assert.equal(validateMasteryBookUse(character, item30).successRate, 70);
});
