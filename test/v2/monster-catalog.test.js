'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MONSTER_CATALOG,
  getElementMultiplier,
  rollMonsterDrops
} = require('../../src/v2/world/monsterCatalog');

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
