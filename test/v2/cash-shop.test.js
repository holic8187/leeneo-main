'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CASH_CHARGE_OPTIONS,
  getCashShopView,
  grantCashPoints,
  purchaseCashProduct,
  applyDailyHuntingSubscriptionGrant
} = require('../../src/v2/services/cashShopService');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');

function characterFixture() {
  return {
    economy: { money: 0, cashPoints: 0, stockPortfolio: [] },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', autoHpPercent: 0, autoMpPercent: 0 }
    },
    huntingTime: {
      subscriptionExpiresAt: null,
      subscriptionLastGrantDate: '',
      subscriptionGrantCount: 0
    },
    markModified() {}
  };
}

test('cash charge menu exposes only the four requested payment packages', () => {
  assert.deepEqual(CASH_CHARGE_OPTIONS.map((entry) => [entry.paymentWon, entry.cashPoints]), [
    [3000, 450], [5000, 800], [10000, 1700], [30000, 5200]
  ]);
});

test('legacy exchange coupon is a one-use cash item worth one hundred points', () => {
  const coupon = getItemDefinition('legacy_exchange_coupon');
  assert.equal(coupon.itemType, 'cash-point');
  assert.equal(coupon.cashPoints, 100);
  assert.equal(coupon.tradeable, false);
});

test('cash purchases deduct points and add the configured product quantity', () => {
  const character = characterFixture();
  grantCashPoints(character, 800);
  const purchase = purchaseCashProduct(character, 'hot_six_10');
  assert.equal(purchase.cashPoints, 450);
  assert.equal(purchase.inventory.items.find((item) => item.id === 'hot_six')?.quantity, 10);
  const view = getCashShopView(character);
  assert.equal(view.cashPoints, 450);
  assert.deepEqual(
    view.products.map((item) => item.price),
    [1500, 500, 700, 350, 300, 700, 700, 200]
  );
});

test('cash shop sells stat and skill reset coupons for seven hundred points each', () => {
  const character = characterFixture();
  grantCashPoints(character, 1_400);

  purchaseCashProduct(character, 'stat_reset_coupon');
  const purchase = purchaseCashProduct(character, 'skill_reset_coupon');

  assert.equal(purchase.cashPoints, 0);
  assert.equal(
    purchase.inventory.items.find((item) => item.id === 'stat_reset_coupon')?.quantity,
    1
  );
  assert.equal(
    purchase.inventory.items.find((item) => item.id === 'skill_reset_coupon')?.quantity,
    1
  );
});

test('cash shop sells one non-usable Gyeo manager blood for two hundred points', () => {
  const character = characterFixture();
  grantCashPoints(character, 200);

  const purchase = purchaseCashProduct(character, 'gyeo_manager_blood');
  const item = getItemDefinition('gyeo_manager_blood');

  assert.equal(purchase.cashPoints, 0);
  assert.equal(
    purchase.inventory.items.find((entry) => entry.id === item.id)?.quantity,
    1
  );
  assert.equal(item.itemType, 'death-exp-protection');
  assert.equal(item.maxStack, 10);
  assert.equal(item.tradeable, false);
  assert.equal(item.marketable, false);
  assert.equal(item.adminGrantOnly, true);
});

test('auto-hunting subscription grants one 90-minute item per Korean calendar day', () => {
  const character = characterFixture();
  grantCashPoints(character, 3_000);
  const purchase = purchaseCashProduct(character, 'hunting_subscription_30d');
  assert.equal(purchase.cashPoints, 1_500);
  assert.equal(
    purchase.inventory.items.find((item) => item.id === 'hunting_time_90m_subscription')?.quantity,
    1
  );
  assert.throws(
    () => purchaseCashProduct(character, 'hunting_subscription_30d'),
    /이용 중/
  );

  const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
  assert.equal(applyDailyHuntingSubscriptionGrant(character, tomorrow).granted, true);
  assert.equal(applyDailyHuntingSubscriptionGrant(character, tomorrow).granted, false);
  assert.equal(
    getCashShopView(character).products.find(
      (item) => item.id === 'hunting_subscription_30d'
    )?.disabled,
    true
  );
  assert.equal(
    character.inventory.items.find(
      (item) => item.itemId === 'hunting_time_90m_subscription'
    )?.quantity,
    2
  );
});
