const cardIdOf = (card) => (typeof card === 'string' ? card : card?.id);

export function newCardIndices(cards = [], discoveredCardIds = []) {
  const known = new Set(Array.isArray(discoveredCardIds) ? discoveredCardIds : []);
  const indices = [];
  for (const [index, card] of cards.entries()) {
    const cardId = cardIdOf(card);
    if (!cardId || known.has(cardId)) continue;
    indices.push(index);
    known.add(cardId);
  }
  return indices;
}

export function registerDiscoveredCards(discoveredCardIds = [], cards = []) {
  const known = new Set(Array.isArray(discoveredCardIds) ? discoveredCardIds : []);
  for (const card of cards) {
    const cardId = cardIdOf(card);
    if (cardId) known.add(cardId);
  }
  return [...known];
}
