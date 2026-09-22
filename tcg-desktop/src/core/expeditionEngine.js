import {
  bestAvailableEnhancementForCard,
  bestEnhancementForCard,
  enhancedCardPower,
} from './cardManagement.js';
import {
  cardCombatPowerAtLevel,
  expeditionExperienceReward,
  grantCardExperience,
  progressionForCard,
} from './cardProgression.js';
import { MAX_SQUAD_SIZE } from './squadSelection.js';
import { expeditionCoinMultiplierForRelic, ownedRelic } from './relics.js';
import {
  addEquipmentToInventory,
  equipmentPartyAttackMultiplier,
  rollExpeditionEquipmentDrop,
} from './equipment.js';

const LEGACY_EXPEDITION_SCORE_FACTOR = 40;
const COMBAT_POWER_SCALE = 'combat-power-v1';

export const cardExpeditionPower = (card) => {
  const combatPower = Number(card?.combatPower);
  if (Number.isFinite(combatPower) && combatPower > 0) {
    return Math.max(1, Math.round(combatPower));
  }

  return 0;
};

export function missionMinimumPower(mission) {
  const minimum = Number(mission?.minimumPower ?? mission?.recommendedScore ?? 0);
  return Number.isFinite(minimum) && minimum > 0 ? Math.round(minimum) : 0;
}

export function calculateSquadScore(
  cardIds = [],
  collection = {},
  catalog = [],
  cardEnhancements = {},
  lockedCards = [],
  cardProgression = {},
  equipment = null,
) {
  const uniqueIds = [...new Set(Array.isArray(cardIds) ? cardIds : [])].slice(0, MAX_SQUAD_SIZE);
  const baseScore = uniqueIds.reduce((score, cardId) => {
    if (!collection?.[cardId]) return score;
    const card = catalog.find((candidate) => candidate.id === cardId);
    const stage = bestAvailableEnhancementForCard(
      collection,
      cardEnhancements,
      cardId,
      lockedCards,
    );
    if (stage < 0) return score;
    if (!card) return score;
    const enhancedPower = enhancedCardPower(cardExpeditionPower(card), stage);
    return score + cardCombatPowerAtLevel(enhancedPower, card, cardProgression);
  }, 0);
  return Math.round(baseScore * equipmentPartyAttackMultiplier(equipment));
}

export function startExpedition({
  mission,
  cardIds,
  collection,
  cardEnhancements = {},
  cardProgression = {},
  equipment = null,
  relicId = '',
  relicInventory = {},
  catalog,
  now = Date.now(),
}) {
  const eligibility = expeditionEligibility({ mission, cardIds, collection, cardEnhancements, cardProgression, equipment, catalog });
  if (!eligibility.canStart) throw new Error(eligibility.message);
  const { squad, score } = eligibility;

  return {
    id: `expedition-${now}`,
    missionId: mission.id,
    squad,
    enhancementStages: Object.fromEntries(squad.map((cardId) => [
      cardId,
      bestEnhancementForCard(collection, cardEnhancements, cardId),
    ])),
    cardLevels: Object.fromEntries(squad.map((cardId) => [
      cardId,
      progressionForCard(cardProgression, cardId).level,
    ])),
    equipment: equipment ? { ...equipment } : null,
    relicId: ownedRelic(relicInventory, relicId) ? relicId : '',
    score,
    combatPower: score,
    powerScale: COMBAT_POWER_SCALE,
    startedAt: now,
    endsAt: now + mission.durationMs,
  };
}

// The preview, disabled button, and actual dispatch share the same owned-card
// normalization and eligibility checks, including level and equipment bonuses.
export function expeditionEligibility({
  mission,
  cardIds = [],
  collection = {},
  cardEnhancements = {},
  cardProgression = {},
  equipment = null,
  catalog = [],
} = {}) {
  const sourceIds = Array.isArray(cardIds) ? cardIds : [];
  const catalogById = new Map((Array.isArray(catalog) ? catalog : []).map((card) => [card.id, card]));
  const squad = [...new Set(sourceIds)]
    .filter((id) => Number(collection?.[id]) > 0 && catalogById.has(id))
    .slice(0, MAX_SQUAD_SIZE);
  const characterIds = squad.map((cardId) => catalogById.get(cardId)?.characterId || cardId);
  const requiredCards = Math.max(1, Math.floor(Number(mission?.requiredCards) || 1));
  const score = calculateSquadScore(squad, collection, catalog, cardEnhancements, [], cardProgression, equipment);
  const minimumPower = missionMinimumPower(mission);
  const missingCards = Math.max(0, requiredCards - squad.length);
  const missingPower = Math.max(0, minimumPower - score);
  let code = '';
  let message = '';
  if (!mission) {
    code = 'MISSION_NOT_FOUND';
    message = '모험 정보를 찾을 수 없습니다.';
  } else if (new Set(characterIds).size !== characterIds.length) {
    code = 'DUPLICATE_CHARACTER';
    message = '등급이 달라도 같은 인물은 한 모험 파티에 중복 편성할 수 없습니다.';
  } else if (missingCards > 0) {
    code = 'INSUFFICIENT_CARDS';
    message = `최소 ${requiredCards}장 편성이 필요합니다. 현재 ${squad.length}장 · ${missingCards}장을 더 선택해 주세요.`;
  } else if (missingPower > 0) {
    code = 'INSUFFICIENT_POWER';
    message = `최소 합산 전투력 ${minimumPower.toLocaleString('ko-KR')} 이상이 필요합니다. ${missingPower.toLocaleString('ko-KR')}이 부족합니다.`;
  }
  return {
    canStart: !code,
    code,
    message,
    squad,
    score,
    minimumPower,
    requiredCards,
    missingCards,
    missingPower,
  };
}

export function expeditionProgress(expedition, now = Date.now()) {
  if (!expedition) return 0;
  const duration = Math.max(1, expedition.endsAt - expedition.startedAt);
  return Math.min(1, Math.max(0, (now - expedition.startedAt) / duration));
}

export function expeditionEffectivePower(expedition) {
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

  const effectivePower = expeditionEffectivePower(expedition);
  const minimumPower = Math.max(1, missionMinimumPower(mission));
  const scoreRatio = effectivePower / minimumPower;
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
  const coinsBeforeRelic = Math.max(minimum, scaledCoins);
  const relicMultiplier = expeditionCoinMultiplierForRelic(expedition.relicId);
  const coins = Math.round(coinsBeforeRelic * relicMultiplier);
  const packChance = Math.min(
    1,
    Math.max(0, Number(mission.reward.packChance) || 0) * Math.min(1.3, powerMultiplier),
  );
  const packs = random() < packChance ? 1 : 0;

  return {
    success: true,
    coins,
    packs,
    successChance: 1,
    effectivePower,
    powerMultiplier,
    relicBonusCoins: coins - coinsBeforeRelic,
    relicMultiplier,
  };
}

export function completeDueExpedition({ state, mission, now = Date.now(), random = Math.random }) {
  const expedition = state?.expedition;
  const completedAt = Number(expedition?.endsAt);
  if (!expedition || !Number.isFinite(completedAt) || now < completedAt) return null;

  const result = settleExpedition({ expedition, mission, now, random });
  const experiencePerCard = expeditionExperienceReward(mission);
  const experienceResult = grantCardExperience(
    state.cardProgression,
    expedition.squad,
    experiencePerCard,
    state.collection,
  );
  const equipment = rollExpeditionEquipmentDrop({ mission, now: completedAt, random });
  return {
    completedAt,
    result: {
      ...result,
      experiencePerCard,
      experienceAwards: experienceResult.awards,
      equipment,
    },
    state: {
      ...state,
      wallet: {
        ...(state.wallet || {}),
        coins: Math.max(0, Number(state.wallet?.coins) || 0) + result.coins,
      },
      packs: {
        ...(state.packs || {}),
        standard: Math.max(0, Number(state.packs?.standard) || 0) + result.packs,
      },
      cardProgression: experienceResult.cardProgression,
      equipmentInventory: equipment
        ? addEquipmentToInventory(state.equipmentInventory, equipment)
        : [...(state.equipmentInventory || [])],
      expedition: null,
      lastCompletedExpedition: {
        missionId: expedition.missionId,
        squad: [...expedition.squad],
        equipmentCardId: expedition.equipment?.id || '',
        artifactCardId: expedition.relicId || '',
        completedAt,
      },
    },
  };
}

// Revalidate the original party against current ownership and levels. Never
// silently substitute another card/equipment when repeating a saved adventure.
export function repeatExpedition({ state, missions = [], catalog = [], now = Date.now() }) {
  if (state?.expedition) throw new Error('이미 진행 중인 모험이 있습니다.');
  const previous = state?.lastCompletedExpedition;
  const mission = missions.find((entry) => entry.id === previous?.missionId);
  if (!mission) throw new Error('다시 보낼 완료 모험이 없습니다.');
  if (!Array.isArray(previous.squad) || !previous.squad.length || previous.squad.some((id) => !state.collection?.[id] || !catalog.some((card) => card.id === id))) {
    throw new Error('이전 모험의 카드가 부족합니다. 덱을 다시 편성해 주세요.');
  }
  const equipment = (state.equipmentInventory || []).find((item) => item.id === previous.equipmentCardId) || null;
  if (previous.equipmentCardId && !equipment) throw new Error('이전 모험의 장비가 없습니다. 덱을 다시 편성해 주세요.');
  if (previous.artifactCardId && !ownedRelic(state.relicInventory, previous.artifactCardId)) {
    throw new Error('이전 모험의 유물이 없습니다. 덱을 다시 편성해 주세요.');
  }
  return startExpedition({
    mission, cardIds: previous.squad, collection: state.collection,
    cardEnhancements: state.cardEnhancements, cardProgression: state.cardProgression,
    equipment, relicId: previous.artifactCardId, relicInventory: state.relicInventory,
    catalog, now,
  });
}
