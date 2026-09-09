import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { normalizeIncident, createIncidentCoordinator, createUpdateCoordinator, toastBounds } = require('../electron/desktop-coordinator.cjs');
const sourceIncident = { id: 'lucky-box', title: '상자 발견', summary: '확인해 볼까요?', choices: [{ id: 'open', label: '열기', reward: { packs: 999 } }, { id: 'pass', label: '지나가기' }] };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('toast payload gives each event a unique instance and never accepts reward data from its UI', () => {
  const first = normalizeIncident(sourceIncident);
  const second = normalizeIncident(sourceIncident);
  assert.notEqual(first.instanceId, second.instanceId);
  assert.deepEqual(first.choices[0], { id: 'open', label: '열기' });
  assert.equal(normalizeIncident({ ...sourceIncident, choices: [{ id: 'x', label: 'X' }, { id: 'x', label: 'Y' }] }), null);
  assert.equal(normalizeIncident(null), null);
});

test('a stale or invalid popup cannot grant a reward', async () => {
  let count = 0;
  const manager = createIncidentCoordinator({ resolveChoice: async () => { count += 1; return { ok: true }; } });
  manager.activate(normalizeIncident(sourceIncident, 'current'));
  assert.equal((await manager.choose({ incidentId: 'lucky-box', instanceId: 'old', choiceId: 'open' })).code, 'stale');
  assert.equal((await manager.choose({ incidentId: 'other', instanceId: 'current', choiceId: 'open' })).code, 'stale');
  assert.equal((await manager.choose({ incidentId: 'lucky-box', instanceId: 'current', choiceId: 'forged' })).code, 'invalid');
  assert.equal(count, 0);
});

test('double click and delayed duplicate messages resolve an incident once', async () => {
  const saving = deferred();
  let count = 0;
  const manager = createIncidentCoordinator({ resolveChoice: async () => { count += 1; return saving.promise; } });
  manager.activate(normalizeIncident(sourceIncident, 'current'));
  const payload = { incidentId: 'lucky-box', instanceId: 'current', choiceId: 'open' };
  const first = manager.choose(payload);
  assert.equal((await manager.choose(payload)).code, 'busy');
  assert.ok(manager.active, 'active event remains until persistence acknowledges success');
  saving.resolve({ ok: true, message: '팩 1개 획득' });
  assert.deepEqual(await first, { ok: true, message: '팩 1개 획득' });
  assert.equal(manager.active, null);
  assert.equal((await manager.choose(payload)).code, 'stale');
  assert.equal(count, 1);
});

test('failed save keeps the active incident available for a retry', async () => {
  let success = false;
  const manager = createIncidentCoordinator({ resolveChoice: async () => ({ ok: success, message: '저장 상태' }) });
  manager.activate(normalizeIncident(sourceIncident, 'current'));
  const payload = { incidentId: 'lucky-box', instanceId: 'current', choiceId: 'open' };
  assert.equal((await manager.choose(payload)).ok, false);
  assert.ok(manager.active);
  success = true;
  assert.equal((await manager.choose(payload)).ok, true);
  assert.equal(manager.active, null);
});

test('a delayed reply for a resolved popup cannot clear a newly active event', async () => {
  const reply = deferred();
  const manager = createIncidentCoordinator({ resolveChoice: () => reply.promise });
  manager.activate(normalizeIncident(sourceIncident, 'old'));
  const choosing = manager.choose({ incidentId: 'lucky-box', instanceId: 'old', choiceId: 'open' });
  assert.equal(manager.clear('old'), true);
  manager.activate(normalizeIncident(sourceIncident, 'new'));
  reply.resolve({ ok: true });
  await choosing;
  assert.equal(manager.active.instanceId, 'new');
  assert.equal(manager.clear('old'), false);
});

test('popup bounds remain inside offset and small display work areas', () => {
  for (const area of [{ x: -1280, y: -80, width: 1280, height: 680 }, { x: 200, y: 90, width: 320, height: 260 }]) {
    const bounds = toastBounds(area, 4);
    assert.ok(bounds.x >= area.x && bounds.y >= area.y);
    assert.ok(bounds.x + bounds.width <= area.x + area.width);
    assert.ok(bounds.y + bounds.height <= area.y + area.height);
  }
});

function updaterHarness(overrides = {}) {
  const updater = new EventEmitter();
  const events = [];
  let checks = 0;
  let installs = 0;
  updater.checkForUpdates = async () => { checks += 1; };
  const controller = createUpdateCoordinator({
    updater, isPackaged: () => true,
    prepareInstall: async () => {}, install: () => { installs += 1; },
    emit: (status, detail) => events.push({ status, detail }), ...overrides,
  });
  return { updater, controller, events, get checks() { return checks; }, get installs() { return installs; } };
}

test('packaged launches check every time while simultaneous checks share the request', async () => {
  const harness = updaterHarness();
  const check = deferred();
  let count = 0;
  harness.updater.checkForUpdates = () => { count += 1; return check.promise; };
  const first = harness.controller.check();
  const second = harness.controller.check();
  assert.equal(count, 1);
  check.resolve();
  await Promise.all([first, second]);
  await harness.controller.check();
  assert.equal(count, 2);
  assert.equal(harness.updater.autoDownload, true);
  assert.equal(harness.updater.autoInstallOnAppQuit, false);
});

test('development preview never downloads an installer', async () => {
  const harness = updaterHarness({ isPackaged: () => false });
  assert.equal((await harness.controller.check()).status, 'development');
  assert.equal(harness.checks, 0);
});

test('downloaded update waits for the save acknowledgement before installing exactly once', async () => {
  const saving = deferred();
  const harness = updaterHarness({ prepareInstall: () => saving.promise });
  harness.updater.emit('update-downloaded', { version: '0.2.0' });
  harness.updater.emit('update-downloaded', { version: '0.2.0' });
  assert.equal(harness.installs, 0);
  assert.equal(harness.events.at(-1).status, 'saving');
  saving.resolve();
  await tick();
  assert.equal(harness.installs, 1);
  harness.updater.emit('update-downloaded', { version: '0.2.0' });
  await harness.controller.check();
  assert.equal(harness.installs, 1);
});

test('save failure prevents installation and an explicit check retries the cached download', async () => {
  let canSave = false;
  const harness = updaterHarness({ prepareInstall: async () => { if (!canSave) throw new Error('disk full'); } });
  harness.updater.emit('update-downloaded', { version: '0.2.0' });
  await tick();
  assert.equal(harness.installs, 0);
  assert.equal(harness.events.at(-1).status, 'error');
  canSave = true;
  assert.equal((await harness.controller.check()).status, 'installing');
  assert.equal(harness.installs, 1);
  assert.equal(harness.checks, 0);
});

test('offline checks report an error and can be retried without interrupting the game', async () => {
  const harness = updaterHarness();
  harness.updater.checkForUpdates = async () => { throw new Error('offline'); };
  assert.equal((await harness.controller.check()).status, 'error');
  harness.updater.checkForUpdates = async () => {};
  assert.equal((await harness.controller.check()).status, 'checked');
  assert.equal(harness.installs, 0);
});

test('preload responds to save requests only after the renderer has finished persistence', async () => {
  const ipc = new EventEmitter();
  const sent = [];
  ipc.send = (...args) => sent.push(args);
  let bridge;
  runInNewContext(readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8'), {
    require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } } }),
  });
  const saving = deferred();
  bridge.onBeforeUpdate(() => saving.promise);
  ipc.emit('update:before-install', {}, { requestId: 'save-1' });
  assert.equal(sent.length, 0);
  saving.resolve(true);
  await tick();
  assert.equal(sent[0][0], 'renderer:reply');
  assert.equal(sent[0][1].requestId, 'save-1');
  assert.equal(sent[0][1].ok, true);
});

test('preload converts renderer persistence exceptions to failure acknowledgements', async () => {
  const ipc = new EventEmitter();
  const sent = [];
  ipc.send = (...args) => sent.push(args);
  let bridge;
  runInNewContext(readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8'), {
    require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } } }),
  });
  bridge.onIncidentChoice(() => { throw new Error('disk full'); });
  ipc.emit('incident:choice', {}, { requestId: 'choice-1', incidentId: 'lucky-box', instanceId: '1', choiceId: 'open' });
  await tick();
  assert.equal(sent[0][1].ok, false);
  assert.equal(sent[0][1].message, 'disk full');
});
