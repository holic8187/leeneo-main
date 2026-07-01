'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveCombatMotion
} = require('../../src/v2/combat/weaponMotion');

test('equipped weapon determines the combat motion first', () => {
  assert.equal(resolveCombatMotion({ weaponType: 'twoHandedSword', departmentId: 'development' }).motion, 'slash');
  assert.equal(resolveCombatMotion({ weaponType: 'bow', departmentId: 'hr' }).motion, 'shoot');
  assert.equal(resolveCombatMotion({ weaponType: 'claw', departmentId: 'hr' }).motion, 'throw');
  assert.equal(resolveCombatMotion({ weaponType: 'staff', departmentId: 'hr' }).motion, 'staff-swing');
});

test('department archetype is only a presentation fallback before equipment exists', () => {
  assert.equal(resolveCombatMotion({ departmentId: 'development' }).motion, 'staff-swing');
  assert.equal(resolveCombatMotion({ departmentId: 'accounting' }).motion, 'shoot');
  assert.equal(resolveCombatMotion({ departmentId: 'sales' }).motion, 'throw');
  assert.equal(resolveCombatMotion({ departmentId: 'unassigned' }).source, 'trainee-preview');
});
