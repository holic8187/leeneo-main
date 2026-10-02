function createUpdateCoordinator({ updater, isPackaged, prepareCheck = null, prepareInstall, install, emit }) {
  let checking = null;
  let installing = null;
  let downloaded = null;
  let downloading = false;
  let installed = false;
  const apply = () => {
    if (installed) return Promise.resolve({ status: 'installing' });
    if (installing) return installing;
    installing = (async () => {
      try {
        emit('saving', downloaded?.version || '');
        await prepareInstall();
        emit('installing', downloaded?.version || '');
        installed = true;
        await install();
        return { status: 'installing' };
      } catch (error) {
        installed = false;
        emit('error', `업데이트 적용을 보류했습니다. ${error.message || '저장 상태를 확인해 주세요.'}`);
        return { status: 'error', message: error.message };
      } finally { installing = null; }
    })();
    return installing;
  };
  updater.autoDownload = true;
  // Every install must pass through the renderer save acknowledgement first.
  updater.autoInstallOnAppQuit = false;
  updater.autoRunAppAfterInstall = true;
  updater.allowDowngrade = false;
  updater.on('update-available', (info) => { downloading = true; emit('available', info.version); });
  updater.on('update-not-available', () => { downloading = false; emit('current'); });
  updater.on('download-progress', (progress) => emit('downloading', Math.max(0, Math.min(100, Math.round(progress.percent || 0)))));
  updater.on('update-downloaded', (info) => { downloading = false; downloaded = info; void apply(); });
  updater.on('error', (error) => { downloading = false; installed = false; emit('error', error.message); });
  return {
    async check() {
      if (!isPackaged()) { emit('development', '개발 실행에서는 업데이트 확인을 건너뜁니다.'); return { status: 'development' }; }
      if (downloaded) return apply();
      if (checking) return checking;
      if (downloading) return { status: 'downloading' };
      checking = (async () => {
        try {
          emit('checking');
          if (typeof prepareCheck === 'function') await prepareCheck();
          await updater.checkForUpdates();
          return { status: downloading ? 'downloading' : 'checked' };
        } catch (error) { emit('error', error.message); return { status: 'error', message: error.message }; }
        finally { checking = null; }
      })();
      return checking;
    },
  };
}

module.exports = { createUpdateCoordinator };
