'use strict';

const crypto = require('crypto');
const { getWorldMap } = require('./mapDefinitions');

const PLAYER_TIMEOUT_MS = 12_000;
const CONTACT_COOLDOWN_MS = 1_200;
const CONTACT_INVULNERABILITY_MS = 1_500;
const MONSTER_SPAWN_INTERVAL_MS = 8_000;
const MONSTER_MAX_PER_MAP = 16;
const MONSTER_SPAWN_PER_WAVE = 4;
const ASSUMED_STAGE_WIDTH_PX = 760;

const TEST_MONSTER_NAMES = Object.freeze([
  '도망친 결재도장',
  '불량 복합기',
  '야근 서류뭉치',
  '폭주한 계산기'
]);

const activeMaps = new Map();

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function buildMonsterStats(level) {
  return {
    maxHp: 30,
    contactDamage: 10,
    physicalDefense: 1,
    magicDefense: 1,
    movementSpeed: 35,
    expReward: 1
  };
}

function mapHasUpperFloor(map) {
  return Boolean(map && (
    map.connections.length > 2
    || map.features.includes('ladder')
    || map.features.includes('rope')
  ));
}

function createMonster(map, index, now) {
  const level = 3;
  const stats = buildMonsterStats(level);
  const upper = mapHasUpperFloor(map) && Math.random() < 0.3;
  return {
    id: crypto.randomUUID(),
    name: TEST_MONSTER_NAMES[index % TEST_MONSTER_NAMES.length],
    level,
    hp: stats.maxHp,
    ...stats,
    x: upper ? randomBetween(49, 70) : randomBetween(18, 82),
    floor: upper ? 1 : 0,
    direction: Math.random() < 0.5 ? -1 : 1,
    state: 'idle',
    decisionAt: now + randomBetween(800, 2_600),
    aggroTargetId: ''
  };
}

function createMapRuntime(mapId, now) {
  return {
    mapId,
    players: new Map(),
    monsters: [],
    lastTickAt: now,
    nextSpawnAt: now,
    spawnSequence: 0
  };
}

function serializeMonster(monster) {
  return {
    id: monster.id,
    name: monster.name,
    level: monster.level,
    hp: monster.hp,
    maxHp: monster.maxHp,
    contactDamage: monster.contactDamage,
    physicalDefense: monster.physicalDefense,
    magicDefense: monster.magicDefense,
    movementSpeed: monster.movementSpeed,
    expReward: monster.expReward,
    x: monster.x,
    floor: monster.floor,
    direction: monster.direction,
    state: monster.state
  };
}

function serializePlayer(player) {
  return {
    userId: player.userId,
    nickname: player.nickname,
    x: player.x,
    floor: player.floor,
    activity: player.activity,
    motion: player.motion,
    facingLeft: player.facingLeft,
    currentHp: player.currentHp,
    maxHp: player.maxHp,
    invulnerableUntil: player.invulnerableUntil,
    isDead: player.currentHp <= 0
  };
}

function removePlayerFromOtherMaps(userId, exceptMapId) {
  for (const [mapId, runtime] of activeMaps) {
    if (mapId !== exceptMapId) runtime.players.delete(userId);
  }
}

function cleanupInactiveMaps(now) {
  for (const [mapId, runtime] of activeMaps) {
    for (const [userId, player] of runtime.players) {
      if (now - player.lastSeenAt > PLAYER_TIMEOUT_MS) runtime.players.delete(userId);
    }
    if (!runtime.players.size) {
      runtime.monsters = [];
      activeMaps.delete(mapId);
    }
  }
}

function spawnMonstersIfNeeded(runtime, map, now) {
  if (map.safeZone) {
    runtime.monsters = [];
    runtime.nextSpawnAt = now + MONSTER_SPAWN_INTERVAL_MS;
    return;
  }
  if (!runtime.players.size || now < runtime.nextSpawnAt) return;
  const availableSlots = Math.max(0, MONSTER_MAX_PER_MAP - runtime.monsters.length);
  const spawnCount = Math.min(MONSTER_SPAWN_PER_WAVE, availableSlots);
  for (let index = 0; index < spawnCount; index += 1) {
    runtime.monsters.push(createMonster(map, runtime.spawnSequence, now));
    runtime.spawnSequence += 1;
  }
  runtime.nextSpawnAt = now + MONSTER_SPAWN_INTERVAL_MS;
}

function chooseWanderAction(monster, map, now) {
  const roll = Math.random();
  if (monster.floor === 1 && roll < 0.13) {
    monster.floor = 0;
    monster.state = 'fall';
    monster.decisionAt = now + 650;
    return;
  }
  if (roll < 0.4) {
    monster.state = 'idle';
  } else {
    monster.direction = Math.random() < 0.5 ? -1 : 1;
    monster.state = monster.direction < 0 ? 'walk-left' : 'walk-right';
  }
  monster.decisionAt = now + randomBetween(900, 3_200);
  if (monster.floor === 1 && !mapHasUpperFloor(map)) monster.floor = 0;
}

function advanceMonster(monster, runtime, map, deltaSeconds, now) {
  if (monster.hp <= 0) return;

  const target = monster.aggroTargetId && runtime.players.get(monster.aggroTargetId);
  if (target && target.floor === monster.floor) {
    const difference = target.x - monster.x;
    if (Math.abs(difference) > 2.2) {
      monster.direction = difference < 0 ? -1 : 1;
      monster.state = 'chase';
      const step = monster.movementSpeed / ASSUMED_STAGE_WIDTH_PX * 100 * deltaSeconds;
      monster.x += Math.sign(difference) * Math.min(Math.abs(difference), step);
    } else {
      monster.state = 'idle';
    }
    return;
  }

  if (now >= monster.decisionAt) chooseWanderAction(monster, map, now);
  if (monster.state === 'walk-left' || monster.state === 'walk-right') {
    const minimum = monster.floor === 1 ? 48 : 7;
    const maximum = monster.floor === 1 ? 71 : 88;
    const step = monster.movementSpeed / ASSUMED_STAGE_WIDTH_PX * 100 * deltaSeconds;
    monster.x = clamp(monster.x + monster.direction * step, minimum, maximum);
    if (monster.x <= minimum || monster.x >= maximum) {
      monster.direction *= -1;
      monster.state = monster.direction < 0 ? 'walk-left' : 'walk-right';
    }
  }
}

function applyContactDamage(runtime, now) {
  const damagedPlayers = [];
  for (const player of runtime.players.values()) {
    if (player.currentHp <= 0) continue;
    if (now < player.invulnerableUntil) continue;
    if (player.lastContactAt && now - player.lastContactAt < CONTACT_COOLDOWN_MS) continue;
    const collider = runtime.monsters.find((monster) => (
      monster.hp > 0
      && monster.floor === player.floor
      && Math.abs(monster.x - player.x) <= 3.2
    ));
    if (!collider) continue;
    player.currentHp = Math.max(0, player.currentHp - collider.contactDamage);
    player.lastContactAt = now;
    player.invulnerableUntil = now + CONTACT_INVULNERABILITY_MS;
    const knockbackDirection = player.facingLeft ? 1 : -1;
    player.x = clamp(player.x + knockbackDirection * 3.2, 0, 94);
    damagedPlayers.push({
      userId: player.userId,
      damage: collider.contactDamage,
      monsterId: collider.id,
      currentHp: player.currentHp,
      maxHp: player.maxHp,
      x: player.x,
      invulnerableUntil: player.invulnerableUntil
    });
  }
  return damagedPlayers;
}

function tickRuntime(runtime, now) {
  const map = getWorldMap(runtime.mapId);
  if (!map) return [];
  const deltaSeconds = Math.max(0, Math.min(2, (now - runtime.lastTickAt) / 1000));
  runtime.lastTickAt = now;
  runtime.monsters = map.safeZone
    ? []
    : runtime.monsters.filter((monster) => monster.hp > 0);
  spawnMonstersIfNeeded(runtime, map, now);
  runtime.monsters.forEach((monster) => advanceMonster(monster, runtime, map, deltaSeconds, now));
  return applyContactDamage(runtime, now);
}

function updatePresence({
  userId,
  nickname,
  mapId,
  x,
  floor,
  activity,
  motion,
  facingLeft,
  currentHp,
  maxHp,
  now = Date.now()
}) {
  cleanupInactiveMaps(now);
  const map = getWorldMap(mapId);
  if (!map) throw new Error('존재하지 않는 맵입니다.');
  removePlayerFromOtherMaps(userId, mapId);
  let runtime = activeMaps.get(mapId);
  if (!runtime) {
    runtime = createMapRuntime(mapId, now);
    activeMaps.set(mapId, runtime);
  }
  const previous = runtime.players.get(userId);
  const resolvedHp = Math.max(0, Number(previous?.currentHp ?? currentHp) || 0);
  runtime.players.set(userId, {
    userId,
    nickname: String(nickname || '사원').slice(0, 16),
    x: clamp(x, 0, 94),
    floor: Number(floor) === 1 ? 1 : 0,
    activity: resolvedHp <= 0
      ? 'dead'
      : (['idle', 'moving', 'combat'].includes(activity) ? activity : 'idle'),
    motion: resolvedHp <= 0 ? 'dead' : String(motion || ''),
    facingLeft: Boolean(facingLeft),
    currentHp: resolvedHp,
    maxHp: Math.max(1, Number(previous?.maxHp ?? maxHp) || 120),
    lastContactAt: previous?.lastContactAt || 0,
    invulnerableUntil: previous?.invulnerableUntil || 0,
    lastSeenAt: now
  });
  const contactEvents = tickRuntime(runtime, now);
  return {
    mapId,
    players: Array.from(runtime.players.values()).map(serializePlayer),
    monsters: runtime.monsters.filter((monster) => monster.hp > 0).map(serializeMonster),
    contactEvents
  };
}

function attackMonster({
  userId,
  mapId,
  monsterId,
  damage,
  rangePx,
  damageType = 'physical',
  now = Date.now()
}) {
  cleanupInactiveMaps(now);
  const runtime = activeMaps.get(mapId);
  if (!runtime) return { success: false, reason: 'inactive-map' };
  tickRuntime(runtime, now);
  const player = runtime.players.get(userId);
  const monster = runtime.monsters.find((entry) => entry.id === monsterId && entry.hp > 0);
  if (!player || !monster) return { success: false, reason: 'missing-target' };
  if (player.currentHp <= 0) return { success: false, reason: 'dead' };
  if (player.floor !== monster.floor) return { success: false, reason: 'different-floor' };
  const rangePercent = Math.max(1, Number(rangePx) || 22) / ASSUMED_STAGE_WIDTH_PX * 100;
  if (Math.abs(player.x - monster.x) > rangePercent + 4.5) {
    return { success: false, reason: 'out-of-range' };
  }

  const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
  const finalDamage = Math.max(1, Math.floor(Math.max(1, Number(damage) || 1) - defense * 0.5));
  monster.hp = Math.max(0, monster.hp - finalDamage);
  monster.aggroTargetId = userId;
  monster.state = 'chase';
  const defeated = monster.hp <= 0;
  if (defeated) {
    monster.state = 'defeated';
    monster.aggroTargetId = '';
  }
  return {
    success: true,
    damage: finalDamage,
    defeated,
    expReward: defeated ? monster.expReward : 0,
    monster: defeated ? null : serializeMonster(monster),
    players: Array.from(runtime.players.values()).map(serializePlayer),
    monsters: runtime.monsters.filter((entry) => entry.hp > 0).map(serializeMonster)
  };
}

function updatePlayerResources(userId, resources = {}) {
  for (const runtime of activeMaps.values()) {
    const player = runtime.players.get(String(userId));
    if (!player) continue;
    if (Number.isFinite(Number(resources.currentHp))) {
      player.currentHp = Math.max(0, Number(resources.currentHp));
      if (player.currentHp <= 0) {
        player.activity = 'dead';
        player.motion = 'dead';
      }
    }
    if (Number.isFinite(Number(resources.maxHp))) {
      player.maxHp = Math.max(1, Number(resources.maxHp));
    }
  }
}

function leaveWorld(userId) {
  removePlayerFromOtherMaps(userId, '');
  cleanupInactiveMaps(Date.now());
}

function resetWorldRuntime() {
  activeMaps.clear();
}

module.exports = {
  PLAYER_TIMEOUT_MS,
  CONTACT_COOLDOWN_MS,
  CONTACT_INVULNERABILITY_MS,
  MONSTER_SPAWN_INTERVAL_MS,
  MONSTER_MAX_PER_MAP,
  MONSTER_SPAWN_PER_WAVE,
  TEST_MONSTER_NAMES,
  buildMonsterStats,
  updatePresence,
  attackMonster,
  updatePlayerResources,
  leaveWorld,
  resetWorldRuntime
};
