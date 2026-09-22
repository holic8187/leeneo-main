import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hydrateRaidRewardClaims,
  reconcileRaidRewards,
} from '../src/core/raidRewards.js';

function gameState() {
  return {
    wallet: { coins: 100 },
    packs: { standard: 2 },
    collection: {},
    discoveredCardIds: [],
    cardProgression: {},
    relicInventory: {},
    raidRewardClaims: {},
  };
}

test('cumulative raid rewards are granted exactly once', () => {
  const game = gameState();
  const raid = {
    id: 'deadline-dragon-raid',
    dayKey: '2026-09-11',
    rewardKey: '2026-09-11:deadline-dragon-raid',
    clears: 1,
    earnedRewards: { coins: 0, packs: 3 },
  };
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: raid.rewardKey, coins: 0, packs: 3, bonuses: [],
  });
  assert.equal(game.wallet.coins, 100);
  assert.equal(game.packs.standard, 5);
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: raid.rewardKey, coins: 0, packs: 0, bonuses: [],
  });
  raid.clears = 2;
  raid.earnedRewards = { coins: 0, packs: 9 };
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: raid.rewardKey, coins: 0, packs: 6, bonuses: [],
  });
  assert.equal(game.wallet.coins, 100);
  assert.equal(game.packs.standard, 11);
});

test('legacy raid clears are baselined as already paid during migration', () => {
  const raid = { id: 'deadline-dragon-raid', dayKey: '2026-09-10', clears: 2 };
  assert.deepEqual(hydrateRaidRewardClaims(undefined, raid), {
    '2026-09-10:deadline-dragon-raid': { coins: 0, packs: 9, bonusIds: [] },
  });
});

test('legacy-compatible fallback follows the three-packs-per-stage schedule', () => {
  const game = gameState();
  const raid = {
    id: 'deadline-dragon-raid',
    dayKey: '2026-09-14',
    clears: 10,
  };
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: '2026-09-14:deadline-dragon-raid',
    coins: 0,
    packs: 165,
    bonuses: [],
  });
});

test('server-ledger card and relic bonuses are granted exactly once across refreshes', () => {
  const game = gameState();
  const raid = {
    id: 'deadline-dragon-raid',
    rewardKey: '2026-09-14:deadline-dragon-raid',
    earnedRewards: {
      coins: 0,
      packs: 108,
      bonuses: [
        { id: 'week:boss:stage-8:relic', type: 'relic', relicId: 'luxury-bag', quantity: 1, stage: 8 },
        { id: 'week:boss:stage-8:card', type: 'card', cardId: 'winter-sr', rarity: 'SR', quantity: 1, stage: 8 },
      ],
    },
  };
  const first = reconcileRaidRewards(game, raid);
  assert.equal(first.packs, 108);
  assert.deepEqual(first.bonuses.map(({ id }) => id), [
    'week:boss:stage-8:relic',
    'week:boss:stage-8:card',
  ]);
  assert.equal(game.relicInventory['luxury-bag'], 1);
  assert.equal(game.collection['winter-sr'], 1);
  assert.deepEqual(game.cardProgression['winter-sr'], { level: 1, experience: 0 });
  assert.deepEqual(game.discoveredCardIds, ['winter-sr']);

  const repeated = reconcileRaidRewards(game, raid);
  assert.deepEqual(repeated, {
    key: raid.rewardKey, coins: 0, packs: 0, bonuses: [],
  });
  assert.equal(game.relicInventory['luxury-bag'], 1);
  assert.equal(game.collection['winter-sr'], 1);

  raid.earnedRewards.bonuses.push({
    id: 'week:boss:stage-9:card', type: 'card', cardId: 'hoi-ur', rarity: 'ur', quantity: 1, stage: 9,
  });
  const next = reconcileRaidRewards(game, raid);
  assert.deepEqual(next.bonuses.map(({ id }) => id), ['week:boss:stage-9:card']);
  assert.equal(game.collection['hoi-ur'], 1);
  assert.deepEqual(game.raidRewardClaims[raid.rewardKey].bonusIds, [
    'week:boss:stage-8:relic',
    'week:boss:stage-8:card',
    'week:boss:stage-9:card',
  ]);
});

test('legacy claim hydration keeps bonus IDs and does not baseline ungranted bonuses', () => {
  const key = '2026-09-14:deadline-dragon-raid';
  assert.deepEqual(hydrateRaidRewardClaims({
    [key]: { coins: 0, packs: 3, bonusIds: ['bonus-1', 'bonus-1', '', 'bonus-2'] },
  }), {
    [key]: { coins: 0, packs: 3, bonusIds: ['bonus-1', 'bonus-2'] },
  });
  assert.deepEqual(hydrateRaidRewardClaims(undefined, {
    id: 'deadline-dragon-raid', dayKey: '2026-09-14', clears: 1,
    earnedRewards: {
      packs: 3,
      bonuses: [{ id: 'bonus-new', type: 'relic', relicId: 'luxury-bag' }],
    },
  })[key].bonusIds, []);
});
