import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationSnapshotStore, navigationSnapshotKey, sanitizeNavigationSnapshot } from '../src/core/navigationSnapshot.js';
import { RARITY_ORDER } from '../src/data/cardCatalog.js';
const memory = () => { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test('last screen, filters, safe modal and scroll are isolated by account', () => {
  const store = createNavigationSnapshotStore(memory());
  store.save('A', { view: 'collection', rarityFilter: 'hr', modal: { type: 'card', cardId: 'hoi-ur' }, scroll: { 'view:collection:main:0': { top: 415, left: 0 } } });
  store.save('B', { view: 'raid', raidMode: 'cooperative', raidPanel: 'ranking' });
  assert.equal(store.read('A').view, 'collection'); assert.equal(store.read('A').rarityFilter, 'hr');
  assert.equal(store.read('A').scroll['view:collection:main:0'].top, 415);
  assert.equal(store.read('B').view, 'raid'); assert.equal(store.read('B').modal, null); assert.equal(store.read('C'), null);
});

test('navigation never persists credentials, administrative forms, rewards or simulated battle', () => {
  const state = sanitizeNavigationSnapshot({ view: 'admin', auth: { token: 'secret' }, admin: { token: 'adminsecret' }, raid: { battle: { hp: 900 } }, wallet: { coins: 9999 }, modal: { type: 'result', reward: { coins: 9999 } }, scroll: { 'auth:form:0': { top: 100 }, 'modal:admin:sheet:0': { top: 500 } } });
  assert.equal(state.view, 'dashboard'); assert.equal(state.modal, null); assert.deepEqual(state.scroll, {});
  for (const key of ['auth', 'admin', 'raid', 'wallet']) assert.equal(state[key], undefined);
});

test('pack restoration contains only identity and focus, not acquisitions or reveal authority', () => {
  const state = sanitizeNavigationSnapshot({ modal: { type: 'pack', openingId: 'opening', focusIndex: 42, revealedCards: [1], cards: [{ id: 'hoi-ssr' }], pendingOpening: false } });
  assert.deepEqual(state.modal, { type: 'pack', openingId: 'opening', focusIndex: 42 });
});

test('all catalog rarities and unsaved deck selections survive safe serialization', () => {
  for (const rarity of RARITY_ORDER) assert.equal(sanitizeNavigationSnapshot({ rarityFilter: rarity }).rarityFilter, rarity);
  for (const rarity of RARITY_ORDER.slice(0, -1)) assert.equal(sanitizeNavigationSnapshot({ synthesisRarity: rarity }).synthesisRarity, rarity);
  const { modal } = sanitizeNavigationSnapshot({ modal: { type: 'deck-preset', slot: 2, cardIds: ['hoi-ur', 'winter-ur'], equipmentCardId: 'armor', artifactCardId: 'luxury-bag', saveCopy: true } });
  assert.deepEqual(modal.cardIds, ['hoi-ur', 'winter-ur']); assert.equal(modal.slot, 2); assert.equal(modal.saveCopy, true);
});

test('malformed or oversized snapshots fail safely and missing identity cannot write', () => {
  const storage = memory(); const store = createNavigationSnapshotStore(storage);
  storage.setItem(navigationSnapshotKey('a'), '{invalid'); assert.equal(store.read('a'), null);
  storage.setItem(navigationSnapshotKey('a'), 'x'.repeat(24001)); assert.equal(store.read('a'), null);
  assert.equal(store.save('', {}), false);
});
