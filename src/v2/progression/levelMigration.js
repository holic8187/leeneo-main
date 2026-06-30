'use strict';

const { MAX_LEVEL } = require('../constants/experienceTable');
const { getAdvancementBonusSkillPoints } = require('../jobs/advancementRules');

const LEGACY_CURVE = Object.freeze({
  preserveUntil: 30,
  anchorLegacyLevel: 1900,
  anchorV2Level: 130,
  highLevelSoftCap: 150,
  exponent: 0.55,
  overflowScale: 1000
});

function mapLegacyLevelToV2(legacyLevel) {
  const sourceLevel = Math.max(1, Math.floor(Number(legacyLevel) || 1));
  const {
    preserveUntil,
    anchorLegacyLevel,
    anchorV2Level,
    highLevelSoftCap,
    exponent,
    overflowScale
  } = LEGACY_CURVE;

  if (sourceLevel <= preserveUntil) return sourceLevel;

  if (sourceLevel <= anchorLegacyLevel) {
    const progress = (sourceLevel - preserveUntil) / (anchorLegacyLevel - preserveUntil);
    return Math.min(
      anchorV2Level,
      Math.max(preserveUntil + 1, Math.round(preserveUntil + (anchorV2Level - preserveUntil) * Math.pow(progress, exponent)))
    );
  }

  const overflow = sourceLevel - anchorLegacyLevel;
  const overflowProgress = 1 - Math.exp(-overflow / overflowScale);
  return Math.min(
    highLevelSoftCap,
    Math.max(anchorV2Level, Math.round(anchorV2Level + (highLevelSoftCap - anchorV2Level) * overflowProgress))
  );
}

function getStatPointsForLevel(level) {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return (safeLevel - 1) * 5;
}

function getSkillPointsForLevel(level, advancementTier = 0) {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return (safeLevel - 1) * 3 + getAdvancementBonusSkillPoints(advancementTier);
}

module.exports = {
  LEGACY_CURVE,
  mapLegacyLevelToV2,
  getStatPointsForLevel,
  getSkillPointsForLevel
};
