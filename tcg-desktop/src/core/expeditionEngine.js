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
  catalog,
  now = Date.now(),
}) {
  if (!mission) throw new Error('모험 정보를 찾을 수 없습니다.');
  const sourceIds = Array.isArray(cardIds) ? cardIds : [];
  const squad = [...new Set(sourceIds)].filter((id) => collection?.[id]).slice(0, MAX_SQUAD_SIZE);
  const catalogById = new Map((Array.isArray(catalog) ? catalog : []).map((card) => [card.id, card]));
  const characterIds = squad.map((cardId) => catalogById.get(cardId)?.characterId || cardId);
  if (new Set(characterIds).size !== characterIds.length) {
    throw new Error('등급이 달라도 같은 인물은 한 모험 파티에 중복 편성할 수 없습니다.');
  }
  const requiredCards = Math.max(1, Math.floor(Number(mission.requiredCards) || 1));
  if (squad.length < requiredCards) {
    throw new Error(`카드를 ${requiredCards}장 이상 편성해 주세요.`);
  }

  const score = calculateSquadScore(squad, collection, catalog, cardEnhancements, [], cardProgression, equipment);
  const minimumPower = missionMinimumPower(mission);
  if (score < minimumPower) {
    throw new Error(`최소 합산 전투력 ${minimumPower.toLocaleString('ko-KR')} 이상이 필요합니다.`);
  }

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
  const coins = Math.max(minimum, scaledCoins);
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
    },
  };
}
