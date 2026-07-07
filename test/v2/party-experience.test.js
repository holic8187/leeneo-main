'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePartyExperienceShares } = require('../../src/v2/registerV2Routes');

test('party experience is split by killer bonus, level ratio, and party size bonus', () => {
  const shares = calculatePartyExperienceShares({
    baseExp: 1000,
    killerId: 'killer',
    members: [
      { userId: 'killer', level: 100 },
      { userId: 'support', level: 100 }
    ]
  });

  assert.deepEqual(
    shares.map((share) => ({ userId: share.userId, exp: share.exp, killer: share.killer })),
    [
      { userId: 'killer', exp: 660, killer: true },
      { userId: 'support', exp: 440, killer: false }
    ]
  );
});

test('two-member party follows the reference formula example', () => {
  const shares = calculatePartyExperienceShares({
    baseExp: 100,
    killerId: 'level-60',
    members: [
      { userId: 'level-60', level: 60 },
      { userId: 'level-45', level: 45 }
    ]
  });

  assert.equal(shares.find((share) => share.userId === 'level-60').exp, 72);
  assert.equal(shares.find((share) => share.userId === 'level-45').exp, 37);
});

test('three-member party follows the reference formula example', () => {
  const shares = calculatePartyExperienceShares({
    baseExp: 100,
    killerId: 'level-25',
    members: [
      { userId: 'level-25', level: 25 },
      { userId: 'level-30', level: 30 },
      { userId: 'level-35', level: 35 }
    ]
  });

  assert.equal(shares.find((share) => share.userId === 'level-25').exp, 48);
  assert.equal(shares.find((share) => share.userId === 'level-30').exp, 30);
  assert.equal(shares.find((share) => share.userId === 'level-35').exp, 35);
});

test('solo combat keeps the full monster experience for the killer', () => {
  assert.deepEqual(
    calculatePartyExperienceShares({
      baseExp: 123,
      killerId: 'solo',
      members: [{ userId: 'solo', level: 50 }]
    }),
    [{ userId: 'solo', level: 50, exp: 123, killer: true }]
  );
});
