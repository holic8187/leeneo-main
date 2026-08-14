'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');
const { EQUIPMENT_SCROLLS } = require('../../src/v2/items/scrollCatalog');
const {
  LATE_SUMMER_EVENT_END_AT,
  LATE_SUMMER_EVENT_SCROLLS,
  LATE_SUMMER_CHEESE_ITEM_ID,
  LATE_SUMMER_SHAVED_ICE_ITEM_ID,
  WAKPPUBALL_ITEM_ID
} = require('../../src/v2/items/lateSummerEventCatalog');
const {
  WAKPPUBALL_DROP_CHANCE,
  isLateSummerEventActive,
  rollLateSummerEventBall,
  openLateSummerBalls
} = require('../../src/v2/services/lateSummerEventService');

function makeCharacter(level = 65) {
  return {
    progression: { level },
    economy: { money: 0 },
    inventory: {
      items: [],
      slotCapacities: { equipment: 20, consumable: 100, misc: 20, cash: 20 },
      quickSlots: {}
    },
    mailbox: [],
    resources: {},
    loadout: {},
    markModified() {}
  };
}

const eventDate = new Date('2026-08-20T12:00:00+09:00');

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

test('late-summer event runs through September thirteenth', () => {
  assert.equal(LATE_SUMMER_EVENT_END_AT.toISOString(), '2026-09-13T15:00:00.000Z');
  assert.equal(isLateSummerEventActive(new Date('2026-09-13T23:59:59+09:00')), true);
  assert.equal(isLateSummerEventActive(new Date('2026-09-14T00:00:00+09:00')), false);
});

test('eligible monsters drop Wakppuballs at five percent', () => {
  const character = makeCharacter(65);
  assert.equal(WAKPPUBALL_DROP_CHANCE, 0.05);
  assert.ok(rollLateSummerEventBall(character, 62, () => 0.049, eventDate));
  assert.equal(rollLateSummerEventBall(character, 62, () => 0.05, eventDate), null);
  assert.equal(rollLateSummerEventBall(character, 90, () => 0, eventDate), null);
});

test('event scroll pool contains separate tradeable ten and sixty percent copies', () => {
  const expected = EQUIPMENT_SCROLLS.filter((scroll) => [10, 60].includes(scroll.successRate));
  assert.equal(LATE_SUMMER_EVENT_SCROLLS.length, expected.length);
  assert.ok(LATE_SUMMER_EVENT_SCROLLS.every((scroll) => (
    scroll.tradeable === true
    && scroll.fixedExpiresAt
    && [10, 60].includes(scroll.successRate)
    && getItemDefinition(scroll.id)?.eventItem === true
  )));
});

test('event potions can be sold for one won each', () => {
  assert.equal(getItemDefinition(LATE_SUMMER_CHEESE_ITEM_ID).sellPrice, 1);
  assert.equal(getItemDefinition(LATE_SUMMER_SHAVED_ICE_ITEM_ID).sellPrice, 1);
  assert.equal(getItemDefinition(WAKPPUBALL_ITEM_ID).sellPrice, 0);
});

test('opening many Wakppuballs aggregates nothing, scroll, potion, and money results', () => {
  const character = makeCharacter();
  character.inventory.items.push({
    stackId: 'balls', itemId: WAKPPUBALL_ITEM_ID, quantity: 4, expiresAt: null, data: null
  });
  const random = sequenceRandom([
    0.10,
    0.21, 0,
    0.50, 0.10, 0.80,
    0.90, 0
  ]);
  const result = openLateSummerBalls(character, 4, random, eventDate);
  assert.equal(result.opened, 4);
  assert.equal(result.nothingCount, 1);
  assert.equal(result.money, 500);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.some((item) => item.itemId === LATE_SUMMER_EVENT_SCROLLS[0].id && item.quantity === 1));
  assert.ok(result.items.some((item) => item.itemId === 'late_summer_cheese' && item.quantity === 5));
  assert.equal(character.inventory.items.some((item) => item.itemId === WAKPPUBALL_ITEM_ID), false);
});
