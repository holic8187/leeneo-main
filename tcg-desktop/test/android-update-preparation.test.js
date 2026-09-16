import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldFlushCloudBeforeUpdate,
  waitForOptionalUpdateRestore,
} from '../src/core/androidUpdatePreparation.js';

test('Android update preparation does not fail when login restoration is slow', async () => {
  const never = new Promise(() => {});
  const result = await waitForOptionalUpdateRestore(never, { timeoutMs: 5 });
  assert.equal(result, 'timeout');
});

test('Android update preparation observes successful and failed login restoration without throwing', async () => {
  assert.equal(await waitForOptionalUpdateRestore(Promise.resolve()), 'restored');
  assert.equal(await waitForOptionalUpdateRestore(Promise.reject(new Error('offline'))), 'failed');
  assert.equal(await waitForOptionalUpdateRestore(null), 'unavailable');
});

test('cloud save is mandatory only for an active cloud play session', () => {
  assert.equal(shouldFlushCloudBeforeUpdate({ cloudPhase: 'active', hasCloudSession: true }), true);
  assert.equal(shouldFlushCloudBeforeUpdate({ cloudPhase: 'connecting', hasCloudSession: true }), false);
  assert.equal(shouldFlushCloudBeforeUpdate({ cloudPhase: 'active', hasCloudSession: false }), false);
});
