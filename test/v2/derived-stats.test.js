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
  assert.equal(result.defense, 20);
  assert.equal(result.physicalDefense, 20);
  assert.equal(result.magicDefense, 6);
  assert.equal(result.accuracy, 18.5);
  assert.equal(result.evasion, 11.25);
  assert.equal(result.movementSpeed, 105);
  assert.equal(result.weaponType, 'twoHandedSword');
});

test('unarmed characters keep zero attack and a 100 percent movement baseline', () => {
  const result = buildDerivedStats({
    stats: {},
    job: { departmentId: 'unassigned' },
    loadout: {}
  });

  assert.equal(result.attackMinimum, 0);
  assert.equal(result.attackMaximum, 0);
  assert.equal(result.movementSpeed, 100);
  assert.equal(result.attackRange, 22);
});
