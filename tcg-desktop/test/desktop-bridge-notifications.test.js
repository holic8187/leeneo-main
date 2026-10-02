import test from 'node:test';
import assert from 'node:assert/strict';

import { desktopBridge, readGameNotificationPermissionWithFallback } from '../src/services/desktopBridge.js';

test('notification permission status falls back when the native bridge never settles', async () => {
  const result = await readGameNotificationPermissionWithFallback(
    () => new Promise(() => {}),
    { timeoutMs: 5 },
  );

  assert.deepEqual(result, { display: 'unavailable', granted: false });
});

test('notification permission status preserves a valid native response', async () => {
  const result = await readGameNotificationPermissionWithFallback(
    async () => ({ display: 'granted', granted: true, source: 'native' }),
    { timeoutMs: 50 },
  );

  assert.deepEqual(result, { display: 'granted', granted: true, source: 'native' });
});

test('bridge rejects retired notification scheduling and removes inert desktop preferences', async () => {
  assert.deepEqual(await desktopBridge.scheduleGameNotification({ type: 'incident' }), { scheduled: false, reason: 'unsupported-type' });
  assert.equal(desktopBridge.scheduleIncident, undefined);
  assert.equal(desktopBridge.setIncidentNotifications, undefined);
  assert.equal(desktopBridge.setExpeditionNotifications, undefined);
});
