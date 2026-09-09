const { randomUUID } = require('node:crypto');

function normalizeIncident(value, instanceId = randomUUID()) {
  if (!value || typeof value.id !== 'string' || !Array.isArray(value.choices)) return null;
  const choices = value.choices.slice(0, 4).filter((choice) => choice && typeof choice.id === 'string' && typeof choice.label === 'string')
    .map((choice) => ({ id: choice.id.slice(0, 100), label: choice.label.slice(0, 120) }));
  if (!choices.length || new Set(choices.map((choice) => choice.id)).size !== choices.length) return null;
  const tier = ['ordinary', 'special', 'mythic'].includes(value.tier) ? value.tier : (value.special === true ? 'special' : 'ordinary');
  return {
    id: value.id.slice(0, 100), instanceId,
    title: String(value.title || '돌발 업무 도착').slice(0, 150),
    summary: String(value.summary || '').slice(0, 600),
    tier, special: tier !== 'ordinary', mythic: tier === 'mythic', choices,
  };
}

function createIncidentCoordinator({ resolveChoice }) {
  let active = null;
  let pending = false;
  return {
    get active() { return active; },
    activate(incident) { active = incident; pending = false; return active; },
    matches(incident) {
      return Boolean(active && incident?.instanceId === active.instanceId && (incident.incidentId || incident.id) === active.id);
    },
    clear(instanceId) {
      if (!active || active.instanceId !== instanceId) return false;
      active = null;
      return true;
    },
    async choose(payload) {
      if (!this.matches(payload)) return { ok: false, code: 'stale', message: '이미 처리되었거나 만료된 이벤트입니다.' };
      if (pending) return { ok: false, code: 'busy', message: '선택을 처리하고 있습니다.' };
      if (!active.choices.some((choice) => choice.id === payload.choiceId)) return { ok: false, code: 'invalid', message: '선택지를 다시 확인해 주세요.' };
      pending = true;
      const instanceId = active.instanceId;
      try {
        const result = await resolveChoice({ incidentId: active.id, instanceId, choiceId: payload.choiceId });
        if (result?.ok) this.clear(instanceId);
        return result?.ok ? { ok: true, message: String(result.message || '보상을 받았습니다.').slice(0, 500) }
          : { ok: false, message: String(result?.message || '선택을 처리하지 못했습니다. 다시 시도해 주세요.').slice(0, 500) };
      } catch {
        return { ok: false, message: '게임과 연결하지 못했습니다. 잠시 후 다시 선택하거나 게임을 열어 주세요.' };
      } finally {
        pending = false;
      }
    },
  };
}

function createUpdateCoordinator({ updater, isPackaged, prepareInstall, install, emit }) {
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
          await updater.checkForUpdates();
          return { status: downloading ? 'downloading' : 'checked' };
        } catch (error) { emit('error', error.message); return { status: 'error', message: error.message }; }
        finally { checking = null; }
      })();
      return checking;
    },
  };
}

function toastBounds(workArea, choiceCount) {
  const width = Math.min(410, Math.max(1, workArea.width - 24));
  const height = Math.min(230 + choiceCount * 48, Math.max(1, workArea.height - 24));
  return {
    width, height,
    x: Math.max(workArea.x, workArea.x + workArea.width - width - 12),
    y: Math.max(workArea.y, workArea.y + workArea.height - height - 12),
  };
}

module.exports = { normalizeIncident, createIncidentCoordinator, createUpdateCoordinator, toastBounds };
