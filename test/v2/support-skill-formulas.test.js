'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateWelfareSupportDamage } = require('../../src/v2/registerV2Routes');

test('welfare support undead damage follows INT LUK magic and heal-target coefficient', () => {
  const minimum = calculateWelfareSupportDamage({
    workKnowledge: 100,
    awareness: 20,
    magic: 200,
    targetCount: 1,
    healPercent: 300,
    random: () => 0
  });
  const maximum = calculateWelfareSupportDamage({
    workKnowledge: 100,
    awareness: 20,
    magic: 200,
    targetCount: 1,
    healPercent: 300,
    random: () => 1
  });
  assert.equal(minimum, 195);
  assert.equal(maximum, 546);
  assert.ok(maximum > minimum);
});
