'use strict';

const crypto = require('crypto');
const {
  INVENTORY_CATEGORIES,
  getItemDefinition,
  getInventoryCategory
} = require('../items/itemCatalog');

const DEFAULT_INVENTORY_CAPACITY = 20;
const MAX_INVENTORY_CAPACITY = 64;
const INVENTORY_EXPANSION_SIZE = 4;
const INVENTORY_EXPANSION_TICKET_ID = 'inventory_expansion_ticket';

const QUICK_SLOT_RESOURCES = Object.freeze({
  hp: 'hp',
  mp: 'mp'
});

function markInventoryModified(character) {
  if (typeof character?.markModified !== 'function') return;
  character.markModified('inventory');
  character.markModified('mailbox');
  character.markModified('resources');
}

function mergeStack(entries, itemId, quantity) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!safeQuantity) return;
  const stack = entries.find((entry) => String(entry.itemId) === String(itemId));
  if (stack) {
    stack.quantity = Math.max(0, Math.floor(Number(stack.quantity) || 0)) + safeQuantity;
  } else {
    entries.push({ itemId: String(itemId), quantity: safeQuantity });
  }
}

function ensureInventory(character) {
  if (!character.inventory || typeof character.inventory !== 'object') {
    character.inventory = {};
  }
  const inventory = character.inventory;
  if (!Array.isArray(inventory.items)) inventory.items = [];

  // Automatically absorb the potion-only prototype inventory into generic stacks.
  if (Array.isArray(inventory.potions) && inventory.potions.length) {
    for (const potion of inventory.potions) {
      mergeStack(inventory.items, potion.itemId, potion.quantity);
    }
    inventory.potions = [];
    markInventoryModified(character);
  } else if (!Array.isArray(inventory.potions)) {
    inventory.potions = [];
  }

  if (!inventory.slotCapacities || typeof inventory.slotCapacities !== 'object') {
    inventory.slotCapacities = {};
  }
  for (const category of Object.keys(INVENTORY_CATEGORIES)) {
    const stored = Math.floor(Number(inventory.slotCapacities[category]) || DEFAULT_INVENTORY_CAPACITY);
    inventory.slotCapacities[category] = Math.max(
      DEFAULT_INVENTORY_CAPACITY,
      Math.min(MAX_INVENTORY_CAPACITY, stored)
    );
  }

  if (!inventory.quickSlots || typeof inventory.quickSlots !== 'object') {
    inventory.quickSlots = {};
  }
  if (typeof inventory.quickSlots.hp !== 'string') inventory.quickSlots.hp = '';
  if (typeof inventory.quickSlots.mp !== 'string') inventory.quickSlots.mp = '';
  if (!Array.isArray(character.mailbox)) character.mailbox = [];
  return inventory;
}

function getItemStack(character, itemId) {
  return ensureInventory(character).items.find(
    (entry) => String(entry.itemId) === String(itemId)
  ) || null;
}

function getUsedSlots(character, category) {
  return ensureInventory(character).items.filter((entry) => {
    const item = getItemDefinition(entry.itemId);
    return item?.category === category && Number(entry.quantity) > 0;
  }).length;
}

function assertInventorySpace(character, item) {
  if (getItemStack(character, item.id)) return;
  const inventory = ensureInventory(character);
  const capacity = inventory.slotCapacities[item.category];
  if (getUsedSlots(character, item.category) >= capacity) {
    const category = getInventoryCategory(item.category);
    throw new Error(`${category?.label || item.category} 인벤토리가 가득 찼습니다.`);
  }
}

function addInventoryItem(character, itemId, quantity) {
  const item = getItemDefinition(itemId);
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!item) throw new Error('존재하지 않는 아이템입니다.');
  if (!getInventoryCategory(item.category)) throw new Error('올바르지 않은 아이템 분류입니다.');
  if (!safeQuantity) return 0;
  assertInventorySpace(character, item);
  mergeStack(ensureInventory(character).items, item.id, safeQuantity);
  markInventoryModified(character);
  return safeQuantity;
}

function assignPotionQuickSlot(character, slot, itemId) {
  const expectedResource = QUICK_SLOT_RESOURCES[String(slot || '')];
  if (!expectedResource) throw new Error('올바르지 않은 포션 슬롯입니다.');
  const item = getItemDefinition(itemId);
  if (!item || item.itemType !== 'potion') throw new Error('포션을 찾을 수 없습니다.');
  if (item.resource !== expectedResource) {
    throw new Error(expectedResource === 'hp'
      ? '체력 포션만 왼쪽 슬롯에 설정할 수 있습니다.'
      : '정신력 포션만 오른쪽 슬롯에 설정할 수 있습니다.');
  }
  const stack = getItemStack(character, item.id);
  if (!stack || Number(stack.quantity) <= 0) throw new Error('해당 포션을 보유하고 있지 않습니다.');
  ensureInventory(character).quickSlots[slot] = item.id;
  markInventoryModified(character);
  return item;
}

function useQuickSlotPotion(character, slot) {
  const resource = QUICK_SLOT_RESOURCES[String(slot || '')];
  if (!resource) throw new Error('올바르지 않은 포션 슬롯입니다.');
  const inventory = ensureInventory(character);
  const itemId = String(inventory.quickSlots[slot] || '');
  const item = getItemDefinition(itemId);
  if (!item || item.itemType !== 'potion' || item.resource !== resource) {
    throw new Error('이 슬롯에 포션이 설정되어 있지 않습니다.');
  }
  const stack = getItemStack(character, item.id);
  if (!stack || Number(stack.quantity) <= 0) throw new Error(`${item.name}이 부족합니다.`);

  const currentKey = resource === 'hp' ? 'currentHp' : 'currentMp';
  const maxKey = resource === 'hp' ? 'maxHp' : 'maxMp';
  const current = Math.max(0, Number(character.resources?.[currentKey]) || 0);
  const maximum = Math.max(1, Number(character.resources?.[maxKey]) || 1);
  if (current >= maximum) {
    throw new Error(resource === 'hp' ? '체력이 이미 가득 찼습니다.' : '정신력이 이미 가득 찼습니다.');
  }

  stack.quantity = Math.max(0, Math.floor(Number(stack.quantity) || 0) - 1);
  const nextValue = Math.min(maximum, current + item.restoreAmount);
  character.resources[currentKey] = nextValue;
  markInventoryModified(character);
  return {
    slot,
    item: { ...item },
    restored: nextValue - current,
    current: nextValue,
    maximum,
    remaining: stack.quantity
  };
}

function useInventoryExpansionTicket(character, categoryKey) {
  const category = getInventoryCategory(categoryKey);
  if (!category) throw new Error('확장할 인벤토리 탭을 선택해주세요.');
  const inventory = ensureInventory(character);
  const currentCapacity = inventory.slotCapacities[category.key];
  if (currentCapacity >= MAX_INVENTORY_CAPACITY) {
    throw new Error(`${category.label} 인벤토리는 이미 최대 64칸입니다.`);
  }
  const ticketStack = getItemStack(character, INVENTORY_EXPANSION_TICKET_ID);
  if (!ticketStack || Number(ticketStack.quantity) <= 0) {
    throw new Error('인벤토리 확장권이 부족합니다.');
  }
  ticketStack.quantity = Math.max(0, Math.floor(Number(ticketStack.quantity) || 0) - 1);
  inventory.slotCapacities[category.key] = Math.min(
    MAX_INVENTORY_CAPACITY,
    currentCapacity + INVENTORY_EXPANSION_SIZE
  );
  markInventoryModified(character);
  return {
    category: { ...category },
    previousCapacity: currentCapacity,
    capacity: inventory.slotCapacities[category.key],
    remaining: ticketStack.quantity
  };
}

function buildInventoryView(character) {
  const inventory = ensureInventory(character);
  const items = inventory.items
    .map((entry) => {
      const item = getItemDefinition(entry.itemId);
      const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
      return item && quantity > 0 ? { ...item, quantity } : null;
    })
    .filter(Boolean);

  const categories = {};
  for (const category of Object.values(INVENTORY_CATEGORIES)) {
    const categoryItems = items.filter((item) => item.category === category.key);
    categories[category.key] = {
      ...category,
      capacity: inventory.slotCapacities[category.key],
      usedSlots: categoryItems.length,
      items: categoryItems
    };
  }

  const potions = items.filter((item) => item.itemType === 'potion');
  const quantities = new Map(items.map((item) => [item.id, item.quantity]));
  const quickSlots = {};
  for (const slot of Object.keys(QUICK_SLOT_RESOURCES)) {
    const item = getItemDefinition(inventory.quickSlots[slot]);
    quickSlots[slot] = item?.itemType === 'potion'
      ? { ...item, quantity: quantities.get(item.id) || 0 }
      : null;
  }
  return {
    items,
    categories,
    potions,
    quickSlots,
    limits: {
      defaultCapacity: DEFAULT_INVENTORY_CAPACITY,
      maximumCapacity: MAX_INVENTORY_CAPACITY,
      expansionSize: INVENTORY_EXPANSION_SIZE
    }
  };
}

function createAdminMail({ message = '', itemId, quantity }) {
  const item = getItemDefinition(itemId);
  if (!item) throw new Error('지급할 아이템을 찾을 수 없습니다.');
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  return {
    id: crypto.randomUUID(),
    sender: '운영자',
    title: '운영자 선물',
    message: String(message || '').trim().slice(0, 500),
    attachments: [{ itemId: item.id, quantity: safeQuantity }],
    createdAt: new Date(),
    claimedAt: null
  };
}

function serializeMail(mail) {
  return {
    id: String(mail.id || mail._id || ''),
    sender: String(mail.sender || '운영자'),
    title: String(mail.title || '운영자 선물'),
    message: String(mail.message || ''),
    createdAt: mail.createdAt || null,
    attachments: (Array.isArray(mail.attachments) ? mail.attachments : []).map((attachment) => {
      const item = getItemDefinition(attachment.itemId);
      return {
        itemId: String(attachment.itemId || ''),
        name: item?.name || String(attachment.itemId || ''),
        icon: item?.icon || '📦',
        quantity: Math.max(0, Math.floor(Number(attachment.quantity) || 0))
      };
    })
  };
}

function getPendingMail(character) {
  ensureInventory(character);
  return character.mailbox.filter((mail) => !mail.claimedAt);
}

function assertAttachmentsFit(character, attachments) {
  const newStacksByCategory = {};
  const seenIds = new Set();
  for (const attachment of attachments || []) {
    const item = getItemDefinition(attachment.itemId);
    if (!item || getItemStack(character, item.id) || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    newStacksByCategory[item.category] = (newStacksByCategory[item.category] || 0) + 1;
  }
  const inventory = ensureInventory(character);
  for (const [categoryKey, additionalSlots] of Object.entries(newStacksByCategory)) {
    if (getUsedSlots(character, categoryKey) + additionalSlots > inventory.slotCapacities[categoryKey]) {
      const category = getInventoryCategory(categoryKey);
      throw new Error(`${category?.label || categoryKey} 인벤토리 공간이 부족합니다.`);
    }
  }
}

function claimMail(character, mailId) {
  const mail = getPendingMail(character).find((entry) => String(entry.id || entry._id) === String(mailId));
  if (!mail) throw new Error('수령할 우편을 찾을 수 없습니다.');
  assertAttachmentsFit(character, mail.attachments);
  for (const attachment of mail.attachments || []) {
    addInventoryItem(character, attachment.itemId, attachment.quantity);
  }
  mail.claimedAt = new Date();
  markInventoryModified(character);
  return serializeMail(mail);
}

function claimAllMail(character) {
  const pending = [...getPendingMail(character)];
  const attachments = pending.flatMap((mail) => Array.from(mail.attachments || []));
  assertAttachmentsFit(character, attachments);
  for (const mail of pending) claimMail(character, mail.id || mail._id);
  return pending.length;
}

module.exports = {
  DEFAULT_INVENTORY_CAPACITY,
  MAX_INVENTORY_CAPACITY,
  INVENTORY_EXPANSION_SIZE,
  INVENTORY_EXPANSION_TICKET_ID,
  QUICK_SLOT_RESOURCES,
  ensureInventory,
  getUsedSlots,
  addInventoryItem,
  assignPotionQuickSlot,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  serializeMail,
  getPendingMail,
  claimMail,
  claimAllMail
};
