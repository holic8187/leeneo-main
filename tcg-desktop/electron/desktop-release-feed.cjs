const RELEASES_API_URL = 'https://api.github.com/repos/holic8187/leeneo-main/releases?per_page=30';
const DESKTOP_TAG = /^tcg-v(\d+\.\d+\.\d+)$/;

function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || '').trim());
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function findLatestDesktopRelease(releases = []) {
  return (Array.isArray(releases) ? releases : [])
    .filter((release) => release && !release.draft && !release.prerelease)
    .map((release) => {
      const match = DESKTOP_TAG.exec(String(release.tag_name || ''));
      if (!match) return null;
      const hasManifest = (release.assets || []).some((asset) => asset?.name === 'latest.yml');
      if (!hasManifest) return null;
      return { tag: release.tag_name, version: match[1] };
    })
    .filter(Boolean)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

async function resolveDesktopReleaseFeed({ fetchImpl = globalThis.fetch, releasesUrl = RELEASES_API_URL } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('업데이트 서버에 연결할 수 없습니다.');
  const response = await fetchImpl(releasesUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Hoi-Card-Desk-Desktop-Updater',
    },
  });
  if (!response.ok) throw new Error(`업데이트 서버 응답 오류 (${response.status})`);
  const release = findLatestDesktopRelease(await response.json());
  if (!release) throw new Error('PC용 최신 업데이트 정보를 찾지 못했습니다.');
  return {
    ...release,
    feedUrl: `https://github.com/holic8187/leeneo-main/releases/download/${release.tag}`,
  };
}

module.exports = {
  RELEASES_API_URL,
  compareVersions,
  findLatestDesktopRelease,
  resolveDesktopReleaseFeed,
};
