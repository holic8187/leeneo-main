'use strict';

const CHOICES = new Set(['fortune', 'misfortune', 'reversal', 'charge', 'release', 'rest', 'bridge']);
const GALAXY_CHOICES = new Set(['attack', 'heal', 'support']);

// Only these small enum values may enter durable battle/copy snapshots.
// In particular, do not retain client objects or arbitrary strings as choices.
function normalizeBattleOptions({ choice, galaxyChoice } = {}) {
  const normalize = (value, allowed) => {
    if (value == null || value === '') return undefined;
    if (typeof value !== 'string' || !allowed.has(value)) throw new Error('스킬 선택값이 올바르지 않습니다.');
    return value;
  };
  return { choice: normalize(choice, CHOICES), galaxyChoice: normalize(galaxyChoice, GALAXY_CHOICES) };
}

module.exports = { normalizeBattleOptions };
