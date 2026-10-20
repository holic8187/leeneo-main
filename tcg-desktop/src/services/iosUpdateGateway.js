import { compareVersions } from './androidUpdateGateway.js';
import { withDeadline } from '../core/promiseDeadline.js';

export const IOS_BUNDLE_ID = 'com.hoicompany.carddesk';

export function trustedIosDistributionUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return '';
    if (url.hostname === 'testflight.apple.com' && /^\/join\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) return url.href;
    if (url.hostname === 'apps.apple.com' && /^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+\/?$/.test(url.pathname)) return url.href;
    return '';
  } catch { return ''; }
}

// iOS installs executable updates through Apple's distribution apps. Never
// interpret a newer Android/Windows GitHub release as an iPhone update.
export async function checkIosRelease({
  currentVersion,
  appStoreId = '',
  testFlightUrl = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  const invitation = trustedIosDistributionUrl(testFlightUrl);
  const managed = {
    status: 'store-managed',
    updateMode: 'store',
    distribution: invitation ? 'TestFlight' : 'App Store / TestFlight',
    message: 'iPhone 업데이트는 TestFlight 또는 App Store에서 설치합니다.',
    ...(invitation ? { downloadUrl: invitation } : {}),
  };
  const id = String(appStoreId || '').trim();
  if (invitation || !/^\d+$/.test(id)) return managed;
  try {
    return await withDeadline(async () => {
      const response = await fetchImpl(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=kr`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`App Store ${response.status}`);
      const data = await response.json();
      const release = data.results?.find((item) => item.bundleId === IOS_BUNDLE_ID && String(item.trackId) === id);
      if (!release || !/^\d+\.\d+\.\d+$/.test(String(release.version || ''))) return managed;
      const downloadUrl = `https://apps.apple.com/app/id${id}`;
      if (compareVersions(release.version, currentVersion) <= 0) {
        return { status: 'current', latestVersion: release.version, updateMode: 'store', downloadUrl };
      }
      return {
        status: 'available', updateMode: 'store', distribution: 'App Store',
        latestVersion: release.version, downloadUrl,
        message: 'App Store에서 업데이트한 뒤 앱을 다시 열어 주세요.',
      };
    }, {
      timeoutMs,
      timeoutError: () => new Error('App Store 응답 시간이 초과되었습니다.'),
    });
  } catch {
    return { ...managed, message: '앱 안에서 버전을 확인하지 못했습니다. TestFlight 또는 App Store에서 업데이트를 확인해 주세요.' };
  }
}
