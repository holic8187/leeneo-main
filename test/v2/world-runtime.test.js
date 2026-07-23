'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PLAYER_CONTACT_KNOCKBACK_DISTANCE,
  buildMonsterStats,
  buildFieldBossRewardEvent,
  claimWorldControl,
  hasWorldControl,
  hasRecentWorldControl,
  releaseWorldControl,
  updatePresence,
  attackMonster,
  useSkillOnMonsters,
  updatePlayerResources,
  setPlayerStealth,
  publishGlobalShout,
  getGlobalShout,
  leaveWorld,
  resetWorldRuntime
} = require('../../src/v2/world/worldRuntime');
const { calculateMagicDamageAfterDefense } = require('../../src/v2/combat/combatFormulas');

test.beforeEach(() => resetWorldRuntime());

test('Hwang manager guarantees randomized elixir pools for every EXP-eligible participant', () => {
  const originalRandom = Math.random;
  let event;
  try {
    Math.random = () => 0.99;
    event = buildFieldBossRewardEvent(
      {
        players: new Map([
          ['eligible-a', { combatProfile: { playerLevel: 50 } }],
          ['eligible-b', { combatProfile: { playerLevel: 120 } }],
          ['too-low', { combatProfile: { playerLevel: 49 } }]
        ])
      },
      {
        fieldBoss: true,
        fieldBossId: 'mad_hwang_manager',
        name: '야근하다 미쳐버린 황과장',
        expReward: 300_000,
        contributors: { 'eligible-a': 100, 'eligible-b': 50, 'too-low': 999 }
      },
      'hwang_hidden_street',
      'eligible-a',
      1_000
    );
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(event.rewards.map((reward) => reward.userId).sort(), [
    'eligible-a',
    'eligible-b'
  ]);
  for (const itemId of ['elixir', 'power_elixir']) {
    const quantities = event.rewards.map((reward) => (
      reward.items.find((item) => item.itemId === itemId)?.quantity || 0
    ));
    assert.equal(quantities.reduce((sum, quantity) => sum + quantity, 0), 32);
    assert.ok(quantities.every((quantity) => quantity >= 1));
  }
});

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
  assert.equal(state.monsters[0].expReward, 5);
  assert.equal(state.monsters[0].spawnedAt, 1_000);
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

test('jump and flash-jump events are serialized once for remote players', () => {
  let state = updatePresence({
    userId: 'jump-user',
    nickname: '점프 사원',
    mapId: 'main_lobby',
    x: 10,
    currentHp: 120,
    maxHp: 120,
    jumpEvent: { sequence: 1, kind: 'jump', startedAt: 1_000 },
    now: 1_000
  });
  assert.equal(state.players[0].jumpEvent.sequence, 1);
  assert.equal(state.players[0].jumpEvent.kind, 'jump');

  state = updatePresence({
    userId: 'jump-user',
    nickname: '점프 사원',
    mapId: 'main_lobby',
    x: 30,
    currentHp: 120,
    maxHp: 120,
    jumpEvent: { sequence: 2, kind: 'flash-jump', startedAt: 1_200 },
    now: 1_200
  });
  assert.equal(state.players[0].jumpEvent.sequence, 2);
  assert.equal(state.players[0].jumpEvent.kind, 'flash-jump');
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
  assert.ok(result.drops.some((drop) => drop.kind === 'money'));
  assert.ok(result.drops.every((drop) => drop.collectAt === 9_000));
});

test('a magical hit can absorb monster MP without exceeding the available amount', () => {
  const state = updatePresence({
    userId: 'mp-eater-user',
    nickname: '지원팀',
    mapId: 'newcomer_training',
    x: 30,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    currentMp: 0,
    maxMp: 100,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: 'mp-eater-user',
    nickname: '지원팀',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    currentMp: 0,
    maxMp: 100,
    now: 1_100
  });
  const result = attackMonster({
    userId: 'mp-eater-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 1,
    damageType: 'magic',
    rangePx: 100,
    piercing: true,
    mpAbsorbChance: 100,
    mpAbsorbPercent: 40,
    now: 1_200
  });
  assert.equal(result.success, true);
  assert.equal(result.mpAbsorbed, Math.floor(monster.maxMp * 0.4));
  assert.equal(result.monster.mp, monster.maxMp - result.mpAbsorbed);
});

test('magical attacks use the provided magic damage range before monster magic defense', () => {
  const state = updatePresence({
    userId: 'magic-range-user',
    nickname: 'magic-range-user',
    mapId: 'newcomer_training',
    x: 30,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters[0];
  assert.ok(monster);
  updatePresence({
    userId: 'magic-range-user',
    nickname: 'magic-range-user',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: monster.floor,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  const result = attackMonster({
    userId: 'magic-range-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 1,
    damageRange: { minimum: 100, maximum: 100 },
    damageType: 'magic',
    rangePx: 100,
    piercing: true,
    playerLevel: 99,
    now: 1_200
  });
  const expectedRange = calculateMagicDamageAfterDefense({
    skillDamageRange: { minimum: 100, maximum: 100 },
    characterLevel: 99,
    monsterLevel: monster.level,
    magicDefense: monster.magicDefense
  });

  assert.equal(result.success, true);
  assert.equal(result.damage, Math.floor(expectedRange.minimum));
});

test('holy healing damage targets undead monsters and ignores living monsters', () => {
  const initial = updatePresence({
    userId: 'support-user',
    nickname: '경영지원',
    mapId: 'overtime_roost',
    x: 50,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const undead = initial.monsters.find((monster) => monster.undead && monster.floor === 0);
  assert.ok(undead);
  updatePresence({
    userId: 'support-user',
    nickname: '경영지원',
    mapId: 'overtime_roost',
    x: undead.x,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  const result = useSkillOnMonsters({
    userId: 'support-user',
    mapId: 'overtime_roost',
    targetId: undead.id,
    baseDamage: 100,
    skillPercent: 100,
    rangePx: 400,
    maxTargets: 15,
    damageType: 'magic',
    element: 'holy',
    undeadOnly: true,
    now: 1_200
  });
  assert.equal(result.success, true);
  assert.ok(result.outcomes.length >= 1);
  assert.ok(result.outcomes.every((outcome) => (
    initial.monsters.find((monster) => monster.id === outcome.monsterId)?.undead
  )));
  assert.ok(result.outcomes.every((outcome) => outcome.damage > 0));
});

test('target-dash skills move the caster directly in front of the resolved target', () => {
  const initial = updatePresence({
    userId: 'dispatch-user',
    nickname: '긴급 출동 사원',
    mapId: 'newcomer_training',
    x: 10,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const target = initial.monsters.find((monster) => monster.floor === 0);
  assert.ok(target);
  const startX = Math.max(2, Number(target.x) - 8);
  updatePresence({
    userId: 'dispatch-user',
    nickname: '긴급 출동 사원',
    mapId: 'newcomer_training',
    x: startX,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_050
  });
  const result = useSkillOnMonsters({
    userId: 'dispatch-user',
    mapId: 'newcomer_training',
    targetId: target.id,
    baseDamage: 1,
    skillPercent: 100,
    rangePx: 380,
    moveCasterToTarget: true,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.ok(result.casterMovement);
  assert.equal(result.casterMovement.floor, 0);
  assert.ok(Math.abs(result.casterMovement.x - result.outcomes[0].monster.x) <= 3);
  assert.notEqual(result.casterMovement.x, startX);
});

test('an offline auto-hunter remains visible but is marked offline', () => {
  updatePresence({
    userId: 'offline-hunter',
    nickname: '야근사원',
    mapId: 'newcomer_training',
    x: 20,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    autoHunting: true,
    autoHuntRemainingSeconds: 600,
    now: 1_000
  });
  const state = updatePresence({
    userId: 'offline-hunter',
    nickname: '야근사원',
    mapId: 'newcomer_training',
    x: 24,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    autoHunting: true,
    autoHuntRemainingSeconds: 590,
    offline: true,
    now: 20_000
  });
  const player = state.players.find((entry) => entry.userId === 'offline-hunter');
  assert.ok(player);
  assert.equal(player.online, false);
  assert.equal(player.autoHunting, true);
});

test('single-target attacks hit the front-most monster at resolution time', () => {
  let state = updatePresence({
    userId: 'front-target-user',
    nickname: 'front-target-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  state = updatePresence({
    userId: 'front-target-user',
    nickname: 'front-target-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 17_000
  });
  const floorGroups = [0, 1].map((floor) => (
    state.monsters.filter((monster) => monster.floor === floor).sort((a, b) => a.x - b.x)
  ));
  const monsters = floorGroups.sort((a, b) => b.length - a.length)[0];
  assert.ok(monsters.length >= 2);
  const front = monsters[0];
  const rear = monsters[1];
  const playerX = Math.max(0, front.x - 8);
  updatePresence({
    userId: 'front-target-user',
    nickname: 'front-target-user',
    mapId: 'newcomer_training',
    x: playerX,
    floor: front.floor,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 17_100
  });

  const result = attackMonster({
    userId: 'front-target-user',
    mapId: 'newcomer_training',
    monsterId: rear.id,
    damage: 2,
    rangePx: 1_000,
    now: 17_200
  });

  assert.equal(result.success, true);
  assert.equal(result.targetId, front.id);
});

test('piercing attacks may directly hit a monster behind the front target', () => {
  let state = updatePresence({
    userId: 'piercing-user',
    nickname: 'piercing-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  state = updatePresence({
    userId: 'piercing-user',
    nickname: 'piercing-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 17_000
  });
  const monsters = [0, 1].map((floor) => (
    state.monsters.filter((monster) => monster.floor === floor).sort((a, b) => a.x - b.x)
  )).sort((a, b) => b.length - a.length)[0];
  const front = monsters[0];
  const rear = monsters[1];
  updatePresence({
    userId: 'piercing-user',
    nickname: 'piercing-user',
    mapId: 'newcomer_training',
    x: Math.max(0, front.x - 8),
    floor: front.floor,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 17_100
  });

  const result = attackMonster({
    userId: 'piercing-user',
    mapId: 'newcomer_training',
    monsterId: rear.id,
    damage: 2,
    rangePx: 1_000,
    piercing: true,
    now: 17_200
  });

  assert.equal(result.success, true);
  assert.equal(result.targetId, rear.id);
});

test('single-target skills also resolve against the front-most monster', () => {
  let state = updatePresence({
    userId: 'front-skill-user',
    nickname: 'front-skill-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  state = updatePresence({
    userId: 'front-skill-user',
    nickname: 'front-skill-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 17_000
  });
  const monsters = [0, 1].map((floor) => (
    state.monsters.filter((monster) => monster.floor === floor).sort((a, b) => a.x - b.x)
  )).sort((a, b) => b.length - a.length)[0];
  const front = monsters[0];
  const rear = monsters[1];
  updatePresence({
    userId: 'front-skill-user',
    nickname: 'front-skill-user',
    mapId: 'newcomer_training',
    x: Math.max(0, front.x - 8),
    floor: front.floor,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 17_100
  });

  const result = useSkillOnMonsters({
    userId: 'front-skill-user',
    mapId: 'newcomer_training',
    targetId: rear.id,
    baseDamage: 2,
    skillPercent: 100,
    rangePx: 1_000,
    maxTargets: 1,
    now: 17_200
  });

  assert.equal(result.success, true);
  assert.equal(result.outcomes[0].monsterId, front.id);
});

test('defeated monster drops are collected on the next eight-second spawn tick', () => {
  const state = updatePresence({
    userId: 'loot-user',
    nickname: 'loot-user',
    mapId: 'newcomer_training',
    x: 30,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: 'loot-user',
    nickname: 'loot-user',
    mapId: 'newcomer_training',
    x: monster.x,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  attackMonster({
    userId: 'loot-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 999,
    rangePx: 1_000,
    now: 1_200
  });
  assert.equal(updatePresence({
    userId: 'loot-user',
    nickname: 'loot-user',
    mapId: 'newcomer_training',
    x: 0,
    currentHp: 120,
    maxHp: 120,
    now: 8_999
  }).lootCollections.length, 0);
  const collected = updatePresence({
    userId: 'loot-user',
    nickname: 'loot-user',
    mapId: 'newcomer_training',
    x: 0,
    currentHp: 120,
    maxHp: 120,
    now: 9_000
  }).lootCollections;
  assert.ok(collected.some((drop) => drop.kind === 'money'));
});

test('edge loot auto-collects and never blocks later drops', () => {
  const typedUserId = { toString: () => 'edge-loot-user' };
  let state = updatePresence({
    userId: typedUserId,
    nickname: 'edge-loot-user',
    mapId: 'newcomer_training',
    x: 86,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  let monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: typedUserId,
    nickname: 'edge-loot-user',
    mapId: 'newcomer_training',
    x: monster.x,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  const first = attackMonster({
    userId: typedUserId,
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 999,
    rangePx: 1_000,
    now: 1_200
  });
  assert.ok(first.drops.length);
  assert.ok(first.drops.every((drop) => drop.x >= 8 && drop.x <= 86));

  state = updatePresence({
    userId: 'edge-loot-user',
    nickname: 'edge-loot-user',
    mapId: 'newcomer_training',
    x: 86,
    currentHp: 120,
    maxHp: 120,
    now: 9_000
  });
  assert.equal(state.lootCollections.length, first.drops.length);

  monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: 'edge-loot-user',
    nickname: 'edge-loot-user',
    mapId: 'newcomer_training',
    x: monster.x,
    currentHp: 120,
    maxHp: 120,
    now: 9_100
  });
  const second = attackMonster({
    userId: 'edge-loot-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 999,
    rangePx: 1_000,
    now: 9_200
  });
  assert.ok(second.drops.length);
  assert.notEqual(second.drops[0].id, first.drops[0].id);

  state = updatePresence({
    userId: 'edge-loot-user',
    nickname: 'edge-loot-user',
    mapId: 'newcomer_training',
    x: 86,
    currentHp: 120,
    maxHp: 120,
    now: 17_000
  });
  assert.equal(state.lootCollections.length, second.drops.length);
});

test('monster stats keep the level three baseline and scale for higher levels', () => {
  const low = buildMonsterStats(3);
  const high = buildMonsterStats(100);
  assert.equal(low.maxHp, 30);
  assert.equal(low.contactDamage, 10);
  assert.equal(low.physicalDefense, 1);
  assert.equal(low.magicDefense, 1);
  assert.equal(low.expReward, 5);
  assert.ok(low.maxMp >= 10);
  assert.ok(high.maxMp > low.maxMp);
  assert.ok(low.monsterAccuracy > 0);
  assert.ok(low.monsterEvasion > 0);
  assert.ok(high.maxHp > low.maxHp);
  assert.ok(high.contactDamage > low.contactDamage);
  assert.ok(high.physicalDefense > low.physicalDefense);
});


test('an occupied map replenishes four monsters every eight seconds up to ten', () => {
  const heartbeat = (now) => updatePresence({
    userId: 'spawn-user',
    nickname: 'spawn-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'moving',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now
  });

  assert.equal(heartbeat(1_000).monsters.length, 4);
  assert.equal(heartbeat(8_999).monsters.length, 4);
  assert.equal(heartbeat(9_000).monsters.length, 8);
  assert.equal(heartbeat(17_000).monsters.length, 10);
  assert.equal(heartbeat(25_000).monsters.length, 10);
  assert.equal(heartbeat(33_000).monsters.length, 10);
});

test('a map contains at most two level-appropriate monster species', () => {
  const state = updatePresence({
    userId: 'species-user',
    nickname: 'species-user',
    mapId: 'data_center',
    x: 10,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  assert.ok(new Set(state.monsters.map((monster) => monster.speciesId)).size <= 2);
  assert.ok(state.monsters.every((monster) => monster.level >= 73 && monster.level <= 115));
});

test('only the most recently claimed client controls one character', () => {
  claimWorldControl('user-a', 'pc', 1_000);
  assert.equal(hasWorldControl('user-a', 'pc'), true);
  claimWorldControl('user-a', 'mobile', 1_100);
  assert.equal(hasWorldControl('user-a', 'pc'), false);
  assert.equal(hasWorldControl('user-a', 'mobile'), true);
  assert.equal(releaseWorldControl('user-a', 'pc'), false);
  assert.equal(releaseWorldControl('user-a', 'mobile'), true);
});

test('a recently claimed world client temporarily excludes its character from offline work', () => {
  claimWorldControl('online-user', 'browser', 1_000);
  assert.equal(hasRecentWorldControl('online-user', 13_000), true);
  assert.equal(hasRecentWorldControl('online-user', 13_001), false);
});

test('contact damage uses the reduced knockback and grants 2 seconds of invulnerability', () => {
  resetWorldRuntime();
  const initial = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'moving',
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
  assert.equal(firstHit.contactEvents[0].damageCalculation.type, 'physical-contact');
  assert.ok(firstHit.contactEvents[0].damageCalculation.standardPdd > 0);
  assert.ok(firstHit.contactEvents[0].x > firstMonster.x);
  assert.equal(firstHit.contactEvents[0].x, Math.min(94, firstMonster.x + 2.56));
  assert.equal(firstHit.contactEvents[0].invulnerableUntil, 3_100);

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
  let afterInvulnerability = updatePresence({
    userId: 'contact-user',
    nickname: 'contact-user',
    mapId: 'newcomer_training',
    x: movedMonster.x,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 3_101
  });
  if (!afterInvulnerability.contactEvents.length) {
    const latestMonster = afterInvulnerability.monsters.find(
      (monster) => monster.id === firstMonster.id
    );
    afterInvulnerability = updatePresence({
      userId: 'contact-user',
      nickname: 'contact-user',
      mapId: 'newcomer_training',
      x: latestMonster.x,
      floor: 0,
      activity: 'idle',
      facingLeft: false,
      currentHp: 120,
      maxHp: 120,
      now: 3_101
    });
  }
  assert.equal(afterInvulnerability.contactEvents.length, 1);
});

test('contact knockback always pushes the player away from the monster', () => {
  resetWorldRuntime();
  const initial = updatePresence({
    userId: 'rear-contact-user',
    nickname: 'rear-contact-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'moving',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 5_000
  });
  const monster = initial.monsters.find(
    (entry) => entry.floor === 0 && entry.x >= 3 && entry.x <= 90
  );
  assert.ok(monster);

  const playerX = monster.x + 0.5;
  const hitFromBehind = updatePresence({
    userId: 'rear-contact-user',
    nickname: 'rear-contact-user',
    mapId: 'newcomer_training',
    x: playerX,
    floor: 0,
    activity: 'moving',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 5_100
  });
  assert.equal(hitFromBehind.contactEvents.length, 1);
  assert.equal(
    hitFromBehind.contactEvents[0].x,
    Math.min(94, playerX + PLAYER_CONTACT_KNOCKBACK_DISTANCE)
  );
});

test('stealth prevents contact damage and is removed when the player attacks', () => {
  const initial = updatePresence({
    userId: 'stealth-user',
    nickname: '잠복사원',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    stealth: 0,
    now: 1_000
  });
  const monster = initial.monsters.find((entry) => entry.floor === 0);
  assert.equal(setPlayerStealth('stealth-user', 'newcomer_training', true), true);
  const hidden = updatePresence({
    userId: 'stealth-user',
    nickname: '잠복사원',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });
  assert.equal(hidden.contactEvents.length, 0);
  assert.equal(hidden.players.find((player) => player.userId === 'stealth-user')?.stealth, true);
  const result = attackMonster({
    userId: 'stealth-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: 1,
    rangePx: 1_000,
    piercing: true,
    now: 1_200
  });
  assert.equal(result.success, true);
  assert.equal(result.players.find((player) => player.userId === 'stealth-user')?.stealth, false);

  const revealed = updatePresence({
    userId: 'stealth-user',
    nickname: '잠복사원',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: 0,
    activity: 'idle',
    currentHp: 120,
    maxHp: 120,
    stealth: 0,
    now: 1_300
  });
  assert.equal(revealed.contactEvents.length, 1);
});

test('passive dodge prevents contact damage and knockback', () => {
  resetWorldRuntime();
  const initial = updatePresence({
    userId: 'dodge-user',
    nickname: '회피사원',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    dodgeChance: 100,
    now: 1_000
  });
  const monster = initial.monsters.find((entry) => entry.floor === 0);
  const state = updatePresence({
    userId: 'dodge-user',
    nickname: '회피사원',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    dodgeChance: 100,
    now: 1_100
  });
  assert.equal(state.contactEvents.length, 1);
  assert.equal(state.contactEvents[0].dodged, true);
  assert.equal(state.contactEvents[0].damage, 0);
  assert.equal(state.contactEvents[0].currentHp, 120);
  assert.equal(state.contactEvents[0].x, monster.x);
});

test('moving across a monster applies swept contact damage instead of tunneling through it', () => {
  const initial = updatePresence({
    userId: 'moving-contact-user',
    nickname: 'moving-contact-user',
    mapId: 'newcomer_training',
    x: 0,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const floorGroups = [0, 1].map((floor) => (
    initial.monsters.filter((monster) => monster.floor === floor).sort((a, b) => a.x - b.x)
  ));
  const monsters = floorGroups.sort((a, b) => b.length - a.length)[0];
  const target = monsters[0];
  const startX = Math.max(0, target.x - 7);
  updatePresence({
    userId: 'moving-contact-user',
    nickname: 'moving-contact-user',
    mapId: 'newcomer_training',
    x: startX,
    floor: target.floor,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_050
  });

  const crossed = updatePresence({
    userId: 'moving-contact-user',
    nickname: 'moving-contact-user',
    mapId: 'newcomer_training',
    x: Math.min(94, target.x + 7),
    floor: target.floor,
    activity: 'moving',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_100
  });

  assert.equal(crossed.contactEvents.length, 1);
  assert.ok(monsters.some((monster) => monster.id === crossed.contactEvents[0].monsterId));
  assert.ok(crossed.contactEvents[0].damage > 0);
});

test('a single hit dealing at least forty percent of max HP knocks a monster back', () => {
  const state = updatePresence({
    userId: 'heavy-user',
    nickname: 'heavy-user',
    mapId: 'newcomer_training',
    x: 20,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: 'heavy-user',
    nickname: 'heavy-user',
    mapId: 'newcomer_training',
    x: monster.x - 2,
    currentHp: 120,
    maxHp: 120,
    now: 1_050
  });
  const result = attackMonster({
    userId: 'heavy-user',
    mapId: 'newcomer_training',
    monsterId: monster.id,
    damage: Math.ceil(monster.maxHp * 0.4) + monster.physicalDefense,
    rangePx: 1_000,
    piercing: true,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.equal(result.knockedBack, true);
  assert.equal(result.defeated, false);
});

test('multi-target skills use the same forty-percent knockback threshold', () => {
  const state = updatePresence({
    userId: 'skill-user',
    nickname: 'skill-user',
    mapId: 'newcomer_training',
    x: 50,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const result = useSkillOnMonsters({
    userId: 'skill-user',
    mapId: 'newcomer_training',
    baseDamage: 999,
    skillPercent: 100,
    rangePx: 1_000,
    maxTargets: 4,
    leaveAtOneHp: true,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.ok(result.outcomes.some((outcome) => outcome.knockedBack));
});

test('progressive piercing attacks travel forward and increase damage for every target', () => {
  const originalRandom = Math.random;
  let state;
  try {
    Math.random = () => 0.9;
    state = updatePresence({
      userId: 'piercing-user',
      nickname: '회계 사원',
      mapId: 'newcomer_training',
      x: 2,
      floor: 0,
      facingLeft: false,
      currentHp: 120,
      maxHp: 120,
      now: 1_000
    });
  } finally {
    Math.random = originalRandom;
  }
  const target = [...state.monsters].sort((left, right) => left.x - right.x)[0];
  const result = useSkillOnMonsters({
    userId: 'piercing-user',
    mapId: 'newcomer_training',
    targetId: target.id,
    baseDamage: 10,
    skillPercent: 250,
    rangePx: 10_000,
    maxTargets: 6,
    ignoreDefense: true,
    piercing: true,
    progressivePiercing: true,
    progressiveStartPercent: 250,
    progressiveEndPercent: 850,
    verticalFloorRange: 1,
    leaveAtOneHp: true,
    now: 1_100
  });

  assert.equal(result.success, true);
  assert.equal(result.progressivePiercing, true);
  assert.ok(result.outcomes.length >= 3);
  assert.deepEqual(
    result.outcomes.map((outcome) => outcome.piercingDamagePercent),
    [250, 370, 490, 610].slice(0, result.outcomes.length)
  );
  assert.deepEqual(
    result.outcomes.map((outcome) => outcome.piercingIndex),
    result.outcomes.map((_, index) => index)
  );
  assert.ok(result.outcomes.every((outcome, index, outcomes) => (
    index === 0 || outcome.damage > outcomes[index - 1].damage
  )));
  assert.ok(result.outcomes.every((outcome) => Number.isFinite(outcome.targetX)));
});

test('progressive piercing selects the nearest target when the caster faces an empty direction', () => {
  const originalRandom = Math.random;
  let state;
  try {
    Math.random = () => 0.9;
    state = updatePresence({
      userId: 'reverse-piercing-user',
      nickname: '역방향 회계 사원',
      mapId: 'newcomer_training',
      x: 92,
      floor: 0,
      facingLeft: false,
      currentHp: 120,
      maxHp: 120,
      now: 1_000
    });
  } finally {
    Math.random = originalRandom;
  }
  assert.ok(state.monsters.some((monster) => monster.x < 92));

  const result = useSkillOnMonsters({
    userId: 'reverse-piercing-user',
    mapId: 'newcomer_training',
    targetId: '',
    baseDamage: 10,
    skillPercent: 250,
    rangePx: 10_000,
    maxTargets: 6,
    ignoreDefense: true,
    piercing: true,
    progressivePiercing: true,
    progressiveStartPercent: 250,
    progressiveEndPercent: 850,
    verticalFloorRange: 1,
    leaveAtOneHp: true,
    now: 1_100
  });

  assert.equal(result.success, true);
  assert.equal(result.facingLeft, true);
  assert.ok(result.outcomes.length > 0);
  assert.ok(result.outcomes.every((outcome) => outcome.targetX < 92));
});

test('decoy summons pull normal monster aggro and receive contact damage first', () => {
  const initial = updatePresence({
    userId: 'decoy-owner',
    nickname: '궁수 사원',
    mapId: 'newcomer_training',
    x: 8,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = initial.monsters.find((entry) => entry.floor === 0);
  assert.ok(monster);

  const state = updatePresence({
    userId: 'decoy-owner',
    nickname: '궁수 사원',
    mapId: 'newcomer_training',
    x: monster.x - 2.8,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    summon: {
      skillId: 'extended_a882003cc1',
      name: '대체 장부',
      icon: '📒',
      role: 'decoy',
      summonHp: 100,
      maxSummonHp: 100,
      createdAt: 1_000,
      expiresAt: 60_000
    },
    now: 1_100
  });

  assert.equal(state.contactEvents.length, 0);
  assert.ok(state.summonEvents.length >= 1);
  assert.ok(state.summonEvents.every((event) => event.userId === 'decoy-owner'));
  const totalSummonDamage = state.summonEvents.reduce(
    (total, event) => total + Number(event.damage || 0),
    0
  );
  const expectedSummonHp = Math.max(0, 100 - totalSummonDamage);
  assert.equal(state.summonEvents.at(-1).summonHp, expectedSummonHp);
  assert.equal(state.players[0].currentHp, 120);
  assert.equal(state.players[0].summon.summonHp, expectedSummonHp);
});

test('an attacking summon cannot replace mascot aggro', () => {
  const initial = updatePresence({
    userId: 'dual-summon-owner',
    nickname: '마케팅 사원',
    mapId: 'newcomer_training',
    x: 8,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = initial.monsters.find((entry) => entry.floor === 0);
  assert.ok(monster);

  const state = updatePresence({
    userId: 'dual-summon-owner',
    nickname: '마케팅 사원',
    mapId: 'newcomer_training',
    x: monster.x + 2.8,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 120,
    maxHp: 120,
    summon: {
      skillId: 'extended_472a2a7dea',
      name: '홍보 드론',
      icon: '📣',
      role: 'attacker',
      summonHp: 1,
      maxSummonHp: 1,
      createdAt: 1_001,
      expiresAt: 60_000
    },
    decoySummon: {
      skillId: 'extended_41300a062e',
      name: '마스코트 배치',
      icon: '🧸',
      role: 'decoy',
      summonHp: 100,
      maxSummonHp: 100,
      createdAt: 1_000,
      expiresAt: 60_000
    },
    now: 1_100
  });

  assert.equal(state.contactEvents.length, 0);
  assert.ok(state.summonEvents.length >= 1);
  assert.ok(state.summonEvents.every(
    (event) => event.skillId === 'extended_41300a062e'
  ));
  assert.equal(state.players[0].currentHp, 120);
  assert.equal(state.players[0].summon.skillId, 'extended_472a2a7dea');
  assert.equal(state.players[0].decoySummon.skillId, 'extended_41300a062e');
  assert.equal(state.players[0].summons.length, 2);
});

test('field boss ranged attacks prioritize an active decoy over players', () => {
  updatePresence({
    userId: 'boss-decoy-owner',
    nickname: '보스 궁수',
    mapId: 'hidden_hwang_overtime',
    x: 40,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 5_000,
    maxHp: 5_000,
    summon: {
      skillId: 'extended_41300a062e',
      name: '마스코트 배치',
      icon: '🧸',
      role: 'decoy',
      summonHp: 6_000,
      maxSummonHp: 6_000,
      createdAt: 1_000,
      expiresAt: 60_000
    },
    now: 1_000
  });
  const state = updatePresence({
    userId: 'boss-decoy-owner',
    nickname: '보스 궁수',
    mapId: 'hidden_hwang_overtime',
    x: 40,
    floor: 0,
    activity: 'idle',
    facingLeft: false,
    currentHp: 5_000,
    maxHp: 5_000,
    summon: {
      skillId: 'extended_41300a062e',
      name: '마스코트 배치',
      icon: '🧸',
      role: 'decoy',
      summonHp: 6_000,
      maxSummonHp: 6_000,
      createdAt: 1_000,
      expiresAt: 60_000
    },
    now: 5_001
  });

  const rangedEvent = state.summonEvents.find((event) => event.source === 'field-boss-ranged');
  assert.ok(rangedEvent);
  assert.equal(rangedEvent.damage, 1_500);
  assert.equal(state.contactEvents.some((event) => event.source === 'field-boss-ranged'), false);
  assert.equal(state.players[0].currentHp, 5_000);
});

test('global shout stays visible for exactly its ten-second broadcast window', () => {
  const shout = publishGlobalShout({
    userId: 'shouter',
    nickname: '외침 사원',
    message: '  모두   회의실로!  ',
    now: 10_000
  });
  assert.equal(shout.message, '모두 회의실로!');
  assert.equal(getGlobalShout(19_999).id, shout.id);
  assert.equal(getGlobalShout(20_000), null);
});

test('channeled skills return one mastery and critical result per visible hit', () => {
  const state = updatePresence({
    userId: 'channel-user',
    nickname: 'channel-user',
    mapId: 'newcomer_training',
    x: 50,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  updatePresence({
    userId: 'channel-user',
    nickname: 'channel-user',
    mapId: 'newcomer_training',
    x: monster.x,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_050
  });
  const result = useSkillOnMonsters({
    userId: 'channel-user',
    mapId: 'newcomer_training',
    targetId: monster.id,
    baseDamage: 1,
    damageRange: { minimum: 2, maximum: 4 },
    skillPercent: 100,
    rangePx: 1_000,
    hits: 3,
    leaveAtOneHp: true,
    criticalChance: 100,
    criticalDamagePercent: 200,
    rollCriticalPerHit: true,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.equal(result.outcomes[0].hitResults.length, 3);
  assert.ok(result.outcomes[0].hitResults.every((hit) => hit.critical));
  assert.ok(result.outcomes[0].hitResults.every((hit) => hit.damage > 0));
});

test('channeled projectiles retarget the next front monster after a kill', () => {
  const originalRandom = Math.random;
  let state;
  try {
    Math.random = () => 0.9;
    state = updatePresence({
      userId: 'channel-retarget-user',
      nickname: 'channel-retarget-user',
      mapId: 'newcomer_training',
      x: 50,
      floor: 0,
      currentHp: 120,
      maxHp: 120,
      now: 1_000
    });
  } finally {
    Math.random = originalRandom;
  }
  const firstTarget = state.monsters[0];
  assert.equal(firstTarget.maxHp, 30);

  const result = useSkillOnMonsters({
    userId: 'channel-retarget-user',
    mapId: 'newcomer_training',
    targetId: firstTarget.id,
    baseDamage: 8,
    skillPercent: 100,
    rangePx: 10_000,
    hits: 10,
    ignoreDefense: true,
    retargetEachHit: true,
    now: 1_100
  });
  const hitResults = result.outcomes.flatMap((outcome) => outcome.hitResults || []);
  const firstMonsterId = hitResults[0].monsterId;
  const secondMonsterId = hitResults[4].monsterId;

  assert.equal(result.success, true);
  assert.equal(hitResults.length, 10);
  assert.deepEqual(hitResults.map((hit) => hit.projectileIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(hitResults.slice(0, 4).map((hit) => hit.monsterId), [
    firstMonsterId,
    firstMonsterId,
    firstMonsterId,
    firstMonsterId
  ]);
  assert.notEqual(secondMonsterId, firstMonsterId);
  assert.deepEqual(hitResults.slice(4).map((hit) => hit.monsterId), [
    secondMonsterId,
    secondMonsterId,
    secondMonsterId,
    secondMonsterId,
    secondMonsterId,
    secondMonsterId
  ]);
  assert.equal(hitResults[3].defeated, true);
  assert.equal(hitResults[4].remainingHp, hitResults[4].maxHp - 8);
  assert.equal(hitResults[9].remainingHp, hitResults[9].maxHp - 48);
});

test('channeled projectiles turn around when only rear monsters remain', () => {
  const state = updatePresence({
    userId: 'channel-turn-user',
    nickname: 'channel-turn-user',
    mapId: 'newcomer_training',
    x: 50,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const floorMonsters = [...state.monsters].sort((left, right) => left.x - right.x);
  assert.ok(floorMonsters.length >= 2);
  const midpoint = (floorMonsters[0].x + floorMonsters.at(-1).x) / 2;
  updatePresence({
    userId: 'channel-turn-user',
    nickname: 'channel-turn-user',
    mapId: 'newcomer_training',
    x: midpoint,
    floor: 0,
    facingLeft: true,
    currentHp: 120,
    maxHp: 120,
    now: 1_050
  });

  const result = useSkillOnMonsters({
    userId: 'channel-turn-user',
    mapId: 'newcomer_training',
    targetId: floorMonsters[0].id,
    baseDamage: 999,
    rangePx: 10_000,
    hits: 10,
    ignoreDefense: true,
    retargetEachHit: true,
    verticalFloorRange: 1,
    now: 1_100
  });
  const hits = result.outcomes.flatMap((outcome) => outcome.hitResults || []);
  assert.equal(result.success, true);
  assert.equal(hits[0].facingLeft, true);
  assert.ok(hits.some((hit) => hit.facingLeft === false));
});

test('vertical floor range allows a genesis-style skill to hit one floor above', () => {
  const originalRandom = Math.random;
  let state;
  try {
    Math.random = () => 0;
    state = updatePresence({
      userId: 'vertical-user',
      nickname: 'vertical-user',
      mapId: 'newcomer_training',
      x: 50,
      floor: 0,
      currentHp: 120,
      maxHp: 120,
      now: 1_000
    });
  } finally {
    Math.random = originalRandom;
  }
  const upper = state.monsters.find((entry) => entry.floor === 1);
  assert.ok(upper);
  const result = useSkillOnMonsters({
    userId: 'vertical-user',
    mapId: 'newcomer_training',
    targetId: upper.id,
    baseDamage: 10,
    rangePx: 10_000,
    maxTargets: 15,
    verticalFloorRange: 1,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.ok(result.outcomes.some((outcome) => outcome.monsterId === upper.id));
});

test('work reduction applies its outgoing damage debuff to normal monsters', () => {
  const state = updatePresence({
    userId: 'work-reduction-user',
    nickname: 'work-reduction-user',
    mapId: 'newcomer_training',
    x: 50,
    floor: 0,
    currentHp: 120,
    maxHp: 120,
    now: 1_000
  });
  const monster = state.monsters.find((entry) => entry.floor === 0);
  assert.ok(monster);
  const result = useSkillOnMonsters({
    userId: 'work-reduction-user',
    mapId: 'newcomer_training',
    targetId: monster.id,
    baseDamage: 0,
    rangePx: 10_000,
    dealDamage: false,
    outgoingDamageReductionPercent: 50,
    debuffChance: 100,
    debuffDurationSeconds: 20,
    now: 1_100
  });
  assert.equal(result.success, true);
  assert.equal(result.outcomes[0].debuffApplied, true);
  assert.equal(result.outcomes[0].monster.outgoingDamageReductionPercent, 50);
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

test('periodic and idle warrior passives schedule healing on their server intervals', () => {
  resetWorldRuntime();
  claimWorldControl('regen-user', 'regen-client', 1_000);
  const base = {
    userId: 'regen-user',
    nickname: '회복사원',
    mapId: 'main_lobby',
    x: 10,
    floor: 0,
    facingLeft: false,
    currentHp: 100,
    maxHp: 1000,
    playerLevel: 30,
    playerStats: {},
    clientId: 'regen-client',
    periodicHealPercent: 2,
    periodicHealIntervalMs: 10_000,
    idleHealAmount: 30,
    idleHealIntervalMs: 5_000
  };
  assert.deepEqual(updatePresence({ ...base, activity: 'idle', now: 1_000 }).recoveryEvents, []);
  const firstIdle = updatePresence({ ...base, activity: 'idle', now: 6_000 });
  assert.equal(firstIdle.recoveryEvents[0].amount, 30);
  const periodic = updatePresence({ ...base, activity: 'combat', now: 11_000 });
  assert.equal(periodic.recoveryEvents[0].amount, 20);
  const resetIdle = updatePresence({ ...base, activity: 'idle', now: 12_000 });
  assert.deepEqual(resetIdle.recoveryEvents, []);
  const secondIdle = updatePresence({ ...base, activity: 'idle', now: 17_000 });
  assert.equal(secondIdle.recoveryEvents[0].amount, 30);
});

test('strong mind schedules MP recovery every ten seconds', () => {
  const base = {
    userId: 'mind-user',
    nickname: '현장소장',
    mapId: 'main_lobby',
    x: 10,
    floor: 0,
    activity: 'combat',
    currentHp: 500,
    maxHp: 500,
    currentMp: 20,
    maxMp: 200,
    periodicMpAmount: 30,
    periodicMpIntervalMs: 10_000
  };
  assert.deepEqual(updatePresence({ ...base, now: 1_000 }).recoveryEvents, []);
  const recovered = updatePresence({ ...base, now: 11_000 });
  assert.equal(recovered.recoveryEvents[0].mpAmount, 30);
});
