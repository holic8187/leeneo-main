import { secureRandom } from './packEngine.js';

export const EQUIPMENT_TYPES = Object.freeze({
  armor: Object.freeze({ id: 'armor', label: '방어구', stat: 'partyHpPercent' }),
  weapon: Object.freeze({ id: 'weapon', label: '무기', stat: 'partyAttackPercent' }),
  exclusiveWeapon: Object.freeze({
    id: 'exclusiveWeapon',
    label: '전용 무기',
    stat: 'exclusive',
    reserved: true,
  }),
});

export const EQUIPMENT_RARITIES = Object.freeze(['c', 'r', 'ur', 'ssr']);

export const EQUIPMENT_BASE_BONUSES = Object.freeze({
  armor: Object.freeze({ c: 3, r: 6, ur: 8, ssr: 10 }),
  weapon: Object.freeze({ c: 1, r: 2, ur: 3.5, ssr: 5 }),
});

const DROPPABLE_TYPES = Object.freeze(['armor', 'weapon']);
const MAX_INVENTORY_ITEMS = 1000;

const clampUnit = (value) => Math.min(0.999999999, Math.max(0, Number(value) || 0));
const roundOne = (value) => Math.round((Number(value) + Number.EPSILON) * 10) / 10;

function durationQuality(mission) {
  const minutes = Math.max(1, Number(mission?.durationMs) / 60_000 || 1);
  return Math.min(1, Math.log(minutes) / Math.log(720));
}

/**
 * Higher-grade and longer expeditions shift successful drops from C toward R
 * and UR. SSR intentionally remains at 0.01% of equipment drops, matching the
 * standard card draw's very small SSR weight instead of becoming common on a
 * long expedition.
 */
export function equipmentRarityWeightsForMission(mission) {
  const duration = durationQuality(mission);
  const gradeBoost = mission?.powerBand === 'expert' ? 1 : 0;
  const quality = Math.min(1, (duration * 0.75) + (gradeBoost * 0.25));
  return {
    c: roundOne(92 - (22 * quality)),
    r: roundOne(7.8 + (18 * quality)),
    ur: roundOne(0.19 + (4 * quality)),
    ssr: 0.01,
  };
}

/**
 * Expedition data already carries a card-pack chance balanced by duration and
 * power band. Equipment uses that same non-guaranteed appearance curve unless
 * a future mission defines an explicit equipment chance.
 */
export function equipmentDropChanceForMission(mission) {
  const configured = mission?.reward?.equipmentChance ?? mission?.reward?.packChance;
  return Math.min(0.95, Math.max(0, Number(configured) || 0));
}

export function rollEquipmentRarity(mission, random = secureRandom) {
  const weights = equipmentRarityWeightsForMission(mission);
  const total = EQUIPMENT_RARITIES.reduce((sum, rarity) => sum + weights[rarity], 0);
  let cursor = clampUnit(random()) * total;
  for (const rarity of EQUIPMENT_RARITIES) {
    cursor -= weights[rarity];
    if (cursor < 0) return rarity;
  }
  return EQUIPMENT_RARITIES.at(-1);
}

function fallbackEquipmentId({ now, type, rarity, random }) {
  const cryptoImpl = globalThis.crypto;
  if (typeof cryptoImpl?.randomUUID === 'function') return `equipment-${cryptoImpl.randomUUID()}`;
  const entropy = Math.floor(clampUnit(random()) * 0x100000000).toString(36).padStart(7, '0');
  return `equipment-${Math.max(0, Number(now) || 0).toString(36)}-${type}-${rarity}-${entropy}`;
}

export function createEquipment({
  type,
  rarity,
  missionId = '',
  now = Date.now(),
  random = secureRandom,
  idFactory = fallbackEquipmentId,
} = {}) {
  if (!DROPPABLE_TYPES.includes(type)) throw new Error(`Unsupported droppable equipment type: ${type}`);
  if (!EQUIPMENT_RARITIES.includes(rarity)) throw new Error(`Unsupported equipment rarity: ${rarity}`);
  const baseBonusPercent = EQUIPMENT_BASE_BONUSES[type][rarity];
  const variancePercent = roundOne((clampUnit(random()) * 20) - 10);
  const bonusPercent = roundOne(baseBonusPercent * (1 + (variancePercent / 100)));
  const definition = EQUIPMENT_TYPES[type];
  const id = String(idFactory({ now, type, rarity, random }) || '').trim();
  if (!id) throw new Error('Equipment id factory returned an empty id.');

  return {
    id,
    type,
    rarity,
    name: `${rarity.toUpperCase()} ${definition.label}`,
    stat: definition.stat,
    baseBonusPercent,
    variancePercent,
    bonusPercent,
    source: {
      type: 'expedition',
      missionId: String(missionId || ''),
    },
    acquiredAt: Math.max(0, Number(now) || 0),
  };
}

export function rollExpeditionEquipmentDrop({
  mission,
  now = Date.now(),
  random = secureRandom,
  idFactory,
} = {}) {
  if (!mission) return null;
  const chance = equipmentDropChanceForMission(mission);
  if (clampUnit(random()) >= chance) return null;
  const rarity = rollEquipmentRarity(mission, random);
  const type = DROPPABLE_TYPES[Math.floor(clampUnit(random()) * DROPPABLE_TYPES.length)];
  return createEquipment({
    type,
    rarity,
    missionId: mission.id,
    now,
    random,
    ...(typeof idFactory === 'function' ? { idFactory } : {}),
  });
}

export function normalizeEquipmentItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = String(value.id || '').trim();
  const type = String(value.type || '').trim();
  const rarity = String(value.rarity || '').trim().toLowerCase();
  if (!id || !Object.hasOwn(EQUIPMENT_TYPES, type) || !EQUIPMENT_RARITIES.includes(rarity)) return null;

  const definition = EQUIPMENT_TYPES[type];
  const baseBonusPercent = Number(value.baseBonusPercent);
  const bonusPercent = Number(value.bonusPercent);
  if (!Number.isFinite(baseBonusPercent) || baseBonusPercent < 0) return null;
  if (!Number.isFinite(bonusPercent) || bonusPercent < 0) return null;

  return {
    id,
    type,
    rarity,
    name: String(value.name || `${rarity.toUpperCase()} ${definition.label}`),
    stat: definition.stat,
    baseBonusPercent: roundOne(baseBonusPercent),
    variancePercent: Math.min(10, Math.max(-10, roundOne(value.variancePercent))),
    bonusPercent: roundOne(bonusPercent),
    source: {
      type: String(value.source?.type || ''),
      missionId: String(value.source?.missionId || ''),
    },
    acquiredAt: Math.max(0, Number(value.acquiredAt) || 0),
  };
}

export function normalizeEquipmentInventory(value) {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const candidate of items.slice(-MAX_INVENTORY_ITEMS)) {
    const item = normalizeEquipmentItem(candidate);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    normalized.push(item);
  }
  return normalized;
}

export function addEquipmentToInventory(inventory, equipment) {
  const normalized = normalizeEquipmentInventory(inventory);
  const item = normalizeEquipmentItem(equipment);
  if (!item || normalized.some((candidate) => candidate.id === item.id)) return normalized;
  return [...normalized, item].slice(-MAX_INVENTORY_ITEMS);
}

export function equipmentPartyAttackMultiplier(equipment) {
  const item = normalizeEquipmentItem(equipment);
  return item?.type === EQUIPMENT_TYPES.weapon.id
    ? 1 + (item.bonusPercent / 100)
    : 1;
}

export function equipmentPartyHpMultiplier(equipment) {
  const item = normalizeEquipmentItem(equipment);
  return item?.type === EQUIPMENT_TYPES.armor.id
    ? 1 + (item.bonusPercent / 100)
    : 1;
}

export function equipmentById(inventory, equipmentId) {
  const id = String(equipmentId || '').trim();
  return normalizeEquipmentInventory(inventory).find((item) => item.id === id) || null;
}

export function createDefaultEquipmentState() {
  return { equipmentInventory: [] };
}
