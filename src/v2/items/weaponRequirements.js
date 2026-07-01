'use strict';

const WEAPON_REQUIREMENT_RULES = Object.freeze({
  oneHandedSword: Object.freeze({ archetype: 'warrior' }),
  twoHandedSword: Object.freeze({ archetype: 'warrior' }),
  oneHandedAxe: Object.freeze({ archetype: 'warrior' }),
  oneHandedBlunt: Object.freeze({ archetype: 'warrior' }),
  twoHandedAxe: Object.freeze({ archetype: 'warrior' }),
  twoHandedBlunt: Object.freeze({ archetype: 'warrior' }),
  spear: Object.freeze({ archetype: 'warrior' }),
  polearm: Object.freeze({ archetype: 'warrior' }),
  bow: Object.freeze({ archetype: 'archer', stat: 'grit', offset: 5 }),
  crossbow: Object.freeze({ archetype: 'archer', stat: 'grit', offset: 0 }),
  wand: Object.freeze({ archetype: 'mage', stat: 'awareness', offset: 2 }),
  staff: Object.freeze({ archetype: 'mage', stat: 'awareness', offset: 3 }),
  claw: Object.freeze({ archetype: 'thief', stat: 'processingSpeed', offset: 40 }),
  dagger: Object.freeze({ archetype: 'thief', stat: 'processingSpeed', offset: 40 })
});

function normalizeRequiredLevel(value) {
  return Math.max(1, Math.min(200, Math.floor(Number(value) || 1)));
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
    archetype: rule.archetype
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

function canEquipWeapon(character = {}, item = {}) {
  const requirements = item.requirements
    || buildWeaponRequirements(item.weaponType, item.requiredLevel ?? item.levelRequirement);
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  if (level < requirements.level) return false;
  return Object.entries(requirements.stats).every(
    ([stat, required]) => Number(character.stats?.[stat] || 0) >= required
  );
}

module.exports = {
  WEAPON_REQUIREMENT_RULES,
  buildWeaponRequirements,
  applyWeaponRequirements,
  canEquipWeapon
};
