import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameStore, hydrateState } from '../src/core/gameState.js';
import { availableRaidSquad, toggleSquadSelection } from '../src/core/squadSelection.js';

test('clicking a selected card removes it and clicking an unselected card adds it', () => {
  assert.deepEqual(toggleSquadSelection(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(toggleSquadSelection(['a'], 'b'), ['a', 'b']);
});

test('a full squad replaces its oldest card while preserving a maximum of four', () => {
  assert.deepEqual(toggleSquadSelection(['a', 'b', 'c', 'd'], 'e'), ['b', 'c', 'd', 'e']);
});

test('cards deployed on an expedition cannot enter the available raid squad', () => {
  const expedition = { squad: ['b', 'c'] };
  assert.deepEqual(toggleSquadSelection(['a'], 'b', { unavailableIds: expedition.squad }), ['a']);
  assert.deepEqual(availableRaidSquad(['a', 'b', 'c'], expedition), ['a']);
  assert.deepEqual(
    availableRaidSquad(['a', 'b', 'c'], expedition, { a: 1, b: 2, c: 1 }),
    ['a', 'b'],
  );
});

test('one deck never contains the same card kind twice', () => {
  assert.deepEqual(toggleSquadSelection(['a', 'a', 'b'], 'c'), ['a', 'b', 'c']);
  assert.deepEqual(availableRaidSquad(['a', 'a', 'b'], null, { a: 2, b: 1 }), ['a', 'b']);
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

test('different rarities of the same character replace each other in adventure and raid squads', () => {
  const identity = (cardId) => cardId.split('-')[0];
  assert.deepEqual(
    toggleSquadSelection(['winter-c', 'guma-c'], 'winter-sr', { identityForId: identity }),
    ['winter-sr', 'guma-c'],
  );
  assert.deepEqual(
    availableRaidSquad(
      ['winter-c', 'winter-sr', 'guma-c'],
      null,
      { 'winter-c': 1, 'winter-sr': 1, 'guma-c': 1 },
      { identityForId: identity },
    ),
    ['winter-c', 'guma-c'],
  );
});

test('saved squads discard later cards belonging to an already selected character', () => {
  const hydrated = hydrateState({
    collection: { 'winter-c': 1, 'winter-sr': 1, 'guma-c': 1 },
    selectedExpeditionSquad: ['winter-c', 'winter-sr', 'guma-c'],
    selectedRaidSquad: ['winter-sr', 'winter-c', 'guma-c'],
  });
  assert.deepEqual(hydrated.selectedExpeditionSquad, ['winter-c', 'guma-c']);
  assert.deepEqual(hydrated.selectedRaidSquad, ['winter-sr', 'guma-c']);
});
