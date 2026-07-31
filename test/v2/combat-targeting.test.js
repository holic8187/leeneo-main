'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectCombatTarget,
  shouldJumpForCombatApproach,
  resolveTravelDirection
} = require('../../public/v2/combat-targeting');

function monster(id, platformId, floor, x) {
  return { id, platformId, floor, x, hp: 100 };
}

const baseContext = Object.freeze({
  currentX: 20,
  currentFloor: 0,
  currentPlatformId: 'ground-west',
  worldWidth: 2_000,
  connectors: [
    { fromFloor: 0, toFloor: 1, x: 30, type: 'ladder' },
    { fromFloor: 1, toFloor: 2, x: 70, type: 'jump' }
  ]
});

test('free hunting clears the current platform before changing hunting areas', () => {
  const selected = selectCombatTarget([
    monster('current', 'ground-west', 0, 28),
    monster('other-1', 'upper-east', 1, 32),
    monster('other-2', 'upper-east', 1, 34),
    monster('other-3', 'upper-east', 1, 36)
  ], baseContext);

  assert.equal(selected.id, 'current');
});

test('free hunting favors a nearby monster-rich platform after the current floor is clear', () => {
  const selected = selectCombatTarget([
    monster('isolated', 'upper-west', 1, 26),
    monster('group-1', 'upper-east', 1, 38),
    monster('group-2', 'upper-east', 1, 40),
    monster('group-3', 'upper-east', 1, 42),
    monster('group-4', 'upper-east', 1, 44)
  ], baseContext);

  assert.match(selected.id, /^group-/);
});

test('a rally point restricts hunting to its exact platform', () => {
  const selected = selectCombatTarget([
    monster('rally-target', 'upper-west', 1, 30),
    monster('outside-1', 'upper-east', 1, 48),
    monster('outside-2', 'upper-east', 1, 50)
  ], {
    ...baseContext,
    currentFloor: 1,
    currentX: 28,
    currentPlatformId: 'upper-west',
    rallyPlatformId: 'upper-west'
  });
  const waiting = selectCombatTarget([
    monster('outside', 'upper-east', 1, 48)
  ], {
    ...baseContext,
    currentFloor: 1,
    currentX: 28,
    currentPlatformId: 'upper-west',
    rallyPlatformId: 'upper-west'
  });

  assert.equal(selected.id, 'rally-target');
  assert.equal(waiting, null);
});

test('dead monsters never influence hunting area selection', () => {
  const selected = selectCombatTarget([
    { ...monster('dead', 'ground-west', 0, 21), hp: 0 },
    monster('alive', 'upper-west', 1, 30)
  ], baseContext);

  assert.equal(selected.id, 'alive');
});

test('combat approach jumps across platforms only when movement is required', () => {
  assert.equal(shouldJumpForCombatApproach({
    currentPlatformId: 'ground-west',
    targetPlatformId: 'ground-east',
    gapPx: 300,
    rangePx: 540
  }), false);
  assert.equal(shouldJumpForCombatApproach({
    currentPlatformId: 'ground-west',
    targetPlatformId: 'ground-east',
    gapPx: 700,
    rangePx: 540
  }), true);
  assert.equal(shouldJumpForCombatApproach({
    currentPlatformId: 'ground-west',
    targetPlatformId: 'ground-west',
    gapPx: 700,
    rangePx: 540
  }), false);
});

test('movement and combat targets override stale facing for travel skills', () => {
  assert.equal(resolveTravelDirection({
    currentX: 60,
    activeMoveTargetX: 20,
    combatTargetX: 80,
    fallbackDirection: 1
  }), -1);
  assert.equal(resolveTravelDirection({
    currentX: 40,
    combatTargetX: 75,
    fallbackDirection: -1
  }), 1);
  assert.equal(resolveTravelDirection({
    currentX: 40,
    fallbackDirection: -1
  }), -1);
});
