import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeckPresetDraft,
  MAX_DECK_PRESETS,
  deckPresetCards,
  normalizeDeckPresets,
  resolveDeckPresetLoadout,
  saveDeckPreset,
  saveDeckPresetLoadout,
} from '../src/core/deckPresets.js';
import { createEquipment } from '../src/core/equipment.js';
import { hydrateState } from '../src/core/gameState.js';

test('deck presets preserve five slots and four unique character cards', () => {
  const identity = (cardId) => String(cardId).split('-')[0];
  const presets = saveDeckPreset([], 1, {
    name: '주력 덱',
    cardIds: ['winter-c', 'winter-ur', 'hoi-c', 'mango-c', 'guma-c', 'pie-c'],
    identityForId: identity,
    updatedAt: 1234,
  });

  assert.equal(presets.length, MAX_DECK_PRESETS);
  assert.deepEqual(presets[1], {
    id: 'deck-preset-2',
    name: '주력 덱',
    cardIds: ['winter-c', 'hoi-c', 'mango-c', 'guma-c'],
    equipmentCardId: '',
    artifactCardId: '',
    updatedAt: 1234,
  });
});

test('loading a preset omits missing and unavailable cards', () => {
  const [preset] = normalizeDeckPresets([{
    cardIds: ['winter-c', 'hoi-c', 'mango-c', 'guma-c'],
  }]);
  assert.deepEqual(deckPresetCards(preset, {
    collection: { 'winter-c': 1, 'hoi-c': 1, 'mango-c': 0, 'guma-c': 1 },
    unavailableIds: ['hoi-c'],
  }), ['winter-c', 'guma-c']);
});

test('one saved preset loads the same cards and equipment in adventure and raid without modifying the preset', () => {
  const equipment = createEquipment({ type: 'weapon', rarity: 'ur', random: () => 0.5, idFactory: () => 'shared-weapon' });
  const cardIds = ['winter-c', 'hoi-c', 'mango-c', 'simsim-c'];
  const presets = saveDeckPreset([], 4, { cardIds, equipmentCardId: equipment.id });
  const state = hydrateState({ version: 9, deckPresets: presets, collection: Object.fromEntries(cardIds.map((id) => [id, 1])), equipmentInventory: [equipment] });
  assert.deepEqual(state.deckPresets, presets);
  const options = { collection: state.collection, equipmentInventory: state.equipmentInventory };
  const adventure = resolveDeckPresetLoadout(state.deckPresets[4], { ...options, context: 'adventure' });
  const raid = resolveDeckPresetLoadout(state.deckPresets[4], { ...options, context: 'raid' });
  assert.deepEqual(adventure, raid);
  assert.deepEqual(adventure.cardIds, cardIds);
  assert.equal(adventure.equipmentCardId, equipment.id);
  assert.deepEqual(state.deckPresets, presets);
});

test('preset relic loadout is saved explicitly and only loads when owned', () => {
  const presets = saveDeckPresetLoadout([], 0, {
    cardIds: ['winter-c'],
    artifactCardId: 'luxury-bag',
    updatedAt: 99,
  });
  assert.equal(presets[0].artifactCardId, 'luxury-bag');
  assert.equal(resolveDeckPresetLoadout(presets[0], {
    collection: { 'winter-c': 1 },
    relicInventory: { 'luxury-bag': 1 },
  }).artifactCardId, 'luxury-bag');
  assert.equal(resolveDeckPresetLoadout(presets[0], {
    collection: { 'winter-c': 1 },
    relicInventory: {},
  }).artifactCardId, '');

  const unequipped = saveDeckPresetLoadout(presets, 0, {
    cardIds: ['winter-c'],
    artifactCardId: '',
    updatedAt: 100,
  });
  assert.equal(unequipped[0].artifactCardId, '');
});

test('raid loading skips deployed single copies but retains free duplicates and the shared saved deck', () => {
  const [preset] = normalizeDeckPresets([{ cardIds: ['winter-c', 'hoi-c', 'mango-c', 'simsim-c'], equipmentCardId: 'missing' }]);
  const options = { collection: { 'winter-c': 1, 'hoi-c': 2, 'mango-c': 0, 'simsim-c': 1 }, expedition: { squad: ['winter-c', 'hoi-c'] } };
  const loaded = resolveDeckPresetLoadout(preset, { ...options, context: 'raid' });
  assert.deepEqual(loaded.cardIds, ['hoi-c', 'simsim-c']);
  assert.equal(loaded.equipmentCardId, '');
  assert.equal(loaded.omittedCardCount, 2);
  assert.equal(preset.cardIds.length, 4);
  assert.deepEqual(resolveDeckPresetLoadout(preset, { ...options, context: 'adventure' }).cardIds, ['winter-c', 'hoi-c', 'simsim-c']);
});

test('editing a preset preserves its name, unavailable cards, missing equipment, and reserved metadata', () => {
  const original = saveDeckPreset([], 2, {
    name: '겨울 원정대',
    cardIds: ['winter-c', 'future-card'],
    equipmentCardId: 'missing-equipment',
    artifactCardId: 'future-artifact',
    updatedAt: 123,
  });
  const hydrated = hydrateState({
    version: 9,
    deckPresets: original,
    collection: { 'winter-c': 1, 'future-card': 0 },
    equipmentInventory: [],
  });
  const draft = createDeckPresetDraft(hydrated.deckPresets[2], 2);

  assert.deepEqual(draft.cardIds, ['winter-c', 'future-card']);
  assert.equal(draft.equipmentCardId, 'missing-equipment');
  draft.cardIds.push('hoi-c');

  const saved = saveDeckPresetLoadout(hydrated.deckPresets, 2, {
    cardIds: draft.cardIds,
    equipmentCardId: draft.equipmentCardId,
    updatedAt: 456,
  });
  assert.deepEqual(saved[2], {
    id: 'deck-preset-3',
    name: '겨울 원정대',
    cardIds: ['winter-c', 'future-card', 'hoi-c'],
    equipmentCardId: 'missing-equipment',
    artifactCardId: 'future-artifact',
    updatedAt: 456,
  });
});
