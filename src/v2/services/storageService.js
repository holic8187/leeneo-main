'use strict';

const crypto = require('crypto');
const { getItemDefinition } = require('../items/itemCatalog');
const {
  ensureInventory,
  getMaxStackSize,
  getCharacterMaxStackSize,
  getUsedSlots,
  isItemInstanceTradeable,
  markInventoryModified,
  removeInventoryStack,
  consumeInventoryStack
} = require('./inventoryService');

const DEFAULT_STORAGE_CAPACITY = 4;
const MAX_STORAGE_CAPACITY = 200;

function cloneData(data) {
  return data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : null;
}

function expiryKey(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function stackSignature(data, expiresAt) {
  return `${expiryKey(expiresAt)}:${JSON.stringify(data || null)}`;
}

function ensureStorage(character) {
  if (!character.storage || typeof character.storage !== 'object') {
    character.storage = { items: [], capacity: DEFAULT_STORAGE_CAPACITY };
  }
  if (!Array.isArray(character.storage.items)) character.storage.items = [];
  const activeItems = character.storage.items.filter((entry) => {
    const expiresAt = entry?.expiresAt ? new Date(entry.expiresAt).getTime() : 0;
    return !expiresAt || !Number.isFinite(expiresAt) || expiresAt > Date.now();
  });
  if (activeItems.length !== character.storage.items.length) {
    character.storage.items = activeItems;
    character.markModified?.('storage');
  }
  character.storage.capacity = Math.max(
    DEFAULT_STORAGE_CAPACITY,
    Math.min(MAX_STORAGE_CAPACITY, Math.floor(Number(character.storage.capacity) || DEFAULT_STORAGE_CAPACITY))
  );
  return character.storage;
}

function markStorageModified(character) {
  character.markModified?.('storage');
}

function getCompatibleStacks(stacks, itemId, data, expiresAt) {
  const signature = stackSignature(data, expiresAt);
  return stacks.filter((stack) => (
    String(stack.itemId) === String(itemId)
    && stackSignature(stack.data, stack.expiresAt) === signature
    && Number(stack.quantity) > 0
  ));
}

function requiredAdditionalSlots(stacks, item, quantity, data, expiresAt, maxStack = getMaxStackSize(item)) {
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0));
  for (const stack of getCompatibleStacks(stacks, item.id, data, expiresAt)) {
    remaining -= Math.max(0, maxStack - Math.floor(Number(stack.quantity) || 0));
    if (remaining <= 0) return 0;
  }
  return Math.ceil(remaining / maxStack);
}

function addToStackCollection(stacks, item, quantity, data, expiresAt, maxStack = getMaxStackSize(item)) {
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0));
  for (const stack of getCompatibleStacks(stacks, item.id, data, expiresAt)) {
    const added = Math.min(remaining, Math.max(0, maxStack - Number(stack.quantity || 0)));
    stack.quantity += added;
    remaining -= added;
    if (remaining <= 0) break;
  }
  while (remaining > 0) {
    const stackQuantity = Math.min(maxStack, remaining);
    stacks.push({
      stackId: crypto.randomUUID(),
      itemId: item.id,
      quantity: stackQuantity,
      expiresAt: expiresAt || null,
      data: cloneData(data)
    });
    remaining -= stackQuantity;
  }
}

function depositStorageItem(character, stackId, quantity) {
  const inventory = ensureInventory(character);
  const source = inventory.items.find((stack) => (
    String(stack.stackId) === String(stackId || '') && Number(stack.quantity) > 0
  ));
  if (!source) throw new Error('보관할 아이템을 찾을 수 없습니다.');
  const item = getItemDefinition(source.itemId);
  if (!item) throw new Error('아이템 정보를 찾을 수 없습니다.');
  const requested = Math.max(1, Math.min(
    Math.floor(Number(source.quantity) || 1),
    Math.floor(Number(quantity) || Number(source.quantity) || 1)
  ));
  const storage = ensureStorage(character);
  const additionalSlots = requiredAdditionalSlots(
    storage.items,
    item,
    requested,
    source.data,
    source.expiresAt,
    getCharacterMaxStackSize(character, item)
  );
  const usedSlots = storage.items.filter((stack) => Number(stack.quantity) > 0).length;
  if (usedSlots + additionalSlots > storage.capacity) throw new Error('창고가 가득 찼습니다.');

  const moved = requested >= Number(source.quantity)
    ? removeInventoryStack(character, source.stackId)
    : consumeInventoryStack(character, source.stackId, requested);
  if (!moved) throw new Error('아이템을 가방에서 꺼내지 못했습니다.');
  addToStackCollection(
    storage.items,
    item,
    moved.quantity,
    moved.data,
    moved.expiresAt,
    getCharacterMaxStackSize(character, item)
  );
  markStorageModified(character);
  return { item, quantity: moved.quantity };
}

function assertPreservedInventorySpace(character, item, quantity, data, expiresAt) {
  const inventory = ensureInventory(character);
  const additionalSlots = requiredAdditionalSlots(
    inventory.items,
    item,
    quantity,
    data,
    expiresAt,
    getCharacterMaxStackSize(character, item)
  );
  if (getUsedSlots(character, item.category) + additionalSlots > inventory.slotCapacities[item.category]) {
    throw new Error(`${item.category === 'equipment' ? '장비' : item.category === 'consumable' ? '소비' : item.category === 'cash' ? '캐쉬' : '기타'} 인벤토리가 가득 찼습니다.`);
  }
}

function withdrawStorageItem(character, stackId, quantity) {
  const storage = ensureStorage(character);
  const index = storage.items.findIndex((stack) => (
    String(stack.stackId) === String(stackId || '') && Number(stack.quantity) > 0
  ));
  if (index < 0) throw new Error('찾을 아이템을 찾을 수 없습니다.');
  const source = storage.items[index];
  const item = getItemDefinition(source.itemId);
  if (!item) throw new Error('아이템 정보를 찾을 수 없습니다.');
  const requested = Math.max(1, Math.min(
    Math.floor(Number(source.quantity) || 1),
    Math.floor(Number(quantity) || Number(source.quantity) || 1)
  ));
  assertPreservedInventorySpace(character, item, requested, source.data, source.expiresAt);
  addToStackCollection(
    ensureInventory(character).items,
    item,
    requested,
    source.data,
    source.expiresAt,
    getCharacterMaxStackSize(character, item)
  );
  source.quantity -= requested;
  if (source.quantity <= 0) storage.items.splice(index, 1);
  markInventoryModified(character);
  markStorageModified(character);
  return { item, quantity: requested };
}

function serializeStorageItem(character, entry) {
  const item = getItemDefinition(entry.itemId);
  if (!item || Number(entry.quantity) <= 0) return null;
  const instanceData = cloneData(entry.data);
  return {
    ...item,
    tradeable: isItemInstanceTradeable(item, instanceData),
    stackId: String(entry.stackId || ''),
    quantity: Math.max(0, Math.floor(Number(entry.quantity) || 0)),
    instanceData,
    enhancement: instanceData?.enhancement ? { ...instanceData.enhancement } : null,
    stats: { ...(instanceData?.stats || item.stats || {}) },
    maxStack: getCharacterMaxStackSize(character, item),
    expiresAt: entry.expiresAt || null
  };
}

function buildStorageView(character) {
  const storage = ensureStorage(character);
  const items = storage.items.map((entry) => serializeStorageItem(character, entry)).filter(Boolean);
  return {
    capacity: storage.capacity,
    usedSlots: items.length,
    items,
    expandable: true,
    maximumCapacity: MAX_STORAGE_CAPACITY
  };
}

module.exports = {
  DEFAULT_STORAGE_CAPACITY,
  MAX_STORAGE_CAPACITY,
  ensureStorage,
  depositStorageItem,
  withdrawStorageItem,
  buildStorageView
};
