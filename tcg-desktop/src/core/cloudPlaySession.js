const LOST_SESSION_CODES = new Set(['PLAYING_ELSEWHERE', 'PLAY_SESSION_LOST']);

export const CLOUD_SAVE_OUTBOX_PREFIX = 'hoi-card-desk-cloud-outbox-v1:';
export const CLOUD_SAVE_CONFLICT_BACKUP_PREFIX = 'hoi-card-desk-cloud-conflict-backup-v1:';

export function cloudSaveOutboxKey(accountId) {
  const normalized = String(accountId || '').trim();
  return normalized ? `${CLOUD_SAVE_OUTBOX_PREFIX}${encodeURIComponent(normalized)}` : '';
}

export function cloudSaveConflictBackupKey(accountId) {
  const normalized = String(accountId || '').trim();
  return normalized ? `${CLOUD_SAVE_CONFLICT_BACKUP_PREFIX}${encodeURIComponent(normalized)}` : '';
}

export function isLostPlaySessionError(error) {
  return LOST_SESSION_CODES.has(String(error?.code || ''));
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stateMatches(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function cloneState(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Merge a local snapshot captured while an atomic server mutation was in
 * flight with the mutation's authoritative response.  The server snapshot is
 * the source of truth for fields changed by both sides.  Numeric counters use
 * the local delta so a local spend/earn that happened during the request is
 * preserved alongside a server reward (for example, +500 coins and -100
 * coins becomes a net +400 change).
 */
export function mergeAuthoritativeState(base, local, authoritative) {
  if (stateMatches(local, base)) return cloneState(authoritative);
  if (stateMatches(authoritative, base)) return cloneState(local);

  if (typeof base === 'number' && Number.isFinite(base)
    && typeof local === 'number' && Number.isFinite(local)
    && typeof authoritative === 'number' && Number.isFinite(authoritative)) {
    return Number(authoritative) + (Number(local) - Number(base));
  }

  if (isRecord(base) && isRecord(local) && isRecord(authoritative)) {
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(authoritative),
    ]);
    const merged = {};
    for (const key of keys) {
      const baseValue = Object.prototype.hasOwnProperty.call(base, key) ? base[key] : undefined;
      const localValue = Object.prototype.hasOwnProperty.call(local, key) ? local[key] : undefined;
      const authoritativeValue = Object.prototype.hasOwnProperty.call(authoritative, key)
        ? authoritative[key]
        : undefined;
      const mergedValue = mergeAuthoritativeState(baseValue, localValue, authoritativeValue);
      if (mergedValue !== undefined) merged[key] = mergedValue;
    }
    return merged;
  }

  // Arrays and irreconcilable primitive conflicts are intentionally server
  // authoritative.  A mailbox reward must never be replaced by a stale local
  // collection or pack snapshot.
  return cloneState(authoritative);
}

function parseOutboxEntry(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isRecord(parsed) || !isRecord(parsed.state)) return null;
    const baseRevision = Number(parsed.baseRevision);
    if (!Number.isFinite(baseRevision) || baseRevision < 0) return null;
    const entryId = String(parsed.entryId || '').trim();
    if (!entryId) return null;
    return {
      version: 1,
      entryId,
      baseRevision: Math.floor(baseRevision),
      queuedAt: Math.max(0, Number(parsed.queuedAt) || 0),
      state: parsed.state,
    };
  } catch {
    return null;
  }
}

export function createCloudPlaySession({
  gateway,
  token,
  accountId = '',
  storage = globalThis.localStorage,
  deviceId,
  platform,
  appVersion,
  debounceMs = 400,
  heartbeatMs = 9000,
  nowImpl = Date.now,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
  onPhase = () => {},
  onRemoteState = () => {},
} = {}) {
  if (!gateway) throw new Error('Cloud play gateway is required.');

  const outboxKey = cloudSaveOutboxKey(accountId);
  const conflictBackupKey = cloudSaveConflictBackupKey(accountId);
  let outboxSequence = 0;
  let lease = null;
  let revision = 0;
  let phase = 'idle';
  let saveTimer = null;
  let heartbeatTimer = null;
  let pendingEntry = readOutbox();
  let inFlightEntry = null;
  let conflict = null;
  let savePromise = null;
  let heartbeatPromise = null;
  let authoritativeMutation = null;
  let disposed = false;

  function readOutbox() {
    if (!outboxKey) return null;
    try {
      return parseOutboxEntry(storage?.getItem?.(outboxKey));
    } catch {
      return null;
    }
  }

  function writeOutbox(entry) {
    if (!outboxKey || !entry) return false;
    try {
      storage?.setItem?.(outboxKey, JSON.stringify(entry));
      return true;
    } catch {
      return false;
    }
  }

  function removeOutboxIfMatching(entry) {
    if (!outboxKey || !entry) return;
    try {
      const stored = parseOutboxEntry(storage?.getItem?.(outboxKey));
      if (!stored || stored.entryId === entry.entryId) storage?.removeItem?.(outboxKey);
    } catch {
      // Keeping an unreadable value is safer than deleting a potentially useful backup.
    }
  }

  function archiveConflict(entry, {
    reason = 'revision-conflict',
    serverRevision = revision,
    serverState = null,
  } = {}) {
    if (!conflictBackupKey || !entry) return false;
    try {
      storage?.setItem?.(conflictBackupKey, JSON.stringify({
        version: 1,
        detectedAt: Math.max(0, Number(nowImpl()) || 0),
        reason,
        local: entry,
        serverRevision: Math.max(0, Number(serverRevision) || 0),
        serverState: isRecord(serverState) ? serverState : null,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function createEntry(state, baseRevision = revision) {
    const encoded = JSON.stringify(state);
    const snapshot = JSON.parse(encoded);
    if (!isRecord(snapshot)) throw new Error('Cloud save state must be a JSON object.');
    const queuedAt = Math.max(0, Number(nowImpl()) || 0);
    outboxSequence += 1;
    return {
      version: 1,
      entryId: `${queuedAt}-${outboxSequence}`,
      baseRevision: Math.max(0, Math.floor(Number(baseRevision) || 0)),
      queuedAt,
      state: snapshot,
    };
  }

  function rebasePending(nextRevision) {
    if (!pendingEntry) return;
    pendingEntry = {
      ...pendingEntry,
      baseRevision: Math.max(0, Math.floor(Number(nextRevision) || 0)),
    };
    writeOutbox(pendingEntry);
  }

  function clearPending(entry = pendingEntry) {
    if (!entry) return;
    if (pendingEntry?.entryId === entry.entryId) pendingEntry = null;
    removeOutboxIfMatching(entry);
  }

  function schedulePendingSave() {
    if (saveTimer != null) clearTimeoutImpl(saveTimer);
    saveTimer = setTimeoutImpl(() => {
      saveTimer = null;
      void drainSaves().catch(() => {});
    }, debounceMs);
  }

  function restorePending(entry) {
    if (pendingEntry || !entry) return;
    pendingEntry = entry;
    writeOutbox(entry);
  }

  const credentials = () => ({
    leaseId: lease?.leaseId || '',
    deviceId,
    generation: lease?.generation || 0,
  });

  const ownsCredentials = (value) => Boolean(
    lease
    && value?.leaseId === lease.leaseId
    && value?.deviceId === deviceId
    && Number(value?.generation) === Number(lease.generation),
  );

  function emit(nextPhase, details = {}) {
    phase = nextPhase;
    onPhase({ phase, ...details, lease: lease ? { ...lease } : null, revision });
  }

  function clearHeartbeat() {
    if (heartbeatTimer != null) clearIntervalImpl(heartbeatTimer);
    heartbeatTimer = null;
  }

  function enterConflict({ serverState = null, serverRevision = revision, error = null } = {}) {
    if (!pendingEntry) return false;
    const normalizedServerRevision = Math.max(0, Number(serverRevision) || 0);
    revision = normalizedServerRevision;
    archiveConflict(pendingEntry, {
      serverRevision: normalizedServerRevision,
      serverState,
    });
    conflict = {
      localBaseRevision: pendingEntry.baseRevision,
      serverRevision: normalizedServerRevision,
      serverState: isRecord(serverState) ? serverState : null,
    };
    emit('save-conflict', {
      error,
      code: 'CLOUD_SAVE_CONFLICT',
      message: '이 기기의 미전송 기록과 서버 기록이 서로 달라 확인이 필요합니다.',
      localBaseRevision: conflict.localBaseRevision,
      serverRevision: conflict.serverRevision,
    });
    startHeartbeat();
    return true;
  }

  function lose(error) {
    clearHeartbeat();
    const sessionWasLost = isLostPlaySessionError(error) || Boolean(error?.activePlatform);
    const sessionMoved = error?.code === 'PLAYING_ELSEWHERE' || Boolean(error?.activePlatform);
    if (sessionWasLost) lease = null;
    if (sessionMoved) {
      const newestUnsavedEntry = pendingEntry || inFlightEntry;
      if (newestUnsavedEntry) {
        archiveConflict(newestUnsavedEntry, {
          reason: 'session-moved',
          serverRevision: Number(error?.revision) || revision,
        });
        if (pendingEntry) clearPending(pendingEntry);
        else removeOutboxIfMatching(inFlightEntry);
      }
      inFlightEntry = null;
      conflict = null;
      if (saveTimer != null) clearTimeoutImpl(saveTimer);
      saveTimer = null;
    } else if (!pendingEntry && inFlightEntry) {
      // A heartbeat can fail while a save request is still settling. Keep the
      // in-flight snapshot available to resume in this process as well as on disk.
      restorePending(inFlightEntry);
    }
    const nextPhase = sessionMoved
      ? 'playing-elsewhere'
      : 'connection-error';
    emit(nextPhase, {
      error,
      code: String(error?.code || ''),
      message: String(error?.message || ''),
      activePlatform: String(error?.activePlatform || ''),
      generation: Math.max(0, Number(error?.generation) || 0),
    });
  }

  function acceptSession(response, { applyState = true } = {}) {
    if (!response?.leaseId || !response?.generation) {
      const error = new Error('플레이 세션 응답이 올바르지 않습니다.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
    lease = {
      leaseId: response.leaseId,
      generation: response.generation,
      expiresAt: response.expiresAt || 0,
      serverNow: response.serverNow || 0,
    };
    const responseRevision = Math.max(0, Number(response.revision) || 0);
    revision = responseRevision;
    conflict = null;

    let shouldApplyState = applyState;
    if (pendingEntry) {
      if (isRecord(response.state) && stateMatches(response.state, pendingEntry.state)) {
        clearPending(pendingEntry);
      } else if (responseRevision === pendingEntry.baseRevision) {
        shouldApplyState = false;
      } else if (enterConflict({
        serverState: response.state,
        serverRevision: responseRevision,
      })) {
        return response;
      }
    }

    if (shouldApplyState && response.state) onRemoteState(response.state, response);
    emit('active', { initialized: response.initialized === true });
    startHeartbeat();
    return response;
  }

  async function heartbeat() {
    if (disposed || !lease || heartbeatPromise) return heartbeatPromise;
    const heartbeatCredentials = credentials();
    heartbeatPromise = gateway.heartbeat(token, heartbeatCredentials)
      .then((response) => {
        if (disposed || !ownsCredentials(heartbeatCredentials)) return response;
        if (response?.expiresAt) lease.expiresAt = response.expiresAt;
        if (response?.serverNow) lease.serverNow = response.serverNow;
        if (Number(response?.revision) > revision) revision = Number(response.revision);
        return response;
      })
      .catch((error) => {
        if (!disposed && ownsCredentials(heartbeatCredentials)) lose(error);
        throw error;
      })
      .finally(() => { heartbeatPromise = null; });
    return heartbeatPromise;
  }

  function startHeartbeat() {
    clearHeartbeat();
    if (disposed || !lease) return;
    heartbeatTimer = setIntervalImpl(() => { void heartbeat().catch(() => {}); }, heartbeatMs);
  }

  async function open({ bootstrapState = null, allowBootstrap = false } = {}) {
    if (disposed) throw new Error('Cloud play session is disposed.');
    clearHeartbeat();
    emit('connecting');
    try {
      const response = await gateway.open(token, {
        deviceId,
        platform,
        appVersion,
        ...(bootstrapState ? { bootstrapState } : {}),
        allowBootstrap: allowBootstrap === true,
      });
      const accepted = acceptSession(response);
      if (phase === 'active' && pendingEntry) await drainSaves();
      return accepted;
    } catch (error) {
      if (Number(error?.status) === 428 || error?.code === 'CLOUD_SAVE_MIGRATION_REQUIRED') {
        emit('migration-required', { error, code: error.code, message: error.message });
      } else if (phase !== 'save-conflict') {
        lose(error);
      }
      throw error;
    }
  }

  async function takeover({ expectedGeneration } = {}) {
    if (disposed) throw new Error('Cloud play session is disposed.');
    clearHeartbeat();
    emit('taking-over');
    try {
      const response = await gateway.takeover(token, {
        deviceId,
        platform,
        appVersion,
        ...(expectedGeneration ? { expectedGeneration } : {}),
      });
      const accepted = acceptSession(response);
      if (phase === 'active' && pendingEntry) await drainSaves();
      return accepted;
    } catch (error) {
      if (phase !== 'save-conflict') lose(error);
      throw error;
    }
  }

  async function drainSaves() {
    if (authoritativeMutation) return { deferred: true };
    if (savePromise) return savePromise;
    savePromise = (async () => {
      while (pendingEntry && lease && phase === 'active' && !disposed) {
        const entry = pendingEntry;
        const saveCredentials = credentials();
        pendingEntry = null;
        inFlightEntry = entry;
        try {
          const response = await gateway.saveState(token, {
            ...saveCredentials,
            baseRevision: entry.baseRevision,
            state: entry.state,
          });
          if (disposed || !ownsCredentials(saveCredentials)) {
            if (!disposed && phase !== 'playing-elsewhere') restorePending(entry);
            continue;
          }
          revision = Math.max(revision, Number(response?.revision) || 0);
          if (pendingEntry?.entryId === entry.entryId) clearPending(entry);
          else if (pendingEntry) rebasePending(revision);
          else removeOutboxIfMatching(entry);
        } catch (error) {
          if (disposed || !ownsCredentials(saveCredentials)) {
            if (!disposed && phase !== 'playing-elsewhere') restorePending(entry);
            continue;
          }
          if (error?.code === 'SAVE_CONFLICT' && Number.isFinite(Number(error?.revision)) && error?.state) {
            revision = Math.max(0, Number(error.revision) || 0);
            if (stateMatches(error.state, entry.state)) {
              if (pendingEntry?.entryId === entry.entryId) clearPending(entry);
              else if (pendingEntry) rebasePending(revision);
              else removeOutboxIfMatching(entry);
              emit('active');
              startHeartbeat();
              continue;
            }
            restorePending(entry);
            enterConflict({
              serverState: error.state,
              serverRevision: revision,
              error,
            });
            break;
          }
          restorePending(entry);
          lose(error);
          throw error;
        } finally {
          if (inFlightEntry?.entryId === entry.entryId) inFlightEntry = null;
        }
      }
    })().finally(() => { savePromise = null; });
    return savePromise;
  }

  function queueState(state) {
    if (disposed || !lease || phase !== 'active') return false;
    try {
      pendingEntry = createEntry(state, revision);
    } catch {
      return false;
    }
    writeOutbox(pendingEntry);
    // An atomic server mutation (such as claiming a mailbox reward) owns the
    // revision until its response is applied.  Keep local changes durable in
    // the outbox, but do not send the stale base revision while that request is
    // in flight.
    if (!authoritativeMutation) schedulePendingSave();
    return true;
  }

  async function flush() {
    if (saveTimer != null) clearTimeoutImpl(saveTimer);
    saveTimer = null;
    if (pendingEntry && lease && phase === 'active') await drainSaves();
    if (savePromise) await savePromise;
    return { revision, pending: Boolean(pendingEntry), conflict: Boolean(conflict) };
  }

  async function resolveConflict(strategy) {
    if (!conflict || !pendingEntry || !lease) return false;
    if (strategy === 'server') {
      const serverState = conflict.serverState;
      if (!serverState) return false;
      const discardedEntry = pendingEntry;
      pendingEntry = null;
      removeOutboxIfMatching(discardedEntry);
      conflict = null;
      if (serverState) onRemoteState(serverState, { revision });
      emit('active');
      startHeartbeat();
      return true;
    }
    if (strategy !== 'local') throw new Error('Unknown cloud save conflict strategy.');
    conflict = null;
    rebasePending(revision);
    emit('active');
    startHeartbeat();
    await drainSaves();
    return phase === 'active' && !pendingEntry;
  }

  function validateServerSnapshot(response) {
    if (!lease || phase !== 'active') {
      const error = new Error('활성 플레이 연결이 없어 서버 기록을 적용할 수 없습니다.');
      error.code = 'PLAY_SESSION_LOST';
      throw error;
    }
    if (!isRecord(response?.state)) {
      const error = new Error('서버 진행 기록 응답이 올바르지 않습니다.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
    if (response?.leaseId && response.leaseId !== lease.leaseId) {
      const error = new Error('플레이 연결이 다른 기기로 이동했습니다.');
      error.code = 'PLAY_SESSION_LOST';
      throw error;
    }
    if (response?.generation && Number(response.generation) !== Number(lease.generation)) {
      const error = new Error('플레이 연결 세대가 변경되었습니다.');
      error.code = 'PLAY_SESSION_LOST';
      throw error;
    }
    const nextRevision = Math.max(0, Math.floor(Number(response.revision) || 0));
    if (nextRevision < revision) {
      const error = new Error('서버가 이전 진행 기록을 반환했습니다.');
      error.code = 'STALE_SERVER_STATE';
      throw error;
    }
    return nextRevision;
  }

  function applyServerSnapshot(response, state, nextRevision) {
    revision = nextRevision;
    if (response.expiresAt) lease.expiresAt = response.expiresAt;
    if (response.serverNow) lease.serverNow = response.serverNow;
    onRemoteState(state, response);
    emit('active');
    startHeartbeat();
    return true;
  }

  function adoptServerSnapshot(response) {
    const nextRevision = validateServerSnapshot(response);
    if (pendingEntry || inFlightEntry || savePromise || conflict || authoritativeMutation) {
      const error = new Error('저장 중인 기록이 남아 있어 서버 보상을 아직 적용할 수 없습니다.');
      error.code = 'CLOUD_MUTATION_BUSY';
      throw error;
    }
    return applyServerSnapshot(response, response.state, nextRevision);
  }

  /**
   * Reserve the current revision for a server-side atomic mutation.  Local
   * store notifications continue to be persisted to the outbox, but are held
   * until commitAuthoritativeMutation can rebase them on the response.
   */
  function beginAuthoritativeMutation(baseState) {
    if (!lease || phase !== 'active') {
      const error = new Error('활성 플레이 연결이 없어 서버 보상을 적용할 수 없습니다.');
      error.code = 'PLAY_SESSION_LOST';
      throw error;
    }
    if (pendingEntry || inFlightEntry || savePromise || conflict || authoritativeMutation) {
      const error = new Error('저장 중인 기록이 남아 있어 서버 보상을 적용할 수 없습니다.');
      error.code = 'CLOUD_MUTATION_BUSY';
      throw error;
    }
    authoritativeMutation = {
      baseRevision: revision,
      baseState: cloneState(baseState),
    };
    if (saveTimer != null) clearTimeoutImpl(saveTimer);
    saveTimer = null;
    return { baseRevision: revision };
  }

  function commitAuthoritativeMutation(response) {
    if (!authoritativeMutation) {
      const error = new Error('적용할 서버 보상 요청이 없습니다.');
      error.code = 'CLOUD_MUTATION_MISSING';
      throw error;
    }
    const mutation = authoritativeMutation;
    const nextRevision = validateServerSnapshot(response);
    const localEntry = pendingEntry;
    const localState = localEntry?.state;
    const mergedState = localEntry
      ? mergeAuthoritativeState(mutation.baseState, localState, response.state)
      : response.state;
    const hasRebasedLocalState = Boolean(
      localEntry && !stateMatches(mergedState, response.state),
    );

    authoritativeMutation = null;
    if (localEntry) {
      if (hasRebasedLocalState) {
        pendingEntry = {
          ...localEntry,
          baseRevision: nextRevision,
          state: cloneState(mergedState),
        };
        writeOutbox(pendingEntry);
      } else {
        clearPending(localEntry);
      }
    }
    applyServerSnapshot(response, mergedState, nextRevision);
    if (hasRebasedLocalState) schedulePendingSave();
    return {
      applied: true,
      rebased: hasRebasedLocalState,
      pending: Boolean(pendingEntry),
    };
  }

  function cancelAuthoritativeMutation() {
    if (!authoritativeMutation) return false;
    authoritativeMutation = null;
    if (pendingEntry && lease && phase === 'active') schedulePendingSave();
    return true;
  }

  async function release({ flushPending = true } = {}) {
    clearHeartbeat();
    if (!lease) return false;
    if (flushPending) await flush();
    const releasedLease = credentials();
    emit('releasing');
    try {
      await gateway.release(token, releasedLease);
    } catch (error) {
      // A lost response is ambiguous: the server may already have released the
      // lease. Re-open instead of continuing with credentials that may be stale.
      lease = null;
      lose(error);
      throw error;
    }
    lease = null;
    if (saveTimer != null) clearTimeoutImpl(saveTimer);
    saveTimer = null;
    emit('released');
    return true;
  }

  async function resume({ bootstrapState = null, allowBootstrap = false } = {}) {
    if (phase === 'save-conflict') return false;
    if (lease) {
      try {
        await heartbeat();
        emit('active');
        startHeartbeat();
        if (pendingEntry) await drainSaves();
        return phase === 'active';
      } catch (error) {
        if (error?.code !== 'PLAY_SESSION_LOST' || error?.activePlatform) return false;
      }
    }
    try {
      await open({ bootstrapState, allowBootstrap });
      return phase === 'active';
    } catch {
      return false;
    }
  }

  function dispose() {
    disposed = true;
    clearHeartbeat();
    if (saveTimer != null) clearTimeoutImpl(saveTimer);
    saveTimer = null;
    pendingEntry = null;
    inFlightEntry = null;
    conflict = null;
    lease = null;
  }

  return {
    open,
    takeover,
    heartbeat,
    queueState,
    flush,
    resolveConflict,
    adoptServerSnapshot,
    beginAuthoritativeMutation,
    commitAuthoritativeMutation,
    cancelAuthoritativeMutation,
    release,
    resume,
    dispose,
    getSnapshot: () => ({
      phase,
      lease: lease ? { ...lease } : null,
      revision,
      hasPendingState: Boolean(pendingEntry || inFlightEntry),
      hasSaveConflict: Boolean(conflict),
      conflict: conflict ? {
        localBaseRevision: conflict.localBaseRevision,
        serverRevision: conflict.serverRevision,
      } : null,
    }),
  };
}
