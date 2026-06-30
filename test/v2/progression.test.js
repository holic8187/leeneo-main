'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_LEVEL,
  EXP_TO_NEXT_LEVEL,
  getRequiredExpV2
} = require('../../src/v2/constants/experienceTable');
const {
  mapLegacyLevelToV2,
  getStatPointsForLevel
} = require('../../src/v2/progression/levelMigration');

test('experience table covers level 1 through 199 and ignores level 200', () => {
  assert.equal(MAX_LEVEL, 200);
  assert.equal(EXP_TO_NEXT_LEVEL.length, 200);
  assert.equal(getRequiredExpV2(1), 15);
  assert.equal(getRequiredExpV2(50), 709716);
  assert.equal(getRequiredExpV2(100), 10223168);
  assert.equal(getRequiredExpV2(150), 147262175);
  assert.equal(getRequiredExpV2(199), 2011069705);
  assert.equal(getRequiredExpV2(200), 0);
});

test('experience requirements are strictly increasing through level 199', () => {
  for (let level = 1; level < 199; level += 1) {
    assert.ok(
      getRequiredExpV2(level + 1) > getRequiredExpV2(level),
      `level ${level + 1} requirement must exceed level ${level}`
    );
  }
});

test('legacy level curve preserves early levels and maps 1900 to 130', () => {
  assert.equal(mapLegacyLevelToV2(1), 1);
  assert.equal(mapLegacyLevelToV2(30), 30);
  assert.equal(mapLegacyLevelToV2(1900), 130);
  assert.ok(mapLegacyLevelToV2(3000) > 130);
  assert.ok(mapLegacyLevelToV2(100000) <= 150);
});

test('legacy level curve is monotonic', () => {
  let previous = 0;
  for (let level = 1; level <= 5000; level += 1) {
    const mapped = mapLegacyLevelToV2(level);
    assert.ok(mapped >= previous, `mapping decreased at legacy level ${level}`);
    previous = mapped;
  }
});

test('stat points grant five points per completed level', () => {
  assert.equal(getStatPointsForLevel(1), 0);
  assert.equal(getStatPointsForLevel(130), 645);
  assert.equal(getStatPointsForLevel(200), 995);
});
