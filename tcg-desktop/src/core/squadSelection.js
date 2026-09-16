export const MAX_SQUAD_SIZE = 3;

const identityOf = (cardId, identityForId) => (
  String(typeof identityForId === 'function' ? identityForId(cardId) : cardId || '').trim()
  || String(cardId || '').trim()
);

export function uniqueSquadByIdentity(selectedIds, identityForId = null, maxSize = MAX_SQUAD_SIZE) {
  const identities = new Set();
  const selected = [];
  for (const rawId of Array.isArray(selectedIds) ? selectedIds : []) {
    const cardId = String(rawId || '').trim();
    if (!cardId) continue;
    const identity = identityOf(cardId, identityForId);
    if (identities.has(identity)) continue;
    identities.add(identity);
    selected.push(cardId);
    if (selected.length >= Math.max(1, maxSize)) break;
  }
  return selected;
}

export function toggleSquadSelection(selectedIds, cardId, {
  maxSize = MAX_SQUAD_SIZE,
  unavailableIds = [],
  identityForId = null,
} = {}) {
  const normalizedCardId = String(cardId || '').trim();
  const selected = uniqueSquadByIdentity(selectedIds, identityForId, maxSize);
  if (!normalizedCardId) return selected;

  if (selected.includes(normalizedCardId)) {
    return selected.filter((id) => id !== normalizedCardId);
  }
  if (new Set(unavailableIds || []).has(normalizedCardId)) {
    return selected;
  }

  const nextIdentity = identityOf(normalizedCardId, identityForId);
  const sameCharacterIndex = selected.findIndex((id) => identityOf(id, identityForId) === nextIdentity);
  if (sameCharacterIndex >= 0) {
    selected[sameCharacterIndex] = normalizedCardId;
    return selected;
  }

  if (selected.length >= maxSize) selected.shift();
  selected.push(normalizedCardId);
  return selected;
}

export function availableRaidSquad(
  selectedIds,
  expedition,
  collection = null,
  { identityForId = null } = {},
) {
  const deployedCounts = {};
  for (const cardId of Array.isArray(expedition?.squad) ? expedition.squad : []) {
    deployedCounts[cardId] = (deployedCounts[cardId] || 0) + 1;
  }
  const hasCollection = collection && typeof collection === 'object';
  return uniqueSquadByIdentity(selectedIds, identityForId)
    .filter((cardId) => {
      const deployed = deployedCounts[cardId] || 0;
      if (!deployed) return true;
      if (!hasCollection) return false;
      const owned = Math.max(0, Math.floor(Number(collection[cardId]) || 0));
      return owned > deployed;
    })
    .slice(0, MAX_SQUAD_SIZE);
}
