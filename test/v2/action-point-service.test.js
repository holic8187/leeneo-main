'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ensureDailyActionPoints,
  spendActionPoints,
  restoreActionPoints,
  serializeActionPoints
} = require('../../src/v2/services/actionPointService');

function characterFixture() {
  return {
    actionPoints: { current: 2, max: 10, lastResetDate: '2026-07-20' }
  };
}

test('action points refill once when the Korean calendar date changes', () => {
  const character = characterFixture();
  const beforeMidnightUtc = Date.parse('2026-07-20T14:59:59.000Z');
  const afterMidnightUtc = Date.parse('2026-07-20T15:00:01.000Z');

  assert.equal(ensureDailyActionPoints(character, beforeMidnightUtc), false);
  assert.equal(character.actionPoints.current, 2);
  assert.equal(ensureDailyActionPoints(character, afterMidnightUtc), true);
  assert.deepEqual(serializeActionPoints(character), {
    current: 10,
    max: 10,
    lastResetDate: '2026-07-21'
  });
  character.actionPoints.current = 7;
  assert.equal(ensureDailyActionPoints(character, afterMidnightUtc + 1_000), false);
  assert.equal(character.actionPoints.current, 7);
});

test('special actions spend points and Hot Six restoration stops at the cap', () => {
  const character = {
    actionPoints: { current: 10, max: 10, lastResetDate: '2026-07-21' }
  };
  spendActionPoints(character, 6, Date.parse('2026-07-21T01:00:00.000Z'));
  assert.equal(character.actionPoints.current, 4);
  assert.equal(restoreActionPoints(character, 1).restored, 1);
  assert.equal(character.actionPoints.current, 5);
  assert.throws(() => spendActionPoints(character, 6), /행동력이 6 필요/);
  assert.equal(restoreActionPoints(character, 100).restored, 5);
  assert.equal(character.actionPoints.current, 10);
});
