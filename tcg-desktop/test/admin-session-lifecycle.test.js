import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const handlersSource = source.slice(source.indexOf('function captureAdminRequest('), source.indexOf('async function finishCloudActivation('));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const adminState = (token = '') => ({ token, loading: false, sending: false, users: [], packages: [], error: '', draft: {}, pendingMailRequest: null });

function fixture(overrides = {}) {
  const calls = { renders: 0, notices: [], logins: 0 };
  const context = {
    authenticationEpoch: 1,
    ui: { auth: { phase: 'authenticated' }, admin: adminState('original-token') },
    render: () => { calls.renders++; },
    showNotice: (...args) => { calls.notices.push(args); },
    formatNumber: String,
    FormData: class extends Map { constructor(form = {}) { super(Object.entries(form)); } },
    adminMailRewards: (data) => ({ coins: Number(data.get('coins')) || 0 }),
    loadTcgAdminUsers: async () => ({ users: [{ id: 'local-user' }] }),
    loadTcgAdminGrantCatalog: async () => ({ packages: [{ id: 'custom' }] }),
    loginTcgAdmin: async () => { calls.logins++; return { token: 'admin-token' }; },
    sendTcgAdminMail: async () => ({ newlyDeliveredCount: 1 }),
    ...overrides,
  };
  runInNewContext(`${handlersSource}\nglobalThis.handlers = { loadAdminUsers, submitAdminLogin, submitAdminMail };`, context);
  return { context, calls, handlers: context.handlers };
}

test('late administrator login cannot restore a token after the game account changes', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ loginTcgAdmin: () => response.promise });
  context.ui.admin.token = '';
  const request = handlers.submitAdminLogin({ username: 'local-admin', password: 'local-password' });
  const replacement = adminState('new-account-admin'); replacement.loading = true; replacement.error = 'keep-new-state';
  context.authenticationEpoch++;
  context.ui.admin = replacement;
  const renderCount = calls.renders;
  response.resolve({ token: 'old-account-admin' });
  await request;
  assert.equal(context.ui.admin, replacement);
  assert.equal(replacement.token, 'new-account-admin');
  assert.equal(replacement.loading, true);
  assert.equal(replacement.error, 'keep-new-state');
  assert.equal(replacement.users.length, 0);
  assert.equal(calls.renders, renderCount);
});

test('administrator logout invalidates a delayed login error even in the same game account', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ loginTcgAdmin: () => response.promise });
  context.ui.admin.token = '';
  const request = handlers.submitAdminLogin({ username: 'local-admin', password: 'local-password' });
  context.ui.admin = adminState();
  const renderCount = calls.renders;
  response.reject(new Error('old request failed'));
  await request;
  assert.equal(context.ui.admin.error, '');
  assert.equal(calls.renders, renderCount);
});

test('a delayed user/catalog response never populates a replacement administrator session', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ loadTcgAdminUsers: () => response.promise });
  const request = handlers.loadAdminUsers();
  context.ui.admin = adminState('new-admin-token');
  context.ui.admin.loading = true;
  const renderCount = calls.renders;
  response.resolve({ users: [{ id: 'previous-account-data' }] });
  assert.equal(await request, false);
  assert.equal(context.ui.admin.users.length, 0);
  assert.equal(context.ui.admin.packages.length, 0);
  assert.equal(context.ui.admin.loading, true);
  assert.equal(calls.renders, renderCount);
});

test('an old authorization failure cannot clear a newly issued admin credential', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ loadTcgAdminUsers: () => response.promise });
  const request = handlers.loadAdminUsers();
  context.ui.admin.token = 'renewed-admin-token';
  const renderCount = calls.renders;
  response.reject(Object.assign(new Error('expired old token'), { status: 401 }));
  assert.equal(await request, false);
  assert.equal(context.ui.admin.token, 'renewed-admin-token');
  assert.equal(context.ui.admin.error, '');
  assert.equal(context.ui.admin.loading, true);
  assert.equal(calls.renders, renderCount);
});

test('late mail success cannot clear the new account request or display a misleading notice', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ sendTcgAdminMail: () => response.promise });
  const request = handlers.submitAdminMail({ target: 'all', title: 'local-only', coins: '5' });
  context.authenticationEpoch++;
  context.ui.admin = adminState('new-token');
  const pending = { requestId: 'new-mail' };
  context.ui.admin.pendingMailRequest = pending;
  context.ui.admin.sending = true;
  const renderCount = calls.renders;
  response.resolve({ newlyDeliveredCount: 100 });
  await request;
  assert.equal(context.ui.admin.pendingMailRequest, pending);
  assert.equal(context.ui.admin.sending, true);
  assert.equal(calls.notices.length, 0);
  assert.equal(calls.renders, renderCount);
});

test('a mail error after administrator logout cannot modify the replacement session', async () => {
  const response = deferred();
  const { context, calls, handlers } = fixture({ sendTcgAdminMail: () => response.promise });
  const request = handlers.submitAdminMail({ target: 'all', title: 'local-only', coins: '5' });
  context.ui.admin = adminState('replacement-token');
  const renderCount = calls.renders;
  response.reject(Object.assign(new Error('old mail rejected'), { status: 403 }));
  await request;
  assert.equal(context.ui.admin.token, 'replacement-token');
  assert.equal(context.ui.admin.error, '');
  assert.equal(calls.renders, renderCount);
});

test('a current login still loads its user/catalog data and releases the spinner', async () => {
  const { context, handlers } = fixture();
  context.ui.admin.token = '';
  await handlers.submitAdminLogin({ username: 'local-admin', password: 'local-password' });
  assert.equal(context.ui.admin.token, 'admin-token');
  assert.equal(context.ui.admin.users[0].id, 'local-user');
  assert.equal(context.ui.admin.packages[0].id, 'custom');
  assert.equal(context.ui.admin.loading, false);
});

test('a current expired credential clears its token and both request spinners correctly', async () => {
  for (const operation of ['loadAdminUsers', 'submitAdminMail']) {
    const reject = async () => { throw Object.assign(new Error('current credential expired'), { status: 401 }); };
    const { context, handlers } = fixture({ loadTcgAdminUsers: reject, sendTcgAdminMail: reject });
    await handlers[operation]({ target: 'all', title: 'local-only' });
    assert.equal(context.ui.admin.token, '');
    assert.equal(context.ui.admin.loading, false);
    assert.equal(context.ui.admin.sending, false);
    assert.equal(context.ui.admin.error, 'current credential expired');
  }
});

test('multiple submits during a pending admin login make only one authentication request', async () => {
  const response = deferred(); let requests = 0;
  const { context, handlers } = fixture({ loginTcgAdmin: () => { requests++; return response.promise; } });
  context.ui.admin.token = '';
  const first = handlers.submitAdminLogin({ username: 'local-admin', password: 'local-password' });
  await handlers.submitAdminLogin({ username: 'another-admin', password: 'another-password' });
  assert.equal(requests, 1);
  response.resolve({ token: 'admin-token' });
  await first;
});
