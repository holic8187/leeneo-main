'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getItemDefinition,
  listAdminGrantItems
} = require('../../src/v2/items/itemCatalog');

test('the seven-day unlimited shout pass is an admin-grant cash consumable', () => {
  const pass = getItemDefinition('shout_unlimited_pass_7d');

  assert.ok(pass);
  assert.equal(pass.itemType, 'shout-pass');
  assert.equal(pass.category, 'cash');
  assert.equal(pass.durationSeconds, 7 * 24 * 60 * 60);
  assert.equal(pass.tradeable, false);
  assert.equal(pass.marketable, false);
  assert.equal(pass.sellPrice, 0);
  assert.equal(pass.adminGrantOnly, true);
  assert.ok(listAdminGrantItems().some((item) => item.id === pass.id));
});
