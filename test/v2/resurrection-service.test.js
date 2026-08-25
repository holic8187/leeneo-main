'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectResurrectionTarget,
  reviveCharacter
} = require('../../src/v2/services/resurrectionService');

test('resurrection selects the nearest dead party member on the same floor and in range', () => {
  const target = selectResurrectionTarget({
    casterId: 'caster',
    rangePx: 350,
    worldWidth: 1200,
    activePlayers: [
      { userId: 'caster', currentHp: 500, x: 50, floor: 0 },
      { userId: 'living', currentHp: 1, x: 51, floor: 0 },
      { userId: 'other-floor', currentHp: 0, x: 50, floor: 1 },
      { userId: 'far-dead', currentHp: 0, x: 10, floor: 0 },
      { userId: 'near-dead', currentHp: 0, x: 58, floor: 0 }
    ]
  });

  assert.equal(target.userId, 'near-dead');
});

test('resurrection restores half HP, preserves death-time MP, and clears raid death timer', () => {
  const character = {
    resources: { currentHp: 0, maxHp: 8_000, currentMp: 321, maxMp: 2_000 },
    worldState: { raidDeadAt: new Date() }
  };

  const result = reviveCharacter(character, {
    maxHp: 8_000,
    maxMp: 2_000,
    hpPercent: 50
  });

  assert.deepEqual(result, { restoredHp: 4_000, restoredMp: 321 });
  assert.equal(character.resources.currentHp, 4_000);
  assert.equal(character.resources.currentMp, 321);
  assert.equal(character.worldState.raidDeadAt, null);
});
