'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMonsterStats,
  updatePresence,
  attackMonster,
  updatePlayerResources,
  leaveWorld,
  resetWorldRuntime
} = require('../../src/v2/world/worldRuntime');

test.beforeEach(() => resetWorldRuntime());

test('an occupied map lazily spawns test monsters with configured combat stats', () => {
  const state = updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'newcomer_training',
    x: 10,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  assert.equal(state.players.length, 1);
  assert.equal(state.monsters.length, 4);
  assert.equal(state.monsters[0].level, 3);
  assert.equal(state.monsters[0].maxHp, 30);
  assert.equal(state.monsters[0].contactDamage, 10);
  assert.equal(state.monsters[0].physicalDefense, 1);
  assert.equal(state.monsters[0].magicDefense, 1);
  assert.equal(state.monsters[0].expReward, 1);
});

test('players in the same map see one another and an empty map is discarded', () => {
  updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'newcomer_training',
    x: 10,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const shared = updatePresence({
    userId: 'user-b',
    nickname: '사원B',
    mapId: 'newcomer_training',
    x: 30,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  assert.deepEqual(shared.players.map((player) => player.nickname).sort(), ['사원A', '사원B']);
  leaveWorld('user-a');
  leaveWorld('user-b');
  const fresh = updatePresence({
    userId: 'user-c',
    nickname: '사원C',
    mapId: 'newcomer_training',
    x: 50,
    currentHp: 120,
    maxHp: 120,
    now: 2_000
  });
  assert.equal(fresh.players.length, 1);
});

test('a hit gives the monster aggro and applies defense before defeat reward', () => {
  const state = updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'newcomer_training',
    x: 30,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  assert.ok(monster);
  updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'newcomer_training',
    x: monster.x,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  const result = attackMonster({
    userId: 'user-a',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: monster.maxHp + monster.physicalDefense,
    rangePx: 22,
    now: 1_200
  });
  assert.equal(result.success, true);
  assert.equal(result.defeated, true);
  assert.ok(result.expReward > 0);
});

test('all test monsters use the fixed level three balance values', () => {
  const low = buildMonsterStats(1);
  const high = buildMonsterStats(100);
  assert.deepEqual(low, high);
  assert.deepEqual(low, {
    maxHp: 30,
    contactDamage: 10,
    physicalDefense: 1,
    magicDefense: 1,
    movementSpeed: 35,
    expReward: 1
  });
});


test('an occupied map replenishes four monsters every eight seconds up to sixteen', () => {
  const heartbeat = (now) => updatePresence({
    userId: 'spawn-user',
    nickname: 'spawn-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now
  });

  assert.equal(heartbeat(1_000).monsters.length, 4);
  assert.equal(heartbeat(8_999).monsters.length, 4);
  assert.equal(heartbeat(9_000).monsters.length, 8);
  assert.equal(heartbeat(17_000).monsters.length, 12);
  assert.equal(heartbeat(25_000).monsters.length, 16);
  assert.equal(heartbeat(33_000).monsters.length, 16);
});

test('contact damage knocks the player backward and grants 1.5 seconds of invulnerability', () => {
  const initial = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const firstMonster = initial.monsters.find((monster) => monster.floor === 0);
  assert.ok(firstMonster);

  const firstHit = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: firstMonster.x,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  assert.equal(firstHit.contactEvents.length, 1);
  assert.ok(firstHit.contactEvents[0].x < firstMonster.x);
  assert.equal(firstHit.contactEvents[0].invulnerableUntil, 2_600);

  const duringInvulnerability = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: firstHit.monsters.find((monster) => monster.id === firstMonster.id).x,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 2_000
  });
  assert.equal(duringInvulnerability.contactEvents.length, 0);

  const movedMonster = duringInvulnerability.monsters.find((monster) => monster.id === firstMonster.id);
  const afterInvulnerability = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: movedMonster.x,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 2_601
  });
  assert.equal(afterInvulnerability.contactEvents.length, 1);
});


test('an external potion heal updates the active field player immediately', () => {
  updatePresence({
    userId: 'potion-user',
    nickname: 'potion-user',
    mapId: 'newcomer_training',
    x: 0,
    currentHp: 40,
    maxHp: 120,
    now: 1_000
  });
  updatePlayerResources('potion-user', { currentHp: 90, maxHp: 120 });
  const state = updatePresence({
    userId: 'potion-user',
    nickname: 'potion-user',
    mapId: 'newcomer_training',
    x: 0,
    currentHp: 90,
    maxHp: 120,
    now: 1_100
  });
  assert.equal(state.players[0].currentHp, 90);
});

test('the central lobby is a safe zone and never spawns monsters', () => {
  const state = updatePresence({
    userId: 'safe-user',
    nickname: 'safe-user',
    mapId: 'main_lobby',
    x: 10,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  assert.equal(state.monsters.length, 0);
  assert.equal(state.contactEvents.length, 0);
});

test('dead players cannot attack', () => {
  const state = updatePresence({
    userId: 'dead-user',
    nickname: 'dead-user',
    mapId: 'newcomer_training',
    x: 20,
    currentHp: 0,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters[0];
  const result = attackMonster({
    userId: 'dead-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 100,
    rangePx: 1000,
    now: 1_100
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'dead');
});
