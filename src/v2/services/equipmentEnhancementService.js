'use strict';

const {
  consumeInventoryStack,
  ensureInventory,
  markInventoryModified
} = require('./inventoryService');
const { getItemDefinition } = require('../items/itemCatalog');
const {
  getDefaultUpgradeSlots,
  isScrollApplicable
} = require('../items/scrollCatalog');

function normalizeEnhancement(equipment) {
  const maximum = Math.max(
    0,
    Math.floor(Number(
      equipment?.instanceData?.enhancement?.maximum
      ?? equipment?.upgradeSlots
      ?? getDefaultUpgradeSlots(equipment)
    ) || 0)
  );
  const stored = equipment?.instanceData?.enhancement || {};
  return {
    level: Math.max(0, Math.floor(Number(stored.level) || 0)),
    maximum,
    remaining: Math.max(
      0,
      Math.min(maximum, Math.floor(Number(stored.remaining ?? maximum) || 0))
    ),
    bonusStats: { ...(stored.bonusStats || {}) },
    history: Array.isArray(stored.history) ? stored.history.map((entry) => ({ ...entry })) : []
  };
}

function buildEnhancementView(equipment) {
  if (!equipment) return null;
  const enhancement = normalizeEnhancement(equipment);
  return {
    level: enhancement.level,
    maximum: enhancement.maximum,
    remaining: enhancement.remaining,
    bonusStats: { ...enhancement.bonusStats }
  };
}

function enhanceEquippedItem(character, slot, scrollStackId, random = Math.random, options = {}) {
  const equipmentSlot = String(slot || '');
  const equipment = character.loadout?.[equipmentSlot];
  if (!equipment?.itemId) throw new Error('강화할 장착 장비를 선택해주세요.');

  const inventory = ensureInventory(character);
  const scrollStack = inventory.items.find(
    (entry) => String(entry.stackId) === String(scrollStackId)
      && Number(entry.quantity) > 0
  );
  const scroll = getItemDefinition(scrollStack?.itemId);
  if (!scroll || scroll.itemType !== 'equipment-scroll') {
    throw new Error('사용할 주문서를 찾을 수 없습니다.');
  }
  if (!isScrollApplicable(scroll, equipment)) {
    throw new Error('선택한 장비에는 이 주문서를 사용할 수 없습니다.');
  }

  const enhancement = normalizeEnhancement(equipment);
  if (enhancement.remaining <= 0) throw new Error('남은 업그레이드 가능 횟수가 없습니다.');

  const consumed = consumeInventoryStack(character, scrollStack.stackId, 1);
  if (!consumed) throw new Error('사용할 주문서를 찾을 수 없습니다.');
  const success = random() * 100 < Number(scroll.successRate);
  const preservedUpgradeSlot = !success && Boolean(options.preserveUpgradeOnFailure);
  if (!preservedUpgradeSlot) enhancement.remaining -= 1;
  if (success) {
    enhancement.level += 1;
    for (const [stat, rawValue] of Object.entries(scroll.scrollStats || {})) {
      const value = Number(rawValue) || 0;
      equipment.stats[stat] = (Number(equipment.stats?.[stat]) || 0) + value;
      enhancement.bonusStats[stat] = (Number(enhancement.bonusStats[stat]) || 0) + value;
    }
  }
  enhancement.history.push({
    scrollId: scroll.id,
    scrollName: scroll.name,
    successRate: Number(scroll.successRate),
    success,
    preservedUpgradeSlot,
    usedAt: new Date().toISOString()
  });

  equipment.instanceData = {
    ...(equipment.instanceData || {}),
    stats: { ...(equipment.stats || {}) },
    enhancement
  };
  equipment.enhancement = buildEnhancementView(equipment);
  character.loadout[equipmentSlot] = equipment;
  markInventoryModified(character);

  return {
    success,
    preservedUpgradeSlot,
    slot: equipmentSlot,
    equipment: { ...equipment },
    scroll: { ...scroll },
    enhancement: buildEnhancementView(equipment),
    message: success
      ? `${scroll.name}가 한 순간 빛나더니 신비로운 힘이 그대로 ${equipment.name}에 전해졌습니다.`
      : `${scroll.name}가 한 순간 빛났지만 ${equipment.name}에는 아무런 변화도 일어나지 않았습니다.${
        preservedUpgradeSlot ? ' 호이의 세금계산서가 업그레이드 가능 횟수를 지켜냈습니다.' : ''
      }`
  };
}

module.exports = {
  normalizeEnhancement,
  buildEnhancementView,
  enhanceEquippedItem
};
