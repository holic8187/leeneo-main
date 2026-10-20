import policy from '../data/weeklyRankingRewards.json' with { type: 'json' };

export const WEEKLY_REWARD_START_WEEK = policy.startsWithWeek;
export const WEEKLY_REWARD_FIRST_SETTLEMENT_AT = Date.parse(policy.firstSettlementAt);
export const WEEKLY_REWARD_TIERS = Object.freeze(policy.bands.map((band) => Object.freeze({
  ...band, rewards: Object.freeze({ ...band.rewards }),
})));

export function rewardForRank(rank) {
  if (!Number.isSafeInteger(rank) || rank < 1) return null;
  const band = WEEKLY_REWARD_TIERS.find((entry) => rank >= entry.minRank && (entry.maxRank == null || rank <= entry.maxRank));
  return band ? { ...band.rewards } : null;
}
