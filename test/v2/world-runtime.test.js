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
    mapId: 'main_lobby',
    x: 10,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  assert.equal(state.players.length, 1);
  assert.equal(state.monsters.length, 4);
  assert.ok(state.monsters[0].contactDamage > 0);
  assert.ok(state.monsters[0].physicalDefense > 0);
  assert.ok(state.monsters[0].magicDefense > 0);
  assert.ok(state.monsters[0].expReward > 0);
});

test('players in the same map see one another and an empty map is discarded', () => {
  updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'main_lobby',
    x: 10,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const shared = updatePresence({
    userId: 'user-b',
    nickname: '사원B',
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
    x: 30,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters[0];
  updatePresence({
    userId: 'user-a',
    nickname: '사원A',
    mapId: 'main_lobby',
    x: monster.x,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  const result = attackMonster({
    userId: 'user-a',
    mapId: 'main_lobby',
    monsterId: monster.id,
    damage: monster.maxHp + monster.physicalDefense,
    rangePx: 22,
    now: 1_200
  });
  assert.equal(result.success, true);
  assert.equal(result.defeated, true);
  assert.ok(result.expReward > 0);
});

test('test monster stats scale with map level', () => {
  const low = buildMonsterStats(1);
  const high = buildMonsterStats(100);
  assert.ok(high.maxHp > low.maxHp);
  assert.ok(high.contactDamage > low.contactDamage);
  assert.ok(high.expReward > low.expReward);
});


test('an occupied map replenishes four monsters every eight seconds up to sixteen', () => {
  const heartbeat = (now) => updatePresence({
    userId: 'spawn-user',
    nickname: 'spawn-user',
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
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
    mapId: 'main_lobby',
    x: 0,
    currentHp: 40,
    maxHp: 120,
    now: 1_000
  });
  updatePlayerResources('potion-user', { currentHp: 90, maxHp: 120 });
  const state = updatePresence({
    userId: 'potion-user',
    nickname: 'potion-user',
    mapId: 'main_lobby',
    x: 0,
    currentHp: 90,
    maxHp: 120,
    now: 1_100
  });
  assert.equal(state.players[0].currentHp, 90);
});
