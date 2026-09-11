const RELEASES_URL = 'https://api.github.com/repos/holic8187/leeneo-main/releases?per_page=30';
const RELEASE_REPOSITORY = Object.freeze({ owner: 'holic8187', repository: 'leeneo-main' });

function parseTrustedAndroidReleaseAssetUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (
      url.protocol !== 'https:'
      || url.hostname.toLowerCase() !== 'github.com'
      || url.port
      || url.username
      || url.password
      || url.search
      || url.hash
    ) return null;

    const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
    if (segments.length !== 6) return null;
    const [owner, repository, releases, download, tag, assetName] = segments;
    if (
      owner !== RELEASE_REPOSITORY.owner
      || repository !== RELEASE_REPOSITORY.repository
      || releases !== 'releases'
      || download !== 'download'
    ) return null;

    const tagMatch = /^tcg-android-v(\d+\.\d+\.\d+)$/.exec(tag);
    if (!tagMatch) return null;
    const escapedVersion = tagMatch[1].replaceAll('.', '\\.');
    if (!new RegExp(`^Hoi-Card-Desk-${escapedVersion}-android-release\\.apk$`, 'i').test(assetName)) {
      return null;
    }
    return { tag, version: tagMatch[1], assetName };
  } catch {
    return null;
  }
}

export function isTrustedAndroidReleaseAssetUrl(value) {
  return Boolean(parseTrustedAndroidReleaseAssetUrl(value));
}

function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value || '').trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function findLatestAndroidRelease(releases = []) {
  return releases
    .filter((release) => (
      release
      && !release.draft
      && !release.prerelease
      && /^tcg-android-v\d+\.\d+\.\d+$/.test(String(release.tag_name || ''))
    ))
    .map((release) => {
      const version = String(release.tag_name).replace(/^tcg-android-v/, '');
      const assets = (release.assets || []).filter((candidate) => {
        const parsed = parseTrustedAndroidReleaseAssetUrl(candidate?.browser_download_url);
        return parsed && parsed.tag === release.tag_name && parsed.assetName === candidate.name;
      });
      const asset = assets.find((candidate) => /-android-release\.apk$/i.test(String(candidate?.name || '')));
      return asset ? {
        version,
        tag: release.tag_name,
        downloadUrl: String(asset.browser_download_url),
        releaseUrl: String(release.html_url || ''),
        assetName: String(asset.name || ''),
      } : null;
    })
    .filter(Boolean)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

export async function checkAndroidRelease({
  currentVersion,
  fetchImpl = globalThis.fetch,
  releasesUrl = RELEASES_URL,
} = {}) {
  if (typeof fetchImpl !== 'function') return { status: 'error', detail: '업데이트 서버에 연결할 수 없습니다.' };
  try {
    const response = await fetchImpl(releasesUrl, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const latest = findLatestAndroidRelease(await response.json());
    if (!latest || compareVersions(latest.version, currentVersion) <= 0) {
      return { status: 'current', latestVersion: latest?.version || String(currentVersion || '') };
    }
    return {
      status: 'available',
      detail: `v${latest.version}`,
      latestVersion: latest.version,
      downloadUrl: latest.downloadUrl,
      releaseUrl: latest.releaseUrl,
      assetName: latest.assetName,
    };
  } catch (error) {
    return { status: 'error', detail: String(error?.message || '업데이트 확인 실패') };
  }
}
