'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const skillsUi = fs.readFileSync(path.join(ROOT, 'public/v2/skills-ui.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');

test('manual skill buttons capture pointer input before an automatic rerender can replace them', () => {
  assert.match(skillsUi, /button\.addEventListener\('pointerdown'/);
  assert.match(skillsUi, /bindImmediateSkillButton\(button, \(\) => queueManualSkillUse/);
  assert.match(skillsUi, /if \(event\.detail !== 0\)/);
  assert.match(index, /\/v2\/skills-ui\.js\?v=46/);
});

test('a skill animation cannot overwrite a potion response that arrived during the cast', () => {
  assert.match(
    skillsUi,
    /const potionResponseSequenceAtStart = Number\(state\.potionResponseSequence\) \|\| 0/
  );
  assert.match(
    skillsUi,
    /const preservePotionState = Number\(state\.potionResponseSequence\) > potionResponseSequenceAtStart/
  );
  assert.match(skillsUi, /data\.character\.resources = \{ \.\.\.\(state\.character\.resources \|\| \{\}\) \}/);
});

test('manual skill inputs remain queued while automatic skill use finishes', () => {
  assert.match(skillsUi, /state\.manualSkillQueue\.push\(String\(skillId\)\)/);
  assert.match(skillsUi, /beginManualSkillPriority\(\)/);
  assert.match(skillsUi, /while \(state\.skillUseBusy && !state\.dead\)/);
  assert.match(skillsUi, /await useActiveSkill\(nextSkillId, \{ manual: true \}\)/);
  assert.doesNotMatch(skillsUi, /finally \{\s*state\.manualSkillQueue\.length = 0/);
  assert.match(
    skillsUi,
    /if \(!state\.dead && state\.manualSkillQueue\.length\) void drainManualSkillQueue\(\)/
  );
});

test('ordinary combat skills release the input queue before database persistence', () => {
  const skillRoute = routes.match(
    /app\.post\('\/api\/v2\/skills\/use'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(skillRoute, /withSkillCharacterMutations/);
  assert.match(skillRoute, /requestedDefinition\?\.target !== 'party'/);
  assert.match(skillRoute, /queueCharacterPersistence\(character\)/);
  assert.doesNotMatch(skillRoute, /await character\.save\(\)/);
});

test('background character persistence coalesces rapid combat snapshots', () => {
  const persistenceBlock = routes.match(
    /async function drainCharacterPersistence[\s\S]*?async function queueCharacterMutation/
  )?.[0] || '';
  assert.match(persistenceBlock, /while \(state\.latestSnapshot\)/);
  assert.match(persistenceBlock, /state\.latestSnapshot = snapshot/);
  assert.match(persistenceBlock, /if \(!state\.running\)/);
  assert.doesNotMatch(persistenceBlock, /const previous = characterPersistenceQueues/);
});

test('automatic hunting time ticks do not block manual combat on a database save', () => {
  const huntingTickRoute = routes.match(
    /app\.post\('\/api\/v2\/hunting-time\/tick'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(huntingTickRoute, /withFastCharacterMutation/);
  assert.match(huntingTickRoute, /queueCharacterPersistence\(character\)/);
  assert.doesNotMatch(huntingTickRoute, /await character\.save\(\)/);
});
