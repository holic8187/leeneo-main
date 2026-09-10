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

export function availableRaidSquad(selectedIds, expedition) {
  const deployed = new Set(Array.isArray(expedition?.squad) ? expedition.squad : []);
  return [...new Set(Array.isArray(selectedIds) ? selectedIds : [])]
    .filter((id) => id && !deployed.has(id))
    .slice(0, MAX_SQUAD_SIZE);
}
