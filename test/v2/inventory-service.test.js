'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addInventoryItem,
  assignPotionQuickSlot,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  getMaxStackSize
} = require('../../src/v2/services/inventoryService');

function characterFixture() {
  return {
    resources: { currentHp: 20, maxHp: 120, currentMp: 0, maxMp: 80 },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '' }
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
  character.inventory.items = [];
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

  const hp = useQuickSlotPotion(character, 'hp');
  const mp = useQuickSlotPotion(character, 'mp');
  assert.equal(hp.restored, 50);
  assert.equal(character.resources.currentHp, 70);
  assert.equal(mp.restored, 80);
  assert.equal(character.resources.currentMp, 80);
  assert.equal(buildInventoryView(character).quickSlots.hp.quantity, 1);
});

test('potions and cash use items split into stacks of one hundred', () => {
  const character = characterFixture();
  addInventoryItem(character, 'hard_candy', 250);
  addInventoryItem(character, 'inventory_expansion_ticket', 205);
  const view = buildInventoryView(character);
  assert.deepEqual(
    view.categories.consumable.items.map((item) => item.quantity),
    [100, 100, 50]
  );
  assert.deepEqual(
    view.categories.cash.items.map((item) => item.quantity),
    [100, 100, 5]
  );
  assert.equal(view.categories.consumable.usedSlots, 3);
  assert.equal(getMaxStackSize({ category: 'equipment' }), 1);
});

test('item consumption starts from the uppermost inventory stack', () => {
  const character = characterFixture();
  character.inventory.items = [
    { stackId: 'top', itemId: 'hard_candy', quantity: 1 },
    { stackId: 'bottom', itemId: 'hard_candy', quantity: 4 }
  ];
  assignPotionQuickSlot(character, 'hp', 'hard_candy');
  useQuickSlotPotion(character, 'hp');
  assert.equal(character.inventory.items.length, 1);
  assert.equal(character.inventory.items[0].stackId, 'bottom');
  assert.equal(character.inventory.items[0].quantity, 4);
});

test('quick slots reject potions for the wrong resource', () => {
  const character = characterFixture();
  addInventoryItem(character, 'bacchus', 1);
  assert.throws(
    () => assignPotionQuickSlot(character, 'hp', 'bacchus'),
    /체력 포션/
  );
});

test('an expansion ticket adds four slots to the chosen tab and stops at sixty-four', () => {
  const character = characterFixture();
  addInventoryItem(character, 'inventory_expansion_ticket', 12);
  const first = useInventoryExpansionTicket(character, 'equipment');
  assert.equal(first.previousCapacity, 20);
  assert.equal(first.capacity, 24);
  for (let index = 0; index < 10; index += 1) {
    useInventoryExpansionTicket(character, 'equipment');
  }
  assert.equal(buildInventoryView(character).categories.equipment.capacity, 64);
  assert.throws(
    () => useInventoryExpansionTicket(character, 'equipment'),
    /최대 64칸/
  );
});

test('claiming admin mail transfers its attachment once', () => {
  const character = characterFixture();
  character.mailbox.push(createAdminMail({
    itemId: 'inventory_expansion_ticket',
    quantity: 7,
    message: '테스트 선물'
  }));
  const mailId = character.mailbox[0].id;
  claimMail(character, mailId);
  assert.equal(getPendingMail(character).length, 0);
  assert.equal(buildInventoryView(character).categories.cash.items[0].quantity, 7);
  assert.throws(() => claimMail(character, mailId), /찾을 수 없습니다/);
});

test('unclaimed admin mail disappears after twenty-four hours', () => {
  const character = characterFixture();
  const mail = createAdminMail({
    itemId: 'hard_candy',
    quantity: 1,
    message: '만료 테스트'
  });
  mail.createdAt = new Date('2026-01-01T00:00:00.000Z');
  mail.expiresAt = new Date('2026-01-02T00:00:00.000Z');
  character.mailbox.push(mail);
  const removed = purgeExpiredMail(character, new Date('2026-01-02T00:00:00.001Z').getTime());
  assert.equal(removed, 1);
  assert.equal(getPendingMail(character).length, 0);
  assert.equal(character.mailbox.length, 0);
});
