import { RARITY_ORDER } from '../data/cardCatalog.js';

export function packCardRequiresReveal(card, index, newIndices = []) {
  return newIndices.includes(index) || RARITY_ORDER.indexOf(card?.rarity) >= RARITY_ORDER.indexOf('sr');
}

export function packPresentation(cards = [], newIndices = [], revealedIndices = []) {
  const fresh = new Set(newIndices);
  const revealed = new Set(revealedIndices);
  const showcaseIndices = cards.flatMap((card, index) => packCardRequiresReveal(card, index, newIndices) ? [index] : []);
  const hiddenIndices = showcaseIndices.filter((index) => !revealed.has(index));
  const hiddenIds = new Set(hiddenIndices.map((index) => cards[index].id));
  const groups = new Map();
  cards.forEach((card, index) => {
    // A second copy of a first discovery must not spoil its still-hidden face.
    if (fresh.has(index) || hiddenIds.has(card.id)) return;
    const group = groups.get(card.id) || { card, count: 0 };
    group.count += 1;
    groups.set(card.id, group);
  });
  return { showcaseIndices, hiddenIndices, duplicateGroups: [...groups.values()] };
}

export function packShowcaseFocus(presentation, requested) {
  return presentation.showcaseIndices.includes(requested)
    ? requested : presentation.hiddenIndices[0] ?? presentation.showcaseIndices[0] ?? -1;
}
