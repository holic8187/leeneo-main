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
  addHuntingCapacityMinutes,
  getOfflineHuntingSummaryId,
  createOfflineHuntingSummary,
  acknowledgeOfflineHuntingSummary
} = require('../../src/v2/services/huntingTimeService');
const { getKoreaDateKey } = require('../../src/v2/services/dailyAugmentService');

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

test('automation revolution waives its first thirty minutes of hunting time', () => {
  const character = createCharacter();
  character.userId = 'automation-user';
  const startedAt = new Date('2026-07-24T03:00:00.000Z');
  character.dailyAugment = {
    dateKey: getKoreaDateKey(startedAt),
    tier: 'prism',
    selectedId: 'automation_revolution',
    counters: { freeHuntingSeconds: 30 * 60 }
  };
  addHuntingMinutes(character, 60);
  setHuntingEnabled(character, true, startedAt.getTime());

  tickHuntingTime(character, true, startedAt.getTime() + 20 * 60 * 1000);
  assert.equal(character.huntingTime.remainingSeconds, 60 * 60);
  assert.equal(character.dailyAugment.counters.freeHuntingSeconds, 10 * 60);

  tickHuntingTime(character, true, startedAt.getTime() + 31 * 60 * 1000);
  assert.equal(character.dailyAugment.counters.freeHuntingSeconds, 0);
  assert.equal(character.huntingTime.remainingSeconds, 59 * 60);
});

test('overtime knowhow reduces hunting-time consumption by exactly two percent over time', () => {
  const character = createCharacter();
  character.userId = 'knowhow-user';
  const startedAt = new Date('2026-07-24T03:00:00.000Z');
  character.dailyAugment = {
    dateKey: getKoreaDateKey(startedAt),
    tier: 'silver',
    selectedId: 'overtime_knowhow',
    counters: {}
  };
  addHuntingMinutes(character, 60);
  setHuntingEnabled(character, true, startedAt.getTime());

  tickHuntingTime(character, true, startedAt.getTime() + 101 * 1000);
  assert.equal(character.huntingTime.remainingSeconds, 60 * 60 - 98);
  assert.ok(Math.abs(character.huntingTime.consumptionRemainder - 0.98) < 1e-9);

  tickHuntingTime(character, true, startedAt.getTime() + 102 * 1000);
  assert.equal(character.huntingTime.remainingSeconds, 60 * 60 - 99);
});

test('capacity tickets raise the personal hunting cap by forty minutes up to eight hundred', () => {
  const character = createCharacter();
  const first = addHuntingCapacityMinutes(character, 40);
  assert.equal(first.maximumSeconds, 440 * 60);
  for (let index = 0; index < 20; index += 1) addHuntingCapacityMinutes(character, 40);
  assert.equal(character.huntingTime.maximumSeconds, 800 * 60);
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

test('offline hunting settlement is cleared only after its exact identifier is acknowledged', () => {
  const character = createCharacter();
  character.huntingTime.offlineSummary = createOfflineHuntingSummary(
    new Date('2026-07-22T00:00:00.000Z'),
    () => 'offline-session-confirm'
  );

  assert.deepEqual(acknowledgeOfflineHuntingSummary(character, ''), {
    acknowledged: false,
    cleared: false
  });
  assert.ok(character.huntingTime.offlineSummary);
  assert.deepEqual(acknowledgeOfflineHuntingSummary(character, 'another-session'), {
    acknowledged: false,
    cleared: false
  });
  assert.ok(character.huntingTime.offlineSummary);
  assert.deepEqual(acknowledgeOfflineHuntingSummary(character, 'offline-session-confirm'), {
    acknowledged: true,
    cleared: true
  });
  assert.equal(character.huntingTime.offlineSummary, null);
});
