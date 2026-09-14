export const MAX_ENHANCEMENT = 5;
export const ENHANCEMENT_SUCCESS_RATES = Object.freeze([1, 0.86, 0.72, 0.58, 0.44]);
export const ENHANCEMENT_TOTAL_BONUSES = Object.freeze([0, 0.04, 0.10, 0.18, 0.28, 0.40]);
export const SYNTHESIS_MATERIAL_COUNT = 5;
export const SYNTHESIS_SUCCESS_RATES = Object.freeze({
  c: 0.60,
  u: 0.50,
  r: 0.40,
  rr: 0.30,
  rrr: 0.20,
  sr: 0.10,
  hr: 0.10,
  ur: 0.10,
});

export function synthesisSuccessRateForRarity(rarity = '') {
  return SYNTHESIS_SUCCESS_RATES[String(rarity).trim().toLowerCase()] ?? 0;
}

const integerCount = (value) => {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const enhancementStage = (value) => {
  const stage = Math.floor(Number(value));
  return Number.isFinite(stage) ? stage : -1;
};

const rollValue = (random) => {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999999999999, Math.max(0, value));
};

const rawStageCount = (raw, stage) => {
  if (Array.isArray(raw)) return integerCount(raw[stage]);
  if (!raw || typeof raw !== 'object') return 0;
  return integerCount(raw[stage]);
};

/**
 * Return copy counts for enhancement stages +0 through +5. +0 is derived
 * from the total collection count so existing saves keep their compact
 * cardId -> totalCount collection format.
 */
export function enhancementCountsForCard(collection = {}, cardEnhancements = {}, cardId = '') {
  const counts = Array(MAX_ENHANCEMENT + 1).fill(0);
  let remaining = integerCount(collection?.[cardId]);
  const raw = cardEnhancements?.[cardId];

  // Preserve the most valuable copies first when repairing an invalid save
  // whose enhanced copy total exceeds the collection total.
  for (let stage = MAX_ENHANCEMENT; stage >= 1; stage -= 1) {
    counts[stage] = Math.min(rawStageCount(raw, stage), remaining);
    remaining -= counts[stage];
  }
  counts[0] = remaining;
  return counts;
}

/**
 * Canonical saved form: { [cardId]: { 1: count, ..., 5: count } }.
 * Stage +0 is deliberately omitted because it is the collection total minus
 * all explicitly enhanced copies.
 */
export function normalizeCardEnhancements(saved = {}, collection = {}) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const normalized = {};

  for (const cardId of Object.keys(saved)) {
    if (!integerCount(collection?.[cardId])) continue;
    const counts = enhancementCountsForCard(collection, saved, cardId);
    const stages = {};
    for (let stage = 1; stage <= MAX_ENHANCEMENT; stage += 1) {
      if (counts[stage] > 0) stages[stage] = counts[stage];
    }
    if (Object.keys(stages).length) normalized[cardId] = stages;
  }

  return normalized;
}

export function bestEnhancementForCard(collection = {}, cardEnhancements = {}, cardId = '') {
  const counts = enhancementCountsForCard(collection, cardEnhancements, cardId);
  for (let stage = MAX_ENHANCEMENT; stage >= 0; stage -= 1) {
    if (counts[stage] > 0) return stage;
  }
  return 0;
}

const normalizedLock = (value) => {
  if (typeof value === 'string') {
    const cardId = value.trim();
    return cardId ? { cardId, enhancement: null } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const cardId = String(value.cardId || value.id || '').trim();
  if (!cardId) return null;
  const stage = enhancementStage(value.enhancement ?? value.stage);
  return {
    cardId,
    enhancement: stage >= 0 && stage <= MAX_ENHANCEMENT ? stage : null,
  };
};

/**
 * New expeditions record the exact enhancement bucket that departed. Older
 * expeditions only have card ids, so they deliberately retain the former
 * strongest-copy fallback until they complete.
 */
export function expeditionCardLocks(expedition = null) {
  const squad = Array.isArray(expedition?.squad) ? expedition.squad : [];
  return squad.map((cardId) => {
    const rawStage = expedition?.enhancementStages?.[cardId];
    const stage = rawStage == null ? -1 : enhancementStage(rawStage);
    return stage >= 0 && stage <= MAX_ENHANCEMENT
      ? { cardId, enhancement: stage }
      : cardId;
  });
}

export function enhancedCardPower(basePowerOrCard, stage = 0) {
  const basePower = Number(
    basePowerOrCard && typeof basePowerOrCard === 'object'
      ? basePowerOrCard.combatPower
      : basePowerOrCard,
  );
  const safeBasePower = Number.isFinite(basePower) && basePower > 0 ? basePower : 0;
  const safeStage = Math.min(MAX_ENHANCEMENT, Math.max(0, enhancementStage(stage)));
  return Math.round(safeBasePower * (1 + ENHANCEMENT_TOTAL_BONUSES[safeStage]));
}

const setCardCounts = (cardEnhancements, cardId, counts) => {
  const next = { ...(cardEnhancements || {}) };
  const stages = {};
  for (let stage = 1; stage <= MAX_ENHANCEMENT; stage += 1) {
    if (integerCount(counts[stage])) stages[stage] = integerCount(counts[stage]);
  }
  if (Object.keys(stages).length) next[cardId] = stages;
  else delete next[cardId];
  return next;
};

export function attemptCardEnhancement({
  collection = {},
  cardEnhancements = {},
  cardId,
  targetStage,
  materialStage = 0,
  lockedCards = [],
  protectedCardIds = [],
  random = Math.random,
} = {}) {
  const fromStage = enhancementStage(targetStage);
  const consumedStage = enhancementStage(materialStage);
  if (!cardId || !integerCount(collection?.[cardId])) {
    throw new Error('강화할 카드를 보유하고 있지 않습니다.');
  }
  if (fromStage < 0 || fromStage >= MAX_ENHANCEMENT) {
    throw new Error('강화 대상은 +0부터 +4 카드여야 합니다.');
  }
  if (consumedStage < 0 || consumedStage > MAX_ENHANCEMENT) {
    throw new Error('강화 재료 단계를 확인해 주세요.');
  }
  if (new Set(protectedCardIds || []).has(cardId)) {
    throw new Error('잠금된 카드는 강화 재료로 사용할 수 없습니다. 잠금을 먼저 해제해 주세요.');
  }

  const counts = enhancementCountsForCard(collection, cardEnhancements, cardId);
  const locks = lockedEnhancementCounts(collection, cardEnhancements, lockedCards)[cardId] || [];
  const available = counts.map((count, stage) => Math.max(0, count - (locks[stage] || 0)));
  const requiredAtTargetStage = fromStage === consumedStage ? 2 : 1;
  if (available[fromStage] < requiredAtTargetStage || available[consumedStage] < 1) {
    throw new Error('모험에 참여하지 않는 동일 카드의 강화 대상과 재료를 각각 준비해 주세요.');
  }

  const successRate = ENHANCEMENT_SUCCESS_RATES[fromStage];
  const success = rollValue(random) < successRate;

  // Temporarily remove both copies. The target returns at its old stage on a
  // failure and at the next stage on a success; the material never returns.
  counts[fromStage] -= 1;
  counts[consumedStage] -= 1;
  counts[success ? fromStage + 1 : fromStage] += 1;

  const nextCollection = {
    ...collection,
    [cardId]: integerCount(collection[cardId]) - 1,
  };
  const nextEnhancements = normalizeCardEnhancements(
    setCardCounts(cardEnhancements, cardId, counts),
    nextCollection,
  );

  return {
    success,
    successRate,
    cardId,
    fromStage,
    resultStage: success ? fromStage + 1 : fromStage,
    materialStage: consumedStage,
    collection: nextCollection,
    cardEnhancements: nextEnhancements,
  };
}

/**
 * Reserve one strongest owned copy for every locked card id. Repeated ids
 * reserve repeated copies, which also supports future concurrent expeditions.
 */
export function lockedEnhancementCounts(
  collection = {},
  cardEnhancements = {},
  lockedCards = [],
) {
  const locks = {};
  const entries = Array.isArray(lockedCards) ? lockedCards : [...(lockedCards || [])];

  for (const entry of entries) {
    const normalized = normalizedLock(entry);
    if (!normalized) continue;
    const { cardId, enhancement } = normalized;
    const owned = enhancementCountsForCard(collection, cardEnhancements, cardId);
    const locked = locks[cardId] || Array(MAX_ENHANCEMENT + 1).fill(0);
    if (enhancement != null && owned[enhancement] > locked[enhancement]) {
      locked[enhancement] += 1;
      locks[cardId] = locked;
      continue;
    }

    // A string entry comes from a legacy expedition that did not snapshot its
    // stage. An invalid/corrupt exact bucket also falls back conservatively so
    // an expedition can never leave every owned copy unprotected.
    for (let stage = MAX_ENHANCEMENT; stage >= 0; stage -= 1) {
      if (owned[stage] > locked[stage]) {
        locked[stage] += 1;
        locks[cardId] = locked;
        break;
      }
    }
  }

  return locks;
}

/**
 * Describe whether a card kind has two usable copies: one target below +5 and
 * one separate material. Copies reserved by an active expedition stay visible
 * in the owned totals but can never make an otherwise impossible enhancement
 * look selectable in the UI.
 */
export function cardEnhancementAvailability({
  collection = {},
  cardEnhancements = {},
  cardId = '',
  lockedCards = [],
  protectedCardIds = [],
} = {}) {
  const counts = enhancementCountsForCard(collection, cardEnhancements, cardId);
  const expeditionLocks = lockedEnhancementCounts(
    collection,
    cardEnhancements,
    lockedCards,
  )[cardId] || [];
  const protectedCard = new Set(protectedCardIds || []).has(cardId);
  const locked = counts.map((count, stage) => (
    protectedCard ? count : Math.min(count, expeditionLocks[stage] || 0)
  ));
  const available = counts.map((count, stage) => Math.max(0, count - locked[stage]));
  const canEnhance = available.some((targetCount, targetStage) => {
    if (targetStage >= MAX_ENHANCEMENT || targetCount <= 0) return false;
    return available.some((materialCount, materialStage) => (
      materialCount - (materialStage === targetStage ? 1 : 0) > 0
    ));
  });

  return {
    counts,
    locked,
    available,
    protectedCard,
    canEnhance,
  };
}

export function bestAvailableEnhancementForCard(
  collection = {},
  cardEnhancements = {},
  cardId = '',
  lockedCards = [],
) {
  const counts = enhancementCountsForCard(collection, cardEnhancements, cardId);
  const locks = lockedEnhancementCounts(collection, cardEnhancements, lockedCards)[cardId] || [];
  for (let stage = MAX_ENHANCEMENT; stage >= 0; stage -= 1) {
    if (counts[stage] > (locks[stage] || 0)) return stage;
  }
  return -1;
}

export function autoSelectSynthesisMaterials({
  collection = {},
  cardEnhancements = {},
  catalog = [],
  rarityOrder = [],
  lockedCardIds = [],
  protectedCardIds = [],
} = {}) {
  const locks = lockedEnhancementCounts(collection, cardEnhancements, lockedCardIds);
  const protectedIds = new Set(protectedCardIds || []);
  const rank = new Map(rarityOrder.map((rarity, index) => [rarity, index]));
  const orderedCatalog = [...catalog]
    .filter((card) => card && rank.has(card.rarity) && rank.get(card.rarity) < rarityOrder.length - 1)
    .sort((left, right) => {
      const rarityDifference = rank.get(left.rarity) - rank.get(right.rarity);
      return rarityDifference || String(left.id).localeCompare(String(right.id));
    });

  for (const rarity of rarityOrder.slice(0, -1)) {
    const materials = [];
    for (const card of orderedCatalog) {
      if (card.rarity !== rarity) continue;
      if (protectedIds.has(card.id)) continue;
      const counts = enhancementCountsForCard(collection, cardEnhancements, card.id);
      const available = Math.max(0, counts[0] - (locks[card.id]?.[0] || 0));
      for (let index = 0; index < available && materials.length < SYNTHESIS_MATERIAL_COUNT; index += 1) {
        materials.push({ cardId: card.id, enhancement: 0 });
      }
      if (materials.length === SYNTHESIS_MATERIAL_COUNT) return materials;
    }
  }

  return [];
}

const normalizeMaterial = (material) => ({
  cardId: String(material?.cardId || ''),
  enhancement: enhancementStage(material?.enhancement ?? material?.stage ?? 0),
});

export function attemptCardSynthesis({
  collection = {},
  cardEnhancements = {},
  materials = [],
  catalog = [],
  rarityOrder = [],
  lockedCardIds = [],
  protectedCardIds = [],
  successRate,
  random = Math.random,
} = {}) {
  if (!Array.isArray(materials) || materials.length !== SYNTHESIS_MATERIAL_COUNT) {
    throw new Error(`같은 등급의 카드 ${SYNTHESIS_MATERIAL_COUNT}장을 선택해 주세요.`);
  }

  const normalizedMaterials = materials.map(normalizeMaterial);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const materialCards = normalizedMaterials.map(({ cardId, enhancement }) => {
    const card = catalogById.get(cardId);
    if (!card || enhancement < 0 || enhancement > MAX_ENHANCEMENT) {
      throw new Error('합성 재료 정보를 확인해 주세요.');
    }
    return card;
  });
  const sourceRarity = materialCards[0].rarity;
  if (materialCards.some((card) => card.rarity !== sourceRarity)) {
    throw new Error('합성 재료는 모두 같은 등급이어야 합니다.');
  }

  const sourceRank = rarityOrder.indexOf(sourceRarity);
  if (sourceRank < 0 || sourceRank >= rarityOrder.length - 1) {
    throw new Error('이 등급의 카드는 더 높은 등급으로 합성할 수 없습니다.');
  }

  const requested = {};
  for (const material of normalizedMaterials) {
    requested[material.cardId] ||= Array(MAX_ENHANCEMENT + 1).fill(0);
    requested[material.cardId][material.enhancement] += 1;
  }
  const protectedIds = new Set(protectedCardIds || []);
  if (Object.keys(requested).some((cardId) => protectedIds.has(cardId))) {
    throw new Error('잠금된 카드는 합성 재료로 사용할 수 없습니다. 잠금을 먼저 해제해 주세요.');
  }
  const locks = lockedEnhancementCounts(collection, cardEnhancements, lockedCardIds);
  for (const [cardId, stageCounts] of Object.entries(requested)) {
    const owned = enhancementCountsForCard(collection, cardEnhancements, cardId);
    for (let stage = 0; stage <= MAX_ENHANCEMENT; stage += 1) {
      const available = owned[stage] - (locks[cardId]?.[stage] || 0);
      if (stageCounts[stage] > available) {
        throw new Error('선택한 합성 재료가 부족하거나 모험에 참여 중입니다.');
      }
    }
  }

  const nextCollection = { ...collection };
  let nextEnhancements = normalizeCardEnhancements(cardEnhancements, collection);
  for (const [cardId, stageCounts] of Object.entries(requested)) {
    const counts = enhancementCountsForCard(nextCollection, nextEnhancements, cardId);
    let consumed = 0;
    for (let stage = 0; stage <= MAX_ENHANCEMENT; stage += 1) {
      counts[stage] -= stageCounts[stage];
      consumed += stageCounts[stage];
    }
    nextCollection[cardId] = integerCount(nextCollection[cardId]) - consumed;
    nextEnhancements = setCardCounts(nextEnhancements, cardId, counts);
  }

  const requestedSuccessRate = successRate == null
    ? synthesisSuccessRateForRarity(sourceRarity)
    : successRate;
  const normalizedSuccessRate = Math.min(1, Math.max(0, Number(requestedSuccessRate) || 0));
  const success = rollValue(random) < normalizedSuccessRate;
  const resultRarity = success ? rarityOrder[sourceRank + 1] : sourceRarity;
  const resultPool = catalog.filter((card) => card.rarity === resultRarity);
  if (!resultPool.length) throw new Error('합성 결과 카드 목록을 찾을 수 없습니다.');
  const outputCard = resultPool[Math.floor(rollValue(random) * resultPool.length)];

  nextCollection[outputCard.id] = integerCount(nextCollection[outputCard.id]) + 1;
  nextEnhancements = normalizeCardEnhancements(nextEnhancements, nextCollection);

  return {
    success,
    successRate: normalizedSuccessRate,
    sourceRarity,
    resultRarity,
    outputCard,
    materials: normalizedMaterials,
    collection: nextCollection,
    cardEnhancements: nextEnhancements,
  };
}
