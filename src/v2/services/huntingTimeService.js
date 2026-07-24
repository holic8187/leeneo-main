'use strict';

const { randomUUID } = require('node:crypto');
const { createAdminMail } = require('./inventoryService');
const {
  getDailyAugmentEffects,
  hasDailyAugment,
  updateDailyAugmentCounters
} = require('./dailyAugmentService');

const MAX_HUNTING_SECONDS = 400 * 60;
const ABSOLUTE_MAX_HUNTING_SECONDS = 800 * 60;
const DAILY_HUNTING_MINUTES = 360;
const DAILY_HUNTING_ITEM_ID = 'hunting_time_360m';

function getOfflineHuntingSummaryId(summary = null) {
  if (!summary || typeof summary !== 'object') return '';
  return String(summary.id || summary.startedAt || summary.updatedAt || '').trim();
}

function createOfflineHuntingSummary(now = Date.now(), idFactory = randomUUID) {
  const timestamp = new Date(now).toISOString();
  const generatedId = typeof idFactory === 'function' ? String(idFactory() || '').trim() : '';
  return {
    id: generatedId || timestamp,
    startedAt: timestamp,
    updatedAt: timestamp,
    elapsedSeconds: 0,
    kills: 0,
    skillUses: 0,
    exp: 0,
    money: 0,
    items: []
  };
}

function acknowledgeOfflineHuntingSummary(character, requestedId) {
  const state = ensureHuntingState(character);
  const summary = state.offlineSummary;
  if (!summary || typeof summary !== 'object') {
    return { acknowledged: true, cleared: false };
  }

  const expectedId = String(requestedId || '').trim();
  const currentId = getOfflineHuntingSummaryId(summary);
  if (!expectedId || !currentId || expectedId !== currentId) {
    return { acknowledged: false, cleared: false };
  }

  state.offlineSummary = null;
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return { acknowledged: true, cleared: true };
}

function getKoreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function ensureHuntingState(character) {
  if (!character.huntingTime || typeof character.huntingTime !== 'object') {
    character.huntingTime = {};
  }
  character.huntingTime.maximumSeconds = Math.max(
    MAX_HUNTING_SECONDS,
    Math.min(
      ABSOLUTE_MAX_HUNTING_SECONDS,
      Math.floor(Number(character.huntingTime.maximumSeconds) || MAX_HUNTING_SECONDS)
    )
  );
  character.huntingTime.remainingSeconds = Math.max(
    0,
    Math.min(
      character.huntingTime.maximumSeconds,
      Math.floor(Number(character.huntingTime.remainingSeconds) || 0)
    )
  );
  character.huntingTime.enabled = Boolean(character.huntingTime.enabled);
  character.huntingTime.lastDailyGrantDate = String(character.huntingTime.lastDailyGrantDate || '');
  character.huntingTime.consumptionRemainder = Math.max(
    0,
    Math.min(0.999999, Number(character.huntingTime.consumptionRemainder) || 0)
  );
  return character.huntingTime;
}

function ensureDailyHuntingMail(character, now = new Date()) {
  const state = ensureHuntingState(character);
  const dateKey = getKoreaDateKey(now);
  if (state.lastDailyGrantDate === dateKey) return false;
  const mail = createAdminMail({
    itemId: DAILY_HUNTING_ITEM_ID,
    quantity: 1,
    message: '오늘의 무료 자동사냥 시간 360분입니다. 우편은 24시간 뒤 사라집니다.'
  });
  mail.sender = '호이상사 운영실';
  mail.title = '일일 자동사냥 시간 지급';
  character.mailbox.push(mail);
  state.lastDailyGrantDate = dateKey;
  if (typeof character.markModified === 'function') {
    character.markModified('huntingTime');
    character.markModified('mailbox');
  }
  return true;
}

function setHuntingEnabled(character, enabled, now = Date.now()) {
  const state = ensureHuntingState(character);
  state.enabled = Boolean(enabled) && state.remainingSeconds > 0;
  state.lastTickAt = state.enabled ? new Date(now) : null;
  state.offlinePassiveRecoveryAt = null;
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return serializeHuntingTime(character);
}

function tickHuntingTime(character, active, now = Date.now()) {
  const state = ensureHuntingState(character);
  const last = state.lastTickAt ? new Date(state.lastTickAt).getTime() : now;
  if (state.enabled && active && state.remainingSeconds > 0) {
    let elapsedSeconds = Math.max(0, Math.floor((now - last) / 1000));
    if (elapsedSeconds > 0 && hasDailyAugment(character, 'automation_revolution', new Date(now))) {
      updateDailyAugmentCounters(character, (counters) => {
        const freeSeconds = Math.max(0, Number(counters.freeHuntingSeconds) || 0);
        const waivedSeconds = Math.min(freeSeconds, elapsedSeconds);
        counters.freeHuntingSeconds = freeSeconds - waivedSeconds;
        elapsedSeconds -= waivedSeconds;
      });
    }
    const reduction = Math.max(
      0,
      Math.min(
        99,
        Number(getDailyAugmentEffects(character, {}, new Date(now)).huntingTimeReductionPercent) || 0
      )
    );
    const preciseConsumption = elapsedSeconds * (1 - reduction / 100)
      + Math.max(0, Number(state.consumptionRemainder) || 0);
    const consumedSeconds = Math.floor(preciseConsumption);
    state.consumptionRemainder = preciseConsumption - consumedSeconds;
    state.remainingSeconds = Math.max(
      0,
      state.remainingSeconds - consumedSeconds
    );
  }
  if (state.remainingSeconds <= 0) state.enabled = false;
  state.lastTickAt = state.enabled ? new Date(now) : null;
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return serializeHuntingTime(character);
}

function addHuntingMinutes(character, minutes) {
  const state = ensureHuntingState(character);
  const before = state.remainingSeconds;
  state.remainingSeconds = Math.min(
    state.maximumSeconds,
    before + Math.max(0, Math.floor(Number(minutes) || 0) * 60)
  );
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return {
    addedSeconds: state.remainingSeconds - before,
    ...serializeHuntingTime(character)
  };
}

function addHuntingCapacityMinutes(character, minutes) {
  const state = ensureHuntingState(character);
  const before = state.maximumSeconds;
  state.maximumSeconds = Math.min(
    ABSOLUTE_MAX_HUNTING_SECONDS,
    before + Math.max(0, Math.floor(Number(minutes) || 0) * 60)
  );
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return {
    addedSeconds: state.maximumSeconds - before,
    ...serializeHuntingTime(character)
  };
}

function serializeHuntingTime(character) {
  const state = ensureHuntingState(character);
  return {
    remainingSeconds: state.remainingSeconds,
    maximumSeconds: state.maximumSeconds,
    enabled: state.enabled,
    consumptionRemainder: state.consumptionRemainder,
    offlineSummary: state.offlineSummary || null
  };
}

module.exports = {
  MAX_HUNTING_SECONDS,
  ABSOLUTE_MAX_HUNTING_SECONDS,
  DAILY_HUNTING_MINUTES,
  DAILY_HUNTING_ITEM_ID,
  getKoreaDateKey,
  ensureHuntingState,
  ensureDailyHuntingMail,
  setHuntingEnabled,
  tickHuntingTime,
  addHuntingMinutes,
  addHuntingCapacityMinutes,
  serializeHuntingTime,
  getOfflineHuntingSummaryId,
  createOfflineHuntingSummary,
  acknowledgeOfflineHuntingSummary
};
