const browserListeners = new Set();
let browserTimer = null;

const desktop = window.hoiDesktop;

export const desktopBridge = {
  isDesktop: Boolean(desktop?.isDesktop),
  async getVersion() {
    return desktop?.getVersion ? desktop.getVersion() : 'web-preview';
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
    return () => {};
  },
  async checkForUpdates() {
    if (desktop?.checkForUpdates) return desktop.checkForUpdates();
    return { status: 'web-preview' };
  },
};
