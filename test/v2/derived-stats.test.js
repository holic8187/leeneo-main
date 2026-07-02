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
