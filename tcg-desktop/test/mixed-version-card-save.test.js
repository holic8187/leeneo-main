import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CARDS } from '../src/data/cardCatalog.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { createCloudPlaySession } from '../src/core/cloudPlaySession.js';
import { cardsForPendingPack, createPendingPackOpening } from '../src/core/packOpeningSession.js';
import { createGameStore as createLegacyStore } from './fixtures/v0.11.0/gameState.js';
import { LEGACY_CARDS, cardById as legacyCardById } from './fixtures/v0.11.0/cardCatalog.js';
import playerStateService from '../../src/tcg/services/playerStateService.js';

const { normalizeGameState, serializePlayerState } = playerStateService;
const legacyIds = new Set(LEGACY_CARDS.map(card => card.id));
const newCards = ALL_CARDS.filter(card => !legacyIds.has(card.id));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('0.11 PC/mobile roundtrip retains all 29 new card IDs, progression, hidden pack and 0.12 settings', async () => {
  assert.equal(newCards.length, 29);
  assert.ok(newCards.every(card => legacyCardById(card.id) === null));
  const latest = createDefaultState(1000);
  for (const card of newCards) {
    latest.collection[card.id] = 2;
    latest.cardEnhancements[card.id] = { 5: 1 };
    latest.cardProgression[card.id] = { level: 43, experience: 81 };
  }
  latest.discoveredCardIds.push(...newCards.map(card => card.id));
  latest.lockedCardIds = newCards.map(card => card.id);
  latest.settings.raidSecretMode = true;
  latest.settings.expeditionNotifications = false;
  const squad = ['gyullak-ssr', 'eungga-ssr', 'pie-ssr', 'wollu-ssr'];
  latest.selectedRaidSquad = squad;
  latest.selectedExpeditionSquad = squad;
  latest.deckPresets[0] = { id: 'deck-preset-1', name: '새 카드 덱', cardIds: squad, equipmentCardId: '', artifactCardId: '', updatedAt: 1000 };
  latest.pendingPackOpening = createPendingPackOpening({ cards: [...newCards, ...newCards.slice(0, 21)], packCount: 10, id: 'new-cards-pending', openedAt: 1000 });
  latest.pendingPackOpening.revealedIndices = [0, 1, 2];
  const storage = memoryStorage();
  const oldStore = createLegacyStore(storage, { userId: 'mixed-011-account' });
  let serverState = normalizeGameState(latest);
  let revision = 1;
  const response = () => ({
    ...serializePlayerState({ state: serverState, initialized: true, revision }, 1000),
    leaseId: 'legacy-lease', generation: 1, expiresAt: 100000,
  });
  // The production cloud transport is byte-for-byte unchanged since 0.11.
  const cloud = createCloudPlaySession({
    accountId: 'mixed-011-account', storage, token: 'test-token',
    deviceId: 'older-mobile', platform: 'android', appVersion: '0.11.0',
    gateway: {
      async open() { return response(); },
      async saveState(_token, body) {
        assert.equal(body.baseRevision, revision);
        serverState = normalizeGameState(body.state);
        revision += 1;
        return response();
      },
    },
    onRemoteState: remote => oldStore.replace(remote),
  });
  try {
    await cloud.open();
    for (let index = 0; index < 3; index += 1) {
      oldStore.update(draft => {
        draft.wallet.coins += 17;
        draft.collection['winter-c'] += 1;
      });
      cloud.queueState(oldStore.flush());
      await cloud.flush();
    }
    const persisted = JSON.parse(storage.getItem(oldStore.storageKey));
    assert.equal(persisted.version, 9, 'old schema marker alone is not ownership loss');
    assert.equal(cardsForPendingPack(persisted.pendingPackOpening, legacyCardById), null);
    assert.deepEqual(persisted.pendingPackOpening, latest.pendingPackOpening, 'unrenderable pack remains resumable after update');
    const restored = hydrateState(response().state);
    for (const card of newCards) {
      assert.equal(restored.collection[card.id], 2, card.id);
      assert.deepEqual(restored.cardEnhancements[card.id], { 5: 1 }, card.id);
      assert.deepEqual(restored.cardProgression[card.id], { level: 43, experience: 81 }, card.id);
      assert.ok(restored.discoveredCardIds.includes(card.id));
      assert.ok(restored.lockedCardIds.includes(card.id));
    }
    assert.equal(restored.wallet.coins, latest.wallet.coins + 51);
    assert.deepEqual(restored.selectedRaidSquad, squad);
    assert.deepEqual(restored.selectedExpeditionSquad, squad);
    assert.deepEqual(restored.deckPresets[0].cardIds, squad);
    assert.deepEqual(restored.pendingPackOpening, latest.pendingPackOpening);
    assert.equal(restored.settings.raidSecretMode, true);
    assert.equal(restored.settings.expeditionNotifications, false);
    assert.equal(Object.hasOwn(restored, 'activeIncident'), false);
    assert.equal(Object.hasOwn(restored.settings, 'incidentNotifications'), false);
  } finally {
    cloud.dispose();
  }
});
