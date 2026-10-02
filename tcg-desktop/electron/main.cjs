const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { autoUpdater } = require('electron-updater');
const {
  createUpdateCoordinator,
} = require('./desktop-coordinator.cjs');
const { resolveDesktopReleaseFeed } = require('./desktop-release-feed.cjs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || '';
let mainWindow = null;
let tray = null;
let isQuitting = false;
let lastUpdateStatus = { status: 'idle', detail: '' };
const rendererRequests = new Map();

function assetPath(...parts) {
  return path.join(__dirname, '..', DEV_SERVER_URL ? 'public' : 'dist', ...parts);
}

function isSender(event, window) {
  return Boolean(window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame);
}

function configureWindowSecurity(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_SERVER_URL ? new URL(url).origin === new URL(DEV_SERVER_URL).origin
      : url.startsWith(pathToFileURL(`${path.join(__dirname, '..', 'dist')}${path.sep}`).href);
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 640, show: false,
    backgroundColor: '#f4f2ea', icon: assetPath('assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false,
    },
  });
  mainWindow = window;
  configureWindowSecurity(window);
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('update:status', lastUpdateStatus);
  });
  if (DEV_SERVER_URL) void window.loadURL(DEV_SERVER_URL);
  else void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (!isQuitting) { event.preventDefault(); window.hide(); }
  });
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (!mainWindow.isFocused()) mainWindow.flashFrame(true);
  mainWindow.once('focus', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(false); });
}

function createTray() {
  const trayImage = nativeImage.createFromPath(assetPath('assets', 'app-icon.png'));
  tray = new Tray(trayImage.resize({ width: 20, height: 20 }));
  tray.setToolTip('Hoi Card Desk');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '카드부 열기', click: showMainWindow },
    { label: '업데이트 확인', click: () => void updates.check() },
    { type: 'separator' },
    { label: '완전히 종료', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

function requestRenderer(channel, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoadingMainFrame()) {
      reject(new Error('게임 창이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.'));
      return;
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => {
      rendererRequests.delete(requestId);
      reject(new Error('게임 저장 응답이 없습니다. 게임 창에서 저장 상태를 확인해 주세요.'));
    }, 12000);
    rendererRequests.set(requestId, { resolve, timer, channel });
    mainWindow.webContents.send(channel, { ...payload, requestId });
  });
}

const updates = createUpdateCoordinator({
  updater: autoUpdater, isPackaged: () => app.isPackaged,
  async prepareCheck() {
    const release = await resolveDesktopReleaseFeed();
    autoUpdater.setFeedURL({ provider: 'generic', url: release.feedUrl });
  },
  emit(status, detail = '') {
    lastUpdateStatus = { status, detail };
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', lastUpdateStatus);
  },
  async prepareInstall() {
    const response = await requestRenderer('update:before-install');
    if (!response?.ok) throw new Error(response?.message || '저장하지 못했습니다.');
    mainWindow.webContents.session.flushStorageData();
  },
  install() {
    isQuitting = true;
    try { autoUpdater.quitAndInstall(true, true); }
    catch (error) { isQuitting = false; throw error; }
  },
});
autoUpdater.on('error', () => { isQuitting = false; });

function registerIpc() {
  ipcMain.handle('app:get-version', (event) => isSender(event, mainWindow) ? app.getVersion() : null);
  ipcMain.handle('window:hide', (event) => { if (!isSender(event, mainWindow)) return false; mainWindow.hide(); return true; });
  ipcMain.handle('update:check', (event) => isSender(event, mainWindow) ? updates.check() : { status: 'denied' });
  ipcMain.on('renderer:reply', (event, payload) => {
    if (!isSender(event, mainWindow) || typeof payload?.requestId !== 'string') return;
    const request = rendererRequests.get(payload.requestId);
    if (!request) return;
    clearTimeout(request.timer);
    rendererRequests.delete(payload.requestId);
    request.resolve({ ok: payload.ok === true, message: typeof payload.message === 'string' ? payload.message.slice(0, 500) : '' });
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) app.quit();
else {
  app.on('second-instance', () => {
    if (!app.isReady()) return;
    showMainWindow();
    void updates.check();
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.hoicompany.carddesk');
    Menu.setApplicationMenu(null);
    registerIpc();
    createMainWindow();
    createTray();
    mainWindow.webContents.once('did-finish-load', () => { void updates.check(); });
  });
}

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => {});
app.on('activate', () => { if (singleInstanceLock && app.isReady()) showMainWindow(); });
