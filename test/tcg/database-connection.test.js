'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { createDatabaseConnection, requireDatabaseReady, MONGO_CONNECT_OPTIONS } = require('../../src/databaseConnection');
const { releaseHealth } = require('../../src/tcg/services/releaseHealth');

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(failures = 0, options = {}) {
  const connection = Object.assign(new EventEmitter(), { readyState: 0 });
  const timers = new Map();
  const logs = [];
  let calls = 0;
  let jobs = 0;
  let timerId = 0;
  const mongoose = { connection, async connect(uri, opts) {
    calls += 1;
    assert.equal(uri, 'synthetic-uri');
    assert.deepEqual(opts, MONGO_CONNECT_OPTIONS);
    if (calls <= failures) throw new Error('secret-must-not-appear-in-logs');
    connection.readyState = 1;
    connection.emit('connected');
  } };
  const database = createDatabaseConnection({
    mongoose, uri: 'synthetic-uri', onFirstConnected: () => { jobs += 1; },
    logger: { warn: text => logs.push(text), error: text => logs.push(text), info: text => logs.push(text) },
    setTimeoutFn: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeoutFn: id => timers.delete(id), ...options
  });
  return { database, connection, timers, logs, get calls() { return calls; }, get jobs() { return jobs; },
    async retry() {
      assert.equal(timers.size, 1);
      const [id, timer] = [...timers][0]; timers.delete(id); timer.fn(); await flush();
    }
  };
}

test('initial Mongo failures retry single-flight with bounded attempts/backoff then become ready', async () => {
  const h = harness(2);
  try {
    const first = h.database.start();
    assert.equal(h.database.start(), first);
    assert.equal(await first, false);
    assert.equal(h.calls, 1); assert.equal(h.jobs, 0); assert.equal(h.database.isReady(), false);
    assert.equal([...h.timers.values()][0].ms, 1000);
    await h.database.start(); assert.equal(h.calls, 1, 'start cannot bypass retry backoff');
    await h.retry(); assert.equal(h.calls, 2); assert.equal([...h.timers.values()][0].ms, 2000);
    await h.retry(); assert.equal(h.calls, 3); assert.equal(h.database.isReady(), true);
    assert.equal(h.jobs, 1); assert.equal(h.timers.size, 0);
    assert.equal(h.logs.join(' ').includes('secret-must-not-appear'), false);
  } finally { h.database.stop(); }
});

test('established disconnect becomes unready and driver recovery does not duplicate startup jobs or reconnect pools', async () => {
  const h = harness();
  try {
    await h.database.start(); await flush();
    for (let index = 0; index < 3; index += 1) {
      h.connection.readyState = 0; h.connection.emit('disconnected');
      assert.equal(h.database.isReady(), false); assert.equal(h.timers.size, 0);
      h.connection.emit('error', new Error('simulated network failure'));
      h.connection.readyState = 1; h.connection.emit('connected'); await flush();
      assert.equal(h.database.isReady(), true);
    }
    assert.equal(h.calls, 1); assert.equal(h.jobs, 1);
    h.connection.readyState = 0; h.connection.emit('close'); await h.retry();
    assert.equal(h.calls, 2); assert.equal(h.jobs, 1, 'closed client can reopen without rerunning startup jobs');
  } finally { h.database.stop(); }
});

test('prolonged outage backoff caps at thirty seconds and stopping cancels pending retries', async () => {
  const h = harness(20);
  await h.database.start();
  for (let index = 0; index < 8; index += 1) await h.retry();
  assert.equal([...h.timers.values()][0].ms, 30000);
  h.database.stop();
  assert.equal(h.timers.size, 0); assert.equal(h.connection.listenerCount('connected'), 0);
  assert.equal(await h.database.start(), false); assert.equal(h.calls, 9);
});

test('TCG readiness guard rejects before DB/auth work with retryable503, then resumes after connection', async () => {
  const h = harness();
  const guard = requireDatabaseReady(h.database);
  const response = () => ({ headers: {}, status(code) { this.code = code; return this; }, set(k, v) { this.headers[k] = v; return this; }, json(payload) { this.payload = payload; return this; } });
  let routeCalls = 0;
  try {
    let res = response(); guard({}, res, () => routeCalls++);
    assert.equal(res.code, 503); assert.equal(res.payload.code, 'DB_UNAVAILABLE');
    assert.equal(res.headers['Retry-After'], '5'); assert.equal(routeCalls, 0);
    assert.equal(releaseHealth('v2', h.database.isReady()).ok, false);
    await h.database.start();
    res = response(); guard({}, res, () => routeCalls++);
    assert.equal(routeCalls, 1); assert.equal(res.code, undefined);
    assert.equal(releaseHealth('v2', h.database.isReady()).ok, true);
    h.connection.readyState = 0; h.connection.emit('disconnected');
    res = response(); guard({}, res, () => routeCalls++);
    assert.equal(res.code, 503); assert.equal(routeCalls, 1);
  } finally { h.database.stop(); }
});

test('production wiring gates TCG and responds503 from public health without removing version metadata', () => {
  const source = readFileSync(require.resolve('../../server.js'), 'utf8');
  assert.match(source, /releaseHealth\(APP_MODE, databaseConnection\.isReady\(\)\)/);
  assert.match(source, /res\.status\(health\.ok \? 200 : 503\)\.json\(health\)/);
  assert.match(source, /app\.use\('\/api\/tcg', requireDatabaseReady\(databaseConnection\)\)/);
  assert.equal((source.match(/void databaseConnection\.start\(\)/g) || []).length, 1);
});
