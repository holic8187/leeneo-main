'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MASTERY_BOOK_ITEMS } = require('../../src/v2/items/masteryBookCatalog');
const { MONSTER_CATALOG } = require('../../src/v2/world/monsterCatalog');
const { getHwangFieldBossDrops } = require('../../src/v2/world/worldRuntime');
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

test('one common original-skill book unlocks the matching renamed department skill', () => {
  const character = characterFixture();
  character.job.departmentId = 'quality';
  character.skills.levels = { firm_will_quality: 5 };
  const commonBook = MASTERY_BOOK_ITEMS.find((item) => (
    item.dropEligible
    && item.masteryOriginalSkillId === 'stance'
    && item.masteryStage === 20
  ));
  const validation = validateMasteryBookUse(character, commonBook);
  assert.equal(validation.skillId, 'firm_will_quality');
  resolveMasteryBookUse(character, validation, () => 0);
  assert.equal(
    getSkillInvestmentCap(character, SKILL_DEFINITIONS.firm_will_quality, 'quality'),
    20
  );
});

test('level 110+ monsters split normal books at 0.002 percent and exclude boss-only stages', () => {
  const eligibleMonsters = MONSTER_CATALOG.filter((monster) => monster.level >= 110);
  assert.ok(eligibleMonsters.length > 0);
  const drops = eligibleMonsters.flatMap((monster) => monster.dropTable.masteryBooks || []);
  assert.ok(drops.length > 0);
  assert.ok(drops.every((drop) => drop.chance === 0.00002));
  const droppedIds = new Set(drops.map((drop) => drop.itemId));
  assert.ok(MASTERY_BOOK_ITEMS
    .filter((item) => item.dropEligible && !item.bossOnly)
    .every((item) => droppedIds.has(item.id)));
  assert.ok(MASTERY_BOOK_ITEMS
    .filter((item) => item.dropEligible && item.bossOnly)
    .every((item) => !droppedIds.has(item.id)));
});

test('Hwang manager has the four requested boss-only mastery-book chances', () => {
  const books = getHwangFieldBossDrops()
    .filter((drop) => getItemDefinitionForTest(drop.itemId)?.itemType === 'mastery-book')
    .map((drop) => {
      const item = getItemDefinitionForTest(drop.itemId);
      return [item.masteryOriginalSkillId, item.masteryStage, drop.chance];
    });
  assert.deepEqual(books, [
    ['blast', 30, 0.03],
    ['dragon_pulse', 30, 0.03],
    ['blizzard', 30, 0.03],
    ['maple_warrior', 20, 0.01]
  ]);
});

function getItemDefinitionForTest(itemId) {
  return MASTERY_BOOK_ITEMS.find((item) => item.id === itemId);
}
