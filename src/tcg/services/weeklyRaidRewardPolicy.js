'use strict';

const policy = require('../../../tcg-desktop/src/data/weeklyRankingRewards.json');
// Earlier rankings predate this reward contract and are intentionally not paid.
const WEEKLY_RAID_REWARD_START_WEEK = policy.startsWithWeek;
const WEEKLY_RAID_REWARD_POLICY_VERSION = policy.version;
const WEEKLY_RAID_REWARD_BANDS = Object.freeze(policy.bands.map((band) => Object.freeze({ ...band, rewards: Object.freeze({ ...band.rewards }) })));

function weeklyRaidRewardsForRank(rank) {
  if (!Number.isSafeInteger(rank) || rank < 1) return null;
  const band = WEEKLY_RAID_REWARD_BANDS.find((entry) => rank >= entry.minRank && (entry.maxRank == null || rank <= entry.maxRank));
  return band ? { ...band.rewards } : null;
}

function weeklyRaidRewardPolicy() {
  return {
    version: WEEKLY_RAID_REWARD_POLICY_VERSION,
    startsWithWeek: WEEKLY_RAID_REWARD_START_WEEK,
    firstSettlementAt: Date.parse(policy.firstSettlementAt),
    resetRule: 'MONDAY_00_KST',
    delivery: 'mailbox',
    claimWithinDays: policy.claimWithinDays,
    minimumScore: 1,
    ties: 'same-rank-same-reward',
    bands: WEEKLY_RAID_REWARD_BANDS.map((band) => ({ ...band, rewards: { ...band.rewards } }))
  };
}

module.exports = { WEEKLY_RAID_REWARD_START_WEEK, WEEKLY_RAID_REWARD_POLICY_VERSION, WEEKLY_RAID_REWARD_BANDS, weeklyRaidRewardsForRank, weeklyRaidRewardPolicy };
