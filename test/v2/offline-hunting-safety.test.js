'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  shouldStopOfflineHuntingBeforeHpPotion,
  enforceOfflineHuntingSurvival,
  getOfflineHuntingActionTimes
} = require('../../src/v2/registerV2Routes');
const {
  addInventoryItem,
  consumeInventoryItem
} = require('../../src/v2/services/inventoryService');
const routes = fs.readFileSync(
  path.join(__dirname, '../../src/v2/registerV2Routes.js'),
  'utf8'
);

function characterFixture() {
  return {
    resources: { currentHp: 60, maxHp: 100, currentMp: 100, maxMp: 100 },
    huntingTime: { enabled: true },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: {
        hp: 'hard_candy',
        mp: '',
        autoHpPercent: 70,
        autoMpPercent: 0
      }
    },
    mailbox: []
  };
}

test('offline hunting preserves the final configured HP potion and stops safely', () => {
  const character = characterFixture();
  addInventoryItem(character, 'hard_candy', 2);
  assert.equal(shouldStopOfflineHuntingBeforeHpPotion(character), false);
  consumeInventoryItem(character, 'hard_candy', 1);
  assert.equal(shouldStopOfflineHuntingBeforeHpPotion(character), true);
});

test('offline hunting stops at its HP threshold when no configured potion remains', () => {
  const character = characterFixture();
  assert.equal(shouldStopOfflineHuntingBeforeHpPotion(character), true);
  character.resources.currentHp = 80;
  assert.equal(shouldStopOfflineHuntingBeforeHpPotion(character), false);
});

test('offline lethal damage leaves the character at one HP and stops hunting', () => {
  assert.match(routes, /offlineLethalPrevented[\s\S]*character\.resources\.currentHp = 1/);
  assert.match(routes, /offlineLethalPrevented[\s\S]*stopOfflineHuntingForSafety\(character\)/);
});

test('a dead background hunter is recovered at one HP and stopped at handoff', () => {
  const character = characterFixture();
  character.resources.currentHp = 0;
  assert.equal(enforceOfflineHuntingSurvival(character), true);
  assert.equal(character.resources.currentHp, 1);
  assert.equal(character.huntingTime.enabled, false);
});

test('short background handoffs do not simulate a minimum five-second combat burst', () => {
  assert.deepEqual(getOfflineHuntingActionTimes({
    elapsedMs: 1_199,
    intervalMs: 1_200,
    now: 10_000
  }), []);
  assert.deepEqual(getOfflineHuntingActionTimes({
    elapsedMs: 1_200,
    intervalMs: 1_200,
    now: 10_000
  }), [10_000]);
});

test('offline catch-up actions cover only elapsed time and stay chronological', () => {
  assert.deepEqual(getOfflineHuntingActionTimes({
    elapsedMs: 5_000,
    intervalMs: 1_200,
    now: 10_000
  }), [6_200, 7_400, 8_600, 9_800]);
});
