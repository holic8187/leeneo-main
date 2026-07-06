'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDerivedStats } = require('../../src/v2/combat/derivedStats');

test('derived stats use equipped weapon, loadout totals, and base movement speed', () => {
  const result = buildDerivedStats({
    progression: { level: 30 },
    stats: { grit: 40, processingSpeed: 15, workKnowledge: 3, awareness: 7 },
    job: { departmentId: 'hr', advancementTier: 1 },
    loadout: {
      weapon: {
        weaponType: 'twoHandedSword',
        mastery: 50,
        stats: { attack: 25 }
      },
      helmet: { stats: { defense: 12, accuracy: 3 } },
      shoes: {
        stats: {
          defense: 8,
          magicDefense: 6,
          evasion: 4,
          movementSpeed: 5
        }
      }
    }
  });

  assert.equal(result.attackMaximum, 49.75);
  assert.equal(result.attackMinimum, 24.88);
  assert.equal(result.defense, 37);
  assert.equal(result.physicalDefense, 37);
  assert.equal(result.magicDefense, 10);
  assert.equal(result.accuracy, 18.5);
  assert.equal(result.evasion, 12.25);
  assert.equal(result.movementSpeed, 105);
  assert.equal(result.weaponType, 'twoHandedSword');
  assert.equal(result.weaponConstant, 4.6);
  assert.equal(result.weaponMastery, 50);
  assert.equal(result.attackSpeedMultiplier, 1);
});

test('ring stats contribute to physical magic and all four base stats', () => {
  const result = buildDerivedStats({
    progression: { level: 1 },
    stats: { grit: 4, processingSpeed: 4, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'unassigned', advancementTier: 0 },
    loadout: {
      ring: {
        stats: {
          attack: 40,
          magic: 80,
          grit: 5,
          processingSpeed: 5,
          workKnowledge: 5,
          awareness: 5
        }
      }
    }
  });

  assert.deepEqual(result.effectiveStats, {
    grit: 9,
    processingSpeed: 9,
    workKnowledge: 9,
    awareness: 9
  });
  assert.equal(result.magic, 89);
  assert.ok(result.attackMaximum > 4);
});

test('warrior weapon constants produce different attack ranges from identical stats and attack', () => {
  const common = {
    progression: { level: 30 },
    stats: { grit: 40, processingSpeed: 15, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'hr', advancementTier: 2 }
  };
  const sword = buildDerivedStats({
    ...common,
    loadout: {
      weapon: {
        weaponType: 'oneHandedSword',
        attackSpeedMultiplier: 1.2,
        stats: { attack: 20, mastery: 60 }
      }
    }
  });
  const spear = buildDerivedStats({
    ...common,
    loadout: {
      weapon: {
        weaponType: 'spear',
        attackSpeedMultiplier: 0.6,
        stats: { attack: 20, mastery: 60 }
      }
    }
  });
  assert.equal(sword.weaponConstant, 4);
  assert.equal(spear.weaponConstant, 5);
  assert.equal(sword.attackMaximum, 35);
  assert.equal(spear.attackMaximum, 43);
  assert.equal(sword.attackSpeedMultiplier, 1.2);
  assert.equal(spear.attackSpeedMultiplier, 0.6);
});

test('level one base stats produce four attack, magic, defense, and evasion', () => {
  const result = buildDerivedStats({
    stats: { grit: 4, processingSpeed: 4, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'unassigned' },
    loadout: {}
  });

  assert.equal(result.attackMinimum, 4);
  assert.equal(result.attackMaximum, 4);
  assert.equal(result.magic, 4);
  assert.equal(result.defense, 4);
  assert.equal(result.evasion, 4);
  assert.equal(result.movementSpeed, 100);
  assert.equal(result.attackRange, 100);
  assert.equal(result.attackSpeedStage, 1);
});

test('passive weapon range is added to the equipped weapon base range', () => {
  const result = buildDerivedStats({
    stats: { grit: 4, processingSpeed: 30, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'accounting', advancementTier: 1 },
    loadout: {
      weapon: { weaponType: 'crossbow', stats: { attack: 10 } }
    },
    skillEffects: { attackRangeIncrease: 120 }
  });
  assert.equal(result.attackRange, 380);
});

test('equipment main stats and resource bonuses are included in derived stats', () => {
  const result = buildDerivedStats({
    progression: { level: 30 },
    stats: { grit: 40, processingSpeed: 15, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'hr', advancementTier: 2 },
    loadout: {
      weapon: {
        weaponType: 'oneHandedSword',
        stats: { attack: 20, grit: 5 }
      },
      helmet: { stats: { defense: 10, grit: 3 } },
      cape: { stats: { evasion: 4, maxHp: 50 } },
      earrings: { stats: { accuracy: 7, maxMp: 20 } }
    }
  });

  assert.deepEqual(result.equipmentStatBonuses, {
    grit: 8,
    processingSpeed: 0,
    workKnowledge: 0,
    awareness: 0
  });
  assert.equal(result.effectiveStats.grit, 48);
  assert.equal(result.maxHpBonus, 50);
  assert.equal(result.maxMpBonus, 20);
  assert.ok(result.attackMaximum > 35);
  assert.ok(result.defense > 10);
  assert.ok(result.accuracy > 7);
  assert.ok(result.evasion > 4);
});
