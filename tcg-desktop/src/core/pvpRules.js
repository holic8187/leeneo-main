export const PVP_RULES = Object.freeze({
  teamSize: 4, turnMs: 20_000, readyMs: 30_000, queueTtlMs: 90_000,
  startingRating: 1000, ratingK: 24, initialRatingGap: 150, maximumRatingGap: 600,
  hpMultiplier: 50, attackMultiplier: .1, breakMaximum: 100, maxActions: 240,
  rewards: Object.freeze({ victory: 600, defeat: 150, draw: 250 }),
  seasonRewardPolicy: Object.freeze({ enabled: false, status: 'pending', tiers: [] }),
});

const SEASON_ANCHOR = Date.parse('2026-10-19T00:00:00+09:00');
const SEASON_MS = 14 * 24 * 60 * 60 * 1000;
export function pvpSeasonAt(now = Date.now()) {
  const index = Math.floor((Number(now) - SEASON_ANCHOR) / SEASON_MS);
  const startsAt = SEASON_ANCHOR + index * SEASON_MS;
  return { key: `pvp-${new Date(startsAt + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}`,
    startsAt, endsAt: startsAt + SEASON_MS, rewardStatus: 'pending' };
}

export function pvpRatingDelta(rating, opponentRating, result, k = PVP_RULES.ratingK) {
  const score = result === 'victory' ? 1 : result === 'draw' ? .5 : 0;
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.round(k * (score - expected));
}

export function pvpMatchGap(player, now) {
  return Math.min(PVP_RULES.maximumRatingGap,
    PVP_RULES.initialRatingGap + Math.floor(Math.max(0, now - player.queuedAt) / 30_000) * 50);
}

export function findPvpPair(queue, now) {
  const ordered = [...queue].sort((a, b) => a.queuedAt - b.queuedAt || a.accountId.localeCompare(b.accountId));
  for (let i = 0; i < ordered.length; i += 1) {
    const first = ordered[i];
    const candidates = ordered.slice(i + 1).filter(second => second.accountId !== first.accountId
      && Math.abs(second.rating - first.rating) <= Math.min(pvpMatchGap(first, now), pvpMatchGap(second, now)))
      .sort((a, b) => Math.abs(a.rating - first.rating) - Math.abs(b.rating - first.rating) || a.queuedAt - b.queuedAt);
    if (candidates.length) return [first, candidates[0]];
  }
  return null;
}

export function pvpResultFor(battle, accountId) {
  if (battle.status !== 'finished') return null;
  return !battle.winnerAccountId ? 'draw' : battle.winnerAccountId === accountId ? 'victory' : 'defeat';
}
