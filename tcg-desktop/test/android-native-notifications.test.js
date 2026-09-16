import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const androidFile = (relativePath) => readFileSync(new URL(
  `../android/app/src/main/${relativePath}`,
  import.meta.url,
), 'utf8');

test('the Android package declares and registers the native notification permission plugin', () => {
  const manifest = androidFile('AndroidManifest.xml');
  const activity = androidFile('java/com/hoicompany/carddesk/MainActivity.java');
  const plugin = androidFile('java/com/hoicompany/carddesk/GameNotificationsPlugin.java');

  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(activity, /registerPlugin\(GameNotificationsPlugin\.class\)/);
  assert.match(plugin, /@Permission\(alias = "notifications", strings = \{ Manifest\.permission\.POST_NOTIFICATIONS \}\)/);
  assert.match(plugin, /requestPermissionForAlias\("notifications", call, "notificationPermissionCallback"\)/);
});

test('Android records a permission request only after its operating-system dialog returns', () => {
  const plugin = androidFile('java/com/hoicompany/carddesk/GameNotificationsPlugin.java');
  const requestMethod = plugin.slice(
    plugin.indexOf('public void requestPermission'),
    plugin.indexOf('@PermissionCallback'),
  );
  const callback = plugin.slice(
    plugin.indexOf('private void notificationPermissionCallback'),
    plugin.indexOf('@PluginMethod', plugin.indexOf('private void notificationPermissionCallback')),
  );

  assert.doesNotMatch(requestMethod, /markPermissionRequested/);
  assert.match(callback, /markPermissionRequested/);
  assert.match(callback, /rescheduleAll/);
});
