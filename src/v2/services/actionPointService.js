'use strict';

const { getKoreaDateKey } = require('./huntingTimeService');

const DEFAULT_ACTION_POINTS = 10;

function ensureActionPointState(character) {
  if (!character.actionPoints || typeof character.actionPoints !== 'object') {
    character.actionPoints = {
      current: DEFAULT_ACTION_POINTS,
      max: DEFAULT_ACTION_POINTS,
      lastResetDate: ''
    };
  }
  character.actionPoints.max = Math.max(
    1,
    Math.floor(Number(character.actionPoints.max) || DEFAULT_ACTION_POINTS)
  );
  character.actionPoints.current = Math.max(
    0,
    Math.min(
      character.actionPoints.max,
      Math.floor(Number(character.actionPoints.current) || 0)
    )
  );
  character.actionPoints.lastResetDate = String(character.actionPoints.lastResetDate || '');
  return character.actionPoints;
}

function markActionPointsModified(character) {
  if (typeof character.markModified === 'function') character.markModified('actionPoints');
}

function ensureDailyActionPoints(character, now = Date.now()) {
  const actionPoints = ensureActionPointState(character);
  const dateKey = getKoreaDateKey(now);
  if (actionPoints.lastResetDate === dateKey) return false;
  actionPoints.current = actionPoints.max;
  actionPoints.lastResetDate = dateKey;
  markActionPointsModified(character);
  return true;
}

function spendActionPoints(character, amount, now = Date.now()) {
  ensureDailyActionPoints(character, now);
  const actionPoints = ensureActionPointState(character);
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (actionPoints.current < cost) throw new Error(`행동력이 ${cost} 필요합니다.`);
  actionPoints.current -= cost;
  markActionPointsModified(character);
  return serializeActionPoints(character);
}

function restoreActionPoints(character, amount, now = Date.now()) {
  ensureDailyActionPoints(character, now);
  const actionPoints = ensureActionPointState(character);
  const recovery = Math.max(0, Math.floor(Number(amount) || 0));
  const before = actionPoints.current;
  actionPoints.current = Math.min(actionPoints.max, actionPoints.current + recovery);
  if (actionPoints.current !== before) markActionPointsModified(character);
  return {
    restored: actionPoints.current - before,
    ...serializeActionPoints(character)
  };
}

function serializeActionPoints(character) {
  const actionPoints = ensureActionPointState(character);
  return {
    current: actionPoints.current,
    max: actionPoints.max,
    lastResetDate: actionPoints.lastResetDate
  };
}

module.exports = {
  DEFAULT_ACTION_POINTS,
  ensureActionPointState,
  ensureDailyActionPoints,
  spendActionPoints,
  restoreActionPoints,
  serializeActionPoints
};
