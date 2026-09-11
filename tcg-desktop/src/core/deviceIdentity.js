export const DEVICE_ID_STORAGE_KEY = 'hoi-card-desk-device-id-v1';

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{12,160}$/;

function fallbackDeviceId(now = Date.now, random = Math.random) {
  const entropy = Array.from({ length: 4 }, () => Math.floor(random() * 0x100000000).toString(36)).join('');
  return `device-${now().toString(36)}-${entropy}`;
}

export function normalizeDeviceId(value) {
  const normalized = String(value || '').trim();
  return DEVICE_ID_PATTERN.test(normalized) ? normalized : '';
}

export function getOrCreateDeviceId(
  storage = globalThis.localStorage,
  {
    randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
    now = Date.now,
    random = Math.random,
  } = {},
) {
  try {
    const saved = normalizeDeviceId(storage?.getItem?.(DEVICE_ID_STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // Storage can be unavailable in a private preview. A session-scoped id is
    // still preferable to preventing the app from opening.
  }

  const generated = normalizeDeviceId(typeof randomUUID === 'function' ? randomUUID() : '')
    || fallbackDeviceId(now, random);
  try {
    storage?.setItem?.(DEVICE_ID_STORAGE_KEY, generated);
  } catch {
    // The caller can continue with the generated id for this app process.
  }
  return generated;
}

export function detectClientPlatform(globalObject = globalThis) {
  if (globalObject?.hoiDesktop?.isDesktop) return 'pc';
  const nativePlatform = String(globalObject?.Capacitor?.getPlatform?.() || '').toLowerCase();
  if (nativePlatform === 'android' || nativePlatform === 'ios') return nativePlatform;
  return 'web';
}

export function platformLabel(platform) {
  if (platform === 'android' || platform === 'ios' || platform === 'mobile') return '모바일';
  if (platform === 'pc') return 'PC';
  return '다른 기기';
}

export function shouldBootstrapCloudState({
  platform,
  newAccount = false,
  hasPersistedState = false,
} = {}) {
  return newAccount === true || (platform === 'pc' && hasPersistedState === true);
}
