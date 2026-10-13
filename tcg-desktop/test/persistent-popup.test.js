import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistentPopup } from '../src/ui/persistentPopup.js';
import { createPopupQueue } from '../src/core/popupQueue.js';

// A small DOM contract double lets Node exercise the real popup renderer and
// form/selection restoration without a browser or a production account.
function fixture() {
  const document = { activeElement: null };
  function element(tag, attributes = {}, children = []) {
    const node = {
      tagName: tag.toUpperCase(), ownerDocument: document, attributes, children,
      dataset: attributes['data-form'] ? { form: attributes['data-form'] } : {},
      defaultValue: attributes.value || '', value: attributes.value || '',
      defaultChecked: Boolean(attributes.checked), checked: Boolean(attributes.checked),
      scrollTop: 0, scrollLeft: 0, open: false,
      selectionStart: null, selectionEnd: null, selectionDirection: null,
      getAttribute(name) { return this.attributes[name] ?? null; },
      closest(selector) { return this.tagName.toLowerCase() === selector ? this : this.parentElement?.closest(selector) || null; },
      contains(child) { return child === this || this.children.some((item) => item.contains(child)); },
      querySelectorAll(selector) {
        assert.equal(selector, '*');
        return this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
      },
      querySelector(selector) {
        let parent = this;
        for (const segment of selector.split(' > ')) {
          const [, name, index] = segment.match(/^(\w+):nth-of-type\((\d+)\)$/) || [];
          parent = parent?.children.filter((child) => child.tagName === name?.toUpperCase())[Number(index) - 1];
        }
        return parent || null;
      },
      focus() { document.activeElement = this; },
      setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
    };
    for (const child of children) child.parentElement = node;
    return node;
  }
  const host = element('div');
  let writes = 0;
  Object.defineProperty(host, 'innerHTML', { set(markup) {
    writes++;
    if (host.contains(document.activeElement)) document.activeElement = null;
    const authenticated = markup.startsWith('mail');
    host.children = markup ? [element('section', {}, [
      element('form', { 'data-form': authenticated ? 'admin-mail' : 'admin-login' }, [
        element('input', { name: authenticated ? 'title' : 'username', value: markup === 'mail-preset' ? '기념 패키지' : '' }),
        element(authenticated ? 'textarea' : 'input', { name: authenticated ? 'message' : 'password' }),
      ]),
      element('details'),
    ])] : [];
    for (const child of host.children) child.parentElement = host;
  } });
  const fields = () => host.querySelectorAll('*').filter((node) => ['INPUT', 'TEXTAREA'].includes(node.tagName));
  return { document, host, fields, writes: () => writes, renderer: createPersistentPopup(host) };
}

test('periodic refreshes keep the exact popup DOM, unfinished input, selection and scroll', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  const [username, password] = page.fields();
  username.value = '운영자 입력 중'; password.value = 'unfinished-password';
  username.focus(); username.setSelectionRange(2, 7, 'backward');
  page.host.children[0].scrollTop = 270;
  for (let poll = 0; poll < 40; poll++) {
    assert.equal(page.renderer.update({ identity: 'admin', key: 'login', render: () => { throw new Error('A poll must not re-render this popup'); } }), false);
  }
  assert.equal(page.writes(), 1);
  assert.equal(page.fields()[0], username);
  assert.equal(page.document.activeElement, username);
  assert.equal(username.value, '운영자 입력 중');
  assert.equal(password.value, 'unfinished-password');
  assert.deepEqual([username.selectionStart, username.selectionEnd, username.selectionDirection], [2, 7, 'backward']);
  assert.equal(page.host.children[0].scrollTop, 270);
});

test('an asynchronous login error retains credentials, cursor, scroll and expanded sections', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  const [username, password] = page.fields();
  username.value = 'local-admin'; password.value = 'typed-secret';
  password.focus(); password.setSelectionRange(2, 5, 'forward');
  page.host.children[0].scrollTop = 120;
  page.host.children[0].children[1].open = true;
  page.renderer.update({ identity: 'admin', key: 'login-error', render: () => 'login-error' });
  const [nextUsername, nextPassword] = page.fields();
  assert.equal(nextUsername.value, 'local-admin');
  assert.equal(nextPassword.value, 'typed-secret');
  assert.equal(page.document.activeElement, nextPassword);
  assert.deepEqual([nextPassword.selectionStart, nextPassword.selectionEnd, nextPassword.selectionDirection], [2, 5, 'forward']);
  assert.equal(page.host.children[0].scrollTop, 120);
  assert.equal(page.host.children[0].children[1].open, true);
});

test('login-to-mail transition does not copy credentials into another form', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  page.fields()[0].value = 'admin'; page.fields()[1].value = 'secret';
  page.renderer.update({ identity: 'admin', key: 'authenticated', render: () => 'mail' });
  assert.deepEqual(page.fields().map((field) => field.value), ['', '']);
});

test('intentional preset defaults replace controlled values while other unsaved text survives', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'mail', render: () => 'mail' });
  page.fields()[0].value = '이전 제목'; page.fields()[1].value = '계속 작성 중인 본문';
  page.renderer.update({ identity: 'admin', key: 'preset', render: () => 'mail-preset' });
  assert.deepEqual(page.fields().map((field) => field.value), ['기념 패키지', '계속 작성 중인 본문']);
});

test('closing or switching an account drops the popup DOM and never restores its secret draft', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  page.fields()[1].value = 'discard-this-secret';
  page.renderer.update({ identity: null, key: '', render: () => { throw new Error('Closed popup must not render'); } });
  assert.equal(page.host.children.length, 0);
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  assert.equal(page.fields()[1].value, '');
});

test('a security gate suppresses focus restoration into the inaccessible game', () => {
  const page = fixture();
  page.renderer.update({ identity: 'admin', key: 'login', render: () => 'login' });
  page.fields()[0].focus();
  page.renderer.update({ identity: 'admin', key: 'error', render: () => 'login-error', restoreFocus: false });
  assert.equal(page.document.activeElement, null);
});

test('adventure and raid completion wait behind any open popup and remain FIFO', () => {
  const queue = createPopupQueue();
  const adventure = { type: 'result', message: '모험 보상' };
  const raid = { type: 'result', message: '레이드 보상' };
  assert.equal(queue.enqueue(adventure, 'adventure:1'), true);
  assert.equal(queue.enqueue(adventure, 'adventure:1'), false);
  queue.enqueue(raid, 'raid:1');
  for (let tick = 0; tick < 20; tick++) assert.equal(queue.take({ busy: true }), null);
  assert.equal(queue.size, 2);
  assert.equal(queue.take({ allowed: false }), null);
  assert.equal(queue.take(), adventure);
  assert.equal(queue.take({ busy: true }), null);
  assert.equal(queue.take(), raid);
  assert.equal(queue.take(), null);
});

test('completion notices cannot leak to the next account after logout', () => {
  const queue = createPopupQueue();
  queue.enqueue({ type: 'result', message: 'previous account' }, 'one');
  queue.clear();
  assert.equal(queue.size, 0);
  assert.equal(queue.take(), null);
});
