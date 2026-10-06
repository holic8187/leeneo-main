'use strict';

const MONGO_CONNECT_OPTIONS = Object.freeze({
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000
});

function errorType(error) {
  const name = String(error?.name || 'Error');
  // Connection errors can include a credential-bearing URI in their message.
  return /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(name) ? name : 'Error';
}

/**
 * Mongoose retries a lost established connection itself, but not a failed
 * initial connect(). Keep initial attempts single-flight and bounded, with a
 * capped backoff, without destroying the driver's recovering connection pool.
 */
function createDatabaseConnection({
  mongoose,
  uri,
  onFirstConnected = () => {},
  logger = console,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  retryBaseMs = 1000,
  retryMaxMs = 30000
}) {
  const connection = mongoose.connection;
  let started = false;
  let stopped = false;
  let connecting = null;
  let retryTimer = null;
  let consecutiveFailures = 0;
  let driverOwnsReconnect = false;
  let initializationStarted = false;
  let connectedObserved = false;

  const isReady = () => started && !stopped && connection.readyState === 1;
  const clearRetry = () => {
    if (retryTimer !== null) clearTimeoutFn(retryTimer);
    retryTimer = null;
  };

  function onConnected() {
    if (stopped) return;
    if (!connectedObserved) logger.info?.('MongoDB connection ready.');
    connectedObserved = true;
    driverOwnsReconnect = true;
    consecutiveFailures = 0;
    clearRetry();
    if (!initializationStarted) {
      initializationStarted = true;
      // Set the flag before invoking jobs: reconnect must never register a
      // second interval or rerun a partially completed startup migration.
      Promise.resolve().then(onFirstConnected).catch(error => {
        logger.error?.(`MongoDB startup initialization failed (${errorType(error)}).`);
      });
    }
  }

  function scheduleRetry(error) {
    if (!started || stopped || connecting || retryTimer !== null || isReady() || driverOwnsReconnect) return;
    const delay = Math.min(retryMaxMs, retryBaseMs * (2 ** Math.min(consecutiveFailures, 16)));
    consecutiveFailures += 1;
    logger.warn?.(`MongoDB connection unavailable; retrying in ${delay}ms (${errorType(error)}).`);
    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      void attemptConnect();
    }, delay);
    retryTimer?.unref?.();
  }

  function attemptConnect() {
    if (connecting) return connecting;
    if (!started || stopped || isReady() || driverOwnsReconnect) return Promise.resolve(isReady());
    clearRetry();
    let failure;
    connecting = Promise.resolve()
      .then(() => mongoose.connect(uri, { ...MONGO_CONNECT_OPTIONS }))
      .then(() => {
        if (connection.readyState === 1) onConnected();
        return isReady();
      })
      .catch(error => {
        failure = error;
        return false;
      })
      .finally(() => {
        connecting = null;
        if (!isReady()) scheduleRetry(failure);
      });
    return connecting;
  }

  function onDisconnected() {
    if (stopped) return;
    connectedObserved = false;
    logger.warn?.('MongoDB disconnected; database requests are temporarily unavailable.');
    // For an established client, Mongoose/driver monitoring remains in charge.
    // Initial failures are retried by attemptConnect().finally instead.
    if (!driverOwnsReconnect) scheduleRetry();
  }

  function onClosed() {
    driverOwnsReconnect = false;
    scheduleRetry();
  }

  function onError(error) {
    logger.warn?.(`MongoDB connection error (${errorType(error)}).`);
  }

  return {
    isReady,
    start() {
      if (stopped) return Promise.resolve(false);
      if (started) return connecting || Promise.resolve(isReady());
      started = true;
      connection.on('connected', onConnected);
      connection.on('disconnected', onDisconnected);
      connection.on('close', onClosed);
      connection.on('error', onError);
      if (isReady()) onConnected();
      return attemptConnect();
    },
    stop() {
      stopped = true;
      clearRetry();
      connection.removeListener('connected', onConnected);
      connection.removeListener('disconnected', onDisconnected);
      connection.removeListener('close', onClosed);
      connection.removeListener('error', onError);
    }
  };
}

function requireDatabaseReady(database) {
  return (_req, res, next) => {
    if (database.isReady()) return next();
    res.set('Retry-After', '5');
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({
      code: 'DB_UNAVAILABLE',
      msg: '데이터베이스 연결을 복구하고 있습니다. 잠시 후 다시 시도해 주세요.'
    });
  };
}

module.exports = { createDatabaseConnection, requireDatabaseReady, MONGO_CONNECT_OPTIONS };
