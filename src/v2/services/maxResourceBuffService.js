'use strict';

const { getActiveSkillEffects } = require('../skills/skillService');

function ensureResourceState(character) {
  if (!character.resources || typeof character.resources !== 'object') {
    character.resources = {};
  }
  return character.resources;
}

function reconcileMaxResourceBuff(character, now = Date.now()) {
  if (!character) return { changed: false, percent: 0 };
  const resources = ensureResourceState(character);
  const previousPercent = Math.max(
    0,
    Number(resources.maxResourceBuffPercentApplied) || 0
  );
  const desiredPercent = Math.max(
    0,
    Number(getActiveSkillEffects(character, now).maxResourcePercent) || 0
  );
  const storedMaxHp = Math.max(1, Number(resources.maxHp) || 1);
  const storedMaxMp = Math.max(1, Number(resources.maxMp) || 1);

  let baseMaxHp = Math.max(0, Number(resources.maxResourceBuffBaseHp) || 0);
  let baseMaxMp = Math.max(0, Number(resources.maxResourceBuffBaseMp) || 0);
  if (!baseMaxHp) {
    baseMaxHp = previousPercent > 0
      ? Math.max(1, Math.round(storedMaxHp / (1 + previousPercent / 100)))
      : storedMaxHp;
  }
  if (!baseMaxMp) {
    baseMaxMp = previousPercent > 0
      ? Math.max(1, Math.round(storedMaxMp / (1 + previousPercent / 100)))
      : storedMaxMp;
  }

  const multiplier = 1 + desiredPercent / 100;
  const nextMaxHp = Math.max(1, Math.round(baseMaxHp * multiplier));
  const nextMaxMp = Math.max(1, Math.round(baseMaxMp * multiplier));
  const nextCurrentHp = Math.max(
    0,
    Math.min(nextMaxHp, Number(resources.currentHp) || 0)
  );
  const nextCurrentMp = Math.max(
    0,
    Math.min(nextMaxMp, Number(resources.currentMp) || 0)
  );
  const changed = storedMaxHp !== nextMaxHp
    || storedMaxMp !== nextMaxMp
    || Number(resources.currentHp) !== nextCurrentHp
    || Number(resources.currentMp) !== nextCurrentMp
    || previousPercent !== desiredPercent
    || Number(resources.maxResourceBuffBaseHp || 0) !== (desiredPercent ? baseMaxHp : 0)
    || Number(resources.maxResourceBuffBaseMp || 0) !== (desiredPercent ? baseMaxMp : 0);

  resources.maxHp = nextMaxHp;
  resources.maxMp = nextMaxMp;
  resources.currentHp = nextCurrentHp;
  resources.currentMp = nextCurrentMp;
  resources.maxResourceBuffPercentApplied = desiredPercent;
  resources.maxResourceBuffBaseHp = desiredPercent ? baseMaxHp : 0;
  resources.maxResourceBuffBaseMp = desiredPercent ? baseMaxMp : 0;
  if (changed && typeof character.markModified === 'function') {
    character.markModified('resources');
  }
  return {
    changed,
    percent: desiredPercent,
    baseMaxHp,
    baseMaxMp,
    maxHp: nextMaxHp,
    maxMp: nextMaxMp
  };
}

module.exports = {
  reconcileMaxResourceBuff
};
