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

test('Android retries the corrected notification permission flow once after upgrading from a legacy build', () => {
  const scheduler = androidFile('java/com/hoicompany/carddesk/GameNotificationScheduler.java');
  assert.match(scheduler, /PERMISSION_FLOW_VERSION_KEY/);
  assert.match(scheduler, /getInt\(PERMISSION_FLOW_VERSION_KEY, 0\) >= PERMISSION_FLOW_VERSION/);
  assert.match(scheduler, /putInt\(PERMISSION_FLOW_VERSION_KEY, PERMISSION_FLOW_VERSION\)/);
});

test('Android updater streams the APK into app-private cache and reports byte progress', () => {
  const updater = androidFile('java/com/hoicompany/carddesk/AndroidUpdaterPlugin.java');
  assert.doesNotMatch(updater, /import android\.app\.DownloadManager/);
  assert.match(updater, /new BufferedInputStream\(connection\.getInputStream\(\)\)/);
  assert.match(updater, /downloadedBytes \* 100L\) \/ totalBytes/);
  assert.match(updater, /Math\.max\(1L, Math\.min\(99L/);
  assert.match(updater, /payload\.put\("downloadedBytes"/);
  assert.match(updater, /new File\(getContext\(\)\.getCacheDir\(\), "updates"\)/);
  assert.match(updater, /"release-assets\.githubusercontent\.com"\.equals\(host\)/);
});

test('Android updater bounds retries and timeouts, then falls back across OEM installers', () => {
  const updater = androidFile('java/com/hoicompany/carddesk/AndroidUpdaterPlugin.java');
  assert.match(updater, /MAX_DOWNLOAD_ATTEMPTS = 2/);
  assert.match(updater, /long deadlineAt = SystemClock\.elapsedRealtime\(\) \+ MAX_DOWNLOAD_DURATION_MS/);
  assert.match(updater, /setConnectTimeout\(boundedTimeout/);
  assert.match(updater, /setReadTimeout\(boundedTimeout/);
  assert.match(updater, /new Intent\(Intent\.ACTION_INSTALL_PACKAGE\)/);
  assert.match(updater, /new Intent\(Intent\.ACTION_VIEW\)/);
  assert.match(updater, /setClipData\(ClipData\.newRawUri/);
  assert.match(updater, /editor\.commit\(\)/);
});
