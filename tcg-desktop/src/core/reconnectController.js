import { withDeadline } from './promiseDeadline.js';

export function reconnectErrorKind(error = {}) {
  if ([401, 403, 410].includes(Number(error.status))) return 'expired';
  if (['PLAYING_ELSEWHERE', 'CLOUD_SAVE_CONFLICT', 'SAVE_CONFLICT', 'CLOUD_SAVE_MIGRATION_REQUIRED'].includes(error.code)
    || error.activePlatform || Number(error.status) === 428) return 'blocked';
  if (Number(error.status) >= 500 || [408, 429].includes(Number(error.status))
    || ['NETWORK_ERROR', 'TIMEOUT', 'PLAY_SESSION_LOST', 'DATABASE_UNAVAILABLE', 'PENDING_SAVE', 'CLOUD_STATE_CHANGED'].includes(error.code)
    || (!Number(error.status) && !error.code)) return 'retry';
  return 'blocked';
}

/** A single retry owner for boot, online events and native/web foregrounding. */
export function createReconnectController({
  attempt, onChange = () => {}, onExpired = () => {}, now = Date.now,
  timeoutMs = 35000, backoffMs = [1000, 2000, 4000, 8000, 15000, 30000],
  setTimeoutImpl = globalThis.setTimeout, clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  let state = { phase: 'idle', attempts: 0, startedAt: 0, nextRetryAt: 0, error: null };
  let enabled = true;
  let foreground = true;
  let generation = 0;
  let retryTimer = null;
  let flight = null;
  let controller = null;
  const snapshot = () => ({ ...state });
  function emit(patch) { state = { ...state, ...patch }; onChange(snapshot()); }
  function clearRetry() { if (retryTimer != null) clearTimeoutImpl(retryTimer); retryTimer = null; }
  function run({ manual = false } = {}) {
    if (!enabled || !foreground) return Promise.resolve(false);
    if (flight) return flight;
    if (!manual && ['blocked', 'expired'].includes(state.phase)) return Promise.resolve(false);
    clearRetry();
    const epoch = generation;
    const abort = new AbortController();
    controller = abort;
    const startedAt = ['idle', 'connected', 'expired', 'blocked'].includes(state.phase) ? now() : state.startedAt;
    emit({ phase: 'connecting', attempts: state.attempts + 1, startedAt, nextRetryAt: 0, error: null });
    const current = () => enabled && foreground && epoch === generation;
    const job = withDeadline(() => new Promise((resolve, reject) => {
      const cancelled = () => reject(Object.assign(new Error('Connection attempt cancelled.'), { code: 'CANCELLED' }));
      abort.signal.addEventListener('abort', cancelled, { once: true });
      if (abort.signal.aborted) { cancelled(); return; }
      Promise.resolve().then(() => attempt({ signal: abort.signal, isCurrent: () => current() && !abort.signal.aborted }))
        .then(resolve, reject).finally(() => abort.signal.removeEventListener('abort', cancelled));
    }), {
      timeoutMs, onTimeout: () => { if (current()) abort.abort(); }, setTimeoutImpl, clearTimeoutImpl,
    }).then((result) => {
      if (!current()) return false;
      if (result?.blocked) { emit({ phase: 'blocked', nextRetryAt: 0 }); return false; }
      emit({ phase: 'connected', attempts: 0, nextRetryAt: 0, error: null });
      return true;
    }).catch((error) => {
      if (!current()) return false;
      const kind = reconnectErrorKind(error);
      if (kind === 'expired') { emit({ phase: 'expired', error, nextRetryAt: 0 }); onExpired(error); }
      else if (kind === 'blocked') emit({ phase: 'blocked', error, nextRetryAt: 0 });
      else {
        const delay = Math.max(100, Number(backoffMs[Math.min(state.attempts - 1, backoffMs.length - 1)]) || 30000);
        emit({ phase: 'waiting', error, nextRetryAt: now() + delay });
        retryTimer = setTimeoutImpl(() => { retryTimer = null; void run(); }, delay);
      }
      return false;
    }).finally(() => {
      if (flight === job) { flight = null; controller = null; }
    });
    flight = job;
    return job;
  }
  return {
    start: run,
    retry: () => run({ manual: true }),
    getSnapshot: snapshot,
    setForeground(value) {
      if (foreground === Boolean(value)) return flight || Promise.resolve(false);
      foreground = Boolean(value);
      if (!foreground) {
        generation += 1; clearRetry(); controller?.abort(); flight = null; controller = null;
        if (!['blocked', 'expired'].includes(state.phase)) emit({ phase: 'suspended', nextRetryAt: 0 });
        return Promise.resolve(false);
      }
      return run();
    },
    connected() { clearRetry(); emit({ phase: 'connected', attempts: 0, nextRetryAt: 0, error: null }); },
    block() {
      // Ignore late attempt completion without aborting/disposal: the cloud
      // conflict view still needs its live lease for the user's explicit choice.
      generation += 1;
      clearRetry(); flight = null; controller = null;
      emit({ phase: 'blocked', nextRetryAt: 0 });
    },
    cancel() {
      enabled = false; generation += 1; clearRetry(); controller?.abort(); flight = null; controller = null;
      emit({ phase: 'idle', nextRetryAt: 0 });
    },
  };
}
