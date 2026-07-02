'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SKILL_DEFINITIONS } = require('../../src/v2/skills/skillDefinitions');
const {
  ensureSkillState,
  resolveSkillValues,
  getInvestmentBlockReason,
  investSkill,
  setActivePreset,
  getActiveSkillEffects,
  buildSkillTree
} = require('../../src/v2/skills/skillService');

function makeCharacter(overrides = {}) {
  return {
    job: { departmentId: 'hr', advancementTier: 4 },
    progression: { unspentSkillPoints: 500 },
    skills: {
      levels: {},
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      summon: null,
      comboCount: 0
    },
    ...overrides
  };
}

test('quoted skill values interpolate from level one through master level', () => {
  const definition = SKILL_DEFINITIONS.power_strike;
  assert.equal(resolveSkillValues(definition, 1).damagePercent, 114);
  assert.equal(resolveSkillValues(definition, definition.maxLevel).damagePercent, 260);
  assert.ok(resolveSkillValues(definition, 10).damagePercent > 114);
});

test('skill tree descriptions explain the role before listing current coefficients', () => {
  const character = makeCharacter();
  character.skills.levels.power_strike = 1;
  const skill = buildSkillTree(character).skills.find((entry) => entry.id === 'power_strike');
  assert.match(skill.description, /단일 적/);
  assert.match(skill.description, /현재 효과/);
});

test('prerequisites and previous-tier SP gates are enforced', () => {
  const character = makeCharacter();
  ensureSkillState(character);
  assert.match(getInvestmentBlockReason(character, SKILL_DEFINITIONS.hp_growth_improvement), /회복력/);
  character.skills.levels.recovery_improvement = 5;
  assert.equal(getInvestmentBlockReason(character, SKILL_DEFINITIONS.hp_growth_improvement), '');

  character.skills.levels = {
    recovery_improvement: 16,
    hp_growth_improvement: 10,
    endure: 8,
    iron_body: 20,
    power_strike: 6
  };
  assert.match(getInvestmentBlockReason(character, SKILL_DEFINITIONS.sword_mastery), /61 SP/);
  character.skills.levels.power_strike = 7;
  assert.equal(getInvestmentBlockReason(character, SKILL_DEFINITIONS.sword_mastery), '');
});

test('passive skills cannot enter the ten-slot active preset', () => {
  const character = makeCharacter();
  character.skills.levels.power_strike = 1;
  character.skills.levels.recovery_improvement = 1;
  assert.deepEqual(setActivePreset(character, ['power_strike']), ['power_strike']);
  assert.throws(() => setActivePreset(character, ['recovery_improvement']), /액티브/);
});

test('HR and quality trees expose four tiers and spend real skill points', () => {
  const character = makeCharacter({
    job: { departmentId: 'quality', advancementTier: 4 },
    progression: { unspentSkillPoints: 10 }
  });
  const result = investSkill(character, 'recovery_improvement', 3);
  assert.equal(result.level, 3);
  assert.equal(character.progression.unspentSkillPoints, 7);
  const tree = buildSkillTree(character);
  assert.deepEqual([...new Set(tree.skills.map((skill) => skill.tier))], [1, 2, 3, 4]);
  assert.ok(tree.skills.some((skill) => skill.name === '작은 동반자'));
});

test('combat passives and active combo buffs are exposed to the field runtime', () => {
  const character = makeCharacter();
  character.loadout = { weapon: { weaponType: 'oneHandedSword' } };
  character.skills.levels = {
    sword_mastery: 20,
    double_strike_hr: 30,
    sturdy_body_hr: 30
  };
  character.skills.activeBuffs = [{
    skillId: 'combo_attack',
    effects: {
      comboEnabled: 1,
      comboMaximum: 5,
      comboDamagePerCount: 20
    },
    expiresAt: new Date(Date.now() + 60_000)
  }];
  const effects = getActiveSkillEffects(character);
  assert.equal(effects.weaponMastery, 60);
  assert.equal(effects.doubleStrikeChance, 60);
  assert.equal(effects.doubleStrikeDamagePercent, 250);
  assert.equal(effects.damageReductionPercent, 15);
  assert.equal(effects.comboEnabled, 1);
  assert.equal(effects.comboDamagePerCount, 20);
});
