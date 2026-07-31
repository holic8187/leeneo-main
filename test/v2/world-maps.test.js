'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  START_MAP_ID,
  WORLD_MAPS,
  getWorldMap,
  findNearestSafeMap,
  findNearestReturnMap
} = require('../../src/v2/world/mapDefinitions');

test('world contains forty-two visible company maps and two hidden field-boss maps', () => {
  const visibleMaps = WORLD_MAPS.filter((map) => !map.hidden);
  const hiddenMaps = WORLD_MAPS.filter((map) => map.hidden);
  assert.equal(WORLD_MAPS.length, 44);
  assert.equal(visibleMaps.length, 42);
  assert.equal(hiddenMaps.length, 2);
  assert.deepEqual(hiddenMaps.map((map) => map.fieldBossId).sort(), [
    'gammam_neo',
    'mad_hwang_manager'
  ]);
  assert.equal(new Set(WORLD_MAPS.map((map) => map.id)).size, 44);
  assert.equal(new Set(WORLD_MAPS.map((map) => map.name)).size, 44);
  assert.equal(getWorldMap(START_MAP_ID).name, '호이상사 중앙로비');
  assert.equal(getWorldMap(START_MAP_ID).safeZone, true);
  assert.ok(
    getWorldMap('overtime_depths').connections.some(
      (connection) => connection.targetId === 'hidden_hwang_overtime'
    )
  );
  assert.ok(
    getWorldMap('sales_fox_den').connections.some(
      (connection) => connection.targetId === 'hidden_hwang_sales'
    )
  );
  assert.equal(getWorldMap('hidden_hwang_overtime').fieldBossId, 'gammam_neo');
  assert.equal(getWorldMap('hidden_hwang_sales').fieldBossId, 'mad_hwang_manager');
});

test('the nearest safe zone can be found through the map graph', () => {
  assert.equal(findNearestSafeMap('main_lobby').id, 'main_lobby');
  assert.equal(findNearestSafeMap('newcomer_training').id, 'main_lobby');
  assert.equal(findNearestSafeMap('data_center').id, 'sales_floor');
});

test('return scroll destinations exclude the company bus stop', () => {
  assert.equal(findNearestSafeMap('company_bus_stop').id, 'company_bus_stop');
  assert.notEqual(findNearestReturnMap('company_bus_stop').id, 'company_bus_stop');
  assert.notEqual(findNearestReturnMap('frozen_dispatch_yard').id, 'company_bus_stop');
  assert.equal(findNearestReturnMap('frozen_dispatch_yard').safeZone, true);
});

test('three regional safe zones expose their own supply shop', () => {
  const safeMaps = WORLD_MAPS.filter((map) => map.safeZone);
  assert.deepEqual(
    safeMaps.map((map) => map.shopId).filter(Boolean).sort(),
    ['headquarters', 'personnel_annex', 'sales_outpost']
  );
  assert.equal(getWorldMap('company_bus_stop').safeZone, true);
});

test('all map connections are valid and bidirectional', () => {
  const byId = new Map(WORLD_MAPS.map((map) => [map.id, map]));
  for (const map of WORLD_MAPS) {
    assert.ok(map.connections.length >= 1, `${map.id} has no portal`);
    for (const connection of map.connections) {
      const target = byId.get(connection.targetId);
      assert.ok(target, `${connection.targetId} does not exist`);
      assert.ok(
        target.connections.some((reverse) => reverse.targetId === map.id),
        `${map.id} -> ${target.id} is not bidirectional`
      );
    }
  }
});

test('every map is reachable from the main lobby', () => {
  const visited = new Set([START_MAP_ID]);
  const queue = [START_MAP_ID];
  while (queue.length) {
    const current = getWorldMap(queue.shift());
    for (const connection of current.connections) {
      if (visited.has(connection.targetId)) continue;
      visited.add(connection.targetId);
      queue.push(connection.targetId);
    }
  }
  assert.equal(visited.size, WORLD_MAPS.length);
});

test('department-themed regions are represented in the world', () => {
  const names = WORLD_MAPS.map((map) => map.name).join(' ');
  for (const keyword of ['인사', '회계', '영업', '브랜드', '개발', '연구', '현장직', '시설관리', '품질검사']) {
    assert.match(names, new RegExp(keyword));
  }
});

test('maps expose varied multi-platform layouts with explicit spawn rules', () => {
  const widths = WORLD_MAPS.map((map) => Number(map.layout.worldWidth));
  const layouts = new Set(WORLD_MAPS.map((map) => map.layout.id));
  assert.ok(Math.min(...widths) <= 920);
  assert.ok(Math.max(...widths) >= 2_000);
  assert.ok(layouts.has('tiny'));
  assert.ok(layouts.has('tower'));
  assert.ok(layouts.has('sprawling'));
  const expectedCaps = {
    tiny: 15,
    compact: 21,
    wide: 32,
    tower: 36,
    sprawling: 47
  };
  for (const [layoutId, maxMonsters] of Object.entries(expectedCaps)) {
    assert.ok(WORLD_MAPS
      .filter((map) => map.layout.id === layoutId)
      .every((map) => map.layout.maxMonsters === maxMonsters));
  }

  for (const map of WORLD_MAPS) {
    assert.ok(map.layout.worldHeight >= 300, `${map.id} has an invalid world height`);
    assert.ok(map.layout.platforms.length >= 1, `${map.id} has no terrain platform`);
    const spawnSlots = map.layout.platforms.reduce(
      (sum, platform) => sum + Math.max(0, Number(platform.spawnSlots) || 0),
      0
    );
    assert.ok(
      map.safeZone || map.fieldBossId || spawnSlots >= map.layout.maxMonsters,
      `${map.id} does not have enough platform spawn slots`
    );
  }

  const huntingMaps = WORLD_MAPS.filter((map) => !map.safeZone && !map.fieldBossId);
  assert.ok(huntingMaps.some((map) => (
    map.layout.platforms.some((platform) => platform.spawnEnabled === false)
  )));
  assert.ok(huntingMaps.some((map) => (
    map.layout.connectors.some((connector) => connector.type === 'ladder')
  )));
  assert.ok(huntingMaps.some((map) => (
    map.layout.connectors.some((connector) => connector.type === 'jump')
  )));
});

test('the frozen dispatch map has fixed level-specific floor spawns', () => {
  const map = getWorldMap('frozen_dispatch_yard');
  assert.equal(map.layout.id, 'frozen_dispatch');
  assert.equal(map.layout.worldWidth, 825);
  assert.equal(map.layout.maxMonsters, 18);
  assert.equal(map.layout.spawnPerWave, 8);
  assert.deepEqual(
    map.layout.platforms.map((platform) => ({
      floor: platform.floor,
      spawnSlots: platform.spawnSlots,
      spawnPerWave: platform.spawnPerWave,
      monsterIds: [...platform.monsterIds]
    })),
    [
      {
        floor: 0,
        spawnSlots: 9,
        spawnPerWave: 4,
        monsterIds: ['overtime_reaper']
      },
      {
        floor: 1,
        spawnSlots: 9,
        spawnPerWave: 4,
        monsterIds: ['deadline_dragon']
      }
    ]
  );
  assert.ok(map.connections.some((connection) => connection.targetId === 'company_bus_stop'));
});
