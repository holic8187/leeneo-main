export const PERSONAL_RAID_REWARD_PER_CLEAR = Object.freeze({ coins: 5000, packs: 1 });

const MAX_REWARD_KEYS = 45;

function wholeReward(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number)));
}

export function rewardKeyForRaid(raid) {
  const explicit = String(raid?.rewardKey || '').trim();
  if (explicit) return explicit.slice(0, 160);
  const dayKey = String(raid?.dayKey || '').trim();
  const bossId = String(raid?.id || raid?.bossId || '').trim();
  return dayKey && bossId ? `${dayKey}:${bossId}`.slice(0, 160) : '';
}

export function earnedRewardsForRaid(raid) {
  const clears = wholeReward(raid?.clears);
  return {
    coins: raid?.earnedRewards?.coins == null
      ? clears * PERSONAL_RAID_REWARD_PER_CLEAR.coins
      : wholeReward(raid.earnedRewards.coins),
    packs: raid?.earnedRewards?.packs == null
      ? clears * PERSONAL_RAID_REWARD_PER_CLEAR.packs
      : wholeReward(raid.earnedRewards.packs),
  };
}

export function hydrateRaidRewardClaims(savedClaims, legacyRaid = null) {
  const normalized = {};
  if (savedClaims && typeof savedClaims === 'object' && !Array.isArray(savedClaims)) {
    for (const [key, value] of Object.entries(savedClaims).slice(-MAX_REWARD_KEYS)) {
      const normalizedKey = String(key || '').trim().slice(0, 160);
      if (!normalizedKey || !value || typeof value !== 'object') continue;
      normalized[normalizedKey] = {
        coins: wholeReward(value.coins),
        packs: wholeReward(value.packs),
      };
    }
    return normalized;
  }

  // Builds prior claims for 0.4.x saves. Those versions already credited each
  // clear immediately, so treating the recorded clears as claimed prevents an
  // upgrade from granting the same rewards again.
  const legacyKey = rewardKeyForRaid(legacyRaid);
  if (legacyKey && wholeReward(legacyRaid?.clears) > 0) {
    normalized[legacyKey] = earnedRewardsForRaid(legacyRaid);
  }
  return normalized;
}

export function reconcileRaidRewards(state, raid) {
  const key = rewardKeyForRaid(raid);
  if (!state || !key) return { key: '', coins: 0, packs: 0 };
  const claims = hydrateRaidRewardClaims(state.raidRewardClaims);
  const claimed = claims[key] || { coins: 0, packs: 0 };
  const earned = earnedRewardsForRaid(raid);
  const reward = {
    key,
    coins: Math.max(0, earned.coins - claimed.coins),
    packs: Math.max(0, earned.packs - claimed.packs),
  };
  state.wallet.coins += reward.coins;
  state.packs.standard += reward.packs;
  delete claims[key];
  claims[key] = {
    coins: Math.max(claimed.coins, earned.coins),
    packs: Math.max(claimed.packs, earned.packs),
  };
  state.raidRewardClaims = Object.fromEntries(Object.entries(claims).slice(-MAX_REWARD_KEYS));
  return reward;
}
