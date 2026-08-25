'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../../public/v2/login-bootstrap.js'),
  'utf8'
);
const appSource = fs.readFileSync(path.join(__dirname, '../../public/v2/app.js'), 'utf8');
const routes = fs.readFileSync(
  path.join(__dirname, '../../src/v2/registerV2Routes.js'),
  'utf8'
);

function createLoginHarness(response) {
  const listeners = new Map();
  const storage = new Map();
  const submitButton = { disabled: false };
  const form = {
    dataset: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    querySelector() {
      return submitButton;
    }
  };
  const elements = {
    loginForm: form,
    loginStatus: { textContent: '' },
    username: { value: ' employee01 ' },
    password: { value: 'password123' }
  };
  let reloadCount = 0;
  let request = null;
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    fetch: async (url, options) => {
      request = { url, options };
      return response;
    },
    localStorage: {
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    window: {
      location: {
        reload() {
          reloadCount += 1;
        }
      }
    }
  });
  vm.runInContext(source, context);
  return {
    elements,
    form,
    listeners,
    storage,
    submitButton,
    get reloadCount() { return reloadCount; },
    get request() { return request; }
  };
}

test('login bootstrap authenticates independently from the main game script', async () => {
  const harness = createLoginHarness({
    ok: true,
    json: async () => ({
      token: 'token-123',
      isAdmin: false,
      displayName: '사원01'
    })
  });
  let prevented = false;

  await harness.listeners.get('submit')({ preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(harness.request.url, '/api/v2/login');
  assert.deepEqual(
    JSON.parse(harness.request.options.body),
    { username: 'employee01', password: 'password123' }
  );
  assert.equal(harness.storage.get('v2Token'), 'token-123');
  assert.equal(harness.storage.get('v2DisplayName'), '사원01');
  assert.equal(harness.reloadCount, 1);
});

test('login bootstrap keeps entered credentials and restores the button after rejection', async () => {
  const harness = createLoginHarness({
    ok: false,
    json: async () => ({ msg: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  });

  await harness.listeners.get('submit')({ preventDefault() {} });

  assert.equal(harness.elements.username.value, ' employee01 ');
  assert.equal(harness.elements.password.value, 'password123');
  assert.equal(harness.elements.loginStatus.textContent, '아이디 또는 비밀번호가 올바르지 않습니다.');
  assert.equal(harness.form.dataset.loginPending, 'false');
  assert.equal(harness.submitButton.disabled, false);
  assert.equal(harness.reloadCount, 0);
});

test('workspace load failures only clear a genuinely invalid login token', () => {
  const restoreLogin = appSource.match(/async function restoreLogin[\s\S]*?\n}\n/)?.[0] || '';
  assert.match(restoreLogin, /\[401, 403, 410\]/);
  assert.match(restoreLogin, /if \(!\[401, 403, 410\]\.includes/);
  assert.match(restoreLogin, /clearLoginState\(\)/);
});

test('V2-only accounts can load without a surviving legacy user row', () => {
  const previewRoute = routes.match(
    /app\.get\('\/api\/v2\/migration\/preview'[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(previewRoute, /V2Account\.findOne\(\{ sourceUserId: auth\.id \}\)/);
  assert.match(previewRoute, /preview: user \? buildMigrationPreview\(user\)/);
  assert.doesNotMatch(previewRoute, /if \(!user\) return res\.status\(404\)/);
});
