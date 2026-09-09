const clampRandom = (value) => Math.min(0.999999999, Math.max(0, Number(value) || 0));

export function rollWeightedRarity(weights, random = Math.random) {
  const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  if (!entries.length || total <= 0) throw new Error('At least one positive rarity weight is required.');
  let cursor = clampRandom(random()) * total;

  for (const [rarity, weight] of entries) {
    cursor -= Number(weight);
    if (cursor < 0) return rarity;
  }
  return entries.at(-1)[0];
}

function rarityOrderFor(definition) {
  const configured = Array.isArray(definition.rarityOrder) ? definition.rarityOrder : [];
  const weighted = Object.keys(definition.weights || {});
  return [...new Set([...configured, ...weighted])];
}

function isAtLeast(rarity, minimum, order) {
  const rarityRank = order.indexOf(rarity);
  const minimumRank = order.indexOf(minimum);
  return rarityRank >= 0 && minimumRank >= 0 && rarityRank >= minimumRank;
}

function rollAtLeast(weights, minimum, order, random) {
  const eligible = Object.fromEntries(
    Object.entries(weights).filter(([rarity, weight]) => (
      Number(weight) > 0 && isAtLeast(rarity, minimum, order)
    )),
  );
  if (!Object.keys(eligible).length) {
    throw new Error(`No weighted rarity configured at or above: ${minimum}`);
  }
  return rollWeightedRarity(eligible, random);
}

export function pickCard(catalog, rarity, random = Math.random) {
  const pool = catalog.filter((card) => card.rarity === rarity);
  if (!pool.length) {
    throw new Error(`No cards configured for rarity: ${rarity}`);
  }
  return pool[Math.floor(clampRandom(random()) * pool.length)];
}

export function openPack({ catalog, definition, pity = 0, random = Math.random }) {
  const cards = [];
  const order = rarityOrderFor(definition);
  const guaranteedRarity = definition.guaranteedRarity;
  const legacyPity = Number(definition.epicPityPacks) > 0;
  const pityRarity = definition.pityRarity || (legacyPity ? 'epic' : null);
  const configuredPityPacks = definition.pityPacks ?? definition.epicPityPacks;
  const pityPacks = Math.max(1, Math.floor(Number(configuredPityPacks) || 0));
  const currentPity = Math.max(0, Math.floor(Number(pity) || 0));
  const pityEnabled = Boolean(pityRarity && Number(configuredPityPacks) > 0);
  const forcePity = pityEnabled && currentPity >= pityPacks - 1;
  let pityTriggered = false;

  for (let index = 0; index < definition.cardCount; index += 1) {
    const isLast = index === definition.cardCount - 1;
    let rarity = rollWeightedRarity(definition.weights, random);

    if (isLast && forcePity) {
      const packAlreadyQualifies = cards.some((card) => isAtLeast(card.rarity, pityRarity, order));
      if (!packAlreadyQualifies && !isAtLeast(rarity, pityRarity, order)) {
        rarity = rollAtLeast(definition.weights, pityRarity, order, random);
        pityTriggered = true;
      }
    }

    if (isLast && guaranteedRarity) {
      const packAlreadyQualifies = cards.some((card) => isAtLeast(card.rarity, guaranteedRarity, order));
      if (!packAlreadyQualifies && !isAtLeast(rarity, guaranteedRarity, order)) {
        rarity = rollAtLeast(definition.weights, guaranteedRarity, order, random);
      }
    }

    cards.push(pickCard(catalog, rarity, random));
  }

  const foundPityRarity = pityEnabled
    && cards.some((card) => isAtLeast(card.rarity, pityRarity, order));
  return {
    cards,
    nextPity: pityEnabled ? (foundPityRarity ? 0 : currentPity + 1) : currentPity,
    pityTriggered,
  };
}

export function addCardsToCollection(collection, cards) {
  const next = { ...collection };
  for (const card of cards) {
    next[card.id] = Math.max(0, Number(next[card.id]) || 0) + 1;
  }
  return next;
}
