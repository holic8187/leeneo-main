'use strict';

// Opt-in integration: node scripts/tcg-database-recovery-smoke.cjs <mongod-path>
// A fresh loopback-only MongoDB child process is owned by this script. It never
// loads .env, accepts a DB URI, or opens an existing database directory.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, realpath, stat } = require('node:fs/promises');
const { createServer } = require('node:net');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { Mongoose } = require('mongoose');
const { createDatabaseConnection, requireDatabaseReady } = require('../src/databaseConnection');
const { releaseHealth } = require('../src/tcg/services/releaseHealth');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, message, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(100);
  }
  throw new Error(message);
}

async function unusedLoopbackPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  const binary = await realpath(String(process.argv[2] || ''));
  assert.match(path.basename(binary), /^mongod(?:\.exe)?$/i, 'Supply the installed mongod binary, not a command or URI.');
  assert.equal((await stat(binary)).isFile(), true);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hoi-db-recovery-'));
  const dbName = `hoi_db_recovery_${path.basename(directory).replace(/[^a-z0-9]/gi, '_')}`;
  const port = await unusedLoopbackPort();
  const uri = `mongodb://127.0.0.1:${port}/${dbName}?directConnection=true`;
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/hoi_db_recovery_[a-z0-9_]+\?directConnection=true$/i);
  const mongoose = new Mongoose();
  let connectCalls = 0;
  let initializationCalls = 0;
  let child = null;
  let childError = null;
  let routeCalls = 0;
  const lifecycleLogs = [];
  const database = createDatabaseConnection({
    mongoose: {
      connection: mongoose.connection,
      connect(value, options) { connectCalls += 1; return mongoose.connect(value, options); }
    },
    uri,
    onFirstConnected: () => { initializationCalls += 1; },
    logger: Object.fromEntries(['warn', 'error', 'info'].map(level => [level, message => lifecycleLogs.push(message)]))
  });
  const app = express();
  app.get('/api/health', (_req, res) => {
    const health = releaseHealth('v2', database.isReady());
    res.status(health.ok ? 200 : 503).json(health);
  });
  app.use('/api/tcg', requireDatabaseReady(database));
  app.get('/api/tcg/probe', (_req, res) => { routeCalls += 1; res.json({ ok: true }); });
  const http = app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  const request = route => fetch(`${base}${route}`, { signal: AbortSignal.timeout(3000) });

  const startMongo = () => {
    assert.equal(child, null, 'Only one owned test mongod may run.');
    childError = null;
    child = spawn(binary, ['--bind_ip', '127.0.0.1', '--port', String(port), '--dbpath', directory,
      '--logpath', path.join(directory, 'mongod.log'), '--logappend'], { windowsHide: true, stdio: 'ignore' });
    child.on('error', error => { childError = error; });
  };
  const stopMongo = async () => {
    const owned = child;
    if (!owned) return;
    assert.equal(owned.spawnfile, binary);
    assert.equal(owned.spawnargs.includes(directory), true);
    if (owned.exitCode === null && owned.signalCode === null) {
      const exited = once(owned, 'exit');
      owned.kill('SIGTERM');
      await Promise.race([exited, wait(8000).then(() => { throw new Error('Owned mongod did not stop.'); })]);
    }
    child = null;
  };
  const assertUnavailable = async () => {
    const before = routeCalls;
    const health = await request('/api/health');
    assert.equal(health.status, 503);
    const payload = await health.json();
    assert.equal(payload.ok, false); assert.equal(payload.database, 'unavailable');
    assert.match(payload.tcgVersion, /^\d+\.\d+\.\d+$/);
    const probe = await request('/api/tcg/probe');
    assert.equal(probe.status, 503); assert.equal(probe.headers.get('retry-after'), '5');
    assert.equal((await probe.json()).code, 'DB_UNAVAILABLE');
    assert.equal(routeCalls, before, 'Unavailable requests never reach DB/auth route handlers.');
  };
  const assertReady = async () => {
    await waitFor(() => {
      if (childError) throw childError;
      if (child?.exitCode !== null) throw new Error('Owned mongod exited; inspect its retained local log.');
      return database.isReady();
    }, 'MongoDB did not recover.');
    assert.equal((await mongoose.connection.db.admin().command({ ping: 1 })).ok, 1);
    const health = await request('/api/health');
    assert.equal(health.status, 200); assert.equal((await health.json()).database, 'ready');
    assert.equal((await request('/api/tcg/probe')).status, 200);
    assert.equal(initializationCalls, 1);
  };
  try {
    assert.equal(await database.start(), false, 'First connection to the stopped DB fails.');
    await assertUnavailable();
    assert.equal(initializationCalls, 0);
    console.log('Initial DB offline: health and TCG requests returned503.');
    startMongo();
    await assertReady();
    const callsAfterInitialRecovery = connectCalls;
    assert.ok(callsAfterInitialRecovery >= 2, 'Initial connect retried without restarting the app.');
    const syntheticState = { _id: 'synthetic-save', wallet: { coins: 777 }, cards: { 'winter-ur': 2 }, revision: 12 };
    // Windows child.kill() is an abrupt process termination. Wait for this
    // fixture's journal commit so the test measures reconnect/data retention,
    // not the expected loss of a default w:1 write before its journal flush.
    await mongoose.connection.db.collection('recovery_fixture').insertOne(syntheticState, { writeConcern: { w: 1, j: true } });
    console.log('DB started: automatic initial recovery and read-only ping succeeded.');
    await stopMongo();
    await waitFor(() => !database.isReady(), 'Driver did not observe the database shutdown.');
    await assertUnavailable();
    assert.equal(initializationCalls, 1);
    console.log('Established DB stopped: health and TCG requests returned503.');
    startMongo();
    await assertReady();
    assert.equal(connectCalls, callsAfterInitialRecovery, 'Established connection recovers through driver monitoring, not a second pool.');
    assert.deepEqual(await mongoose.connection.db.collection('recovery_fixture').findOne({ _id: syntheticState._id }), syntheticState);
    assert.equal(initializationCalls, 1, 'Startup migration/interval registration runs exactly once.');
    console.log(JSON.stringify({ result: 'passed', node: process.version, mongoose: mongoose.version,
      mongodbDriver: require('mongodb/package.json').version, connectCalls, initializationCalls,
      checks: ['initial-failure-retry', 'HTTP503-offline', 'HTTP200-recovery', 'driver-disconnect-reconnect', 'single-startup-callback', 'synthetic-data-retained'],
      localTestDirectory: directory, lifecycleLogs }));
  } finally {
    database.stop();
    await mongoose.disconnect().catch(() => {});
    await stopMongo();
    http.closeAllConnections();
    await new Promise(resolve => http.close(resolve));
    // Retain this newly created temp directory/log for diagnosis; never delete
    // or drop a caller-supplied database, volume, or filesystem path.
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
