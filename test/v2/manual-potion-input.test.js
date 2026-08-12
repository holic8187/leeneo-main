'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');

test('every manual potion input is submitted immediately without pausing automatic use', () => {
  assert.match(app, /manualPotionRequestsInFlight:\s*0/);
  assert.match(app, /state\.manualPotionRequestsInFlight \+= 1/);
  assert.match(app, /await usePotion\(\)/);
  assert.match(
    app,
    /state\.manualPotionRequestsInFlight = Math\.max\(0, state\.manualPotionRequestsInFlight - 1\)/
  );
  assert.doesNotMatch(app, /state\.manualPotionRequestsInFlight > 0/);
  assert.match(app, /submitManualPotionUse\(\(\) => performQuickPotion\(slot, false\)\)/);
  assert.match(app, /const requestSequence = \+\+state\.potionRequestSequence/);
  assert.match(app, /applyPotionUseResult\(data, requestSequence\)/);
  assert.doesNotMatch(
    app.match(/async function performQuickPotion[\s\S]*?\n}\n\nfunction useQuickPotion/)?.[0] || '',
    /renderGame\(/
  );
  assert.match(app, /const potionResponseSequenceAtStart = state\.potionResponseSequence/);
  assert.match(
    app,
    /state\.potionResponseSequence > potionResponseSequenceAtStart[\s\S]*?data\.self = \{/
  );
});

test('potion buttons submit on pointer down and keep keyboard click support', () => {
  assert.match(app, /button\.addEventListener\('pointerdown'/);
  assert.match(app, /if \(event\.detail !== 0\)/);
  assert.match(app, /bindImmediatePotionButton\(\$\('hpPotionButton'\)/);
  assert.match(app, /bindImmediatePotionButton\(\$\('mpPotionButton'\)/);
  assert.match(index, /\/v2\/app\.js\?v=78/);
});

test('combat damage and potion use take the cached fast persistence path', () => {
  const potionRoute = routes.match(
    /app\.post\('\/api\/v2\/inventory\/use-potion'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  const contactBlock = routes.match(
    /if \(state\.contactEvents\.length\)[\s\S]*?if \(state\.recoveryEvents\.length\)/
  )?.[0] || '';
  assert.match(potionRoute, /withFastCharacterMutation/);
  assert.match(potionRoute, /getMutableWorldCharacter/);
  assert.match(potionRoute, /syncMutableCharacterResourcesFromWorld/);
  assert.match(potionRoute, /queueCharacterPersistence/);
  assert.doesNotMatch(potionRoute, /await character\.save\(\)/);
  assert.match(contactBlock, /withFastCharacterMutation/);
  assert.match(contactBlock, /liveResources\?\.lastPotionAt/);
  assert.match(contactBlock, /event\.supersededByPotion = true/);
  assert.match(contactBlock, /queueCharacterPersistence/);
  assert.doesNotMatch(contactBlock, /await character\.save\(\)/);
});
