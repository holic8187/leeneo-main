const statTotal = (stats = {}) => (
  Number(stats.work || 0)
  + Number(stats.sense || 0)
  + Number(stats.grit || 0)
  + Number(stats.luck || 0)
);

const expeditionPower = (card) => {
  const combatPower = Number(card?.combatPower);
  if (Number.isFinite(combatPower) && combatPower > 0) {
    return Math.max(1, Math.round(combatPower / 40));
  }
  return statTotal(card?.stats);
};

export function calculateSquadScore(cardIds, collection, catalog) {
  const uniqueIds = [...new Set(cardIds)].slice(0, 3);
  return uniqueIds.reduce((score, cardId) => {
    if (!collection[cardId]) return score;
    const card = catalog.find((candidate) => candidate.id === cardId);
    return score + (card ? expeditionPower(card) : 0);
  }, 0);
}

export function startExpedition({ mission, cardIds, collection, catalog, now = Date.now() }) {
  if (!mission) throw new Error('모험 정보를 찾을 수 없습니다.');
  const squad = [...new Set(cardIds)].filter((id) => collection[id]).slice(0, 3);
  if (squad.length < mission.requiredCards) {
    throw new Error(`카드를 ${mission.requiredCards}장 이상 편성해 주세요.`);
  }

  const score = calculateSquadScore(squad, collection, catalog);
  return {
    id: `expedition-${now}`,
    missionId: mission.id,
    squad,
    score,
    startedAt: now,
    endsAt: now + mission.durationMs,
  };
}

export function expeditionProgress(expedition, now = Date.now()) {
  if (!expedition) return 0;
  const duration = Math.max(1, expedition.endsAt - expedition.startedAt);
  return Math.min(1, Math.max(0, (now - expedition.startedAt) / duration));
}

export function settleExpedition({ expedition, mission, now = Date.now(), random = Math.random }) {
  if (!expedition || !mission) throw new Error('완료할 모험이 없습니다.');
  if (now < expedition.endsAt) throw new Error('아직 모험이 끝나지 않았습니다.');

  const scoreRatio = expedition.score / Math.max(1, mission.recommendedScore);
  const successChance = Math.min(0.97, Math.max(0.35, 0.48 + (scoreRatio * 0.38)));
  const success = random() < successChance;
  const [minimum, maximum] = mission.reward.coins;
  const roll = Math.min(0.999999, Math.max(0, random()));
  const baseCoins = Math.floor(minimum + ((maximum - minimum + 1) * roll));
  const coins = success ? baseCoins : Math.max(80, Math.floor(baseCoins * 0.35));
  const packs = success && random() < mission.reward.packChance ? 1 : 0;

  return { success, coins, packs, successChance };
}
