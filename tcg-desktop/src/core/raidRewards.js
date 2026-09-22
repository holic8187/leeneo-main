import { addRelicToInventory } from './relics.js';

export const PERSONAL_RAID_REWARD_PER_CLEAR = Object.freeze({ coins: 0, packs: 3 });

const MAX_REWARD_KEYS = 45;
const MAX_BONUSES_PER_RAID = 40;
const MAX_BONUS_ID_LENGTH = 200;

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

function bonusId(value) {
  return String(value || '').trim().slice(0, MAX_BONUS_ID_LENGTH);
}

function normalizeBonusIds(value) {
  return [...new Set(
    (Array.isArray(value) ? value : []).map(bonusId).filter(Boolean),
  )].slice(-MAX_BONUSES_PER_RAID);
}

// Releases through 0.9.2 reconstruct each raidRewardClaims entry with only
// coins/packs, but preserve unknown top-level save fields. Keep bonus claims
// independently so playing on an older device cannot make them payable again.
// Merge the first bonus implementation's nested IDs without baselining earned
// bonuses that the account has not actually received.
export function hydrateRaidBonusRewardClaims(savedClaims, legacyClaims = {}) {
  const normalized = {};
  for (const [source, nested] of [[legacyClaims, true], [savedClaims, false]]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = String(key || '').trim().slice(0, 160);
      if (!normalizedKey) continue;
      const ids = normalizeBonusIds([
        ...(normalized[normalizedKey] || []),
        ...normalizeBonusIds(nested ? value?.bonusIds : value),
      ]);
      if (!ids.length) continue;
      delete normalized[normalizedKey];
      normalized[normalizedKey] = ids;
    }
  }
  return Object.fromEntries(Object.entries(normalized).slice(-MAX_REWARD_KEYS));
}

export function normalizeRaidRewardBonuses(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || normalized.length >= MAX_BONUSES_PER_RAID) continue;
    const id = bonusId(raw.id);
    const type = String(raw.type || '').trim();
    const quantity = Math.max(1, wholeReward(raw.quantity || 1));
    if (!id || seen.has(id) || !['card', 'relic'].includes(type)) continue;
    if (type === 'card') {
      const cardId = String(raw.cardId || '').trim().slice(0, 120);
      if (!cardId) continue;
      normalized.push({
        id,
        type,
        cardId,
        rarity: String(raw.rarity || '').trim().toLowerCase().slice(0, 12),
        quantity,
        stage: wholeReward(raw.stage),
      });
    } else {
      const relicId = String(raw.relicId || '').trim().slice(0, 120);
      if (!relicId) continue;
      normalized.push({ id, type, relicId, quantity, stage: wholeReward(raw.stage) });
    }
    seen.add(id);
  }
  return normalized;
}

export function earnedRewardsForRaid(raid) {
  const clears = wholeReward(raid?.clears);
  return {
    coins: raid?.earnedRewards?.coins == null
      ? 0
      : wholeReward(raid.earnedRewards.coins),
    packs: raid?.earnedRewards?.packs == null
      ? PERSONAL_RAID_REWARD_PER_CLEAR.packs * clears * (clears + 1) / 2
      : wholeReward(raid.earnedRewards.packs),
    bonuses: normalizeRaidRewardBonuses(raid?.earnedRewards?.bonuses),
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
        bonusIds: normalizeBonusIds(value.bonusIds),
      };
    }
    return normalized;
  }

  // Builds prior claims for 0.4.x saves. Those versions already credited each
  // clear immediately, so treating the recorded clears as claimed prevents an
  // upgrade from granting the same packs again. Bonus IDs stay unclaimed
  // because older clients never granted cards or relics from this ledger.
  const legacyKey = rewardKeyForRaid(legacyRaid);
  if (legacyKey && wholeReward(legacyRaid?.clears) > 0) {
    const legacyRewards = earnedRewardsForRaid(legacyRaid);
    normalized[legacyKey] = {
      coins: legacyRewards.coins,
      packs: legacyRewards.packs,
      bonusIds: [],
    };
  }
  return normalized;
}

function applyRaidBonus(state, bonus) {
  if (bonus.type === 'card') {
    if (!state.collection || typeof state.collection !== 'object' || Array.isArray(state.collection)) {
      state.collection = {};
    }
    state.collection[bonus.cardId] = Math.min(
      Number.MAX_SAFE_INTEGER,
      wholeReward(state.collection[bonus.cardId]) + bonus.quantity,
    );
    state.discoveredCardIds = [...new Set([
      ...(Array.isArray(state.discoveredCardIds) ? state.discoveredCardIds : []),
      bonus.cardId,
    ])];
    if (!state.cardProgression || typeof state.cardProgression !== 'object' || Array.isArray(state.cardProgression)) {
      state.cardProgression = {};
    }
    if (!state.cardProgression[bonus.cardId]) {
      state.cardProgression[bonus.cardId] = { level: 1, experience: 0 };
    }
    return;
  }
  state.relicInventory = addRelicToInventory(
    state.relicInventory,
    bonus.relicId,
    bonus.quantity,
  );
}

export function reconcileRaidRewards(state, raid) {
  const key = rewardKeyForRaid(raid);
  if (!state || !key) return { key: '', coins: 0, packs: 0, bonuses: [] };
  const claims = hydrateRaidRewardClaims(state.raidRewardClaims);
  const bonusClaims = hydrateRaidBonusRewardClaims(state.raidBonusRewardClaims, claims);
  const claimed = claims[key] || { coins: 0, packs: 0, bonusIds: [] };
  const earned = earnedRewardsForRaid(raid);
  const claimedBonusIds = new Set(bonusClaims[key] || []);
  const bonuses = earned.bonuses.filter((bonus) => !claimedBonusIds.has(bonus.id));
  const reward = {
    key,
    coins: Math.max(0, earned.coins - claimed.coins),
    packs: Math.max(0, earned.packs - claimed.packs),
    bonuses,
  };
  state.wallet ||= { coins: 0 };
  state.packs ||= { standard: 0 };
  state.wallet.coins = wholeReward(state.wallet.coins) + reward.coins;
  state.packs.standard = wholeReward(state.packs.standard) + reward.packs;
  for (const bonus of bonuses) {
    applyRaidBonus(state, bonus);
    claimedBonusIds.add(bonus.id);
  }
  delete claims[key];
  claims[key] = {
    coins: Math.max(claimed.coins, earned.coins),
    packs: Math.max(claimed.packs, earned.packs),
    bonusIds: [...claimedBonusIds].slice(-MAX_BONUSES_PER_RAID),
  };
  state.raidRewardClaims = Object.fromEntries(Object.entries(claims).slice(-MAX_REWARD_KEYS));
  delete bonusClaims[key];
  state.raidBonusRewardClaims = hydrateRaidBonusRewardClaims({
    ...bonusClaims,
    [key]: [...claimedBonusIds],
  });
  return reward;
}
