import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hydrateRaidRewardClaims,
  reconcileRaidRewards,
} from '../src/core/raidRewards.js';

function gameState() {
  return { wallet: { coins: 100 }, packs: { standard: 2 }, raidRewardClaims: {} };
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
    key: raid.rewardKey, coins: 0, packs: 3,
  });
  assert.equal(game.wallet.coins, 100);
  assert.equal(game.packs.standard, 5);
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: raid.rewardKey, coins: 0, packs: 0,
  });
  raid.clears = 2;
  raid.earnedRewards = { coins: 0, packs: 9 };
  assert.deepEqual(reconcileRaidRewards(game, raid), {
    key: raid.rewardKey, coins: 0, packs: 6,
  });
  assert.equal(game.wallet.coins, 100);
  assert.equal(game.packs.standard, 11);
});

test('legacy raid clears are baselined as already paid during migration', () => {
  const raid = { id: 'deadline-dragon-raid', dayKey: '2026-09-10', clears: 2 };
  assert.deepEqual(hydrateRaidRewardClaims(undefined, raid), {
    '2026-09-10:deadline-dragon-raid': { coins: 0, packs: 9 },
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
  });
});
