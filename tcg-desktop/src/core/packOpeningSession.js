const MAX_PACK_CARDS = 20;

const uniqueIndices = (values, length) => (
  Array.isArray(values)
    ? [...new Set(values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value < length))]
    : []
);

function openingId(openedAt) {
  const randomId = globalThis.crypto?.randomUUID?.()
    || Math.random().toString(36).slice(2, 10);
  return `pack-${openedAt}-${randomId}`;
}

export function createPendingPackOpening({
  cards,
  pityTriggered = false,
  highestRarity = '',
  openedAt = Date.now(),
  id = '',
} = {}) {
  const cardIds = Array.isArray(cards)
    ? cards.map((card) => (typeof card === 'string' ? card : card?.id))
      .filter((cardId) => typeof cardId === 'string' && cardId)
      .slice(0, MAX_PACK_CARDS)
    : [];
  if (!cardIds.length) throw new Error('저장할 카드팩 결과가 없습니다.');
  const safeOpenedAt = Number.isFinite(Number(openedAt)) ? Number(openedAt) : Date.now();
  return {
    id: typeof id === 'string' && id ? id : openingId(safeOpenedAt),
    packId: 'standard',
    cardIds,
    pityTriggered: Boolean(pityTriggered),
    highestRarity: typeof highestRarity === 'string' ? highestRarity : '',
    revealedIndices: [],
    openedAt: safeOpenedAt,
  };
}

export function hydratePendingPackOpening(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id) return null;
  const cardIds = Array.isArray(value.cardIds)
    ? value.cardIds
      .filter((cardId) => typeof cardId === 'string' && cardId)
      .slice(0, MAX_PACK_CARDS)
    : [];
  if (!cardIds.length) return null;
  const openedAt = Number.isFinite(Number(value.openedAt)) ? Number(value.openedAt) : 0;
  return {
    id: value.id,
    packId: 'standard',
    cardIds,
    pityTriggered: Boolean(value.pityTriggered),
    highestRarity: typeof value.highestRarity === 'string' ? value.highestRarity : '',
    revealedIndices: uniqueIndices(value.revealedIndices, cardIds.length),
    openedAt,
  };
}

export function cardsForPendingPack(opening, resolveCard) {
  const normalized = hydratePendingPackOpening(opening);
  if (!normalized || typeof resolveCard !== 'function') return null;
  const cards = normalized.cardIds.map((cardId) => resolveCard(cardId));
  return cards.every(Boolean) ? cards : null;
}

export function revealPendingPackCard(opening, cardIndex, cards, requiresReveal) {
  const normalized = hydratePendingPackOpening(opening);
  const index = Number(cardIndex);
  if (!normalized || !Array.isArray(cards) || cards.length !== normalized.cardIds.length) {
    return { opening: normalized, changed: false, completed: false };
  }
  const requiredIndices = cards
    .map((card, candidate) => (requiresReveal(card, candidate) ? candidate : -1))
    .filter((candidate) => candidate >= 0);
  if (!Number.isInteger(index) || !requiredIndices.includes(index)) {
    return {
      opening: normalized,
      changed: false,
      completed: requiredIndices.every((candidate) => normalized.revealedIndices.includes(candidate)),
    };
  }
  const alreadyRevealed = normalized.revealedIndices.includes(index);
  const revealedIndices = alreadyRevealed
    ? normalized.revealedIndices
    : [...normalized.revealedIndices, index].sort((left, right) => left - right);
  return {
    opening: { ...normalized, revealedIndices },
    changed: !alreadyRevealed,
    completed: requiredIndices.every((candidate) => revealedIndices.includes(candidate)),
  };
}

export function unrevealedPackCardCount(opening, cards, requiresReveal) {
  const normalized = hydratePendingPackOpening(opening);
  if (!normalized || !Array.isArray(cards) || cards.length !== normalized.cardIds.length) return 0;
  return cards.reduce((count, card, index) => (
    count + (requiresReveal(card, index) && !normalized.revealedIndices.includes(index) ? 1 : 0)
  ), 0);
}
