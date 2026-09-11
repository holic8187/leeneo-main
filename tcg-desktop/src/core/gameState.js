import { INCIDENT_ACTIVE_DURATION_MS } from './incidentEngine.js';
import { hydratePendingPackOpening } from './packOpeningSession.js';

export const STORAGE_KEY = 'hoi-card-desk-state-v1';
export const ACCOUNT_STORAGE_PREFIX = 'hoi-card-desk-state-v2:';
export const LEGACY_MIGRATION_KEY = 'hoi-card-desk-state-v2:legacy-migrated-to';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createDefaultState(now = Date.now()) {
  return {
    version: 4,
    profile: {
      displayName: '익명 사원',
      rank: '대리석 책상',
      createdAt: now,
    },
    wallet: {
      coins: 7200,
      linkPoints: 0,
    },
    packs: {
      standard: 3,
    },
    collection: {
      'simsim-c': 2,
      'winter-c': 1,
      'kkamdung-c': 1,
    },
    pity: {
      standard: 0,
    },
    pendingPackOpening: null,
    selectedExpeditionSquad: ['simsim-c', 'winter-c', 'kkamdung-c'],
    selectedRaidSquad: ['simsim-c', 'winter-c', 'kkamdung-c'],
    expedition: null,
    activeIncident: null,
    recentIncidentIds: [],
    completedIncidentInstanceIds: [],
    nextIncidentAt: null,
    pendingIncident: null,
    resolvedIncidents: 0,
    incidentScheduled: false,
    raid: null,
    link: {
      status: 'unlinked',
      hoiNickname: null,
      linkedAt: null,
    },
    settings: {
      discreetMode: true,
      payrollMode: false,
      incidentNotifications: true,
    },
    activity: [
      {
        id: `welcome-${now}`,
        type: 'system',
        message: '카드부 인사기록이 생성되었습니다.',
        at: now,
      },
    ],
  };
}

export function hydrateState(saved, now = Date.now()) {
  const defaults = createDefaultState(now);
  if (!saved || typeof saved !== 'object') return defaults;

  const state = {
    ...defaults,
    ...saved,
    profile: { ...defaults.profile, ...(saved.profile || {}) },
    wallet: { ...defaults.wallet, ...(saved.wallet || {}) },
    packs: { ...defaults.packs, ...(saved.packs || {}) },
    collection: { ...defaults.collection, ...(saved.collection || {}) },
    pity: { ...defaults.pity, ...(saved.pity || {}) },
    link: { ...defaults.link, ...(saved.link || {}) },
    settings: { ...defaults.settings, ...(saved.settings || {}) },
  };

  state.version = defaults.version;

  const legacySquad = Array.isArray(saved.selectedSquad) ? saved.selectedSquad : null;
  const hydrateSquad = (candidate, fallback) => (
    Array.isArray(candidate)
      ? [...new Set(candidate)].filter((id) => state.collection[id]).slice(0, 3)
      : fallback
  );
  state.selectedExpeditionSquad = hydrateSquad(
    saved.selectedExpeditionSquad || legacySquad,
    defaults.selectedExpeditionSquad,
  );
  state.selectedRaidSquad = hydrateSquad(
    saved.selectedRaidSquad || legacySquad,
    defaults.selectedRaidSquad,
  );
  // Keep the legacy alias readable for older renderer code during migration.
  state.selectedSquad = state.selectedExpeditionSquad;
  state.activity = Array.isArray(saved.activity) ? saved.activity.slice(0, 30) : defaults.activity;

  let expiredActiveIncident = false;
  if (saved.activeIncident && typeof saved.activeIncident === 'object' && typeof saved.activeIncident.id === 'string') {
    const arrivedAt = saved.activeIncident.arrivedAt != null
      && Number.isFinite(Number(saved.activeIncident.arrivedAt))
      ? Number(saved.activeIncident.arrivedAt)
      : now;
    const expiresAt = saved.activeIncident.expiresAt != null
      && Number.isFinite(Number(saved.activeIncident.expiresAt))
      ? Number(saved.activeIncident.expiresAt)
      : arrivedAt + INCIDENT_ACTIVE_DURATION_MS;
    expiredActiveIncident = expiresAt <= now;
    state.activeIncident = expiredActiveIncident
      ? null
      : {
        ...saved.activeIncident,
        id: saved.activeIncident.id,
        instanceId: typeof saved.activeIncident.instanceId === 'string' && saved.activeIncident.instanceId
          ? saved.activeIncident.instanceId
          : `legacy-${saved.activeIncident.id}-${arrivedAt}`,
        arrivedAt,
        expiresAt,
      };
  } else {
    state.activeIncident = null;
  }

  state.pendingPackOpening = hydratePendingPackOpening(saved.pendingPackOpening);

  state.recentIncidentIds = Array.isArray(saved.recentIncidentIds)
    ? [...new Set(saved.recentIncidentIds.filter((id) => typeof id === 'string' && id))].slice(0, 12)
    : defaults.recentIncidentIds;
  const savedCompletedInstances = Array.isArray(saved.completedIncidentInstanceIds)
    ? saved.completedIncidentInstanceIds
    : saved.completedInstanceIds;
  state.completedIncidentInstanceIds = Array.isArray(savedCompletedInstances)
    ? [...new Set(savedCompletedInstances.filter((id) => typeof id === 'string' && id))].slice(-200)
    : defaults.completedIncidentInstanceIds;
  state.nextIncidentAt = saved.nextIncidentAt != null
    && Number.isFinite(Number(saved.nextIncidentAt))
    ? Number(saved.nextIncidentAt)
    : null;
  state.pendingIncident = Object.prototype.hasOwnProperty.call(saved, 'pendingIncident')
    ? saved.pendingIncident
    : (saved.incidentScheduled ? true : null);
  state.resolvedIncidents = Math.max(0, Math.floor(Number(saved.resolvedIncidents) || 0));
  state.incidentScheduled = Boolean(saved.incidentScheduled || state.pendingIncident);
  if (expiredActiveIncident) {
    state.pendingIncident = null;
    state.nextIncidentAt = null;
    state.incidentScheduled = false;
  }
  return state;
}

export function storageKeyForUser(userId) {
  const normalized = String(userId || '').trim();
  if (!normalized) return STORAGE_KEY;
  return `${ACCOUNT_STORAGE_PREFIX}${encodeURIComponent(normalized)}`;
}

function readInitialState(storage, storageKey, userId) {
  const saved = storage?.getItem?.(storageKey);
  if (saved) return saved;
  if (!userId || storage?.getItem?.(LEGACY_MIGRATION_KEY)) return null;

  const legacy = storage?.getItem?.(STORAGE_KEY);
  if (!legacy) return null;
  const parsed = JSON.parse(legacy);
  if (!parsed || typeof parsed !== 'object') return null;
  const migrated = JSON.stringify(hydrateState(parsed));
  storage?.setItem?.(storageKey, migrated);
  storage?.setItem?.(LEGACY_MIGRATION_KEY, String(userId));
  return migrated;
}

export function createGameStore(storage = globalThis.localStorage, { userId = '' } = {}) {
  const storageKey = storageKeyForUser(userId);
  let state;
  try {
    const saved = readInitialState(storage, storageKey, userId);
    state = hydrateState(saved ? JSON.parse(saved) : null);
  } catch {
    state = createDefaultState();
  }

  const listeners = new Set();
  const persist = (nextState) => {
    if (typeof storage?.setItem !== 'function') return;
    storage.setItem(storageKey, JSON.stringify(nextState));
  };
  const notify = () => {
    for (const listener of listeners) listener(clone(state));
  };
  const commit = (nextState) => {
    persist(nextState);
    state = nextState;
    notify();
  };

  return {
    storageKey,
    getState: () => clone(state),
    update(mutator) {
      const draft = clone(state);
      const result = mutator(draft);
      const nextState = hydrateState(result && typeof result === 'object' ? result : draft);
      commit(nextState);
      return clone(state);
    },
    replace(nextState) {
      commit(hydrateState(nextState));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      commit(createDefaultState());
    },
    flush() {
      persist(state);
      return clone(state);
    },
  };
}

export function appendActivity(state, message, type = 'system', now = Date.now()) {
  state.activity = [
    { id: `${type}-${now}-${Math.random().toString(36).slice(2, 7)}`, type, message, at: now },
    ...(state.activity || []),
  ].slice(0, 30);
  return state;
}
