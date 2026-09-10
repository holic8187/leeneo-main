const LEGACY_STAT_POWER_FACTOR = 100;
const LEGACY_EXPEDITION_SCORE_FACTOR = 40;
const COMBAT_POWER_SCALE = 'combat-power-v1';

const statTotal = (stats = {}) => (
  Number(stats.work || 0)
  + Number(stats.sense || 0)
  + Number(stats.grit || 0)
  + Number(stats.luck || 0)
);

export const cardExpeditionPower = (card) => {
  const combatPower = Number(card?.combatPower);
  if (Number.isFinite(combatPower) && combatPower > 0) {
    return Math.max(1, Math.round(combatPower));
  }

  // Legacy cards predate combatPower. Their stat totals use the same 1:100
  // scale as the generated stats on current cards, so this keeps both sets
  // directly comparable without changing saved collections.
  return Math.max(0, Math.round(statTotal(card?.stats) * LEGACY_STAT_POWER_FACTOR));
};

export function missionMinimumPower(mission) {
  const minimum = Number(mission?.minimumPower ?? mission?.recommendedScore ?? 0);
  return Number.isFinite(minimum) && minimum > 0 ? Math.round(minimum) : 0;
}

export function calculateSquadScore(cardIds = [], collection = {}, catalog = []) {
  const uniqueIds = [...new Set(Array.isArray(cardIds) ? cardIds : [])].slice(0, 3);
  return uniqueIds.reduce((score, cardId) => {
    if (!collection?.[cardId]) return score;
    const card = catalog.find((candidate) => candidate.id === cardId);
    return score + (card ? cardExpeditionPower(card) : 0);
  }, 0);
}

export function startExpedition({ mission, cardIds, collection, catalog, now = Date.now() }) {
  if (!mission) throw new Error('모험 정보를 찾을 수 없습니다.');
  const sourceIds = Array.isArray(cardIds) ? cardIds : [];
  const squad = [...new Set(sourceIds)].filter((id) => collection?.[id]).slice(0, 3);
  const requiredCards = Math.max(1, Math.floor(Number(mission.requiredCards) || 1));
  if (squad.length < requiredCards) {
    throw new Error(`카드를 ${requiredCards}장 이상 편성해 주세요.`);
  }

  const score = calculateSquadScore(squad, collection, catalog);
  const minimumPower = missionMinimumPower(mission);
  if (score < minimumPower) {
    throw new Error(`최소 합산 전투력 ${minimumPower.toLocaleString('ko-KR')} 이상이 필요합니다.`);
  }

  return {
    id: `expedition-${now}`,
    missionId: mission.id,
    squad,
    score,
    combatPower: score,
    powerScale: COMBAT_POWER_SCALE,
    startedAt: now,
    endsAt: now + mission.durationMs,
  };
}

export function expeditionProgress(expedition, now = Date.now()) {
  if (!expedition) return 0;
  const duration = Math.max(1, expedition.endsAt - expedition.startedAt);
  return Math.min(1, Math.max(0, (now - expedition.startedAt) / duration));
}

function savedExpeditionPower(expedition) {
  const combatPower = Number(expedition?.combatPower);
  if (Number.isFinite(combatPower) && combatPower >= 0) return combatPower;

  const score = Math.max(0, Number(expedition?.score) || 0);
  if (expedition?.powerScale === COMBAT_POWER_SCALE) return score;

  // Expeditions saved before combat-power-v1 stored modern card power divided
  // by 40. Preserve a useful settlement result for an expedition in progress
  // during an upgrade instead of treating its old score as near zero.
  return score < 1000 ? score * LEGACY_EXPEDITION_SCORE_FACTOR : score;
}

export function settleExpedition({ expedition, mission, now = Date.now(), random = Math.random }) {
  if (!expedition || !mission) throw new Error('완료할 모험이 없습니다.');
  if (now < expedition.endsAt) throw new Error('아직 모험이 끝나지 않았습니다.');

  const effectivePower = savedExpeditionPower(expedition);
  const minimumPower = Math.max(1, missionMinimumPower(mission));
  const scoreRatio = effectivePower / minimumPower;
  const successChance = Math.min(0.98, Math.max(0.5, 0.88 + ((scoreRatio - 1) * 0.07)));
  const success = random() < successChance;
  const [minimum, maximum] = mission.reward.coins;
  const roll = Math.min(0.999999, Math.max(0, random()));
  const baseCoins = Math.floor(minimum + ((maximum - minimum + 1) * roll));
  const bonusRate = Number(mission.reward.powerBonusRate ?? 0.22);
  const bonusCap = Number(mission.reward.powerBonusCap ?? 0.35);
  const powerMultiplier = 1 + Math.min(
    Math.max(0, bonusCap),
    Math.max(0, scoreRatio - 1) * Math.max(0, bonusRate),
  );
  const scaledCoins = Math.round(baseCoins * powerMultiplier);
  const coins = success ? scaledCoins : Math.max(20, Math.floor(scaledCoins * 0.35));
  const packChance = Math.min(
    1,
    Math.max(0, Number(mission.reward.packChance) || 0) * Math.min(1.3, powerMultiplier),
  );
  const packs = success && random() < packChance ? 1 : 0;

  return {
    success,
    coins,
    packs,
    successChance,
    effectivePower,
    powerMultiplier,
  };
}
