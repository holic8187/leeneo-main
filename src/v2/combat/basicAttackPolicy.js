'use strict';

function canUseBasicAttack(character = {}) {
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  const job = character.job || {};
  const advancementTier = Math.max(0, Math.floor(Number(job.advancementTier) || 0));
  const departmentId = String(job.departmentId || 'unassigned');
  return level < 10 && advancementTier <= 0 && departmentId === 'unassigned';
}

module.exports = {
  canUseBasicAttack
};
