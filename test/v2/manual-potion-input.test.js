'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');

test('every manual potion input is submitted immediately and automatic use yields', () => {
  assert.match(app, /manualPotionRequestsInFlight:\s*0/);
  assert.match(app, /state\.manualPotionRequestsInFlight \+= 1/);
  assert.match(app, /await usePotion\(\)/);
  assert.match(
    app,
    /state\.manualPotionRequestsInFlight = Math\.max\(0, state\.manualPotionRequestsInFlight - 1\)/
  );
  assert.match(app, /state\.manualPotionRequestsInFlight > 0/);
  assert.match(app, /submitManualPotionUse\(\(\) => performQuickPotion\(slot, false\)\)/);
});

test('potion buttons submit on pointer down and keep keyboard click support', () => {
  assert.match(app, /button\.addEventListener\('pointerdown'/);
  assert.match(app, /if \(event\.detail !== 0\)/);
  assert.match(app, /bindImmediatePotionButton\(\$\('hpPotionButton'\)/);
  assert.match(app, /bindImmediatePotionButton\(\$\('mpPotionButton'\)/);
  assert.match(index, /\/v2\/app\.js\?v=70/);
});
