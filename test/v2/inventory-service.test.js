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
  getPendingMail,
  claimMail
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
