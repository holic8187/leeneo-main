'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addInventoryItem,
  assignPotionQuickSlot,
  setPotionAutoThreshold,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  getMaxStackSize,
  equipInventoryWeapon,
  unequipInventoryWeapon
} = require('../../src/v2/services/inventoryService');
const {
  buyShopItem,
  sellInventoryStack
} = require('../../src/v2/services/shopService');

function characterFixture() {
  return {
    resources: { currentHp: 20, maxHp: 120, currentMp: 0, maxMp: 80 },
    economy: { money: 1_000, stockPortfolio: [] },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', autoHpPercent: 0, autoMpPercent: 0 }
    },
    mailbox: []
  };
}

test('all four inventory categories start at twenty slots', () => {
  const view = buildInventoryView(characterFixture());
  assert.deepEqual(
    Object.fromEntries(Object.entries(view.categories).map(([key, value]) => [key, value.capacity])),
    { equipment: 20, consumable: 20, misc: 20, cash: 20 }
  );
});

test('legacy potion stacks migrate into the consumable inventory', () => {
  const character = characterFixture();
  character.inventory.potions = [{ itemId: 'hard_candy', quantity: 3 }];
  const view = buildInventoryView(character);
  assert.equal(view.categories.consumable.items[0].id, 'hard_candy');
  assert.equal(view.categories.consumable.items[0].quantity, 3);
  assert.equal(character.inventory.potions.length, 0);
});

test('hard candy restores 50 HP and bacchus restores 80 MP without exceeding maximums', () => {
  const character = characterFixture();
  addInventoryItem(character, 'hard_candy', 2);
  addInventoryItem(character, 'bacchus', 1);
  assignPotionQuickSlot(character, 'hp', 'hard_candy');
  assignPotionQuickSlot(character, 'mp', 'bacchus');
  assert.equal(useQuickSlotPotion(character, 'hp').restored, 50);
  assert.equal(character.resources.currentHp, 70);
  assert.equal(useQuickSlotPotion(character, 'mp').restored, 80);
  assert.equal(character.resources.currentMp, 80);
});

test('automatic potion thresholds are stored by resource slot', () => {
  const character = characterFixture();
  setPotionAutoThreshold(character, 'hp', 35);
  setPotionAutoThreshold(character, 'mp', 60);
  assert.deepEqual(buildInventoryView(character).autoUsePercent, { hp: 35, mp: 60 });
});

test('potions and cash use items split into stacks of one hundred', () => {
  const character = characterFixture();
  addInventoryItem(character, 'hard_candy', 250);
  addInventoryItem(character, 'inventory_expansion_ticket', 205);
  const view = buildInventoryView(character);
  assert.deepEqual(view.categories.consumable.items.map((item) => item.quantity), [100, 100, 50]);
  assert.deepEqual(view.categories.cash.items.map((item) => item.quantity), [100, 100, 5]);
  assert.equal(getMaxStackSize({ category: 'equipment' }), 1);
});

test('quick slots reject potions for the wrong resource', () => {
  const character = characterFixture();
  addInventoryItem(character, 'bacchus', 1);
  assert.throws(() => assignPotionQuickSlot(character, 'hp', 'bacchus'));
});

test('an expansion ticket adds four slots to the chosen tab and stops at sixty-four', () => {
  const character = characterFixture();
  addInventoryItem(character, 'inventory_expansion_ticket', 12);
  assert.equal(useInventoryExpansionTicket(character, 'equipment').capacity, 24);
  for (let index = 0; index < 10; index += 1) {
    useInventoryExpansionTicket(character, 'equipment');
  }
  assert.equal(buildInventoryView(character).categories.equipment.capacity, 64);
});

test('claiming admin mail transfers its attachment once', () => {
  const character = characterFixture();
  character.mailbox.push(createAdminMail({
    itemId: 'inventory_expansion_ticket',
    quantity: 7,
    message: '테스트 선물'
  }));
  claimMail(character, character.mailbox[0].id);
  assert.equal(getPendingMail(character).length, 0);
  assert.equal(buildInventoryView(character).categories.cash.items[0].quantity, 7);
});

test('unclaimed admin mail disappears after twenty-four hours', () => {
  const character = characterFixture();
  const mail = createAdminMail({ itemId: 'hard_candy', quantity: 1 });
  mail.createdAt = new Date('2026-01-01T00:00:00.000Z');
  mail.expiresAt = new Date('2026-01-02T00:00:00.000Z');
  character.mailbox.push(mail);
  assert.equal(purgeExpiredMail(character, new Date('2026-01-02T00:00:00.001Z').getTime()), 1);
});

test('shop purchases and sales update money and inventory atomically', () => {
  const character = characterFixture();
  const purchase = buyShopItem(character, 'hard_candy', 2);
  assert.equal(purchase.totalPrice, 100);
  assert.equal(purchase.money, 900);
  const stack = purchase.inventory.categories.consumable.items[0];
  const sale = sellInventoryStack(character, stack.stackId, 1);
  assert.equal(sale.totalPrice, 25);
  assert.equal(sale.money, 925);
  assert.equal(sale.inventory.categories.consumable.items[0].quantity, 1);
});

test('regional shops vary prices within five percent and sell ammunition bundles', () => {
  const personnel = characterFixture();
  personnel.economy.money = 10_000;
  const arrowBundle = buyShopItem(personnel, 'basic_arrow', 1, 'personnel_annex');
  assert.equal(arrowBundle.quantity, 400);
  assert.equal(arrowBundle.totalPrice, 2910);

  const sales = characterFixture();
  sales.economy.money = 10_000;
  const returnScroll = buyShopItem(sales, 'safe_zone_return_scroll', 1, 'sales_outpost');
  assert.equal(returnScroll.quantity, 1);
  assert.equal(returnScroll.totalPrice, 832);
});

test('existing job change tickets receive a seventy-two hour expiry', () => {
  const character = characterFixture();
  character.inventory.items.push({
    stackId: 'legacy-ticket',
    itemId: 'job_change_ticket',
    quantity: 1
  });
  const view = buildInventoryView(character);
  const ticket = view.categories.cash.items[0];
  assert.ok(ticket.expiresAt);
  const remaining = new Date(ticket.expiresAt).getTime() - Date.now();
  assert.ok(remaining > 71 * 60 * 60 * 1000);
  assert.ok(remaining <= 72 * 60 * 60 * 1000);
});

test('admin event weapons occupy one slot and can be equipped and returned', () => {
  const character = characterFixture();
  character.progression = { level: 30 };
  character.job = { departmentId: 'hr', advancementTier: 2 };
  character.stats = { grit: 40, processingSpeed: 15, workKnowledge: 4, awareness: 4 };
  character.loadout = { weapon: null };
  addInventoryItem(character, 'event_spear', 1);
  const stack = buildInventoryView(character).categories.equipment.items[0];
  const equipped = equipInventoryWeapon(character, stack.stackId);
  assert.equal(equipped.equipped.weaponType, 'spear');
  assert.equal(equipped.equipped.stats.attack, 20);
  assert.equal(equipped.equipped.attackSpeedMultiplier, 0.6);
  assert.equal(buildInventoryView(character).categories.equipment.items.length, 0);
  unequipInventoryWeapon(character);
  assert.equal(character.loadout.weapon, null);
  assert.equal(buildInventoryView(character).categories.equipment.items[0].id, 'event_spear');
});
