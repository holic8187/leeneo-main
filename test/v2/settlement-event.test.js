'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');
const { MONSTER_CATALOG } = require('../../src/v2/world/monsterCatalog');
const {
  getSettlementEventView,
  isEventLevelRangeMonster,
  rollSettlementEventCoin,
  purchaseSettlementEventItem
} = require('../../src/v2/services/settlementEventService');

function makeCharacter(level = 30) {
  return {
    progression: { level },
    inventory: {
      items: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: {}
    },
    events: {},
    mailbox: [],
    resources: {},
    markModified() {}
  };
}

const eventDate = new Date('2026-07-10T12:00:00+09:00');

test('event coins only drop from monsters within ten levels and respect the daily cap', () => {
  const character = makeCharacter(30);
  assert.ok(rollSettlementEventCoin(character, 40, () => 0, eventDate));
  assert.equal(rollSettlementEventCoin(character, 41, () => 0, eventDate), null);
  character.events.settlementSupport.dailyCoinCount = 200;
  assert.equal(rollSettlementEventCoin(character, 30, () => 0, eventDate), null);
});

test('level eighty and above accepts every monster from level seventy upward', () => {
  assert.equal(isEventLevelRangeMonster(79, 69), true);
  assert.equal(isEventLevelRangeMonster(79, 90), false);
  assert.equal(isEventLevelRangeMonster(80, 69), false);
  assert.equal(isEventLevelRangeMonster(80, 70), true);
  assert.equal(isEventLevelRangeMonster(80, 140), true);
  assert.equal(isEventLevelRangeMonster(132, 70), true);

  const character = makeCharacter(132);
  const drop = rollSettlementEventCoin(character, 70, () => 0, eventDate);
  assert.ok(drop);
  assert.equal(drop.grounded, false);
  assert.equal(rollSettlementEventCoin(character, 69, () => 0, eventDate), null);
});

test('the blessed necklace is event-shop-only and costs three hundred coins', () => {
  const necklace = getItemDefinition('blessed_settlement_necklace');
  assert.equal(necklace.equipmentSlot, 'necklace');
  assert.equal(necklace.tradeable, false);
  assert.equal(necklace.acquisitionSource, 'settlement-event-shop');
  assert.equal(necklace.dropEligible, false);
  assert.equal(
    MONSTER_CATALOG.some((monster) => (
      Object.values(monster.dropTable).flat().some((drop) => drop.itemId === necklace.id)
    )),
    false
  );

  const character = makeCharacter();
  character.inventory.items.push({
    stackId: 'coins',
    itemId: 'settlement_event_coin',
    quantity: 300,
    expiresAt: null,
    data: null
  });
  purchaseSettlementEventItem(character, 'blessed-necklace', eventDate);
  const view = getSettlementEventView(character, eventDate);
  assert.equal(view.coins, 0);
  assert.ok(character.inventory.items.some((entry) => entry.itemId === necklace.id));
});

test('the settlement ring is free once per account and expires after July', () => {
  const character = makeCharacter();
  const ring = getItemDefinition('settlement_support_ring');

  assert.equal(ring.equipmentSlot, 'ring');
  assert.equal(ring.tradeable, false);
  assert.equal(ring.requiredLevel, 1);
  assert.equal(ring.stats.attack, 40);
  assert.equal(ring.stats.magic, 80);
  assert.deepEqual(
    [ring.stats.grit, ring.stats.processingSpeed, ring.stats.workKnowledge, ring.stats.awareness],
    [5, 5, 5, 5]
  );

  purchaseSettlementEventItem(character, 'settlement-ring', eventDate);
  const stack = character.inventory.items.find((entry) => entry.itemId === ring.id);
  assert.ok(stack);
  assert.equal(new Date(stack.expiresAt).toISOString(), '2026-07-31T15:00:00.000Z');
  assert.throws(
    () => purchaseSettlementEventItem(character, 'settlement-ring', eventDate),
    /한 번/
  );
});

test('event experience coupons are limited to one purchase per day', () => {
  const character = makeCharacter();
  character.inventory.items.push({
    stackId: 'coins',
    itemId: 'settlement_event_coin',
    quantity: 200,
    expiresAt: null,
    data: null
  });
  const purchase = purchaseSettlementEventItem(character, 'exp-coupon', eventDate);
  assert.equal(purchase.quantity, 4);
  assert.throws(
    () => purchaseSettlementEventItem(character, 'exp-coupon', eventDate),
    /오늘 구매 가능한/
  );
});
