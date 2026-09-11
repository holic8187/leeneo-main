import { INCIDENTS, incidentById } from '../data/incidentCatalog.js';

export const INCIDENT_TIMING = Object.freeze({ minimumMs: 12 * 60 * 1000, maximumMs: 24 * 60 * 1000 });
export const INCIDENT_ACTIVE_DURATION_MS = 10 * 60 * 1000;
export const INCIDENT_TIER_CHANCES = Object.freeze({ ordinary: 0.92, special: 0.07, mythic: 0.01 });
export const INCIDENT_REPEAT_WINDOW = 5;

function unitRoll(random) {
  const value = Number(random());
  return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
}

/** Time after startup/last resolution; there is no per-minute probability roll. */
export function nextIncidentDelay(random = Math.random) {
  return INCIDENT_TIMING.minimumMs
    + Math.floor(unitRoll(random) * (INCIDENT_TIMING.maximumMs - INCIDENT_TIMING.minimumMs + 1));
}

export function incidentExpiresAt(arrivedAt = Date.now()) {
  const timestamp = Number(arrivedAt);
  return (Number.isFinite(timestamp) ? timestamp : Date.now()) + INCIDENT_ACTIVE_DURATION_MS;
}

/**
 * Classify a persisted incident that was scheduled before the app was
 * backgrounded or closed. The scheduled timestamp is the real arrival time,
 * so reopening the app cannot extend the ten-minute response window.
 */
export function pendingIncidentWindow(pendingIncident, now = Date.now()) {
  if (!pendingIncident || typeof pendingIncident !== 'object' || typeof pendingIncident.id !== 'string') return null;
  const scheduledAt = Number(pendingIncident.scheduledAt);
  const currentTime = Number(now);
  if (!Number.isFinite(scheduledAt) || !Number.isFinite(currentTime)) return null;
  const expiresAt = incidentExpiresAt(scheduledAt);
  return {
    scheduledAt,
    expiresAt,
    status: scheduledAt > currentTime ? 'scheduled' : (expiresAt <= currentTime ? 'expired' : 'active'),
  };
}

export function isIncidentExpired(activeIncident, now = Date.now()) {
  if (!activeIncident || typeof activeIncident !== 'object') return false;
  const expiresAt = Number(activeIncident.expiresAt);
  if (Number.isFinite(expiresAt)) return expiresAt <= Number(now);
  const arrivedAt = Number(activeIncident.arrivedAt);
  return Number.isFinite(arrivedAt)
    && arrivedAt + INCIDENT_ACTIVE_DURATION_MS <= Number(now);
}

/** Recent IDs are ordered newest first. Repetition filtering preserves tier odds. */
export function chooseIncident({ random = Math.random, recentIds = [] } = {}) {
  const roll = unitRoll(random);
  const tier = roll < INCIDENT_TIER_CHANCES.ordinary ? 'ordinary' : roll < 0.99 ? 'special' : 'mythic';
  const pool = INCIDENTS.filter((entry) => entry.tier === tier);
  const recent = Array.isArray(recentIds) ? recentIds.slice(0, INCIDENT_REPEAT_WINDOW) : [];
  const unseen = pool.filter((entry) => !recent.includes(entry.id));
  // Four mythic events may all occur within five draws. Reuse the least recent,
  // rather than rerolling the tier and silently changing the published odds.
  const candidates = unseen.length ? unseen : [pool.reduce((oldest, entry) => (
    recent.indexOf(entry.id) > recent.indexOf(oldest.id) ? entry : oldest
  ))];
  return candidates[Math.floor(unitRoll(random) * candidates.length)];
}

/** Validate a choice against the current instance and return canonical rewards.
 * Call within the same store update that clears activeIncident and credits it.
 * completedInstanceIds and the active instance must be persisted by the caller.
 */
export function resolveIncidentChoice({ activeIncident, instanceId, choiceId, completedInstanceIds = [] } = {}) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('유효한 돌발 업무 번호가 없습니다.');
  const completed = Array.isArray(completedInstanceIds) ? completedInstanceIds : [];
  if (completed.includes(instanceId)) throw new Error('이미 보상을 받은 돌발 업무입니다.');
  if (!activeIncident || activeIncident.instanceId !== instanceId) throw new Error('이미 종료되었거나 이전 돌발 업무의 선택지입니다.');
  const canonical = incidentById(activeIncident.id);
  if (!canonical) throw new Error('돌발 업무 정보를 찾을 수 없습니다.');
  const selected = canonical.choices.find((entry) => entry.id === choiceId);
  if (!selected) throw new Error('이 돌발 업무에서 고를 수 없는 선택지입니다.');
  return {
    incidentId: canonical.id,
    instanceId,
    choiceId: selected.id,
    result: selected.result,
    reward: { ...selected.reward },
    completedInstanceIds: [instanceId, ...completed.filter((id) => typeof id === 'string')].slice(0, 100),
  };
}
