'use strict';

const { applyWeaponRequirements } = require('./weaponRequirements');

const DROP_RATE_MIN = 0.00002;
const DROP_RATE_MAX = 0.00008;
const EQUIPMENT_LEVELS = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);

const WEAPON_TIER_NAMES = Object.freeze([
  '수습', '칼퇴', '결재선', '실무', '야근', '성과급', '감사실',
  '마감', '임원회의', '본부장', '이사회', '대표이사', '회장실', '최종결재'
]);

function buildWeaponNames(noun) {
  return WEAPON_TIER_NAMES.map((tier) => `${tier} ${noun}`);
}

const WEAPON_LINES = Object.freeze([
  ['warrior', 'oneHandedSword', '⚔️', buildWeaponNames('결재검')],
  ['warrior', 'twoHandedSword', '🗡️', buildWeaponNames('보고대검')],
  ['warrior', 'oneHandedAxe', '🪓', buildWeaponNames('정리도끼')],
  ['warrior', 'twoHandedAxe', '🪓', buildWeaponNames('공정파쇄도끼')],
  ['warrior', 'oneHandedBlunt', '🔨', buildWeaponNames('승인망치')],
  ['warrior', 'spear', '🔱', buildWeaponNames('점검창')],
  ['warrior', 'polearm', '⚜️', buildWeaponNames('집행폴암')],
  ['archer', 'bow', '🏹', buildWeaponNames('홍보장궁')],
  ['archer', 'crossbow', '🎯', buildWeaponNames('결산석궁')],
  ['thief', 'claw', '✴️', buildWeaponNames('계약아대')],
  ['thief', 'dagger', '🗡️', buildWeaponNames('시설단검')],
  ['mage', 'wand', '🪄', buildWeaponNames('개발완드')],
  ['mage', 'staff', '🔮', buildWeaponNames('연구스태프')]
]);

const ARMOR_SLOTS = Object.freeze([
  ['helmet', '투구', '🪖', 1],
  ['gloves', '장갑', '🧤', 0.58],
  ['shoes', '신발', '🥾', 0.52],
  ['top', '상의', '👔', 1.18],
  ['bottom', '하의', '👖', 0.92]
]);

const ARMOR_TIER_THEMES = Object.freeze({
  warrior: ['첫 출근', '안전제일', '강철근무', '불굴현장', '철야방호', '본부직속', '무결점공정'],
  archer: ['초급정산', '오차없는', '정밀분석', '월말결산', '감사대응', '수석회계', '완벽결산'],
  thief: ['첫 계약', '은밀협상', '현장잠입', '실적추적', '비밀계약', '수석영업', '전설계약'],
  mage: ['초급개발', '서비스안정', '고급연구', '서버수호', '혁신기술', '수석연구', '무중단배포']
});

const ARMOR_SLOT_NAMES = Object.freeze({
  helmet: '보호모',
  gloves: '업무장갑',
  shoes: '근무화',
  top: '업무복',
  bottom: '근무바지'
});

const COMMON_CAPE_NAMES = Object.freeze([
  '신입의 출입증 망토',
  '방풍 출퇴근 망토',
  '야근 순찰 망토',
  '성과보고 망토',
  '임원회의 망토',
  '대표이사 망토',
  '호이상사 명예망토'
]);

const COMMON_EARRING_NAMES = Object.freeze([
  '사내 메신저 이어셋',
  '업무집중 이어셋',
  '회의녹취 이어셋',
  '노이즈차단 이어셋',
  '임원전용 이어셋',
  '대표이사 이어셋',
  '호이상사 지휘 이어셋'
]);

const ALL_ARCHETYPES = Object.freeze(['warrior', 'archer', 'thief', 'mage']);

const ARCHETYPE_LABELS = Object.freeze({
  warrior: '전사',
  archer: '궁수',
  thief: '도적',
  mage: '마법사'
});

function deterministicRate(id) {
  let hash = 0;
  for (const character of String(id)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return Math.min(DROP_RATE_MAX, DROP_RATE_MIN + (hash % 7) * 0.00001);
}

function scaledEquipmentPrice(level, minimum, maximum) {
  const ratio = Math.max(0, Math.min(1, (Number(level) - 10) / 130));
  return Math.round(minimum + (maximum - minimum) * ratio);
}

function getEquipmentSellPrice(level, slot = 'weapon') {
  const baseArmorPrice = scaledEquipmentPrice(level, 23_000, 307_692);
  if (slot === 'weapon') {
    // Weapons are about 30% more valuable than same-level general armor.
    return Math.max(30_000, Math.round(baseArmorPrice * 1.3));
  }
  const slotMultiplier = {
    top: 1,
    bottom: 0.96,
    helmet: 0.93,
    gloves: 0.88,
    shoes: 0.78,
    earrings: 0.65
  }[slot] || 0.9;
  const slotMinimum = slot === 'earrings'
    ? 20_000
    : (slot === 'shoes' ? 21_000 : 23_000);
  return Math.max(
    slotMinimum,
    Math.round(baseArmorPrice * slotMultiplier)
  );
}

function rollEquipmentInstanceData(item, random = Math.random) {
  const baseStats = item?.stats && typeof item.stats === 'object' ? item.stats : {};
  const stats = {};
  const rolls = {};
  for (const [stat, rawValue] of Object.entries(baseStats)) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const variation = Math.floor(random() * 11) - 5;
    rolls[stat] = variation;
    stats[stat] = value > 0
      ? Math.max(1, Math.round(value + variation))
      : Math.round(value + variation);
  }
  return {
    stats,
    rolls,
    rolledAt: new Date().toISOString()
  };
}

function weaponStats(archetype, level, weaponType) {
  const attack = Math.min(94, Math.max(6, Math.round(6 + level * 0.72)));
  if (archetype === 'mage') {
    const stats = {
      attack: Math.max(3, Math.round(2 + level * 0.18)),
      magic: Math.min(112, Math.round(7 + level * 0.82))
    };
    const knowledge = Math.floor(level / 30);
    if (knowledge > 0) stats.workKnowledge = knowledge;
    return stats;
  }
  const speedBonus = ['twoHandedAxe', 'spear', 'polearm', 'crossbow'].includes(weaponType) ? 3 : 0;
  const mainStat = archetype === 'archer'
    ? 'processingSpeed'
    : archetype === 'thief' ? 'awareness' : 'grit';
  const stats = { attack: attack + speedBonus };
  const mainStatBonus = Math.floor(level / 30);
  if (mainStatBonus > 0) stats[mainStat] = mainStatBonus;
  return stats;
}

function weaponSpeed(weaponType) {
  if (['twoHandedAxe', 'spear', 'polearm'].includes(weaponType)) return 0.82;
  if (weaponType === 'crossbow' || weaponType === 'staff') return 0.9;
  if (['bow', 'twoHandedSword'].includes(weaponType)) return 1;
  if (['claw', 'wand'].includes(weaponType)) return 1.12;
  return 1.06;
}

function createWeapon(line, level, index) {
  const [archetype, weaponType, icon, names] = line;
  const id = `drop_${weaponType}_${level}`;
  const item = applyWeaponRequirements({
    id,
    name: names[index],
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: level,
    stats: weaponStats(archetype, level, weaponType),
    attackSpeedMultiplier: weaponSpeed(weaponType),
    maxStack: 1,
    sellPrice: getEquipmentSellPrice(level, 'weapon'),
    sourceReference: 'dreaminfo-maple-drop-list',
    description: `${level}레벨 ${archetype} 계열 무기입니다. 직업과 요구 능력치를 충족해야 장착할 수 있습니다.`
  });
  item.dropChance = deterministicRate(id);
  return item;
}

function createArmor(archetype, slotRow, level) {
  const [slot, label, icon, defenseRatio] = slotRow;
  const id = `drop_${archetype}_${slot}_${level}`;
  const mainStat = archetype === 'warrior'
    ? 'grit'
    : archetype === 'archer'
      ? 'processingSpeed'
      : archetype === 'mage' ? 'workKnowledge' : 'awareness';
  const stats = {
    defense: Math.max(1, Math.round((3 + level * 0.72) * defenseRatio)),
    [mainStat]: Math.max(1, Math.floor(level / 18))
  };
  if (archetype === 'mage') stats.magicDefense = Math.max(1, Math.round(level * defenseRatio * 0.5));
  const themeIndex = Math.max(0, Math.min(
    ARMOR_TIER_THEMES[archetype].length - 1,
    Math.floor(level / 20) - 1
  ));
  return {
    id,
    name: `${ARMOR_TIER_THEMES[archetype][themeIndex]} ${ARMOR_SLOT_NAMES[slot] || label}`,
    category: 'equipment',
    itemType: 'armor',
    equipmentSlot: slot,
    icon,
    requiredLevel: level,
    requirements: {
      level,
      stats: {},
      archetype,
      allowedArchetypes: [archetype]
    },
    stats,
    maxStack: 1,
    sellPrice: getEquipmentSellPrice(level, slot),
    dropChance: deterministicRate(id),
    description: `${level}레벨 ${ARCHETYPE_LABELS[archetype]} 계열 ${label}입니다.`
  };
}

function createCommonEquipment(slot, level) {
  const index = Math.max(0, Math.min(6, Math.floor(level / 20) - 1));
  const cape = slot === 'cape';
  const id = `drop_common_${slot}_${level}`;
  const stats = cape
    ? {
      defense: Math.max(1, Math.round((3 + level * 0.72) * 0.48)),
      evasion: Math.max(1, Math.floor(level / 35))
    }
    : {
      magicDefense: Math.max(1, Math.round(level * 0.28)),
      accuracy: Math.max(1, Math.floor(level / 28))
    };
  return {
    id,
    name: cape ? COMMON_CAPE_NAMES[index] : COMMON_EARRING_NAMES[index],
    category: 'equipment',
    itemType: cape ? 'armor' : 'accessory',
    equipmentSlot: slot,
    icon: cape ? '🧥' : '💎',
    requiredLevel: level,
    requirements: {
      level,
      stats: {},
      archetype: '',
      allowedArchetypes: [...ALL_ARCHETYPES]
    },
    stats,
    maxStack: 1,
    sellPrice: getEquipmentSellPrice(level, slot),
    dropChance: deterministicRate(id),
    description: `${level}레벨부터 모든 직업이 착용할 수 있는 공용 ${cape ? '망토' : '귀걸이'}입니다.`
  };
}

function createBossWeapon({
  id,
  name,
  archetype,
  weaponType,
  icon,
  attack,
  magic = 0,
  extraStats = {}
}) {
  const item = applyWeaponRequirements({
    id,
    name,
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: 100,
    stats: { attack, ...(magic ? { magic } : {}), ...extraStats },
    attackSpeedMultiplier: weaponSpeed(weaponType),
    maxStack: 1,
    sellPrice: 400_000,
    bossDropOnly: true,
    endgameTier: true,
    description: '보스에게서만 획득할 수 있는 호이상사 최상위 결재 장비입니다.'
  });
  item.requirements.allowedArchetypes = [archetype];
  item.requirements.archetype = archetype;
  return item;
}

const BOSS_ENDGAME_WEAPONS = Object.freeze([
  createBossWeapon({ id: 'boss_dragon_carabella', name: '회장 전용 결재검', archetype: 'warrior', weaponType: 'oneHandedSword', icon: '⚔️', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_claymore', name: '최종보고 대검', archetype: 'warrior', weaponType: 'twoHandedSword', icon: '🗡️', attack: 105 }),
  createBossWeapon({ id: 'boss_dragon_axe', name: '감사종결 도끼', archetype: 'warrior', weaponType: 'oneHandedAxe', icon: '🪓', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_battleaxe', name: '공정혁신 대도끼', archetype: 'warrior', weaponType: 'twoHandedAxe', icon: '🪓', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_mace', name: '최종승인 망치', archetype: 'warrior', weaponType: 'oneHandedBlunt', icon: '🔨', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_flame', name: '생산본부 대망치', archetype: 'warrior', weaponType: 'twoHandedBlunt', icon: '🔨', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_halberd', name: '현장집행 폴암', archetype: 'warrior', weaponType: 'polearm', icon: '⚜️', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_partisan', name: '품질보증 장창', archetype: 'warrior', weaponType: 'spear', icon: '🔱', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_wand', name: '무중단배포 완드', archetype: 'mage', weaponType: 'wand', icon: '🪄', attack: 75, magic: 123 }),
  createBossWeapon({ id: 'boss_dragon_staff', name: '기술이사 스태프', archetype: 'mage', weaponType: 'staff', icon: '🔮', attack: 80, magic: 125 }),
  createBossWeapon({ id: 'boss_dragon_shinebow', name: '전사캠페인 장궁', archetype: 'archer', weaponType: 'bow', icon: '🏹', attack: 100 }),
  createBossWeapon({ id: 'boss_dragon_shinecross', name: '완전무결 결산석궁', archetype: 'archer', weaponType: 'crossbow', icon: '🎯', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_kris', name: '시설봉쇄 단검', archetype: 'thief', weaponType: 'dagger', icon: '🗡️', attack: 98 }),
  createBossWeapon({ id: 'boss_dragon_khanjar', name: '비상대응 단검', archetype: 'thief', weaponType: 'dagger', icon: '🗡️', attack: 100 }),
  createBossWeapon({
    id: 'boss_dragon_green_sleeve',
    name: '전설영업 계약아대',
    archetype: 'thief',
    weaponType: 'claw',
    icon: '✴️',
    attack: 50,
    extraStats: { processingSpeed: 7, awareness: 7, maxHp: 50, evasion: 7 }
  })
].map((item) => Object.freeze(item)));

const STARTER_DROP_ITEMS = Object.freeze([
  createWeapon(['warrior', 'oneHandedSword', '⚔️', ['신입 결재검']], 1, 0),
  createWeapon(['archer', 'bow', '🏹', ['신입 홍보활']], 1, 0),
  createWeapon(['thief', 'dagger', '🗡️', ['신입 시설단검']], 1, 0),
  createWeapon(['mage', 'wand', '🪄', ['신입 개발완드']], 1, 0),
  createArmor('warrior', ['top', '상의', '👔', 1.18], 1),
  createArmor('archer', ['shoes', '신발', '🥾', 0.52], 1),
  createArmor('thief', ['gloves', '장갑', '🧤', 0.58], 1),
  createArmor('mage', ['helmet', '투구', '🪖', 1], 1)
].map((item) => Object.freeze(item)));

const EQUIPMENT_ITEMS = Object.freeze([
  ...STARTER_DROP_ITEMS,
  ...WEAPON_LINES.flatMap((line) => EQUIPMENT_LEVELS.map((level, index) => createWeapon(line, level, index))),
  ...Object.keys(ARMOR_TIER_THEMES).flatMap((archetype) => (
    EQUIPMENT_LEVELS.filter((level) => level % 20 === 0).flatMap((level) => (
      ARMOR_SLOTS.map((slot) => createArmor(archetype, slot, level))
    ))
  )),
  ...EQUIPMENT_LEVELS
    .filter((level) => level % 20 === 0)
    .flatMap((level) => [
      createCommonEquipment('cape', level),
      createCommonEquipment('earrings', level)
    ]),
  ...BOSS_ENDGAME_WEAPONS
].map((item) => Object.freeze(item)));

function getEquipmentDropsForMonsterLevel(monsterLevel) {
  const level = Math.max(1, Math.floor(Number(monsterLevel) || 1));
  const eligible = EQUIPMENT_ITEMS
    .filter((item) => {
      if (item.bossDropOnly) return false;
      const requiredLevel = Number(item.requiredLevel || item.requirements?.level) || 1;
      return requiredLevel <= level + 2 && requiredLevel >= Math.max(1, level - 14);
    })
    .sort((left, right) => (
      Math.abs(Number(left.requiredLevel) - level) - Math.abs(Number(right.requiredLevel) - level)
      || String(left.id).localeCompare(String(right.id))
    ));
  const archetypes = ['warrior', 'archer', 'thief', 'mage'];
  const groups = Object.fromEntries(archetypes.map((archetype) => [
    archetype,
    eligible.filter((item) => (
      item.requirements?.archetype === archetype
      || item.requirements?.allowedArchetypes?.includes(archetype)
    ))
  ]));
  const selected = [];
  const selectedIds = new Set();
  for (let round = 0; selected.length < 12; round += 1) {
    let added = false;
    for (let offset = 0; offset < archetypes.length && selected.length < 12; offset += 1) {
      const archetype = archetypes[(offset + level) % archetypes.length];
      const candidate = groups[archetype][round];
      if (!candidate || selectedIds.has(candidate.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      added = true;
    }
    if (!added) break;
  }
  for (const candidate of eligible) {
    if (selected.length >= 12) break;
    if (selectedIds.has(candidate.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.id);
  }
  return selected
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      quantity: 1,
      chance: item.dropChance,
      archetype: item.requirements?.archetype || '',
      equipmentSlot: item.equipmentSlot,
      baseStats: { ...(item.stats || {}) }
    }));
}

module.exports = {
  DROP_RATE_MIN,
  DROP_RATE_MAX,
  EQUIPMENT_LEVELS,
  EQUIPMENT_ITEMS,
  STARTER_DROP_ITEMS,
  BOSS_ENDGAME_WEAPONS,
  getEquipmentSellPrice,
  rollEquipmentInstanceData,
  getEquipmentDropsForMonsterLevel
};
