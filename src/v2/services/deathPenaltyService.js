'use strict';

const {
  consumeInventoryItem,
  getItemQuantity
} = require('./inventoryService');

const NORMAL_DEATH_EXP_PENALTY_RATE = 0.1;
const RAID_DEATH_EXP_PENALTY_RATE = 0.01;
const DEATH_EXP_PROTECTION_ITEM_ID = 'gyeo_manager_blood';

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

function applyDeathExpPenalty(character, { requiredExp, raidDeath = false } = {}) {
  if (!character.progression || typeof character.progression !== 'object') {
    character.progression = {};
  }
  const currentExp = Math.max(0, Math.floor(Number(character.progression.exp) || 0));
  const potentialExpLoss = calculateDeathExpLoss({
    currentExp,
    requiredExp,
    raidDeath
  });
  const protectedByItem = potentialExpLoss > 0
    && consumeInventoryItem(character, DEATH_EXP_PROTECTION_ITEM_ID, 1);
  const expLost = protectedByItem ? 0 : potentialExpLoss;
  character.progression.exp = currentExp - expLost;
  if (typeof character.markModified === 'function') {
    character.markModified('progression');
  }
  return {
    expLost,
    protectedByItem,
    protectionItemId: protectedByItem ? DEATH_EXP_PROTECTION_ITEM_ID : null,
    remainingProtectionItems: getItemQuantity(character, DEATH_EXP_PROTECTION_ITEM_ID)
  };
}

module.exports = {
  NORMAL_DEATH_EXP_PENALTY_RATE,
  RAID_DEATH_EXP_PENALTY_RATE,
  DEATH_EXP_PROTECTION_ITEM_ID,
  isRaidDeathContext,
  calculateDeathExpLoss,
  applyDeathExpPenalty
};
