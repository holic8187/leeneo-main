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
  assert.match(index, /\/v2\/app\.js\?v=72/);
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
  assert.match(worldRuntime, /queueRaidContactEvents\(runtime, contactEvents\)/);
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
