'use strict';

const NORMAL_DEATH_EXP_PENALTY_RATE = 0.1;
const RAID_DEATH_EXP_PENALTY_RATE = 0.01;

function isRaidDeathContext(character, map) {
  return Boolean(map?.raidBossId || character?.worldState?.raidBossId);
}

function calculateDeathExpLoss({ currentExp, requiredExp, raidDeath = false } = {}) {
  const availableExp = Math.max(0, Math.floor(Number(currentExp) || 0));
  const levelExp = Math.max(0, Math.floor(Number(requiredExp) || 0));
  const rate = raidDeath
    ? RAID_DEATH_EXP_PENALTY_RATE
    : NORMAL_DEATH_EXP_PENALTY_RATE;
  return Math.min(availableExp, Math.floor(levelExp * rate));
}

module.exports = {
  NORMAL_DEATH_EXP_PENALTY_RATE,
  RAID_DEATH_EXP_PENALTY_RATE,
  isRaidDeathContext,
  calculateDeathExpLoss
};
