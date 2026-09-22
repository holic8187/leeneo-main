import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { createCloudPlaySession } from '../src/core/cloudPlaySession.js';
import { enhancementCountsForCard } from '../src/core/cardManagement.js';
import {
  hydrateRaidBonusRewardClaims,
  reconcileRaidRewards,
} from '../src/core/raidRewards.js';
import { createGameStore as createLegacyGameStore } from './fixtures/v0.9.2/gameState.js';
import { reconcileRaidRewards as reconcileLegacyRaidRewards } from './fixtures/v0.9.2/raidRewards.js';
import playerStateService from '../../src/tcg/services/playerStateService.js';

const { normalizeGameState, serializePlayerState } = playerStateService;
const KEY = '2026-09-21:deadline-dragon-raid';
const CARD_BONUS = { id: `${KEY}:stage-8:card`, type: 'card', cardId: 'hoi-ssr', rarity: 'ssr', quantity: 1, stage: 8 };
const RELIC_BONUS = { id: `${KEY}:stage-8:relic`, type: 'relic', relicId: 'luxury-bag', quantity: 1, stage: 8 };
const RAID = { rewardKey: KEY, earnedRewards: { coins: 0, packs: 108, bonuses: [CARD_BONUS, RELIC_BONUS] } };

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('bonus claims merge nested migration IDs with the independent top-level ledger', () => {
  const state = hydrateState({
    raidRewardClaims: { [KEY]: { coins: 0, packs: 108, bonusIds: [CARD_BONUS.id] } },
    raidBonusRewardClaims: { [KEY]: [RELIC_BONUS.id, RELIC_BONUS.id, ''] },
    collection: { 'hoi-ssr': 1 },
    relicInventory: { 'luxury-bag': 1 },
  });
  assert.deepEqual(state.raidBonusRewardClaims[KEY], [CARD_BONUS.id, RELIC_BONUS.id]);
  assert.deepEqual(reconcileRaidRewards(state, RAID).bonuses, []);
  assert.equal(state.collection['hoi-ssr'], 1);
  assert.equal(state.relicInventory['luxury-bag'], 1);

  const nestedOnly = hydrateState({
    raidRewardClaims: { [KEY]: { packs: 108, bonusIds: [CARD_BONUS.id] } },
    collection: { 'hoi-ssr': 1 },
  });
  assert.deepEqual(nestedOnly.raidBonusRewardClaims[KEY], [CARD_BONUS.id]);
  assert.deepEqual(reconcileRaidRewards(nestedOnly, RAID).bonuses, [RELIC_BONUS]);
  assert.equal(nestedOnly.collection['hoi-ssr'], 1);
  assert.equal(nestedOnly.relicInventory['luxury-bag'], 1);
});

test('bonus ledger normalization bounds records and never baselines unclaimed server bonuses', () => {
  assert.deepEqual(createDefaultState().raidBonusRewardClaims, {});
  assert.deepEqual(hydrateRaidBonusRewardClaims(null), {});
  assert.deepEqual(hydrateRaidBonusRewardClaims({ empty: [], invalid: {}, [KEY]: ['one', 'one', '', 'two'] }), { [KEY]: ['one', 'two'] });
  const records = Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`week-${index}`, [`bonus-${index}`]]));
  assert.equal(Object.keys(hydrateRaidBonusRewardClaims(records)).length, 45);
  assert.equal(Object.keys(hydrateRaidBonusRewardClaims(records))[0], 'week-3');
  const state = hydrateState({ raid: { ...RAID, clears: 8 } });
  assert.deepEqual(state.raidBonusRewardClaims, {});
  assert.equal(reconcileRaidRewards(state, RAID).bonuses.length, 2);
});

test('0.9.2 hydration, local persistence and cloud save preserve bonus ownership without paying it twice', async () => {
  const state = createDefaultState(1000);
  state.collection['hoi-ssr'] = 2;
  state.cardEnhancements['hoi-ssr'] = { 3: 1, 5: 1 };
  state.cardProgression['hoi-ssr'] = { level: 43, experience: 81 };
  reconcileRaidRewards(state, RAID);
  const paidIds = [CARD_BONUS.id, RELIC_BONUS.id];
  assert.deepEqual(state.raidBonusRewardClaims[KEY], paidIds);

  // The real 0.9.2 hydration code reconstructs nested claims, but spreads the
  // top-level object. Exercise its store and the production cloud transport,
  // including server JSON normalization, rather than simulating that spread.
  const storage = memoryStorage();
  const legacyStore = createLegacyGameStore(storage, { userId: 'mixed-version-account' });
  let serverState = normalizeGameState(state);
  let revision = 1;
  const response = () => ({
    ...serializePlayerState({ state: serverState, initialized: true, revision }, 1000),
    leaseId: 'mixed-version-lease', generation: 1, expiresAt: 100000,
  });
  const cloud = createCloudPlaySession({
    accountId: 'mixed-version-account', storage,
    token: 'test-token', deviceId: 'older-pc-device', platform: 'pc', appVersion: '0.9.2',
    gateway: {
      async open() { return response(); },
      async saveState(_token, body) {
        serverState = normalizeGameState(body.state);
        revision += 1;
        return response();
      },
    },
    onRemoteState: (remote) => legacyStore.replace(remote),
  });
  try {
    await cloud.open();
    legacyStore.update((draft) => {
      reconcileLegacyRaidRewards(draft, RAID);
      draft.wallet.coins += 17;
    });
    const oldSnapshot = JSON.parse(storage.getItem(legacyStore.storageKey));
    assert.equal(oldSnapshot.raidRewardClaims[KEY].bonusIds, undefined);
    assert.deepEqual(oldSnapshot.raidBonusRewardClaims[KEY], paidIds);
    assert.equal(oldSnapshot.relicInventory['luxury-bag'], 1);
    cloud.queueState(oldSnapshot);
    await cloud.flush();

    const restored = hydrateState(response().state);
    assert.deepEqual(restored.raidBonusRewardClaims[KEY], paidIds);
    assert.deepEqual(reconcileRaidRewards(restored, RAID), { key: KEY, coins: 0, packs: 0, bonuses: [] });
    assert.equal(restored.collection['hoi-ssr'], 3);
    assert.equal(restored.relicInventory['luxury-bag'], 1);
    assert.equal(restored.wallet.coins, state.wallet.coins + 17);
    assert.deepEqual(enhancementCountsForCard(restored.collection, restored.cardEnhancements, 'hoi-ssr'), [1, 0, 0, 1, 0, 1]);
    assert.deepEqual(restored.cardProgression['hoi-ssr'], { level: 43, experience: 81 });
  } finally {
    cloud.dispose();
  }
});

test('bonuses first earned by an older client remain claimable once after upgrade', () => {
  const oldStore = createLegacyGameStore(memoryStorage());
  oldStore.update((draft) => { reconcileLegacyRaidRewards(draft, RAID); });
  const upgraded = hydrateState(oldStore.getState());
  assert.deepEqual(upgraded.raidBonusRewardClaims, {});
  assert.equal(reconcileRaidRewards(upgraded, RAID).bonuses.length, 2);
  assert.equal(upgraded.collection['hoi-ssr'], 1);
  assert.equal(upgraded.relicInventory['luxury-bag'], 1);
  assert.equal(reconcileRaidRewards(upgraded, RAID).bonuses.length, 0);
});
