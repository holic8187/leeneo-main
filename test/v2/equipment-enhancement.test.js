'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');
const {
  EQUIPMENT_SCROLLS,
  getScrollDropChanceForMonsterLevel
} = require('../../src/v2/items/scrollCatalog');
const {
  enhanceEquippedItem,
  normalizeEnhancement
} = require('../../src/v2/services/equipmentEnhancementService');

function makeCharacter(scrollId) {
  const weapon = getItemDefinition('drop_oneHandedSword_10');
  return {
    loadout: {
      weapon: {
        ...weapon,
        itemId: weapon.id,
        stats: { ...weapon.stats },
        instanceData: { stats: { ...weapon.stats } }
      }
    },
    inventory: {
      items: [{
        stackId: 'scroll-stack',
        itemId: scrollId,
        quantity: 2,
        expiresAt: null,
        data: null
      }],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: {}
    },
    mailbox: [],
    resources: {},
    markModified() {}
  };
}

test('every scroll drops from at least two obtainable monsters at a level-scaled rate', () => {
  const { MONSTER_CATALOG } = require('../../src/v2/world/monsterCatalog');
  const sourcesByScroll = new Map(EQUIPMENT_SCROLLS.map((scroll) => [scroll.id, new Set()]));
  for (const monster of MONSTER_CATALOG) {
    assert.ok(monster.dropTable.scrolls.length >= 1);
    for (const drop of monster.dropTable.scrolls) {
      assert.equal(drop.chance, getScrollDropChanceForMonsterLevel(monster.level));
      assert.ok(getItemDefinition(drop.itemId));
      if (monster.id !== 'executive_lion') sourcesByScroll.get(drop.itemId).add(monster.id);
    }
  }
  for (const scroll of EQUIPMENT_SCROLLS) {
    assert.ok(
      sourcesByScroll.get(scroll.id).size >= 2,
      `${scroll.name} must have at least two obtainable monster sources`
    );
  }
});

test('scroll drop rates rise with monster level without leaving the previous rate band', () => {
  const lowLevelChance = getScrollDropChanceForMonsterLevel(1);
  const midLevelChance = getScrollDropChanceForMonsterLevel(75);
  const highLevelChance = getScrollDropChanceForMonsterLevel(150);
  const epsilon = 1e-10;
  assert.ok(lowLevelChance < midLevelChance);
  assert.ok(midLevelChance < highLevelChance);
  assert.ok(lowLevelChance + epsilon >= 0.00002 * 2 / 3);
  assert.ok(highLevelChance - epsilon <= 0.00008 * 2 / 3);
});

test('a successful scroll permanently updates equipped stats and enhancement history', () => {
  const scroll = EQUIPMENT_SCROLLS.find(
    (entry) => entry.applicableWeaponType === 'oneHandedSword'
      && entry.successRate === 10
      && entry.scrollStats.attack === 5
  );
  const character = makeCharacter(scroll.id);
  const beforeAttack = character.loadout.weapon.stats.attack;
  const result = enhanceEquippedItem(character, 'weapon', 'scroll-stack', () => 0);

  assert.equal(result.success, true);
  assert.equal(character.loadout.weapon.stats.attack, beforeAttack + 5);
  assert.equal(character.loadout.weapon.stats.grit, 3);
  assert.equal(result.enhancement.level, 1);
  assert.equal(result.enhancement.remaining, 6);
  assert.equal(character.inventory.items[0].quantity, 1);
  assert.match(result.message, /신비로운 힘이 그대로/);
});

test('a failed scroll consumes the scroll and one upgrade slot without adding stats', () => {
  const scroll = EQUIPMENT_SCROLLS.find(
    (entry) => entry.successRate === 10 && entry.applicableWeaponType === 'oneHandedSword'
  );
  const character = makeCharacter(scroll.id);
  const before = { ...character.loadout.weapon.stats };
  const result = enhanceEquippedItem(character, 'weapon', 'scroll-stack', () => 0.99);

  assert.equal(result.success, false);
  assert.deepEqual(character.loadout.weapon.stats, before);
  assert.equal(result.enhancement.level, 0);
  assert.equal(result.enhancement.remaining, 6);
  assert.equal(normalizeEnhancement(character.loadout.weapon).history.length, 1);
  assert.match(result.message, /아무런 변화도 일어나지 않았습니다/);
});

test('Hoi tax invoice preserves one upgrade slot when a scroll fails', () => {
  const scroll = EQUIPMENT_SCROLLS.find(
    (entry) => entry.successRate === 10 && entry.applicableWeaponType === 'oneHandedSword'
  );
  const character = makeCharacter(scroll.id);
  const result = enhanceEquippedItem(
    character,
    'weapon',
    'scroll-stack',
    () => 0.99,
    { preserveUpgradeOnFailure: true }
  );

  assert.equal(result.success, false);
  assert.equal(result.preservedUpgradeSlot, true);
  assert.equal(result.enhancement.remaining, 7);
  assert.equal(character.inventory.items[0].quantity, 1);
  assert.equal(
    normalizeEnhancement(character.loadout.weapon).history[0].preservedUpgradeSlot,
    true
  );
});

test('upgrade slot defaults match equipment categories', () => {
  assert.equal(getItemDefinition('drop_oneHandedSword_10').upgradeSlots, 7);
  assert.equal(getItemDefinition('drop_warrior_helmet_20').upgradeSlots, 10);
  assert.equal(getItemDefinition('drop_warrior_gloves_20').upgradeSlots, 5);
  assert.equal(getItemDefinition('drop_common_cape_20').upgradeSlots, 5);
  assert.equal(getItemDefinition('drop_common_earrings_20').upgradeSlots, 5);
  assert.equal(getItemDefinition('blessed_settlement_necklace').upgradeSlots, 3);
});
