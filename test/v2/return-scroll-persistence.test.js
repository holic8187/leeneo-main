'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('단축 슬롯 귀환서는 위치와 인벤토리 저장 완료 후 월드를 이탈한다', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/v2/registerV2Routes.js'),
    'utf8'
  );
  const routeStart = source.indexOf("app.post('/api/v2/inventory/use-consumable-slot'");
  const routeEnd = source.indexOf("app.post('/api/v2/inventory/auto-potion'", routeStart);
  const route = source.slice(routeStart, routeEnd);
  const persistence = route.indexOf("await queueCharacterPersistence(character, { fields: ['inventory', 'worldState'] })");
  const leave = route.indexOf('leaveWorld(auth.id)', persistence);
  assert.ok(persistence >= 0, '귀환 위치를 즉시 저장해야 한다');
  assert.ok(leave > persistence, '저장 완료 뒤 기존 월드 연결을 해제해야 한다');
  assert.match(route, /character\.markModified\?\.\('worldState'\)/);
});
