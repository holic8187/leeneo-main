'use strict';

const crypto = require('crypto');
const {
  INVENTORY_CATEGORIES,
  getItemDefinition,
  getInventoryCategory
} = require('../items/itemCatalog');
const { getEquipmentEquipFailureReason } = require('../items/weaponRequirements');

const DEFAULT_INVENTORY_CAPACITY = 20;
const MAX_INVENTORY_CAPACITY = 64;
const INVENTORY_EXPANSION_SIZE = 4;
const INVENTORY_EXPANSION_TICKET_ID = 'inventory_expansion_ticket';
const DEFAULT_STACK_SIZE = 100;
const MAIL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HUNTING_SECONDS = 400 * 60;

const QUICK_SLOT_RESOURCES = Object.freeze({
  hp: 'hp',
  mp: 'mp'
});

const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  cloak: 'cape',
  mantle: 'cape'
});

function normalizeEquipmentSlot(slot = 'weapon') {
  const normalized = String(slot || 'weapon').trim();
  return EQUIPMENT_SLOT_ALIASES[normalized] || normalized || 'weapon';
}

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

function createStack(itemId, quantity, expiresAt = null, data = null) {
  return {
    stackId: crypto.randomUUID(),
    itemId: String(itemId),
    quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
    expiresAt,
    data: data && typeof data === 'object' ? { ...data } : null
  };
}

function getDefaultExpiry(item, now = Date.now()) {
  if (item?.fixedExpiresAt) {
    const fixed = new Date(item.fixedExpiresAt);
    if (Number.isFinite(fixed.getTime())) return fixed;
  }
  const seconds = Math.max(0, Number(item?.expiresAfterSeconds) || 0);
  return seconds ? new Date(now + seconds * 1000) : null;
}

function getMaxStackSize(item) {
  if (!item) return DEFAULT_STACK_SIZE;
  if (item.category === 'equipment') return 1;
  return Math.max(1, Math.floor(Number(item.maxStack) || DEFAULT_STACK_SIZE));
}

function getEquipmentEnhancement(item, instanceData = null) {
  if (item?.category !== 'equipment') return null;
  const maximum = Math.max(0, Math.floor(Number(
    instanceData?.enhancement?.maximum ?? item.upgradeSlots
  ) || 0));
  return {
    level: Math.max(0, Math.floor(Number(instanceData?.enhancement?.level) || 0)),
    maximum,
    remaining: Math.max(
      0,
      Math.min(maximum, Math.floor(Number(instanceData?.enhancement?.remaining ?? maximum) || 0))
    ),
    bonusStats: { ...(instanceData?.enhancement?.bonusStats || {}) }
  };
}

function normalizeInventoryStacks(character) {
  const inventory = character.inventory;
  const normalized = [];
  let changed = false;

  for (const entry of inventory.items) {
    const itemId = String(entry?.itemId || '');
    const quantity = Math.max(0, Math.floor(Number(entry?.quantity) || 0));
    const item = getItemDefinition(itemId);
    let expiresAt = entry?.expiresAt ? new Date(entry.expiresAt) : null;
    if ((item?.expiresAfterSeconds || item?.fixedExpiresAt) && !expiresAt) {
      expiresAt = getDefaultExpiry(item);
      changed = true;
    }
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      changed = true;
      continue;
    }
    const persistentEmptyAmmunition = item?.itemType === 'ammunition' && quantity === 0;
    if (!itemId || (!quantity && !persistentEmptyAmmunition)) {
      changed = true;
      continue;
    }
    const maxStack = getMaxStackSize(getItemDefinition(itemId));
    let remaining = quantity;
    let first = true;
    if (persistentEmptyAmmunition) {
      normalized.push({
        stackId: entry.stackId ? String(entry.stackId) : crypto.randomUUID(),
        itemId,
        quantity: 0,
        expiresAt,
        data: entry.data && typeof entry.data === 'object' ? { ...entry.data } : null
      });
      if (!entry.stackId) changed = true;
      continue;
    }
    while (remaining > 0) {
      const stackQuantity = Math.min(maxStack, remaining);
      normalized.push({
        stackId: first && entry.stackId ? String(entry.stackId) : crypto.randomUUID(),
        itemId,
        quantity: stackQuantity,
        expiresAt,
        data: entry.data && typeof entry.data === 'object' ? { ...entry.data } : null
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

function purgeExpiredEquippedItems(character, now = Date.now()) {
  if (!character.loadout || typeof character.loadout !== 'object') return 0;
  let removed = 0;
  for (const [slot, equipped] of Object.entries(character.loadout)) {
    if (!equipped?.itemId) continue;
    const definition = getItemDefinition(equipped.itemId);
    const expiryValue = equipped.expiresAt || definition?.fixedExpiresAt;
    if (!expiryValue) continue;
    const expiresAt = new Date(expiryValue).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt > now) continue;
    character.loadout[slot] = null;
    removed += 1;
  }
  if (removed) markInventoryModified(character);
  return removed;
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
  purgeExpiredEquippedItems(character);
  return inventory;
}

function getItemStacks(character, itemId) {
  return ensureInventory(character).items.filter(
    (entry) => {
      if (String(entry.itemId) !== String(itemId)) return false;
      const item = getItemDefinition(entry.itemId);
      return Number(entry.quantity) > 0
        || (item?.itemType === 'ammunition' && Number(entry.quantity) === 0);
    }
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
    return item?.category === category && (
      Number(entry.quantity) > 0
      || (item.itemType === 'ammunition' && Number(entry.quantity) === 0)
    );
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

function addInventoryItem(character, itemId, quantity, instanceData = null) {
  const item = getItemDefinition(itemId);
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!item) throw new Error('존재하지 않는 아이템입니다.');
  if (!getInventoryCategory(item.category)) throw new Error('올바르지 않은 아이템 분류입니다.');
  if (!safeQuantity) return 0;
  assertInventorySpace(character, item, safeQuantity);
  const inventory = ensureInventory(character);
  const maxStack = getMaxStackSize(item);
  const expiresAt = getDefaultExpiry(item);
  let remaining = safeQuantity;
  for (const stack of getItemStacks(character, item.id)) {
    if (item.expiresAfterSeconds || item.fixedExpiresAt) continue;
    const available = Math.max(0, maxStack - Math.floor(Number(stack.quantity) || 0));
    const added = Math.min(available, remaining);
    stack.quantity += added;
    remaining -= added;
    if (remaining <= 0) break;
  }
  while (remaining > 0) {
    const stackQuantity = Math.min(maxStack, remaining);
    inventory.items.push(createStack(item.id, stackQuantity, expiresAt, instanceData));
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
    if (stack.quantity <= 0 && getItemDefinition(stack.itemId)?.itemType !== 'ammunition') {
      inventory.items.splice(index, 1);
    }
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
  const data = stack.data && typeof stack.data === 'object' ? { ...stack.data } : null;
  if (stack.quantity <= 0 && getItemDefinition(stack.itemId)?.itemType !== 'ammunition') {
    inventory.items.splice(index, 1);
  }
  markInventoryModified(character);
  return { itemId: String(stack.itemId), quantity: consumed, data };
}

function equipInventoryEquipment(character, stackId) {
  const inventory = ensureInventory(character);
  const stack = inventory.items.find(
    (entry) => String(entry.stackId) === String(stackId)
      && Number(entry.quantity) > 0
  );
  const item = getItemDefinition(stack?.itemId);
  if (!item || item.category !== 'equipment' || !item.equipmentSlot) {
    throw new Error('장착할 장비를 찾을 수 없습니다.');
  }
  const equipFailureReason = getEquipmentEquipFailureReason(character, item);
  if (equipFailureReason) throw new Error(equipFailureReason);
  if (!character.loadout || typeof character.loadout !== 'object') character.loadout = {};
  const slot = normalizeEquipmentSlot(item.equipmentSlot);
  const previous = character.loadout[slot];
  if (previous && !getItemDefinition(previous.itemId)) {
    throw new Error('현재 장착 장비 정보를 먼저 정리해주세요.');
  }

  const consumed = consumeInventoryStack(character, stack.stackId, 1);
  if (!consumed) throw new Error('장착할 장비를 찾을 수 없습니다.');
  if (previous?.itemId) {
    addInventoryItem(
      character,
      previous.itemId,
      1,
      previous.instanceData || { stats: previous.stats }
    );
  }
  character.loadout[slot] = {
    ...item,
    itemId: item.id,
    expiresAt: stack.expiresAt || getDefaultExpiry(item),
    stats: { ...(stack.data?.stats || item.stats || {}) },
    instanceData: stack.data && typeof stack.data === 'object' ? { ...stack.data } : null,
    enhancement: getEquipmentEnhancement(item, stack.data),
    requirements: {
      ...(item.requirements || {}),
      stats: { ...(item.requirements?.stats || {}) }
    }
  };
  markInventoryModified(character);
  return {
    slot,
    equipped: { ...character.loadout[slot] },
    unequipped: previous ? { ...previous } : null
  };
}

function unequipInventoryEquipment(character, requestedSlot = 'weapon') {
  if (!character.loadout || typeof character.loadout !== 'object') character.loadout = {};
  const slot = normalizeEquipmentSlot(requestedSlot);
  const aliasKeys = slot === 'cape' ? ['cape', 'cloak', 'mantle'] : [slot];
  const storedSlot = aliasKeys.find((key) => character.loadout?.[key]?.itemId) || slot;
  const current = character.loadout[storedSlot];
  if (!current?.itemId) throw new Error('해당 슬롯에 장착 중인 장비가 없습니다.');
  const item = getItemDefinition(current.itemId);
  if (!item) throw new Error('현재 장비 정보를 찾을 수 없습니다.');
  addInventoryItem(character, item.id, 1, current.instanceData || { stats: current.stats });
  character.loadout[storedSlot] = null;
  if (storedSlot !== slot) character.loadout[slot] = null;
  markInventoryModified(character);
  return { slot, unequipped: { ...current } };
}

const equipInventoryWeapon = equipInventoryEquipment;
const unequipInventoryWeapon = (character) => unequipInventoryEquipment(character, 'weapon');

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

function useQuickSlotPotion(character, slot, effectPercent = 100, maximumOverride = null) {
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
  const maximum = Math.max(
    1,
    maximumOverride !== null
      && maximumOverride !== undefined
      && Number.isFinite(Number(maximumOverride))
      ? Number(maximumOverride)
      : (Number(character.resources?.[maxKey]) || 1)
  );
  if (current >= maximum) {
    throw new Error(resource === 'hp' ? '체력이 이미 가득 찼습니다.' : '정신력이 이미 가득 찼습니다.');
  }

  consumeInventoryItem(character, item.id, 1);
  const boostedRestoreAmount = Math.max(
    0,
    Math.floor(Number(item.restoreAmount || 0) * Math.max(0, Number(effectPercent) || 100) / 100)
  );
  const nextValue = Math.min(maximum, current + boostedRestoreAmount);
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
      const visible = quantity > 0 || (item?.itemType === 'ammunition' && quantity === 0);
      return item && visible
        ? {
          ...item,
          stackId: String(entry.stackId || ''),
          quantity,
          instanceData: entry.data && typeof entry.data === 'object' ? { ...entry.data } : null,
          enhancement: getEquipmentEnhancement(item, entry.data),
          stats: { ...(entry.data?.stats || item.stats || {}) },
          maxStack: getMaxStackSize(item),
          expiresAt: entry.expiresAt || null
        }
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
    const item = getItemDefinition(attachment.itemId);
    if (item?.itemType === 'hunting-time') continue;
    addInventoryItem(simulated, attachment.itemId, attachment.quantity);
  }
}

function applyMailAttachment(character, attachment) {
  const item = getItemDefinition(attachment.itemId);
  const quantity = Math.max(1, Math.floor(Number(attachment.quantity) || 1));
  if (item?.itemType !== 'hunting-time') {
    addInventoryItem(character, attachment.itemId, quantity);
    return null;
  }
  if (!character.huntingTime || typeof character.huntingTime !== 'object') {
    character.huntingTime = {};
  }
  const before = Math.max(0, Math.floor(Number(character.huntingTime.remainingSeconds) || 0));
  const requestedSeconds = Math.max(0, Number(item.huntingMinutes) || 0) * 60 * quantity;
  character.huntingTime.remainingSeconds = Math.min(
    MAX_HUNTING_SECONDS,
    before + requestedSeconds
  );
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return {
    itemId: item.id,
    name: item.name,
    appliedDirectly: true,
    addedSeconds: character.huntingTime.remainingSeconds - before,
    remainingSeconds: character.huntingTime.remainingSeconds
  };
}

function claimMail(character, mailId) {
  const mail = getPendingMail(character).find((entry) => String(entry.id || entry._id) === String(mailId));
  if (!mail) throw new Error('수령할 우편을 찾을 수 없습니다.');
  assertAttachmentsFit(character, mail.attachments);
  const directEffects = (mail.attachments || [])
    .map((attachment) => applyMailAttachment(character, attachment))
    .filter(Boolean);
  mail.claimedAt = new Date();
  markInventoryModified(character);
  return { ...serializeMail(mail), directEffects };
}

function claimAllMail(character) {
  const pending = [...getPendingMail(character)];
  const attachments = pending.flatMap((mail) => Array.from(mail.attachments || []));
  assertAttachmentsFit(character, attachments);
  for (const mail of pending) claimMail(character, mail.id || mail._id);
  return pending.length;
}

function sortInventory(character) {
  const inventory = ensureInventory(character);
  const categoryRank = {
    equipment: 0,
    consumable: 1,
    misc: 2,
    cash: 3
  };
  inventory.items = inventory.items
    .map((entry, index) => ({ entry, index, item: getItemDefinition(entry.itemId) }))
    .sort((left, right) => {
      const leftCategory = left.item?.category || '';
      const rightCategory = right.item?.category || '';
      const categoryDifference = (categoryRank[leftCategory] ?? 99) - (categoryRank[rightCategory] ?? 99);
      if (categoryDifference) return categoryDifference;

      const leftExpiry = left.entry.expiresAt ? new Date(left.entry.expiresAt).getTime() : Infinity;
      const rightExpiry = right.entry.expiresAt ? new Date(right.entry.expiresAt).getTime() : Infinity;
      const leftHasExpiry = Number.isFinite(leftExpiry);
      const rightHasExpiry = Number.isFinite(rightExpiry);
      if (leftHasExpiry !== rightHasExpiry) return leftHasExpiry ? -1 : 1;
      if (leftHasExpiry && leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;

      if (leftCategory === 'equipment') {
        const leftLevel = Number(left.item?.requiredLevel || left.item?.requirements?.level) || 0;
        const rightLevel = Number(right.item?.requiredLevel || right.item?.requirements?.level) || 0;
        if (leftLevel !== rightLevel) return leftLevel - rightLevel;
      }

      const nameDifference = String(left.item?.name || left.entry.itemId)
        .localeCompare(String(right.item?.name || right.entry.itemId), 'ko-KR');
      if (nameDifference) return nameDifference;
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
  markInventoryModified(character);
  return buildInventoryView(character);
}

module.exports = {
  DEFAULT_INVENTORY_CAPACITY,
  MAX_INVENTORY_CAPACITY,
  INVENTORY_EXPANSION_SIZE,
  INVENTORY_EXPANSION_TICKET_ID,
  DEFAULT_STACK_SIZE,
  MAIL_TTL_MS,
  QUICK_SLOT_RESOURCES,
  markInventoryModified,
  ensureInventory,
  purgeExpiredEquippedItems,
  getUsedSlots,
  getMaxStackSize,
  getItemStack,
  getItemQuantity,
  assertInventorySpace,
  addInventoryItem,
  consumeInventoryItem,
  consumeInventoryStack,
  equipInventoryEquipment,
  unequipInventoryEquipment,
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
  claimAllMail,
  sortInventory
};
