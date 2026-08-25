'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(
  path.join(__dirname, '../../public/v2/app.js'),
  'utf8'
);
const routes = fs.readFileSync(
  path.join(__dirname, '../../src/v2/registerV2Routes.js'),
  'utf8'
);

test('shop sales preserve both inventory list scroll positions', () => {
  assert.match(app, /function captureFieldShopScroll\(\)/);
  assert.match(app, /rerenderFieldShop\(scroll\)/);
  assert.match(app, /sellList\.scrollTop = scroll\.sell/);
});

test('throwing stars use a whole-slot sale button without a quantity input', () => {
  assert.match(app, /data-shop-sell=.*표창 칸 판매/);
  assert.match(app, /isThrowingStarItem\(item\)[\s\S]*묶음 판매/);
});

test('marketplace locks throwing-star listings to the selected whole stack', () => {
  assert.match(app, /data-whole-slot=.*isThrowingStarItem\(item\)/);
  assert.match(app, /quantityInput\.disabled = wholeSlot/);
  assert.match(app, /표창은 선택한 묶음 전체가 등록됩니다/);
  assert.match(routes, /isThrowingStar[\s\S]*removeInventoryStack\(current, stackId\)/);
});
