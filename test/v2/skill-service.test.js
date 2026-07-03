'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SKILL_DEFINITIONS } = require('../../src/v2/skills/skillDefinitions');
const {
  ensureSkillState,
  resolveSkillValues,
  getEarnedSkillPointsForTier,
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
    progression: { level: 120, unspentSkillPoints: 500 },
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

function findSkillByName(name) {
  return Object.values(SKILL_DEFINITIONS).find((definition) => definition.name === name);
}

test('generated support skills retain fixed durations and specialized effects', () => {
  const holySymbol = findSkillByName('성과 지원');
  const focus = findSkillByName('업무 집중');
  const consumerInsight = findSkillByName('소비자 인사이트');
  const workSupport = findSkillByName('업무 지원');
  const welfareSupport = findSkillByName('복지 지원');

  assert.equal(resolveSkillValues(holySymbol, 30).durationSeconds, 120);
  assert.equal(resolveSkillValues(holySymbol, 30).experienceBonusPercent, 50);
  assert.equal(resolveSkillValues(focus, 20).durationSeconds, 300);
  assert.equal(resolveSkillValues(consumerInsight, 30).durationSeconds, 300);
  assert.equal(resolveSkillValues(consumerInsight, 30).criticalChance, 15);
  assert.equal(resolveSkillValues(consumerInsight, 30).criticalDamagePercent, 40);
  assert.equal(resolveSkillValues(workSupport, 20).durationSeconds, 200);
  assert.equal(resolveSkillValues(workSupport, 20).magicDefenseIncrease, 20);
  assert.equal(welfareSupport.effect, 'heal');
  assert.equal(resolveSkillValues(welfareSupport, 30).healPercent, 300);
});

test('management support passives calculate periodic MP recovery and MP absorption', () => {
  const periodic = findSkillByName('정신력 회복 향상');
  const absorption = findSkillByName('업무 동력 회수');
  const character = makeCharacter({
    job: { departmentId: 'management_support', advancementTier: 2 },
    progression: { level: 120, unspentSkillPoints: 500 },
    skills: {
      levels: {
        [periodic.id]: 16,
        [absorption.id]: 20
      },
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      cooldowns: {},
      summon: null,
      comboCount: 0
    }
  });
  const effects = getActiveSkillEffects(character);
  assert.equal(effects.periodicMpRestore, 195);
  assert.equal(effects.periodicRestoreIntervalSeconds, 10);
  assert.equal(effects.mpAbsorbChance, 30);
  assert.equal(effects.mpAbsorbPercent, 40);
});

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

test('beginner skills use exactly nine points from levels two through ten', () => {
  const character = makeCharacter({
    job: { departmentId: 'unassigned', advancementTier: 0 },
    progression: { level: 10, unspentSkillPoints: 9 },
    skills: {
      levels: {},
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      cooldowns: {},
      summon: null,
      comboCount: 0
    }
  });
  assert.equal(getEarnedSkillPointsForTier(character, 0), 9);
  assert.equal(resolveSkillValues(SKILL_DEFINITIONS.field_training, 1).fixedDamage, 10);
  assert.equal(resolveSkillValues(SKILL_DEFINITIONS.field_training, 5).fixedDamage, 30);
  assert.equal(resolveSkillValues(SKILL_DEFINITIONS.outstanding_recovery, 5).heal, 150);
  investSkill(character, 'field_training', 5);
  investSkill(character, 'outstanding_recovery', 4);
  assert.equal(character.progression.unspentSkillPoints, 0);
  assert.match(
    getInvestmentBlockReason(character, SKILL_DEFINITIONS.outstanding_recovery),
    /0차 스킬 포인트/
  );
});

test('first advancement point belongs to tier one and level eleven grants three more', () => {
  const levelTen = makeCharacter({
    job: { departmentId: 'hr', advancementTier: 1 },
    progression: { level: 10, unspentSkillPoints: 1 }
  });
  assert.equal(getEarnedSkillPointsForTier(levelTen, 0), 9);
  assert.equal(getEarnedSkillPointsForTier(levelTen, 1), 1);
  const levelEleven = makeCharacter({
    job: { departmentId: 'hr', advancementTier: 1 },
    progression: { level: 11, unspentSkillPoints: 4 }
  });
  assert.equal(getEarnedSkillPointsForTier(levelEleven, 1), 4);
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

test('HR and quality trees expose beginner plus four advancement tiers', () => {
  const character = makeCharacter({
    job: { departmentId: 'quality', advancementTier: 4 },
    progression: { level: 120, unspentSkillPoints: 10 }
  });
  const result = investSkill(character, 'recovery_improvement', 3);
  assert.equal(result.level, 3);
  assert.equal(character.progression.unspentSkillPoints, 7);
  const tree = buildSkillTree(character);
  assert.deepEqual([...new Set(tree.skills.map((skill) => skill.tier))], [0, 1, 2, 3, 4]);
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

test('shoulder charge uses each department booster prerequisite', () => {
  const tierOneLevels = {
    recovery_improvement: 16,
    hp_growth_improvement: 10,
    endure: 8,
    iron_body: 20,
    power_strike: 7
  };
  const fieldCharacter = makeCharacter({
    job: { departmentId: 'field_operations', advancementTier: 2 }
  });
  fieldCharacter.skills.levels = {
    ...tierOneLevels,
    rage: 3,
    booster_field: 2
  };
  assert.match(
    getInvestmentBlockReason(fieldCharacter, SKILL_DEFINITIONS.shoulder_charge),
    /부스터 3레벨/
  );
  fieldCharacter.skills.levels.booster_field = 3;
  assert.equal(getInvestmentBlockReason(fieldCharacter, SKILL_DEFINITIONS.shoulder_charge), '');

  const hrCharacter = makeCharacter({
    job: { departmentId: 'hr', advancementTier: 2 }
  });
  hrCharacter.skills.levels = {
    ...tierOneLevels,
    booster_hr: 3,
    rage: 2
  };
  assert.match(
    getInvestmentBlockReason(hrCharacter, SKILL_DEFINITIONS.shoulder_charge),
    /분노 3레벨/
  );
  hrCharacter.skills.levels.rage = 3;
  assert.equal(getInvestmentBlockReason(hrCharacter, SKILL_DEFINITIONS.shoulder_charge), '');
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

test('the reviewed draft exposes complete four-tier trees for every ranged and magic department', () => {
  for (const departmentId of [
    'accounting',
    'marketing',
    'sales',
    'facilities',
    'development',
    'research',
    'management_support'
  ]) {
    const character = makeCharacter({
      job: { departmentId, advancementTier: 4 }
    });
    const tree = buildSkillTree(character);
    assert.ok(tree.skills.length >= 28, `${departmentId} is missing skills`);
    assert.deepEqual(
      [...new Set(tree.skills.map((skill) => skill.tier))].sort(),
      [0, 1, 2, 3, 4]
    );
    assert.ok(tree.skills.every((skill) => skill.description.length > 10));
  }
});
