'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CRAFTED_SIDE_JOB_WEAPONS,
  SIDE_JOB_STAT_VARIATION_WEIGHTS,
  rollSideJobStatVariation,
  rollSideJobWeaponInstanceData
} = require('../../src/v2/items/equipmentCatalog');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');
const {
  addInventoryItem,
  getItemQuantity
} = require('../../src/v2/services/inventoryService');
const {
  SIDE_JOB_RECIPES,
  buildSideJobCraftingView,
  craftSideJobWeapon
} = require('../../src/v2/services/sideJobCraftingService');
const {
  buildInventoryView,
  equipInventoryEquipment,
  unequipInventoryEquipment
} = require('../../src/v2/services/inventoryService');

function createCharacter() {
  return {
    progression: { level: 152 },
    inventory: {
      items: [],
      potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '', consumables: ['', '', '', ''] }
    },
    actionPoints: { current: 10, max: 10, lastResetDate: '2099-01-01' },
    economy: { money: 100_000_000 },
    markModified() {}
  };
}

function grantRecipeMaterials(character, recipe) {
  for (const material of recipe.materials) {
    addInventoryItem(character, material.itemId, material.quantity);
  }
}

test('부업 제작 무기 10종은 152레벨 제작 전용 장비다', () => {
  assert.equal(CRAFTED_SIDE_JOB_WEAPONS.length, 10);
  assert.equal(SIDE_JOB_RECIPES.length, 10);
  for (const weapon of CRAFTED_SIDE_JOB_WEAPONS) {
    assert.equal(weapon.requiredLevel, 152);
    assert.equal(weapon.craftOnly, true);
    assert.equal(weapon.maxStack, 1);
  }
});

test('부업 제작 무기 옵션은 0이 절반이고 극단값일수록 희귀하다', () => {
  assert.ok(Math.abs(
    SIDE_JOB_STAT_VARIATION_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0) - 1
  ) < Number.EPSILON * 2);
  assert.equal(SIDE_JOB_STAT_VARIATION_WEIGHTS.find((entry) => entry.variation === 0).weight, 0.5);
  assert.equal(rollSideJobStatVariation(() => 0.49), 0);
  assert.equal(rollSideJobStatVariation(() => 0.965), -5);
  assert.equal(rollSideJobStatVariation(() => 0.999), 5);

  const values = [0.25, 0.99];
  const instanceData = rollSideJobWeaponInstanceData(
    { stats: { attack: 100, accuracy: 20 } },
    () => values.shift()
  );
  assert.deepEqual(instanceData.rolls, { attack: 0, accuracy: 5 });
  assert.deepEqual(instanceData.stats, { attack: 100, accuracy: 25 });
});

test('부업 제작 성공 시 재료와 비용, 행동력을 소모하고 무기를 지급한다', () => {
  const character = createCharacter();
  const recipe = SIDE_JOB_RECIPES[0];
  grantRecipeMaterials(character, recipe);
  const before = buildSideJobCraftingView(character);
  assert.equal(before.recipes[0].canCraft, true);

  const result = craftSideJobWeapon(character, recipe.weaponId, () => 0.5, Date.parse('2099-01-01T12:00:00Z'));
  assert.equal(result.crafted, true);
  assert.equal(character.actionPoints.current, 6);
  assert.equal(character.economy.money, 60_000_000);
  assert.equal(getItemQuantity(character, recipe.weaponId), 1);
  for (const material of recipe.materials) {
    assert.equal(getItemQuantity(character, material.itemId), 0);
  }
  assert.equal(getItemDefinition(recipe.weaponId).name, '구마의 셀린느 클로');
});

test('부업 제작 실패 시에도 재료와 비용, 행동력을 모두 소모한다', () => {
  const character = createCharacter();
  const recipe = SIDE_JOB_RECIPES[1];
  grantRecipeMaterials(character, recipe);
  const result = craftSideJobWeapon(character, recipe.weaponId, () => 0.95, Date.parse('2099-01-01T12:00:00Z'));
  assert.equal(result.crafted, false);
  assert.equal(character.actionPoints.current, 6);
  assert.equal(character.economy.money, 60_000_000);
  assert.equal(getItemQuantity(character, recipe.weaponId), 0);
  for (const material of recipe.materials) {
    assert.equal(getItemQuantity(character, material.itemId), 0);
  }
});

test('부업 제작 무기는 최초 장착 전만 거래 가능하다', () => {
  const character = createCharacter();
  character.job = { departmentId: 'sales', advancementTier: 4 };
  character.stats = { grit: 4, processingSpeed: 999, workKnowledge: 4, awareness: 999 };
  character.loadout = {};
  grantRecipeMaterials(character, SIDE_JOB_RECIPES[0]);
  const result = craftSideJobWeapon(
    character,
    SIDE_JOB_RECIPES[0].weaponId,
    () => 0,
    Date.parse('2099-01-01T12:00:00Z')
  );
  assert.equal(result.crafted, true);
  let weapon = buildInventoryView(character).items.find((item) => item.id === result.weapon.id);
  assert.equal(weapon.bindOnEquip, true);
  assert.equal(weapon.tradeable, true);

  equipInventoryEquipment(character, weapon.stackId);
  assert.equal(character.loadout.weapon.tradeable, false);
  assert.equal(character.loadout.weapon.instanceData.tradeLocked, true);
  unequipInventoryEquipment(character, 'weapon');

  weapon = buildInventoryView(character).items.find((item) => item.id === result.weapon.id);
  assert.equal(weapon.tradeable, false);
  assert.equal(weapon.instanceData.tradeLocked, true);
});
