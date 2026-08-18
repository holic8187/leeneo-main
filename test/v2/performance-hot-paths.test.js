'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const appJs = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');
const worldRuntime = fs.readFileSync(path.join(ROOT, 'src/v2/world/worldRuntime.js'), 'utf8');

test('mobile camera and combat entities avoid redundant frame and DOM work', () => {
  const partyHud = appJs.match(
    /function renderPartyCombatHud[\s\S]*?\n}\n\nconst MOBILE_WORLD_CAMERA_FRAME_INTERVAL_MS/
  )?.[0] || '';
  assert.match(appJs, /MOBILE_WORLD_CAMERA_FRAME_INTERVAL_MS = 1000 \/ 30/);
  assert.match(appJs, /state\.remotePlayerElements\.get\(userId\)/);
  assert.match(appJs, /state\.monsterElements\.get\(monsterId\)/);
  assert.match(partyHud, /state\.partyHudElements\.get\(userId\)/);
  assert.doesNotMatch(partyHud, /hud\.innerHTML/);
  assert.match(index, /\/v2\/app\.js\?v=82/);
});

test('mail status rides on the world heartbeat while active combat skips polling', () => {
  const heartbeat = routes.match(
    /app\.post\('\/api\/v2\/world\/heartbeat'[\s\S]*?\n  }\);/
  )?.[0] || '';
  const mailPolling = appJs.match(
    /function startMailPolling[\s\S]*?\n}/
  )?.[0] || '';
  assert.match(routes, /pendingMailCount: Math\.max\(0, Number\(profileResponse\.pendingMailCount\) \|\| 0\)/);
  assert.match(heartbeat, /pendingMailCount: Math\.max\(0, Number\(profile\.pendingMailCount\) \|\| 0\)/);
  assert.match(appJs, /updateMailButton\(Number\(data\.pendingMailCount\)\)/);
  assert.match(mailPolling, /if \(!state\.worldControlActive\) refreshMailStatus\(\)/);
});

test('admin mail shares the live character persistence lane and verifies storage', () => {
  const snapshotPersistence = routes.match(
    /async function persistCharacterSnapshot[\s\S]*?\n  async function drainCharacterPersistence/
  )?.[0] || '';
  const persistence = routes.match(
    /async function persistMailboxEntry[\s\S]*?\n  async function persistMailboxEntryBatch/
  )?.[0] || '';
  const batchPersistence = routes.match(
    /async function persistMailboxEntryBatch[\s\S]*?\n  async function withCharacterMutations/
  )?.[0] || '';
  const adminMailRoute = routes.match(
    /app\.post\('\/api\/v2\/admin\/mail\/send'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(persistence, /withCharacterMutation\(key/);
  assert.match(persistence, /cacheWorldProfile\(character\)/);
  assert.match(persistence, /await queueCharacterPersistence\(character, \{ syncMailbox: true \}\)/);
  assert.match(persistence, /V2Character\.exists/);
  assert.match(batchPersistence, /V2Character\.updateMany/);
  assert.match(batchPersistence, /V2Character\.find/);
  assert.match(batchPersistence, /missingKeys/);
  assert.match(batchPersistence, /withCharacterMutationBarrier/);
  assert.doesNotMatch(batchPersistence, /persistMailboxEntry\(key/);
  assert.match(routes, /function getCharacterPersistenceRoots/);
  assert.match(snapshotPersistence, /\[\.\.\.modifiedRoots\]/);
  assert.match(snapshotPersistence, /Object\.prototype\.hasOwnProperty\.call\(snapshot, root\)/);
  assert.match(snapshotPersistence, /'mailbox\.id': \{ \$ne:/);
  assert.match(snapshotPersistence, /\$push: \{ mailbox: entry \}/);
  assert.doesNotMatch(snapshotPersistence, /replaceOne/);
  assert.match(adminMailRoute, /persistMailboxEntryBatch/);
  assert.match(adminMailRoute, /persistMailboxEntry\(recipient\.userId, entry\)/);
  assert.doesNotMatch(adminMailRoute, /worldProfileCache\.delete/);
  assert.doesNotMatch(adminMailRoute, /character\.save\(\)/);
});

test('boss expedition entry persists all members concurrently', () => {
  const responseRoute = routes.match(
    /app\.post\('\/api\/v2\/boss-expeditions\/respond'[\s\S]*?\n  }\);/
  )?.[0] || '';
  assert.match(responseRoute, /await Promise\.all\(members\.map\(async \(member\) =>/);
  assert.doesNotMatch(responseRoute, /for \(const member of members\)[\s\S]*?await V2Character\.updateOne/);
});

test('Bald Kim raid simulation uses one map timer instead of every player heartbeat', () => {
  const heartbeat = routes.match(
    /app\.post\('\/api\/v2\/world\/heartbeat'[\s\S]*?\n  }\);/
  )?.[0] || '';
  const responseRoute = routes.match(
    /app\.post\('\/api\/v2\/boss-expeditions\/respond'[\s\S]*?\n  }\);/
  )?.[0] || '';
  assert.match(responseRoute, /startRaidMapSimulation\(instanceMapId\)/);
  assert.match(heartbeat, /startRaidMapSimulation\(mapId\)/);
  assert.match(heartbeat, /simulationMode: requestedMap\.raidBossId \? 'map-timer' : 'heartbeat'/);
  assert.match(worldRuntime, /const RAID_MAP_TICK_INTERVAL_MS = 100/);
  assert.match(worldRuntime, /queueRaidContactEvents\(runtime, contactEvents, now\)/);
  assert.match(worldRuntime, /const RAID_SUMMON_MAXIMUM = 12/);
});

test('Bald Kim rewards serialize per character and retry instead of disappearing on failure', () => {
  const rewardDelivery = routes.match(
    /async function applyRaidBossRewardEvent[\s\S]*?\n  function queueAutoPotionUpdate/
  )?.[0] || '';
  const heartbeat = routes.match(
    /app\.post\('\/api\/v2\/world\/heartbeat'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(rewardDelivery, /session\.rewardProgress instanceof Map/);
  assert.match(rewardDelivery, /withFastCharacterMutation/);
  assert.match(rewardDelivery, /queueCharacterPersistence/);
  assert.doesNotMatch(rewardDelivery, /character\.save\(\)/);
  assert.match(heartbeat, /requeueRaidBossRewardEvent\(state\.mapId, rewardEvent\)/);
});

test('party monster kills queue cached teammate experience without a roster query', () => {
  const experienceGrant = routes.match(
    /async function grantCombatExperience[\s\S]*?\n  async function applyBuffToActivePartyMembers/
  )?.[0] || '';
  const experienceQueue = routes.match(
    /function schedulePartyExperienceFlush[\s\S]*?\n  const AUGMENT_BUFF_SKILL_EFFECTS/
  )?.[0] || '';
  assert.match(experienceGrant, /queuePartyExperienceGrant\(share\.userId/);
  assert.doesNotMatch(experienceGrant, /V2Character\.find\(/);
  assert.doesNotMatch(experienceGrant, /target\.save\(\)/);
  assert.match(experienceQueue, /getMutableWorldCharacter\(key\)/);
  assert.match(experienceQueue, /queueCharacterPersistence\(target\)/);
});

test('fast persistence updates only modified character roots', () => {
  const persistence = routes.match(
    /function getCharacterPersistenceRoots[\s\S]*?async function queueCharacterMutation/
  )?.[0] || '';
  assert.match(persistence, /character\.modifiedPaths\(\)/);
  assert.match(persistence, /state\.modifiedRoots\.add\(root\)/);
  assert.match(persistence, /\$set: mutableFields/);
  assert.doesNotMatch(persistence, /const mutableFields = \{ \.\.\.snapshot \}/);
  assert.match(routes, /const admission = characterMutationAdmission/);
  assert.match(routes, /await admission/);
});

test('background auto hunting follows page visibility without reacting to page scroll', () => {
  assert.match(appJs, /function shouldUseBackgroundHunting/);
  assert.match(appJs, /document\.visibilityState !== 'visible'/);
  assert.doesNotMatch(appJs, /IntersectionObserver/);
  assert.doesNotMatch(appJs, /worldStageVisible/);
  assert.match(appJs, /\/api\/v2\/world\/leave/);
  assert.match(appJs, /\/api\/v2\/world\/claim-control/);
  assert.match(appJs, /keepalive: true/);
  assert.match(appJs, /function resumeWorldSimulation/);
  assert.match(appJs, /window\.addEventListener\('pageshow', recoverVisibleWorldSession\)/);
  assert.match(appJs, /WORLD_CONTROL_UNCLAIMED/);
});

test('admin grants resolve V2 identities and refresh live cash state', () => {
  const resolver = routes.match(
    /async function resolveAdminGrantRecipient[\s\S]*?\n  function prepareDroppedEquipmentInstance/
  )?.[0] || '';
  const cashGrant = routes.match(
    /app\.post\('\/api\/v2\/admin\/cash\/grant'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(resolver, /V2Account\.findOne/);
  assert.match(resolver, /V2Character\.findOne/);
  assert.match(cashGrant, /resolveAdminGrantRecipient/);
  assert.match(cashGrant, /withCharacterMutation/);
  assert.match(cashGrant, /cacheWorldProfile\(character\)/);
});

test('foreground auto combat restarts after a cancelled or stalled loop', () => {
  const autoCombat = appJs.match(
    /const AUTO_COMBAT_STALL_RECOVERY_MS[\s\S]*?function formatDuration/
  )?.[0] || '';
  const heartbeat = appJs.match(
    /async function sendWorldHeartbeat[\s\S]*?async function runWorldPresence/
  )?.[0] || '';
  assert.match(appJs, /autoCombatLoopRunId: 0/);
  assert.match(appJs, /autoCombatLastCycleAt: 0/);
  assert.match(autoCombat, /function ensureAutoCombatRunning/);
  assert.match(autoCombat, /AUTO_COMBAT_STALL_RECOVERY_MS = 12_000/);
  assert.match(autoCombat, /scheduleAutoCombatRecovery\(\)/);
  assert.match(heartbeat, /ensureAutoCombatRunning\(\)/);
  assert.match(appJs, /!state\.manualSkillQueueRunning[\s\S]*endManualSkillPriority\(\)/);
});

test('hunting time display projects from server time without mutating the stored balance', () => {
  assert.match(appJs, /function getProjectedHuntingTimeRemaining/);
  assert.match(appJs, /allowIncrease: false/);
  assert.doesNotMatch(
    appJs,
    /state\.huntingTime\.remainingSeconds\s*=\s*Math\.max\(0,\s*state\.huntingTime\.remainingSeconds\s*-\s*1\)/
  );
});

test('monster HUD stays visible and upright while the monster attacks or turns', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'public/v2/styles.css'), 'utf8');
  assert.match(styles, /\.monster-hp\s*\{[\s\S]*?display: block !important/);
  assert.match(styles, /\.field-monster\.facing-left \.monster-name/);
  assert.match(styles, /\.field-monster\.facing-left \.monster-hp/);
  assert.match(styles, /\.field-monster\.is-attacking pre/);
  assert.match(appJs, /monster\.classList\.add\('is-attacking'\)/);
});

test('saved augment, preset, inventory, and cash mutations refresh the combat cache', () => {
  for (const routePattern of [
    /app\.post\('\/api\/v2\/daily-augment\/reroll'[\s\S]*?\n  \}\);/,
    /app\.post\('\/api\/v2\/skills\/preset'[\s\S]*?\n  \}\);/,
    /app\.post\('\/api\/v2\/inventory\/sort'[\s\S]*?\n  \}\);/,
    /app\.post\('\/api\/v2\/inventory\/expand'[\s\S]*?\n  \}\);/,
    /app\.post\('\/api\/v2\/cash-shop\/buy'[\s\S]*?\n  \}\);/
  ]) {
    assert.match(routes.match(routePattern)?.[0] || '', /cacheWorldProfile\(/);
  }
});
