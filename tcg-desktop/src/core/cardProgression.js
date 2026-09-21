import { CARD_SKILL_BY_ID } from '../data/cardSkills.js';

export const MAX_CARD_LEVEL = 100;
export const BASE_CARD_HP = 100;

export const CARD_ROLES = Object.freeze({
  defense: Object.freeze({ id: 'defense', label: '방어' }),
  attack: Object.freeze({ id: 'attack', label: '공격' }),
  support: Object.freeze({ id: 'support', label: '지원' }),
});

const whole = (value, fallback = 0) => {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) ? normalized : fallback;
};

const clampLevel = (value) => Math.min(MAX_CARD_LEVEL, Math.max(1, whole(value, 1)));

/**
 * Cards keep the varied identity of their skill while exposing one of the
 * three progression roles requested by the game. Hybrid offensive skills are
 * attack cards, explicit guards are defense cards, and the remaining utility,
 * healing, cleansing and control skills are support cards.
 */
export function roleForCard(cardOrId) {
  const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
  const skillRole = String(CARD_SKILL_BY_ID[String(cardId || '')]?.role || '');
  if (/(탱킹|방어|요새|반격)/.test(skillRole)) return CARD_ROLES.defense;
  if (/(공격|브레이크|연타)/.test(skillRole)) return CARD_ROLES.attack;
  return CARD_ROLES.support;
}

export function cardExperienceForNextLevel(level) {
  const currentLevel = clampLevel(level);
  if (currentLevel >= MAX_CARD_LEVEL) return 0;
  const step = currentLevel - 1;
  return Math.round(100 + (18 * step) + (2 * (step ** 1.55)));
}

export function cardProgressionEntry(saved = null) {
  const level = clampLevel(saved?.level ?? 1);
  const required = cardExperienceForNextLevel(level);
  const experience = level >= MAX_CARD_LEVEL
    ? 0
    : Math.min(Math.max(0, whole(saved?.experience ?? saved?.xp, 0)), Math.max(0, required - 1));
  return { level, experience };
}

/**
 * Progress is stored per illustrated card id. This matches deck selection,
 * enhancement and locking, which also operate on a card id while compactly
 * storing duplicate copy counts.
 */
export function normalizeCardProgression(saved = {}, collection = {}) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const normalized = {};
  for (const [cardId, rawCount] of Object.entries(collection || {})) {
    if (Math.max(0, whole(rawCount)) <= 0) continue;
    normalized[cardId] = cardProgressionEntry(source[cardId]);
  }
  return normalized;
}

export function progressionForCard(cardProgression = {}, cardId = '') {
  return cardProgressionEntry(cardProgression?.[cardId]);
}

export function levelGrowthForCard(cardOrId, level = 1) {
  const role = roleForCard(cardOrId);
  const gainedLevels = clampLevel(level) - 1;
  if (role.id === CARD_ROLES.defense.id) {
    return { role, attack: 0, maxHp: gainedLevels };
  }
  if (role.id === CARD_ROLES.attack.id) {
    return { role, attack: gainedLevels * 2, maxHp: 0 };
  }
  return { role, attack: gainedLevels, maxHp: gainedLevels * 0.5 };
}

export function cardCombatPowerAtLevel(basePower, cardOrId, cardProgression = {}) {
  const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
  const base = Math.max(0, Math.round(Number(basePower) || 0));
  const { level } = progressionForCard(cardProgression, cardId);
  return base + levelGrowthForCard(cardOrId, level).attack;
}

export function cardMaxHpAtLevel(cardOrId, cardProgression = {}) {
  const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
  const { level } = progressionForCard(cardProgression, cardId);
  const value = BASE_CARD_HP + levelGrowthForCard(cardOrId, level).maxHp;
  return Math.round(value * 2) / 2;
}

export function cardLevelUpCoinCost(cardProgression = {}, cardId = '') {
  const progress = progressionForCard(cardProgression, cardId);
  if (progress.level >= MAX_CARD_LEVEL) return 0;
  const missingExperience = Math.max(0, cardExperienceForNextLevel(progress.level) - progress.experience);
  return Math.ceil(missingExperience * (18 + (progress.level * 0.75)));
}

export function grantCardExperience(cardProgression = {}, cardIds = [], amount = 0, collection = {}) {
  const normalized = normalizeCardProgression(cardProgression, collection);
  const experienceAward = Math.max(0, whole(amount));
  const awards = [];
  for (const cardId of [...new Set(Array.isArray(cardIds) ? cardIds : [])]) {
    if (!normalized[cardId] || experienceAward <= 0) continue;
    const before = { ...normalized[cardId] };
    let level = before.level;
    let experience = before.experience + experienceAward;
    while (level < MAX_CARD_LEVEL) {
      const required = cardExperienceForNextLevel(level);
      if (experience < required) break;
      experience -= required;
      level += 1;
    }
    if (level >= MAX_CARD_LEVEL) experience = 0;
    normalized[cardId] = { level, experience };
    awards.push({ cardId, experience: experienceAward, before, after: { level, experience }, levelsGained: level - before.level });
  }
  return { cardProgression: normalized, awards };
}

export function purchaseCardLevel({ cardProgression = {}, collection = {}, wallet = {}, cardId = '' } = {}) {
  if (Math.max(0, whole(collection?.[cardId])) <= 0) throw new Error('레벨업할 카드를 보유하고 있지 않습니다.');
  const normalized = normalizeCardProgression(cardProgression, collection);
  const before = progressionForCard(normalized, cardId);
  if (before.level >= MAX_CARD_LEVEL) throw new Error('이미 최대 레벨입니다.');
  const cost = cardLevelUpCoinCost(normalized, cardId);
  const coins = Math.max(0, whole(wallet?.coins));
  if (coins < cost) throw new Error(`레벨업에 필요한 동전이 부족합니다. (${cost.toLocaleString('ko-KR')} 필요)`);
  const after = { level: before.level + 1, experience: 0 };
  normalized[cardId] = after;
  return {
    cardId,
    cost,
    before,
    after,
    cardProgression: normalized,
    wallet: { ...(wallet || {}), coins: coins - cost },
  };
}

export function expeditionExperienceReward(mission = {}) {
  const durationMinutes = Math.max(1, Number(mission?.durationMs) / 60000 || 1);
  const minimumPower = Math.max(0, Number(mission?.minimumPower ?? mission?.recommendedScore) || 0);
  return Math.max(20, Math.round(15 + (5 * Math.sqrt(durationMinutes)) + (minimumPower / 800)));
}

export function raidExperienceReward({ damageDealt = 0, stage = 1, cleared = false } = {}) {
  const damageReward = Math.min(300, Math.floor(Math.max(0, Number(damageDealt) || 0) / 2500));
  return Math.max(25, Math.round(30 + (Math.max(1, whole(stage, 1)) * 12) + damageReward + (cleared ? 30 : 0)));
}
