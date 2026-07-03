'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addInventoryItem, getItemQuantity } = require('../../src/v2/services/inventoryService');
const { changeDepartment } = require('../../src/v2/services/jobChangeService');

function makeCharacter() {
  return {
    progression: {
      level: 70,
      unspentStatPoints: 0,
      unspentSkillPoints: 0,
      totalSkillPointsEarned: 0
    },
    stats: { grit: 180, processingSpeed: 60, workKnowledge: 4, awareness: 4 },
    job: { departmentId: 'hr', advancementTier: 3 },
    skills: {
      levels: { power_strike: 20, sword_mastery: 20 },
      activePreset: ['power_strike'],
      unlockedQuestSkills: [],
      activeBuffs: [{ skillId: 'rage' }],
      summon: null,
      comboCount: 3
    },
    resources: { currentHp: 1, maxHp: 1, currentMp: 1, maxMp: 1 },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', autoHpPercent: 0, autoMpPercent: 0 }
    }
  };
}

test('job change consumes one ticket and refunds all stat and skill investment', () => {
  const character = makeCharacter();
  addInventoryItem(character, 'job_change_ticket', 1);
  const result = changeDepartment(character, 'quality');
  assert.equal(result.departmentId, 'quality');
  assert.equal(character.job.advancementTier, 3);
  assert.deepEqual(character.stats, {
    grit: 4,
    processingSpeed: 4,
    workKnowledge: 4,
    awareness: 4
  });
  assert.equal(character.progression.unspentStatPoints, 345);
  assert.equal(character.progression.unspentSkillPoints, 192);
  assert.deepEqual(character.skills.levels, {});
  assert.deepEqual(character.skills.activePreset, []);
  assert.equal(getItemQuantity(character, 'job_change_ticket'), 0);
  assert.equal(character.resources.currentHp, character.resources.maxHp);
});

test('job change rejects the current department and missing tickets', () => {
  const character = makeCharacter();
  addInventoryItem(character, 'job_change_ticket', 1);
  assert.throws(() => changeDepartment(character, 'hr'));
  character.inventory.items = [];
  assert.throws(() => changeDepartment(character, 'quality'));
});
