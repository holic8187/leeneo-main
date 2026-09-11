import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEVICE_ID_STORAGE_KEY,
  detectClientPlatform,
  getOrCreateDeviceId,
  platformLabel,
  shouldBootstrapCloudState,
} from '../src/core/deviceIdentity.js';
import {
  checkAndroidRelease,
  compareVersions,
  findLatestAndroidRelease,
  isTrustedAndroidReleaseAssetUrl,
} from '../src/services/androidUpdateGateway.js';

const releaseUrl = (version, channel = 'release') => (
  `https://github.com/holic8187/leeneo-main/releases/download/tcg-android-v${version}/Hoi-Card-Desk-${version}-android-${channel}.apk`
);

test('device identity is generated once and platform labels match the takeover message', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = getOrCreateDeviceId(storage, { randomUUID: () => '12345678-1234-1234-1234-123456789012' });
  const second = getOrCreateDeviceId(storage, { randomUUID: () => 'different-device-id-12345' });
  assert.equal(first, '12345678-1234-1234-1234-123456789012');
  assert.equal(second, first);
  assert.equal(values.get(DEVICE_ID_STORAGE_KEY), first);
  assert.equal(detectClientPlatform({ hoiDesktop: { isDesktop: true } }), 'pc');
  assert.equal(detectClientPlatform({ Capacitor: { getPlatform: () => 'android' } }), 'android');
  assert.equal(detectClientPlatform({}), 'web');
  assert.equal(platformLabel('ios'), '모바일');
  assert.equal(platformLabel('pc'), 'PC');
  assert.equal(shouldBootstrapCloudState({ platform: 'pc', hasPersistedState: true }), true);
  assert.equal(shouldBootstrapCloudState({ platform: 'pc', hasPersistedState: false }), false);
  assert.equal(shouldBootstrapCloudState({ platform: 'android', hasPersistedState: true }), false);
  assert.equal(shouldBootstrapCloudState({ platform: 'android', newAccount: true }), true);
});

test('Android update discovery selects the newest public APK release', async () => {
  const releases = [
    { tag_name: 'tcg-v9.0.0', assets: [{ name: 'desktop.exe', browser_download_url: 'https://example.com/desktop' }] },
    { tag_name: 'tcg-android-v0.5.0', assets: [{ name: 'Hoi-Card-Desk-0.5.0-android-debug.apk', browser_download_url: releaseUrl('0.5.0', 'debug') }] },
    {
      tag_name: 'tcg-android-v0.6.0',
      assets: [
        { name: 'app-release-unsigned.apk', browser_download_url: 'https://example.com/unsigned.apk' },
        { name: 'Hoi-Card-Desk-0.6.0-android-debug.apk', browser_download_url: releaseUrl('0.6.0', 'debug') },
        { name: 'Hoi-Card-Desk-0.6.0-android-release.apk', browser_download_url: releaseUrl('0.6.0') },
      ],
    },
    { tag_name: 'tcg-android-v0.7.0', draft: true, assets: [{ name: 'draft-android-release.apk', browser_download_url: 'https://example.com/draft.apk' }] },
    { tag_name: 'tcg-android-v0.8.0', prerelease: true, assets: [{ name: 'prerelease-android-release.apk', browser_download_url: 'https://example.com/prerelease.apk' }] },
  ];
  assert.equal(compareVersions('0.6.0', '0.5.9'), 1);
  assert.equal(findLatestAndroidRelease(releases).version, '0.6.0');
  const update = await checkAndroidRelease({
    currentVersion: '0.5.0',
    fetchImpl: async () => ({ ok: true, async json() { return releases; } }),
  });
  assert.equal(update.status, 'available');
  assert.equal(update.downloadUrl, releaseUrl('0.6.0'));
  assert.equal(update.assetName, 'Hoi-Card-Desk-0.6.0-android-release.apk');
});

test('Android updater accepts only the exact repository, tag, version, and APK asset path', () => {
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3')), true);
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3', 'debug')), false);
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3') + '?token=unexpected'), false);
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3').replace('holic8187', 'attacker')), false);
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3').replace('tcg-android-v1.2.3', 'tcg-android-v1.2.4')), false);
  assert.equal(isTrustedAndroidReleaseAssetUrl(releaseUrl('1.2.3').replace('github.com', 'example.com')), false);
});

test('Android update discovery never offers an unsigned release APK', () => {
  const unsignedOnly = [{
    tag_name: 'tcg-android-v1.0.0',
    assets: [{ name: 'app-release-unsigned.apk', browser_download_url: 'https://example.com/unsigned.apk' }],
  }];
  assert.equal(findLatestAndroidRelease(unsignedOnly), null);
});

test('Android update discovery ignores debug-only releases whose signing key cannot be stable', () => {
  const debugOnly = [{
    tag_name: 'tcg-android-v1.0.0',
    assets: [{
      name: 'Hoi-Card-Desk-1.0.0-android-debug.apk',
      browser_download_url: releaseUrl('1.0.0', 'debug'),
    }],
  }];
  assert.equal(findLatestAndroidRelease(debugOnly), null);
});
