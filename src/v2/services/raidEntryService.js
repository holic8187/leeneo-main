'use strict';

const { getKoreaDateKey } = require('./huntingTimeService');

function getRaidEntryCredit(character, bossId) {
  return Math.max(
    0,
    Math.floor(Number(character?.bossRaidEntryCredits?.[String(bossId || '')]) || 0)
  );
}

function hasEnteredRaidToday(character, bossId, dateKey = getKoreaDateKey()) {
  return String(character?.bossRaidEntries?.[String(bossId || '')] || '') === dateKey;
}

function hasRaidEntryAvailable(character, bossId, dateKey = getKoreaDateKey()) {
  return !hasEnteredRaidToday(character, bossId, dateKey)
    || getRaidEntryCredit(character, bossId) > 0;
}

function grantRaidEntryCredit(character, bossId, amount = 1) {
  const key = String(bossId || '');
  const granted = Math.max(1, Math.floor(Number(amount) || 1));
  if (!character.bossRaidEntryCredits || typeof character.bossRaidEntryCredits !== 'object') {
    character.bossRaidEntryCredits = {};
  }
  character.bossRaidEntryCredits[key] = getRaidEntryCredit(character, key) + granted;
  if (typeof character.markModified === 'function') character.markModified('bossRaidEntryCredits');
  return {
    bossId: key,
    granted,
    availableCredits: character.bossRaidEntryCredits[key]
  };
}

function buildRaidEntryUseUpdate(character, bossId, dateKey = getKoreaDateKey()) {
  const key = String(bossId || '');
  if (!hasEnteredRaidToday(character, key, dateKey)) {
    return {
      usedCredit: false,
      remainingCredits: getRaidEntryCredit(character, key),
      fields: { [`bossRaidEntries.${key}`]: dateKey }
    };
  }

  const credits = getRaidEntryCredit(character, key);
  if (credits <= 0) throw new Error('오늘의 보스 입장 가능 횟수를 모두 사용했습니다.');
  return {
    usedCredit: true,
    remainingCredits: credits - 1,
    fields: { [`bossRaidEntryCredits.${key}`]: credits - 1 }
  };
}

module.exports = {
  getRaidEntryCredit,
  hasEnteredRaidToday,
  hasRaidEntryAvailable,
  grantRaidEntryCredit,
  buildRaidEntryUseUpdate
};
