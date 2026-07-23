'use strict';

const { getItemDefinition } = require('../items/itemCatalog');
const { addInventoryItem, buildInventoryView } = require('./inventoryService');

const HUNTING_SUBSCRIPTION_PRODUCT_ID = 'hunting_subscription_30d';
const HUNTING_SUBSCRIPTION_ITEM_ID = 'hunting_time_90m_subscription';
const HUNTING_SUBSCRIPTION_DAYS = 30;
const HUNTING_SUBSCRIPTION_MS = HUNTING_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

const CASH_CHARGE_OPTIONS = Object.freeze([
  Object.freeze({ paymentWon: 3_000, cashPoints: 450 }),
  Object.freeze({ paymentWon: 5_000, cashPoints: 800 }),
  Object.freeze({ paymentWon: 10_000, cashPoints: 1_700 }),
  Object.freeze({ paymentWon: 30_000, cashPoints: 5_200 })
]);

const CASH_SHOP_PRODUCTS = Object.freeze([
  Object.freeze({
    id: HUNTING_SUBSCRIPTION_PRODUCT_ID,
    kind: 'hunting-subscription',
    name: '자동사냥 30일 정액제',
    icon: '📅',
    description: '구매일부터 30일간 매일 첫 접속 시 자동사냥 시간 90분 충전권 1장을 지급합니다.',
    grantLabel: '매일 90분권 · 30일',
    price: 1_500
  }),
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
  if (product.kind === 'hunting-subscription') return { ...product };
  const item = getItemDefinition(product.itemId);
  if (!item) return null;
  return {
    ...product,
    name: item.name,
    icon: item.icon,
    description: item.description
  };
}

function getKoreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function ensureHuntingSubscriptionState(character) {
  if (!character.huntingTime || typeof character.huntingTime !== 'object') {
    character.huntingTime = {};
  }
  character.huntingTime.subscriptionLastGrantDate = String(
    character.huntingTime.subscriptionLastGrantDate || ''
  );
  character.huntingTime.subscriptionGrantCount = Math.max(
    0,
    Math.min(HUNTING_SUBSCRIPTION_DAYS, Math.floor(
      Number(character.huntingTime.subscriptionGrantCount) || 0
    ))
  );
  return character.huntingTime;
}

function getHuntingSubscriptionStatus(character, now = Date.now()) {
  const state = ensureHuntingSubscriptionState(character);
  const expiresAt = state.subscriptionExpiresAt
    ? new Date(state.subscriptionExpiresAt).getTime()
    : 0;
  return {
    active: Number.isFinite(expiresAt) && expiresAt > Number(now),
    expiresAt: expiresAt > 0 ? new Date(expiresAt).toISOString() : null,
    lastGrantDate: state.subscriptionLastGrantDate,
    grantCount: state.subscriptionGrantCount,
    remainingGrantDays: Math.max(0, HUNTING_SUBSCRIPTION_DAYS - state.subscriptionGrantCount)
  };
}

function applyDailyHuntingSubscriptionGrant(character, now = new Date()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const status = getHuntingSubscriptionStatus(character, timestamp);
  const dateKey = getKoreaDateKey(now instanceof Date ? now : new Date(timestamp));
  if (
    !status.active
    || status.lastGrantDate === dateKey
    || status.grantCount >= HUNTING_SUBSCRIPTION_DAYS
  ) {
    return { granted: false, pending: false, ...status };
  }
  try {
    addInventoryItem(character, HUNTING_SUBSCRIPTION_ITEM_ID, 1);
  } catch (error) {
    return { granted: false, pending: true, error: error.message, ...status };
  }
  character.huntingTime.subscriptionLastGrantDate = dateKey;
  character.huntingTime.subscriptionGrantCount += 1;
  if (typeof character.markModified === 'function') {
    character.markModified('huntingTime');
    character.markModified('inventory');
  }
  return {
    granted: true,
    pending: false,
    itemId: HUNTING_SUBSCRIPTION_ITEM_ID,
    ...getHuntingSubscriptionStatus(character, timestamp)
  };
}

function getCashShopView(character) {
  const subscription = getHuntingSubscriptionStatus(character);
  return {
    cashPoints: ensureCashBalance(character),
    chargeOptions: CASH_CHARGE_OPTIONS.map((option) => ({ ...option })),
    products: CASH_SHOP_PRODUCTS.map(serializeCashProduct).filter(Boolean).map((product) => (
      product.kind === 'hunting-subscription'
        ? { ...product, disabled: subscription.active, activeUntil: subscription.expiresAt }
        : product
    )),
    huntingSubscription: subscription
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
  if (product.kind === 'hunting-subscription') {
    const status = getHuntingSubscriptionStatus(character);
    if (status.active) throw new Error('이미 자동사냥 정액제를 이용 중입니다.');
    addInventoryItem(character, HUNTING_SUBSCRIPTION_ITEM_ID, 1);
    const now = new Date();
    const state = ensureHuntingSubscriptionState(character);
    state.subscriptionExpiresAt = new Date(now.getTime() + HUNTING_SUBSCRIPTION_MS);
    state.subscriptionLastGrantDate = getKoreaDateKey(now);
    state.subscriptionGrantCount = 1;
    if (typeof character.markModified === 'function') {
      character.markModified('huntingTime');
      character.markModified('inventory');
    }
  } else {
    addInventoryItem(character, product.itemId, product.quantity);
  }
  character.economy.cashPoints = balance - product.price;
  if (typeof character.markModified === 'function') character.markModified('economy');
  return {
    product: product.kind === 'hunting-subscription'
      ? {
        ...serializeCashProduct(product),
        disabled: true,
        activeUntil: getHuntingSubscriptionStatus(character).expiresAt
      }
      : serializeCashProduct(product),
    cashPoints: character.economy.cashPoints,
    inventory: buildInventoryView(character)
  };
}

module.exports = {
  CASH_CHARGE_OPTIONS,
  CASH_SHOP_PRODUCTS,
  HUNTING_SUBSCRIPTION_PRODUCT_ID,
  HUNTING_SUBSCRIPTION_ITEM_ID,
  getCashShopView,
  grantCashPoints,
  purchaseCashProduct,
  getHuntingSubscriptionStatus,
  applyDailyHuntingSubscriptionGrant
};
