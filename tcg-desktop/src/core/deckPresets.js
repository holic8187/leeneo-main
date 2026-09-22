import { MAX_SQUAD_SIZE, availableRaidSquad, uniqueSquadByIdentity } from './squadSelection.js';
import { equipmentById } from './equipment.js';
import { ownedRelic } from './relics.js';

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

export function createDeckPresetDraft(preset, slot, { identityForId = null } = {}) {
  const normalizedSlot = slotNumber(slot);
  const normalized = normalizeDeckPreset(
    preset && typeof preset === 'object' ? preset : {},
    normalizedSlot,
    { identityForId },
  );
  return {
    ...normalized,
    cardIds: [...normalized.cardIds],
  };
}

export function saveDeckPresetLoadout(presets, slot, {
  cardIds = [],
  equipmentCardId = '',
  artifactCardId,
  updatedAt = Date.now(),
  identityForId = null,
} = {}) {
  const normalizedSlot = slotNumber(slot);
  const normalized = normalizeDeckPresets(presets, { identityForId });
  const existing = normalized[normalizedSlot];
  return saveDeckPreset(normalized, normalizedSlot, {
    name: existing?.name || '',
    cardIds,
    equipmentCardId,
    // Omitted metadata is preserved for older callers, while an explicit
    // empty string unequips the relic in releases where the slot is editable.
    artifactCardId: artifactCardId === undefined
      ? (existing?.artifactCardId || '')
      : String(artifactCardId || '').trim(),
    updatedAt,
    identityForId,
  });
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

export function resolveDeckPresetLoadout(preset, {
  collection = {},
  equipmentInventory = [],
  relicInventory = {},
  expedition = null,
  context = 'adventure',
  identityForId = null,
} = {}) {
  const ownedCards = deckPresetCards(preset, { collection, identityForId });
  const cardIds = context === 'raid'
    ? availableRaidSquad(ownedCards, expedition, collection, { identityForId })
    : ownedCards;
  return {
    cardIds,
    equipmentCardId: equipmentById(equipmentInventory, preset?.equipmentCardId)?.id || '',
    artifactCardId: ownedRelic(relicInventory, preset?.artifactCardId)
      ? String(preset.artifactCardId).trim()
      : '',
    omittedCardCount: Math.max(0, (preset?.cardIds?.length || 0) - cardIds.length),
  };
}
