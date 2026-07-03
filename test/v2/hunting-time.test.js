'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_HUNTING_SECONDS,
  ensureDailyHuntingMail,
  setHuntingEnabled,
  tickHuntingTime,
  addHuntingMinutes
} = require('../../src/v2/services/huntingTimeService');

function createCharacter() {
  return { huntingTime: {}, mailbox: [], markModified() {} };
}

test('daily hunting time mail is issued once per Korea calendar day', () => {
  const character = createCharacter();
  const now = new Date('2026-07-03T01:00:00.000Z');
  assert.equal(ensureDailyHuntingMail(character, now), true);
  assert.equal(ensureDailyHuntingMail(character, now), false);
  assert.equal(character.mailbox.length, 1);
  assert.equal(character.mailbox[0].attachments[0].itemId, 'hunting_time_180m');
});

test('hunting time drains only while enabled and caps at four hundred minutes', () => {
  const character = createCharacter();
  addHuntingMinutes(character, 180);
  addHuntingMinutes(character, 300);
  assert.equal(character.huntingTime.remainingSeconds, MAX_HUNTING_SECONDS);
  setHuntingEnabled(character, true, 1000);
  tickHuntingTime(character, true, 11_000);
  assert.equal(character.huntingTime.remainingSeconds, MAX_HUNTING_SECONDS - 10);
  tickHuntingTime(character, false, 21_000);
  assert.equal(character.huntingTime.remainingSeconds, MAX_HUNTING_SECONDS - 10);
});
