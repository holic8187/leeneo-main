'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_HUNTING_SECONDS,
  DAILY_HUNTING_MINUTES,
  ensureDailyHuntingMail,
  setHuntingEnabled,
  tickHuntingTime,
  addHuntingMinutes,
  getOfflineHuntingSummaryId,
  createOfflineHuntingSummary
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
  assert.equal(character.mailbox[0].attachments[0].itemId, 'hunting_time_360m');
  assert.equal(DAILY_HUNTING_MINUTES, 360);
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

test('one offline hunting settlement keeps a stable identifier while its totals change', () => {
  const summary = createOfflineHuntingSummary(
    new Date('2026-07-21T00:00:00.000Z'),
    () => 'offline-session-1'
  );
  assert.equal(getOfflineHuntingSummaryId(summary), 'offline-session-1');
  summary.updatedAt = '2026-07-21T00:10:00.000Z';
  summary.kills = 25;
  summary.exp = 12345;
  assert.equal(getOfflineHuntingSummaryId(summary), 'offline-session-1');
});

test('legacy offline hunting settlements use their start time as a stable identifier', () => {
  assert.equal(getOfflineHuntingSummaryId({
    startedAt: '2026-07-20T23:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z'
  }), '2026-07-20T23:00:00.000Z');
});
