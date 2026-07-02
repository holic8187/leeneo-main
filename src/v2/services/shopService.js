'use strict';

const { getItemDefinition, listShopItems } = require('../items/itemCatalog');
const {
  ensureInventory,
  addInventoryItem,
  consumeInventoryStack,
  buildInventoryView
} = require('./inventoryService');

const MAX_TRANSACTION_QUANTITY = 10_000;

function getMoney(character) {
  return Math.max(0, Math.floor(Number(character?.economy?.money) || 0));
}

function setMoney(character, amount) {
  if (!character.economy || typeof character.economy !== 'object') character.economy = {};
  character.economy.money = Math.max(0, Math.floor(Number(amount) || 0));
  if (typeof character.markModified === 'function') character.markModified('economy');
}

function normalizeQuantity(quantity) {
  return Math.max(1, Math.min(
    MAX_TRANSACTION_QUANTITY,
    Math.floor(Number(quantity) || 1)
  ));
}

function buyShopItem(character, itemId, quantity) {
  const item = getItemDefinition(itemId);
  if (!item || Number(item.buyPrice) <= 0) throw new Error('상점에서 구매할 수 없는 아이템입니다.');
  const safeQuantity = normalizeQuantity(quantity);
  const totalPrice = Math.floor(item.buyPrice * safeQuantity);
  const currentMoney = getMoney(character);
  if (currentMoney < totalPrice) throw new Error('보유한 돈이 부족합니다.');
  addInventoryItem(character, item.id, safeQuantity);
  setMoney(character, currentMoney - totalPrice);
  return {
    item: { ...item },
    quantity: safeQuantity,
    totalPrice,
    money: getMoney(character),
    inventory: buildInventoryView(character)
  };
}

function sellInventoryStack(character, stackId, quantity) {
  const inventory = ensureInventory(character);
  const stack = inventory.items.find((entry) => String(entry.stackId) === String(stackId));
  if (!stack) throw new Error('판매할 아이템을 찾을 수 없습니다.');
  const item = getItemDefinition(stack.itemId);
  if (!item || Number(item.sellPrice) <= 0) throw new Error('상점에 판매할 수 없는 아이템입니다.');
  const safeQuantity = Math.min(normalizeQuantity(quantity), Number(stack.quantity) || 0);
  const consumed = consumeInventoryStack(character, stackId, safeQuantity);
  if (!consumed?.quantity) throw new Error('판매할 수량이 부족합니다.');
  const totalPrice = Math.floor(item.sellPrice * consumed.quantity);
  setMoney(character, getMoney(character) + totalPrice);
  return {
    item: { ...item },
    quantity: consumed.quantity,
    totalPrice,
    money: getMoney(character),
    inventory: buildInventoryView(character)
  };
}

function buildShopView(character) {
  return {
    money: getMoney(character),
    buyItems: listShopItems(),
    inventory: buildInventoryView(character)
  };
}

module.exports = {
  MAX_TRANSACTION_QUANTITY,
  getMoney,
  buyShopItem,
  sellInventoryStack,
  buildShopView
};
