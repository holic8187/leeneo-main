'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const skillsUi = fs.readFileSync(path.join(ROOT, 'public/v2/skills-ui.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');

test('manual skill buttons capture pointer input before an automatic rerender can replace them', () => {
  assert.match(skillsUi, /button\.addEventListener\('pointerdown'/);
  assert.match(skillsUi, /bindImmediateSkillButton\(button, \(\) => queueManualSkillUse/);
  assert.match(skillsUi, /if \(event\.detail !== 0\)/);
  assert.match(index, /\/v2\/skills-ui\.js\?v=49/);
});

test('channeled projectiles apply every hit when the arrow reaches its target', () => {
  const projectile = app.match(
    /function launchChannelProjectile[\s\S]*?\r?\n}\r?\n\r?\nfunction orderFollowUpHitResults/
  )?.[0] || '';
  const channelMotion = app.match(
    /async function playChanneledSkillMotion[\s\S]*?\r?\n}\r?\n\r?\nfunction canEnterMap/
  )?.[0] || '';
  assert.match(projectile, /return new Promise\(\(resolve\) =>/);
  assert.match(projectile, /resolve\(impactPoint\)/);
  assert.match(channelMotion, /launchChannelProjectile\([\s\S]*?\.then\(\(impactPoint\) =>/);
  assert.match(channelMotion, /applyChannelSkillHit\?\.\(hitResult, impactPoint\)/);
  assert.doesNotMatch(channelMotion, /if \(hitResult\) window\.applyChannelSkillHit\?\.\(hitResult\);/);
  assert.match(skillsUi, /function applyChannelSkillHit\(hit = \{\}, impactPoint = null\)/);
  assert.match(skillsUi, /retainTargetIds\(channelTargetIds\)/);
  assert.match(skillsUi, /showFloatingDamageAtPoint\(fallbackPoint, amount, kind, sequence\)/);
});

test('visual channel HP follows the displayed hit order including follow-up attacks', () => {
  const orderSource = app.match(
    /function orderFollowUpHitResults[\s\S]*?(?=\r?\nfunction buildVisualChannelHitResults)/
  )?.[0] || '';
  const visualSource = app.match(
    /function buildVisualChannelHitResults[\s\S]*?(?=\r?\nasync function playChanneledSkillMotion)/
  )?.[0] || '';
  const context = {};
  vm.runInNewContext(`${orderSource}\n${visualSource}`, context);
  const results = context.buildVisualChannelHitResults([
    { monsterId: 'm1', hitIndex: 0, damage: 100, remainingHp: 900, maxHp: 1000 },
    { monsterId: 'm1', hitIndex: 1, damage: 100, remainingHp: 800, maxHp: 1000 },
    {
      monsterId: 'm1',
      hitIndex: 2,
      damage: 50,
      remainingHp: 750,
      maxHp: 1000,
      bonusAttack: true,
      followUpAttack: true
    }
  ]);
  assert.deepEqual(Array.from(results, (hit) => hit.visualRemainingHp), [900, 850, 750]);
});

test('skill visual cleanup always releases the shared skill-use lock', () => {
  const targetCleanup = app.match(
    /function releaseCombatVisualTargets[\s\S]*?\n}\n\nconst FIELD_BOSS_CAST_PATTERNS/
  )?.[0] || '';
  const skillCleanup = skillsUi.match(
    /} finally \{\n    try \{[\s\S]*?state\.skillUseBusy = false;\n    }\n  }/
  )?.[0] || '';

  assert.doesNotMatch(targetCleanup, /\.forEach\([\s\S]*?\)\.finally\(/);
  assert.match(skillCleanup, /releaseCombatVisualTargets/);
  assert.match(skillCleanup, /catch \(cleanupError\)/);
  assert.match(skillCleanup, /finally \{\n      state\.skillUseBusy = false;/);
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

test('progressive piercing aims at its prepared monster instead of a stale movement target', () => {
  assert.match(skillsUi, /return \{ target, targets: piercingTargets, direction \}/);
  assert.match(skillsUi, /progressivePiercingSkill\s*\? Number\(preparedPiercingTarget\?\.direction\)/);
  assert.match(skillsUi, /preparedPiercingTarget\?\.target\?\.id/);
});

test('rapid skill preset clicks are serialized against the latest returned preset', () => {
  assert.match(skillsUi, /async function performSkillPresetUpdate/);
  assert.match(skillsUi, /state\.skillPresetUpdateQueue\s*\.catch\(\(\) => \{\}\)\s*\.then/);
});
