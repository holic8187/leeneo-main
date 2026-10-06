import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloudSaveConflictBackupKey,
  cloudSaveOutboxKey,
  createCloudPlaySession,
  mergeAuthoritativeState,
} from '../src/core/cloudPlaySession.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function response(overrides = {}) {
  return {
    leaseId: 'lease-1',
    generation: 1,
    expiresAt: 10000,
    serverNow: 1000,
    revision: 3,
    state: { wallet: { coins: 100 } },
    initialized: true,
    ...overrides,
  };
}

test('late initial open after disposal cannot apply an old account or start a heartbeat', async () => {
  let resolve; let applied = 0; let heartbeats = 0;
  const cloud = createCloudPlaySession({
    gateway: { open: () => new Promise((done) => { resolve = done; }) },
    token: 'old', accountId: 'old-account', deviceId: 'device-123456789',
    onRemoteState: () => applied++, setIntervalImpl: () => { heartbeats++; return 1; },
  });
  const pending = cloud.open();
  assert.equal(cloud.open(), pending);
  cloud.dispose(); resolve(response()); await pending;
  assert.equal(applied, 0); assert.equal(heartbeats, 0); assert.equal(cloud.getSnapshot().lease, null);
});

test('foreground resume is single-flight and suspended acquisition stays durable until acknowledgement', async () => {
  const storage = memoryStorage(); let heartbeatResolve; let heartbeats = 0; let saves = 0;
  const cloud = createCloudPlaySession({
    gateway: {
      async open() { return response(); },
      heartbeat: () => { heartbeats++; return new Promise((resolve) => { heartbeatResolve = resolve; }); },
      async saveState() { saves++; return response({ revision: 4 }); },
    },
    token: 'token', accountId: 'account-a', deviceId: 'device-123456789', storage,
  });
  await cloud.open();
  cloud.queueState({ collection: { 'hoi-ssr': 1 } });
  cloud.suspend();
  assert.equal(cloud.getSnapshot().phase, 'suspended');
  assert.equal(cloud.queueState({ collection: {} }), false);
  assert.ok(storage.getItem(cloudSaveOutboxKey('account-a')));
  const resume = cloud.resume(); assert.equal(cloud.resume(), resume);
  assert.equal(cloud.getSnapshot().phase, 'connecting'); assert.equal(heartbeats, 1);
  heartbeatResolve(response({ state: null })); assert.equal(await resume, true);
  assert.equal(saves, 1); assert.equal(storage.getItem(cloudSaveOutboxKey('account-a')), null); cloud.dispose();
});

test('disposal during resume ignores a late heartbeat and cannot reactivate gameplay', async () => {
  let resolve; const phases = [];
  const cloud = createCloudPlaySession({
    gateway: { async open() { return response(); }, heartbeat: () => new Promise((done) => { resolve = done; }) },
    token: 'token', deviceId: 'device-123456789', onPhase: ({ phase }) => phases.push(phase),
  });
  await cloud.open(); cloud.suspend(); const pending = cloud.resume(); cloud.dispose();
  resolve(response()); assert.equal(await pending, false);
  assert.equal(phases.at(-1), 'connecting'); assert.equal(cloud.getSnapshot().lease, null);
});

test('cancelled or uncertain server reward refreshes authoritative inventory before accepting a new save', async () => {
  const remote = []; const saved = []; let opens = 0;
  const cloud = createCloudPlaySession({
    gateway: {
      async open() { return response(++opens === 1 ? {} : { revision: 4, state: { wallet: { coins: 700 } } }); },
      async heartbeat() { return response({ revision: 4, state: null }); },
      async saveState(_token, body) { saved.push(body); return response({ revision: 5 }); },
    }, token: 'token', deviceId: 'device-123456789', onRemoteState: state => remote.push(state),
  });
  await cloud.open(); cloud.beginAuthoritativeMutation({ wallet: { coins: 100 } });
  cloud.suspend(); cloud.cancelAuthoritativeMutation();
  assert.equal(cloud.queueState({ wallet: { coins: 101 } }), false);
  assert.equal(await cloud.resume(), true); assert.equal(opens, 2);
  assert.deepEqual(remote.at(-1), { wallet: { coins: 700 } });
  cloud.queueState({ wallet: { coins: 701 } }); await cloud.flush();
  assert.equal(saved[0].baseRevision, 4); assert.equal(saved[0].state.wallet.coins, 701); cloud.dispose();
});

test('a newer heartbeat revision is never adopted without its corresponding server inventory', async () => {
  const remote = []; let opens = 0;
  const cloud = createCloudPlaySession({
    gateway: {
      async open() { return response(++opens === 1 ? {} : { revision: 9, state: { collection: { 'hoi-ssr': 1 } } }); },
      async heartbeat() { return response({ revision: 9, state: null }); },
    }, token: 'token', deviceId: 'device-123456789', onRemoteState: state => remote.push(state),
  });
  await cloud.open(); await cloud.heartbeat();
  assert.equal(cloud.getSnapshot().phase, 'connection-error'); assert.equal(cloud.getSnapshot().revision, 3);
  assert.equal(await cloud.resume(), true); assert.equal(cloud.getSnapshot().revision, 9);
  assert.deepEqual(remote.at(-1), { collection: { 'hoi-ssr': 1 } }); cloud.dispose();
});

test('a conflict kept across backgrounding can be explicitly resolved and revalidated', async () => {
  const storage = memoryStorage();
  storage.setItem(cloudSaveOutboxKey('account'), JSON.stringify({ version: 1, entryId: 'unsent', baseRevision: 1, state: { wallet: { coins: 101 } } }));
  const cloud = createCloudPlaySession({
    gateway: { async open() { return response(); }, async heartbeat() { return response({ state: null }); } },
    token: 'token', accountId: 'account', storage, deviceId: 'device-123456789',
  });
  await cloud.open(); assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  cloud.suspend(); assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  assert.equal(await cloud.resolveConflict('server'), true);
  assert.equal(await cloud.resume(), true); assert.equal(cloud.getSnapshot().phase, 'active'); cloud.dispose();
});

test('an in-flight authoritative reward can settle after resume without losing local deltas', async () => {
  const remote = [];
  const cloud = createCloudPlaySession({
    gateway: { async open() { return response(); }, async heartbeat() { return response({ revision: 4 }); }, async saveState() { return response({ revision: 5 }); } },
    token: 'token', deviceId: 'device-123456789', onRemoteState: state => remote.push(state),
  });
  await cloud.open(); cloud.beginAuthoritativeMutation({ wallet: { coins: 100 } });
  cloud.queueState({ wallet: { coins: 101 } }); cloud.suspend();
  await cloud.resume(); assert.equal(cloud.getSnapshot().revision, 3);
  cloud.commitAuthoritativeMutation(response({ revision: 4, state: { wallet: { coins: 700 } } }));
  assert.equal(remote.at(-1).wallet.coins, 701); await cloud.flush(); cloud.dispose();
});

test('cloud session opens with bootstrap metadata, applies remote state, and saves only the newest debounced snapshot', async () => {
  const calls = [];
  const remoteStates = [];
  const phases = [];
  const gateway = {
    async open(_token, body) { calls.push(['open', body]); return response(); },
    async saveState(_token, body) { calls.push(['save', body]); return response({ revision: body.baseRevision + 1, state: null }); },
    async heartbeat() { return response({ state: null }); },
    async takeover() { return response(); },
    async release(_token, body) { calls.push(['release', body]); return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token',
    deviceId: 'device-123456789',
    platform: 'pc',
    appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
    onPhase: ({ phase }) => phases.push(phase),
  });

  await cloud.open({ bootstrapState: { wallet: { coins: 10 } }, allowBootstrap: true });
  assert.deepEqual(remoteStates, [{ wallet: { coins: 100 } }]);
  assert.equal(calls[0][1].allowBootstrap, true);
  cloud.queueState({ wallet: { coins: 101 } });
  cloud.queueState({ wallet: { coins: 102 } });
  await cloud.flush();
  const saves = calls.filter(([kind]) => kind === 'save');
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0][1].state, { wallet: { coins: 102 } });
  assert.equal(saves[0][1].baseRevision, 3);
  assert.equal(cloud.getSnapshot().revision, 4);
  assert.deepEqual(phases.slice(0, 2), ['connecting', 'active']);
  cloud.dispose();
});

test('a displaced client is blocked and takeover applies the winning device state', async () => {
  const phases = [];
  const remoteStates = [];
  const displaced = Object.assign(new Error('다른 기기에서 플레이 중입니다.'), {
    code: 'PLAYING_ELSEWHERE', activePlatform: 'android', generation: 8,
  });
  const gateway = {
    async open() { throw displaced; },
    async takeover(_token, body) {
      assert.equal(body.expectedGeneration, 8);
      return response({ leaseId: 'lease-2', generation: 9, revision: 12, state: { wallet: { coins: 777 } } });
    },
    async heartbeat() { return response({ state: null }); },
    async saveState() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'pc', appVersion: '0.5.0',
    onPhase: (status) => phases.push(status),
    onRemoteState: (state) => remoteStates.push(state),
  });

  await assert.rejects(cloud.open(), /다른 기기/);
  assert.equal(phases.at(-1).phase, 'playing-elsewhere');
  assert.equal(phases.at(-1).activePlatform, 'android');
  await cloud.takeover({ expectedGeneration: phases.at(-1).generation });
  assert.equal(cloud.getSnapshot().phase, 'active');
  assert.equal(cloud.getSnapshot().lease.generation, 9);
  assert.deepEqual(remoteStates, [{ wallet: { coins: 777 } }]);
  cloud.dispose();
});

test('a failed cloud save remains queued and is retried after connectivity returns', async () => {
  let failSave = true;
  const phases = [];
  const saved = [];
  const gateway = {
    async open() { return response({ state: null }); },
    async heartbeat() { return response({ state: null }); },
    async saveState(_token, body) {
      if (failSave) {
        failSave = false;
        throw Object.assign(new Error('network down'), { code: 'NETWORK_ERROR' });
      }
      saved.push(body.state);
      return response({ revision: body.baseRevision + 1, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
    onPhase: ({ phase }) => phases.push(phase),
  });
  await cloud.open();
  cloud.queueState({ wallet: { coins: 555 } });
  await assert.rejects(cloud.flush(), /network down/);
  assert.equal(cloud.getSnapshot().phase, 'connection-error');
  assert.equal(cloud.getSnapshot().hasPendingState, true);

  assert.equal(await cloud.resume(), true);
  assert.deepEqual(saved, [{ wallet: { coins: 555 } }]);
  assert.equal(cloud.getSnapshot().phase, 'active');
  cloud.dispose();
});

test('an expired background lease reopens and retries pending state when the server revision is unchanged', async () => {
  let openCount = 0;
  let heartbeatCount = 0;
  const saves = [];
  const remoteStates = [];
  const gateway = {
    async open() {
      openCount += 1;
      return response({
        leaseId: `lease-${openCount}`,
        generation: openCount,
        revision: 3,
        state: openCount === 1 ? null : { wallet: { coins: 100 } },
      });
    },
    async heartbeat() {
      heartbeatCount += 1;
      throw Object.assign(new Error('expired'), {
        code: 'PLAY_SESSION_LOST',
        activePlatform: '',
        generation: 1,
        revision: 3,
      });
    },
    async saveState(_token, body) {
      if (saves.length === 0) {
        saves.push(['failed', body]);
        throw Object.assign(new Error('network down'), { code: 'NETWORK_ERROR' });
      }
      saves.push(['saved', body]);
      return response({ revision: 4, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  cloud.queueState({ wallet: { coins: 555 } });
  await assert.rejects(cloud.flush(), /network down/);
  assert.equal(cloud.getSnapshot().hasPendingState, true);
  assert.equal(await cloud.resume(), true);
  assert.equal(openCount, 2);
  assert.equal(heartbeatCount, 1);
  assert.equal(saves.length, 2);
  assert.equal(saves[1][1].baseRevision, 3);
  assert.deepEqual(saves[1][1].state, { wallet: { coins: 555 } });
  assert.deepEqual(remoteStates, []);
  assert.equal(cloud.getSnapshot().phase, 'active');
  cloud.dispose();
});

test('a reopened session blocks on a newer, different server state instead of silently losing pending state', async () => {
  let openCount = 0;
  let saveCount = 0;
  const remoteStates = [];
  const gateway = {
    async open() {
      openCount += 1;
      return response({
        leaseId: `lease-${openCount}`,
        generation: openCount,
        revision: openCount === 1 ? 3 : 4,
        state: openCount === 1 ? null : { wallet: { coins: 700 } },
      });
    },
    async heartbeat() {
      throw Object.assign(new Error('expired'), { code: 'PLAY_SESSION_LOST', activePlatform: '', revision: 4 });
    },
    async saveState() {
      saveCount += 1;
      throw Object.assign(new Error('network down'), { code: 'NETWORK_ERROR' });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  cloud.queueState({ wallet: { coins: 555 } });
  await assert.rejects(cloud.flush(), /network down/);
  assert.equal(await cloud.resume(), false);
  assert.equal(saveCount, 1);
  assert.deepEqual(remoteStates, []);
  assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  assert.equal(cloud.getSnapshot().hasPendingState, true);
  assert.equal(cloud.getSnapshot().hasSaveConflict, true);
  assert.equal(cloud.getSnapshot().revision, 4);
  cloud.dispose();
});

test('moving to another device preserves unsent state and requires reconciliation after takeover', async () => {
  let saveCount = 0;
  const remoteStates = [];
  const gateway = {
    async open() { return response({ state: null }); },
    async heartbeat() {
      throw Object.assign(new Error('mobile active'), {
        code: 'PLAY_SESSION_LOST', activePlatform: 'android', generation: 8,
      });
    },
    async saveState() {
      saveCount += 1;
      if (saveCount === 1) throw Object.assign(new Error('network down'), { code: 'NETWORK_ERROR' });
      return response({ leaseId: 'lease-9', generation: 9, revision: 11, state: { wallet: { coins: 555 } } });
    },
    async takeover() {
      return response({ leaseId: 'lease-9', generation: 9, revision: 10, state: { wallet: { coins: 900 } } });
    },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'pc', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  cloud.queueState({ wallet: { coins: 555 } });
  await assert.rejects(cloud.flush(), /network down/);
  await assert.rejects(cloud.heartbeat(), /mobile active/);
  assert.equal(cloud.getSnapshot().phase, 'playing-elsewhere');
  assert.equal(cloud.getSnapshot().hasPendingState, true);
  await cloud.takeover({ expectedGeneration: 8 });
  await cloud.flush();
  assert.equal(saveCount, 1);
  assert.deepEqual(remoteStates, []);
  assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  assert.equal(cloud.getSnapshot().hasPendingState, true);
  assert.equal(cloud.getSnapshot().hasSaveConflict, true);

  assert.equal(await cloud.resolveConflict('local'), true);
  assert.equal(saveCount, 2);
  assert.equal(cloud.getSnapshot().phase, 'active');
  assert.equal(cloud.getSnapshot().hasPendingState, false);
  cloud.dispose();
});

test('a displaced in-flight card acquisition remains in the durable account outbox', async () => {
  const storage = memoryStorage();
  const accountId = 'account-card-recovery';
  let rejectSave;
  let saveStarted;
  const started = new Promise((resolve) => { saveStarted = resolve; });
  const gateway = {
    async open() { return response({ state: null }); },
    async heartbeat() {
      throw Object.assign(new Error('mobile active'), {
        code: 'PLAY_SESSION_LOST', activePlatform: 'android', generation: 4, revision: 4,
      });
    },
    async saveState() {
      saveStarted();
      return new Promise((resolve, reject) => { rejectSave = reject; });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'pc-device', platform: 'pc', appVersion: '0.9.0',
  });

  await cloud.open();
  cloud.queueState({
    collection: { 'hoi-ssr': 1 },
    discoveredCardIds: ['hoi-ssr'],
  });
  const flushing = cloud.flush();
  await started;
  await assert.rejects(cloud.heartbeat(), /mobile active/);

  const durable = JSON.parse(storage.getItem(cloudSaveOutboxKey(accountId)));
  assert.equal(durable.state.collection['hoi-ssr'], 1);
  assert.equal(cloud.getSnapshot().hasPendingState, true);

  rejectSave(Object.assign(new Error('lease moved'), {
    code: 'PLAY_SESSION_LOST', activePlatform: 'android', generation: 4, revision: 4,
  }));
  await flushing;
  assert.equal(
    JSON.parse(storage.getItem(cloudSaveOutboxKey(accountId))).state.collection['hoi-ssr'],
    1,
  );
  cloud.dispose();
});

test('a save conflict preserves the local copy until the user chooses the server copy', async () => {
  let saveCount = 0;
  const remoteStates = [];
  const gateway = {
    async open() { return response({ state: null }); },
    async heartbeat() { return response({ state: null }); },
    async saveState() {
      saveCount += 1;
      throw Object.assign(new Error('conflict'), {
        code: 'SAVE_CONFLICT',
        revision: 4,
        state: { wallet: { coins: 444 } },
      });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'pc', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  cloud.queueState({ wallet: { coins: 555 } });
  await cloud.flush();
  assert.equal(saveCount, 1);
  assert.deepEqual(remoteStates, []);
  assert.equal(cloud.getSnapshot().revision, 4);
  assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  assert.equal(cloud.getSnapshot().hasPendingState, true);
  assert.equal(await cloud.resolveConflict('server'), true);
  assert.deepEqual(remoteStates, [{ wallet: { coins: 444 } }]);
  assert.equal(cloud.getSnapshot().phase, 'active');
  assert.equal(cloud.getSnapshot().hasPendingState, false);
  cloud.dispose();
});

test('queueing writes an account-scoped outbox synchronously and a successful save removes it', async () => {
  const storage = memoryStorage();
  const accountId = 'account/A';
  const gateway = {
    async open() { return response({ state: null }); },
    async heartbeat() { return response({ state: null }); },
    async saveState(_token, body) { return response({ revision: body.baseRevision + 1, state: null }); },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token',
    accountId,
    storage,
    nowImpl: () => 1234,
    deviceId: 'device-123456789',
    platform: 'android',
    appVersion: '0.5.0',
  });

  await cloud.open();
  assert.equal(cloud.queueState({ wallet: { coins: 321 } }), true);
  const stored = JSON.parse(storage.getItem(cloudSaveOutboxKey(accountId)));
  assert.equal(stored.baseRevision, 3);
  assert.deepEqual(stored.state, { wallet: { coins: 321 } });
  await cloud.flush();
  assert.equal(storage.getItem(cloudSaveOutboxKey(accountId)), null);
  cloud.dispose();
});

test('a newer snapshot queued during a save stays durable and is rebased after the first acknowledgement', async () => {
  const storage = memoryStorage();
  const accountId = 'account-in-flight';
  const saves = [];
  let settleFirstSave;
  let markFirstSaveStarted;
  const firstSaveStarted = new Promise((resolve) => { markFirstSaveStarted = resolve; });
  const gateway = {
    async open() { return response({ revision: 3, state: null }); },
    async heartbeat() { return response({ state: null }); },
    async saveState(_token, body) {
      saves.push(body);
      if (saves.length === 1) {
        markFirstSaveStarted();
        return new Promise((resolve) => {
          settleFirstSave = () => resolve(response({ revision: 4, state: null }));
        });
      }
      return response({ revision: 5, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
  });

  await cloud.open();
  cloud.queueState({ wallet: { coins: 101 } });
  const flushing = cloud.flush();
  await firstSaveStarted;
  cloud.queueState({ wallet: { coins: 102 } });
  assert.deepEqual(
    JSON.parse(storage.getItem(cloudSaveOutboxKey(accountId))).state,
    { wallet: { coins: 102 } },
  );
  settleFirstSave();
  await flushing;

  assert.equal(saves.length, 2);
  assert.equal(saves[0].baseRevision, 3);
  assert.equal(saves[1].baseRevision, 4);
  assert.deepEqual(saves[1].state, { wallet: { coins: 102 } });
  assert.equal(storage.getItem(cloudSaveOutboxKey(accountId)), null);
  cloud.dispose();
});

test('a fresh process retries a durable outbox when the server revision is unchanged', async () => {
  const storage = memoryStorage();
  const accountId = 'account-1';
  const saves = [];
  const gateway = {
    async open() { return response({ revision: 3, state: { wallet: { coins: 100 } } }); },
    async heartbeat() { return response({ state: null }); },
    async saveState(_token, body) {
      saves.push(body);
      return response({ revision: 4, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const first = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
  });
  await first.open();
  first.queueState({ wallet: { coins: 555 } });
  first.dispose();

  const remoteStates = [];
  const second = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'device-123456789', platform: 'android', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });
  assert.equal(second.getSnapshot().hasPendingState, true);
  await second.open();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].baseRevision, 3);
  assert.deepEqual(saves[0].state, { wallet: { coins: 555 } });
  assert.deepEqual(remoteStates, []);
  assert.equal(storage.getItem(cloudSaveOutboxKey(accountId)), null);
  second.dispose();
});

test('a fresh process clears an outbox when the server already contains the same state', async () => {
  const storage = memoryStorage();
  const accountId = 'account-2';
  let saveCount = 0;
  storage.setItem(cloudSaveOutboxKey(accountId), JSON.stringify({
    version: 1,
    entryId: 'lost-response',
    baseRevision: 3,
    queuedAt: 1000,
    state: { wallet: { coins: 555 } },
  }));
  const gateway = {
    async open() { return response({ revision: 4, state: { wallet: { coins: 555 } } }); },
    async heartbeat() { return response({ state: null }); },
    async saveState() { saveCount += 1; return response({ revision: 5, state: null }); },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const remoteStates = [];
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'device-123456789', platform: 'pc', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  assert.equal(saveCount, 0);
  assert.deepEqual(remoteStates, [{ wallet: { coins: 555 } }]);
  assert.equal(cloud.getSnapshot().hasPendingState, false);
  assert.equal(storage.getItem(cloudSaveOutboxKey(accountId)), null);
  cloud.dispose();
});

test('a durable outbox conflict keeps both the active local copy and a conflict backup', async () => {
  const storage = memoryStorage();
  const accountId = 'account-3';
  storage.setItem(cloudSaveOutboxKey(accountId), JSON.stringify({
    version: 1,
    entryId: 'pending-local',
    baseRevision: 3,
    queuedAt: 1000,
    state: { wallet: { coins: 555 } },
  }));
  const saves = [];
  const gateway = {
    async open() { return response({ revision: 4, state: { wallet: { coins: 700 } } }); },
    async heartbeat() { return response({ revision: 4, state: null }); },
    async saveState(_token, body) {
      saves.push(body);
      return response({ revision: 5, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const remoteStates = [];
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', accountId, storage,
    deviceId: 'device-123456789', platform: 'pc', appVersion: '0.5.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  assert.equal(cloud.getSnapshot().phase, 'save-conflict');
  assert.deepEqual(remoteStates, []);
  assert.ok(storage.getItem(cloudSaveOutboxKey(accountId)));
  const backup = JSON.parse(storage.getItem(cloudSaveConflictBackupKey(accountId)));
  assert.deepEqual(backup.local.state, { wallet: { coins: 555 } });
  assert.deepEqual(backup.serverState, { wallet: { coins: 700 } });

  assert.equal(await cloud.resolveConflict('local'), true);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].baseRevision, 4);
  assert.deepEqual(saves[0].state, { wallet: { coins: 555 } });
  assert.equal(storage.getItem(cloudSaveOutboxKey(accountId)), null);
  cloud.dispose();
});

test('an atomic server reward snapshot advances the revision without creating a local save', async () => {
  const remoteStates = [];
  let saveCount = 0;
  const gateway = {
    async open() { return response(); },
    async heartbeat() { return response({ revision: 4, state: null }); },
    async saveState() { saveCount += 1; return response({ state: null }); },
    async takeover() { return response(); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token', deviceId: 'device-123456789', platform: 'pc', appVersion: '0.7.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  assert.equal(cloud.adoptServerSnapshot(response({
    revision: 4,
    state: { wallet: { coins: 250 }, packs: { standard: 2 } },
  })), true);
  assert.equal(cloud.getSnapshot().revision, 4);
  assert.deepEqual(remoteStates.at(-1), { wallet: { coins: 250 }, packs: { standard: 2 } });
  assert.equal(saveCount, 0);
  cloud.dispose();
});

test('an atomic server reward rebases a local mutation that happens while the claim request is in flight', async () => {
  const storage = memoryStorage();
  const saves = [];
  const remoteStates = [];
  const gateway = {
    async open() {
      return response({
        revision: 3,
        state: { wallet: { coins: 100 }, packs: { standard: 1 }, activity: ['before'] },
      });
    },
    async heartbeat() { return response({ state: null }); },
    async saveState(_token, body) {
      saves.push(body);
      return response({ revision: body.baseRevision + 1, state: null });
    },
    async takeover() { return response({ state: null }); },
    async release() { return response({ state: null }); },
  };
  const cloud = createCloudPlaySession({
    gateway,
    token: 'token',
    accountId: 'mailbox-race',
    storage,
    deviceId: 'device-123456789',
    platform: 'pc',
    appVersion: '0.7.0',
    onRemoteState: (state) => remoteStates.push(state),
  });

  await cloud.open();
  const base = remoteStates.at(-1);
  const reservation = cloud.beginAuthoritativeMutation(base);
  assert.equal(reservation.baseRevision, 3);

  // Simulate a local pack purchase/spend while the mailbox HTTP request is
  // waiting.  The stale revision must remain durable but must not be sent.
  cloud.queueState({
    wallet: { coins: 90 },
    packs: { standard: 0 },
    activity: ['local action'],
  });
  await cloud.flush();
  assert.equal(saves.length, 0);
  assert.equal(cloud.getSnapshot().hasPendingState, true);

  const committed = cloud.commitAuthoritativeMutation(response({
    revision: 4,
    state: { wallet: { coins: 600 }, packs: { standard: 2 }, activity: ['before'] },
  }));
  assert.equal(committed.rebased, true);
  assert.deepEqual(remoteStates.at(-1), {
    wallet: { coins: 590 },
    packs: { standard: 1 },
    activity: ['local action'],
  });
  assert.equal(cloud.getSnapshot().revision, 4);
  assert.equal(cloud.getSnapshot().hasPendingState, true);

  await cloud.flush();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].baseRevision, 4);
  assert.deepEqual(saves[0].state, {
    wallet: { coins: 590 },
    packs: { standard: 1 },
    activity: ['local action'],
  });
  assert.equal(storage.getItem(cloudSaveOutboxKey('mailbox-race')), null);
  cloud.dispose();
});

test('authoritative state merge keeps server values for irreconcilable array conflicts', () => {
  assert.deepEqual(
    mergeAuthoritativeState(
      { pendingPackOpening: ['base'] },
      { pendingPackOpening: ['local'] },
      { pendingPackOpening: ['server'] },
    ),
    { pendingPackOpening: ['server'] },
  );
});
