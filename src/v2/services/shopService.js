'use strict';

const { getItemDefinition, listShopItems } = require('../items/itemCatalog');
const {
  ensureInventory,
  addInventoryItem,
  consumeInventoryStack,
  buildInventoryView
} = require('./inventoryService');

const MAX_TRANSACTION_QUANTITY = 10_000;
const THROWING_STAR_RECHARGE_COST = 4_000;
const SHOP_PRICE_MULTIPLIERS = Object.freeze({
  headquarters: 1,
  personnel_annex: 0.97,
  sales_outpost: 1.04,
  scroll_vendor: 1
});

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

function getRegionalShopItem(itemId, shopId) {
  const item = getItemDefinition(itemId);
  if (
    !item
    || Number(item.buyPrice) <= 0
    || !item.shopTags?.includes(String(shopId || 'headquarters'))
  ) {
    throw new Error('현재 안전지대 상점에서 구매할 수 없는 아이템입니다.');
  }
  const multiplier = SHOP_PRICE_MULTIPLIERS[shopId] || 1;
  return {
    ...item,
    buyPrice: Math.max(1, Math.round(Number(item.buyPrice) * multiplier))
  };
}

function buyShopItem(character, itemId, quantity, shopId = 'headquarters') {
  const item = getRegionalShopItem(itemId, shopId);
  const safeQuantity = normalizeQuantity(quantity);
  const totalPrice = Math.floor(item.buyPrice * safeQuantity);
  const grantedQuantity = safeQuantity * Math.max(1, Math.floor(Number(item.purchaseQuantity) || 1));
  const currentMoney = getMoney(character);
  if (currentMoney < totalPrice) throw new Error('보유한 돈이 부족합니다.');
  addInventoryItem(character, item.id, grantedQuantity);
  setMoney(character, currentMoney - totalPrice);
  return {
    item: { ...item },
    quantity: grantedQuantity,
    purchaseCount: safeQuantity,
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

function rechargeThrowingStarStack(character, stackId) {
  const inventory = ensureInventory(character);
  const stack = inventory.items.find((entry) => String(entry.stackId) === String(stackId));
  if (!stack) throw new Error('충전할 표창을 찾을 수 없습니다.');
  const item = getItemDefinition(stack.itemId);
  if (item?.itemType !== 'ammunition' || item?.ammunitionType !== 'throwing-star') {
    throw new Error('표창 묶음만 충전할 수 있습니다.');
  }
  const maximum = Math.max(1, Math.floor(Number(item.maxStack) || 1));
  const current = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  if (current >= maximum) throw new Error('이미 표창이 가득 충전되어 있습니다.');
  const money = getMoney(character);
  if (money < THROWING_STAR_RECHARGE_COST) throw new Error('표창 충전 비용이 부족합니다.');
  stack.quantity = maximum;
  setMoney(character, money - THROWING_STAR_RECHARGE_COST);
  if (typeof character.markModified === 'function') character.markModified('inventory');
  return {
    item: { ...item },
    stackId: String(stack.stackId),
    previousQuantity: current,
    quantity: maximum,
    rechargeCost: THROWING_STAR_RECHARGE_COST,
    money: getMoney(character),
    inventory: buildInventoryView(character)
  };
}

function buildShopView(character, shopId = 'headquarters') {
  return {
    money: getMoney(character),
    shopId,
    buyItems: listShopItems(shopId).map((item) => getRegionalShopItem(item.id, shopId)),
    inventory: buildInventoryView(character)
  };
}

module.exports = {
  MAX_TRANSACTION_QUANTITY,
  THROWING_STAR_RECHARGE_COST,
  getMoney,
  getRegionalShopItem,
  buyShopItem,
  sellInventoryStack,
  rechargeThrowingStarStack,
  buildShopView
};
