'use strict';

const EQUIPMENT_SCROLL_DROP_MULTIPLIER = 2 / 3;

const STAT_LABELS = Object.freeze({
  attack: '물리공격력',
  magic: '마법공격력',
  grit: 'STR',
  processingSpeed: 'DEX',
  workKnowledge: 'INT',
  awareness: 'LUK',
  defense: '물리방어력',
  magicDefense: '마법방어력',
  maxHp: 'HP',
  maxMp: 'MP',
  accuracy: '명중률',
  evasion: '회피율',
  movementSpeed: '이동속도',
  jump: '점프력'
});

const SLOT_SCROLL_GROUPS = Object.freeze([
  ['gloves', '장갑', [
    ['공격력', { 10: { attack: 3 }, 60: { attack: 2 }, 100: { attack: 1 } }],
    ['민첩성', { 10: { accuracy: 5, processingSpeed: 3, evasion: 1 }, 60: { accuracy: 2, processingSpeed: 1 }, 100: { accuracy: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 15 }, 100: { maxHp: 5 } }]
  ]],
  ['helmet', '투구', [
    ['민첩성', { 10: { processingSpeed: 3 }, 60: { processingSpeed: 2 }, 100: { processingSpeed: 1 } }],
    ['방어력', { 10: { defense: 5, magicDefense: 3, accuracy: 1 }, 60: { defense: 2, magicDefense: 1 }, 100: { defense: 1 } }],
    ['지력', { 10: { workKnowledge: 3 }, 60: { workKnowledge: 2 }, 100: { workKnowledge: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 10 }, 100: { maxHp: 5 } }]
  ]],
  ['top', '상의', [
    ['방어력', { 10: { defense: 5, magicDefense: 3, maxHp: 10 }, 60: { defense: 2, magicDefense: 1 }, 100: { defense: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 15 }, 100: { maxHp: 5 } }],
    ['행운', { 10: { awareness: 3 }, 60: { awareness: 2 }, 100: { awareness: 1 } }],
    ['힘', { 10: { grit: 3 }, 60: { grit: 2 }, 100: { grit: 1 } }]
  ]],
  ['bottom', '하의', [
    ['민첩성', { 10: { processingSpeed: 3, accuracy: 2, movementSpeed: 1 }, 60: { processingSpeed: 2, accuracy: 1 }, 100: { processingSpeed: 1 } }],
    ['방어력', { 10: { defense: 5, magicDefense: 3, maxHp: 10 }, 60: { defense: 2, magicDefense: 1 }, 100: { defense: 1 } }],
    ['점프', { 10: { jump: 4, evasion: 2 }, 60: { jump: 2, evasion: 1 }, 100: { jump: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 10 }, 100: { maxHp: 5 } }]
  ]],
  ['shoes', '신발', [
    ['민첩성', { 10: { evasion: 5, accuracy: 3, movementSpeed: 1 }, 60: { evasion: 2, accuracy: 1 }, 100: { evasion: 1 } }],
    ['이동속도', { 10: { movementSpeed: 3 }, 60: { movementSpeed: 2 }, 100: { movementSpeed: 1 } }],
    ['점프력', { 10: { jump: 5, processingSpeed: 3, movementSpeed: 1 }, 60: { jump: 2, processingSpeed: 1 }, 100: { jump: 1 } }]
  ]],
  ['earrings', '귀 장식', [
    ['민첩', { 10: { processingSpeed: 3 }, 60: { processingSpeed: 2 }, 100: { processingSpeed: 1 } }],
    ['지력', { 10: { magic: 5, workKnowledge: 3, magicDefense: 1 }, 60: { magic: 2, workKnowledge: 1 }, 100: { magic: 1 } }],
    ['행운', { 10: { awareness: 3 }, 60: { awareness: 2 }, 100: { awareness: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 15 }, 100: { maxHp: 5 } }]
  ]],
  ['cape', '망토', [
    ['마나', { 10: { maxMp: 20 }, 60: { maxMp: 10 }, 100: { maxMp: 5 } }],
    ['마법방어력', { 10: { defense: 3, magicDefense: 5, maxMp: 10 }, 60: { defense: 1, magicDefense: 3 }, 100: { magicDefense: 1 } }],
    ['물리방어력', { 10: { defense: 5, magicDefense: 3, maxHp: 10 }, 60: { defense: 3, magicDefense: 1 }, 100: { defense: 1 } }],
    ['민첩', { 10: { processingSpeed: 3 }, 60: { processingSpeed: 2 }, 100: { processingSpeed: 1 } }],
    ['지력', { 10: { workKnowledge: 3 }, 60: { workKnowledge: 2 }, 100: { workKnowledge: 1 } }],
    ['체력', { 10: { maxHp: 20 }, 60: { maxHp: 10 }, 100: { maxHp: 5 } }],
    ['행운', { 10: { awareness: 3 }, 60: { awareness: 2 }, 100: { awareness: 1 } }],
    ['힘', { 10: { grit: 3 }, 60: { grit: 2 }, 100: { grit: 1 } }]
  ]],
  ['shield', '방패', [
    ['방어력', { 10: { defense: 5, magicDefense: 3, maxHp: 10 }, 60: { defense: 2, magicDefense: 1 }, 100: { defense: 1 } }],
    ['체력', { 10: { maxHp: 30 }, 60: { maxHp: 15 }, 100: { maxHp: 5 } }],
    ['행운', { 10: { awareness: 3 }, 60: { awareness: 2 }, 100: { awareness: 1 } }],
    ['힘', { 10: { grit: 3 }, 60: { grit: 2 }, 100: { grit: 1 } }]
  ]]
]);

const WEAPON_SCROLL_GROUPS = Object.freeze([
  ['oneHandedSword', '한손검', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['oneHandedSword', '한손검', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['oneHandedAxe', '한손도끼', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['oneHandedAxe', '한손도끼', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['oneHandedBlunt', '한손둔기', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['oneHandedBlunt', '한손둔기', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['twoHandedSword', '두손검', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['twoHandedSword', '두손검', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['twoHandedAxe', '두손도끼', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['twoHandedAxe', '두손도끼', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['twoHandedBlunt', '두손둔기', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['twoHandedBlunt', '두손둔기', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['spear', '창', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['spear', '창', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['polearm', '폴암', '공격력', { 10: { attack: 5, grit: 3, defense: 1 }, 60: { attack: 2, grit: 1 }, 100: { attack: 1 } }],
  ['polearm', '폴암', '명중률', { 10: { accuracy: 5, attack: 3, processingSpeed: 3 }, 60: { accuracy: 3, attack: 1, processingSpeed: 2 }, 100: { accuracy: 1 } }],
  ['claw', '아대', '공격력', { 10: { attack: 5, accuracy: 3, awareness: 1 }, 60: { attack: 2, accuracy: 1 }, 100: { attack: 1 } }],
  ['dagger', '단검', '공격력', { 10: { attack: 5, awareness: 3, defense: 1 }, 60: { attack: 2, awareness: 1 }, 100: { attack: 1 } }],
  ['bow', '활', '공격력', { 10: { attack: 5, accuracy: 3, processingSpeed: 1 }, 60: { attack: 2, accuracy: 1 }, 100: { attack: 1 } }],
  ['crossbow', '석궁', '공격력', { 10: { attack: 5, accuracy: 3, processingSpeed: 1 }, 60: { attack: 2, accuracy: 1 }, 100: { attack: 1 } }],
  ['wand', '완드', '마력', { 10: { magic: 5, workKnowledge: 3, magicDefense: 1 }, 60: { magic: 2, workKnowledge: 1 }, 100: { magic: 1 } }],
  ['staff', '스태프', '마력', { 10: { magic: 5, workKnowledge: 3, magicDefense: 1 }, 60: { magic: 2, workKnowledge: 1 }, 100: { magic: 1 } }]
]);

function slug(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_');
}

function statDescription(stats) {
  return Object.entries(stats)
    .map(([key, value]) => `${STAT_LABELS[key] || key} +${value}`)
    .join(', ');
}

function isSinglePointStatScroll(stats, statKey) {
  const entries = Object.entries(stats || {});
  return entries.length === 1
    && entries[0][0] === statKey
    && Number(entries[0][1]) === 1;
}

function createScroll({ baseName, rate, stats, equipmentSlot = '', weaponType = '', idPrefix, groupKey }) {
  const isBasicWeapon100 = equipmentSlot === 'weapon'
    && Number(rate) === 100
    && (
      isSinglePointStatScroll(stats, 'attack')
      || isSinglePointStatScroll(stats, 'magic')
    );
  return {
    id: `scroll_${slug(idPrefix)}_${rate}`,
    name: `${baseName} 주문서 ${rate}%`,
    category: 'consumable',
    itemType: 'equipment-scroll',
    icon: '📜',
    maxStack: 100,
    ...(isBasicWeapon100 ? { buyPrice: 200_000, shopTags: ['scroll_vendor'] } : {}),
    sellPrice: 100,
    successRate: rate,
    scrollGroupKey: groupKey || idPrefix,
    scrollStats: Object.freeze({ ...stats }),
    applicableSlot: equipmentSlot,
    applicableWeaponType: weaponType,
    description: `강화 성공 시 ${statDescription(stats)}. 성공 확률 ${rate}%.`
  };
}

const scrolls = [];
for (const [slot, slotName, groups] of SLOT_SCROLL_GROUPS) {
  for (const [effectName, rates] of groups) {
    for (const rate of [10, 60, 100]) {
      scrolls.push(createScroll({
        baseName: `${slotName} ${effectName}`,
        rate,
        stats: rates[rate],
        equipmentSlot: slot,
        idPrefix: `${slot}_${effectName}`,
        groupKey: `${slot}_${effectName}`
      }));
    }
  }
}
for (const [weaponType, weaponName, effectName, rates] of WEAPON_SCROLL_GROUPS) {
  for (const rate of [10, 60, 100]) {
    scrolls.push(createScroll({
      baseName: `${weaponName} ${effectName}`,
      rate,
      stats: rates[rate],
      equipmentSlot: 'weapon',
      weaponType,
      idPrefix: `${weaponType}_${effectName}`,
      groupKey: `${weaponType}_${effectName}`
    }));
  }
}

const EQUIPMENT_SCROLLS = Object.freeze(scrolls.map((scroll) => Object.freeze(scroll)));
const EQUIPMENT_SCROLL_GROUPS = (() => {
  const groups = new Map();
  for (const scroll of EQUIPMENT_SCROLLS) {
    const key = scroll.scrollGroupKey || scroll.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scroll);
  }
  return Object.freeze([...groups.values()].map((group) => Object.freeze(
    [...group].sort((left, right) => Number(left.successRate) - Number(right.successRate))
  )));
})();

function getScrollsForMonster(monsterId) {
  let hash = 0;
  for (const character of String(monsterId)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const count = 1 + hash % 3;
  const selected = [];
  const usedIndexes = new Set();
  for (let index = 0; index < count && usedIndexes.size < EQUIPMENT_SCROLLS.length; index += 1) {
    let scrollIndex = (hash + index * 37) % EQUIPMENT_SCROLLS.length;
    while (usedIndexes.has(scrollIndex)) {
      scrollIndex = (scrollIndex + 1) % EQUIPMENT_SCROLLS.length;
    }
    usedIndexes.add(scrollIndex);
    const scroll = EQUIPMENT_SCROLLS[scrollIndex];
    const chance = (0.00002 + ((hash + index) % 7) * 0.00001) * EQUIPMENT_SCROLL_DROP_MULTIPLIER;
    selected.push({
      itemId: scroll.id,
      name: scroll.name,
      icon: scroll.icon,
      quantity: 1,
      chance
    });
  }
  return selected;
}

function isScrollApplicable(scroll, equipment) {
  if (!scroll || scroll.itemType !== 'equipment-scroll' || !equipment) return false;
  if (scroll.specialEquipmentId) return scroll.specialEquipmentId === equipment.itemId;
  if (scroll.applicableSlot && scroll.applicableSlot !== equipment.equipmentSlot) return false;
  return !scroll.applicableWeaponType || scroll.applicableWeaponType === equipment.weaponType;
}

function getDefaultUpgradeSlots(equipment = {}) {
  const slot = String(equipment.equipmentSlot || '');
  if (slot === 'weapon') return 7;
  if (slot === 'helmet') return 10;
  if (slot === 'necklace') return 3;
  return equipment.category === 'equipment' ? 5 : 0;
}

module.exports = {
  EQUIPMENT_SCROLL_DROP_MULTIPLIER,
  EQUIPMENT_SCROLLS,
  STAT_LABELS,
  getScrollsForMonster,
  getDefaultUpgradeSlots,
  isScrollApplicable,
  statDescription
};
