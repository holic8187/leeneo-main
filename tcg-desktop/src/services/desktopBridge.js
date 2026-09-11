import { detectClientPlatform } from '../core/deviceIdentity.js';
import {
  checkAndroidRelease,
  isTrustedAndroidReleaseAssetUrl,
} from './androidUpdateGateway.js';
import { withDeadline } from '../core/promiseDeadline.js';

const browserListeners = new Set();
const mobileUpdateListeners = new Set();
let browserTimer = null;
let androidUpdater = null;
let androidUpdaterListenerPromise = null;
let currentAndroidUpdateUrl = '';

const APP_VERSION_TIMEOUT_MS = 2500;
const BUILD_APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

const desktop = globalThis.hoiDesktop;
const platform = detectClientPlatform(globalThis);

export async function readAppVersionWithFallback(
  readVersion,
  {
    fallbackVersion = BUILD_APP_VERSION,
    timeoutMs = APP_VERSION_TIMEOUT_MS,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
  } = {},
) {
  const fallback = String(fallbackVersion || '0.0.0');
  try {
    const value = await withDeadline(readVersion, {
      timeoutMs,
      setTimeoutImpl,
      clearTimeoutImpl,
      timeoutError: () => Object.assign(new Error('앱 버전 확인 시간이 초과되었습니다.'), { code: 'VERSION_TIMEOUT' }),
    });
    return String(value || fallback);
  } catch {
    return fallback;
  }
}

async function capacitorApp() {
  if (platform !== 'android' && platform !== 'ios') return null;
  try {
    return (await import('@capacitor/app')).App;
  } catch {
    return null;
  }
}

async function capacitorAndroidUpdater() {
  if (platform !== 'android') return null;
  if (androidUpdater) return androidUpdater;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    androidUpdater = registerPlugin('AndroidUpdater');
    return androidUpdater;
  } catch {
    return null;
  }
}

async function ensureAndroidUpdaterListener() {
  if (platform !== 'android') return null;
  if (!androidUpdaterListenerPromise) {
    androidUpdaterListenerPromise = (async () => {
      const updater = await capacitorAndroidUpdater();
      if (!updater) return null;
      return updater.addListener('updateStatus', (status) => {
        const payload = currentAndroidUpdateUrl
          ? { ...status, downloadUrl: currentAndroidUpdateUrl }
          : status;
        for (const listener of mobileUpdateListeners) listener(payload);
      });
    })().catch(() => {
      androidUpdaterListenerPromise = null;
      return null;
    });
  }
  return androidUpdaterListenerPromise;
}

export const desktopBridge = {
  isDesktop: Boolean(desktop?.isDesktop),
  isMobile: platform === 'android' || platform === 'ios',
  platform,
  async getVersion() {
    const fallbackVersion = platform === 'android' || platform === 'ios'
      ? BUILD_APP_VERSION
      : 'web-preview';
    return readAppVersionWithFallback(async () => {
      if (desktop?.getVersion) return desktop.getVersion();
      const App = await capacitorApp();
      if (App) return (await App.getInfo()).version;
      return fallbackVersion;
    }, { fallbackVersion });
  },
  async hideWindow() {
    if (desktop?.hideWindow) return desktop.hideWindow();
    document.documentElement.classList.toggle('discreet-preview');
    return true;
  },
  async scheduleIncident(incident, delayMs) {
    if (desktop?.scheduleIncident) {
      return desktop.scheduleIncident({ incident, delayMs });
    }
    clearTimeout(browserTimer);
    const instanceId = globalThis.crypto?.randomUUID?.() || `incident-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    browserTimer = setTimeout(() => {
      browserTimer = null;
      for (const listener of browserListeners) listener({ ...incident, instanceId });
    }, delayMs);
    return { scheduled: true, delayMs, instanceId };
  },
  async cancelIncident() {
    if (desktop?.cancelIncident) return desktop.cancelIncident();
    clearTimeout(browserTimer);
    browserTimer = null;
    return true;
  },
  async setIncidentNotifications(enabled) {
    if (desktop?.setIncidentNotifications) return desktop.setIncidentNotifications(enabled === true);
    return enabled === true;
  },
  onIncident(handler) {
    if (desktop?.onIncident) return desktop.onIncident(handler);
    browserListeners.add(handler);
    return () => browserListeners.delete(handler);
  },
  onOpenIncident(handler) {
    if (desktop?.onOpenIncident) return desktop.onOpenIncident(handler);
    return () => {};
  },
  onIncidentChoice(handler) {
    if (desktop?.onIncidentChoice) return desktop.onIncidentChoice(handler);
    return () => {};
  },
  onBeforeUpdate(handler) {
    if (desktop?.onBeforeUpdate) return desktop.onBeforeUpdate(handler);
    return () => {};
  },
  async clearActiveIncident(instanceId, options) {
    if (desktop?.clearActiveIncident) return desktop.clearActiveIncident(instanceId, options);
    return true;
  },
  onUpdateStatus(handler) {
    if (desktop?.onUpdateStatus) return desktop.onUpdateStatus(handler);
    if (platform !== 'android') return () => {};
    mobileUpdateListeners.add(handler);
    void ensureAndroidUpdaterListener();
    return () => mobileUpdateListeners.delete(handler);
  },
  async checkForUpdates() {
    if (desktop?.checkForUpdates) return desktop.checkForUpdates();
    if (platform === 'android') {
      return checkAndroidRelease({ currentVersion: await this.getVersion() });
    }
    return { status: 'web-preview' };
  },
  async installAndroidUpdate(downloadUrl) {
    if (platform !== 'android') return { status: 'unsupported' };
    if (!isTrustedAndroidReleaseAssetUrl(downloadUrl)) {
      const error = new Error('공식 GitHub Android 배포 파일만 설치할 수 있습니다.');
      error.code = 'UPDATE_URL_NOT_ALLOWED';
      throw error;
    }
    currentAndroidUpdateUrl = String(downloadUrl);
    await ensureAndroidUpdaterListener();
    const updater = await capacitorAndroidUpdater();
    if (!updater) {
      const error = new Error('Android 업데이트 기능을 불러오지 못했습니다.');
      error.code = 'UPDATE_PLUGIN_UNAVAILABLE';
      throw error;
    }
    return updater.downloadAndInstall({ url: downloadUrl });
  },
  onAppStateChange(handler) {
    let removed = false;
    let handle = null;
    void capacitorApp().then(async (App) => {
      if (!App || removed) return;
      handle = await App.addListener('appStateChange', ({ isActive }) => handler(Boolean(isActive)));
      if (removed) await handle.remove();
    });
    return () => {
      removed = true;
      void handle?.remove?.();
    };
  },
  async openExternal(url) {
    const safeUrl = String(url || '');
    if (!/^https:\/\//i.test(safeUrl)) return false;
    if (platform === 'android' || platform === 'ios') {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: safeUrl });
        return true;
      } catch {
        // Fall back to the WebView/browser behavior if the native plugin is not
        // available in an older installation.
      }
    }
    const opened = globalThis.open?.(safeUrl, '_blank', 'noopener,noreferrer');
    if (!opened && globalThis.location) globalThis.location.href = safeUrl;
    return true;
  },
};
