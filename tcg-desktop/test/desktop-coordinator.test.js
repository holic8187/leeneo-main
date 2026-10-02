import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { createUpdateCoordinator } = require('../electron/desktop-coordinator.cjs');
const {
  findLatestDesktopRelease,
  resolveDesktopReleaseFeed,
} = require('../electron/desktop-release-feed.cjs');
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

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

test('desktop update discovery ignores a newer Android-only release', async () => {
  const releases = [
    { tag_name: 'tcg-android-v0.7.0', draft: false, prerelease: false, assets: [{ name: 'Hoi-Card-Desk-0.7.0-android-release.apk' }] },
    { tag_name: 'tcg-v0.6.1', draft: false, prerelease: false, assets: [{ name: 'latest.yml' }] },
    { tag_name: 'tcg-v0.6.0', draft: false, prerelease: false, assets: [{ name: 'latest.yml' }] },
  ];
  assert.deepEqual(findLatestDesktopRelease(releases), { tag: 'tcg-v0.6.1', version: '0.6.1' });
  const feed = await resolveDesktopReleaseFeed({
    fetchImpl: async () => ({ ok: true, json: async () => releases }),
  });
  assert.equal(feed.feedUrl, 'https://github.com/holic8187/leeneo-main/releases/download/tcg-v0.6.1');
});

test('desktop update check prepares its platform-specific feed before checking', async () => {
  const order = [];
  const harness = updaterHarness({
    prepareCheck: async () => { order.push('prepare'); },
  });
  harness.updater.checkForUpdates = async () => { order.push('check'); };
  await harness.controller.check();
  assert.deepEqual(order, ['prepare', 'check']);
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
  bridge.onBeforeUpdate(() => { throw new Error('disk full'); });
  ipc.emit('update:before-install', {}, { requestId: 'save-2' });
  await tick();
  assert.equal(sent[0][1].ok, false);
  assert.equal(sent[0][1].message, 'disk full');
});

test('desktop shell no longer exposes incident or toast IPC', () => {
  const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /incident:|toast:|scheduleIncident|toastWindow/);
  assert.doesNotMatch(preload, /Incident|incident:|toast:/);
});
