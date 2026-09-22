'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const CARD_COMBAT_POWER = require('../../src/tcg/data/cardCombatPower.json');
const CARD_ROLES = require('../../src/tcg/data/cardRoles.json');

test('server card power and progression roles match the complete client catalog', async () => {
  const [{ ALL_CARDS }, { roleForCard }] = await Promise.all([
    import('../../tcg-desktop/src/data/cardCatalog.js'),
    import('../../tcg-desktop/src/core/cardProgression.js'),
  ]);
  assert.deepEqual(Object.keys(CARD_COMBAT_POWER), ALL_CARDS.map((card) => card.id));
  assert.deepEqual(Object.keys(CARD_ROLES), ALL_CARDS.map((card) => card.id));
  for (const card of ALL_CARDS) {
    assert.equal(CARD_COMBAT_POWER[card.id], card.combatPower, `${card.id} combat power`);
    assert.equal(CARD_ROLES[card.id], roleForCard(card).id, `${card.id} progression role`);
  }
});
