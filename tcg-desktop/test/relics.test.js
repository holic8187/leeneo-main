import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RELIC_CATALOG,
  addRelicToInventory,
  expeditionCoinMultiplierForRelic,
  normalizeRelicInventory,
  ownedRelic,
  relicById,
} from '../src/core/relics.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';

test('luxury bag is catalogued with the expedition coin effect', () => {
  assert.equal(RELIC_CATALOG.length, 1);
  assert.deepEqual(relicById('luxury-bag'), {
    id: 'luxury-bag',
    name: '명품 가방',
    description: '누군가가 극도로 싫어하는 가방입니다. 들리는 소문으로는 그 사람이 누군가에게 속아 비싸게 구매한 가방이라는 소문이 있습니다...',
    image: './assets/relics/luxury-bag.png',
    effect: { type: 'expedition-coin-multiplier', percent: 5 },
  });
  assert.equal(expeditionCoinMultiplierForRelic('luxury-bag'), 1.05);
  assert.equal(expeditionCoinMultiplierForRelic('future-relic'), 1);
});

test('relic inventory keeps future IDs but only catalogued relics are equippable', () => {
  const normalized = normalizeRelicInventory({
    'luxury-bag': 1.9,
    'future-relic': 2,
    invalid: 0,
  });
  assert.deepEqual(normalized, { 'luxury-bag': 1, 'future-relic': 2 });
  assert.equal(ownedRelic(normalized, 'luxury-bag'), true);
  assert.equal(ownedRelic(normalized, 'future-relic'), false);
  assert.deepEqual(addRelicToInventory(normalized, 'luxury-bag'), {
    'luxury-bag': 2,
    'future-relic': 2,
  });
});

test('game state hydrates owned relic selections and completed expedition metadata', () => {
  assert.deepEqual(createDefaultState().relicInventory, {});
  assert.equal(createDefaultState().lastCompletedExpedition, null);
  const hydrated = hydrateState({
    relicInventory: { 'luxury-bag': 1, 'future-relic': 3 },
    selectedExpeditionArtifactId: 'luxury-bag',
    selectedRaidArtifactId: 'future-relic',
    lastCompletedExpedition: { missionId: 'night-shift', relicId: 'luxury-bag', coins: 105 },
  });
  assert.deepEqual(hydrated.relicInventory, { 'luxury-bag': 1, 'future-relic': 3 });
  assert.equal(hydrated.selectedExpeditionArtifactId, 'luxury-bag');
  assert.equal(hydrated.selectedRaidArtifactId, 'future-relic');
  assert.deepEqual(hydrated.lastCompletedExpedition, {
    missionId: 'night-shift', relicId: 'luxury-bag', coins: 105,
  });
  assert.equal(hydrateState({ lastCompletedExpedition: [] }).lastCompletedExpedition, null);
});
