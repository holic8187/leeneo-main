import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameStore, hydrateState } from '../src/core/gameState.js';
import { availableRaidSquad, toggleSquadSelection } from '../src/core/squadSelection.js';

test('clicking a selected card removes it and clicking an unselected card adds it', () => {
  assert.deepEqual(toggleSquadSelection(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(toggleSquadSelection(['a'], 'b'), ['a', 'b']);
});

test('a full squad replaces its oldest card while preserving a maximum of three', () => {
  assert.deepEqual(toggleSquadSelection(['a', 'b', 'c'], 'd'), ['b', 'c', 'd']);
});

test('cards deployed on an expedition cannot enter the available raid squad', () => {
  const expedition = { squad: ['b', 'c'] };
  assert.deepEqual(toggleSquadSelection(['a'], 'b', { unavailableIds: expedition.squad }), ['a']);
  assert.deepEqual(availableRaidSquad(['a', 'b', 'c'], expedition), ['a']);
});

test('raid and expedition squads migrate separately and the raid selection survives a restart', () => {
  const migrated = hydrateState({
    collection: { 'simsim-c': 1, 'winter-c': 1 },
    selectedSquad: ['simsim-c', 'winter-c'],
  });
  assert.deepEqual(migrated.selectedExpeditionSquad, ['simsim-c', 'winter-c']);
  assert.deepEqual(migrated.selectedRaidSquad, ['simsim-c', 'winter-c']);

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const first = createGameStore(storage, { userId: 'persistent-user' });
  first.update((draft) => {
    draft.selectedRaidSquad = ['winter-c'];
    draft.selectedExpeditionSquad = ['simsim-c'];
  });
  const restored = createGameStore(storage, { userId: 'persistent-user' }).getState();
  assert.deepEqual(restored.selectedRaidSquad, ['winter-c']);
  assert.deepEqual(restored.selectedExpeditionSquad, ['simsim-c']);
});
