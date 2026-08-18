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
const DEFAULT_MAX_HUNTING_SECONDS = 400 * 60;
const ABSOLUTE_MAX_HUNTING_SECONDS = 800 * 60;

const QUICK_SLOT_RESOURCES = Object.freeze({
  hp: 'hp',
  mp: 'mp'
});
const MANUAL_CONSUMABLE_SLOT_COUNT = 4;
const MANUAL_CONSUMABLE_ITEM_TYPES = Object.freeze([
  'potion',
  'return-scroll',
  'cleanse-potion'
]);

const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  cloak: 'cape',
  mantle: 'cape',
  earring: 'earrings'
});
const EQUIPMENT_SLOT_STORAGE_KEYS = Object.freeze({
  cape: Object.freeze(['cape', 'cloak', 'mantle']),
  earrings: Object.freeze(['earrings', 'earring'])
});
const COMMON_EQUIPMENT_LEVELS = Object.freeze([20, 40, 60, 80, 100, 120, 140]);

function normalizeEquipmentSlot(slot = 'weapon') {
  const normalized = String(slot || 'weapon').trim();
  return EQUIPMENT_SLOT_ALIASES[normalized] || normalized || 'weapon';
}

function getStoredEquipmentSlot(loadout = {}, requestedSlot = 'weapon') {
  const slot = normalizeEquipmentSlot(requestedSlot);
  const aliases = EQUIPMENT_SLOT_STORAGE_KEYS[slot] || [slot];
  return aliases.find((key) => {
    const equipped = loadout?.[key];
    return equipped && typeof equipped === 'object'
      && (equipped.itemId || equipped.id || equipped.name);
  }) || slot;
}

function resolveEquippedItemDefinition(equipped, slot = '') {
  if (!equipped || typeof equipped !== 'object') return null;
  const storedId = String(equipped.itemId || equipped.id || '');
  const direct = getItemDefinition(storedId);
  if (direct) return direct;

  // Early V2 capes and earrings used job-specific ids. Recover retired
  // definitions as their same-level shared item so they can be replaced safely.
  const normalizedSlot = normalizeEquipmentSlot(slot);
  if (!['cape', 'earrings'].includes(normalizedSlot)) return null;
  const idLevel = storedId.match(/_(\d+)$/)?.[1];
  const nameLevel = String(equipped.name || '').match(/(\d+)\s*제/)?.[1];
  const requiredLevel = Math.max(1, Math.floor(Number(
    equipped.requiredLevel ?? equipped.requirements?.level ?? idLevel ?? nameLevel
  ) || 1));
  const closestLevel = COMMON_EQUIPMENT_LEVELS.reduce((closest, level) => (
    Math.abs(level - requiredLevel) < Math.abs(closest - requiredLevel) ? level : closest
  ), COMMON_EQUIPMENT_LEVELS[0]);
  return getItemDefinition(`drop_common_${normalizedSlot}_${closestLevel}`);
}

function buildEquippedInstanceData(equipped) {
  return {
    ...(equipped?.instanceData && typeof equipped.instanceData === 'object'
      ? equipped.instanceData
      : {}),
    stats: { ...(equipped?.stats || equipped?.instanceData?.stats || {}) },
    ...(equipped?.enhancement ? { enhancement: { ...equipped.enhancement } } : {})
  };
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

function isItemInstanceTradeable(item, instanceData = null) {
  return Boolean(
    item
    && item.tradeable !== false
    && instanceData?.tradeLocked !== true
  );
}

function normalizeBindOnEquipLoadout(character) {
  if (!character.loadout || typeof character.loadout !== 'object') return false;
  let changed = false;
  for (const equipped of Object.values(character.loadout)) {
    if (!equipped || typeof equipped !== 'object') continue;
    const item = resolveEquippedItemDefinition(equipped, equipped.equipmentSlot);
    if (!item?.bindOnEquip || equipped.instanceData?.tradeLocked === true) continue;
    equipped.instanceData = {
      ...buildEquippedInstanceData(equipped),
      tradeLocked: true,
      equippedOnce: true,
      firstEquippedAt: equipped.instanceData?.firstEquippedAt || new Date().toISOString()
    };
    equipped.tradeable = false;
    changed = true;
  }
  if (changed) character.markModified?.('loadout');
  return changed;
}

function getCharacterMaxStackSize(character, item) {
  const baseMaximum = getMaxStackSize(item);
  if (item?.ammunitionType !== 'throwing-star') return baseMaximum;
  const { getActiveSkillEffects } = require('../skills/skillService');
  const bonus = Math.max(
    0,
    Math.floor(Number(getActiveSkillEffects(character).throwingStarCapacityIncrease) || 0)
  );
  return baseMaximum + bonus;
}

function isManualConsumableQuickItem(item) {
  return Boolean(
    item
    && item.category === 'consumable'
    && MANUAL_CONSUMABLE_ITEM_TYPES.includes(String(item.itemType || ''))
  );
}

function normalizeManualConsumableSlot(slot) {
  const index = Math.floor(Number(slot));
  if (index < 0 || index >= MANUAL_CONSUMABLE_SLOT_COUNT) {
    throw new Error('올바르지 않은 소비 아이템 단축 슬롯입니다.');
  }
  return index;
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
    const defaultExpiry = item?.expiresAfterSeconds || item?.fixedExpiresAt
      ? getDefaultExpiry(item)
      : null;
    const shouldExtendFixedExpiry = Boolean(
      item?.fixedExpiresAt
      && defaultExpiry
      && (
        !expiresAt
        || !Number.isFinite(expiresAt.getTime())
        || expiresAt.getTime() < defaultExpiry.getTime()
      )
    );
    if (shouldExtendFixedExpiry || (defaultExpiry && !expiresAt)) {
      expiresAt = defaultExpiry;
      changed = true;
    }
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      changed = true;
      continue;
    }
    const persistentEmptyAmmunition = item?.itemType === 'ammunition'
      && item?.ammunitionType === 'throwing-star'
      && quantity === 0;
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
  let changed = false;
  for (const [slot, equipped] of Object.entries(character.loadout)) {
    if (!equipped?.itemId) continue;
    const definition = getItemDefinition(equipped.itemId);
    const configuredExpiry = definition?.fixedExpiresAt
      ? new Date(definition.fixedExpiresAt).getTime()
      : NaN;
    const equippedExpiry = equipped.expiresAt
      ? new Date(equipped.expiresAt).getTime()
      : NaN;
    if (
      Number.isFinite(configuredExpiry)
      && (!Number.isFinite(equippedExpiry) || equippedExpiry < configuredExpiry)
    ) {
      equipped.expiresAt = new Date(configuredExpiry).toISOString();
      changed = true;
    }
    const expiryValue = equipped.expiresAt || definition?.fixedExpiresAt;
    if (!expiryValue) continue;
    const expiresAt = new Date(expiryValue).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt > now) continue;
    character.loadout[slot] = null;
    removed += 1;
  }
  if (removed || changed) markInventoryModified(character);
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
  inventory.quickSlots.hpAssignedAt = Math.max(
    0,
    Number(inventory.quickSlots.hpAssignedAt) || 0
  );
  inventory.quickSlots.mpAssignedAt = Math.max(
    0,
    Number(inventory.quickSlots.mpAssignedAt) || 0
  );
  if (!Array.isArray(inventory.quickSlots.consumables)) inventory.quickSlots.consumables = [];
  inventory.quickSlots.consumables = Array.from({ length: MANUAL_CONSUMABLE_SLOT_COUNT }, (_, index) => (
    typeof inventory.quickSlots.consumables[index] === 'string'
      ? inventory.quickSlots.consumables[index]
      : ''
  ));
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
  normalizeBindOnEquipLoadout(character);
  purgeExpiredEquippedItems(character);
  return inventory;
}

function getItemStacks(character, itemId) {
  return ensureInventory(character).items.filter(
    (entry) => {
      if (String(entry.itemId) !== String(itemId)) return false;
      const item = getItemDefinition(entry.itemId);
      return Number(entry.quantity) > 0
        || (
          item?.itemType === 'ammunition'
          && item?.ammunitionType === 'throwing-star'
          && Number(entry.quantity) === 0
        );
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
      || (
        item.itemType === 'ammunition'
        && item.ammunitionType === 'throwing-star'
        && Number(entry.quantity) === 0
      )
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
    if (item.expiresAfterSeconds) continue;
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
    const definition = getItemDefinition(stack.itemId);
    const preservesEmptyStack = definition?.itemType === 'ammunition'
      && definition?.ammunitionType === 'throwing-star';
    if (stack.quantity <= 0 && !preservesEmptyStack) {
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
  const expiresAt = stack.expiresAt || null;
  const definition = getItemDefinition(stack.itemId);
  const preservesEmptyStack = definition?.itemType === 'ammunition'
    && definition?.ammunitionType === 'throwing-star';
  if (stack.quantity <= 0 && !preservesEmptyStack) {
    inventory.items.splice(index, 1);
  }
  markInventoryModified(character);
  return { itemId: String(stack.itemId), quantity: consumed, data, expiresAt };
}

function removeInventoryStack(character, stackId) {
  const inventory = ensureInventory(character);
  const index = inventory.items.findIndex(
    (entry) => String(entry.stackId) === String(stackId)
  );
  if (index < 0) return null;
  const [stack] = inventory.items.splice(index, 1);
  markInventoryModified(character);
  return {
    itemId: String(stack.itemId),
    quantity: Math.max(0, Math.floor(Number(stack.quantity) || 0)),
    data: stack.data && typeof stack.data === 'object' ? { ...stack.data } : null,
    expiresAt: stack.expiresAt || null
  };
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
  const previousSlot = getStoredEquipmentSlot(character.loadout, slot);
  const previous = character.loadout[previousSlot];
  const previousDefinition = resolveEquippedItemDefinition(previous, slot);
  if (previous && !previousDefinition) {
    throw new Error('현재 장착 장비 정보를 먼저 정리해주세요.');
  }

  const consumed = consumeInventoryStack(character, stack.stackId, 1);
  if (!consumed) throw new Error('장착할 장비를 찾을 수 없습니다.');
  if (previous?.itemId) {
    addInventoryItem(
      character,
      previousDefinition.id,
      1,
      buildEquippedInstanceData(previous)
    );
  }
  if (previous && !previous.itemId && previousDefinition) {
    addInventoryItem(character, previousDefinition.id, 1, buildEquippedInstanceData(previous));
  }
  if (previousSlot !== slot) character.loadout[previousSlot] = null;
  const equippedInstanceData = consumed.data && typeof consumed.data === 'object'
    ? { ...consumed.data }
    : {};
  if (item.bindOnEquip) {
    equippedInstanceData.tradeLocked = true;
    equippedInstanceData.equippedOnce = true;
    if (!equippedInstanceData.firstEquippedAt) {
      equippedInstanceData.firstEquippedAt = new Date().toISOString();
    }
  }
  character.loadout[slot] = {
    ...item,
    itemId: item.id,
    tradeable: isItemInstanceTradeable(item, equippedInstanceData),
    expiresAt: stack.expiresAt || getDefaultExpiry(item),
    stats: { ...(equippedInstanceData.stats || item.stats || {}) },
    instanceData: equippedInstanceData,
    enhancement: getEquipmentEnhancement(item, equippedInstanceData),
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
  const storedSlot = getStoredEquipmentSlot(character.loadout, slot);
  const current = character.loadout[storedSlot];
  if (!current || typeof current !== 'object') {
    throw new Error('해당 슬롯에 장착 중인 장비가 없습니다.');
  }
  const item = resolveEquippedItemDefinition(current, slot);
  if (!item) throw new Error('현재 장비 정보를 찾을 수 없습니다.');
  addInventoryItem(character, item.id, 1, buildEquippedInstanceData(current));
  character.loadout[storedSlot] = null;
  if (storedSlot !== slot) character.loadout[slot] = null;
  markInventoryModified(character);
  return { slot, unequipped: { ...current } };
}

const equipInventoryWeapon = equipInventoryEquipment;
const unequipInventoryWeapon = (character) => unequipInventoryEquipment(character, 'weapon');

function assignPotionQuickSlot(character, slot, itemId, requestedAt = Date.now() * 1000) {
  const expectedResource = QUICK_SLOT_RESOURCES[String(slot || '')];
  if (!expectedResource) throw new Error('올바르지 않은 포션 슬롯입니다.');
  const inventory = ensureInventory(character);
  const versionKey = expectedResource === 'hp' ? 'hpAssignedAt' : 'mpAssignedAt';
  const maximumRequestedAt = (Date.now() + 5 * 60 * 1000) * 1000 + 999;
  const normalizedRequestedAt = Math.max(
    1,
    Math.min(maximumRequestedAt, Math.floor(Number(requestedAt) || Date.now() * 1000))
  );
  if (normalizedRequestedAt < Number(inventory.quickSlots[versionKey] || 0)) {
    return getItemDefinition(inventory.quickSlots[slot]);
  }
  const item = getItemDefinition(itemId);
  if (!item || item.itemType !== 'potion') throw new Error('포션을 찾을 수 없습니다.');
  const supportedResources = item.resource === 'both'
    ? ['hp', 'mp']
    : [item.resource];
  if (!supportedResources.includes(expectedResource)) {
    throw new Error(expectedResource === 'hp'
      ? '체력 포션만 왼쪽 슬롯에 설정할 수 있습니다.'
      : '정신력 포션만 오른쪽 슬롯에 설정할 수 있습니다.');
  }
  const stack = getItemStack(character, item.id);
  if (!stack || Number(stack.quantity) <= 0) throw new Error('해당 포션을 보유하고 있지 않습니다.');
  inventory.quickSlots[slot] = item.id;
  inventory.quickSlots[versionKey] = normalizedRequestedAt;
  markInventoryModified(character);
  return item;
}

function assignConsumableQuickSlot(character, slot, itemId = '') {
  const index = normalizeManualConsumableSlot(slot);
  const inventory = ensureInventory(character);
  const requestedItemId = String(itemId || '').trim();
  if (!requestedItemId) {
    inventory.quickSlots.consumables[index] = '';
    markInventoryModified(character);
    return null;
  }
  const item = getItemDefinition(requestedItemId);
  if (!isManualConsumableQuickItem(item)) {
    throw new Error('소비 아이템 단축 슬롯에는 포션, 귀환서, 축복 물약만 등록할 수 있습니다.');
  }
  const stack = getItemStack(character, item.id);
  if (!stack || Number(stack.quantity) <= 0) {
    throw new Error('해당 소비 아이템을 보유하고 있지 않습니다.');
  }
  inventory.quickSlots.consumables[index] = item.id;
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

function useInventoryPotion(character, itemId, effectPercent = 100, maximumOverride = null, preferredResource = '') {
  const item = getItemDefinition(itemId);
  if (!item || item.itemType !== 'potion') throw new Error('사용할 수 있는 포션이 아닙니다.');
  const supportedResources = item.resource === 'both'
    ? ['hp', 'mp']
    : [item.resource];
  const normalizedPreferred = QUICK_SLOT_RESOURCES[String(preferredResource || '')]
    || String(preferredResource || '');
  if (normalizedPreferred && !supportedResources.includes(normalizedPreferred)) {
    throw new Error('해당 자원에 사용할 수 없는 포션입니다.');
  }
  const stack = getItemStack(character, item.id);
  if (!stack || Number(stack.quantity) <= 0) throw new Error(`${item.name}이 부족합니다.`);

  const restorationResources = item.resource === 'both'
    ? ['hp', 'mp']
    : [item.resource];
  const resourceState = Object.fromEntries(restorationResources.map((entry) => {
    const currentKey = entry === 'hp' ? 'currentHp' : 'currentMp';
    const maxKey = entry === 'hp' ? 'maxHp' : 'maxMp';
    const override = maximumOverride && typeof maximumOverride === 'object'
      ? maximumOverride[entry]
      : (entry === normalizedPreferred ? maximumOverride : null);
    const current = Math.max(0, Number(character.resources?.[currentKey]) || 0);
    const maximum = Math.max(
      1,
      override !== null && override !== undefined && Number.isFinite(Number(override))
        ? Number(override)
        : (Number(character.resources?.[maxKey]) || 1)
    );
    return [entry, { currentKey, current, maximum }];
  }));
  if (restorationResources.every((entry) => resourceState[entry].current >= resourceState[entry].maximum)) {
    throw new Error(item.resource === 'both'
      ? '체력과 정신력이 이미 가득 찼습니다.'
      : (item.resource === 'hp' ? '체력이 이미 가득 찼습니다.' : '정신력이 이미 가득 찼습니다.'));
  }

  consumeInventoryItem(character, item.id, 1);
  const effectMultiplier = Math.max(0, Number(effectPercent) || 100) / 100;
  const restoredByResource = {};
  const currentByResource = {};
  const maximumByResource = {};
  for (const entry of restorationResources) {
    const state = resourceState[entry];
    const restorePercent = Number(item.restorePercents?.[entry] ?? item.restorePercent);
    const baseRestoreAmount = Number.isFinite(restorePercent) && restorePercent > 0
      ? state.maximum * restorePercent / 100
      : (item.resource === 'both'
        ? Number(item.restoreAmounts?.[entry] || 0)
        : Number(item.restoreAmount || 0));
    let boostedRestoreAmount = Math.max(0, Math.floor(baseRestoreAmount * effectMultiplier));
    const restoreCap = Number(item.restoreCaps?.[entry] ?? item.restoreCap);
    if (Number.isFinite(restoreCap) && restoreCap > 0) {
      boostedRestoreAmount = Math.min(boostedRestoreAmount, Math.floor(restoreCap));
    }
    const nextValue = Math.min(state.maximum, state.current + boostedRestoreAmount);
    character.resources[state.currentKey] = nextValue;
    restoredByResource[entry] = nextValue - state.current;
    currentByResource[entry] = nextValue;
    maximumByResource[entry] = state.maximum;
  }
  markInventoryModified(character);
  const primaryResource = normalizedPreferred || restorationResources[0];
  return {
    slot: normalizedPreferred,
    item: { ...item },
    restored: restoredByResource[primaryResource] || 0,
    restoredByResource,
    current: currentByResource[primaryResource],
    currentByResource,
    maximum: maximumByResource[primaryResource],
    maximumByResource,
    remaining: getItemQuantity(character, item.id)
  };
}

function useQuickSlotPotion(character, slot, effectPercent = 100, maximumOverride = null) {
  const resource = QUICK_SLOT_RESOURCES[String(slot || '')];
  if (!resource) throw new Error('올바르지 않은 포션 슬롯입니다.');
  const inventory = ensureInventory(character);
  const itemId = String(inventory.quickSlots[slot] || '');
  const item = getItemDefinition(itemId);
  const supportedResources = item?.resource === 'both'
    ? ['hp', 'mp']
    : [item?.resource];
  if (!item || item.itemType !== 'potion' || !supportedResources.includes(resource)) {
    throw new Error('이 슬롯에 포션이 설정되어 있지 않습니다.');
  }
  return useInventoryPotion(character, item.id, effectPercent, maximumOverride, resource);
}

function useConfiguredAutoPotions(
  character,
  effectPercent = 100,
  maximumOverride = null
) {
  if (Number(character.resources?.currentHp) <= 0) return [];
  const inventory = ensureInventory(character);
  const used = [];
  for (const slot of Object.keys(QUICK_SLOT_RESOURCES)) {
    const resource = QUICK_SLOT_RESOURCES[slot];
    const currentKey = resource === 'hp' ? 'currentHp' : 'currentMp';
    const maximumKey = resource === 'hp' ? 'maxHp' : 'maxMp';
    const thresholdKey = resource === 'hp' ? 'autoHpPercent' : 'autoMpPercent';
    const threshold = Math.max(
      0,
      Math.min(100, Number(inventory.quickSlots[thresholdKey]) || 0)
    );
    const current = Math.max(0, Number(character.resources?.[currentKey]) || 0);
    const override = maximumOverride && typeof maximumOverride === 'object'
      ? maximumOverride[resource]
      : maximumOverride;
    const maximum = Math.max(
      1,
      Number.isFinite(Number(override))
        ? Number(override)
        : (Number(character.resources?.[maximumKey]) || 1)
    );
    if (
      threshold <= 0
      || current <= 0
      || current >= maximum
      || current / maximum * 100 > threshold
    ) continue;
    try {
      used.push(useQuickSlotPotion(character, slot, effectPercent, maximumOverride));
    } catch (_) {
      // Empty and outdated quick slots wait for the player to configure them again.
    }
  }
  return used;
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
      const visible = quantity > 0 || (
        item?.itemType === 'ammunition'
        && item?.ammunitionType === 'throwing-star'
        && quantity === 0
      );
      return item && visible
        ? {
          ...item,
          tradeable: isItemInstanceTradeable(item, entry.data),
          stackId: String(entry.stackId || ''),
          quantity,
          instanceData: entry.data && typeof entry.data === 'object' ? { ...entry.data } : null,
          enhancement: getEquipmentEnhancement(item, entry.data),
          stats: { ...(entry.data?.stats || item.stats || {}) },
          maxStack: getCharacterMaxStackSize(character, item),
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
  const manualConsumables = [...quantities.entries()]
    .map(([itemId, quantity]) => {
      const item = getItemDefinition(itemId);
      return isManualConsumableQuickItem(item) && quantity > 0
        ? { ...item, quantity }
        : null;
    })
    .filter(Boolean);
  const quickSlots = {};
  for (const slot of Object.keys(QUICK_SLOT_RESOURCES)) {
    const item = getItemDefinition(inventory.quickSlots[slot]);
    quickSlots[slot] = item?.itemType === 'potion'
      ? { ...item, quantity: quantities.get(item.id) || 0 }
      : null;
  }
  const consumableQuickSlots = Array.from({ length: MANUAL_CONSUMABLE_SLOT_COUNT }, (_, index) => {
    const item = getItemDefinition(inventory.quickSlots.consumables[index]);
    return isManualConsumableQuickItem(item)
      ? { ...item, quantity: quantities.get(item.id) || 0 }
      : null;
  });
  return {
    items,
    categories,
    potions,
    quickSlots,
    consumableQuickSlots,
    manualConsumables,
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
    money: Math.max(0, Math.floor(Number(mail.money) || 0)),
    attachments: (Array.isArray(mail.attachments) ? mail.attachments : []).map((attachment) => {
      const item = getItemDefinition(attachment.itemId);
      return {
        itemId: String(attachment.itemId || ''),
        name: item?.name || String(attachment.itemId || ''),
        icon: item?.icon || '📦',
        quantity: Math.max(0, Math.floor(Number(attachment.quantity) || 0)),
        data: attachment.data && typeof attachment.data === 'object'
          ? { ...attachment.data }
          : null
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
    addInventoryItem(simulated, attachment.itemId, attachment.quantity, attachment.data || null);
  }
}

function applyMailAttachment(character, attachment) {
  const item = getItemDefinition(attachment.itemId);
  const quantity = Math.max(1, Math.floor(Number(attachment.quantity) || 1));
  if (item?.itemType !== 'hunting-time') {
    addInventoryItem(character, attachment.itemId, quantity, attachment.data || null);
    return null;
  }
  if (!character.huntingTime || typeof character.huntingTime !== 'object') {
    character.huntingTime = {};
  }
  const before = Math.max(0, Math.floor(Number(character.huntingTime.remainingSeconds) || 0));
  const maximumSeconds = Math.max(
    DEFAULT_MAX_HUNTING_SECONDS,
    Math.min(
      ABSOLUTE_MAX_HUNTING_SECONDS,
      Math.floor(Number(character.huntingTime.maximumSeconds) || DEFAULT_MAX_HUNTING_SECONDS)
    )
  );
  character.huntingTime.maximumSeconds = maximumSeconds;
  const requestedSeconds = Math.max(0, Number(item.huntingMinutes) || 0) * 60 * quantity;
  character.huntingTime.remainingSeconds = Math.min(
    maximumSeconds,
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
  const money = Math.max(0, Math.floor(Number(mail.money) || 0));
  if (money > 0) {
    if (!character.economy || typeof character.economy !== 'object') character.economy = {};
    character.economy.money = Math.max(0, Math.floor(Number(character.economy.money) || 0)) + money;
    if (typeof character.markModified === 'function') character.markModified('economy');
  }
  mail.claimedAt = new Date();
  markInventoryModified(character);
  return { ...serializeMail(mail), directEffects, moneyClaimed: money };
}

function claimAllMail(character) {
  const pending = [...getPendingMail(character)];
  const attachments = pending.flatMap((mail) => Array.from(mail.attachments || []));
  assertAttachmentsFit(character, attachments);
  for (const mail of pending) claimMail(character, mail.id || mail._id);
  return pending.length;
}

function createRewardMail({
  sender = '보스 원정대',
  title = '원정대 보상',
  message = '',
  money = 0,
  attachments = []
} = {}) {
  const normalizedAttachments = (Array.isArray(attachments) ? attachments : []).map((attachment) => {
    const item = getItemDefinition(attachment?.itemId);
    if (!item) throw new Error('지급할 보상 아이템을 찾을 수 없습니다.');
    return {
      itemId: item.id,
      quantity: Math.max(1, Math.floor(Number(attachment.quantity) || 1)),
      data: attachment.data && typeof attachment.data === 'object'
        ? { ...attachment.data }
        : null
    };
  });
  const createdAt = new Date();
  return {
    id: crypto.randomUUID(),
    sender: String(sender || '보스 원정대').slice(0, 40),
    title: String(title || '원정대 보상').slice(0, 80),
    message: String(message || '').trim().slice(0, 500),
    money: Math.max(0, Math.floor(Number(money) || 0)),
    attachments: normalizedAttachments,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + MAIL_TTL_MS),
    claimedAt: null
  };
}

function mergeNonExpiringConsumableStacks(character) {
  const inventory = ensureInventory(character);
  const groups = new Map();
  const getMergeGroup = (entry) => {
    const item = getItemDefinition(entry.itemId);
    const hasInstanceData = entry.data && Object.keys(entry.data).length > 0;
    if (
      item?.category !== 'consumable'
      || hasInstanceData
      || Number(entry.quantity) <= 0
    ) return null;
    if (entry.expiresAt && !item.fixedExpiresAt) return null;
    const expiryTime = entry.expiresAt ? new Date(entry.expiresAt).getTime() : 0;
    if (entry.expiresAt && !Number.isFinite(expiryTime)) return null;
    return {
      key: `${String(entry.itemId)}:${expiryTime}`,
      itemId: String(entry.itemId),
      expiresAt: entry.expiresAt || null
    };
  };
  for (const entry of inventory.items) {
    const mergeGroup = getMergeGroup(entry);
    if (!mergeGroup) continue;
    const group = groups.get(mergeGroup.key) || {
      itemId: mergeGroup.itemId,
      expiresAt: mergeGroup.expiresAt,
      total: 0,
      stackIds: []
    };
    group.total += Math.max(0, Math.floor(Number(entry.quantity) || 0));
    group.stackIds.push(String(entry.stackId || ''));
    groups.set(mergeGroup.key, group);
  }

  const emitted = new Set();
  const merged = [];
  for (const entry of inventory.items) {
    const mergeGroup = getMergeGroup(entry);
    if (!mergeGroup) {
      merged.push(entry);
      continue;
    }
    const group = groups.get(mergeGroup.key);
    if (!group) {
      merged.push(entry);
      continue;
    }
    if (emitted.has(mergeGroup.key)) continue;
    emitted.add(mergeGroup.key);
    const item = getItemDefinition(group.itemId);
    const maxStack = getMaxStackSize(item);
    let remaining = group.total;
    let stackIndex = 0;
    while (remaining > 0) {
      const quantity = Math.min(maxStack, remaining);
      const stack = createStack(group.itemId, quantity, group.expiresAt);
      if (group.stackIds[stackIndex]) stack.stackId = group.stackIds[stackIndex];
      merged.push(stack);
      remaining -= quantity;
      stackIndex += 1;
    }
  }
  inventory.items = merged;
  markInventoryModified(character);
  return inventory;
}

function sortInventory(character) {
  const inventory = mergeNonExpiringConsumableStacks(character);
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
  MANUAL_CONSUMABLE_SLOT_COUNT,
  isManualConsumableQuickItem,
  markInventoryModified,
  ensureInventory,
  purgeExpiredEquippedItems,
  getUsedSlots,
  getMaxStackSize,
  getCharacterMaxStackSize,
  isItemInstanceTradeable,
  getItemStack,
  getItemQuantity,
  assertInventorySpace,
  addInventoryItem,
  consumeInventoryItem,
  consumeInventoryStack,
  removeInventoryStack,
  equipInventoryEquipment,
  unequipInventoryEquipment,
  equipInventoryWeapon,
  unequipInventoryWeapon,
  assignPotionQuickSlot,
  assignConsumableQuickSlot,
  setPotionAutoThreshold,
  useInventoryPotion,
  useQuickSlotPotion,
  useConfiguredAutoPotions,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  createRewardMail,
  serializeMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  claimAllMail,
  mergeNonExpiringConsumableStacks,
  sortInventory
};
