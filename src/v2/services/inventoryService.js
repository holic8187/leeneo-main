'use strict';

const crypto = require('crypto');
const {
  INVENTORY_CATEGORIES,
  getItemDefinition,
  getInventoryCategory
} = require('../items/itemCatalog');
const { getWeaponEquipFailureReason } = require('../items/weaponRequirements');

const DEFAULT_INVENTORY_CAPACITY = 20;
const MAX_INVENTORY_CAPACITY = 64;
const INVENTORY_EXPANSION_SIZE = 4;
const INVENTORY_EXPANSION_TICKET_ID = 'inventory_expansion_ticket';
const DEFAULT_STACK_SIZE = 100;
const MAIL_TTL_MS = 24 * 60 * 60 * 1000;

const QUICK_SLOT_RESOURCES = Object.freeze({
  hp: 'hp',
  mp: 'mp'
});

function markInventoryModified(character) {
  if (typeof character?.markModified !== 'function') return;
  character.markModified('inventory');
  character.markModified('mailbox');
  character.markModified('resources');
  character.markModified('loadout');
}

function markMailboxModified(character) {
  if (typeof character?.markModified === 'function') character.markModified('mailbox');
}

function createStack(itemId, quantity) {
  return {
    stackId: crypto.randomUUID(),
    itemId: String(itemId),
    quantity: Math.max(0, Math.floor(Number(quantity) || 0))
  };
}

function getMaxStackSize(item) {
  if (!item) return DEFAULT_STACK_SIZE;
  if (item.category === 'equipment') return 1;
  return Math.max(1, Math.floor(Number(item.maxStack) || DEFAULT_STACK_SIZE));
}

function normalizeInventoryStacks(character) {
  const inventory = character.inventory;
  const normalized = [];
  let changed = false;

  for (const entry of inventory.items) {
    const itemId = String(entry?.itemId || '');
    const quantity = Math.max(0, Math.floor(Number(entry?.quantity) || 0));
    if (!itemId || !quantity) {
      changed = true;
      continue;
    }
    const maxStack = getMaxStackSize(getItemDefinition(itemId));
    let remaining = quantity;
    let first = true;
    while (remaining > 0) {
      const stackQuantity = Math.min(maxStack, remaining);
      normalized.push({
        stackId: first && entry.stackId ? String(entry.stackId) : crypto.randomUUID(),
        itemId,
        quantity: stackQuantity
      });
      if (!entry.stackId || quantity > maxStack || !first) changed = true;
      first = false;
      remaining -= stackQuantity;
    }
  }

  if (changed) {
    inventory.items = normalized;
    markInventoryModified(character);
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
      let remaining = Math.max(0, Math.floor(Number(potion.quantity) || 0));
      const maxStack = getMaxStackSize(getItemDefinition(potion.itemId));
      while (remaining > 0) {
        const stackQuantity = Math.min(maxStack, remaining);
        inventory.items.push(createStack(potion.itemId, stackQuantity));
        remaining -= stackQuantity;
      }
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
  inventory.quickSlots.autoHpPercent = Math.max(
    0,
    Math.min(100, Number(inventory.quickSlots.autoHpPercent) || 0)
  );
  inventory.quickSlots.autoMpPercent = Math.max(
    0,
    Math.min(100, Number(inventory.quickSlots.autoMpPercent) || 0)
  );
  if (!Array.isArray(character.mailbox)) character.mailbox = [];
  normalizeInventoryStacks(character);
  return inventory;
}

function getItemStacks(character, itemId) {
  return ensureInventory(character).items.filter(
    (entry) => String(entry.itemId) === String(itemId)
      && Number(entry.quantity) > 0
  );
}

function getItemStack(character, itemId) {
  return getItemStacks(character, itemId)[0] || null;
}

function getItemQuantity(character, itemId) {
  return getItemStacks(character, itemId).reduce(
    (total, entry) => total + Math.max(0, Math.floor(Number(entry.quantity) || 0)),
    0
  );
}

function getUsedSlots(character, category) {
  return ensureInventory(character).items.filter((entry) => {
    const item = getItemDefinition(entry.itemId);
    return item?.category === category && Number(entry.quantity) > 0;
  }).length;
}

function getAdditionalSlotCount(character, item, quantity) {
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0));
  const maxStack = getMaxStackSize(item);
  for (const stack of getItemStacks(character, item.id)) {
    remaining -= Math.max(0, maxStack - Math.floor(Number(stack.quantity) || 0));
    if (remaining <= 0) return 0;
  }
  return Math.ceil(remaining / maxStack);
}

function assertInventorySpace(character, item, quantity) {
  const inventory = ensureInventory(character);
  const capacity = inventory.slotCapacities[item.category];
  const additionalSlots = getAdditionalSlotCount(character, item, quantity);
  if (getUsedSlots(character, item.category) + additionalSlots > capacity) {
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
  assertInventorySpace(character, item, safeQuantity);
  const inventory = ensureInventory(character);
  const maxStack = getMaxStackSize(item);
  let remaining = safeQuantity;
  for (const stack of getItemStacks(character, item.id)) {
    const available = Math.max(0, maxStack - Math.floor(Number(stack.quantity) || 0));
    const added = Math.min(available, remaining);
    stack.quantity += added;
    remaining -= added;
    if (remaining <= 0) break;
  }
  while (remaining > 0) {
    const stackQuantity = Math.min(maxStack, remaining);
    inventory.items.push(createStack(item.id, stackQuantity));
    remaining -= stackQuantity;
  }
  markInventoryModified(character);
  return safeQuantity;
}

function consumeInventoryItem(character, itemId, quantity = 1) {
  const inventory = ensureInventory(character);
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0));
  if (getItemQuantity(character, itemId) < remaining) return false;

  for (let index = 0; index < inventory.items.length && remaining > 0;) {
    const stack = inventory.items[index];
    if (String(stack.itemId) !== String(itemId) || Number(stack.quantity) <= 0) {
      index += 1;
      continue;
    }
    const consumed = Math.min(Math.floor(Number(stack.quantity) || 0), remaining);
    stack.quantity -= consumed;
    remaining -= consumed;
    if (stack.quantity <= 0) inventory.items.splice(index, 1);
    else index += 1;
  }
  markInventoryModified(character);
  return true;
}

function consumeInventoryStack(character, stackId, quantity = 1) {
  const inventory = ensureInventory(character);
  const index = inventory.items.findIndex(
    (entry) => String(entry.stackId) === String(stackId)
      && Number(entry.quantity) > 0
  );
  if (index < 0) return null;
  const stack = inventory.items[index];
  const requested = Math.max(1, Math.floor(Number(quantity) || 1));
  const consumed = Math.min(requested, Math.floor(Number(stack.quantity) || 0));
  stack.quantity -= consumed;
  if (stack.quantity <= 0) inventory.items.splice(index, 1);
  markInventoryModified(character);
  return { itemId: String(stack.itemId), quantity: consumed };
}

function equipInventoryWeapon(character, stackId) {
  const inventory = ensureInventory(character);
  const stack = inventory.items.find(
    (entry) => String(entry.stackId) === String(stackId)
      && Number(entry.quantity) > 0
  );
  const item = getItemDefinition(stack?.itemId);
  if (!item || item.category !== 'equipment' || item.itemType !== 'weapon') {
    throw new Error('장착할 무기를 찾을 수 없습니다.');
  }
  const equipFailureReason = getWeaponEquipFailureReason(character, item);
  if (equipFailureReason) throw new Error(equipFailureReason);
  if (!character.loadout || typeof character.loadout !== 'object') character.loadout = {};
  const previous = character.loadout.weapon;
  if (previous && !getItemDefinition(previous.itemId)) {
    throw new Error('현재 장착 무기를 먼저 정리해주세요.');
  }

  const consumed = consumeInventoryStack(character, stack.stackId, 1);
  if (!consumed) throw new Error('장착할 무기를 찾을 수 없습니다.');
  if (previous?.itemId) addInventoryItem(character, previous.itemId, 1);
  character.loadout.weapon = {
    ...item,
    itemId: item.id,
    stats: { ...(item.stats || {}) },
    requirements: {
      ...(item.requirements || {}),
      stats: { ...(item.requirements?.stats || {}) }
    }
  };
  markInventoryModified(character);
  return {
    equipped: { ...character.loadout.weapon },
    unequipped: previous ? { ...previous } : null
  };
}

function unequipInventoryWeapon(character) {
  if (!character.loadout || typeof character.loadout !== 'object') character.loadout = {};
  const current = character.loadout.weapon;
  if (!current?.itemId) throw new Error('장착 중인 무기가 없습니다.');
  const item = getItemDefinition(current.itemId);
  if (!item) throw new Error('현재 무기 정보를 찾을 수 없습니다.');
  addInventoryItem(character, item.id, 1);
  character.loadout.weapon = null;
  markInventoryModified(character);
  return { unequipped: { ...current } };
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

function setPotionAutoThreshold(character, slot, percent) {
  const resource = QUICK_SLOT_RESOURCES[String(slot || '')];
  if (!resource) throw new Error('올바르지 않은 포션 슬롯입니다.');
  const value = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)));
  const inventory = ensureInventory(character);
  inventory.quickSlots[resource === 'hp' ? 'autoHpPercent' : 'autoMpPercent'] = value;
  markInventoryModified(character);
  return value;
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

  consumeInventoryItem(character, item.id, 1);
  const nextValue = Math.min(maximum, current + item.restoreAmount);
  character.resources[currentKey] = nextValue;
  markInventoryModified(character);
  return {
    slot,
    item: { ...item },
    restored: nextValue - current,
    current: nextValue,
    maximum,
    remaining: getItemQuantity(character, item.id)
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
  if (getItemQuantity(character, INVENTORY_EXPANSION_TICKET_ID) <= 0) {
    throw new Error('인벤토리 확장권이 부족합니다.');
  }
  consumeInventoryItem(character, INVENTORY_EXPANSION_TICKET_ID, 1);
  inventory.slotCapacities[category.key] = Math.min(
    MAX_INVENTORY_CAPACITY,
    currentCapacity + INVENTORY_EXPANSION_SIZE
  );
  markInventoryModified(character);
  return {
    category: { ...category },
    previousCapacity: currentCapacity,
    capacity: inventory.slotCapacities[category.key],
    remaining: getItemQuantity(character, INVENTORY_EXPANSION_TICKET_ID)
  };
}

function buildInventoryView(character) {
  const inventory = ensureInventory(character);
  const items = inventory.items
    .map((entry) => {
      const item = getItemDefinition(entry.itemId);
      const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
      return item && quantity > 0
        ? { ...item, stackId: String(entry.stackId || ''), quantity, maxStack: getMaxStackSize(item) }
        : null;
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

  const quantities = new Map();
  for (const item of items) quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  const potions = [...quantities.entries()]
    .map(([itemId, quantity]) => {
      const item = getItemDefinition(itemId);
      return item?.itemType === 'potion' ? { ...item, quantity } : null;
    })
    .filter(Boolean);
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
    autoUsePercent: {
      hp: inventory.quickSlots.autoHpPercent,
      mp: inventory.quickSlots.autoMpPercent
    },
    limits: {
      defaultCapacity: DEFAULT_INVENTORY_CAPACITY,
      maximumCapacity: MAX_INVENTORY_CAPACITY,
      expansionSize: INVENTORY_EXPANSION_SIZE,
      defaultStackSize: DEFAULT_STACK_SIZE
    }
  };
}

function createAdminMail({ message = '', itemId, quantity }) {
  const item = getItemDefinition(itemId);
  if (!item) throw new Error('지급할 아이템을 찾을 수 없습니다.');
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const createdAt = new Date();
  return {
    id: crypto.randomUUID(),
    sender: '운영자',
    title: '운영자 선물',
    message: String(message || '').trim().slice(0, 500),
    attachments: [{ itemId: item.id, quantity: safeQuantity }],
    createdAt,
    expiresAt: new Date(createdAt.getTime() + MAIL_TTL_MS),
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
    expiresAt: getMailExpiry(mail),
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

function getMailExpiry(mail) {
  const explicit = new Date(mail?.expiresAt || 0).getTime();
  if (Number.isFinite(explicit) && explicit > 0) return new Date(explicit);
  const created = new Date(mail?.createdAt || 0).getTime();
  return new Date((Number.isFinite(created) && created > 0 ? created : Date.now()) + MAIL_TTL_MS);
}

function purgeExpiredMail(character, now = Date.now()) {
  if (!Array.isArray(character.mailbox)) character.mailbox = [];
  const before = character.mailbox.length;
  character.mailbox = character.mailbox.filter((mail) => (
    mail.claimedAt || getMailExpiry(mail).getTime() > now
  ));
  const removed = before - character.mailbox.length;
  if (removed > 0) markMailboxModified(character);
  return removed;
}

function getPendingMail(character, now = Date.now()) {
  const mailbox = Array.isArray(character?.mailbox) ? character.mailbox : [];
  return mailbox.filter((mail) => (
    !mail.claimedAt && getMailExpiry(mail).getTime() > now
  ));
}

function assertAttachmentsFit(character, attachments) {
  const inventory = ensureInventory(character);
  const simulated = {
    inventory: {
      items: inventory.items.map((entry) => ({ ...entry })),
      potions: [],
      slotCapacities: { ...inventory.slotCapacities },
      quickSlots: { ...inventory.quickSlots }
    },
    mailbox: []
  };
  for (const attachment of attachments || []) {
    addInventoryItem(simulated, attachment.itemId, attachment.quantity);
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
  DEFAULT_STACK_SIZE,
  MAIL_TTL_MS,
  QUICK_SLOT_RESOURCES,
  ensureInventory,
  getUsedSlots,
  getMaxStackSize,
  getItemQuantity,
  addInventoryItem,
  consumeInventoryItem,
  consumeInventoryStack,
  equipInventoryWeapon,
  unequipInventoryWeapon,
  assignPotionQuickSlot,
  setPotionAutoThreshold,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  serializeMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  claimAllMail
};
