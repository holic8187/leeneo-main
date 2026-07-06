'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DROP_RATE_MIN,
  DROP_RATE_MAX,
  EQUIPMENT_ITEMS,
  BOSS_ENDGAME_WEAPONS,
  getEquipmentSellPrice,
  rollEquipmentInstanceData,
  getEquipmentDropsForMonsterLevel
} = require('../../src/v2/items/equipmentCatalog');
const { MONSTER_CATALOG } = require('../../src/v2/world/monsterCatalog');

test('field equipment drops stay inside the requested probability range and near monster level', () => {
  for (const monster of MONSTER_CATALOG) {
    for (const drop of monster.dropTable.equipment) {
      assert.ok(drop.chance >= DROP_RATE_MIN && drop.chance <= DROP_RATE_MAX);
      const item = EQUIPMENT_ITEMS.find((entry) => entry.id === drop.itemId);
      assert.ok(item);
      assert.ok(item.requiredLevel <= monster.level + 2);
      assert.ok(item.requiredLevel >= Math.max(1, monster.level - 14));
    }
  }
});

test('boss endgame weapons never enter the ordinary monster drop pool', () => {
  const ordinaryIds = new Set(
    [3, 31, 73, 108, 140].flatMap((level) => (
      getEquipmentDropsForMonsterLevel(level).map((drop) => drop.itemId)
    ))
  );
  assert.equal(BOSS_ENDGAME_WEAPONS.length, 15);
  assert.equal(BOSS_ENDGAME_WEAPONS.some((item) => ordinaryIds.has(item.id)), false);
  assert.ok(BOSS_ENDGAME_WEAPONS.every((item) => item.requiredLevel === 100));
});

test('undead monsters are distributed from level 25 through 140 and are weak to holy', () => {
  const undead = MONSTER_CATALOG.filter((monster) => monster.undead);
  assert.ok(undead.length >= 4);
  assert.ok(Math.min(...undead.map((monster) => monster.level)) >= 25);
  assert.ok(Math.max(...undead.map((monster) => monster.level)) >= 120);
  assert.ok(undead.every((monster) => monster.elementalMultipliers.holy > 1));
});

test('ordinary monsters mix equipment from at least two job archetypes', () => {
  for (const monster of MONSTER_CATALOG) {
    const archetypes = new Set(monster.dropTable.equipment.map((drop) => drop.archetype));
    assert.ok(archetypes.size >= 2, `${monster.name} only drops ${[...archetypes].join(', ')}`);
  }
});

test('equipment prices stay ordered by slot and endgame weapons reach 400,000 won', () => {
  assert.ok(getEquipmentSellPrice(10, 'weapon') > getEquipmentSellPrice(10, 'top'));
  assert.ok(getEquipmentSellPrice(10, 'top') > getEquipmentSellPrice(10, 'shoes'));
  assert.ok(getEquipmentSellPrice(10, 'shoes') > getEquipmentSellPrice(10, 'necklace'));
  assert.ok(EQUIPMENT_ITEMS.every((item) => Number(item.sellPrice) >= 20_000));
  assert.ok(BOSS_ENDGAME_WEAPONS.every((item) => item.sellPrice === 400_000));
});

test('dropped equipment rolls each numeric stat between minus five and plus five', () => {
  const lowRoll = rollEquipmentInstanceData(
    { stats: { attack: 20, defense: 3 } },
    () => 0
  );
  const highRoll = rollEquipmentInstanceData(
    { stats: { attack: 20, defense: 3 } },
    () => 0.999999
  );
  assert.deepEqual(lowRoll.stats, { attack: 15, defense: 1 });
  assert.deepEqual(lowRoll.rolls, { attack: -5, defense: -5 });
  assert.deepEqual(highRoll.stats, { attack: 25, defense: 8 });
  assert.deepEqual(highRoll.rolls, { attack: 5, defense: 5 });
});
