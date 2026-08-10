'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MONSTER_CATALOG,
  MONSTER_EXP_MULTIPLIER,
  getElementMultiplier,
  getMonsterRetaliationDamageRange,
  getThrowingStarDropsForMonster,
  getQueenDollFragmentDropsForMonster,
  rollMonsterDrops
} = require('../../src/v2/world/monsterCatalog');
const { WORLD_MAPS } = require('../../src/v2/world/mapDefinitions');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');

test('ordinary monster EXP uses the base 1.0 multiplier', () => {
  assert.equal(MONSTER_EXP_MULTIPLIER, 1);
});

test('every configured map monster resolves to one canonical displayed level', () => {
  const byId = new Map(MONSTER_CATALOG.map((monster) => [monster.id, monster]));
  assert.equal(byId.size, MONSTER_CATALOG.length);
  for (const monster of MONSTER_CATALOG) {
    assert.equal(Number.isInteger(monster.level), true, monster.id);
    assert.ok(monster.level >= 1 && monster.level <= 150, monster.id);
  }
  for (const map of WORLD_MAPS) {
    for (const monsterId of map.monsterIds || []) {
      assert.ok(byId.has(monsterId), `${map.id}: ${monsterId}`);
    }
  }
  assert.equal(byId.get('sales_fox').level, 62);
});

test('Peach Electronics monsters are durable level 130-150 retaliation enemies', () => {
  const monsters = MONSTER_CATALOG.filter((monster) => monster.id.startsWith('peach_'));
  assert.equal(monsters.length, 10);
  assert.ok(monsters.every((monster) => monster.level >= 130 && monster.level <= 150));
  assert.equal(Math.min(...monsters.map((monster) => monster.maxHp)), 200_000);
  assert.equal(Math.max(...monsters.map((monster) => monster.maxHp)), 450_000);
  assert.ok(monsters.every((monster) => monster.physicalDefense >= 150));
  assert.ok(monsters.every((monster) => monster.magicDefense >= 140));
  assert.ok(monsters.every((monster) => ['projectile', 'swing'].includes(monster.counterAttackType)));
});

test('all Peach Electronics monsters drop Queen Doll fragments at level-scaled rare rates', () => {
  const monsters = MONSTER_CATALOG.filter((monster) => monster.id.startsWith('peach_'));
  for (const monster of monsters) {
    const drops = getQueenDollFragmentDropsForMonster(monster.id, monster.level);
    assert.equal(drops.length, 1);
    assert.equal(drops[0].itemId, 'queen_doll_fragment');
    assert.ok(drops[0].chance >= 0.00003 && drops[0].chance <= 0.00009);
    assert.ok(monster.dropTable.misc.some((drop) => drop.itemId === 'queen_doll_fragment'));
  }
  assert.equal(getQueenDollFragmentDropsForMonster('deadline_dragon', 140).length, 0);
  assert.equal(getQueenDollFragmentDropsForMonster('peach_gate_sentry', 130)[0].chance, 0.00003);
  assert.equal(getQueenDollFragmentDropsForMonster('peach_mainframe_guardian', 150)[0].chance, 0.00009);
  const item = getItemDefinition('queen_doll_fragment');
  assert.equal(item.name, '퀸돌 조각');
  assert.equal(item.category, 'misc');
  assert.equal(item.itemType, 'crafting-material');
});

test('level 50+ monsters retaliate with level-scaled damage while lower monsters do not', () => {
  const lowLevel = MONSTER_CATALOG.find((monster) => monster.level < 50);
  const highLevel = MONSTER_CATALOG.find((monster) => monster.level >= 50);
  assert.equal(lowLevel.counterAttackType, '');
  assert.ok(['projectile', 'swing'].includes(highLevel.counterAttackType));
  assert.deepEqual(getMonsterRetaliationDamageRange(49), { minimum: 0, maximum: 0 });
  assert.ok(getMonsterRetaliationDamageRange(150).minimum > getMonsterRetaliationDamageRange(50).maximum);
});

test('four drop-only throwing stars are assigned to monster drop tables', () => {
  const expected = new Map([
    ['server_wisp', ['compressed_badge_star', 17]],
    ['facility_drone', ['circuit_shard_star', 19]],
    ['peach_solder_drone', ['peach_alloy_star', 21]],
    ['peach_mainframe_guardian', ['executive_approval_star', 23]]
  ]);
  for (const [monsterId, [itemId, attackBonus]] of expected) {
    const drops = getThrowingStarDropsForMonster(monsterId);
    assert.ok(drops.some((drop) => drop.itemId === itemId));
    assert.ok(drops.every((drop) => drop.quantity === 600));
    assert.ok(drops.every((drop) => drop.chance === 1 / 12));
    const item = getItemDefinition(itemId);
    assert.equal(item.attackBonus, attackBonus);
    assert.equal(item.ammunitionType, 'throwing-star');
    assert.equal(item.sellPrice, 1);
    assert.deepEqual(item.shopTags, []);
  }
});

test('monster EXP-to-HP ratios vary without extreme adjacent spikes', () => {
  const ratios = MONSTER_CATALOG.map((monster) => monster.expReward / monster.maxHp);
  assert.ok(new Set(ratios.map((ratio) => ratio.toFixed(3))).size > 8);
  for (let index = 1; index < ratios.length; index += 1) {
    const larger = Math.max(ratios[index - 1], ratios[index]);
    const smaller = Math.max(0.0001, Math.min(ratios[index - 1], ratios[index]));
    assert.ok(larger / smaller < 1.7, `ratio spike at catalog index ${index}`);
  }
});

test('most monsters are neutral while selected species have elemental traits', () => {
  const elemental = MONSTER_CATALOG.filter(
    (monster) => Object.keys(monster.elementalMultipliers).length > 0
  );
  assert.ok(elemental.length > 0);
  assert.ok(elemental.length < MONSTER_CATALOG.length);
  const coffee = MONSTER_CATALOG.find((monster) => monster.id === 'coffee_slime');
  assert.equal(getElementMultiplier(coffee, 'fire'), 0.5);
  assert.equal(getElementMultiplier(coffee, 'ice'), 1.5);
  assert.equal(getElementMultiplier(coffee, 'holy'), 1);
});

test('normal monster drops can include equipment and scrolls without event coins replacing them', () => {
  const monster = MONSTER_CATALOG.find((entry) => (
    entry.dropTable?.equipment?.length && entry.dropTable?.scrolls?.length
  ));
  assert.ok(monster);

  const drops = rollMonsterDrops(monster, () => 0);
  assert.ok(drops.some((drop) => drop.kind === 'money'));
  assert.ok(drops.some((drop) => drop.category === 'equipment'));
  assert.ok(drops.some((drop) => drop.category === 'scrolls'));
  assert.equal(drops.some((drop) => drop.itemId === 'settlement_event_coin'), false);
});
