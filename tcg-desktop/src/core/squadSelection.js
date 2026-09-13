export const MAX_SQUAD_SIZE = 3;

export function toggleSquadSelection(selectedIds, cardId, {
  maxSize = MAX_SQUAD_SIZE,
  unavailableIds = [],
} = {}) {
  const normalizedCardId = String(cardId || '').trim();
  const selected = [...new Set(Array.isArray(selectedIds) ? selectedIds : [])]
    .filter(Boolean)
    .slice(0, Math.max(1, maxSize));
  if (!normalizedCardId) return selected;

  if (selected.includes(normalizedCardId)) {
    return selected.filter((id) => id !== normalizedCardId);
  }
  if (new Set(unavailableIds || []).has(normalizedCardId)) {
    return selected;
  }

  if (selected.length >= maxSize) selected.shift();
  selected.push(normalizedCardId);
  return selected;
}

export function availableRaidSquad(selectedIds, expedition, collection = null) {
  const deployedCounts = {};
  for (const cardId of Array.isArray(expedition?.squad) ? expedition.squad : []) {
    deployedCounts[cardId] = (deployedCounts[cardId] || 0) + 1;
  }
  const hasCollection = collection && typeof collection === 'object';
  return [...new Set(Array.isArray(selectedIds) ? selectedIds : [])]
    .filter((cardId) => {
      if (!cardId) return false;
      const deployed = deployedCounts[cardId] || 0;
      if (!deployed) return true;
      if (!hasCollection) return false;
      const owned = Math.max(0, Math.floor(Number(collection[cardId]) || 0));
      return owned > deployed;
    })
    .slice(0, MAX_SQUAD_SIZE);
}
