'use strict';

const {
  LATE_SUMMER_EVENT_ID,
  LATE_SUMMER_EVENT_START_AT,
  LATE_SUMMER_EVENT_END_AT,
  WAKPPUBALL_ITEM_ID,
  LATE_SUMMER_CHEESE_ITEM_ID,
  LATE_SUMMER_SHAVED_ICE_ITEM_ID,
  LATE_SUMMER_EVENT_SCROLLS
} = require('../items/lateSummerEventCatalog');
const { getItemDefinition } = require('../items/itemCatalog');
const {
  addInventoryItem,
  consumeInventoryItem,
  ensureInventory,
  getItemQuantity,
  markInventoryModified
} = require('./inventoryService');
const { isEventLevelRangeMonster } = require('./settlementEventService');

const WAKPPUBALL_DROP_CHANCE = 0.05;
const MAX_OPEN_QUANTITY = 1_000;

function isLateSummerEventActive(now = new Date()) {
  const time = new Date(now).getTime();
  return time >= LATE_SUMMER_EVENT_START_AT.getTime()
    && time < LATE_SUMMER_EVENT_END_AT.getTime();
}

function getLateSummerEventView(character, now = new Date()) {
  return {
    id: LATE_SUMMER_EVENT_ID,
    title: '늦여름 야르한 이벤트',
    active: isLateSummerEventActive(now),
    startsAt: LATE_SUMMER_EVENT_START_AT.toISOString(),
    endsAt: LATE_SUMMER_EVENT_END_AT.toISOString(),
    balls: getItemQuantity(character, WAKPPUBALL_ITEM_ID),
    maxOpenQuantity: MAX_OPEN_QUANTITY
  };
}

function rollLateSummerEventBall(character, monsterLevel, random = Math.random, now = new Date()) {
  if (!isLateSummerEventActive(now)) return null;
  const playerLevel = Math.max(1, Number(character.progression?.level) || 1);
  if (!isEventLevelRangeMonster(playerLevel, monsterLevel)) return null;
  if (Number(random()) >= WAKPPUBALL_DROP_CHANCE) return null;
  addInventoryItem(character, WAKPPUBALL_ITEM_ID, 1);
  const item = getItemDefinition(WAKPPUBALL_ITEM_ID);
  return {
    kind: 'item',
    itemId: WAKPPUBALL_ITEM_ID,
    quantity: 1,
    icon: item?.icon || '🏐',
    name: item?.name || '왁뿌볼',
    category: 'misc',
    stored: true,
    eventDrop: true,
    grounded: false
  };
}

function addAggregatedItem(resultMap, itemId, quantity) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!safeQuantity) return;
  resultMap.set(itemId, (resultMap.get(itemId) || 0) + safeQuantity);
}

function rollOpenResults(quantity, random) {
  const items = new Map();
  let money = 0;
  let nothingCount = 0;
  for (let index = 0; index < quantity; index += 1) {
    const roll = Number(random());
    if (roll < 0.2) {
      nothingCount += 1;
      continue;
    }
    if (roll < 0.22) {
      const scrollIndex = Math.min(
        LATE_SUMMER_EVENT_SCROLLS.length - 1,
        Math.floor(Number(random()) * LATE_SUMMER_EVENT_SCROLLS.length)
      );
      addAggregatedItem(items, LATE_SUMMER_EVENT_SCROLLS[scrollIndex].id, 1);
      continue;
    }
    if (roll < 0.8) {
      const potionId = Number(random()) < 0.5
        ? LATE_SUMMER_CHEESE_ITEM_ID
        : LATE_SUMMER_SHAVED_ICE_ITEM_ID;
      addAggregatedItem(items, potionId, 1 + Math.floor(Number(random()) * 5));
      continue;
    }
    money += 500 + Math.floor(Number(random()) * 4_501);
  }
  return { items, money, nothingCount };
}

function cloneInventoryItems(character) {
  const source = character.inventory?.items;
  if (!Array.isArray(source)) return [];
  return source.map((entry) => ({
    stackId: String(entry.stackId || ''),
    itemId: String(entry.itemId || ''),
    quantity: Math.max(0, Math.floor(Number(entry.quantity) || 0)),
    expiresAt: entry.expiresAt || null,
    data: entry.data && typeof entry.data === 'object'
      ? JSON.parse(JSON.stringify(entry.data))
      : null
  }));
}

function openLateSummerBalls(character, requestedQuantity, random = Math.random, now = new Date()) {
  if (!isLateSummerEventActive(now)) throw new Error('늦여름 야르한 이벤트가 종료되었습니다.');
  const owned = getItemQuantity(character, WAKPPUBALL_ITEM_ID);
  const quantity = Math.floor(Number(requestedQuantity) || 0);
  if (quantity < 1) throw new Error('부술 왁뿌볼 개수를 입력해주세요.');
  if (quantity > MAX_OPEN_QUANTITY) {
    throw new Error(`왁뿌볼은 한 번에 최대 ${MAX_OPEN_QUANTITY}개까지 부술 수 있습니다.`);
  }
  if (owned < quantity) throw new Error('보유한 왁뿌볼이 부족합니다.');

  const rolled = rollOpenResults(quantity, random);
  const originalItems = cloneInventoryItems(character);
  const originalMoney = Math.max(0, Number(character.economy?.money) || 0);
  try {
    if (!consumeInventoryItem(character, WAKPPUBALL_ITEM_ID, quantity)) {
      throw new Error('보유한 왁뿌볼이 부족합니다.');
    }
    for (const [itemId, itemQuantity] of rolled.items.entries()) {
      addInventoryItem(character, itemId, itemQuantity);
    }
    if (!character.economy || typeof character.economy !== 'object') character.economy = {};
    character.economy.money = originalMoney + rolled.money;
    character.markModified?.('economy');
  } catch (error) {
    ensureInventory(character).items = originalItems;
    if (!character.economy || typeof character.economy !== 'object') character.economy = {};
    character.economy.money = originalMoney;
    markInventoryModified(character);
    character.markModified?.('economy');
    throw error;
  }

  return {
    opened: quantity,
    nothingCount: rolled.nothingCount,
    money: rolled.money,
    items: [...rolled.items.entries()].map(([itemId, itemQuantity]) => {
      const item = getItemDefinition(itemId);
      return {
        itemId,
        name: item?.name || itemId,
        icon: item?.icon || '📦',
        quantity: itemQuantity
      };
    })
  };
}

module.exports = {
  WAKPPUBALL_DROP_CHANCE,
  MAX_OPEN_QUANTITY,
  isLateSummerEventActive,
  getLateSummerEventView,
  rollLateSummerEventBall,
  openLateSummerBalls
};
