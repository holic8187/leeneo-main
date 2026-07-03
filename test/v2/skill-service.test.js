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
const {
  reconcileMaxResourceBuff
} = require('../../src/v2/services/maxResourceBuffService');

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

test('quality inspection raises max HP and MP once and restores them after expiry', () => {
  const character = makeCharacter({
    resources: {
      currentHp: 700,
      maxHp: 1000,
      currentMp: 300,
      maxMp: 500
    }
  });
  character.skills.levels.quality_inspection = 30;
  character.skills.activeBuffs.push({
    skillId: 'quality_inspection',
    effects: { maxResourcePercent: 60 },
    expiresAt: new Date(Date.now() + 155_000)
  });

  const applied = reconcileMaxResourceBuff(character);
  assert.equal(applied.percent, 60);
  assert.equal(character.resources.maxHp, 1600);
  assert.equal(character.resources.maxMp, 800);

  reconcileMaxResourceBuff(character);
  assert.equal(character.resources.maxHp, 1600);
  assert.equal(character.resources.maxMp, 800);

  character.skills.activeBuffs[0].expiresAt = new Date(Date.now() - 1);
  const restored = reconcileMaxResourceBuff(character);
  assert.equal(restored.percent, 0);
  assert.equal(character.resources.maxHp, 1000);
  assert.equal(character.resources.maxMp, 500);
});

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

test('field operations exposes its mastery, elemental, and finishing skills', () => {
  const character = makeCharacter({
    job: { departmentId: 'field_operations', advancementTier: 4 }
  });
  const tree = buildSkillTree(character);
  const ids = new Set(tree.skills.map((skill) => skill.id));
  for (const skillId of [
    'mace_mastery', 'war_cry', 'element_explosion', 'element_fire',
    'element_ice', 'element_lightning', 'element_holy', 'wall_break',
    'element_enhancement_2', 'gombang'
  ]) {
    assert.equal(ids.has(skillId), true, `${skillId} should be in field operations tree`);
  }
});

test('field elemental passives increase elemental and explosion damage', () => {
  const character = makeCharacter({
    job: { departmentId: 'field_operations', advancementTier: 4 },
    loadout: { weapon: { weaponType: 'oneHandedBlunt' } }
  });
  character.skills.levels = {
    mace_mastery: 20,
    element_enhancement: 20,
    element_enhancement_2: 10
  };
  const effects = getActiveSkillEffects(character);
  assert.equal(effects.weaponMastery, 70);
  assert.equal(effects.elementDamageIncreasePercent, 10);
  assert.equal(effects.elementExplosionDamagePercent, 350);
  assert.equal(effects.elementPreserveChance, 100);
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

test('active buffs expose duration and tooltip data for the combat buff tray', () => {
  const character = makeCharacter();
  character.skills.levels.iron_body = 1;
  character.skills.activeBuffs = [{
    skillId: 'iron_body',
    name: '강철몸',
    effects: { defenseIncrease: 3 },
    createdAt: new Date(Date.now() - 1_000),
    expiresAt: new Date(Date.now() + 10_000)
  }];
  const tree = buildSkillTree(character);
  assert.equal(tree.activeBuffs.length, 1);
  assert.equal(tree.activeBuffs[0].name, '강철몸');
  assert.match(tree.activeBuffs[0].description, /방어력/);
  assert.ok(tree.activeBuffs[0].durationMs >= 10_000);
});
