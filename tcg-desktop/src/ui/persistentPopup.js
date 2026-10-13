// Popup roots live outside the regularly replaced game content. A background
// refresh with the same key must not even detach their DOM: this also keeps IME
// composition, native select menus, focus and CSS animations uninterrupted.
export function createPersistentPopup(host) {
  let lastKey = null;
  let lastIdentity = null;
  return {
    update({ identity, key, render, restoreFocus = true }) {
      if (identity === lastIdentity && key === lastKey) return false;
      const snapshot = identity && identity === lastIdentity ? capturePopupState(host) : null;
      host.innerHTML = identity ? render() : '';
      lastIdentity = identity || null;
      lastKey = key;
      if (snapshot) restorePopupState(host, snapshot, { restoreFocus });
      return true;
    },
  };
}

function elementKey(element, root) {
  if (element === root) return 'root';
  const parts = [];
  let node = element;
  while (node && node !== root) {
    const siblings = [...node.parentElement.children].filter((sibling) => sibling.tagName === node.tagName);
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
    node = node.parentElement;
  }
  return node === root ? parts.join(' > ') : '';
}

function fieldKey(element, root) {
  const form = element.closest('form');
  const name = element.getAttribute('name');
  if (form?.dataset.form && name) return `form:${form.dataset.form}:${name}`;
  return elementKey(element, root);
}

function defaultFieldValue(element) {
  if (element.tagName === 'SELECT') return [...element.options].filter((option) => option.defaultSelected).map((option) => option.value).join('\u0000');
  return element.defaultValue;
}

export function capturePopupState(root) {
  const elements = [...root.querySelectorAll('*')];
  const active = root.ownerDocument.activeElement;
  return {
    fields: elements.filter((node) => /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)).map((node) => ({
      key: fieldKey(node, root), value: node.value, checked: node.checked,
      defaultValue: defaultFieldValue(node), defaultChecked: node.defaultChecked,
    })),
    scroll: [root, ...elements].filter((node) => node.scrollTop || node.scrollLeft).map((node) => ({ key: elementKey(node, root), top: node.scrollTop, left: node.scrollLeft })),
    details: elements.filter((node) => node.tagName === 'DETAILS').map((node) => ({ key: elementKey(node, root), open: node.open })),
    focus: root.contains(active) ? {
      key: fieldKey(active, root), start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection,
    } : null,
  };
}

export function restorePopupState(root, snapshot, { restoreFocus = true } = {}) {
  const elements = [...root.querySelectorAll('*')];
  const find = (key) => key === 'root' ? root : key.startsWith('form:')
    ? elements.find((node) => /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) && fieldKey(node, root) === key)
    : root.querySelector(key);
  for (const saved of snapshot.fields) {
    const node = find(saved.key);
    if (!node) continue;
    // A newly selected package or another intentional model change owns its
    // new default. Uncontrolled fields (including admin login) keep the draft.
    if (defaultFieldValue(node) === saved.defaultValue && node.value !== saved.value) node.value = saved.value;
    if (node.defaultChecked === saved.defaultChecked && typeof saved.checked === 'boolean') node.checked = saved.checked;
  }
  for (const saved of snapshot.details) { const node = find(saved.key); if (node) node.open = saved.open; }
  if (restoreFocus && snapshot.focus) {
    const node = find(snapshot.focus.key);
    if (node && !node.disabled) {
      node.focus({ preventScroll: true });
      if (typeof snapshot.focus.start === 'number' && typeof node.setSelectionRange === 'function') {
        node.setSelectionRange(snapshot.focus.start, snapshot.focus.end, snapshot.focus.direction || 'none');
      }
    }
  }
  for (const saved of snapshot.scroll) {
    const node = find(saved.key);
    if (node) { node.scrollTop = saved.top; node.scrollLeft = saved.left; }
  }
}
