const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel, handler) => {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const respond = (channel, handler) => listen(channel, async ({ requestId, ...payload }) => {
  try {
    const result = await handler(payload);
    const ok = result === true || result?.ok === true;
    ipcRenderer.send('renderer:reply', { requestId, ok, message: result?.message || (ok ? '' : '저장 상태를 확인해 주세요.') });
  } catch (error) {
    ipcRenderer.send('renderer:reply', { requestId, ok: false, message: String(error?.message || '저장에 실패했습니다.') });
  }
});

contextBridge.exposeInMainWorld('hoiDesktop', {
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onBeforeUpdate: (handler) => respond('update:before-install', handler),
  onUpdateStatus: (handler) => listen('update:status', handler),
});
