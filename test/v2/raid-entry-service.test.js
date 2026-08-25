'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemDefinition, listAdminGrantItems } = require('../../src/v2/items/itemCatalog');
const {
  getRaidEntryCredit,
  hasRaidEntryAvailable,
  grantRaidEntryCredit,
  buildRaidEntryUseUpdate
} = require('../../src/v2/services/raidEntryService');

const BOSS_ID = 'bald_kim_manager';
const DATE_KEY = '2026-08-03';

test('Bald Kim entry ticket is an admin-only nontradeable cash item', () => {
  const ticket = getItemDefinition('bald_kim_entry_ticket');
  assert.equal(ticket.category, 'cash');
  assert.equal(ticket.itemType, 'boss-entry-ticket');
  assert.equal(ticket.bossId, BOSS_ID);
  assert.equal(ticket.tradeable, false);
  assert.equal(ticket.marketable, false);
  assert.equal(ticket.adminGrantOnly, true);
  assert.equal(
    listAdminGrantItems().some((item) => item.id === ticket.id),
    true
  );
});

test('daily free raid entry does not consume a stored ticket credit', () => {
  const character = {
    bossRaidEntries: {},
    bossRaidEntryCredits: { [BOSS_ID]: 2 }
  };
  const entry = buildRaidEntryUseUpdate(character, BOSS_ID, DATE_KEY);

  assert.equal(entry.usedCredit, false);
  assert.equal(entry.remainingCredits, 2);
  assert.deepEqual(entry.fields, { [`bossRaidEntries.${BOSS_ID}`]: DATE_KEY });
});

test('ticket credit unlocks one additional same-day raid entry and is then consumed', () => {
  const modified = [];
  const character = {
    bossRaidEntries: { [BOSS_ID]: DATE_KEY },
    bossRaidEntryCredits: {},
    markModified(path) { modified.push(path); }
  };

  assert.equal(hasRaidEntryAvailable(character, BOSS_ID, DATE_KEY), false);
  const credit = grantRaidEntryCredit(character, BOSS_ID);
  assert.equal(credit.availableCredits, 1);
  assert.equal(getRaidEntryCredit(character, BOSS_ID), 1);
  assert.deepEqual(modified, ['bossRaidEntryCredits']);
  assert.equal(hasRaidEntryAvailable(character, BOSS_ID, DATE_KEY), true);

  const entry = buildRaidEntryUseUpdate(character, BOSS_ID, DATE_KEY);
  assert.equal(entry.usedCredit, true);
  assert.equal(entry.remainingCredits, 0);
  assert.deepEqual(entry.fields, { [`bossRaidEntryCredits.${BOSS_ID}`]: 0 });
});
