import assert from 'node:assert/strict';
import test from 'node:test';
import { availableSquadSelection, toggleSquadSelection } from '../src/core/squadSelection.js';
import { togglePvpCard } from '../src/core/pvpClient.js';
import { bestAvailableEnhancementForCard } from '../src/core/cardManagement.js';
import { cardById } from '../src/data/cardCatalog.js';
import { characterIdForCard } from '../src/core/cooperativeRaidRules.js';
import { createNavigationSnapshotStore } from '../src/core/navigationSnapshot.js';
import { renderPvpView } from '../src/ui/pvpView.js';
import { renderTowerPanel } from '../src/ui/towerView.js';

const saved = Object.freeze(['winter-c', 'guma-c', 'hoi-c', 'morae-c']);
const options = { identityForId: characterIdForCard };
const entriesFor = ids => ids.map(id => ({ card: cardById(id), enhancement: 0, power: 1000 }));
const reconcile = (ids, available) => availableSquadSelection(ids, available, options);

test('a consumed last copy no longer occupies an invisible PvP slot or prevents queueing', () => {
  const collection = { 'winter-c': 1, 'guma-c': 0, 'hoi-c': 1, 'morae-c': 1, 'peach-c': 1 };
  const available = Object.keys(collection).filter(id => bestAvailableEnhancementForCard(collection, {}, id) >= 0);
  const visible = reconcile(saved, available);
  assert.deepEqual(visible, ['winter-c', 'hoi-c', 'morae-c']);
  const view = selected => renderPvpView({ client: { data: { phase: 'idle' } }, selected, cards: entriesFor(available) });
  assert.match(view(visible), /data-action="pvp-queue" disabled/);
  const selected = togglePvpCard(visible, 'peach-c');
  assert.deepEqual(selected, ['winter-c', 'hoi-c', 'morae-c', 'peach-c']);
  assert.match(view(selected), /대전 덱 · 4 \/ 4/);
  assert.doesNotMatch(view(selected), /data-action="pvp-queue" disabled/);
  assert.deepEqual(saved, ['winter-c', 'guma-c', 'hoi-c', 'morae-c']);
});

test('an expedition-locked middle tower slot is removed without replacing another valid card', () => {
  const collection = Object.fromEntries([...saved, 'peach-c'].map(id => [id, 1]));
  const available = Object.keys(collection).filter(id => bestAvailableEnhancementForCard(collection, {}, id, ['guma-c']) >= 0);
  const selected = toggleSquadSelection(reconcile(saved, available), 'peach-c', options);
  assert.deepEqual(selected, ['winter-c', 'hoi-c', 'morae-c', 'peach-c']);
  const html = renderTowerPanel({ client: { data: { seasonKey: '2026-10', floor: 1, clearedFloor: 0, augments: [], nextBoss: { maxHp: 100000 } } }, selected, cards: entriesFor(available) });
  assert.match(html, /원정대 4 \/ 4/);
  assert.doesNotMatch(html, /data-action="tower-enter" disabled/);
  // A second owned copy remains selectable while the first is on an expedition.
  collection['guma-c'] = 2;
  const withSpare = Object.keys(collection).filter(id => bestAvailableEnhancementForCard(collection, {}, id, ['guma-c']) >= 0);
  assert.deepEqual(reconcile(saved, withSpare), [...saved]);
});

test('reconciled account-local decks survive restart while battle snapshots are never persisted', () => {
  const values = new Map();
  const navigation = createNavigationSnapshotStore({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  navigation.save('player-a', { view: 'pvp', pvp: { selected: [...saved] }, tower: { selected: [...saved] }, scroll: { 'pvp:deck': { top: 725 } } });
  const restored = navigation.read('player-a');
  const available = ['winter-c', 'hoi-c', 'morae-c', 'peach-c'];
  restored.pvp.selected = togglePvpCard(reconcile(restored.pvp.selected, available), 'peach-c');
  restored.tower.selected = toggleSquadSelection(reconcile(restored.tower.selected, available), 'peach-c', options);
  const battle = Object.freeze({ cards: saved.map(cardId => Object.freeze({ cardId, hp: 35, enhancement: 5 })) });
  navigation.save('player-a', { ...restored, pvp: { ...restored.pvp, battle }, tower: { ...restored.tower, battle } });
  const next = navigation.read('player-a');
  assert.deepEqual(next.pvp.selected, available);
  assert.deepEqual(next.tower.selected, available);
  assert.equal(next.scroll['pvp:deck'].top, 725);
  assert.equal(next.pvp.battle, undefined);
  assert.equal(next.tower.battle, undefined);
  assert.deepEqual(battle.cards.map(card => card.cardId), [...saved]);
  assert.ok(battle.cards.every(card => card.hp === 35 && card.enhancement === 5));
  assert.equal(navigation.read('player-b'), null);
});

test('unavailable saved rarities cannot suppress a valid copy of the same character', () => {
  const stale = Object.freeze(['winter-c', 'guma-c', 'hoi-c', 'morae-c', 'winter-ur', 'peach-c']);
  assert.deepEqual(reconcile(stale, ['winter-ur', 'hoi-c', 'morae-c', 'peach-c']), ['hoi-c', 'morae-c', 'winter-ur', 'peach-c']);
  assert.deepEqual(reconcile(['winter-ur', 'winter-c', 'hoi-c'], ['winter-ur', 'winter-c', 'hoi-c']), ['winter-ur', 'hoi-c']);
});
