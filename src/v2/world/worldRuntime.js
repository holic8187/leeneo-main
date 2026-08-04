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
const { getMasteryBookByOriginalSkill } = require('../items/masteryBookCatalog');
const {
  calculateIncomingPhysicalDamage,
  splitDamageWithMpGuard
} = require('../combat/incomingDamage');
const {
  calculateRequiredAccuracy,
  calculateHitChance,
  calculateMagicDamageAfterDefense
} = require('../combat/combatFormulas');
const {
  BALD_KIM_BOSS_ID,
  getRaidBossDefinition
} = require('./raidBossDefinitions');

const PLAYER_TIMEOUT_MS = 12_000;
const RAID_CORPSE_RETENTION_MS = 10 * 60 * 1000;
const WORLD_CONTROL_ACTIVE_MS = PLAYER_TIMEOUT_MS;
const CONTACT_COOLDOWN_MS = 1_200;
const CONTACT_INVULNERABILITY_MS = 2_000;
const PLAYER_CONTACT_KNOCKBACK_DISTANCE = 2.56;
const MONSTER_SPAWN_INTERVAL_MS = 8_000;
const MONSTER_MAX_PER_MAP = 14;
const MONSTER_SPAWN_PER_WAVE = 6;
const ASSUMED_STAGE_WIDTH_PX = 760;
const PLAYER_VISUAL_WIDTH_PX = 19;
const MONSTER_VISUAL_WIDTH_PX = 36;
const DECOY_VISUAL_WIDTH_PX = 22;
const GLOBAL_SHOUT_DURATION_MS = 10_000;
const EXECUTE_FIXED_DAMAGE = 199_999;
const RAID_MAP_TICK_INTERVAL_MS = 100;
const RAID_CONTACT_EVENT_QUEUE_LIMIT = 24;

const activeMaps = new Map();
const playerMapIndex = new Map();
const worldControllers = new Map();
const fieldBossRespawns = new Map();
const raidMapSimulationTimers = new Map();
let latestGlobalShout = null;

const FIELD_BOSS_RESPAWN_MIN_MS = 90 * 60 * 1000;
const FIELD_BOSS_RESPAWN_MAX_MS = 180 * 60 * 1000;
const GAMMAM_NEO_BOSS_ID = 'gammam_neo';

function getMapLayout(mapOrId) {
  const map = typeof mapOrId === 'string' ? getWorldMap(mapOrId) : mapOrId;
  return map?.layout || {
    worldWidth: ASSUMED_STAGE_WIDTH_PX,
    worldHeight: 390,
    maxMonsters: MONSTER_MAX_PER_MAP,
    spawnPerWave: MONSTER_SPAWN_PER_WAVE,
    platforms: [{ id: 'ground', floor: 0, x: 0, width: 100, spawnEnabled: true, spawnSlots: MONSTER_MAX_PER_MAP }],
    connectors: []
  };
}

function getWorldWidth(mapOrId) {
  return Math.max(ASSUMED_STAGE_WIDTH_PX, Number(getMapLayout(mapOrId).worldWidth) || ASSUMED_STAGE_WIDTH_PX);
}

function getMapMaximumFloor(mapOrId) {
  return Math.max(
    0,
    ...getMapLayout(mapOrId).platforms.map((platform) => Math.max(0, Math.floor(Number(platform.floor) || 0)))
  );
}

function normalizeMapFloor(mapOrId, floor) {
  return Math.max(0, Math.min(getMapMaximumFloor(mapOrId), Math.floor(Number(floor) || 0)));
}

function getMonsterPlatform(mapOrId, monster = {}) {
  const platforms = getMapLayout(mapOrId).platforms;
  return platforms.find((platform) => platform.id === monster.platformId)
    || platforms.find((platform) => (
      Number(platform.floor) === Number(monster.floor)
      && Number(monster.x) >= Number(platform.x)
      && Number(monster.x) <= Number(platform.x) + Number(platform.width)
    ))
    || platforms.find((platform) => Number(platform.floor) === Number(monster.floor))
    || platforms[0];
}

function getPlatformBounds(platform = {}) {
  const minimum = Math.max(1, Number(platform.x) + 1.5 || 1);
  const maximum = Math.min(96, Number(platform.x) + Number(platform.width) - 1.5 || 96);
  return { minimum, maximum: Math.max(minimum, maximum) };
}

function isWithinVerticalAttackRange(
  mapOrId,
  player,
  monster,
  verticalFloorRange = 0,
  verticalRangePx = 0
) {
  const pixelRange = Math.max(0, Number(verticalRangePx) || 0);
  if (pixelRange > 0) {
    const playerBottom = Number(getMonsterPlatform(mapOrId, player)?.bottom) || 0;
    const monsterBottom = Number(getMonsterPlatform(mapOrId, monster)?.bottom) || 0;
    return Math.abs(monsterBottom - playerBottom) <= pixelRange;
  }
  return Math.abs(Number(monster.floor) - Number(player.floor))
    <= Math.max(0, Math.floor(Number(verticalFloorRange) || 0));
}

function chooseMonsterSpawnPlatform(map, runtime) {
  const platforms = getMapLayout(map).platforms.filter((platform) => (
    platform.spawnEnabled !== false && Number(platform.spawnSlots) > 0
  ));
  const candidates = platforms
    .map((platform) => {
      const count = runtime.monsters.filter((monster) => (
        monster.hp > 0 && monster.platformId === platform.id
      )).length;
      return {
        platform,
        count,
        remaining: Math.max(0, Math.floor(Number(platform.spawnSlots) || 0) - count)
      };
    })
    .filter((entry) => entry.remaining > 0);
  if (!candidates.length) return null;
  const minimumCount = Math.min(...candidates.map((entry) => entry.count));
  const leastOccupied = candidates.filter((entry) => entry.count === minimumCount);
  const bestRemaining = Math.max(...leastOccupied.map((entry) => entry.remaining));
  return pickRandom(
    leastOccupied.filter((entry) => entry.remaining === bestRemaining)
  )?.platform || null;
}

function keepMonsterSpawnClearOfPlayers(monster, platform, runtime, map) {
  const players = Array.from(runtime.players.values()).filter(
    (player) => Number(player.floor) === Number(monster.floor) && player.currentHp > 0
  );
  if (!players.length) return monster;
  const clearance = 100 / getWorldWidth(map) * 100;
  const nearestDistance = Math.min(
    ...players.map((player) => Math.abs(Number(player.x) - Number(monster.x)))
  );
  if (nearestDistance >= clearance) return monster;
  const bounds = getPlatformBounds(platform);
  const candidates = [bounds.minimum, bounds.maximum];
  monster.x = candidates.sort((left, right) => {
    const leftDistance = Math.min(
      ...players.map((player) => Math.abs(Number(player.x) - left))
    );
    const rightDistance = Math.min(
      ...players.map((player) => Math.abs(Number(player.x) - right))
    );
    return rightDistance - leftDistance;
  })[0];
  return monster;
}
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
    rangedCastMs: 800,
    rangedSkillName: '퇴근 반려 결재',
    rangedDamage: 1_500,
    rangedRangePx: 1_000,
    silenceIntervalMs: 15_000,
    silenceCastMs: 1_000,
    silenceSkillName: '야근실 정숙령',
    silenceDurationMs: 10_000
  }),
  [GAMMAM_NEO_BOSS_ID]: Object.freeze({
    id: GAMMAM_NEO_BOSS_ID,
    name: '감맘 네오',
    icon: '🥔',
    level: 120,
    maxHp: 2_500_000,
    maxMp: 0,
    contactDamage: 4_000,
    physicalDefense: 800,
    magicDefense: 1_200,
    monsterEvasion: 62.73,
    monsterAccuracy: 230,
    requiredAccuracyBase: 230,
    requiredAccuracyPerLevelBelow: 5.33,
    movementSpeed: 70,
    expReward: 1_500_000,
    visualScale: 2.25,
    respawnMinMs: 30 * 60 * 1000,
    respawnMaxMs: 120 * 60 * 1000,
    moneyReward: 180_000,
    lockoutMs: 24 * 60 * 60 * 1000,
    patterns: Object.freeze({
      globalSilence: Object.freeze({
        id: 'global-silence',
        skillName: '감자의 복수',
        intervalMs: 12_000,
        castMs: 1_200,
        damage: 2_250,
        silenceDurationMs: 4_000,
        allPlayers: true
      }),
      closeBlast: Object.freeze({
        id: 'close-blast',
        skillName: '감 맘 행 동',
        intervalMs: 7_000,
        castMs: 900,
        damage: 3_100,
        rangePx: 400
      }),
      dispel: Object.freeze({
        id: 'dispel',
        skillName: '감자감싸기!!!',
        minIntervalMs: 10_000,
        maxIntervalMs: 25_000,
        castMs: 1_200,
        rangePx: 600
      })
    })
  })
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function randomIntegerBetween(minimum, maximum) {
  const min = Math.floor(Number(minimum) || 0);
  const max = Math.max(min, Math.floor(Number(maximum) || min));
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom(array, random = Math.random) {
  if (!Array.isArray(array) || !array.length) return null;
  return array[Math.floor(random() * array.length)] || array[0];
}

function publishGlobalShout({ userId, nickname, message, now = Date.now() } = {}) {
  const normalizedMessage = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!normalizedMessage) throw new Error('외칠 메시지를 입력해주세요.');
  const createdAt = Math.max(0, Number(now) || Date.now());
  latestGlobalShout = {
    id: crypto.randomUUID(),
    userId: String(userId || ''),
    nickname: String(nickname || '사원').trim().slice(0, 16) || '사원',
    message: normalizedMessage,
    createdAt,
    expiresAt: createdAt + GLOBAL_SHOUT_DURATION_MS
  };
  return { ...latestGlobalShout };
}

function getGlobalShout(now = Date.now()) {
  if (!latestGlobalShout || Number(latestGlobalShout.expiresAt) <= Number(now)) {
    latestGlobalShout = null;
    return null;
  }
  return { ...latestGlobalShout };
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

function findMasteryBookDrop(originalSkillId, stage, chance) {
  const book = getMasteryBookByOriginalSkill(originalSkillId, stage);
  if (!book) return null;
  return {
    kind: 'item',
    itemId: book.id,
    quantity: 1,
    icon: book.icon,
    name: book.name,
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
    ), 0.002),
    findMasteryBookDrop('blast', 30, 0.03),
    findMasteryBookDrop('dragon_pulse', 30, 0.03),
    findMasteryBookDrop('blizzard', 30, 0.03),
    findMasteryBookDrop('maple_warrior', 20, 0.01)
  ].filter(Boolean);
}

function getGammamNeoFieldBossDrops() {
  return [
    findMasteryBookDrop('infinity', 20, 0.01),
    findMasteryBookDrop('venom', 20, 0.01),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'cape'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.processingSpeed) === 2
    ), 0.008),
    findMasteryBookDrop('stance', 20, 0.008),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'cape'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.grit) === 2
    ), 0.006),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'cape'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.workKnowledge) === 2
    ), 0.006),
    findScrollDrop((scroll) => (
      scroll.applicableSlot === 'cape'
      && Number(scroll.successRate) === 60
      && Number(scroll.scrollStats?.awareness) === 2
    ), 0.006),
    findMasteryBookDrop('blast', 30, 0.005),
    findMasteryBookDrop('bow_expert', 20, 0.005),
    findMasteryBookDrop('storm', 30, 0.005),
    findMasteryBookDrop('piercing', 30, 0.004),
    findMasteryBookDrop('spirit_javelin', 30, 0.004),
    findMasteryBookDrop('boomerang_step', 30, 0.004),
    findMasteryBookDrop('crossbow_expert', 20, 0.003),
    findMasteryBookDrop('brandish', 30, 0.003),
    findMasteryBookDrop('genesis', 30, 0.01),
    findMasteryBookDrop('maple_warrior', 20, 0.01)
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
  const map = getWorldMap(mapId);
  const definition = getFieldBossDefinition(map?.fieldBossId);
  const minimum = Number(definition?.respawnMinMs) || FIELD_BOSS_RESPAWN_MIN_MS;
  const maximum = Number(definition?.respawnMaxMs) || FIELD_BOSS_RESPAWN_MAX_MS;
  const delay = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
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
  if (monster.raidBoss) {
    if (!monster.phaseContributors || typeof monster.phaseContributors !== 'object') {
      monster.phaseContributors = {};
    }
    monster.phaseContributors[key] = Math.max(0, Number(monster.phaseContributors[key]) || 0)
      + Math.max(0, Math.floor(Number(damage) || 0));
  }
}

function applyRaidBossDamageRule(monster, damage, damageType, now = Date.now()) {
  const safeDamage = Math.max(0, Math.floor(Number(damage) || 0));
  if (
    monster?.raidBoss
    && damageType !== 'magic'
    && Number(monster.physicalImmuneUntil || 0) > now
    && safeDamage > 0
  ) return 1;
  return safeDamage;
}

function resolveRaidBossPhase(runtime, monster, defeatedBy, now = Date.now()) {
  if (!monster?.raidBoss || monster.hp > 0) return { defeated: false, phaseChanged: false };
  const definition = getRaidBossDefinition(monster.raidBossId);
  const phaseIndex = definition?.phases.findIndex((entry) => entry.phase === monster.phase) ?? -1;
  if (!definition || phaseIndex < 0) return { defeated: true, phaseChanged: false };
  const phase = definition.phases[phaseIndex];
  const participants = Object.entries(monster.phaseContributors || {})
    .map(([userId, damage]) => ({
      userId,
      damage: Math.max(0, Math.floor(Number(damage) || 0)),
      alive: Number(runtime.players.get(String(userId))?.currentHp || 0) > 0
    }))
    .filter((entry) => entry.damage > 0)
    .sort((left, right) => right.damage - left.damage);
  const phaseEvent = {
    id: crypto.randomUUID(),
    type: phaseIndex === definition.phases.length - 1 ? 'clear' : 'phase-clear',
    bossId: monster.raidBossId,
    bossName: monster.name,
    mapId: runtime.mapId,
    phase: phase.phase,
    expReward: phase.expReward,
    participants,
    aliveUserIds: Array.from(runtime.players.values())
      .filter((player) => Number(player.currentHp || 0) > 0)
      .map((player) => String(player.userId || ''))
      .filter(Boolean),
    allContributors: { ...(monster.contributors || {}) },
    defeatedBy: String(defeatedBy || ''),
    createdAt: now
  };
  runtime.raidBossRewards.push(phaseEvent);
  runtime.raidEvents.push({ ...phaseEvent, participants: undefined, allContributors: undefined });
  const nextPhase = definition.phases[phaseIndex + 1];
  if (!nextPhase) {
    monster.state = 'defeated';
    monster.currentCast = null;
    runtime.raidState.completed = true;
    runtime.raidState.completedAt = now;
    return { defeated: true, phaseChanged: false, event: phaseEvent };
  }
  monster.phase = nextPhase.phase;
  monster.phaseColor = nextPhase.color;
  monster.maxHp = nextPhase.maxHp;
  monster.hp = nextPhase.maxHp;
  monster.expReward = nextPhase.expReward;
  monster.phaseContributors = {};
  monster.currentCast = null;
  monster.physicalImmuneUntil = 0;
  monster.nextPatternAt = now + nextPhase.intervalMs;
  monster.state = 'raid-boss';
  return { defeated: false, phaseChanged: true, event: phaseEvent };
}

function getFieldBossRandomDropTable(fieldBossId) {
  if (String(fieldBossId || '') === GAMMAM_NEO_BOSS_ID) return getGammamNeoFieldBossDrops();
  return getHwangFieldBossDrops();
}

function rollFieldBossRandomRewards(fieldBossId = 'mad_hwang_manager') {
  const rewards = [];
  for (const drop of getFieldBossRandomDropTable(fieldBossId)) {
    if (Math.random() >= Number(drop.chance || 0)) continue;
    rewards.push({
      itemId: drop.itemId,
      quantity: Number(drop.quantity) || 1,
      name: drop.name,
      icon: drop.icon
    });
  }
  if (String(fieldBossId || '') !== GAMMAM_NEO_BOSS_ID && Math.random() < 0.05) {
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

function addStackableRewardItem(reward, item) {
  const existing = reward.items.find((entry) => (
    entry.itemId === item.itemId && !entry.instanceData && !item.instanceData
  ));
  if (existing) {
    existing.quantity += Math.max(1, Math.floor(Number(item.quantity) || 1));
    return;
  }
  reward.items.push({ ...item });
}

function distributeGuaranteedFieldBossItem(rewards, item, totalQuantity) {
  if (!rewards.length) return;
  let remaining = Math.max(rewards.length, Math.floor(Number(totalQuantity) || 0));

  // Every EXP-eligible participant receives at least one before the rest is randomized.
  for (const reward of rewards) {
    addStackableRewardItem(reward, { ...item, quantity: 1 });
    remaining -= 1;
  }
  while (remaining > 0) {
    const receiver = pickRandom(rewards);
    if (!receiver) break;
    addStackableRewardItem(receiver, { ...item, quantity: 1 });
    remaining -= 1;
  }
}

function buildFieldBossRewardEvent(runtime, monster, mapId, defeatedBy, now = Date.now()) {
  if (!monster?.fieldBoss) return null;
  const definition = getFieldBossDefinition(monster.fieldBossId);
  const minimumParticipantLevel = Math.max(
    1,
    Math.floor(Number(definition?.minimumParticipantLevel) || 50)
  );
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
      && Number(entry.player.combatProfile?.playerLevel || 0) >= minimumParticipantLevel
    ))
    .sort((left, right) => right.damage - left.damage);
  if (!participants.length) {
    return {
      bossId: monster.fieldBossId,
      bossName: monster.name,
      mapId,
      bossX: Number.isFinite(Number(monster.x)) ? Number(monster.x) : 50,
      bossFloor: Math.max(0, Math.floor(Number(monster.floor) || 0)),
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

  const totalMoney = Math.max(0, Math.floor(Number(definition?.moneyReward) || 30_000 * 5));
  const moneyShare = Math.floor(totalMoney / rewards.length);
  rewards.forEach((reward) => {
    reward.money = moneyShare;
  });

  if (String(monster.fieldBossId || '') === GAMMAM_NEO_BOSS_ID) {
    for (const guaranteedDrop of [
      { itemId: 'sunset_dew', name: '황혼의 이슬', icon: '💧', min: 20, max: 50 },
      { itemId: 'power_elixir', name: '파워엘릭서', icon: '⚗️', min: 10, max: 40 },
      { itemId: 'elixir', name: '엘릭서', icon: '🧪', min: 20, max: 50 },
      {
        itemId: 'gammam_broken_potato_leg',
        name: '감자의 부러진 다리',
        icon: '🥔',
        min: 1,
        max: 2
      }
    ]) {
      const quantityPerParticipant = randomIntegerBetween(guaranteedDrop.min, guaranteedDrop.max);
      distributeGuaranteedFieldBossItem(
        rewards,
        guaranteedDrop,
        rewards.length * quantityPerParticipant
      );
    }
  } else {
    const markReceiver = pickRandom(rewards);
    if (markReceiver) {
      markReceiver.items.push({
        itemId: 'hwang_manager_mark',
        quantity: Math.random() < 0.5 ? 1 : 2
      });
    }
    for (const guaranteedDrop of [
      { itemId: 'elixir', name: '엘릭서', icon: '🧪' },
      { itemId: 'power_elixir', name: '파워엘릭서', icon: '⚗️' }
    ]) {
      const quantityPerParticipant = 9 + Math.floor(Math.random() * 8);
      distributeGuaranteedFieldBossItem(
        rewards,
        guaranteedDrop,
        rewards.length * quantityPerParticipant
      );
    }
  }
  for (const item of rollFieldBossRandomRewards(monster.fieldBossId)) {
    const receiver = pickRandom(rewards);
    if (receiver) receiver.items.push(item);
  }

  return {
    bossId: monster.fieldBossId,
    bossName: monster.name,
    mapId,
    bossX: Number.isFinite(Number(monster.x)) ? Number(monster.x) : 50,
    bossFloor: Math.max(0, Math.floor(Number(monster.floor) || 0)),
    defeatedBy: String(defeatedBy || ''),
    defeatedAt: now,
    respawnAt,
    rewards
  };
}

function mapHasUpperFloor(map) {
  return getMapMaximumFloor(map) > 0;
}

function createMonster(map, index, now, platform = null, speciesOverride = null) {
  const spawnPlatform = platform
    || getMapLayout(map).platforms.find((entry) => entry.spawnEnabled !== false)
    || getMapLayout(map).platforms[0];
  const platformSpeciesPool = Array.isArray(spawnPlatform?.monsterIds)
    ? spawnPlatform.monsterIds
      .map((monsterId) => MONSTER_CATALOG.find((monster) => monster.id === monsterId))
      .filter(Boolean)
    : [];
  const speciesPool = platformSpeciesPool.length
    ? platformSpeciesPool
    : getMonsterSpeciesForMap(map);
  const species = speciesOverride || speciesPool[index % speciesPool.length] || MONSTER_CATALOG[0];
  const stats = buildMonsterStats(species.level, species);
  const bounds = getPlatformBounds(spawnPlatform);
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
    x: randomBetween(bounds.minimum, bounds.maximum),
    floor: normalizeMapFloor(map, spawnPlatform?.floor),
    platformId: String(spawnPlatform?.id || 'ground'),
    direction: Math.random() < 0.5 ? -1 : 1,
    state: 'idle',
    spawnedAt: now,
    decisionAt: now + randomBetween(800, 2_600),
    stunnedUntil: 0,
    frozenUntil: 0,
    outgoingDamageReductionPercent: 0,
    outgoingDamageDebuffUntil: 0,
    aggroTargetId: ''
  };
}

function createFieldBoss(map, now) {
  const definition = getFieldBossDefinition(map.fieldBossId);
  if (!definition) return null;
  const patterns = definition.patterns || {};
  const platform = getMapLayout(map).platforms.find((entry) => entry.spawnEnabled !== false)
    || getMapLayout(map).platforms[0];
  const bounds = getPlatformBounds(platform);
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
    requiredAccuracyBase: definition.requiredAccuracyBase || 0,
    requiredAccuracyPerLevelBelow: definition.requiredAccuracyPerLevelBelow || 0,
    elementalMultipliers: {},
    undead: false,
    visualScale: definition.visualScale,
    x: clamp(72, bounds.minimum, bounds.maximum),
    floor: normalizeMapFloor(map, platform?.floor),
    platformId: String(platform?.id || 'boss-arena'),
    direction: -1,
    state: 'field-boss',
    spawnedAt: now,
    decisionAt: now + 1200,
    stunnedUntil: 0,
    frozenUntil: 0,
    outgoingDamageReductionPercent: 0,
    outgoingDamageDebuffUntil: 0,
    aggroTargetId: '',
    contributors: {},
    currentCast: null,
    nextRangedAt: Number(definition.rangedIntervalMs) > 0
      ? now + definition.rangedIntervalMs
      : 0,
    nextSilenceAt: Number(definition.silenceIntervalMs) > 0
      ? now + definition.silenceIntervalMs
      : 0,
    nextGlobalSilenceAt: patterns.globalSilence
      ? now + patterns.globalSilence.intervalMs
      : 0,
    nextCloseBlastAt: patterns.closeBlast
      ? now + patterns.closeBlast.intervalMs
      : 0,
    nextDispelAt: patterns.dispel
      ? now + randomIntegerBetween(patterns.dispel.minIntervalMs, patterns.dispel.maxIntervalMs)
      : 0
  };
}

function createRaidBoss(map, now) {
  const definition = getRaidBossDefinition(map?.raidBossId);
  if (!definition) return null;
  const phase = definition.phases[0];
  return {
    id: crypto.randomUUID(),
    speciesId: definition.id,
    fieldBoss: true,
    fieldBossId: '',
    raidBoss: true,
    raidBossId: definition.id,
    name: definition.name,
    icon: definition.icon,
    level: definition.level,
    phase: phase.phase,
    phaseColor: phase.color,
    hideHpNumbers: true,
    hp: phase.maxHp,
    maxHp: phase.maxHp,
    mp: definition.maxMp,
    maxMp: definition.maxMp,
    contactDamage: definition.contactDamage,
    physicalDefense: definition.physicalDefense,
    magicDefense: definition.magicDefense,
    movementSpeed: 0,
    expReward: phase.expReward,
    monsterAccuracy: 999,
    monsterEvasion: 0,
    requiredAccuracyBase: 0,
    requiredAccuracyPerLevelBelow: 0,
    elementalMultipliers: {},
    undead: false,
    visualScale: definition.visualScale,
    x: 50,
    floor: 0,
    platformId: 'kim-arena',
    direction: -1,
    state: 'raid-boss',
    spawnedAt: now,
    decisionAt: Number.MAX_SAFE_INTEGER,
    stunnedUntil: 0,
    frozenUntil: 0,
    outgoingDamageReductionPercent: 0,
    outgoingDamageDebuffUntil: 0,
    aggroTargetId: '',
    contributors: {},
    phaseContributors: {},
    currentCast: null,
    nextPatternAt: now + phase.intervalMs,
    physicalImmuneUntil: 0
  };
}

function createMapRuntime(mapId, now) {
  const map = getWorldMap(mapId);
  const raidDefinition = getRaidBossDefinition(map?.raidBossId);
  return {
    mapId,
    players: new Map(),
    monsters: [],
    groundLoot: [],
    fieldBossRewards: [],
    fieldBossStatusEvents: [],
    summonEvents: [],
    raidBossRewards: [],
    raidEvents: [],
    raidContactEventsByUser: new Map(),
    raidState: raidDefinition ? {
      bossId: raidDefinition.id,
      countdownStartedAt: now,
      spawnAt: now + raidDefinition.spawnDelayMs,
      spawned: false,
      completed: false,
      completedAt: 0
    } : null,
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
    raidBoss: Boolean(monster.raidBoss),
    raidBossId: monster.raidBossId || '',
    phase: Math.max(0, Number(monster.phase) || 0),
    phaseColor: String(monster.phaseColor || ''),
    hideHpNumbers: Boolean(monster.hideHpNumbers),
    physicalImmuneUntil: Math.max(0, Number(monster.physicalImmuneUntil) || 0),
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
    requiredAccuracyBase: monster.requiredAccuracyBase || 0,
    requiredAccuracyPerLevelBelow: monster.requiredAccuracyPerLevelBelow || 0,
    outgoingDamageReductionPercent: Math.max(
      0,
      Number(monster.outgoingDamageReductionPercent) || 0
    ),
    outgoingDamageDebuffUntil: Math.max(0, Number(monster.outgoingDamageDebuffUntil) || 0),
    elementalMultipliers: { ...(monster.elementalMultipliers || {}) },
    undead: Boolean(monster.undead),
    x: monster.x,
    floor: monster.floor,
    platformId: monster.platformId || '',
    direction: monster.direction,
    state: monster.state,
    currentCast: monster.currentCast ? { ...monster.currentCast } : null,
    spawnedAt: monster.spawnedAt,
    frozenUntil: Math.max(0, Number(monster.frozenUntil) || 0),
    visualScale: Math.max(1, Number(monster.visualScale) || 1)
  };
}

function serializePlayer(player, now = Date.now()) {
  const summon = player.summon && Number(player.summon.expiresAt) > now
    ? {
      ...player.summon,
      summonHp: Math.max(0, Number(player.summon.summonHp) || 0),
      maxSummonHp: Math.max(0, Number(player.summon.maxSummonHp) || 0)
    }
    : null;
  const decoySummon = player.decoySummon && Number(player.decoySummon.expiresAt) > now
    ? {
      ...player.decoySummon,
      summonHp: Math.max(0, Number(player.decoySummon.summonHp) || 0),
      maxSummonHp: Math.max(0, Number(player.decoySummon.maxSummonHp) || 0)
    }
    : null;
  const statusEffects = [];
  if (Number(player.silencedUntil || 0) > now) {
    statusEffects.push({
      id: 'silence',
      name: '침묵',
      icon: '🔒',
      expiresAt: Number(player.silencedUntil)
    });
  }
  if (Number(player.stunnedUntil || 0) > now) {
    statusEffects.push({
      id: 'raid-stun',
      name: '기절',
      icon: '💫',
      expiresAt: Number(player.stunnedUntil),
      uncleansableByPotion: true
    });
  }
  return {
    userId: player.userId,
    nickname: player.nickname,
    playerLevel: Math.max(1, Number(player.combatProfile?.playerLevel) || 1),
    jobName: String(player.combatProfile?.jobName || '초보 사원'),
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
    stunnedUntil: Number(player.stunnedUntil) || 0,
    statusEffects,
    stealth: Number(player.combatProfile?.stealth) > 0,
    online: now - Number(player.lastSeenAt || 0) <= PLAYER_TIMEOUT_MS,
    autoHunting: Boolean(player.autoHunting),
    recentSkill: player.recentSkill?.expiresAt > now ? { ...player.recentSkill } : null,
    jumpEvent: player.jumpEvent?.expiresAt > now ? { ...player.jumpEvent } : null,
    summon,
    decoySummon,
    summons: [decoySummon, summon].filter(Boolean),
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
  const userKey = String(userId);
  const retainedMapId = String(exceptMapId || '');
  const previousMapId = playerMapIndex.get(userKey);
  if (previousMapId && previousMapId !== retainedMapId) {
    const runtime = activeMaps.get(previousMapId);
    runtime?.players.delete(userKey);
    if (runtime) {
      runtime.groundLoot = runtime.groundLoot.filter(
        (loot) => String(loot.userId) !== userKey
      );
    }
  }
  if (retainedMapId) playerMapIndex.set(userKey, retainedMapId);
  else playerMapIndex.delete(userKey);
}

function cleanupInactiveMaps(now) {
  for (const [mapId, runtime] of activeMaps) {
    for (const [userId, player] of runtime.players) {
      if (now - player.lastSeenAt <= PLAYER_TIMEOUT_MS) continue;
      const raidCorpseAge = now - Number(player.deadAt || player.lastSeenAt || 0);
      if (
        Number(player.currentHp) <= 0
        && getWorldMap(mapId)?.raidBossId
        && raidCorpseAge < RAID_CORPSE_RETENTION_MS
      ) continue;
      if (player.autoHunting && now < Number(player.autoHuntEndsAt || 0)) continue;
      runtime.players.delete(userId);
      if (playerMapIndex.get(String(userId)) === mapId) {
        playerMapIndex.delete(String(userId));
      }
      runtime.groundLoot = runtime.groundLoot.filter(
        (loot) => String(loot.userId) !== String(userId)
      );
    }
    if (!runtime.players.size) {
      if (getWorldMap(mapId)?.raidBossId && now - Number(runtime.lastTickAt || now) < 2 * 60 * 60 * 1000) {
        continue;
      }
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
  if (!runtime.players.size) return;
  if (map.raidBossId) {
    if (
      runtime.raidState
      && !runtime.raidState.spawned
      && !runtime.raidState.completed
      && now >= Number(runtime.raidState.spawnAt || 0)
    ) {
      const boss = createRaidBoss(map, now);
      if (boss) {
        runtime.monsters.push(boss);
        runtime.raidState.spawned = true;
        runtime.raidEvents.push({
          id: crypto.randomUUID(),
          type: 'spawn',
          bossId: boss.raidBossId,
          bossName: boss.name,
          createdAt: now
        });
      }
    }
    runtime.nextSpawnAt = now + 250;
    return;
  }
  if (now < runtime.nextSpawnAt) return;
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
  const layout = getMapLayout(map);
  const liveMonsterCount = runtime.monsters.filter((monster) => monster.hp > 0).length;
  const availableSlots = Math.max(
    0,
    Math.floor(Number(layout.maxMonsters) || MONSTER_MAX_PER_MAP) - liveMonsterCount
  );
  const spawnCount = Math.min(
    Math.max(1, Math.floor(Number(layout.spawnPerWave) || MONSTER_SPAWN_PER_WAVE)),
    availableSlots
  );
  const fixedWavePlatforms = layout.platforms.filter((platform) => (
    platform.spawnEnabled !== false
    && Number(platform.spawnSlots) > 0
    && Number(platform.spawnPerWave) > 0
  ));
  if (fixedWavePlatforms.length) {
    let remainingGlobalSlots = availableSlots;
    for (const platform of fixedWavePlatforms) {
      const currentCount = runtime.monsters.filter((monster) => (
        monster.hp > 0 && monster.platformId === platform.id
      )).length;
      const platformSlots = Math.max(
        0,
        Math.floor(Number(platform.spawnSlots) || 0) - currentCount
      );
      const platformSpawnCount = Math.min(
        Math.max(0, Math.floor(Number(platform.spawnPerWave) || 0)),
        platformSlots,
        remainingGlobalSlots
      );
      for (let index = 0; index < platformSpawnCount; index += 1) {
        const monster = createMonster(map, runtime.spawnSequence, now, platform);
        runtime.monsters.push(keepMonsterSpawnClearOfPlayers(monster, platform, runtime, map));
        runtime.spawnSequence += 1;
      }
      remainingGlobalSlots -= platformSpawnCount;
      if (remainingGlobalSlots <= 0) break;
    }
    runtime.nextSpawnAt = now + MONSTER_SPAWN_INTERVAL_MS;
    return;
  }
  for (let index = 0; index < spawnCount; index += 1) {
    const platform = chooseMonsterSpawnPlatform(map, runtime);
    if (!platform) break;
    const monster = createMonster(map, runtime.spawnSequence, now, platform);
    runtime.monsters.push(keepMonsterSpawnClearOfPlayers(monster, platform, runtime, map));
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
  monster.floor = normalizeMapFloor(map, monster.floor);
}

function normalizeWorldSummon(summon, previousSummon, {
  x,
  floor,
  facingLeft
} = {}, now = Date.now()) {
  if (!summon?.skillId) return null;
  const expiresAt = new Date(summon.expiresAt || 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  const createdAt = new Date(summon.createdAt || 0).getTime();
  const sameSummon = previousSummon
    && String(previousSummon.skillId) === String(summon.skillId)
    && Number(previousSummon.createdAt) === createdAt;
  const incomingHp = Math.max(0, Math.floor(Number(summon.summonHp) || 0));
  const summonHp = sameSummon
    ? Math.max(0, Math.floor(Number(previousSummon.summonHp) || 0))
    : incomingHp;
  return {
    skillId: String(summon.skillId),
    name: String(summon.name || '소환수').slice(0, 40),
    icon: String(summon.icon || '🐾').slice(0, 8),
    role: String(summon.role || 'support'),
    summonHp,
    maxSummonHp: Math.max(
      summonHp,
      Math.floor(Number(summon.maxSummonHp) || incomingHp)
    ),
    createdAt,
    expiresAt,
    x: clamp(Number(x) + (facingLeft ? -2.8 : 2.8), 1, 93),
    floor: Math.max(0, Math.floor(Number(floor) || 0))
  };
}

function getActiveDecoys(runtime, now = Date.now()) {
  return Array.from(runtime.players.values())
    .map((player) => ({
      player,
      summon: player.decoySummon?.role === 'decoy'
        ? player.decoySummon
        : (player.summon?.role === 'decoy' ? player.summon : null)
    }))
    .filter(({ player, summon }) => (
      player.currentHp > 0
      && summon
      && Number(summon.summonHp) > 0
      && Number(summon.expiresAt) > now
    ))
    .map(({ player, summon }) => ({
      player,
      summon,
      x: Number(summon.x),
      floor: Number(summon.floor)
    }));
}

function findNearestDecoy(runtime, monster, now = Date.now()) {
  return getActiveDecoys(runtime, now)
    .filter((entry) => entry.floor === monster.floor)
    .sort((left, right) => (
      Math.abs(left.x - monster.x) - Math.abs(right.x - monster.x)
    ))[0] || null;
}

function damageDecoy(runtime, decoy, monster, damage, source, now) {
  if (!decoy?.summon || Number(decoy.summon.summonHp) <= 0) return null;
  const appliedDamage = Math.max(
    1,
    Math.min(Number(decoy.summon.summonHp), Math.floor(Number(damage) || 1))
  );
  decoy.summon.summonHp = Math.max(0, Number(decoy.summon.summonHp) - appliedDamage);
  const event = {
    userId: decoy.player.userId,
    skillId: decoy.summon.skillId,
    summonName: decoy.summon.name,
    summonIcon: decoy.summon.icon,
    summonCreatedAt: decoy.summon.createdAt,
    damage: appliedDamage,
    summonHp: decoy.summon.summonHp,
    maxSummonHp: decoy.summon.maxSummonHp,
    destroyed: decoy.summon.summonHp <= 0,
    monsterId: monster.id,
    source,
    createdAt: now
  };
  if (!Array.isArray(runtime.summonEvents)) runtime.summonEvents = [];
  runtime.summonEvents.push(event);
  return event;
}

function advanceMonster(monster, runtime, map, deltaSeconds, now) {
  if (monster.hp <= 0) return;
  if (monster.raidBoss) {
    monster.x = 50;
    monster.floor = 0;
    monster.platformId = 'kim-arena';
    monster.state = monster.currentCast ? `casting-${monster.currentCast.pattern}` : 'raid-boss';
    return;
  }
  if (now < Number(monster.stunnedUntil || 0)) {
    monster.state = 'stunned';
    return;
  }
  if (monster.currentCast) {
    monster.state = `casting-${monster.currentCast.pattern || 'field-boss'}`;
    return;
  }

  const decoy = findNearestDecoy(runtime, monster, now);
  const aggroTarget = monster.aggroTargetId && runtime.players.get(monster.aggroTargetId);
  const playerTarget = Number(aggroTarget?.combatProfile?.stealth) > 0 ? null : aggroTarget;
  const target = decoy
    ? { x: decoy.x, floor: decoy.floor, decoy }
    : playerTarget;
  monster.aggroTargetType = decoy ? 'decoy' : (target ? 'player' : '');
  if (decoy) monster.aggroTargetId = decoy.player.userId;
  if (aggroTarget && !target) monster.aggroTargetId = '';
  const platform = getMonsterPlatform(map, monster);
  const { minimum, maximum } = getPlatformBounds(platform);
  const worldWidth = getWorldWidth(map);
  if (target && target.floor === monster.floor) {
    const difference = target.x - monster.x;
    if (Math.abs(difference) > 2.2) {
      monster.direction = difference < 0 ? -1 : 1;
      monster.state = 'chase';
      const step = monster.movementSpeed / worldWidth * 100 * deltaSeconds;
      monster.x += Math.sign(difference) * Math.min(Math.abs(difference), step);
      monster.x = clamp(monster.x, minimum, maximum);
    } else {
      monster.state = 'idle';
    }
    return;
  }

  if (now >= monster.decisionAt) chooseWanderAction(monster, map, now);
  if (monster.state !== 'walk-left' && monster.state !== 'walk-right') return;

  const step = monster.movementSpeed / worldWidth * 100 * deltaSeconds;
  monster.x += monster.direction * step;

  monster.x = clamp(monster.x, minimum, maximum);
  if (monster.x <= minimum || monster.x >= maximum) {
    monster.direction *= -1;
    monster.state = monster.direction < 0 ? 'walk-left' : 'walk-right';
  }
}

function applyContactDamage(runtime, now) {
  const damagedPlayers = [];
  const monstersBlockedByDecoys = new Set();
  const map = getWorldMap(runtime.mapId);
  const worldWidth = getWorldWidth(map);
  const monsterHalfWidthPercent = MONSTER_VISUAL_WIDTH_PX / 2 / worldWidth * 100;
  const decoyHalfWidthPercent = DECOY_VISUAL_WIDTH_PX / 2 / worldWidth * 100;
  for (const monster of runtime.monsters) {
    if (monster.hp <= 0) continue;
    const decoy = findNearestDecoy(runtime, monster, now);
    if (!decoy || decoy.floor !== monster.floor) continue;
    monstersBlockedByDecoys.add(monster.id);
    monster.aggroTargetId = decoy.player.userId;
    monster.aggroTargetType = 'decoy';
    if (Math.abs(decoy.x - monster.x) > monsterHalfWidthPercent + decoyHalfWidthPercent) continue;
    monster.state = 'idle';
    if (monster.lastSummonContactAt && now - monster.lastSummonContactAt < CONTACT_COOLDOWN_MS) {
      continue;
    }
    const outgoingReduction = now < Number(monster.outgoingDamageDebuffUntil || 0)
      ? Math.max(0, Math.min(95, Number(monster.outgoingDamageReductionPercent) || 0))
      : 0;
    damageDecoy(
      runtime,
      decoy,
      monster,
      Number(monster.contactDamage) * (1 - outgoingReduction / 100),
      monster.fieldBoss ? 'field-boss-contact' : 'monster-contact',
      now
    );
    monster.lastSummonContactAt = now;
  }
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
    const playerWidthPercent = PLAYER_VISUAL_WIDTH_PX / worldWidth * 100;
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
      if (
        monster.hp <= 0
        || monster.floor !== player.floor
        || monstersBlockedByDecoys.has(monster.id)
      ) return false;
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
    const damageTakenIncrease = Math.max(
      0,
      Number(player.combatProfile.damageTakenIncreasePercent) || 0
    );
    const incomingDamage = blocked || dodged
      ? 0
      : Math.max(1, Math.floor(
        calculation.damage
          * (1 - reduction / 100)
          * (1 + damageTakenIncrease / 100)
      ));
    const damageSplit = splitDamageWithMpGuard(incomingDamage, {
      currentMp: player.currentMp,
      guardPercent: player.combatProfile.mpDamageGuardPercent
    });
    player.currentMp = Math.max(0, Number(player.currentMp) - damageSplit.mpDamage);
    player.currentHp = Math.max(0, Number(player.currentHp) - damageSplit.hpDamage);
    player.lastContactAt = now;
    player.invulnerableUntil = now + CONTACT_INVULNERABILITY_MS;
    const resistedKnockback = Math.random() * 100 < Number(player.combatProfile.stanceChance || 0);
    if (!blocked && !dodged && !resistedKnockback) {
      const playerCenterX = player.x + playerWidthPercent / 2;
      const relativeContactX = playerCenterX - collider.x;
      const knockbackDirection = Math.abs(relativeContactX) > 0.01
        ? Math.sign(relativeContactX)
        : (player.facingLeft ? 1 : -1);
      const knockbackDistance = (
        PLAYER_CONTACT_KNOCKBACK_DISTANCE * ASSUMED_STAGE_WIDTH_PX / worldWidth
      ) * (
        1 - Math.max(
          0,
          Math.min(95, Number(player.combatProfile.knockbackReductionPercent) || 0)
        ) / 100
      );
      const playerBounds = getPlatformBounds(getMonsterPlatform(map, player));
      player.x = clamp(
        player.x + knockbackDirection * knockbackDistance,
        Math.max(0, playerBounds.minimum),
        Math.min(94, playerBounds.maximum)
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
        if (collider.raidBoss) {
          resolveRaidBossPhase(runtime, collider, player.userId, now);
        } else {
          collider.state = 'defeated';
        }
        if (collider.fieldBoss && !collider.raidBoss) {
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

function getRequiredAccuracyForMonster(monster, playerLevel) {
  const base = Number(monster?.requiredAccuracyBase) || 0;
  if (base > 0) {
    const levelGap = Math.max(0, Math.floor(Number(monster?.level) || 0) - Math.floor(Number(playerLevel) || 0));
    return base + levelGap * (Number(monster?.requiredAccuracyPerLevelBelow) || 0);
  }
  return calculateRequiredAccuracy({
    characterLevel: playerLevel,
    monsterLevel: monster.level,
    monsterEvasion: monster.monsterEvasion
  });
}

function getRangePercent(rangePx, mapOrId) {
  return Math.max(0, Number(rangePx) || 0) / getWorldWidth(mapOrId) * 100;
}

function getLiveFieldBossPlayers(runtime) {
  return Array.from(runtime.players.values()).filter((player) => (
    player.currentHp > 0 && Number(player.combatProfile?.stealth) <= 0
  ));
}

function getFieldBossPlayersInRange(runtime, boss, rangePx, { requireVulnerable = false, now = Date.now() } = {}) {
  const rangePercent = getRangePercent(rangePx, runtime.mapId);
  return getLiveFieldBossPlayers(runtime).filter((player) => (
    player.floor === boss.floor
    && Math.abs(Number(player.x) - Number(boss.x)) <= rangePercent + 4.5
    && (!requireVulnerable || now >= Number(player.invulnerableUntil || 0))
  ));
}

function getNearestFieldBossPlayer(runtime, boss) {
  return getLiveFieldBossPlayers(runtime)
    .sort((left, right) => {
      const leftFloorPenalty = left.floor === boss.floor ? 0 : 10_000;
      const rightFloorPenalty = right.floor === boss.floor ? 0 : 10_000;
      return leftFloorPenalty + Math.abs(Number(left.x) - Number(boss.x))
        - (rightFloorPenalty + Math.abs(Number(right.x) - Number(boss.x)));
    })[0] || null;
}

function makeFieldBossPursueTarget(runtime, boss) {
  const target = getNearestFieldBossPlayer(runtime, boss);
  if (!target) return false;
  boss.aggroTargetId = target.userId;
  boss.aggroTargetType = 'player';
  boss.direction = Number(target.x) < Number(boss.x) ? -1 : 1;
  boss.state = 'chase';
  return true;
}

function canStartFieldBossPattern(runtime, boss, config = {}, now = Date.now()) {
  if (config.allPlayers) return getLiveFieldBossPlayers(runtime).length > 0;
  if (Number(config.rangePx) > 0) {
    if (config.allowDecoys) {
      const rangePercent = getRangePercent(config.rangePx, runtime.mapId);
      const decoyTarget = getActiveDecoys(runtime, now).some((entry) => (
        entry.floor === boss.floor
        && Math.abs(Number(entry.x) - Number(boss.x)) <= rangePercent + 4.5
      ));
      if (decoyTarget) return true;
    }
    return getFieldBossPlayersInRange(runtime, boss, config.rangePx, { now }).length > 0;
  }
  return getLiveFieldBossPlayers(runtime).some((player) => player.floor === boss.floor);
}

function applyFixedFieldBossDamage(player, boss, baseDamage, source, now) {
  if (!player || now < Number(player.invulnerableUntil || 0)) return null;
  const dodged = Math.random() * 100 < Number(player.combatProfile?.dodgeChance || 0);
  const reduction = Math.max(
    0,
    Math.min(95, Number(player.combatProfile?.damageReductionPercent) || 0)
  );
  const damageTakenIncrease = Math.max(
    0,
    Number(player.combatProfile?.damageTakenIncreasePercent) || 0
  );
  const damage = dodged
    ? 0
    : Math.max(1, Math.floor(
      (Number(baseDamage) || 1)
        * (1 - reduction / 100)
        * (1 + damageTakenIncrease / 100)
    ));
  const damageSplit = splitDamageWithMpGuard(damage, {
    currentMp: player.currentMp,
    guardPercent: player.combatProfile?.mpDamageGuardPercent
  });
  player.currentMp = Math.max(0, Number(player.currentMp) - damageSplit.mpDamage);
  player.currentHp = Math.max(0, Number(player.currentHp) - damageSplit.hpDamage);
  player.invulnerableUntil = now + CONTACT_INVULNERABILITY_MS;
  return {
    userId: player.userId,
    damage: damageSplit.hpDamage,
    totalDamage: damageSplit.totalDamage,
    mpDamage: damageSplit.mpDamage,
    blocked: false,
    dodged,
    resistedKnockback: true,
    reflectedDamage: 0,
    monsterId: boss.id,
    source,
    currentHp: player.currentHp,
    currentMp: player.currentMp,
    maxHp: player.maxHp,
    x: player.x,
    floor: player.floor,
    invulnerableUntil: player.invulnerableUntil
  };
}

function applyRaidResourceCrash(player, boss, now = Date.now()) {
  if (!player || now < Number(player.invulnerableUntil || 0)) return null;
  const dodged = Math.random() * 100 < Number(player.combatProfile?.dodgeChance || 0);
  const previousHp = Math.max(1, Number(player.currentHp) || 1);
  const previousMp = Math.max(0, Number(player.currentMp) || 0);
  if (!dodged) {
    player.currentHp = 1;
    player.currentMp = 1;
  }
  player.invulnerableUntil = now + CONTACT_INVULNERABILITY_MS;
  return {
    userId: player.userId,
    damage: dodged ? 0 : Math.max(0, previousHp - 1),
    totalDamage: dodged ? 0 : Math.max(0, previousHp - 1),
    mpDamage: dodged ? 0 : Math.max(0, previousMp - 1),
    blocked: false,
    dodged,
    resistedKnockback: true,
    reflectedDamage: 0,
    monsterId: boss.id,
    source: 'raid-resource-crash',
    currentHp: player.currentHp,
    currentMp: player.currentMp,
    maxHp: player.maxHp,
    x: player.x,
    floor: player.floor,
    invulnerableUntil: player.invulnerableUntil
  };
}

function startGammamNeoPattern(runtime, boss, pattern, config, now) {
  const durationMs = Math.max(0, Math.floor(Number(config.castMs) || 0));
  const resolvesAt = now + durationMs;
  boss.currentCast = {
    pattern,
    skillName: String(config.skillName || ''),
    startedAt: now,
    resolvesAt,
    durationMs,
    rangePx: Math.max(0, Math.floor(Number(config.rangePx) || 0)),
    damage: Math.max(0, Math.floor(Number(config.damage) || 0)),
    silenceDurationMs: Math.max(0, Math.floor(Number(config.silenceDurationMs) || 0))
  };
  boss.state = `casting-${pattern}`;
  runtime.fieldBossStatusEvents.push({
    type: 'cast',
    pattern,
    skillName: boss.currentCast.skillName,
    bossId: boss.id,
    bossName: boss.name,
    rangePx: boss.currentCast.rangePx,
    damage: boss.currentCast.damage,
    durationMs,
    resolvesAt,
    createdAt: now
  });
}

function resolveGammamNeoPattern(runtime, boss, now) {
  const cast = boss.currentCast;
  if (!cast) return [];
  boss.currentCast = null;
  boss.state = 'field-boss';
  const events = [];
  const livePlayers = getLiveFieldBossPlayers(runtime);
  const sameFloorInRange = (rangePx) => {
    const rangePercent = getRangePercent(rangePx, runtime.mapId);
    return livePlayers.filter((player) => (
      player.floor === boss.floor
      && Math.abs(Number(player.x) - Number(boss.x)) <= rangePercent + 4.5
    ));
  };
  if (cast.pattern === 'global-silence') {
    for (const target of livePlayers) {
      const damageEvent = applyFixedFieldBossDamage(
        target,
        boss,
        cast.damage,
        'field-boss-global-silence',
        now
      );
      if (damageEvent) events.push(damageEvent);
      target.silencedUntil = Math.max(
        Number(target.silencedUntil) || 0,
        now + Math.max(0, Number(cast.silenceDurationMs) || 0)
      );
      runtime.fieldBossStatusEvents.push({
        type: 'silence',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: target.userId,
        damage: damageEvent?.damage || 0,
        totalDamage: damageEvent?.totalDamage || 0,
        mpDamage: damageEvent?.mpDamage || 0,
        dodged: Boolean(damageEvent?.dodged),
        durationMs: cast.silenceDurationMs,
        expiresAt: target.silencedUntil,
        createdAt: now
      });
    }
  } else if (cast.pattern === 'close-blast') {
    for (const target of sameFloorInRange(cast.rangePx)) {
      const damageEvent = applyFixedFieldBossDamage(
        target,
        boss,
        cast.damage,
        'field-boss-close-blast',
        now
      );
      if (!damageEvent) continue;
      events.push(damageEvent);
      runtime.fieldBossStatusEvents.push({
        type: 'close-blast',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: target.userId,
        damage: damageEvent.damage,
        totalDamage: damageEvent.totalDamage,
        mpDamage: damageEvent.mpDamage,
        dodged: Boolean(damageEvent.dodged),
        rangePx: cast.rangePx,
        createdAt: now
      });
    }
  } else if (cast.pattern === 'dispel') {
    for (const target of sameFloorInRange(cast.rangePx)) {
      runtime.fieldBossStatusEvents.push({
        type: 'dispel',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: target.userId,
        rangePx: cast.rangePx,
        createdAt: now
      });
    }
  }
  return events;
}

function startFieldBossPatternIfReady(runtime, boss, pattern, config, now, onStart) {
  if (!canStartFieldBossPattern(runtime, boss, config, now)) {
    makeFieldBossPursueTarget(runtime, boss);
    return false;
  }
  if (typeof onStart === 'function') onStart();
  startGammamNeoPattern(runtime, boss, pattern, config, now);
  return true;
}

function resolveHwangFieldBossPattern(runtime, boss, definition, now) {
  const cast = boss.currentCast;
  if (!cast) return [];
  boss.currentCast = null;
  boss.state = 'field-boss';
  const events = [];
  if (cast.pattern === 'hwang-ranged') {
    const rangePx = Number(cast.rangePx) || Number(definition.rangedRangePx) || 0;
    const rangePercent = getRangePercent(rangePx, runtime.mapId);
    const decoyTargets = getActiveDecoys(runtime, now).filter((entry) => (
      entry.floor === boss.floor
      && Math.abs(Number(entry.x) - Number(boss.x)) <= rangePercent + 4.5
    ));
    const decoyTarget = pickRandom(decoyTargets);
    if (decoyTarget) {
      const damage = Math.max(1, Math.floor(Number(cast.damage || definition.rangedDamage) || 1));
      damageDecoy(runtime, decoyTarget, boss, damage, 'field-boss-ranged', now);
      boss.aggroTargetId = decoyTarget.player.userId;
      boss.aggroTargetType = 'decoy';
      runtime.fieldBossStatusEvents.push({
        type: 'ranged',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: decoyTarget.player.userId,
        targetSummon: true,
        summonName: decoyTarget.summon.name,
        damage,
        createdAt: now
      });
      return events;
    }
    const target = pickRandom(getFieldBossPlayersInRange(
      runtime,
      boss,
      rangePx,
      { requireVulnerable: true, now }
    ));
    const damageEvent = applyFixedFieldBossDamage(
      target,
      boss,
      Math.max(1, Math.floor(Number(cast.damage || definition.rangedDamage) || 1)),
      'field-boss-ranged',
      now
    );
    if (damageEvent) {
      events.push(damageEvent);
      runtime.fieldBossStatusEvents.push({
        type: 'ranged',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: target.userId,
        damage: damageEvent.damage,
        totalDamage: damageEvent.totalDamage,
        mpDamage: damageEvent.mpDamage,
        dodged: Boolean(damageEvent.dodged),
        createdAt: now
      });
    }
  } else if (cast.pattern === 'hwang-silence') {
    const targets = getLiveFieldBossPlayers(runtime)
      .filter((player) => player.floor === boss.floor)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    for (const target of targets) {
      target.silencedUntil = Math.max(
        Number(target.silencedUntil) || 0,
        now + Math.max(0, Number(cast.silenceDurationMs || definition.silenceDurationMs) || 0)
      );
      runtime.fieldBossStatusEvents.push({
        type: 'silence',
        pattern: cast.pattern,
        skillName: cast.skillName,
        bossId: boss.id,
        bossName: boss.name,
        targetUserId: target.userId,
        durationMs: cast.silenceDurationMs,
        expiresAt: target.silencedUntil,
        createdAt: now
      });
    }
  }
  return events;
}

function applyGammamNeoPatterns(runtime, boss, definition, now) {
  const events = [];
  const patterns = definition.patterns || {};
  if (boss.currentCast) {
    if (now >= Number(boss.currentCast.resolvesAt || 0)) {
      events.push(...resolveGammamNeoPattern(runtime, boss, now));
    }
    return events;
  }
  if (patterns.globalSilence && now >= Number(boss.nextGlobalSilenceAt || 0)) {
    if (startFieldBossPatternIfReady(
      runtime,
      boss,
      patterns.globalSilence.id,
      patterns.globalSilence,
      now,
      () => { boss.nextGlobalSilenceAt = now + patterns.globalSilence.intervalMs; }
    )) return events;
  }
  if (patterns.closeBlast && now >= Number(boss.nextCloseBlastAt || 0)) {
    if (startFieldBossPatternIfReady(
      runtime,
      boss,
      patterns.closeBlast.id,
      patterns.closeBlast,
      now,
      () => { boss.nextCloseBlastAt = now + patterns.closeBlast.intervalMs; }
    )) return events;
  }
  if (patterns.dispel && now >= Number(boss.nextDispelAt || 0)) {
    startFieldBossPatternIfReady(
      runtime,
      boss,
      patterns.dispel.id,
      patterns.dispel,
      now,
      () => {
        boss.nextDispelAt = now + randomIntegerBetween(
          patterns.dispel.minIntervalMs,
          patterns.dispel.maxIntervalMs
        );
      }
    );
  }
  return events;
}

function applyHwangFieldBossPatterns(runtime, boss, definition, now) {
  const events = [];
  if (boss.currentCast) {
    if (now >= Number(boss.currentCast.resolvesAt || 0)) {
      events.push(...resolveHwangFieldBossPattern(runtime, boss, definition, now));
    }
    return events;
  }

  if (now >= Number(boss.nextRangedAt || 0)) {
    startFieldBossPatternIfReady(
      runtime,
      boss,
      'hwang-ranged',
      {
        skillName: definition.rangedSkillName,
        castMs: definition.rangedCastMs,
        damage: definition.rangedDamage,
        rangePx: definition.rangedRangePx,
        allowDecoys: true
      },
      now,
      () => { boss.nextRangedAt = now + definition.rangedIntervalMs; }
    );
    if (boss.currentCast) return events;
  }

  if (now >= Number(boss.nextSilenceAt || 0)) {
    startFieldBossPatternIfReady(
      runtime,
      boss,
      'hwang-silence',
      {
        skillName: definition.silenceSkillName,
        castMs: definition.silenceCastMs,
        silenceDurationMs: definition.silenceDurationMs
      },
      now,
      () => { boss.nextSilenceAt = now + definition.silenceIntervalMs; }
    );
  }

  return events;
}

function pushRaidEvent(runtime, event) {
  if (!Array.isArray(runtime.raidEvents)) runtime.raidEvents = [];
  runtime.raidEvents.push({ id: crypto.randomUUID(), ...event });
  const cutoff = Date.now() - 12_000;
  runtime.raidEvents = runtime.raidEvents
    .filter((entry) => Number(entry.createdAt || 0) >= cutoff)
    .slice(-80);
}

function getLiveRaidPlayers(runtime) {
  return Array.from(runtime.players.values()).filter((player) => Number(player.currentHp) > 0);
}

function startBaldKimPattern(runtime, boss, pattern, config, now) {
  const cast = {
    pattern,
    skillName: config.skillName,
    startedAt: now,
    resolvesAt: now + config.castMs,
    durationMs: config.castMs
  };
  if (pattern === 'wig-rain') {
    cast.zoneWidthPx = config.zoneWidthPx;
    cast.zones = Array.from({ length: config.zoneCount }, () => ({
      x: randomBetween(3, 97),
      widthPx: config.zoneWidthPx
    }));
  }
  boss.currentCast = cast;
  boss.state = `casting-${pattern}`;
  pushRaidEvent(runtime, {
    type: 'cast',
    bossId: boss.raidBossId,
    bossName: boss.name,
    ...cast,
    createdAt: now
  });
}

function createBaldKimSummons(runtime, boss, definition, now) {
  const map = getWorldMap(runtime.mapId);
  const platform = getMapLayout(map).platforms.find((entry) => entry.id === 'kim-arena')
    || getMapLayout(map).platforms[0];
  const pool = MONSTER_CATALOG.filter((species) => species.level >= 100 && species.level <= 109);
  if (!pool.length) return [];
  const spawned = [];
  for (const side of ['left', 'right']) {
    const count = randomIntegerBetween(
      definition.patterns.summonStaff.minimumPerSide,
      definition.patterns.summonStaff.maximumPerSide
    );
    for (let index = 0; index < count; index += 1) {
      const species = pickRandom(pool);
      const monster = createMonster(map, runtime.spawnSequence++, now, platform, species);
      monster.x = side === 'left'
        ? randomBetween(3, 13)
        : randomBetween(87, 97);
      monster.summonedByRaidBoss = boss.id;
      runtime.monsters.push(monster);
      spawned.push(serializeMonster(monster));
    }
  }
  return spawned;
}

function resolveBaldKimPattern(runtime, boss, definition, now) {
  const cast = boss.currentCast;
  if (!cast) return [];
  boss.currentCast = null;
  boss.state = 'raid-boss';
  const damageEvents = [];
  const players = getLiveRaidPlayers(runtime);
  if (cast.pattern === 'wig-rain') {
    const zoneHalfWidth = Number(cast.zoneWidthPx || 300) / getWorldWidth(runtime.mapId) * 50;
    for (const player of players) {
      const hit = (cast.zones || []).some((zone) => (
        Math.abs(Number(player.x) - Number(zone.x)) <= zoneHalfWidth
      ));
      if (!hit) continue;
      const damageEvent = applyFixedFieldBossDamage(
        player,
        boss,
        definition.patterns.wigRain.damage,
        'raid-wig-rain',
        now
      );
      if (damageEvent) damageEvents.push(damageEvent);
      if (damageEvent && !damageEvent.dodged) {
        player.stunnedUntil = Math.max(
          Number(player.stunnedUntil || 0),
          now + definition.patterns.wigRain.stunMs
        );
        player.raidStunnedUntil = player.stunnedUntil;
      }
    }
  } else if (cast.pattern === 'resource-crash') {
    for (const player of players) {
      const damageEvent = applyRaidResourceCrash(player, boss, now);
      if (damageEvent) damageEvents.push(damageEvent);
    }
  } else if (cast.pattern === 'summon-staff') {
    const summoned = createBaldKimSummons(runtime, boss, definition, now);
    pushRaidEvent(runtime, {
      type: 'summon',
      pattern: cast.pattern,
      bossId: boss.raidBossId,
      bossName: boss.name,
      summoned,
      createdAt: now
    });
  } else if (cast.pattern === 'physical-ignore') {
    boss.physicalImmuneUntil = now + definition.patterns.physicalIgnore.durationMs;
    pushRaidEvent(runtime, {
      type: 'boss-buff',
      pattern: cast.pattern,
      bossId: boss.raidBossId,
      bossName: boss.name,
      name: '물리 공격 무시',
      icon: '🛡️',
      expiresAt: boss.physicalImmuneUntil,
      createdAt: now
    });
  } else if (cast.pattern === 'oil-silence') {
    for (const player of players) {
      const damageEvent = applyFixedFieldBossDamage(
        player,
        boss,
        definition.patterns.oilSilence.damage,
        'raid-oil-silence',
        now
      );
      if (damageEvent) damageEvents.push(damageEvent);
      player.silencedUntil = Math.max(
        Number(player.silencedUntil || 0),
        now + definition.patterns.oilSilence.silenceMs
      );
    }
  }
  pushRaidEvent(runtime, {
    type: 'resolve',
    pattern: cast.pattern,
    skillName: cast.skillName,
    bossId: boss.raidBossId,
    bossName: boss.name,
    createdAt: now
  });
  return damageEvents;
}

function applyBaldKimRaidPatterns(runtime, boss, now) {
  const definition = getRaidBossDefinition(boss.raidBossId);
  if (!definition || runtime.raidState?.completed) return [];
  if (boss.currentCast) {
    return now >= Number(boss.currentCast.resolvesAt || 0)
      ? resolveBaldKimPattern(runtime, boss, definition, now)
      : [];
  }
  if (now < Number(boss.nextPatternAt || 0)) return [];
  const phase = definition.phases.find((entry) => entry.phase === boss.phase) || definition.phases[0];
  let selected = null;
  if (
    Number(boss.physicalImmuneUntil || 0) <= now
    && Math.random() < definition.patterns.physicalIgnore.chance
  ) {
    selected = definition.patterns.physicalIgnore;
  } else {
    selected = pickRandom([
      definition.patterns.wigRain,
      definition.patterns.resourceCrash,
      definition.patterns.summonStaff,
      definition.patterns.oilSilence
    ]);
  }
  boss.nextPatternAt = now + phase.intervalMs;
  startBaldKimPattern(runtime, boss, selected.id, selected, now);
  return [];
}

function applyFieldBossMechanics(runtime, now) {
  const events = [];
  for (const boss of runtime.monsters) {
    if (!boss.fieldBoss || boss.hp <= 0) continue;
    if (boss.raidBoss) {
      events.push(...applyBaldKimRaidPatterns(runtime, boss, now));
      continue;
    }
    const definition = getFieldBossDefinition(boss.fieldBossId);
    if (!definition) continue;
    if (definition.patterns) {
      events.push(...applyGammamNeoPatterns(runtime, boss, definition, now));
      continue;
    }
    events.push(...applyHwangFieldBossPatterns(runtime, boss, definition, now));
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

function queueRaidContactEvents(runtime, events) {
  if (!(runtime?.raidContactEventsByUser instanceof Map)) {
    runtime.raidContactEventsByUser = new Map();
  }
  for (const event of events || []) {
    const userId = String(event?.userId || '');
    if (!userId) continue;
    const queue = runtime.raidContactEventsByUser.get(userId) || [];
    queue.push(event);
    if (queue.length > RAID_CONTACT_EVENT_QUEUE_LIMIT) {
      queue.splice(0, queue.length - RAID_CONTACT_EVENT_QUEUE_LIMIT);
    }
    runtime.raidContactEventsByUser.set(userId, queue);
  }
}

function takeRaidContactEvents(runtime, userId) {
  const userKey = String(userId || '');
  const queue = runtime?.raidContactEventsByUser?.get(userKey) || [];
  runtime?.raidContactEventsByUser?.delete(userKey);
  return queue;
}

function tickRaidMapSimulation(mapId, now = Date.now()) {
  const resolvedMapId = String(mapId || '');
  const runtime = activeMaps.get(resolvedMapId);
  if (!runtime || !getWorldMap(resolvedMapId)?.raidBossId) return null;
  const contactEvents = tickRuntime(runtime, now);
  queueRaidContactEvents(runtime, contactEvents);
  return {
    mapId: resolvedMapId,
    contactEventCount: contactEvents.length,
    completed: Boolean(runtime.raidState?.completed)
  };
}

function stopRaidMapSimulation(mapId) {
  const resolvedMapId = String(mapId || '');
  const state = raidMapSimulationTimers.get(resolvedMapId);
  if (!state) return false;
  clearInterval(state.timer);
  raidMapSimulationTimers.delete(resolvedMapId);
  return true;
}

function startRaidMapSimulation(mapId, now = Date.now()) {
  const resolvedMapId = String(mapId || '');
  const map = getWorldMap(resolvedMapId);
  if (!map?.raidBossId) return false;
  if (!activeMaps.has(resolvedMapId)) {
    activeMaps.set(resolvedMapId, createMapRuntime(resolvedMapId, now));
  }
  if (raidMapSimulationTimers.has(resolvedMapId)) return true;

  const state = { idleSince: 0, lastCleanupAt: now, timer: null };
  state.timer = setInterval(() => {
    const tickNow = Date.now();
    if (tickNow - state.lastCleanupAt >= 5_000) {
      cleanupInactiveMaps(tickNow);
      state.lastCleanupAt = tickNow;
    }
    const result = tickRaidMapSimulation(resolvedMapId, tickNow);
    const runtime = activeMaps.get(resolvedMapId);
    if (!result || result.completed) {
      stopRaidMapSimulation(resolvedMapId);
      return;
    }
    if (runtime?.players.size) {
      state.idleSince = 0;
      return;
    }
    if (!state.idleSince) state.idleSince = tickNow;
    if (tickNow - state.idleSince >= 30_000) stopRaidMapSimulation(resolvedMapId);
  }, RAID_MAP_TICK_INTERVAL_MS);
  state.timer.unref?.();
  raidMapSimulationTimers.set(resolvedMapId, state);
  return true;
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
  worldControllers.set(key, { clientId: sessionId, claimedAt: now, lastSeenAt: now });
  removePlayerFromOtherMaps(key, '');
  return { clientId: sessionId, claimedAt: now };
}

function hasWorldControl(userId, clientId) {
  const owner = worldControllers.get(String(userId));
  const matches = Boolean(owner && owner.clientId === String(clientId || ''));
  if (matches) owner.lastSeenAt = Date.now();
  return matches;
}

function hasRecentWorldControl(userId, now = Date.now()) {
  const owner = worldControllers.get(String(userId));
  if (!owner) return false;
  const lastSeenAt = Number(owner.lastSeenAt ?? owner.claimedAt) || 0;
  return Math.max(0, Number(now) || 0) - lastSeenAt <= WORLD_CONTROL_ACTIVE_MS;
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
  summon,
  decoySummon,
  currentHp,
  maxHp,
  currentMp,
  maxMp,
  playerLevel,
  jobName,
  playerStats,
  physicalDefense,
  magicDefense,
  archetype,
  damageReductionPercent,
  damageTakenIncreasePercent,
  knockbackReductionPercent,
  chainChance,
  chainDamagePercent,
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
  simulationMode = 'heartbeat',
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
  const movementLocked = Number(previous?.stunnedUntil || 0) > now;
  const resolvedX = movementLocked ? Number(previous.x) : clamp(x, 0, 94);
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
  const resolvedFloor = movementLocked
    ? normalizeMapFloor(map, previous?.floor)
    : normalizeMapFloor(map, floor);
  const resolvedSummon = normalizeWorldSummon(
    summon,
    previous?.summon,
    {
      x: resolvedX,
      floor: resolvedFloor,
      facingLeft: Boolean(facingLeft)
    },
    now
  );
  const resolvedDecoySummon = normalizeWorldSummon(
    decoySummon,
    previous?.decoySummon,
    {
      x: resolvedX,
      floor: resolvedFloor,
      facingLeft: !Boolean(facingLeft)
    },
    now
  );
  const recovery = buildPassiveRecoverySchedule({
    previous,
    activity: resolvedActivity,
    currentHp: resolvedHp,
    deadAt: resolvedHp <= 0 ? Number(previous?.deadAt || now) : 0,
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
    x: resolvedX,
    floor: resolvedFloor,
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
    summon: resolvedSummon,
    decoySummon: resolvedDecoySummon,
    lastContactAt: previous?.lastContactAt || 0,
    invulnerableUntil: previous?.invulnerableUntil || 0,
    silencedUntil: previous?.silencedUntil || 0,
    stunnedUntil: previous?.stunnedUntil || 0,
    raidStunnedUntil: previous?.raidStunnedUntil || 0,
    collisionOriginX: previous?.x ?? clamp(x, 0, 94),
    collisionOriginFloor: previous?.floor ?? resolvedFloor,
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
      jobName: String(jobName || previous?.combatProfile?.jobName || '초보 사원'),
      damageReductionPercent: Math.max(
        0,
        Number(damageReductionPercent ?? previous?.combatProfile?.damageReductionPercent) || 0
      ),
      damageTakenIncreasePercent: Math.max(
        0,
        Number(
          damageTakenIncreasePercent
          ?? previous?.combatProfile?.damageTakenIncreasePercent
        ) || 0
      ),
      knockbackReductionPercent: Math.max(
        0,
        Math.min(
          95,
          Number(
            knockbackReductionPercent
            ?? previous?.combatProfile?.knockbackReductionPercent
          ) || 0
        )
      ),
      chainChance: Math.max(
        0,
        Math.min(100, Number(chainChance ?? previous?.combatProfile?.chainChance) || 0)
      ),
      chainDamagePercent: Math.max(
        0,
        Number(chainDamagePercent ?? previous?.combatProfile?.chainDamagePercent) || 0
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
  playerMapIndex.set(userKey, mapId);
  const usesMapTimer = simulationMode === 'map-timer' && Boolean(map.raidBossId);
  const contactEvents = usesMapTimer
    ? takeRaidContactEvents(runtime, userKey)
    : tickRuntime(runtime, now);
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
    fieldBossStatusEvents: runtime.fieldBossStatusEvents.splice(0),
    summonEvents: runtime.summonEvents.splice(0),
    raidBossRewards: runtime.raidBossRewards.splice(0),
    raidState: runtime.raidState ? {
      bossId: runtime.raidState.bossId,
      spawnAt: runtime.raidState.spawnAt,
      countdownRemainingMs: runtime.raidState.spawned
        ? 0
        : Math.max(0, Number(runtime.raidState.spawnAt || 0) - now),
      spawned: Boolean(runtime.raidState.spawned),
      completed: Boolean(runtime.raidState.completed),
      completedAt: Number(runtime.raidState.completedAt || 0)
    } : null,
    raidEvents: (runtime.raidEvents || []).filter((event) => now - Number(event.createdAt || 0) <= 8_000),
    globalShout: getGlobalShout(now)
  };
}

function applyHeavyHitKnockback(monster, player, damage, mapOrId = '') {
  if (!monster || !player || monster.hp <= 0) return false;
  if (monster.raidBoss) return false;
  if (Number(damage) < Number(monster.maxHp) * 0.4) return false;
  const direction = monster.x >= player.x ? 1 : -1;
  const bounds = getPlatformBounds(getMonsterPlatform(mapOrId, monster));
  monster.x = clamp(
    monster.x + direction * 4.2 * ASSUMED_STAGE_WIDTH_PX / getWorldWidth(mapOrId),
    bounds.minimum,
    bounds.maximum
  );
  monster.state = 'knockback';
  monster.decisionAt = Date.now() + 420;
  return true;
}

function selectFrontMonster(
  runtime,
  player,
  requestedMonster,
  rangePercent,
  verticalFloorRange = 0,
  verticalRangePx = 0
) {
  if (!requestedMonster) return null;
  const requestedOffset = requestedMonster.x - player.x;
  const direction = requestedOffset === 0
    ? (player.facingLeft ? -1 : 1)
    : Math.sign(requestedOffset);
  const requestedDistance = Math.abs(requestedOffset);
  return runtime.monsters
    .filter((monster) => {
      if (
        monster.hp <= 0
        || !isWithinVerticalAttackRange(
          runtime.mapId,
          player,
          monster,
          verticalFloorRange,
          verticalRangePx
        )
      ) return false;
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
    || monster.raidBoss
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

function splitResolvedDamage(totalDamage, hitIndex, hitCount) {
  const safeDamage = Math.max(0, Math.floor(Number(totalDamage) || 0));
  const safeHitCount = Math.max(1, Math.floor(Number(hitCount) || 1));
  const baseDamage = Math.floor(safeDamage / safeHitCount);
  return baseDamage + (Number(hitIndex) < safeDamage % safeHitCount ? 1 : 0);
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
  const worldWidth = getWorldWidth(mapId);
  const rangePercent = Math.max(1, Number(rangePx) || 22) / worldWidth * 100;
  if (Math.abs(player.x - requestedMonster.x) > rangePercent + 4.5) {
    return { success: false, reason: 'out-of-range' };
  }
  const monster = piercing
    ? requestedMonster
    : selectFrontMonster(runtime, player, requestedMonster, rangePercent);
  if (!monster) return { success: false, reason: 'missing-target' };
  player.combatProfile.stealth = 0;
  const requiredAccuracy = getRequiredAccuracyForMonster(monster, playerLevel);
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
  const distancePx = Math.abs(player.x - monster.x) / 100 * worldWidth;
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
  const wasBelowExecuteThreshold = monster.hp / Math.max(1, monster.maxHp) * 100
    <= Number(executeThresholdPercent || 0);
  const executed = closeRangeTriggered
    && wasBelowExecuteThreshold
    && Number(executeChance) > 0
    && Math.random() * 100 < Number(executeChance);
  const totalDamage = applyRaidBossDamageRule(
    monster,
    executed ? EXECUTE_FIXED_DAMAGE : finalDamage,
    damageType,
    now
  );
  const displayDamage = totalDamage;
  recordMonsterContribution(monster, userKey, totalDamage);
  monster.hp = Math.max(0, monster.hp - totalDamage);
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
    !monster.raidBoss
    && activeElements.includes('ice')
    && elementMultiplier >= 1
    && Number(freezeSeconds) > 0
  ) {
    monster.stunnedUntil = now + Number(freezeSeconds) * 1000;
    monster.frozenUntil = monster.stunnedUntil;
    monster.state = 'stunned';
  } else {
    monster.state = 'chase';
  }
  const knockedBack = applyHeavyHitKnockback(monster, player, totalDamage, mapId);
  let defeated = monster.hp <= 0;
  let raidPhaseChanged = false;
  if (defeated && monster.raidBoss) {
    const transition = resolveRaidBossPhase(runtime, monster, userKey, now);
    defeated = transition.defeated;
    raidPhaseChanged = transition.phaseChanged;
  }
  let drops = [];
  let fieldBossReward = null;
  if (defeated) {
    monster.state = 'defeated';
    monster.aggroTargetId = '';
    if (monster.fieldBoss && !monster.raidBoss) {
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
  const primaryOutcome = {
    monsterId: monster.id,
    speciesId: monster.speciesId,
    damage: totalDamage,
    displayDamage,
    executeDamage: executed ? EXECUTE_FIXED_DAMAGE : 0,
    missed: false,
    hitChance,
    knockedBack,
    defeated,
    raidPhaseChanged,
    monsterLevel: monster.level,
    expReward: defeated && !fieldBossReward ? monster.expReward : 0,
    mpAbsorbed,
    monster: defeated ? null : serializeMonster(monster)
  };
  primaryOutcome.raidPhaseChanged = raidPhaseChanged;
  const chained = applyAugmentChainAttack({
    runtime,
    player,
    sourceMonster: monster,
    userId: userKey,
    sourceDamage: finalDamage,
    mapId,
    now
  });
  if (chained) drops.push(...chained.drops);
  const outcomes = chained ? [primaryOutcome, chained.outcome] : [primaryOutcome];
  return {
    success: true,
    targetId: monster.id,
    speciesId: monster.speciesId,
    damage: totalDamage,
    displayDamage,
    executeDamage: executed ? EXECUTE_FIXED_DAMAGE : 0,
    closeRangeTriggered,
    executed,
    poisoned,
    element: activeElements.join('+') || 'neutral',
    elementMultiplier,
    hitChance,
    knockedBack,
    defeated,
    monsterLevel: monster.level,
    expReward: outcomes.reduce((sum, outcome) => sum + Number(outcome.expReward || 0), 0),
    fieldBossReward,
    raidPhaseChanged,
    mpAbsorbed,
    drops: drops.map(serializeLoot),
    outcomes,
    chainOutcome: chained?.outcome || null,
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

function applyAugmentChainAttack({
  runtime,
  player,
  sourceMonster,
  userId,
  sourceDamage,
  mapId,
  now = Date.now()
} = {}) {
  const chance = Math.max(0, Math.min(100, Number(player?.combatProfile?.chainChance) || 0));
  const damagePercent = Math.max(0, Number(player?.combatProfile?.chainDamagePercent) || 0);
  if (
    !runtime
    || !player
    || !sourceMonster
    || chance <= 0
    || damagePercent <= 0
    || Math.random() * 100 >= chance
  ) return null;
  const sourceOffset = Number(sourceMonster.x) - Number(player.x);
  const direction = sourceOffset === 0 ? (player.facingLeft ? -1 : 1) : Math.sign(sourceOffset);
  const nextMonster = runtime.monsters
    .filter((monster) => {
      if (
        monster.id === sourceMonster.id
        || monster.hp <= 0
        || monster.fieldBoss
        || Number(monster.floor) !== Number(sourceMonster.floor)
      ) return false;
      const behindDistance = (Number(monster.x) - Number(sourceMonster.x)) * direction;
      return behindDistance > 0.05 && behindDistance <= 42;
    })
    .sort((left, right) => (
      Math.abs(Number(left.x) - Number(sourceMonster.x))
      - Math.abs(Number(right.x) - Number(sourceMonster.x))
    ))[0];
  if (!nextMonster) return null;

  const damage = Math.max(1, Math.floor(
    Math.max(1, Number(sourceDamage) || 1) * damagePercent / 100
  ));
  recordMonsterContribution(nextMonster, userId, damage);
  nextMonster.hp = Math.max(0, Number(nextMonster.hp) - damage);
  nextMonster.aggroTargetId = String(userId);
  nextMonster.state = nextMonster.hp > 0 ? 'chase' : 'defeated';
  const knockedBack = nextMonster.hp > 0
    ? applyHeavyHitKnockback(nextMonster, player, damage, runtime.mapId)
    : false;
  const defeated = nextMonster.hp <= 0;
  const drops = defeated
    ? queueMonsterDrops(runtime, nextMonster, userId, now)
    : [];
  return {
    outcome: {
      monsterId: nextMonster.id,
      speciesId: nextMonster.speciesId,
      damage,
      missed: false,
      hitChance: 1,
      knockedBack,
      defeated,
      monsterLevel: nextMonster.level,
      expReward: defeated ? nextMonster.expReward : 0,
      mpAbsorbed: 0,
      chained: true,
      chainDamagePercent: damagePercent,
      hitResults: [{
        monsterId: nextMonster.id,
        hitIndex: 0,
        damage,
        critical: false,
        missed: false,
        remainingHp: nextMonster.hp,
        maxHp: nextMonster.maxHp,
        defeated,
        chained: true
      }],
      targetX: Number(nextMonster.x),
      targetFloor: Number(nextMonster.floor) || 0,
      monster: defeated ? null : serializeMonster(nextMonster)
    },
    drops
  };
}

function useSkillOnMonsters(options = {}) {
  const {
  userId,
  mapId,
  targetId,
  baseDamage,
  damageRange = null,
  skillPercent = 100,
  rangePx = 100,
  maxTargets = 1,
  hits = 1,
  splitDamageAcrossHits = false,
  bonusAttackPercent = 0,
  bonusAttacks = [],
  damageType = 'physical',
  element = 'neutral',
  elements = [],
  ignoreDefense = false,
  accuracy = null,
  playerLevel = 1,
  stunChance = 0,
  stunSeconds = 0,
  freezeSeconds = 0,
  moveCasterToTarget = false,
  pull = false,
  dealDamage = true,
  leaveAtOneHp = false,
  outgoingDamageReductionPercent = 0,
  debuffChance = 100,
  debuffDurationSeconds = 0,
  piercing = false,
  progressivePiercing = false,
  progressiveStartPercent = 0,
  progressiveEndPercent = 0,
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
  undeadOnly = false,
  excludeFieldBoss = false,
  verticalFloorRange = 0,
  verticalRangePx = 0,
  criticalChance = 0,
  criticalDamagePercent = 200,
  rollCriticalPerHit = false,
  retargetEachHit = false,
  casterX = null,
  casterFloor = null,
  casterFacingLeft = null,
  now = Date.now()
  } = options;
  cleanupInactiveMaps(now);
  const userKey = String(userId);
  const runtime = activeMaps.get(mapId);
  if (!runtime) return { success: false, reason: 'inactive-map' };
  tickRuntime(runtime, now);
  const player = runtime.players.get(userKey);
  if (!player) return { success: false, reason: 'missing-player' };
  if (player.currentHp <= 0) return { success: false, reason: 'dead' };
  if (casterX !== null && casterX !== undefined && Number.isFinite(Number(casterX))) {
    player.x = clamp(Number(casterX), 2, 92);
  }
  if (casterFloor !== null && casterFloor !== undefined && Number.isFinite(Number(casterFloor))) {
    player.floor = normalizeMapFloor(mapId, casterFloor);
  }
  if (typeof casterFacingLeft === 'boolean') player.facingLeft = casterFacingLeft;
  const worldWidth = getWorldWidth(mapId);
  const rangePercent = Math.max(1, Number(rangePx) || 100) / worldWidth * 100;
  const inRange = runtime.monsters
    .filter((monster) => (
      monster.hp > 0
      && (!undeadOnly || monster.undead)
      && (!excludeFieldBoss || !monster.fieldBoss)
      && isWithinVerticalAttackRange(
        mapId,
        player,
        monster,
        verticalFloorRange,
        verticalRangePx
      )
      && Math.abs(monster.x - player.x) <= rangePercent + 4.5
    ));
  const requestedMonster = inRange.find((monster) => monster.id === targetId);
  const targetLimit = Math.max(1, Math.floor(Number(maxTargets) || 1));
  let candidates;
  if (progressivePiercing) {
    const nearestMonster = [...inRange].sort((left, right) => (
      Math.abs(Number(left.x) - Number(player.x))
      - Math.abs(Number(right.x) - Number(player.x))
    ))[0];
    const directionalTarget = requestedMonster || nearestMonster;
    const requestedOffset = directionalTarget
      ? Number(directionalTarget.x) - Number(player.x)
      : 0;
    const firingDirection = requestedOffset === 0
      ? (player.facingLeft ? -1 : 1)
      : Math.sign(requestedOffset);
    player.facingLeft = firingDirection < 0;
    candidates = inRange
      .filter((monster) => {
        const offset = Number(monster.x) - Number(player.x);
        return offset === 0 || Math.sign(offset) === firingDirection;
      })
      .sort((left, right) => (
        Math.abs(Number(left.x) - Number(player.x))
        - Math.abs(Number(right.x) - Number(player.x))
      ))
      .slice(0, targetLimit);
  } else {
    candidates = targetLimit === 1 && requestedMonster && !piercing
      ? [selectFrontMonster(
        runtime,
        player,
        requestedMonster,
        rangePercent,
        verticalFloorRange,
        verticalRangePx
      )].filter(Boolean)
      : inRange.sort((left, right) => {
        if (left.id === targetId) return -1;
        if (right.id === targetId) return 1;
        return Math.abs(left.x - player.x) - Math.abs(right.x - player.x);
      })
        .slice(0, targetLimit);
  }
  if (!candidates.length) return { success: false, reason: 'out-of-range' };
  if (dealDamage) player.combatProfile.stealth = 0;

  let casterMovement = null;
  if (moveCasterToTarget && candidates[0]) {
    const target = candidates[0];
    const direction = Number(target.x) >= Number(player.x) ? 1 : -1;
    const targetBounds = getPlatformBounds(getMonsterPlatform(mapId, target));
    player.x = clamp(
      Number(target.x) - direction * 2.8 * ASSUMED_STAGE_WIDTH_PX / worldWidth,
      targetBounds.minimum,
      targetBounds.maximum
    );
    player.floor = normalizeMapFloor(mapId, target.floor);
    player.facingLeft = direction < 0;
    player.activity = 'combat';
    player.motion = 'dash';
    casterMovement = {
      x: player.x,
      floor: player.floor,
      facingLeft: player.facingLeft,
      targetId: target.id
    };
  }

  const outcomes = [];
  const drops = [];
  const fieldBossRewards = [];
  const hitCount = Math.max(1, Math.floor(Number(hits) || 1));
  const normalizedBonusAttacks = [
    ...(Array.isArray(bonusAttacks) ? bonusAttacks : []),
    Number(bonusAttackPercent) > 0
      ? {
        percent: Number(bonusAttackPercent),
        source: 'double-strike',
        repeatEffects: false
      }
      : null
  ].filter((attack) => Number(attack?.percent) > 0).map((attack) => ({
    percent: Math.max(0, Number(attack.percent) || 0),
    source: String(attack.source || 'bonus-attack'),
    repeatEffects: Boolean(attack.repeatEffects)
  }));
  const activeElements = [...new Set(
    (Array.isArray(elements) && elements.length ? elements : [element]).filter(Boolean)
  )];
  if (retargetEachHit && targetLimit === 1 && hitCount > 1) {
    const initialTarget = candidates[0];
    const initialOffset = Number(initialTarget.x) - Number(player.x);
    let firingDirection = initialOffset === 0
      ? (player.facingLeft ? -1 : 1)
      : Math.sign(initialOffset);
    const retargetedOutcomes = [];
    const retargetedDrops = [];
    const retargetedFieldBossRewards = [];
    let resolvedShots = 0;

    for (let projectileIndex = 0; projectileIndex < hitCount; projectileIndex += 1) {
      const eligibleTargets = runtime.monsters
        .filter((monster) => {
          if (
            monster.hp <= 0
            || (undeadOnly && !monster.undead)
            || (excludeFieldBoss && monster.fieldBoss)
            || !isWithinVerticalAttackRange(
              mapId,
              player,
              monster,
              verticalFloorRange,
              verticalRangePx
            )
            || Math.abs(Number(monster.x) - Number(player.x)) > rangePercent + 4.5
          ) return false;
          return true;
        })
        .sort((left, right) => (
          Math.abs(Number(left.x) - Number(player.x))
          - Math.abs(Number(right.x) - Number(player.x))
        ));
      let nextTarget = eligibleTargets.find((monster) => {
        const offset = Number(monster.x) - Number(player.x);
        return offset === 0 || Math.sign(offset) === firingDirection;
      });
      if (!nextTarget && eligibleTargets.length) {
        firingDirection *= -1;
        player.facingLeft = firingDirection < 0;
        nextTarget = eligibleTargets.find((monster) => {
          const offset = Number(monster.x) - Number(player.x);
          return offset === 0 || Math.sign(offset) === firingDirection;
        });
      }
      if (!nextTarget) break;

      const shot = useSkillOnMonsters({
        ...options,
        targetId: nextTarget.id,
        maxTargets: 1,
        hits: 1,
        retargetEachHit: false,
        now
      });
      if (!shot.success) break;
      resolvedShots += 1;
      for (const outcome of shot.outcomes || []) {
        retargetedOutcomes.push({
          ...outcome,
          hitResults: (outcome.hitResults || []).map((hit, subHitIndex) => ({
            ...hit,
            hitIndex: projectileIndex,
            projectileIndex,
            subHitIndex,
            facingLeft: firingDirection < 0
          }))
        });
      }
      retargetedDrops.push(...(shot.drops || []));
      retargetedFieldBossRewards.push(...(shot.fieldBossRewards || []));
    }

    if (!resolvedShots) return { success: false, reason: 'out-of-range' };
    return {
      success: true,
      outcomes: retargetedOutcomes,
      drops: retargetedDrops,
      expReward: retargetedOutcomes.reduce(
        (sum, outcome) => sum + Number(outcome.expReward || 0),
        0
      ),
      mpAbsorbed: retargetedOutcomes.reduce(
        (sum, outcome) => sum + Number(outcome.mpAbsorbed || 0),
        0
      ),
      fieldBossRewards: retargetedFieldBossRewards,
      facingLeft: player.facingLeft
    };
  }
  for (const [targetIndex, monster] of candidates.entries()) {
    const piercingDamagePercent = progressivePiercing
      ? Math.round(
        Math.max(0, Number(progressiveStartPercent) || Number(skillPercent) || 100)
        + (
          Math.max(0, Number(progressiveEndPercent) || Number(skillPercent) || 100)
          - Math.max(0, Number(progressiveStartPercent) || Number(skillPercent) || 100)
        ) * targetIndex / Math.max(1, targetLimit - 1)
      )
      : Number(skillPercent) || 100;
    const targetDamageRange = progressivePiercing && damageRange
      ? scaleDamageRange(
        damageRange,
        piercingDamagePercent
          / Math.max(1, Number(progressiveStartPercent) || Number(skillPercent) || 100)
      )
      : damageRange;
    const targetX = Number(monster.x);
    const targetFloor = Number(monster.floor) || 0;
    const requiredAccuracy = getRequiredAccuracyForMonster(monster, playerLevel);
    const hitChance = accuracy == null
      ? 1
      : calculateHitChance({ accuracy, requiredAccuracy });
    if (Math.random() > hitChance) {
      monster.aggroTargetId = userKey;
      monster.state = 'chase';
      const missedHits = [
        null,
        ...normalizedBonusAttacks
      ].flatMap((bonusAttack, attackPassIndex) => (
        Array.from({ length: hitCount }, (_, passHitIndex) => ({
          monsterId: monster.id,
          hitIndex: attackPassIndex * hitCount + passHitIndex,
          damage: 0,
          critical: false,
          missed: true,
          remainingHp: monster.hp,
          maxHp: monster.maxHp,
          defeated: false,
          bonusAttack: Boolean(bonusAttack),
          bonusAttackSource: bonusAttack?.source,
          followUpAttack: bonusAttack?.source === 'follow-up-summon',
          piercingIndex: progressivePiercing ? targetIndex : undefined,
          piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined
        }))
      ));
      outcomes.push({
        monsterId: monster.id,
        damage: 0,
        missed: true,
        hitChance,
        knockedBack: false,
        defeated: false,
        expReward: 0,
        hitResults: missedHits,
        targetX,
        targetFloor,
        piercingIndex: progressivePiercing ? targetIndex : undefined,
        piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined,
        monster: serializeMonster(monster)
      });
      continue;
    }
    let totalDamage = 0;
    const hitResults = [];
    const distancePx = Math.abs(Number(player.x) - Number(monster.x)) / 100 * worldWidth;
    const closeRangeTriggered = distancePx <= 100
      && Number(closeRangeChance) > 0
      && Math.random() * 100 < Number(closeRangeChance);
    const closeRangeMultiplier = closeRangeTriggered
      ? Math.max(0, Number(closeRangeDamagePercent) || 100) / 100
      : 1;
    const wasBelowExecuteThreshold = monster.hp / Math.max(1, monster.maxHp) * 100
      <= Number(executeThresholdPercent || 0);
    const executed = dealDamage
      && !leaveAtOneHp
      && closeRangeTriggered
      && wasBelowExecuteThreshold
      && Number(executeChance) > 0
      && Math.random() * 100 < Number(executeChance);
    if (executed) {
      const executeDamage = applyRaidBossDamageRule(monster, EXECUTE_FIXED_DAMAGE, damageType, now);
      recordMonsterContribution(monster, userKey, executeDamage);
      monster.hp = Math.max(0, monster.hp - executeDamage);
      totalDamage = executeDamage;
      hitResults.push({
        monsterId: monster.id,
        hitIndex: 0,
        damage: executeDamage,
        displayDamage: executeDamage,
        executeDamage,
        critical: false,
        missed: false,
        remainingHp: monster.hp,
        maxHp: monster.maxHp,
        defeated: monster.hp <= 0,
        closeRangeTriggered,
        executed: true,
        piercingIndex: progressivePiercing ? targetIndex : undefined,
        piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined
      });
    }
    for (let hit = 0; !executed && dealDamage && hit < hitCount && monster.hp > 0; hit += 1) {
      const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
      const multiplier = Math.max(
        ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
      );
      const critical = rollCriticalPerHit
        && Math.random() * 100 < Math.max(0, Number(criticalChance) || 0);
      const criticalMultiplier = critical
        ? Math.max(1, Number(criticalDamagePercent) || 200) / 100
        : 1;
      const resolvedDamage = resolveOutgoingDamage({
        damage: Number(baseDamage) * (damageRange ? closeRangeMultiplier : criticalMultiplier * closeRangeMultiplier),
        damageRange: targetDamageRange
          ? scaleDamageRange(targetDamageRange, criticalMultiplier * closeRangeMultiplier)
          : null,
        damageType,
        skillPercent: piercingDamagePercent,
        defense,
        ignoreDefense,
        playerLevel,
        monsterLevel: monster.level,
        elementMultiplier: multiplier
      });
      const damageBeforeRaidRule = splitDamageAcrossHits && hitCount > 1
        ? splitResolvedDamage(resolvedDamage, hit, hitCount)
        : resolvedDamage;
      const damage = applyRaidBossDamageRule(monster, damageBeforeRaidRule, damageType, now);
      recordMonsterContribution(monster, userKey, damage);
      monster.hp = Math.max(leaveAtOneHp ? 1 : 0, monster.hp - damage);
      totalDamage += damage;
      hitResults.push({
        monsterId: monster.id,
        hitIndex: hit,
        damage,
        critical,
        missed: false,
        remainingHp: monster.hp,
        maxHp: monster.maxHp,
        defeated: monster.hp <= 0,
        closeRangeTriggered,
        piercingIndex: progressivePiercing ? targetIndex : undefined,
        piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined
      });
    }
    let mpAbsorbed = damageType === 'magic' && totalDamage > 0
      ? absorbMonsterMp(monster, mpAbsorbChance, mpAbsorbPercent)
      : 0;
    let poisonApplications = totalDamage > 0 && monster.hp > 0 && applyPoisonPassive(monster, {
      userId: userKey,
      chance: poisonChance,
      attack: poisonAttack,
      durationSeconds: poisonDurationSeconds,
      maxStacks: poisonMaxStacks,
      now
    }) ? 1 : 0;
    let repeatedEffectPasses = 0;
    for (const [bonusAttackIndex, bonusAttack] of normalizedBonusAttacks.entries()) {
      let bonusPassDamage = 0;
      for (let hit = 0; !executed && dealDamage && hit < hitCount && monster.hp > 0; hit += 1) {
        const defense = damageType === 'magic' ? monster.magicDefense : monster.physicalDefense;
        const multiplier = Math.max(
          ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
        );
        const critical = rollCriticalPerHit
          && Math.random() * 100 < Math.max(0, Number(criticalChance) || 0);
        const criticalMultiplier = critical
          ? Math.max(1, Number(criticalDamagePercent) || 200) / 100
          : 1;
        const resolvedDamage = resolveOutgoingDamage({
          damage: Number(baseDamage) * criticalMultiplier * closeRangeMultiplier,
          damageRange: targetDamageRange
            ? scaleDamageRange(
              targetDamageRange,
              Number(bonusAttack.percent) / 100 * criticalMultiplier * closeRangeMultiplier
            )
            : null,
          damageType,
          skillPercent: targetDamageRange
            ? 100
            : piercingDamagePercent * Number(bonusAttack.percent) / 100,
          defense,
          ignoreDefense,
          playerLevel,
          monsterLevel: monster.level,
          elementMultiplier: multiplier
        });
        const damageBeforeRaidRule = splitDamageAcrossHits && hitCount > 1
          ? splitResolvedDamage(resolvedDamage, hit, hitCount)
          : resolvedDamage;
        const damage = applyRaidBossDamageRule(monster, damageBeforeRaidRule, damageType, now);
        recordMonsterContribution(monster, userKey, damage);
        monster.hp = Math.max(leaveAtOneHp ? 1 : 0, monster.hp - damage);
        totalDamage += damage;
        bonusPassDamage += damage;
        hitResults.push({
          monsterId: monster.id,
          hitIndex: hitResults.length,
          damage,
          critical,
          missed: false,
          remainingHp: monster.hp,
          maxHp: monster.maxHp,
          defeated: monster.hp <= 0,
          bonusAttack: true,
          bonusAttackIndex,
          bonusAttackSource: bonusAttack.source,
          followUpAttack: bonusAttack.source === 'follow-up-summon',
          closeRangeTriggered,
          piercingIndex: progressivePiercing ? targetIndex : undefined,
          piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined
        });
      }
      if (bonusPassDamage <= 0) continue;
      if (damageType === 'magic') {
        mpAbsorbed += absorbMonsterMp(monster, mpAbsorbChance, mpAbsorbPercent);
      }
      if (bonusAttack.repeatEffects) {
        repeatedEffectPasses += 1;
        if (monster.hp > 0 && applyPoisonPassive(monster, {
          userId: userKey,
          chance: poisonChance,
          attack: poisonAttack,
          durationSeconds: poisonDurationSeconds,
          maxStacks: poisonMaxStacks,
          now
        })) poisonApplications += 1;
      }
    }
    monster.aggroTargetId = userKey;
    let debuffApplied = false;
    let debuffApplications = 0;
    for (let attempt = 0; attempt < 1 + repeatedEffectPasses; attempt += 1) {
      if (
        Number(outgoingDamageReductionPercent) > 0
        && !monster.fieldBoss
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
        debuffApplied = true;
        debuffApplications += 1;
      }
    }
    let knockedBack = false;
    let stunApplications = 0;
    if (Number(stunChance) > 0) {
      for (let attempt = 0; attempt < 1 + repeatedEffectPasses; attempt += 1) {
        if (Math.random() * 100 < Number(stunChance)) stunApplications += 1;
      }
    }
    const freezeMultiplier = Math.max(
      ...activeElements.map((activeElement) => getElementMultiplier(monster, activeElement))
    );
    const frozen = !monster.raidBoss
      && totalDamage > 0
      && monster.hp > 0
      && activeElements.includes('ice')
      && freezeMultiplier >= 1
      && Number(freezeSeconds) > 0;
    if (frozen) {
      monster.stunnedUntil = now + Math.max(0, Number(freezeSeconds)) * 1000;
      monster.frozenUntil = monster.stunnedUntil;
      monster.state = 'stunned';
    } else if (!monster.raidBoss && stunApplications > 0) {
      monster.stunnedUntil = now + Math.max(0, Number(stunSeconds) || 0) * 1000;
      monster.state = 'stunned';
    } else {
      monster.state = 'chase';
    }
    if (pull && !monster.raidBoss) monster.x = clamp(player.x + (player.facingLeft ? -2 : 2), 2, 92);
    else knockedBack = applyHeavyHitKnockback(monster, player, totalDamage, mapId);
    let defeated = monster.hp <= 0;
    let raidPhaseChanged = false;
    if (defeated && monster.raidBoss) {
      const transition = resolveRaidBossPhase(runtime, monster, userKey, now);
      defeated = transition.defeated;
      raidPhaseChanged = transition.phaseChanged;
    }
    if (defeated) {
      monster.state = 'defeated';
      monster.aggroTargetId = '';
      if (monster.fieldBoss && !monster.raidBoss) {
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
      displayDamage: executed ? EXECUTE_FIXED_DAMAGE : totalDamage,
      executeDamage: executed ? EXECUTE_FIXED_DAMAGE : 0,
      missed: false,
      hitChance,
      doubleStrike: normalizedBonusAttacks.some(
        (attack) => attack.source === 'double-strike'
      ),
      followUpAttack: normalizedBonusAttacks.some(
        (attack) => attack.source === 'follow-up-summon'
      ),
      closeRangeTriggered,
      executed,
      knockedBack,
      defeated,
      monsterLevel: monster.level,
      expReward: defeated && !monster.fieldBoss ? monster.expReward : 0,
      mpAbsorbed,
      poisoned: poisonApplications > 0,
      poisonApplications,
      frozen,
      debuffApplied,
      debuffApplications,
      stunApplications,
      hitResults,
      targetX,
      targetFloor,
      piercingIndex: progressivePiercing ? targetIndex : undefined,
      piercingDamagePercent: progressivePiercing ? piercingDamagePercent : undefined,
      monster: defeated ? null : serializeMonster(monster)
    });
    outcomes[outcomes.length - 1].raidPhaseChanged = raidPhaseChanged;
  }
  if (
    targetLimit === 1
    && outcomes.length === 1
    && Number(outcomes[0]?.damage) > 0
    && !outcomes[0].executed
  ) {
    const chained = applyAugmentChainAttack({
      runtime,
      player,
      sourceMonster: candidates[0],
      userId: userKey,
      sourceDamage: outcomes[0].damage,
      mapId,
      now
    });
    if (chained) {
      outcomes.push(chained.outcome);
      drops.push(...chained.drops);
    }
  }
  return {
    success: true,
    outcomes,
    drops: drops.map(serializeLoot),
    expReward: outcomes.reduce((sum, outcome) => sum + outcome.expReward, 0),
    mpAbsorbed: outcomes.reduce((sum, outcome) => sum + (outcome.mpAbsorbed || 0), 0),
    fieldBossRewards,
    casterMovement,
    progressivePiercing: Boolean(progressivePiercing),
    facingLeft: player.facingLeft
  };
}

function updatePlayerResources(userId, resources = {}) {
  for (const runtime of activeMaps.values()) {
    const player = runtime.players.get(String(userId));
    if (!player) continue;
    if (Number.isFinite(Number(resources.currentHp))) {
      player.currentHp = Math.max(0, Number(resources.currentHp));
      if (player.currentHp <= 0) {
        player.deadAt = Number(player.deadAt || Date.now());
        player.activity = 'dead';
        player.motion = 'dead';
      } else if (player.activity === 'dead' || player.motion === 'dead') {
        player.deadAt = 0;
        player.activity = 'idle';
        player.motion = 'idle';
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

function setPlayerInvulnerability(userId, mapId, until) {
  const runtime = activeMaps.get(String(mapId || ''));
  const player = runtime?.players.get(String(userId || ''));
  if (!player) return false;
  player.invulnerableUntil = Math.max(
    Number(player.invulnerableUntil) || 0,
    Number(until) || 0
  );
  return true;
}

function spawnBonusMonster({
  mapId,
  ownerId = '',
  expMultiplier = 7,
  now = Date.now()
} = {}) {
  const runtime = activeMaps.get(String(mapId || ''));
  const map = getWorldMap(String(mapId || ''));
  if (!runtime || !map || map.safeZone || map.fieldBossId) return null;
  const platform = chooseMonsterSpawnPlatform(map, runtime);
  if (!platform) return null;
  const monster = keepMonsterSpawnClearOfPlayers(
    createMonster(map, runtime.spawnSequence, now, platform),
    platform,
    runtime,
    map
  );
  runtime.spawnSequence += 1;
  monster.name = `보너스 ${monster.name}`;
  monster.icon = '🎁';
  monster.expReward = Math.max(
    1,
    Math.floor(Number(monster.expReward) * Math.max(1, Number(expMultiplier) || 1))
  );
  monster.bonusMonster = true;
  monster.bonusOwnerId = String(ownerId || '');
  runtime.monsters.push(monster);
  return serializeMonster(monster);
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

function isPlayerStunned(userId, mapId, now = Date.now()) {
  const runtime = activeMaps.get(String(mapId || ''));
  const player = runtime?.players.get(String(userId || ''));
  return Boolean(player && Number(player.stunnedUntil || 0) > now);
}

function clearPlayerNegativeStatus(userId, mapId, options = {}) {
  const userKey = String(userId || '');
  const preferredMapId = String(mapId || '');
  const runtimes = [
    activeMaps.get(preferredMapId),
    ...Array.from(activeMaps.entries())
      .filter(([activeMapId]) => activeMapId !== preferredMapId)
      .map(([, runtime]) => runtime)
  ].filter(Boolean);
  let cleansed = false;
  for (const runtime of runtimes) {
    const player = runtime.players.get(userKey);
    if (!player) continue;
    cleansed = cleansed || Number(player.silencedUntil || 0) > 0;
    player.silencedUntil = 0;
    if (options.includeRaidStun === true) {
      cleansed = cleansed || Number(player.stunnedUntil || 0) > 0;
      player.stunnedUntil = 0;
      player.raidStunnedUntil = 0;
    }
  }
  return cleansed;
}

function resetWorldRuntime() {
  for (const mapId of raidMapSimulationTimers.keys()) stopRaidMapSimulation(mapId);
  activeMaps.clear();
  playerMapIndex.clear();
  worldControllers.clear();
  fieldBossRespawns.clear();
  latestGlobalShout = null;
}

module.exports = {
  PLAYER_TIMEOUT_MS,
  RAID_CORPSE_RETENTION_MS,
  EXECUTE_FIXED_DAMAGE,
  WORLD_CONTROL_ACTIVE_MS,
  CONTACT_COOLDOWN_MS,
  CONTACT_INVULNERABILITY_MS,
  PLAYER_CONTACT_KNOCKBACK_DISTANCE,
  MONSTER_SPAWN_INTERVAL_MS,
  MONSTER_MAX_PER_MAP,
  MONSTER_SPAWN_PER_WAVE,
  RAID_MAP_TICK_INTERVAL_MS,
  getHwangFieldBossDrops,
  getGammamNeoFieldBossDrops,
  getFieldBossDefinition,
  MONSTER_CATALOG,
  buildMonsterStats,
  buildFieldBossRewardEvent,
  claimWorldControl,
  hasWorldControl,
  hasRecentWorldControl,
  releaseWorldControl,
  updatePresence,
  startRaidMapSimulation,
  stopRaidMapSimulation,
  tickRaidMapSimulation,
  attackMonster,
  useSkillOnMonsters,
  isPlayerSilenced,
  isPlayerStunned,
  clearPlayerNegativeStatus,
  applyRaidResourceCrash,
  updatePlayerResources,
  setPlayerInvulnerability,
  spawnBonusMonster,
  setPlayerStealth,
  recordSkillUse,
  listActivePlayers,
  listAllActivePlayers,
  publishGlobalShout,
  getGlobalShout,
  leaveWorld,
  resetWorldRuntime
};
