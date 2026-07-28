'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MASTERY_BOOK_ITEMS } = require('../../src/v2/items/masteryBookCatalog');
const { MONSTER_CATALOG } = require('../../src/v2/world/monsterCatalog');
const {
  getHwangFieldBossDrops,
  getGammamNeoFieldBossDrops
} = require('../../src/v2/world/worldRuntime');
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

test('level 110+ monsters split normal books at 0.0015 percent and exclude boss-only stages', () => {
  const eligibleMonsters = MONSTER_CATALOG.filter((monster) => monster.level >= 110);
  assert.ok(eligibleMonsters.length > 0);
  const drops = eligibleMonsters.flatMap((monster) => monster.dropTable.masteryBooks || []);
  assert.ok(drops.length > 0);
  assert.ok(drops.every((drop) => drop.chance === 0.000015));
  const droppedIds = new Set(drops.map((drop) => drop.itemId));
  const piercing20 = MASTERY_BOOK_ITEMS.find((item) => (
    item.masteryOriginalSkillId === 'piercing' && item.masteryStage === 20
  ));
  const piercing30 = MASTERY_BOOK_ITEMS.find((item) => (
    item.masteryOriginalSkillId === 'piercing' && item.masteryStage === 30
  ));
  assert.equal(piercing20, undefined);
  assert.ok(piercing30);
  assert.equal(piercing30.bossOnly, false);
  assert.ok(droppedIds.has(piercing30.id));
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

test('Gammam Neo has the requested mastery-book chances', () => {
  const books = getGammamNeoFieldBossDrops()
    .filter((drop) => getItemDefinitionForTest(drop.itemId)?.itemType === 'mastery-book')
    .map((drop) => {
      const item = getItemDefinitionForTest(drop.itemId);
      return [item.masteryOriginalSkillId, item.masteryStage, drop.chance];
    });
  assert.deepEqual(books, [
    ['infinity', 20, 0.01],
    ['venom', 20, 0.01],
    ['stance', 20, 0.008],
    ['blast', 30, 0.005],
    ['bow_expert', 20, 0.005],
    ['storm', 30, 0.005],
    ['piercing', 30, 0.004],
    ['spirit_javelin', 30, 0.004],
    ['boomerang_step', 30, 0.004],
    ['fire_demon', 30, 0.003],
    ['crossbow_expert', 20, 0.003],
    ['brandish', 30, 0.003],
    ['angel_ray', 30, 0.01],
    ['ice_demon', 30, 0.01]
  ]);
});

<<<<<<< HEAD
test('support light is not tied to a mastery book', () => {
  const supportLight = SKILL_DEFINITIONS.extended_206bd2f4b1;
  assert.equal(supportLight.name, '지원의 빛');
  assert.equal(supportLight.tier, 3);
  assert.equal(MASTERY_BOOK_ITEMS.some((item) => (
    item.masterySkillId === supportLight.id || item.masterySkillIds.includes(supportLight.id)
  )), false);
});

test('angel ray mastery books unlock strategic support line', () => {
  const strategicLine = SKILL_DEFINITIONS.extended_7a0f825273;
  const angelRay30 = MASTERY_BOOK_ITEMS.find((item) => (
    item.masteryOriginalSkillId === 'angel_ray' && item.masteryStage === 30
  ));
  assert.equal(strategicLine.name, '전략 지원선');
  assert.equal(strategicLine.tier, 4);
  assert.equal(angelRay30.masterySkillId, strategicLine.id);
  assert.equal(angelRay30.bossOnly, true);
});

=======
>>>>>>> 29c984ed0e8f0fc859c2d706457eb4469d895117
function getItemDefinitionForTest(itemId) {
  return MASTERY_BOOK_ITEMS.find((item) => item.id === itemId);
}
