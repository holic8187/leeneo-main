'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addInventoryItem,
  assignPotionQuickSlot,
  setPotionAutoThreshold,
  useQuickSlotPotion,
  useConfiguredAutoPotions,
  useInventoryExpansionTicket,
  purgeExpiredEquippedItems,
  buildInventoryView,
  createAdminMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  getMaxStackSize,
  consumeInventoryItem,
  consumeInventoryStack,
  equipInventoryEquipment,
  unequipInventoryEquipment,
  equipInventoryWeapon,
  unequipInventoryWeapon,
  sortInventory
} = require('../../src/v2/services/inventoryService');
const {
  buyShopItem,
  sellInventoryStack,
  rechargeThrowingStarStack
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

test('expired event equipment disappears even while equipped', () => {
  const character = characterFixture();
  character.loadout = {
    ring: {
      itemId: 'settlement_support_ring',
      expiresAt: new Date('2026-08-01T00:00:00+09:00')
    }
  };
  assert.equal(
    purgeExpiredEquippedItems(character, new Date('2026-08-01T00:00:01+09:00').getTime()),
    1
  );
  assert.equal(character.loadout.ring, null);
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

test('consumable boost passives increase fixed potion restoration', () => {
  const character = characterFixture();
  addInventoryItem(character, 'hard_candy', 1);
  assignPotionQuickSlot(character, 'hp', 'hard_candy');
  assert.equal(useQuickSlotPotion(character, 'hp', 150).restored, 75);
  assert.equal(character.resources.currentHp, 95);
});

test('automatic potion thresholds are stored by resource slot', () => {
  const character = characterFixture();
  setPotionAutoThreshold(character, 'hp', 35);
  setPotionAutoThreshold(character, 'mp', 60);
  assert.deepEqual(buildInventoryView(character).autoUsePercent, { hp: 35, mp: 60 });
});

test('configured auto potions use buffed resource caps and handle both slots', () => {
  const character = characterFixture();
  character.resources.currentHp = 80;
  character.resources.currentMp = 30;
  addInventoryItem(character, 'hard_candy', 1);
  addInventoryItem(character, 'bacchus', 1);
  assignPotionQuickSlot(character, 'hp', 'hard_candy');
  assignPotionQuickSlot(character, 'mp', 'bacchus');
  setPotionAutoThreshold(character, 'hp', 50);
  setPotionAutoThreshold(character, 'mp', 50);

  const uses = useConfiguredAutoPotions(
    character,
    100,
    { hp: 200, mp: 100 }
  );

  assert.deepEqual(uses.map((use) => use.slot), ['hp', 'mp']);
  assert.equal(character.resources.currentHp, 130);
  assert.equal(character.resources.currentMp, 100);
  assert.equal(buildInventoryView(character).quickSlots.hp.quantity, 0);
  assert.equal(buildInventoryView(character).quickSlots.mp.quantity, 0);
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

test('inventory sorting merges matching permanent consumables from the top-left', () => {
  const character = characterFixture();
  character.inventory.items = [
    { stackId: 'first', itemId: 'hard_candy', quantity: 68 },
    { stackId: 'other', itemId: 'bacchus', quantity: 2 },
    { stackId: 'second', itemId: 'hard_candy', quantity: 59 },
    { stackId: 'full', itemId: 'hard_candy', quantity: 100 }
  ];

  sortInventory(character);

  const candy = buildInventoryView(character).categories.consumable.items
    .filter((item) => item.id === 'hard_candy');
  assert.deepEqual(candy.map((item) => item.quantity), [100, 100, 27]);
  assert.equal(candy[0].stackId, 'first');
});

test('inventory sorting never merges timed consumables into permanent stacks', () => {
  const character = characterFixture();
  character.inventory.items = [
    { stackId: 'permanent', itemId: 'hard_candy', quantity: 70 },
    {
      stackId: 'timed',
      itemId: 'hard_candy',
      quantity: 40,
      expiresAt: new Date('2026-08-01T00:00:00.000Z')
    }
  ];

  sortInventory(character);

  const coupons = buildInventoryView(character).categories.consumable.items
    .filter((item) => item.id === 'hard_candy');
  assert.deepEqual(coupons.map((item) => item.quantity), [40, 70]);
  assert.ok(coupons[0].expiresAt);
  assert.equal(coupons[1].expiresAt, null);
});

test('quick slots reject potions for the wrong resource', () => {
  const character = characterFixture();
  addInventoryItem(character, 'bacchus', 1);
  assert.throws(() => assignPotionQuickSlot(character, 'hp', 'bacchus'));
});

test('marshmallows can occupy either quick slot and restore HP and MP together', () => {
  const character = characterFixture();
  addInventoryItem(character, 'marshmallow', 2);
  assignPotionQuickSlot(character, 'hp', 'marshmallow');
  assignPotionQuickSlot(character, 'mp', 'marshmallow');

  const used = useQuickSlotPotion(character, 'hp', 100, { hp: 2_000, mp: 1_000 });

  assert.deepEqual(used.restoredByResource, { hp: 1_500, mp: 500 });
  assert.equal(character.resources.currentHp, 1_520);
  assert.equal(character.resources.currentMp, 500);
  assert.equal(used.remaining, 1);
  assert.equal(buildInventoryView(character).quickSlots.mp.id, 'marshmallow');
});

test('elixirs restore both resources by maximum percentage with per-resource caps', () => {
  const character = characterFixture();
  character.resources = { currentHp: 1_000, maxHp: 20_000, currentMp: 2_000, maxMp: 30_000 };
  addInventoryItem(character, 'elixir', 1);
  assignPotionQuickSlot(character, 'hp', 'elixir');
  const elixir = useQuickSlotPotion(character, 'hp');
  assert.deepEqual(elixir.restoredByResource, { hp: 5_000, mp: 5_000 });
  assert.equal(character.resources.currentHp, 6_000);
  assert.equal(character.resources.currentMp, 7_000);

  addInventoryItem(character, 'power_elixir', 1);
  assignPotionQuickSlot(character, 'mp', 'power_elixir');
  const powerElixir = useQuickSlotPotion(character, 'mp');
  assert.deepEqual(powerElixir.restoredByResource, { hp: 10_000, mp: 10_000 });
  assert.equal(character.resources.currentHp, 16_000);
  assert.equal(character.resources.currentMp, 17_000);
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

test('claiming hunting time mail applies it immediately instead of creating a cash stack', () => {
  const character = characterFixture();
  character.huntingTime = { remainingSeconds: 0, enabled: false };
  character.mailbox.push(createAdminMail({
    itemId: 'hunting_time_180m',
    quantity: 1,
    message: '자동사냥 시간'
  }));
  const claimed = claimMail(character, character.mailbox[0].id);
  assert.equal(character.huntingTime.remainingSeconds, 180 * 60);
  assert.equal(buildInventoryView(character).items.some((item) => item.id === 'hunting_time_180m'), false);
  assert.equal(claimed.directEffects[0].appliedDirectly, true);
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

test('an empty throwing-star stack remains in inventory and refills for a flat 4,000 won', () => {
  const character = characterFixture();
  character.economy.money = 10_000;
  addInventoryItem(character, 'crude_throwing_star', 1);
  const stack = buildInventoryView(character).categories.consumable.items[0];
  consumeInventoryStack(character, stack.stackId, 1);
  const empty = buildInventoryView(character).categories.consumable.items[0];
  assert.equal(empty.quantity, 0);
  assert.equal(empty.stackId, stack.stackId);
  const recharge = rechargeThrowingStarStack(character, stack.stackId);
  assert.equal(recharge.quantity, empty.maxStack);
  assert.equal(recharge.rechargeCost, 4_000);
  assert.equal(recharge.money, 6_000);
});

test('an empty arrow stack is removed from inventory', () => {
  const character = characterFixture();
  addInventoryItem(character, 'basic_arrow', 1);
  assert.equal(consumeInventoryItem(character, 'basic_arrow', 1), true);
  const arrows = buildInventoryView(character).categories.consumable.items.filter(
    (item) => item.id === 'basic_arrow'
  );
  assert.equal(arrows.length, 0);
});

test('legacy zero-quantity arrow stacks are purged while zero throwing stars remain', () => {
  const character = characterFixture();
  character.inventory.items.push(
    { stackId: 'empty-arrow', itemId: 'basic_arrow', quantity: 0 },
    { stackId: 'empty-star', itemId: 'crude_throwing_star', quantity: 0 }
  );
  const consumables = buildInventoryView(character).categories.consumable.items;
  assert.equal(consumables.some((item) => item.id === 'basic_arrow'), false);
  assert.equal(consumables.find((item) => item.id === 'crude_throwing_star')?.quantity, 0);
  assert.equal(character.inventory.items.some((item) => item.itemId === 'basic_arrow'), false);
});

test('cash items are marked non-tradeable in inventory responses', () => {
  const character = characterFixture();
  addInventoryItem(character, 'inventory_expansion_ticket', 1);
  const ticket = buildInventoryView(character).categories.cash.items[0];
  assert.equal(ticket.tradeable, false);
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

test('legacy capes with id-only data can be unequipped without item loss', () => {
  const character = characterFixture();
  character.loadout = {
    cape: {
      id: 'legacy_archer_cape_80',
      name: '정산 80제 망토',
      requiredLevel: 80,
      stats: { defense: 29, movementSpeed: 4 }
    }
  };

  const result = unequipInventoryEquipment(character, 'cape');
  assert.equal(result.slot, 'cape');
  assert.equal(character.loadout.cape, null);
  const returned = buildInventoryView(character).categories.equipment.items[0];
  assert.equal(returned.id, 'drop_common_cape_80');
  assert.deepEqual(returned.instanceData.stats, { defense: 29, movementSpeed: 4 });
});

test('equipping a new cape replaces a legacy cape stored under an alias', () => {
  const character = characterFixture();
  character.progression = { level: 100 };
  character.job = { departmentId: 'hr', advancementTier: 3 };
  character.stats = { grit: 100, processingSpeed: 30, workKnowledge: 4, awareness: 4 };
  character.loadout = {
    cape: null,
    cloak: {
      id: 'legacy_archer_cape_80',
      name: '정산 80제 망토',
      requiredLevel: 80,
      stats: { defense: 29, movementSpeed: 4 }
    }
  };
  addInventoryItem(character, 'drop_common_cape_100', 1);
  const newCape = buildInventoryView(character).categories.equipment.items[0];

  const result = equipInventoryEquipment(character, newCape.stackId);
  assert.equal(result.slot, 'cape');
  assert.equal(character.loadout.cape.itemId, 'drop_common_cape_100');
  assert.equal(character.loadout.cloak, null);
  assert.equal(
    buildInventoryView(character).categories.equipment.items[0].id,
    'drop_common_cape_80'
  );
});
