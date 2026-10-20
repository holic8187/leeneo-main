import assert from 'node:assert/strict';
import test from 'node:test';
import { checkIosRelease, IOS_BUNDLE_ID, trustedIosDistributionUrl } from '../src/services/iosUpdateGateway.js';

const reply = (results) => async () => ({ ok: true, json: async () => ({ results }) });
test('iOS without a published Apple listing remains playable and does not offer an APK', async () => {
  const result = await checkIosRelease({ currentVersion: '0.14.0', fetchImpl: () => { throw new Error('must not fetch'); } });
  assert.equal(result.status, 'store-managed');
  assert.equal(result.downloadUrl, undefined);
});
test('iOS distribution links reject arbitrary downloads and accept Apple invitation links', () => {
  assert.equal(trustedIosDistributionUrl('https://testflight.apple.com/join/Ab12Cd34'), 'https://testflight.apple.com/join/Ab12Cd34');
  for (const url of ['https://evil.example/app/id123', 'https://testflight.apple.com.evil.example/join/abc', 'https://testflight.apple.com/join/abc?redirect=evil', 'https://github.com/example/app.apk', 'javascript:alert(1)']) {
    assert.equal(trustedIosDistributionUrl(url), '');
  }
});
test('App Store update lookup requires the exact app and higher semantic version', async () => {
  const config = { currentVersion: '0.14.0', appStoreId: '12345' };
  const release = { bundleId: IOS_BUNDLE_ID, trackId: 12345, version: '0.15.0' };
  const available = await checkIosRelease({ ...config, fetchImpl: reply([release]) });
  assert.equal(available.status, 'available');
  assert.equal(available.updateMode, 'store');
  assert.equal(available.downloadUrl, 'https://apps.apple.com/app/id12345');
  assert.equal((await checkIosRelease({ ...config, fetchImpl: reply([{ ...release, bundleId: 'wrong.app' }]) })).status, 'store-managed');
  assert.equal((await checkIosRelease({ ...config, fetchImpl: reply([{ ...release, version: '0.13.0' }]) })).status, 'current');
});
test('unpublished App Store app, offline lookup, and stalled lookup do not create a permanent update lock', async () => {
  for (const fetchImpl of [reply([]), async () => { throw new Error('offline'); }, () => new Promise(() => {})]) {
    const result = await checkIosRelease({ currentVersion: '0.14.0', appStoreId: '12345', fetchImpl, timeoutMs: 5 });
    assert.equal(result.status, 'store-managed');
  }
});
test('TestFlight builds provide only the configured Apple invitation', async () => {
  const result = await checkIosRelease({ currentVersion: '0.14.0', testFlightUrl: 'https://testflight.apple.com/join/Ab12Cd34' });
  assert.equal(result.status, 'store-managed');
  assert.equal(result.distribution, 'TestFlight');
  assert.equal(result.downloadUrl, 'https://testflight.apple.com/join/Ab12Cd34');
});
