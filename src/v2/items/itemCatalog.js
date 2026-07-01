'use strict';

const INVENTORY_CATEGORIES = Object.freeze({
  equipment: Object.freeze({ key: 'equipment', label: '장비', icon: '⚔️' }),
  consumable: Object.freeze({ key: 'consumable', label: '소비', icon: '🧪' }),
  misc: Object.freeze({ key: 'misc', label: '기타', icon: '📦' }),
  cash: Object.freeze({ key: 'cash', label: '캐쉬', icon: '💳' })
});

const ITEM_CATALOG = Object.freeze({
  hard_candy: Object.freeze({
    id: 'hard_candy',
    name: '알사탕',
    category: 'consumable',
    itemType: 'potion',
    icon: '🍬',
    resource: 'hp',
    restoreAmount: 50,
    maxStack: 100,
    description: '사용 즉시 체력을 50 회복합니다.',
    adminGrantOnly: true
  }),
  bacchus: Object.freeze({
    id: 'bacchus',
    name: '박카스',
    category: 'consumable',
    itemType: 'potion',
    icon: '🧃',
    resource: 'mp',
    restoreAmount: 80,
    maxStack: 100,
    description: '사용 즉시 정신력을 80 회복합니다.',
    adminGrantOnly: true
  }),
  inventory_expansion_ticket: Object.freeze({
    id: 'inventory_expansion_ticket',
    name: '인벤토리 확장권',
    category: 'cash',
    itemType: 'inventory-expansion',
    icon: '🎟️',
    maxStack: 100,
    description: '원하는 인벤토리 탭의 슬롯을 4칸 확장합니다. 탭별 최대 64칸까지 확장할 수 있습니다.',
    adminGrantOnly: true
  })
});

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

module.exports = {
  INVENTORY_CATEGORIES,
  ITEM_CATALOG,
  getItemDefinition,
  getInventoryCategory,
  listItemDefinitions,
  listAdminGrantItems
};
