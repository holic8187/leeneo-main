'use strict';

const { MONSTER_CATALOG } = require('../world/monsterCatalog');
const { applyWeaponRequirements } = require('./weaponRequirements');
const { EQUIPMENT_ITEMS } = require('./equipmentCatalog');
const {
  EQUIPMENT_SCROLLS,
  getDefaultUpgradeSlots
} = require('./scrollCatalog');

const INVENTORY_CATEGORIES = Object.freeze({
  equipment: Object.freeze({ key: 'equipment', label: '장비', icon: '🛡️' }),
  consumable: Object.freeze({ key: 'consumable', label: '소비', icon: '🧃' }),
  misc: Object.freeze({ key: 'misc', label: '기타', icon: '📦' }),
  cash: Object.freeze({ key: 'cash', label: '캐쉬', icon: '🎟️' })
});

function createEventWeapon({
  id,
  name,
  icon,
  weaponType,
  attackSpeedMultiplier,
  stats,
  archetype
}) {
  const item = applyWeaponRequirements({
    id,
    name,
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: 1,
    stats: { ...(stats || { attack: 20 }) },
    attackSpeedMultiplier,
    maxStack: 1,
    sellPrice: 1,
    description: `직업 체험용 무기입니다. 공격력 ${Number(stats?.attack) || 0}, 마력 ${Number(stats?.magic) || 0}, 공격 시전 속도 ${attackSpeedMultiplier}배.`,
    adminGrantOnly: true,
    eventItem: true
  });
  item.upgradeSlots = getDefaultUpgradeSlots(item);
  item.requirements = {
    level: 1,
    stats: {},
    archetype,
    allowedArchetypes: [archetype]
  };
  return item;
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
    adminGrantOnly: true,
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
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
    adminGrantOnly: true,
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  red_potion: {
    id: 'red_potion', name: '빨간 포션', category: 'consumable', itemType: 'potion',
    icon: '🧪', resource: 'hp', restoreAmount: 50, maxStack: 100,
    buyPrice: 50, sellPrice: 25, description: '체력을 50 회복합니다.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  orange_potion: {
    id: 'orange_potion', name: '주황 포션', category: 'consumable', itemType: 'potion',
    icon: '🧃', resource: 'hp', restoreAmount: 150, maxStack: 100,
    buyPrice: 150, sellPrice: 75, description: '체력을 150 회복합니다.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  white_potion: {
    id: 'white_potion', name: '하얀 포션', category: 'consumable', itemType: 'potion',
    icon: '🥛', resource: 'hp', restoreAmount: 300, maxStack: 100,
    buyPrice: 300, sellPrice: 150, description: '체력을 300 회복합니다.',
    shopTags: ['personnel_annex', 'sales_outpost']
  },
  grilled_eel: {
    id: 'grilled_eel', name: '장어구이', category: 'consumable', itemType: 'potion',
    icon: '🍱', resource: 'hp', restoreAmount: 1_000, maxStack: 100,
    buyPrice: 1_000, sellPrice: 500, description: '체력을 1,000 회복합니다.',
    shopTags: ['sales_outpost']
  },
  reindeer_milk: {
    id: 'reindeer_milk', name: '순록의 우유', category: 'consumable', itemType: 'potion',
    icon: '🥛', resource: 'hp', restoreAmount: 5_000, maxStack: 100,
    buyPrice: 5_000, sellPrice: 2_500, description: '체력을 5,000 회복합니다.',
    shopTags: ['sales_outpost']
  },
  blue_potion: {
    id: 'blue_potion', name: '파란 포션', category: 'consumable', itemType: 'potion',
    icon: '🧴', resource: 'mp', restoreAmount: 100, maxStack: 100,
    buyPrice: 200, sellPrice: 100, description: '정신력을 100 회복합니다.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  mana_elixir: {
    id: 'mana_elixir', name: '마나 엘릭서', category: 'consumable', itemType: 'potion',
    icon: '🔷', resource: 'mp', restoreAmount: 300, maxStack: 100,
    buyPrice: 600, sellPrice: 300, description: '정신력을 300 회복합니다.',
    shopTags: ['personnel_annex', 'sales_outpost']
  },
  pure_water: {
    id: 'pure_water', name: '맑은 물', category: 'consumable', itemType: 'potion',
    icon: '💧', resource: 'mp', restoreAmount: 800, maxStack: 100,
    buyPrice: 1_600, sellPrice: 800, description: '정신력을 800 회복합니다.',
    shopTags: ['sales_outpost']
  },
  sunrise_dew: {
    id: 'sunrise_dew', name: '새벽의 이슬', category: 'consumable', itemType: 'potion',
    icon: '🌅', resource: 'mp', restoreAmount: 4_000, maxStack: 100,
    buyPrice: 8_000, sellPrice: 4_000, description: '정신력을 4,000 회복합니다.',
    shopTags: ['sales_outpost']
  },
  sunset_dew: {
    id: 'sunset_dew', name: '황혼의 이슬', category: 'consumable', itemType: 'potion',
    icon: '🌇', resource: 'mp', restoreAmount: 5_000, maxStack: 100,
    buyPrice: 10_000, sellPrice: 5_000, description: '정신력을 5,000 회복합니다.',
    shopTags: ['sales_outpost']
  },
  safe_zone_return_scroll: {
    id: 'safe_zone_return_scroll',
    name: '안전지대 귀환서',
    category: 'consumable',
    itemType: 'return-scroll',
    icon: '📜',
    maxStack: 100,
    buyPrice: 800,
    sellPrice: 400,
    description: '더블클릭하면 현재 위치에서 가장 가까운 안전지대로 즉시 이동합니다.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  basic_arrow: {
    id: 'basic_arrow',
    name: '보급형 화살',
    category: 'consumable',
    itemType: 'ammunition',
    ammunitionType: 'arrow',
    icon: '🏹',
    attackBonus: 2,
    maxStack: 400,
    purchaseQuantity: 400,
    buyPrice: 3_000,
    sellPrice: 0,
    description: '활과 석궁 공격에 사용합니다. 공격력 +2, 한 묶음 400개.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  crude_throwing_star: {
    id: 'crude_throwing_star',
    name: '허접표창',
    category: 'consumable',
    itemType: 'ammunition',
    ammunitionType: 'throwing-star',
    icon: '✴️',
    attackBonus: 15,
    maxStack: 600,
    purchaseQuantity: 600,
    buyPrice: 500,
    sellPrice: 0,
    description: '아대 공격에 사용합니다. 공격력 +15, 한 묶음 600개.',
    shopTags: ['headquarters', 'personnel_annex', 'sales_outpost']
  },
  experience_coupon_2x_15m: {
    id: 'experience_coupon_2x_15m',
    name: '경험치 2배 쿠폰 (15분)',
    category: 'cash',
    itemType: 'experience-buff',
    icon: '🎟️',
    maxStack: 100,
    durationSeconds: 900,
    experienceBonusPercent: 100,
    description: '사용 후 15분 동안 획득 경험치가 2배가 됩니다.',
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
    expiresAfterSeconds: 72 * 60 * 60,
    description: '현재 전직 차수를 유지한 채 보직을 변경합니다. 투자한 스탯과 스킬 포인트는 모두 초기화되어 환급됩니다. 받은 뒤 72시간 후 사라집니다.',
    adminGrantOnly: true
  },
  stat_reset_coupon: {
    id: 'stat_reset_coupon',
    name: '스탯 초기화 쿠폰',
    category: 'cash',
    itemType: 'stat-reset',
    icon: '🧾',
    maxStack: 100,
    description: '투자한 스탯만 초기화하고 사용 가능한 스탯 포인트로 돌려받습니다.',
    adminGrantOnly: true
  },
  level_up_coupon: {
    id: 'level_up_coupon',
    name: '레벨업 쿠폰',
    category: 'cash',
    itemType: 'level-up',
    icon: '⬆️',
    maxStack: 100,
    sellPrice: 0,
    tradeable: false,
    description: '현재 경험치와 관계없이 정확히 1레벨 상승하고 경험치는 0%가 됩니다. 만렙에서는 사용할 수 없습니다.',
    adminGrantOnly: true
  },
  settlement_event_coin: {
    id: 'settlement_event_coin',
    name: '정착 지원 이벤트 코인',
    category: 'misc',
    itemType: 'event-currency',
    icon: '🪙',
    maxStack: 100,
    sellPrice: 0,
    tradeable: false,
    description: '정착 지원 이벤트 상점에서 사용하는 코인입니다. 하루 최대 200개까지 획득할 수 있습니다.'
  },
  event_experience_coupon_2x_15m: {
    id: 'event_experience_coupon_2x_15m',
    name: '정착 지원 경험치 2배 쿠폰 (15분)',
    category: 'consumable',
    itemType: 'experience-buff',
    icon: '🎟️',
    maxStack: 100,
    durationSeconds: 900,
    experienceBonusPercent: 100,
    expiresAfterSeconds: 7 * 24 * 60 * 60,
    tradeable: false,
    sellPrice: 0,
    description: '사용 후 15분 동안 획득 경험치가 2배가 됩니다. 구매 후 7일 안에 사용해야 합니다.'
  },
  blessed_settlement_necklace: {
    id: 'blessed_settlement_necklace',
    name: '축복받은 목걸이',
    category: 'equipment',
    itemType: 'accessory',
    equipmentSlot: 'necklace',
    icon: '📿',
    requiredLevel: 5,
    requirements: {
      level: 5,
      stats: {},
      archetype: '',
      allowedArchetypes: ['warrior', 'archer', 'thief', 'mage']
    },
    stats: {
      grit: 4,
      processingSpeed: 4,
      workKnowledge: 4,
      awareness: 4,
      defense: 30,
      maxHp: 50,
      movementSpeed: 10
    },
    upgradeSlots: 3,
    maxStack: 1,
    sellPrice: 1,
    tradeable: false,
    acquisitionSource: 'settlement-event-shop',
    dropEligible: false,
    description: '정착 지원 이벤트에서 획득하는 전 직업 공용 목걸이입니다.'
  },
  settlement_support_ring: {
    id: 'settlement_support_ring',
    name: '정착 지원 반지',
    category: 'equipment',
    itemType: 'accessory',
    equipmentSlot: 'ring',
    icon: '💍',
    requiredLevel: 1,
    requirements: {
      level: 1,
      stats: {},
      archetype: '',
      allowedArchetypes: ['warrior', 'archer', 'thief', 'mage']
    },
    stats: {
      attack: 40,
      magic: 80,
      grit: 5,
      processingSpeed: 5,
      workKnowledge: 5,
      awareness: 5
    },
    upgradeSlots: 0,
    maxStack: 1,
    sellPrice: 0,
    tradeable: false,
    fixedExpiresAt: '2026-08-01T00:00:00+09:00',
    acquisitionSource: 'settlement-event-shop',
    dropEligible: false,
    description: '계정당 한 번 무료로 받는 기간제 전직업 공용 반지입니다. 2026년 7월 31일 이후 사라집니다.'
  },
  event_blessed_necklace_scroll_60: {
    id: 'event_blessed_necklace_scroll_60',
    name: '이벤트 목걸이 전용 주문서 60%',
    category: 'consumable',
    itemType: 'equipment-scroll',
    icon: '📜',
    maxStack: 100,
    sellPrice: 1,
    tradeable: false,
    successRate: 60,
    scrollStats: {
      grit: 2,
      processingSpeed: 2,
      workKnowledge: 2,
      awareness: 2
    },
    applicableSlot: 'necklace',
    specialEquipmentId: 'blessed_settlement_necklace',
    description: '축복받은 목걸이에만 사용할 수 있습니다. 성공 시 STR/DEX/INT/LUK +2.'
  },
  event_stat_reset_coupon: {
    id: 'event_stat_reset_coupon',
    name: '정착 지원 스탯 초기화 쿠폰',
    category: 'consumable',
    itemType: 'stat-reset',
    icon: '🧾',
    maxStack: 100,
    fixedExpiresAt: '2026-08-01T00:00:00+09:00',
    tradeable: false,
    sellPrice: 1,
    description: '투자한 스탯을 초기화합니다. 2026년 7월 31일 이후 사라집니다.'
  },
  hunting_time_180m: {
    id: 'hunting_time_180m',
    name: '자동사냥 시간 180분',
    category: 'cash',
    itemType: 'hunting-time',
    icon: '⏱️',
    maxStack: 100,
    huntingMinutes: 180,
    description: '사용 시 자동사냥 시간을 180분 충전합니다. 보유 시간은 최대 400분입니다.',
    adminGrantOnly: true
  },
  event_two_handed_sword: createEventWeapon({
    id: 'event_two_handed_sword',
    name: '체험용 두손검',
    icon: '🗡️',
    weaponType: 'twoHandedSword',
    attackSpeedMultiplier: 1,
    archetype: 'warrior'
  }),
  event_one_handed_sword: createEventWeapon({
    id: 'event_one_handed_sword',
    name: '체험용 한손검',
    icon: '⚔️',
    weaponType: 'oneHandedSword',
    attackSpeedMultiplier: 1.2,
    archetype: 'warrior'
  }),
  event_one_handed_axe: createEventWeapon({
    id: 'event_one_handed_axe',
    name: '체험용 한손도끼',
    icon: '🪓',
    weaponType: 'oneHandedAxe',
    attackSpeedMultiplier: 1,
    archetype: 'warrior'
  }),
  event_two_handed_axe: createEventWeapon({
    id: 'event_two_handed_axe',
    name: '체험용 두손도끼',
    icon: '🪓',
    weaponType: 'twoHandedAxe',
    attackSpeedMultiplier: 0.8,
    archetype: 'warrior'
  }),
  event_spear: createEventWeapon({
    id: 'event_spear',
    name: '체험용 창',
    icon: '🔱',
    weaponType: 'spear',
    attackSpeedMultiplier: 0.6,
    archetype: 'warrior'
  }),
  event_polearm: createEventWeapon({
    id: 'event_polearm',
    name: '체험용 폴암',
    icon: '⚜️',
    weaponType: 'polearm',
    attackSpeedMultiplier: 0.6,
    archetype: 'warrior'
  }),
  event_bow: createEventWeapon({
    id: 'event_bow', name: '체험용 활', icon: '🏹', weaponType: 'bow',
    attackSpeedMultiplier: 1, stats: { attack: 20 }, archetype: 'archer'
  }),
  event_crossbow: createEventWeapon({
    id: 'event_crossbow', name: '체험용 석궁', icon: '🎯', weaponType: 'crossbow',
    attackSpeedMultiplier: 0.9, stats: { attack: 21 }, archetype: 'archer'
  }),
  event_claw: createEventWeapon({
    id: 'event_claw', name: '체험용 아대', icon: '✴️', weaponType: 'claw',
    attackSpeedMultiplier: 1.15, stats: { attack: 18 }, archetype: 'thief'
  }),
  event_dagger: createEventWeapon({
    id: 'event_dagger', name: '체험용 단검', icon: '🗡️', weaponType: 'dagger',
    attackSpeedMultiplier: 1.1, stats: { attack: 20 }, archetype: 'thief'
  }),
  event_wand: createEventWeapon({
    id: 'event_wand', name: '체험용 완드', icon: '🪄', weaponType: 'wand',
    attackSpeedMultiplier: 1.1, stats: { attack: 6, magic: 20 }, archetype: 'mage'
  }),
  event_staff: createEventWeapon({
    id: 'event_staff', name: '체험용 스태프', icon: '🔮', weaponType: 'staff',
    attackSpeedMultiplier: 0.9, stats: { attack: 8, magic: 22 }, archetype: 'mage'
  })
};

for (const item of EQUIPMENT_ITEMS) {
  BASE_ITEMS[item.id] = {
    ...item,
    upgradeSlots: getDefaultUpgradeSlots(item)
  };
}

for (const scroll of EQUIPMENT_SCROLLS) {
  BASE_ITEMS[scroll.id] = { ...scroll };
}

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
  Object.entries(BASE_ITEMS).map(([key, item]) => [key, Object.freeze({
    ...item,
    tradeable: item.tradeable == null ? item.category !== 'cash' : Boolean(item.tradeable)
  })])
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

function listShopItems(shopId) {
  return listItemDefinitions().filter((item) => (
    Number(item.buyPrice) > 0
    && (!shopId || item.shopTags?.includes(shopId))
  ));
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
