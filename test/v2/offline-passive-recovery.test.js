'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyOfflinePassiveMpRecovery,
  restoreCharacterMp
} = require('../../src/v2/services/offlinePassiveRecoveryService');

function makeCharacter() {
  return {
    job: { departmentId: 'hr', advancementTier: 3 },
    progression: { level: 70 },
    resources: { currentMp: 10, maxMp: 200 },
    huntingTime: { offlinePassiveRecoveryAt: null },
    skills: {
      levels: { strong_mind: 20 },
      activePreset: [],
      unlockedQuestSkills: [],
      activeBuffs: [],
      summon: null,
      comboCount: 0
    },
    markModified() {}
  };
}

test('offline periodic MP recovery carries partial intervals across sweeps', () => {
  const character = makeCharacter();
  const first = applyOfflinePassiveMpRecovery(character, {
    now: 105_000,
    baselineAt: 100_000
  });
  assert.equal(first.ticks, 0);
  assert.equal(character.resources.currentMp, 10);

  const second = applyOfflinePassiveMpRecovery(character, {
    now: 110_000,
    baselineAt: 105_000
  });
  assert.equal(second.ticks, 1);
  assert.equal(second.restored, 30);
  assert.equal(character.resources.currentMp, 40);
});

test('offline MP absorb restoration is capped and persisted on resources', () => {
  const modified = [];
  const character = makeCharacter();
  character.resources.currentMp = 195;
  character.markModified = (path) => modified.push(path);
  assert.equal(restoreCharacterMp(character, 30), 5);
  assert.equal(character.resources.currentMp, 200);
  assert.deepEqual(modified, ['resources']);
});
