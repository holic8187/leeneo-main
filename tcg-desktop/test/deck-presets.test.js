import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DECK_PRESETS,
  deckPresetCards,
  normalizeDeckPresets,
  saveDeckPreset,
} from '../src/core/deckPresets.js';

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
