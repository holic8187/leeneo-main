'use strict';

const { DEPARTMENTS } = require('../jobs/advancementRules');

const WEAPON_REQUIREMENT_RULES = Object.freeze({
  oneHandedSword: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  twoHandedSword: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  oneHandedAxe: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  oneHandedBlunt: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  twoHandedAxe: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  twoHandedBlunt: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  spear: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  polearm: Object.freeze({ archetypes: Object.freeze(['warrior']) }),
  bow: Object.freeze({ archetypes: Object.freeze(['archer']), stat: 'grit', offset: 5 }),
  crossbow: Object.freeze({ archetypes: Object.freeze(['archer']), stat: 'grit', offset: 0 }),
  wand: Object.freeze({ archetypes: Object.freeze(['mage']), stat: 'awareness', offset: 2 }),
  staff: Object.freeze({ archetypes: Object.freeze(['mage']), stat: 'awareness', offset: 3 }),
  claw: Object.freeze({ archetypes: Object.freeze(['thief']), stat: 'processingSpeed', offset: 40 }),
  dagger: Object.freeze({ archetypes: Object.freeze(['thief']), stat: 'processingSpeed', offset: 40 })
});

const ARCHETYPE_LABELS = Object.freeze({
  warrior: '전사',
  archer: '궁수',
  mage: '마법사',
  thief: '도적',
  knucklePirate: '인파이터',
  gunPirate: '건슬링거'
});

const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  cloak: 'cape',
  mantle: 'cape',
  earring: 'earrings'
});

const WEAPON_TYPE_LABELS = Object.freeze({
  dagger: '단검'
});

function normalizeRequiredLevel(value) {
  return Math.max(1, Math.min(200, Math.floor(Number(value) || 1)));
}

function normalizeEquipmentSlot(slot = '') {
  const normalized = String(slot || '').trim();
  return EQUIPMENT_SLOT_ALIASES[normalized] || normalized;
}

function buildWeaponRequirements(weaponType, requiredLevel) {
  const rule = WEAPON_REQUIREMENT_RULES[String(weaponType || '')];
  if (!rule) throw new Error(`무기 요구치 규칙이 없는 무기입니다: ${weaponType}`);
  const level = normalizeRequiredLevel(requiredLevel);
  const stats = {};
  if (rule.stat) stats[rule.stat] = level + rule.offset;
  return {
    level,
    stats,
    archetype: rule.archetypes[0],
    allowedArchetypes: [...rule.archetypes]
  };
}

function applyWeaponRequirements(item = {}) {
  const weaponType = String(item.weaponType || '');
  const requiredLevel = item.requiredLevel ?? item.levelRequirement ?? 1;
  return {
    ...item,
    requirements: buildWeaponRequirements(weaponType, requiredLevel)
  };
}

function getCharacterArchetype(character = {}) {
  const departmentId = String(character.job?.departmentId || '');
  return DEPARTMENTS[departmentId]?.archetype || character.job?.archetype || '';
}

function getAllowedWeaponArchetypes(requirements = {}) {
  if (Array.isArray(requirements.allowedArchetypes)) {
    return requirements.allowedArchetypes.map(String).filter(Boolean);
  }
  return requirements.archetype ? [String(requirements.archetype)] : [];
}

function getAllowedEquipmentWeaponTypes(item = {}) {
  const allowedWeaponTypes = item?.requirements?.allowedWeaponTypes;
  return Array.isArray(allowedWeaponTypes)
    ? allowedWeaponTypes.map(String).filter(Boolean)
    : [];
}

function getWeaponTypeRestrictionLabel(weaponTypes = []) {
  return weaponTypes
    .map((weaponType) => WEAPON_TYPE_LABELS[weaponType] || weaponType)
    .join(', ');
}

function getEffectiveRequirementStats(character = {}, excludedSlot = '') {
  const effectiveStats = { ...(character.stats || {}) };
  const normalizedExcludedSlot = normalizeEquipmentSlot(excludedSlot);
  for (const [slot, equipped] of Object.entries(character.loadout || {})) {
    if (!equipped || typeof equipped !== 'object') continue;
    if (normalizeEquipmentSlot(slot) === normalizedExcludedSlot) continue;
    const stats = equipped.stats && typeof equipped.stats === 'object'
      ? equipped.stats
      : (equipped.instanceData?.stats || {});
    for (const [stat, value] of Object.entries(stats || {})) {
      effectiveStats[stat] = (Number(effectiveStats[stat]) || 0) + (Number(value) || 0);
    }
  }
  return effectiveStats;
}

function getWeaponEquipFailureReason(character = {}, item = {}) {
  const requirements = item.requirements
    || buildWeaponRequirements(item.weaponType, item.requiredLevel ?? item.levelRequirement);
  const allowedArchetypes = getAllowedWeaponArchetypes(requirements);
  const characterArchetype = getCharacterArchetype(character);
  if (!characterArchetype || !allowedArchetypes.includes(characterArchetype)) {
    const allowed = allowedArchetypes
      .map((archetype) => ARCHETYPE_LABELS[archetype] || archetype)
      .join(', ');
    return `${allowed || '지정된'} 직업군만 장착할 수 있는 무기입니다.`;
  }
  const shield = character.loadout?.shield;
  const shieldWeaponTypes = getAllowedEquipmentWeaponTypes(shield);
  const weaponType = String(item.weaponType || '');
  if (shieldWeaponTypes.length && !shieldWeaponTypes.includes(weaponType)) {
    const allowed = getWeaponTypeRestrictionLabel(shieldWeaponTypes);
    return `${shield?.name || '장착 중인 방패'}는 ${allowed}과 함께만 사용할 수 있습니다.`;
  }
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  if (level < requirements.level) return `레벨 ${requirements.level} 이상부터 장착할 수 있습니다.`;
  const requirementStats = getEffectiveRequirementStats(character, 'weapon');
  const missingStat = Object.entries(requirements.stats || {}).find(
    ([stat, required]) => Number(requirementStats[stat] || 0) < required
  );
  if (missingStat) {
    const [stat, required] = missingStat;
    return `${stat} 능력치가 ${required} 이상이어야 합니다.`;
  }
  return '';
}

function canEquipWeapon(character = {}, item = {}) {
  return !getWeaponEquipFailureReason(character, item);
}

function getEquipmentEquipFailureReason(character = {}, item = {}) {
  if (item.itemType === 'weapon') return getWeaponEquipFailureReason(character, item);
  const requirements = item.requirements || {};
  const equipmentSlot = normalizeEquipmentSlot(item.equipmentSlot || '');
  const commonEquipmentSlot = ['earrings', 'cape'].includes(equipmentSlot);
  const allowedArchetypes = getAllowedWeaponArchetypes(requirements);
  const characterArchetype = getCharacterArchetype(character);
  if (
    !commonEquipmentSlot
    && allowedArchetypes.length
    && !allowedArchetypes.includes(characterArchetype)
  ) {
    const allowed = allowedArchetypes
      .map((archetype) => ARCHETYPE_LABELS[archetype] || archetype)
      .join(', ');
    return `${allowed} 직업군만 장착할 수 있는 장비입니다.`;
  }
  const allowedWeaponTypes = getAllowedEquipmentWeaponTypes(item);
  const equippedWeaponType = String(character.loadout?.weapon?.weaponType || '');
  if (allowedWeaponTypes.length && !allowedWeaponTypes.includes(equippedWeaponType)) {
    const allowed = getWeaponTypeRestrictionLabel(allowedWeaponTypes);
    return `${allowed}을 장착한 상태에서만 사용할 수 있는 장비입니다.`;
  }
  const requiredLevel = Math.max(
    1,
    Number(requirements.level ?? item.requiredLevel ?? item.levelRequirement) || 1
  );
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  if (level < requiredLevel) return `레벨 ${requiredLevel} 이상부터 장착할 수 있습니다.`;
  const requirementStats = getEffectiveRequirementStats(character, equipmentSlot);
  const missingStat = !commonEquipmentSlot
    && Object.entries(requirements.stats || {}).find(
      ([stat, required]) => Number(requirementStats[stat] || 0) < Number(required)
    );
  if (missingStat) {
    const [stat, required] = missingStat;
    return `${stat} 능력치가 ${required} 이상이어야 합니다.`;
  }
  return '';
}

module.exports = {
  WEAPON_REQUIREMENT_RULES,
  buildWeaponRequirements,
  applyWeaponRequirements,
  getCharacterArchetype,
  getAllowedWeaponArchetypes,
  getAllowedEquipmentWeaponTypes,
  getEffectiveRequirementStats,
  getWeaponEquipFailureReason,
  getEquipmentEquipFailureReason,
  canEquipWeapon
};
