'use strict';

const { MONSTER_CATALOG } = require('../world/monsterCatalog');
const { applyWeaponRequirements } = require('./weaponRequirements');

const INVENTORY_CATEGORIES = Object.freeze({
  equipment: Object.freeze({ key: 'equipment', label: '장비', icon: '🛡️' }),
  consumable: Object.freeze({ key: 'consumable', label: '소비', icon: '🧃' }),
  misc: Object.freeze({ key: 'misc', label: '기타', icon: '📦' }),
  cash: Object.freeze({ key: 'cash', label: '캐쉬', icon: '🎟️' })
});

function createEventWarriorWeapon({
  id,
  name,
  icon,
  weaponType,
  attackSpeedMultiplier
}) {
  return applyWeaponRequirements({
    id,
    name,
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: 1,
    stats: { attack: 20 },
    attackSpeedMultiplier,
    maxStack: 1,
    sellPrice: 1,
    description: `전사용 체험 무기입니다. 공격력 20, 공격 시전 속도 ${attackSpeedMultiplier}배.`,
    adminGrantOnly: true,
    eventItem: true
  });
}

const BASE_ITEMS = {
  hard_candy: {
    id: 'hard_candy',
    name: '알사탕',
    category: 'consumable',
    itemType: 'potion',
    icon: '🍬',
    resource: 'hp',
    restoreAmount: 50,
    maxStack: 100,
    buyPrice: 50,
    sellPrice: 25,
    description: '사용 즉시 체력을 50 회복합니다.',
    adminGrantOnly: true
  },
  bacchus: {
    id: 'bacchus',
    name: '박카스',
    category: 'consumable',
    itemType: 'potion',
    icon: '🧃',
    resource: 'mp',
    restoreAmount: 80,
    maxStack: 100,
    buyPrice: 200,
    sellPrice: 100,
    description: '사용 즉시 정신력을 80 회복합니다.',
    adminGrantOnly: true
  },
  inventory_expansion_ticket: {
    id: 'inventory_expansion_ticket',
    name: '인벤토리 확장권',
    category: 'cash',
    itemType: 'inventory-expansion',
    icon: '🎫',
    maxStack: 100,
    description: '원하는 인벤토리 탭의 슬롯을 4칸 확장합니다. 탭별 최대 64칸까지 확장할 수 있습니다.',
    adminGrantOnly: true
  },
  job_change_ticket: {
    id: 'job_change_ticket',
    name: '이직 쿠폰',
    category: 'cash',
    itemType: 'job-change',
    icon: '🔄',
    maxStack: 100,
    description: '현재 전직 차수를 유지한 채 보직을 변경합니다. 투자한 스탯과 스킬 포인트는 모두 초기화되어 환급됩니다.',
    adminGrantOnly: true
  },
  event_two_handed_sword: createEventWarriorWeapon({
    id: 'event_two_handed_sword',
    name: '체험용 두손검',
    icon: '🗡️',
    weaponType: 'twoHandedSword',
    attackSpeedMultiplier: 1
  }),
  event_one_handed_sword: createEventWarriorWeapon({
    id: 'event_one_handed_sword',
    name: '체험용 한손검',
    icon: '⚔️',
    weaponType: 'oneHandedSword',
    attackSpeedMultiplier: 1.2
  }),
  event_one_handed_axe: createEventWarriorWeapon({
    id: 'event_one_handed_axe',
    name: '체험용 한손도끼',
    icon: '🪓',
    weaponType: 'oneHandedAxe',
    attackSpeedMultiplier: 1
  }),
  event_two_handed_axe: createEventWarriorWeapon({
    id: 'event_two_handed_axe',
    name: '체험용 두손도끼',
    icon: '🪓',
    weaponType: 'twoHandedAxe',
    attackSpeedMultiplier: 0.8
  }),
  event_spear: createEventWarriorWeapon({
    id: 'event_spear',
    name: '체험용 창',
    icon: '🔱',
    weaponType: 'spear',
    attackSpeedMultiplier: 0.6
  }),
  event_polearm: createEventWarriorWeapon({
    id: 'event_polearm',
    name: '체험용 폴암',
    icon: '⚜️',
    weaponType: 'polearm',
    attackSpeedMultiplier: 0.6
  })
};

for (const monster of MONSTER_CATALOG) {
  BASE_ITEMS[monster.lootItemId] = {
    id: monster.lootItemId,
    name: monster.lootName,
    category: 'misc',
    itemType: 'monster-loot',
    icon: monster.lootIcon,
    maxStack: 100,
    sellPrice: Math.max(1, Math.floor(monster.level * 2)),
    description: `${monster.name}이 남긴 잡템입니다. 퀘스트 재료로 쓰거나 상점에 판매할 수 있습니다.`,
    adminGrantOnly: false
  };
}

const ITEM_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(BASE_ITEMS).map(([key, item]) => [key, Object.freeze(item)])
));

function getItemDefinition(itemId) {
  return ITEM_CATALOG[String(itemId || '')] || null;
}

function getInventoryCategory(category) {
  return INVENTORY_CATEGORIES[String(category || '')] || null;
}

function listItemDefinitions() {
  return Object.values(ITEM_CATALOG).map((item) => ({ ...item }));
}

function listAdminGrantItems() {
  return listItemDefinitions().filter((item) => item.adminGrantOnly);
}

function listShopItems() {
  return listItemDefinitions().filter((item) => Number(item.buyPrice) > 0);
}

module.exports = {
  INVENTORY_CATEGORIES,
  ITEM_CATALOG,
  getItemDefinition,
  getInventoryCategory,
  listItemDefinitions,
  listAdminGrantItems,
  listShopItems
};
