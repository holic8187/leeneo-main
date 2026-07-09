'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  START_MAP_ID,
  WORLD_MAPS,
  getWorldMap,
  findNearestSafeMap
} = require('../../src/v2/world/mapDefinitions');

test('world contains forty visible company maps and one hidden field-boss map', () => {
  const visibleMaps = WORLD_MAPS.filter((map) => !map.hidden);
  const hiddenMaps = WORLD_MAPS.filter((map) => map.hidden);
  assert.equal(WORLD_MAPS.length, 41);
  assert.equal(visibleMaps.length, 40);
  assert.equal(hiddenMaps.length, 1);
  assert.equal(hiddenMaps[0].fieldBossId, 'mad_hwang_manager');
  assert.equal(new Set(WORLD_MAPS.map((map) => map.id)).size, 41);
  assert.equal(new Set(WORLD_MAPS.map((map) => map.name)).size, 41);
  assert.equal(getWorldMap(START_MAP_ID).name, '호이상사 중앙로비');
  assert.equal(getWorldMap(START_MAP_ID).safeZone, true);
});

test('the nearest safe zone can be found through the map graph', () => {
  assert.equal(findNearestSafeMap('main_lobby').id, 'main_lobby');
  assert.equal(findNearestSafeMap('newcomer_training').id, 'main_lobby');
  assert.equal(findNearestSafeMap('data_center').id, 'sales_floor');
});

test('three regional safe zones expose their own supply shop', () => {
  const safeMaps = WORLD_MAPS.filter((map) => map.safeZone);
  assert.deepEqual(
    safeMaps.map((map) => map.shopId).sort(),
    ['headquarters', 'personnel_annex', 'sales_outpost']
  );
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
