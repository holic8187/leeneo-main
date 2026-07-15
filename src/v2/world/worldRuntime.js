'use strict';

const crypto = require('crypto');
const { getWorldMap } = require('./mapDefinitions');
const {
  MONSTER_CATALOG,
  buildMonsterStats,
  getElementMultiplier,
  getMonsterSpeciesForMap,
  rollMonsterDrops
} = require('./monsterCatalog');
const {
  EQUIPMENT_ITEMS,
  rollEquipmentInstanceData
} = require('../items/equipmentCatalog');
const { EQUIPMENT_SCROLLS } = require('../items/scrollCatalog');
const {
  calculateIncomingPhysicalDamage,
  splitDamageWithMpGuard
} = require('../combat/incomingDamage');
const {
  calculateRequiredAccuracy,
  calculateHitChance,
  calculateMagicDamageAfterDefense
} = require('../combat/combatFormulas');

const PLAYER_TIMEOUT_MS = 12_000;
const CONTACT_COOLDOWN_MS = 1_200;
const CONTACT_INVULNERABILITY_MS = 2_000;
const PLAYER_CONTACT_KNOCKBACK_DISTANCE = 2.56;
const MONSTER_SPAWN_INTERVAL_MS = 8_000;
const MONSTER_MAX_PER_MAP = 10;
const MONSTER_SPAWN_PER_WAVE = 4;
const ASSUMED_STAGE_WIDTH_PX = 760;
const PLAYER_VISUAL_WIDTH_PX = 19;
const MONSTER_VISUAL_WIDTH_PX = 36;

const activeMaps = new Map();
const worldControllers = new Map();
const fieldBossRespawns = new Map();

const FIELD_BOSS_RESPAWN_MIN_MS = 90 * 60 * 1000;
const FIELD_BOSS_RESPAWN_MAX_MS = 180 * 60 * 1000;
const FIELD_BOSS_DEFINITIONS = Object.freeze({
  mad_hwang_manager: Object.freeze({
    id: 'mad_hwang_manager',
    name: '야근하다 미쳐버린 황과장',
    icon: '🧟‍♂️',
    level: 60,
    maxHp: 500_000,
    maxMp: 0,
    contactDamage: 2_000,
    physicalDefense: 500,
    magicDefense: 500,
    monsterEvasion: 40,
    monsterAccuracy: 75,
    movementSpeed: 34,
    expReward: 300_000,
    visualScale: 2,
    rangedIntervalMs: 4_000,
    rangedDamage: 1_500,
    rangedRangePx: 1_000,
    silenceIntervalMs: 15_000,
    silenceDurationMs: 10_000
  })
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function pickRandom(array, random = Math.random) {
  if (!Array.isArray(array) || !array.length) return null;
  return array[Math.floor(random() * array.length)] || array[0];
}

function getFieldBossDefinition(fieldBossId) {
  return FIELD_BOSS_DEFINITIONS[String(fieldBossId || '')] || null;
}

function findScrollDrop(predicate, chance) {
  const scroll = EQUIPMENT_SCROLLS.find(predicate);
  if (!scroll) return null;
  return {
    kind: 'item',
    itemId: scroll.id,
    quantity: 1,
    icon: scroll.icon,
    name: scroll.name,
    chance
  };
}

function getHwangFieldBossDrops() {
  return [
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'gloves'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.attack) === 2
    ), 0.003),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'helmet'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.maxHp) === 10
    ), 0.005),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'helmet'
      && Number(scroll.successRate) === 100
      && Number(scroll.scrollStats?.processingSpeed) === 1
    ), 0.004),
    findScrollDrop((scroll) => (
      scroll.applicableWeaponType === 'staff'
      && Number(scroll.successRate) === 10
      && Number(scroll.scrollStats?.magic) === 5
    ), 0.007),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'gloves'
      && Number(scroll.successRate) === 10
      && Number(scroll.scrollStats?.attack) === 3
    ), 0.001),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'shoes'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.movementSpeed) === 2
    ), 0.003),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'shoes'
      && Number(scroll.successRate) === 10
      && Number(scroll.scrollStats?.movementSpeed) === 3
    ), 0.002)
  ].filter(Boolean);
}

function getFieldBossWeaponPool() {
  return EQUIPMENT_ITEMS.filter((item) => {
    if (!item || item.category !== 'equipment' || item.itemType !== 'weapon') return false;
    if (item.bossDropOnly) return false;
    const requiredLevel = Number(item.requiredLevel || item.requirements?.level) || 1;
    return requiredLevel >= 60 && requiredLevel <= 70;
  });
}

function scheduleFieldBossRespawn(mapId, now = Date.now()) {
  const delay = FIELD_BOSS_RESPAWN_MIN_MS
    + Math.floor(Math.random() * (FIELD_BOSS_RESPAWN_MAX_MS - FIELD_BOSS_RESPAWN_MIN_MS + 1));
  const respawnAt = now + delay;
  fieldBossRespawns.set(String(mapId), respawnAt);
  return respawnAt;
}

function recordMonsterContribution(monster, userId, damage) {
  if (!monster?.fieldBoss || Number(damage) <= 0) return;
  const key = String(userId || '');
  if (!key) return;
  if (!monster.contributors || typeof monster.contributors !== 'object') monster.contributors = {};
  monster.contributors[key] = Math.max(0, Number(monster.contributors[key]) || 0)
    + Math.max(0, Math.floor(Number(damage) || 0));
}

function rollFieldBossRandomRewards() {
  const rewards = [];
  for (const drop of getHwangFieldBossDrops()) {
    if (Math.random() >= Number(drop.chance || 0)) continue;
    rewards.push({
      itemId: drop.itemId,
      quantity: Number(drop.quantity) || 1,
      name: drop.name,
      icon: drop.icon
    });
  }
  if (Math.random() < 0.05) {
    const pool = getFieldBossWeaponPool();
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let index = 0; index < count; index += 1) {
      const item = pickRandom(pool);
      if (!item) continue;
      rewards.push({
        itemId: item.id,
        quantity: 1,
        name: item.name,
        icon: item.icon,
        instanceData: rollEquipmentInstanceData(item)
      });
    }
  }
  return rewards;
}

function buildFieldBossRewardEvent(runtime, monster, mapId, defeatedBy, now = Date.now()) {
  if (!monster?.fieldBoss) return null;
  const respawnAt = scheduleFieldBossRespawn(mapId, now);
  const participants = Object.entries(monster.contributors || {})
    .map(([userId, damage]) => ({
      userId,
      damage: Math.max(0, Math.floor(Number(damage) || 0)),
      player: runtime.players.get(String(userId))
    }))
    .filter((entry) => (
      entry.damage > 0
      && entry.player
      && Number(entry.player.combatProfile?.playerLevel || 0) >= 50
    ))
    .sort((left, right) => right.damage - left.damage);
  if (!participants.length) {
    return {
      bossId: monster.fieldBossId,
      bossName: monster.name,
      mapId,
      defeatedBy: String(defeatedBy || ''),
      defeatedAt: now,
      respawnAt,
      rewards: []
    };
  }

  const totalExp = Math.max(0, Math.floor(Number(monster.expReward) || 0));
  const rewards = participants.map((participant) => ({
    userId: participant.userId,
    damage: participant.damage,
    exp: 0,
    money: 0,
    items: []
  }));
  if (rewards.length === 1) {
    rewards[0].exp = totalExp;
  } else {
    rewards[0].exp = Math.floor(totalExp * 0.4);
    const remainingExp = Math.max(0, totalExp - rewards[0].exp);
    const share = Math.floor(remainingExp / (rewards.length - 1));
    rewards.slice(1).forEach((reward) => {
      reward.exp = share;
    });
  }

  const moneyShare = Math.floor(30_000 * 5 / rewards.length);
  rewards.forEach((reward) => {
    reward.money = moneyShare;
  });

  const markReceiver = pickRandom(rewards);
  if (markReceiver) {
    markReceiver.items.push({
      itemId: 'hwang_manager_mark',
      quantity: Math.random() < 0.5 ? 1 : 2
    });
  }
  for (const item of rollFieldBossRandomRewards()) {
    const receiver = pickRandom(rewards);
    if (receiver) receiver.items.push(item);
  }

  return {
    bossId: monster.fieldBossId,
    bossName: monster.name,
    mapId,
    defeatedBy: String(defeatedBy || ''),
    defeatedAt: now,
    respawnAt,
    rewards
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
  const speciesPool = getMonsterSpeciesForMap(map);
  const species = speciesPool[index % speciesPool.length] || MONSTER_CATALOG[0];
  const stats = buildMonsterStats(species.level, species);
  const upper = mapHasUpperFloor(map) && Math.random() < 0.3;
  return {
    id: crypto.randomUUID(),
    speciesId: species.id,
    name: species.name,
    icon: species.icon,
    lootItemId: species.lootItemId,
    lootName: species.lootName,
    lootIcon: species.lootIcon,
    dropTable: species.dropTable,
    elementalMultipliers: species.elementalMultipliers,
    undead: Boolean(species.undead),
    level: species.level,
    hp: stats.maxHp,
    mp: stats.maxMp,
    ...stats,
    x: upper ? randomBetween(49, 70) : randomBetween(18, 82),
    floor: upper ? 1 : 0,
    direction: Math.random() < 0.5 ? -1 : 1,
    state: 'idle',
    spawnedAt: now,
    decisionAt: now + randomBetween(800, 2_600),
    stunnedUntil: 0,
    outgoingDamageReductionPercent: 0,
    outgoingDamageDebuffUntil: 0,
    aggroTargetId: ''
  };
}

function createFieldBoss(map, now) {
  const definition = getFieldBossDefinition(map.fieldBossId);
  if (!definition) return null;
  return {
    id: crypto.randomUUID(),
    speciesId: definition.id,
    fieldBoss: true,
    fieldBossId: definition.id,
    name: definition.name,
    icon: definition.icon,
    level: definition.level,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    mp: definition.maxMp,
    maxMp: definition.maxMp,
    contactDamage: definition.contactDamage,
    physicalDefense: definition.physicalDefense,
    magicDefense: definition.magicDefense,
    movementSpeed: definition.movementSpeed,
    expReward: definition.expReward,
    monsterAccuracy: definition.monsterAccuracy,
    monsterEvasion: definition.monsterEvasion,
    elementalMultipliers: {},
    undead: false,
    visualScale: definition.visualScale,
    x: 72,
    floor: 0,
    direction: -1,
    state: 'field-boss',
    spawnedAt: now,
    decisionAt: now + 1200,
    stunnedUntil: 0,
    outgoingDamageReductionPercent: 0,
    outgoingDamageDebuffUntil: 0,
    aggroTargetId: '',
    contributors: {},
    nextRangedAt: now + definition.rangedIntervalMs,
    nextSilenceAt: now + definition.silenceIntervalMs
  };
}

function createMapRuntime(mapId, now) {
  return {
    mapId,
    players: new Map(),
    monsters: [],
    groundLoot: [],
    fieldBossRewards: [],
    fieldBossStatusEvents: [],
    lastTickAt: now,
    nextSpawnAt: now,
    spawnSequence: 0
  };
}

function serializeMonster(monster) {
  return {
    id: monster.id,
    speciesId: monster.speciesId,
    fieldBoss: Boolean(monster.fieldBoss),
    fieldBossId: monster.fieldBossId || '',
    name: monster.name,
    icon: monster.icon,
    level: monster.level,
    hp: monster.hp,
    maxHp: monster.maxHp,
    mp: monster.mp,
    maxMp: monster.maxMp,
    contactDamage: monster.contactDamage,
    physicalDefense: monster.physicalDefense,
    magicDefense: monster.magicDefense,
    movementSpeed: monster.movementSpeed,
    expReward: monster.expReward,
    monsterAccuracy: monster.monsterAccuracy,
    monsterEvasion: monster.monsterEvasion,
    elementalMultipliers: { ...(monster.elementalMultipliers || {}) },
    undead: Boolean(monster.undead),
    x: monster.x,
    floor: monster.floor,
    direction: monster.direction,
    state: monster.state,
    spawnedAt: monster.spawnedAt,
    visualScale: Math.max(1, Number(monster.visualScale) || 1)
  };
}

function serializePlayer(player, now = Date.now()) {
  return {
    userId: player.userId,
    nickname: player.nickname,
    mapId: player.mapId,
    x: player.x,
    floor: player.floor,
    activity: player.activity,
    motion: player.motion,
    facingLeft: player.facingLeft,
    currentHp: player.currentHp,
    maxHp: player.maxHp,
    currentMp: player.currentMp,
    maxMp: player.maxMp,
    invulnerableUntil: player.invulnerableUntil,
    silencedUntil: Number(player.silencedUntil) || 0,
    stealth: Number(player.combatProfile?.stealth) > 0,
    online: now - Number(player.lastSeenAt || 0) <= PLAYER_TIMEOUT_MS,
    autoHunting: Boolean(player.autoHunting),
    recentSkill: player.recentSkill?.expiresAt > now ? { ...player.recentSkill } : null,
    jumpEvent: player.jumpEvent?.expiresAt > now ? { ...player.jumpEvent } : null,
    isDead: player.currentHp <= 0
  };
}

function serializeLoot(loot) {
  return {
    id: loot.id,
    kind: loot.kind,
    itemId: loot.itemId || '',
    quantity: loot.quantity || 0,
    amount: loot.amount || 0,
    icon: loot.icon,
    name: loot.name,
    instanceData: loot.instanceData && typeof loot.instanceData === 'object'
      ? {
        ...loot.instanceData,
        stats: { ...(loot.instanceData.stats || {}) },
        rolls: { ...(loot.instanceData.rolls || {}) }
      }
      : null,
    x: loot.x,
    floor: loot.floor,
    collectAt: loot.collectAt
  };
}

function removePlayerFromOtherMaps(userId, exceptMapId) {
  for (const [mapId, runtime] of activeMaps) {
    if (mapId !== exceptMapId) {
      runtime.players.delete(userId);
      runtime.groundLoot = runtime.groundLoot.filter(
        (loot) => String(loot.userId) !== String(userId)
      );
    }
  }
}

function cleanupInactiveMaps(now) {
  for (const [mapId, runtime] of activeMaps) {
    for (const [userId, player] of runtime.players) {
      if (now - player.lastSeenAt <= PLAYER_TIMEOUT_MS) continue;
      if (player.autoHunting && now < Number(player.autoHuntEndsAt || 0)) continue;
      runtime.players.delete(userId);
      runtime.groundLoot = runtime.groundLoot.filter(
        (loot) => String(loot.userId) !== String(userId)
      );
    }
    if (!runtime.players.size) {
      runtime.monsters = [];
      runtime.groundLoot = [];
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
  if (map.fieldBossId) {
    const hasLiveBoss = runtime.monsters.some((monster) => (
      monster.fieldBoss && monster.hp > 0
    ));
    const respawnAt = Number(fieldBossRespawns.get(map.id)) || 0;
    if (!hasLiveBoss && now >= respawnAt) {
      const boss = createFieldBoss(map, now);
      if (boss) runtime.monsters.push(boss);
    }
    runtime.nextSpawnAt = now + MONSTER_SPAWN_INTERVAL_MS;
    return;
  }
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
  if (now < Number(monster.stunnedUntil || 0)) {
    monster.state = 'stunned';
    return;
  }

  const aggroTarget = monster.aggroTargetId && runtime.players.get(monster.aggroTargetId);
  const target = Number(aggroTarget?.combatProfile?.stealth) > 0 ? null : aggroTarget;
  if (aggroTarget && !target) monster.aggroTargetId = '';
  if (target && target.floor === monster.floor) {
    const difference = target.x - monster.x;
    if (Math.abs(difference) > 2.2) {
      monster.direction = difference < 0 ? -1 : 1;
      monster.state = 'chase';
      const step = monster.movementSpeed / ASSUMED_STAGE_WIDTH_PX * 100 * deltaSeconds;
      monster.x += Math.sign(difference) * Math.min(Math.abs(difference), step);
      if (monster.floor === 1 && (monster.x <= 48 || monster.x >= 71)) {
        monster.x = clamp(monster.x, 48, 71);
        monster.floor = 0;
        monster.state = 'fall';
        monster.decisionAt = now + 650;
      } else if (monster.floor === 0) {
        monster.x = clamp(monster.x, 7, 88);
      }
    } else {
      monster.state = 'idle';
    }
    return;
  }

  if (now >= monster.decisionAt) chooseWanderAction(monster, map, now);
  if (monster.state !== 'walk-left' && monster.state !== 'walk-right') return;

  const minimum = monster.floor === 1 ? 48 : 7;
  const maximum = monster.floor === 1 ? 71 : 88;
  const step = monster.movementSpeed / ASSUMED_STAGE_WIDTH_PX * 100 * deltaSeconds;
  monster.x += monster.direction * step;

  if (monster.floor === 1 && (monster.x <= minimum || monster.x >= maximum)) {
    monster.x = clamp(monster.x, minimum, maximum);
    monster.floor = 0;
    monster.state = 'fall';
    monster.decisionAt = now + 650;
    return;
  }
  monster.x = clamp(monster.x, minimum, maximum);
  if (monster.x <= minimum || monster.x >= maximum) {
    monster.direction *= -1;
    monster.state = monster.direction < 0 ? 'walk-left' : 'walk-right';
  }
}

function applyContactDamage(runtime, now) {
  const damagedPlayers = [];
  for (const player of runtime.players.values()) {
    const movementStartX = Number.isFinite(Number(player.collisionOriginX))
      ? Number(player.collisionOriginX)
      : player.x;
    const movementStartFloor = Number.isFinite(Number(player.collisionOriginFloor))
      ? Number(player.collisionOriginFloor)
      : player.floor;
    player.collisionOriginX = player.x;
    player.collisionOriginFloor = player.floor;
    if (
      player.currentHp <= 0
      || now < player.invulnerableUntil
      || Number(player.combatProfile?.stealth) > 0
    ) continue;
    if (player.lastContactAt && now - player.lastContactAt < CONTACT_COOLDOWN_MS) continue;
    const playerWidthPercent = PLAYER_VISUAL_WIDTH_PX / ASSUMED_STAGE_WIDTH_PX * 100;
    const monsterHalfWidthPercent = MONSTER_VISUAL_WIDTH_PX / 2 / ASSUMED_STAGE_WIDTH_PX * 100;
    const playerLeft = player.x;
    const playerRight = player.x + playerWidthPercent;
    const canSweepMovement = player.activity === 'moving' && movementStartFloor === player.floor;
    const sweptPlayerLeft = canSweepMovement
      ? Math.min(movementStartX, playerLeft)
      : playerLeft;
    const sweptPlayerRight = canSweepMovement
      ? Math.max(movementStartX + playerWidthPercent, playerRight)
      : playerRight;
    const collider = runtime.monsters.find((monster) => {
      if (monster.hp <= 0 || monster.floor !== player.floor) return false;
      const monsterLeft = monster.x - monsterHalfWidthPercent;
      const monsterRight = monster.x + monsterHalfWidthPercent;
      return sweptPlayerRight >= monsterLeft && sweptPlayerLeft <= monsterRight;
    });
    if (!collider) continue;
    const outgoingReduction = now < Number(collider.outgoingDamageDebuffUntil || 0)
      ? Math.max(0, Math.min(95, Number(collider.outgoingDamageReductionPercent) || 0))
      : 0;
    const calculation = calculateIncomingPhysicalDamage({
      monsterAttack: Number(collider.contactDamage) * (1 - outgoingReduction / 100),
      monsterLevel: collider.level,
      playerLevel: player.combatProfile.playerLevel,
      playerStats: player.combatProfile.playerStats,
      physicalDefense: player.combatProfile.physicalDefense,
      archetype: player.combatProfile.archetype
    });
    const dodged = Math.random() * 100 < Number(player.combatProfile.dodgeChance || 0);
    const blocked = !dodged
      && Math.random() * 100 < Number(player.combatProfile.blockChance || 0);
    const reduction = Math.max(0, Math.min(95, Number(player.combatProfile.damageReductionPercent) || 0));
    const incomingDamage = blocked || dodged
      ? 0
      : Math.max(1, Math.floor(calculation.damage * (1 - reduction / 100)));
    const damageSplit = splitDamageWithMpGuard(incomingDamage, {
      currentMp: player.currentMp,
      guardPercent: player.combatProfile.mpDamageGuardPercent
    });
    player.currentMp = Math.max(0, Number(player.currentMp) - damageSplit.mpDamage);
    player.currentHp = Math.max(0, Number(player.currentHp) - damageSplit.hpDamage);
    player.lastContactAt = now;
    player.invulnerableUntil = now + (blocked || dodged ? 1_000 : CONTACT_INVULNERABILITY_MS);
    const resistedKnockback = Math.random() * 100 < Number(player.combatProfile.stanceChance || 0);
    if (!blocked && !dodged && !resistedKnockback) {
      const playerCenterX = player.x + playerWidthPercent / 2;
      const relativeContactX = playerCenterX - collider.x;
      const knockbackDirection = Math.abs(relativeContactX) > 0.01
        ? Math.sign(relativeContactX)
        : (player.facingLeft ? 1 : -1);
      player.x = clamp(
        player.x + knockbackDirection * PLAYER_CONTACT_KNOCKBACK_DISTANCE,
        0,
        94
      );
    }
    const reflectCap = collider.maxHp * Number(player.combatProfile.contactReflectCapPercent || 10) / 100;
    const reflectedDamage = blocked || dodged
      ? 0
      : Math.max(0, Math.floor(Math.min(
        damageSplit.hpDamage * Number(player.combatProfile.contactReflectPercent || 0) / 100,
        reflectCap
      )));
    if (reflectedDamage > 0) {
      recordMonsterContribution(collider, player.userId, reflectedDamage);
      collider.hp = Math.max(0, collider.hp - reflectedDamage);
      if (collider.hp <= 0) {
        collider.state = 'defeated';
        if (collider.fieldBoss) {
          const rewardEvent = buildFieldBossRewardEvent(
            runtime,
            collider,
            runtime.mapId,
            player.userId,
            now
          );
          if (rewardEvent) runtime.fieldBossRewards.push(rewardEvent);
        } else {
          queueMonsterDrops(runtime, collider, player.userId, now);
        }
      }
    }
    damagedPlayers.push({
      userId: player.userId,
      damage: damageSplit.hpDamage,
      totalDamage: damageSplit.totalDamage,
      mpDamage: damageSplit.mpDamage,
      blocked,
      dodged,
      resistedKnockback,
      reflectedDamage,
      monsterId: collider.id,
      damageCalculation: {
        type: 'physical-contact',
        rolledAttack: calculation.rolledAttack,
        physicalDefense: calculation.physicalDefense,
        standardPdd: calculation.standardPdd,
        defenseFactor: calculation.defenseFactor
      },
      currentHp: player.currentHp,
      currentMp: player.currentMp,
      maxHp: player.maxHp,
      x: player.x,
      floor: player.floor,
      invulnerableUntil: player.invulnerableUntil
    });
  }
  return damagedPlayers;
}

function applyFieldBossMechanics(runtime, now) {
  const events = [];
  const livePlayers = () => Array.from(runtime.players.values())
    .filter((player) => (
      player.currentHp > 0 && Number(player.combatProfile?.stealth) <= 0
    ));
  for (const boss of runtime.monsters) {
    if (!boss.fieldBoss || boss.hp <= 0) continue;
    const definition = getFieldBossDefinition(boss.fieldBossId);
    if (!definition) continue;

    if (now >= Number(boss.nextRangedAt || 0)) {
      boss.nextRangedAt = now + definition.rangedIntervalMs;
      const rangePercent = definition.rangedRangePx / ASSUMED_STAGE_WIDTH_PX * 100;
      const targets = livePlayers().filter((player) => (
        player.floor === boss.floor
        && Math.abs(Number(player.x) - Number(boss.x)) <= rangePercent + 4.5
        && now >= Number(player.invulnerableUntil || 0)
      ));
      const target = pickRandom(targets);
      if (target) {
        const damage = Math.max(1, Math.floor(Number(definition.rangedDamage) || 1));
        const damageSplit = splitDamageWithMpGuard(damage, {
          currentMp: target.currentMp,
          guardPercent: target.combatProfile?.mpDamageGuardPercent
        });
        target.currentMp = Math.max(0, Number(target.currentMp) - damageSplit.mpDamage);
        target.currentHp = Math.max(0, Number(target.currentHp) - damageSplit.hpDamage);
        target.invulnerableUntil = now + CONTACT_INVULNERABILITY_MS;
        events.push({
          userId: target.userId,
          damage: damageSplit.hpDamage,
          totalDamage: damageSplit.totalDamage,
          mpDamage: damageSplit.mpDamage,
          blocked: false,
          dodged: false,
          resistedKnockback: true,
          reflectedDamage: 0,
          monsterId: boss.id,
          source: 'field-boss-ranged',
          currentHp: target.currentHp,
          currentMp: target.currentMp,
          maxHp: target.maxHp,
          x: target.x,
          floor: target.floor,
          invulnerableUntil: target.invulnerableUntil
        });
        runtime.fieldBossStatusEvents.push({
          type: 'ranged',
          bossId: boss.id,
          bossName: boss.name,
          targetUserId: target.userId,
          damage: damageSplit.hpDamage,
          totalDamage: damageSplit.totalDamage,
          mpDamage: damageSplit.mpDamage,
          createdAt: now
        });
      }
    }

    if (now >= Number(boss.nextSilenceAt || 0)) {
      boss.nextSilenceAt = now + definition.silenceIntervalMs;
      const targets = livePlayers()
        .filter((player) => player.floor === boss.floor)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      for (const target of targets) {
        target.silencedUntil = Math.max(
          Number(target.silencedUntil) || 0,
          now + definition.silenceDurationMs
        );
        runtime.fieldBossStatusEvents.push({
          type: 'silence',
          bossId: boss.id,
          bossName: boss.name,
          targetUserId: target.userId,
          durationMs: definition.silenceDurationMs,
          expiresAt: target.silencedUntil,
          createdAt: now
        });
      }
    }
  }
  return events;
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
  runtime.monsters.forEach((monster) => {
    if (!Array.isArray(monster.poisonStacks)) monster.poisonStacks = [];
    monster.poisonStacks = monster.poisonStacks.filter((stack) => stack.expiresAt > now);
    for (const stack of monster.poisonStacks) {
      while (stack.nextTickAt <= now && stack.nextTickAt <= stack.expiresAt) {
        monster.hp = Math.max(1, monster.hp - Math.max(1, Number(stack.attack) || 1));
        stack.nextTickAt += 1_000;
      }
    }
  });
  runtime.monsters.forEach((monster) => advanceMonster(monster, runtime, map, deltaSeconds, now));
  return [
    ...applyFieldBossMechanics(runtime, now),
    ...applyContactDamage(runtime, now)
  ];
}

function collectDueLoot(runtime, userId, now) {
  const ownerId = String(userId);
  const collected = runtime.groundLoot.filter(
    (loot) => (
      String(loot.userId) === ownerId
      && Math.min(
        Number(loot.collectAt) || now,
        (Number(loot.createdAt) || now) + MONSTER_SPAWN_INTERVAL_MS
      ) <= now
    )
  );
  if (collected.length) {
    const ids = new Set(collected.map((loot) => loot.id));
    runtime.groundLoot = runtime.groundLoot.filter((loot) => !ids.has(loot.id));
  }
  return collected.map(serializeLoot);
}

function claimWorldControl(userId, clientId, now = Date.now()) {
  const key = String(userId);
  const sessionId = String(clientId || '').trim();
  if (!sessionId) throw new Error('월드 접속 식별자가 필요합니다.');
  worldControllers.set(key, { clientId: sessionId, claimedAt: now });
  removePlayerFromOtherMaps(key, '');
  return { clientId: sessionId, claimedAt: now };
}

function hasWorldControl(userId, clientId) {
  const owner = worldControllers.get(String(userId));
  return Boolean(owner && owner.clientId === String(clientId || ''));
}

function releaseWorldControl(userId, clientId) {
  const key = String(userId);
  if (!hasWorldControl(key, clientId)) return false;
  worldControllers.delete(key);
  removePlayerFromOtherMaps(key, '');
  return true;
}

function buildPassiveRecoverySchedule({
  previous,
  activity,
  currentHp,
  maxHp,
  currentMp,
  maxMp,
  periodicHealPercent,
  periodicHealAmount,
  periodicHealIntervalMs,
  periodicMpAmount,
  periodicMpIntervalMs,
  idleHealAmount,
  idleHealIntervalMs,
  now
}) {
  const schedule = {
    periodicAt: Number(previous?.passiveRecoverySchedule?.periodicAt) || now,
    periodicMpAt: Number(previous?.passiveRecoverySchedule?.periodicMpAt) || now,
    idleAt: Number(previous?.passiveRecoverySchedule?.idleAt) || now
  };
  let healAmount = 0;
  const periodicInterval = Math.max(0, Number(periodicHealIntervalMs) || 0);
  if (
    (Number(periodicHealPercent) > 0 || Number(periodicHealAmount) > 0)
    && periodicInterval > 0
  ) {
    const ticks = Math.floor((now - schedule.periodicAt) / periodicInterval);
    if (ticks > 0) {
      schedule.periodicAt += ticks * periodicInterval;
      healAmount += ticks * Math.max(
        1,
        Math.floor(
          maxHp * Number(periodicHealPercent) / 100
          + Number(periodicHealAmount || 0)
        )
      );
    }
  } else {
    schedule.periodicAt = now;
  }

  let mpAmount = 0;
  const periodicMpInterval = Math.max(0, Number(periodicMpIntervalMs) || 0);
  if (Number(periodicMpAmount) > 0 && periodicMpInterval > 0) {
    const ticks = Math.floor((now - schedule.periodicMpAt) / periodicMpInterval);
    if (ticks > 0) {
      schedule.periodicMpAt += ticks * periodicMpInterval;
      mpAmount += ticks * Math.max(1, Math.floor(Number(periodicMpAmount) || 0));
    }
  } else {
    schedule.periodicMpAt = now;
  }

  const idleInterval = Math.max(0, Number(idleHealIntervalMs) || 0);
  if (activity !== 'idle') {
    schedule.idleAt = now;
  } else if (previous?.activity !== 'idle') {
    schedule.idleAt = now;
  } else if (Number(idleHealAmount) > 0 && idleInterval > 0) {
    const ticks = Math.floor((now - schedule.idleAt) / idleInterval);
    if (ticks > 0) {
      schedule.idleAt += ticks * idleInterval;
      healAmount += ticks * Math.max(0, Math.floor(Number(idleHealAmount) || 0));
    }
  }
  return {
    schedule,
    healAmount: currentHp > 0 && currentHp < maxHp ? healAmount : 0,
    mpAmount: currentHp > 0 && currentMp < maxMp ? mpAmount : 0
  };
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
  jumpEvent,
  currentHp,
  maxHp,
  currentMp,
  maxMp,
  playerLevel,
  playerStats,
  physicalDefense,
  magicDefense,
  archetype,
  damageReductionPercent,
  dodgeChance,
  blockChance,
  stanceChance,
  contactReflectPercent,
  contactReflectCapPercent,
  mpDamageGuardPercent,
  stealth,
  periodicHealPercent,
  periodicHealAmount,
  periodicHealIntervalMs,
  periodicMpAmount,
  periodicMpIntervalMs,
  idleHealAmount,
  idleHealIntervalMs,
  autoHunting = false,
  autoHuntRemainingSeconds = 0,
  offline = false,
  now = Date.now()
}) {
  cleanupInactiveMaps(now);
  const userKey = String(userId);
  const map = getWorldMap(mapId);
  if (!map) throw new Error('존재하지 않는 맵입니다.');
  removePlayerFromOtherMaps(userKey, mapId);
  let runtime = activeMaps.get(mapId);
  if (!runtime) {
    runtime = createMapRuntime(mapId, now);
    activeMaps.set(mapId, runtime);
  }
  const previous = runtime.players.get(userKey);
  const incomingJumpSequence = Math.max(0, Math.floor(Number(jumpEvent?.sequence) || 0));
  const incomingJumpStartedAt = Number(jumpEvent?.startedAt) || 0;
  const incomingJumpKind = jumpEvent?.kind === 'flash-jump' ? 'flash-jump' : 'jump';
  const jumpIsRecent = incomingJumpStartedAt > 0
    && Math.abs(now - incomingJumpStartedAt) <= 5_000;
  const resolvedJumpEvent = incomingJumpSequence > 0
    && jumpIsRecent
    && incomingJumpSequence !== Number(previous?.jumpEvent?.sequence)
    ? {
      sequence: incomingJumpSequence,
      kind: incomingJumpKind,
      createdAt: now,
      expiresAt: now + 1_800
    }
    : (previous?.jumpEvent || null);
  const resolvedHp = Math.max(0, Number(previous?.currentHp ?? currentHp) || 0);
  const resolvedMaxHp = Math.max(1, Number(previous?.maxHp ?? maxHp) || 120);
  const resolvedMp = Math.max(0, Number(previous?.currentMp ?? currentMp) || 0);
  const resolvedMaxMp = Math.max(0, Number(previous?.maxMp ?? maxMp) || 0);
  const resolvedActivity = resolvedHp <= 0
    ? 'dead'
    : (['idle', 'moving', 'combat'].includes(activity) ? activity : 'idle');
  const recovery = buildPassiveRecoverySchedule({
    previous,
    activity: resolvedActivity,
    currentHp: resolvedHp,
    maxHp: resolvedMaxHp,
    currentMp: resolvedMp,
    maxMp: resolvedMaxMp,
    periodicHealPercent,
    periodicHealAmount,
    periodicHealIntervalMs,
    periodicMpAmount,
    periodicMpIntervalMs,
    idleHealAmount,
    idleHealIntervalMs,
    now
  });
  runtime.players.set(userKey, {
    userId: userKey,
    nickname: String(nickname || '사원').slice(0, 16),
    mapId,
    x: clamp(x, 0, 94),
    floor: Number(floor) === 1 ? 1 : 0,
    activity: resolvedActivity,
    motion: resolvedHp <= 0 ? 'dead' : String(motion || ''),
    facingLeft: Boolean(facingLeft),
    currentHp: resolvedHp,
    maxHp: resolvedMaxHp,
    currentMp: resolvedMp,
    maxMp: resolvedMaxMp,
    passiveRecoverySchedule: recovery.schedule,
    autoHunting: Boolean(autoHunting),
    autoHuntEndsAt: Boolean(autoHunting)
      ? now + Math.max(0, Number(autoHuntRemainingSeconds) || 0) * 1000
      : 0,
    recentSkill: previous?.recentSkill || null,
    jumpEvent: resolvedJumpEvent,
    lastContactAt: previous?.lastContactAt || 0,
    invulnerableUntil: previous?.invulnerableUntil || 0,
    silencedUntil: previous?.silencedUntil || 0,
    collisionOriginX: previous?.x ?? clamp(x, 0, 94),
    collisionOriginFloor: previous?.floor ?? (Number(floor) === 1 ? 1 : 0),
    combatProfile: {
      playerLevel: Math.max(
        1,
        Math.floor(Number(playerLevel ?? previous?.combatProfile?.playerLevel) || 1)
      ),
      playerStats: {
        ...(previous?.combatProfile?.playerStats || {}),
        ...(playerStats || {})
      },
      physicalDefense: Math.max(
        0,
        Number(physicalDefense ?? previous?.combatProfile?.physicalDefense) || 0
      ),
      magicDefense: Math.max(
        0,
        Number(magicDefense ?? previous?.combatProfile?.magicDefense) || 0
      ),
      archetype: String(archetype || previous?.combatProfile?.archetype || 'beginner'),
      damageReductionPercent: Math.max(
        0,
        Number(damageReductionPercent ?? previous?.combatProfile?.damageReductionPercent) || 0
      ),
      dodgeChance: Math.max(
        0,
        Math.min(100, Number(dodgeChance ?? previous?.combatProfile?.dodgeChance) || 0)
      ),
      blockChance: Math.max(0, Number(blockChance ?? previous?.combatProfile?.blockChance) || 0),
      stanceChance: Math.max(0, Number(stanceChance ?? previous?.combatProfile?.stanceChance) || 0),
      contactReflectPercent: Math.max(
        0,
        Number(contactReflectPercent ?? previous?.combatProfile?.contactReflectPercent) || 0
      ),
      contactReflectCapPercent: Math.max(
        0,
        Number(contactReflectCapPercent ?? previous?.combatProfile?.contactReflectCapPercent) || 10
      ),
      mpDamageGuardPercent: Math.max(
        0,
        Math.min(
          100,
          Number(mpDamageGuardPercent ?? previous?.combatProfile?.mpDamageGuardPercent) || 0
        )
      ),
      stealth: Number(stealth ?? previous?.combatProfile?.stealth) > 0 ? 1 : 0
    },
    lastSeenAt: offline
      ? Number(previous?.lastSeenAt || now - PLAYER_TIMEOUT_MS - 1)
      : now
  });
  const contactEvents = tickRuntime(runtime, now);
  const recoveryEvents = recovery.healAmount > 0 || recovery.mpAmount > 0
    ? [{
      userId: userKey,
      amount: recovery.healAmount,
      hpAmount: recovery.healAmount,
      mpAmount: recovery.mpAmount
    }]
    : [];
  return {
    mapId,
    players: Array.from(runtime.players.values()).map((player) => serializePlayer(player, now)),
    monsters: runtime.monsters.filter((monster) => monster.hp > 0).map(serializeMonster),
    contactEvents,
    recoveryEvents,
    lootCollections: collectDueLoot(runtime, userKey, now),
    fieldBossRewards: runtime.fieldBossRewards.splice(0),
    fieldBossStatusEvents: runtime.fieldBossStatusEvents.splice(0)
  };
}

function applyHeavyHitKnockback(monster, player, damage) {
  if (!monster || !player || monster.hp <= 0) return false;
  if (Number(damage) < Number(monster.maxHp) * 0.4) return false;
  const direction = monster.x >= player.x ? 1 : -1;
  monster.x = clamp(monster.x + direction * 4.2, monster.floor === 1 ? 48 : 7, monster.floor === 1 ? 71 : 88);
  monster.state = 'knockback';
  monster.decisionAt = Date.now() + 420;
  return true;
}

function selectFrontMonster(runtime, player, requestedMonster, rangePercent) {
  if (!requestedMonster) return null;
  const requestedOffset = requestedMonster.x - player.x;
  const direction = requestedOffset === 0
    ? (player.facingLeft ? -1 : 1)
    : Math.sign(requestedOffset);
  const requestedDistance = Math.abs(requestedOffset);
  return runtime.monsters
    .filter((monster) => {
      if (monster.hp <= 0 || monster.floor !== player.floor) return false;
      const offset = monster.x - player.x;
      const sameDirection = offset === 0 || Math.sign(offset) === direction;
      const distance = Math.abs(offset);
      return sameDirection
        && distance <= requestedDistance + 0.001
        && distance <= rangePercent + 4.5;
    })
    .sort((left, right) => (
      Math.abs(left.x - player.x) - Math.abs(right.x - player.x)
    ))[0] || null;
}

function absorbMonsterMp(monster, chance, percent) {
  if (
    Number(chance) <= 0
    || Number(percent) <= 0
    || Math.random() * 100 >= Number(chance)
  ) return 0;
  const amount = Math.min(
    Math.max(0, Number(monster.mp) || 0),
    Math.max(0, Math.floor((Number(monster.maxMp) || 0) * Number(percent) / 100))
  );
  monster.mp = Math.max(0, Number(monster.mp) - amount);
  return amount;
}

function applyPoisonPassive(monster, {
  userId,
  chance = 0,
  attack = 0,
  durationSeconds = 0,
  maxStacks = 0,
  now = Date.now()
} = {}) {
  if (
    !monster
    || Number(chance) <= 0
    || Number(attack) <= 0
    || Number(durationSeconds) <= 0
    || Number(maxStacks) <= 0
    || Math.random() * 100 >= Number(chance)
  ) return false;
  if (!Array.isArray(monster.poisonStacks)) monster.poisonStacks = [];
  monster.poisonStacks = monster.poisonStacks
    .filter((stack) => stack.expiresAt > now)
    .slice(-(Math.max(1, Math.floor(Number(maxStacks))) - 1));
  monster.poisonStacks.push({
    userId: String(userId || ''),
    attack: Math.max(1, Math.floor(Number(attack) || 1)),
    nextTickAt: now + 1_000,
    expiresAt: now + Math.max(1, Number(durationSeconds)) * 1_000
  });
  return true;
}

function getLootCollectionTime(runtime, now) {
  const nextSpawnAt = Number(runtime?.nextSpawnAt);
  if (!Number.isFinite(nextSpawnAt) || nextSpawnAt <= now) {
    return now + MONSTER_SPAWN_INTERVAL_MS;
  }
  return Math.min(nextSpawnAt, now + MONSTER_SPAWN_INTERVAL_MS);
}

function normalizeDamageRange(range = {}) {
  const minimum = Math.max(0, Number(range.minimum) || 0);
  const maximum = Math.max(0, Number(range.maximum) || 0);
  return minimum <= maximum
    ? { minimum, maximum }
    : { minimum: maximum, maximum: minimum };
}

function scaleDamageRange(range, multiplier = 1) {
  const normalized = normalizeDamageRange(range);
  const safeMultiplier = Math.max(0, Number(multiplier) || 0);
  return {
    minimum: normalized.minimum * safeMultiplier,
    maximum: normalized.maximum * safeMultiplier
  };
}

function rollDamageRange(range = {}) {
  const normalized = normalizeDamageRange(range);
  if (normalized.maximum <= normalized.minimum) return normalized.minimum;
  return normalized.minimum + Math.random() * (normalized.maximum - normalized.minimum);
}

function resolveOutgoingDamage({
  damage,
  damageRange,
  damageType = 'physical',
  skillPercent = 100,
  defense = 0,
  ignoreDefense = false,
  playerLevel = 1,
  monsterLevel = 1,
  elementMultiplier = 1
} = {}) {
  const safeElementMultiplier = Math.max(0, Number(elementMultiplier) || 0);
  if (damageType === 'magic' && damageRange) {
    const defendedRange = ignoreDefense
      ? normalizeDamageRange(damageRange)
      : calculateMagicDamageAfterDefense({
        skillDamageRange: damageRange,
        characterLevel: playerLevel,
        monsterLevel,
        magicDefense: defense
      });
    return Math.max(1, Math.floor(rollDamageRange(defendedRange) * safeElementMultiplier));
  }
  const beforeElement = Math.max(
    1,
    Number(damage || 1) * Number(skillPercent || 100) / 100
      - (ignoreDefense ? 0 : Number(defense || 0) * 0.5)
  );
  return Math.max(1, Math.floor(beforeElement * safeElementMultiplier));
}

function attackMonster({
  userId,
  mapId,
  monsterId,
  damage,
  damageRange = null,
  rangePx,
  damageType = 'physical',
  element = 'neutral',
  elements = [],
  freezeSeconds = 0,
  accuracy = null,
  playerLevel = 1,
  mpAbsorbChance = 0,
  mpAbsorbPercent = 0,
  poisonChance = 0,
  poisonAttack = 0,
  poisonDurationSeconds = 0,
  poisonMaxStacks = 0,
  closeRangeChance = 0,
  closeRangeDamagePercent = 0,
  executeThresholdPercent = 0,
  executeChance = 0,
  piercing = false,
  now = Date.now()
}) {
  cleanupInactiveMaps(now);
  const userKey = String(userId);
  const runtime = activeMaps.get(mapId);
  if (!runtime) return { success: false, reason: 'inactive-map' };
  tickRuntime(runtime, now);
  const player = runtime.players.get(userKey);
  const requestedMonster = runtime.monsters.find((entry) => entry.id === monsterId && entry.hp > 0);
  if (!player || !requestedMonster) return { success: false, reason: 'missing-target' };
  if (player.currentHp <= 0) return { success: false, reason: 'dead' };
  if (player.floor !== requestedMonster.floor) return { success: false, reason: 'different-floor' };
  const rangePercent = Math.max(1, Number(rangePx) || 22) / ASSUMED_STAGE_WIDTH_PX * 100;
  if (Math.abs(player.x - requestedMonster.x) > rangePercent + 4.5) {
    return { success: false, reason: 'out-of-range' };
  }
  const monster = piercing
    ? requestedMonster
    : selectFrontMonster(runtime, player, requestedMonster, rangePercent);
  if (!monster) return { success: false, reason: 'missing-target' };
  player.combatProfile.stealth = 0;
  const requiredAccuracy = calculateRequiredAccuracy({
    characterLevel: playerLevel,
    monsterLevel: monster.level,
    monsterEvasion: monster.monsterEvasion
  });
  const hitChance = accuracy == null
    ? 1
    : calculateHitChance({ accuracy, requiredAccuracy });
  if (Math.random() > hitChance) {
    monster.aggroTargetId = userKey;
    monster.state = 'chase';
    return {
      success: true,
      damage: 0,
      missed: true,
      hitChance,
      defeated: false,
      expReward: 0,
      drops: [],
      targetId: monster.id,
      monster: serializeMonster(monster)
    };
  }

  const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
  const activeElements = [...new Set(
    (Array.isArray(elements) && elements.length ? elements : [element]).filter(Boolean)
  )];
  const elementMultiplier = Math.max(
    ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
  );
  const distancePx = Math.abs(player.x - monster.x) / 100 * ASSUMED_STAGE_WIDTH_PX;
  const closeRangeTriggered = distancePx <= 100
    && Number(closeRangeChance) > 0
    && Math.random() * 100 < Number(closeRangeChance);
  const closeRangeMultiplier = closeRangeTriggered
    ? Math.max(0, Number(closeRangeDamagePercent) || 100) / 100
    : 1;
  const finalDamage = resolveOutgoingDamage({
    damage: Number(damage) * closeRangeMultiplier,
    damageRange: damageRange ? scaleDamageRange(damageRange, closeRangeMultiplier) : null,
    damageType,
    defense,
    playerLevel,
    monsterLevel: monster.level,
    elementMultiplier
  });
  const mpAbsorbed = damageType === 'magic'
    ? absorbMonsterMp(monster, mpAbsorbChance, mpAbsorbPercent)
    : 0;
  recordMonsterContribution(monster, userKey, finalDamage);
  const wasBelowExecuteThreshold = monster.hp / Math.max(1, monster.maxHp) * 100
    <= Number(executeThresholdPercent || 0);
  monster.hp = Math.max(0, monster.hp - finalDamage);
  const executed = closeRangeTriggered
    && wasBelowExecuteThreshold
    && Number(executeChance) > 0
    && Math.random() * 100 < Number(executeChance);
  if (executed) monster.hp = 0;
  const poisoned = monster.hp > 0 && applyPoisonPassive(monster, {
    userId: userKey,
    chance: poisonChance,
    attack: poisonAttack,
    durationSeconds: poisonDurationSeconds,
    maxStacks: poisonMaxStacks,
    now
  });
  monster.aggroTargetId = userKey;
  if (
    activeElements.includes('ice')
    && elementMultiplier >= 1
    && Number(freezeSeconds) > 0
  ) {
    monster.stunnedUntil = now + Number(freezeSeconds) * 1000;
    monster.state = 'stunned';
  } else {
    monster.state = 'chase';
  }
  const knockedBack = applyHeavyHitKnockback(monster, player, finalDamage);
  const defeated = monster.hp <= 0;
  let drops = [];
  let fieldBossReward = null;
  if (defeated) {
    monster.state = 'defeated';
    monster.aggroTargetId = '';
    if (monster.fieldBoss) {
      fieldBossReward = buildFieldBossRewardEvent(runtime, monster, mapId, userKey, now);
    } else {
      const collectAt = getLootCollectionTime(runtime, now);
      drops = rollMonsterDrops(monster).map((drop, index) => ({
        ...drop,
        id: crypto.randomUUID(),
        userId: userKey,
        x: clamp(monster.x + (index - 0.5) * 1.8, 8, 86),
        floor: monster.floor,
        createdAt: now,
        collectAt
      }));
      runtime.groundLoot.push(...drops);
    }
  }
  return {
    success: true,
    targetId: monster.id,
    speciesId: monster.speciesId,
    damage: finalDamage,
    closeRangeTriggered,
    executed,
    poisoned,
    element: activeElements.join('+') || 'neutral',
    elementMultiplier,
    hitChance,
    knockedBack,
    defeated,
    monsterLevel: monster.level,
    expReward: defeated && !fieldBossReward ? monster.expReward : 0,
    fieldBossReward,
    mpAbsorbed,
    drops: drops.map(serializeLoot),
    monster: defeated ? null : serializeMonster(monster),
    players: Array.from(runtime.players.values()).map((player) => serializePlayer(player, now)),
    monsters: runtime.monsters.filter((entry) => entry.hp > 0).map(serializeMonster)
  };
}

function queueMonsterDrops(runtime, monster, userId, now) {
  const ownerId = String(userId);
  const collectAt = getLootCollectionTime(runtime, now);
  const drops = rollMonsterDrops(monster).map((drop, index) => ({
    ...drop,
    id: crypto.randomUUID(),
    userId: ownerId,
    x: clamp(monster.x + (index - 0.5) * 1.8, 8, 86),
    floor: monster.floor,
    createdAt: now,
    collectAt
  }));
  runtime.groundLoot.push(...drops);
  return drops;
}

function useSkillOnMonsters({
  userId,
  mapId,
  targetId,
  baseDamage,
  damageRange = null,
  skillPercent = 100,
  rangePx = 100,
  maxTargets = 1,
  hits = 1,
  bonusAttackPercent = 0,
  damageType = 'physical',
  element = 'neutral',
  elements = [],
  ignoreDefense = false,
  accuracy = null,
  playerLevel = 1,
  stunChance = 0,
  stunSeconds = 0,
  pull = false,
  dealDamage = true,
  leaveAtOneHp = false,
  outgoingDamageReductionPercent = 0,
  debuffChance = 100,
  debuffDurationSeconds = 0,
  piercing = false,
  mpAbsorbChance = 0,
  mpAbsorbPercent = 0,
  poisonChance = 0,
  poisonAttack = 0,
  poisonDurationSeconds = 0,
  poisonMaxStacks = 0,
  undeadOnly = false,
  now = Date.now()
}) {
  cleanupInactiveMaps(now);
  const userKey = String(userId);
  const runtime = activeMaps.get(mapId);
  if (!runtime) return { success: false, reason: 'inactive-map' };
  tickRuntime(runtime, now);
  const player = runtime.players.get(userKey);
  if (!player) return { success: false, reason: 'missing-player' };
  if (player.currentHp <= 0) return { success: false, reason: 'dead' };
  const rangePercent = Math.max(1, Number(rangePx) || 100) / ASSUMED_STAGE_WIDTH_PX * 100;
  const inRange = runtime.monsters
    .filter((monster) => (
      monster.hp > 0
      && (!undeadOnly || monster.undead)
      && monster.floor === player.floor
      && Math.abs(monster.x - player.x) <= rangePercent + 4.5
    ));
  const requestedMonster = inRange.find((monster) => monster.id === targetId);
  const targetLimit = Math.max(1, Math.floor(Number(maxTargets) || 1));
  const candidates = targetLimit === 1 && requestedMonster && !piercing
    ? [selectFrontMonster(runtime, player, requestedMonster, rangePercent)].filter(Boolean)
    : inRange.sort((left, right) => {
      if (left.id === targetId) return -1;
      if (right.id === targetId) return 1;
      return Math.abs(left.x - player.x) - Math.abs(right.x - player.x);
    })
      .slice(0, targetLimit);
  if (!candidates.length) return { success: false, reason: 'out-of-range' };
  if (dealDamage) player.combatProfile.stealth = 0;

  const outcomes = [];
  const drops = [];
  const fieldBossRewards = [];
  const hitCount = Math.max(1, Math.floor(Number(hits) || 1));
  const activeElements = [...new Set(
    (Array.isArray(elements) && elements.length ? elements : [element]).filter(Boolean)
  )];
  for (const monster of candidates) {
    const requiredAccuracy = calculateRequiredAccuracy({
      characterLevel: playerLevel,
      monsterLevel: monster.level,
      monsterEvasion: monster.monsterEvasion
    });
    const hitChance = accuracy == null
      ? 1
      : calculateHitChance({ accuracy, requiredAccuracy });
    if (Math.random() > hitChance) {
      monster.aggroTargetId = userKey;
      monster.state = 'chase';
      outcomes.push({
        monsterId: monster.id,
        damage: 0,
        missed: true,
        hitChance,
        knockedBack: false,
        defeated: false,
        expReward: 0,
        monster: serializeMonster(monster)
      });
      continue;
    }
    let totalDamage = 0;
    for (let hit = 0; dealDamage && hit < hitCount && monster.hp > 0; hit += 1) {
      const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
      const multiplier = Math.max(
        ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
      );
      const damage = resolveOutgoingDamage({
        damage: baseDamage,
        damageRange,
        damageType,
        skillPercent,
        defense,
        ignoreDefense,
        playerLevel,
        monsterLevel: monster.level,
        elementMultiplier: multiplier
      });
      recordMonsterContribution(monster, userKey, damage);
      monster.hp = Math.max(leaveAtOneHp ? 1 : 0, monster.hp - damage);
      totalDamage += damage;
    }
    const mpAbsorbed = damageType === 'magic' && totalDamage > 0
      ? absorbMonsterMp(monster, mpAbsorbChance, mpAbsorbPercent)
      : 0;
    const poisoned = totalDamage > 0 && monster.hp > 0 && applyPoisonPassive(monster, {
      userId: userKey,
      chance: poisonChance,
      attack: poisonAttack,
      durationSeconds: poisonDurationSeconds,
      maxStacks: poisonMaxStacks,
      now
    });
    for (let hit = 0; dealDamage && hit < hitCount && monster.hp > 0 && bonusAttackPercent > 0; hit += 1) {
      const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
      const multiplier = Math.max(
        ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
      );
      const damage = resolveOutgoingDamage({
        damage: baseDamage,
        damageRange: damageRange
          ? scaleDamageRange(damageRange, Number(bonusAttackPercent) / 100)
          : null,
        damageType,
        skillPercent: damageRange ? 100 : Number(skillPercent || 100) * Number(bonusAttackPercent) / 100,
        defense,
        ignoreDefense,
        playerLevel,
        monsterLevel: monster.level,
        elementMultiplier: multiplier
      });
      recordMonsterContribution(monster, userKey, damage);
      monster.hp = Math.max(leaveAtOneHp ? 1 : 0, monster.hp - damage);
      totalDamage += damage;
    }
    monster.aggroTargetId = userKey;
    if (
      Number(outgoingDamageReductionPercent) > 0
      && Math.random() * 100 < Number(debuffChance || 0)
    ) {
      monster.outgoingDamageReductionPercent = Math.max(
        Number(monster.outgoingDamageReductionPercent) || 0,
        Number(outgoingDamageReductionPercent) || 0
      );
      monster.outgoingDamageDebuffUntil = Math.max(
        Number(monster.outgoingDamageDebuffUntil) || 0,
        now + Math.max(0, Number(debuffDurationSeconds) || 0) * 1000
      );
    }
    let knockedBack = false;
    if (Math.random() * 100 < Number(stunChance || 0)) {
      monster.stunnedUntil = now + Math.max(0, Number(stunSeconds) || 0) * 1000;
      monster.state = 'stunned';
    } else {
      monster.state = 'chase';
    }
    if (pull) monster.x = clamp(player.x + (player.facingLeft ? -2 : 2), 2, 92);
    else knockedBack = applyHeavyHitKnockback(monster, player, totalDamage);
    const defeated = monster.hp <= 0;
    if (defeated) {
      monster.state = 'defeated';
      monster.aggroTargetId = '';
      if (monster.fieldBoss) {
        const rewardEvent = buildFieldBossRewardEvent(runtime, monster, mapId, userKey, now);
        if (rewardEvent) fieldBossRewards.push(rewardEvent);
      } else {
        drops.push(...queueMonsterDrops(runtime, monster, userKey, now));
      }
    }
    outcomes.push({
      monsterId: monster.id,
      speciesId: monster.speciesId,
      damage: totalDamage,
      missed: false,
      hitChance,
      doubleStrike: bonusAttackPercent > 0,
      knockedBack,
      defeated,
      monsterLevel: monster.level,
      expReward: defeated && !monster.fieldBoss ? monster.expReward : 0,
      mpAbsorbed,
      poisoned,
      monster: defeated ? null : serializeMonster(monster)
    });
  }
  return {
    success: true,
    outcomes,
    drops: drops.map(serializeLoot),
    expReward: outcomes.reduce((sum, outcome) => sum + outcome.expReward, 0),
    mpAbsorbed: outcomes.reduce((sum, outcome) => sum + (outcome.mpAbsorbed || 0), 0),
    fieldBossRewards
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
    if (Number.isFinite(Number(resources.currentMp))) {
      player.currentMp = Math.max(0, Number(resources.currentMp));
    }
    if (Number.isFinite(Number(resources.maxMp))) {
      player.maxMp = Math.max(0, Number(resources.maxMp));
    }
  }
}

function setPlayerStealth(userId, mapId, stealth) {
  const runtime = activeMaps.get(String(mapId || ''));
  const player = runtime?.players.get(String(userId));
  if (!player) return false;
  player.combatProfile = player.combatProfile || {};
  player.combatProfile.stealth = stealth ? 1 : 0;
  if (stealth) {
    for (const monster of runtime.monsters) {
      if (monster.aggroTargetId === String(userId)) monster.aggroTargetId = '';
    }
  }
  return true;
}

function leaveWorld(userId) {
  removePlayerFromOtherMaps(String(userId), '');
  cleanupInactiveMaps(Date.now());
}

function recordSkillUse(userId, mapId, skillName, now = Date.now()) {
  const runtime = activeMaps.get(String(mapId || ''));
  const player = runtime?.players.get(String(userId));
  if (!player) return false;
  player.recentSkill = {
    name: String(skillName || '').slice(0, 40),
    createdAt: now,
    expiresAt: now + 1_500
  };
  return true;
}

function listActivePlayers(mapId, now = Date.now()) {
  cleanupInactiveMaps(now);
  const runtime = activeMaps.get(String(mapId || ''));
  if (!runtime) return [];
  return Array.from(runtime.players.values()).map((player) => serializePlayer(player, now));
}

function listAllActivePlayers(now = Date.now()) {
  cleanupInactiveMaps(now);
  const players = [];
  for (const runtime of activeMaps.values()) {
    players.push(...Array.from(runtime.players.values()).map((player) => serializePlayer(player, now)));
  }
  return players;
}

function isPlayerSilenced(userId, mapId, now = Date.now()) {
  const runtime = activeMaps.get(String(mapId || ''));
  const player = runtime?.players.get(String(userId || ''));
  return Boolean(player && Number(player.silencedUntil || 0) > now);
}

function resetWorldRuntime() {
  activeMaps.clear();
  worldControllers.clear();
}

module.exports = {
  PLAYER_TIMEOUT_MS,
  CONTACT_COOLDOWN_MS,
  CONTACT_INVULNERABILITY_MS,
  PLAYER_CONTACT_KNOCKBACK_DISTANCE,
  MONSTER_SPAWN_INTERVAL_MS,
  MONSTER_MAX_PER_MAP,
  MONSTER_SPAWN_PER_WAVE,
  MONSTER_CATALOG,
  buildMonsterStats,
  claimWorldControl,
  hasWorldControl,
  releaseWorldControl,
  updatePresence,
  attackMonster,
  useSkillOnMonsters,
  isPlayerSilenced,
  updatePlayerResources,
  setPlayerStealth,
  recordSkillUse,
  listActivePlayers,
  listAllActivePlayers,
  leaveWorld,
  resetWorldRuntime
};
