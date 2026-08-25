'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { hasStorageNpc } = require('../../src/v2/world/mapDefinitions');
const { addInventoryItem } = require('../../src/v2/services/inventoryService');
const {
  ensureStorage,
  depositStorageItem,
  withdrawStorageItem,
  buildStorageView
} = require('../../src/v2/services/storageService');

function createCharacter() {
  return {
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', consumables: ['', '', '', ''] }
    },
    storage: { items: [], capacity: 4 },
    markModified() {}
  };
}

test('창고는 상점이 있는 안전지대에만 배치된다', () => {
  assert.equal(hasStorageNpc('main_lobby'), true);
  assert.equal(hasStorageNpc('hr_reception'), true);
  assert.equal(hasStorageNpc('peach_electronics_lobby'), true);
  assert.equal(hasStorageNpc('company_bus_stop'), false);
  assert.equal(hasStorageNpc('peach_bus_stop'), false);
  assert.equal(hasStorageNpc('newcomer_training'), false);
});

test('기존 유저는 창고 4칸을 기본으로 받는다', () => {
  const character = createCharacter();
  delete character.storage;
  const storage = ensureStorage(character);
  assert.equal(storage.capacity, 4);
  assert.deepEqual(storage.items, []);
});

test('창고 보관과 찾기는 장비 랜덤 옵션을 보존한다', () => {
  const character = createCharacter();
  const instanceData = { stats: { attack: 123, grit: 14 }, rolls: { attack: 3, grit: 2 } };
  addInventoryItem(character, 'crafted_mond_parental_sword', 1, instanceData);
  const inventoryStackId = character.inventory.items[0].stackId;

  depositStorageItem(character, inventoryStackId, 1);
  assert.equal(character.inventory.items.length, 0);
  const view = buildStorageView(character);
  assert.equal(view.capacity, 4);
  assert.equal(view.usedSlots, 1);
  assert.deepEqual(view.items[0].stats, instanceData.stats);

  withdrawStorageItem(character, view.items[0].stackId, 1);
  assert.equal(buildStorageView(character).usedSlots, 0);
  assert.deepEqual(character.inventory.items[0].data.stats, instanceData.stats);
});

test('창고가 4칸 가득 차면 새 종류를 더 보관할 수 없다', () => {
  const character = createCharacter();
  const itemIds = [
    'queen_doll_fragment',
    'gammam_broken_potato_leg',
    'kim_manager_hair',
    'monster_loot_server_wisp',
    'monster_loot_prototype_golem'
  ];
  for (const itemId of itemIds) addInventoryItem(character, itemId, 1);
  for (const stack of [...character.inventory.items].slice(0, 4)) {
    depositStorageItem(character, stack.stackId, 1);
  }
  assert.throws(
    () => depositStorageItem(character, character.inventory.items[0].stackId, 1),
    /창고가 가득/
  );
});
