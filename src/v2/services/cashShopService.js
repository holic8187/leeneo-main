'use strict';

const { getItemDefinition } = require('../items/itemCatalog');
const { addInventoryItem, buildInventoryView } = require('./inventoryService');

const CASH_CHARGE_OPTIONS = Object.freeze([
  Object.freeze({ paymentWon: 3_000, cashPoints: 450 }),
  Object.freeze({ paymentWon: 5_000, cashPoints: 800 }),
  Object.freeze({ paymentWon: 10_000, cashPoints: 1_700 }),
  Object.freeze({ paymentWon: 30_000, cashPoints: 5_200 })
]);

const CASH_SHOP_PRODUCTS = Object.freeze([
  Object.freeze({
    id: 'hunting_time_180m',
    itemId: 'hunting_time_180m',
    quantity: 1,
    price: 500
  }),
  Object.freeze({
    id: 'hunting_capacity_40m',
    itemId: 'hunting_capacity_40m',
    quantity: 1,
    price: 700
  }),
  Object.freeze({
    id: 'hot_six_10',
    itemId: 'hot_six',
    quantity: 10,
    price: 350
  }),
  Object.freeze({
    id: 'inventory_expansion_ticket',
    itemId: 'inventory_expansion_ticket',
    quantity: 1,
    price: 300
  })
]);

function ensureCashBalance(character) {
  if (!character.economy || typeof character.economy !== 'object') character.economy = {};
  character.economy.cashPoints = Math.max(
    0,
    Math.floor(Number(character.economy.cashPoints) || 0)
  );
  return character.economy.cashPoints;
}

function serializeCashProduct(product) {
  const item = getItemDefinition(product.itemId);
  if (!item) return null;
  return {
    ...product,
    name: item.name,
    icon: item.icon,
    description: item.description
  };
}

function getCashShopView(character) {
  return {
    cashPoints: ensureCashBalance(character),
    chargeOptions: CASH_CHARGE_OPTIONS.map((option) => ({ ...option })),
    products: CASH_SHOP_PRODUCTS.map(serializeCashProduct).filter(Boolean)
  };
}

function grantCashPoints(character, points) {
  const safePoints = Math.max(0, Math.floor(Number(points) || 0));
  const before = ensureCashBalance(character);
  character.economy.cashPoints = before + safePoints;
  if (typeof character.markModified === 'function') character.markModified('economy');
  return {
    granted: safePoints,
    cashPoints: character.economy.cashPoints
  };
}

function purchaseCashProduct(character, productId) {
  const product = CASH_SHOP_PRODUCTS.find((entry) => entry.id === String(productId || ''));
  if (!product) throw new Error('판매 중인 캐시 상품을 찾을 수 없습니다.');
  const balance = ensureCashBalance(character);
  if (balance < product.price) throw new Error('캐시가 부족합니다.');
  addInventoryItem(character, product.itemId, product.quantity);
  character.economy.cashPoints = balance - product.price;
  if (typeof character.markModified === 'function') character.markModified('economy');
  return {
    product: serializeCashProduct(product),
    cashPoints: character.economy.cashPoints,
    inventory: buildInventoryView(character)
  };
}

module.exports = {
  CASH_CHARGE_OPTIONS,
  CASH_SHOP_PRODUCTS,
  getCashShopView,
  grantCashPoints,
  purchaseCashProduct
};
