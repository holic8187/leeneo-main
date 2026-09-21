import { MAX_SQUAD_SIZE, uniqueSquadByIdentity } from './squadSelection.js';

export const MAX_DECK_PRESETS = 5;

const slotNumber = (value) => Math.max(0, Math.min(
  MAX_DECK_PRESETS - 1,
  Math.floor(Number(value) || 0),
));

const normalizeName = (value, slot) => {
  const name = String(value || '').trim().slice(0, 24);
  return name || `프리셋 ${slot + 1}`;
};

export function normalizeDeckPreset(value, slot, { identityForId = null } = {}) {
  if (!value || typeof value !== 'object') return null;
  const normalizedSlot = slotNumber(slot);
  return {
    id: `deck-preset-${normalizedSlot + 1}`,
    name: normalizeName(value.name, normalizedSlot),
    cardIds: uniqueSquadByIdentity(value.cardIds, identityForId, MAX_SQUAD_SIZE),
    equipmentCardId: String(value.equipmentCardId || '').trim(),
    artifactCardId: String(value.artifactCardId || '').trim(),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
  };
}

export function normalizeDeckPresets(value, options = {}) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: MAX_DECK_PRESETS }, (_, slot) => (
    normalizeDeckPreset(source[slot], slot, options)
  ));
}

export function saveDeckPreset(presets, slot, {
  name = '',
  cardIds = [],
  equipmentCardId = '',
  artifactCardId = '',
  updatedAt = Date.now(),
  identityForId = null,
} = {}) {
  const normalizedSlot = slotNumber(slot);
  const next = normalizeDeckPresets(presets, { identityForId });
  next[normalizedSlot] = normalizeDeckPreset({
    name,
    cardIds,
    equipmentCardId,
    artifactCardId,
    updatedAt,
  }, normalizedSlot, { identityForId });
  return next;
}

export function deckPresetCards(preset, {
  collection = {},
  unavailableIds = [],
  identityForId = null,
} = {}) {
  const blocked = new Set((Array.isArray(unavailableIds) ? unavailableIds : []).map(String));
  return uniqueSquadByIdentity(preset?.cardIds, identityForId, MAX_SQUAD_SIZE)
    .filter((cardId) => Math.max(0, Number(collection?.[cardId]) || 0) > 0)
    .filter((cardId) => !blocked.has(cardId));
}
