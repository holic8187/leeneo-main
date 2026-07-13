'use strict';

const { getActiveSkillEffects } = require('../skills/skillService');

const OFFLINE_RECOVERY_CONTINUITY_MS = 15_000;

function restoreCharacterMp(character, amount) {
  const restored = Math.max(0, Math.floor(Number(amount) || 0));
  if (!restored || !character?.resources) return 0;
  const current = Math.max(0, Number(character.resources.currentMp) || 0);
  const maximum = Math.max(0, Number(character.resources.maxMp) || 0);
  const next = Math.min(maximum, current + restored);
  character.resources.currentMp = next;
  if (next !== current && typeof character.markModified === 'function') {
    character.markModified('resources');
  }
  return next - current;
}

function applyOfflinePassiveMpRecovery(character, {
  now = Date.now(),
  baselineAt = now
} = {}) {
  if (!character?.huntingTime || !character?.resources) return { restored: 0, ticks: 0 };
  const effects = getActiveSkillEffects(character, now);
  const amountPerTick = Math.max(0, Math.floor(Number(effects.periodicMpRestore) || 0));
  const intervalMs = Math.max(
    1_000,
    Math.floor(Number(effects.periodicRestoreIntervalSeconds) || 10) * 1_000
  );
  const storedAt = character.huntingTime.offlinePassiveRecoveryAt
    ? new Date(character.huntingTime.offlinePassiveRecoveryAt).getTime()
    : 0;
  const baseline = Math.max(0, Number(baselineAt) || 0);
  const canContinueStoredClock = Number.isFinite(storedAt)
    && storedAt > 0
    && baseline - storedAt <= OFFLINE_RECOVERY_CONTINUITY_MS;
  const startAt = canContinueStoredClock ? storedAt : baseline;
  const elapsed = Math.max(0, Number(now) - startAt);
  const ticks = amountPerTick > 0 ? Math.floor(elapsed / intervalMs) : 0;
  const nextAt = amountPerTick > 0
    ? startAt + ticks * intervalMs
    : Number(now);
  character.huntingTime.offlinePassiveRecoveryAt = new Date(Math.max(startAt, nextAt));
  if (typeof character.markModified === 'function') character.markModified('huntingTime');
  return {
    restored: restoreCharacterMp(character, ticks * amountPerTick),
    ticks,
    amountPerTick
  };
}

module.exports = {
  restoreCharacterMp,
  applyOfflinePassiveMpRecovery
};
