// Navigation is a local, account-scoped convenience, never a second game save.
// Keep this allowlist deliberately separate from auth, rewards and battle state.
import { RARITY_ORDER } from '../data/cardCatalog.js';
const PREFIX = 'hoi-card-desk-navigation-v1:';
const oneOf = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const text = (value, max = 120) => typeof value === 'string' ? value.slice(0, max) : '';
const integer = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
export const navigationSnapshotKey = (accountId) => accountId ? `${PREFIX}${encodeURIComponent(String(accountId))}` : '';

export function sanitizeNavigationSnapshot(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const modal = source.modal;
  let safeModal = null;
  if (modal?.type === 'card' && text(modal.cardId)) safeModal = { type: 'card', cardId: text(modal.cardId) };
  if (modal?.type === 'deck-preset') safeModal = {
    type: 'deck-preset', slot: integer(modal.slot, 4), saveCopy: Boolean(modal.saveCopy),
    cardIds: [...new Set((Array.isArray(modal.cardIds) ? modal.cardIds : []).map((id) => text(id)).filter(Boolean))].slice(0, 4),
    equipmentCardId: text(modal.equipmentCardId), artifactCardId: text(modal.artifactCardId),
  };
  if (modal?.type === 'pack' && text(modal.openingId)) safeModal = {
    type: 'pack', openingId: text(modal.openingId), focusIndex: integer(modal.focusIndex, 99),
  };
  if (modal?.type === 'settings') safeModal = { type: 'settings' };
  const scroll = {};
  for (const [key, position] of Object.entries(source.scroll || {}).slice(0, 60)) {
    if (!/^(view:(dashboard|collection|management|mailbox|adventure|raid):|global:sidebar:|modal:(card|deck-preset|pack|settings):)/.test(key)) continue;
    scroll[text(key)] = { top: integer(position?.top, 100000), left: integer(position?.left, 100000) };
  }
  return {
    version: 1,
    view: oneOf(source.view, ['dashboard', 'collection', 'management', 'mailbox', 'adventure', 'raid'], 'dashboard'),
    selectedMissionId: text(source.selectedMissionId), missionListExpanded: Boolean(source.missionListExpanded),
    rarityFilter: oneOf(source.rarityFilter, ['all', ...RARITY_ORDER], 'all'),
    collectionOwnedOnly: Boolean(source.collectionOwnedOnly),
    collectionSort: oneOf(source.collectionSort, ['rarity-asc', 'rarity-desc', 'name', 'power'], 'rarity-asc'),
    collectionQuery: text(source.collectionQuery, 80),
    managementPanel: oneOf(source.managementPanel, ['enhance', 'synthesis'], 'enhance'),
    enhanceCardId: text(source.enhanceCardId),
    synthesisRarity: oneOf(source.synthesisRarity, RARITY_ORDER.slice(0, -1), 'c'),
    raidMode: oneOf(source.raidMode, ['personal', 'cooperative'], 'personal'),
    raidPanel: oneOf(source.raidPanel, ['battle', 'ranking'], 'battle'),
    loadoutPanel: Object.fromEntries(['adventure', 'raid', 'preset'].map((key) => [key, oneOf(source.loadoutPanel?.[key], ['cards', 'equipment'], 'cards')])),
    modal: safeModal, scroll,
  };
}

export function createNavigationSnapshotStore(storage = globalThis.localStorage) {
  return {
    read(accountId) {
      try {
        const key = navigationSnapshotKey(accountId);
        const raw = key && storage?.getItem?.(key);
        return raw && raw.length <= 24000 ? sanitizeNavigationSnapshot(JSON.parse(raw)) : null;
      } catch { return null; }
    },
    save(accountId, value) {
      try {
        const key = navigationSnapshotKey(accountId);
        if (!key) return false;
        storage?.setItem?.(key, JSON.stringify(sanitizeNavigationSnapshot(value)));
        return true;
      } catch { return false; }
    },
  };
}
