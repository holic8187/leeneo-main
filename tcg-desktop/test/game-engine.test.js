import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ALL_CARDS,
  CARD_CATALOG,
  EXPEDITIONS,
  LEGACY_CARDS,
  PACK_DEFINITION,
  RAID_DEFINITION,
  RARITY_META,
  RARITY_ORDER,
  cardById,
} from '../src/data/cardCatalog.js';
import { addCardsToCollection, openPack, rollWeightedRarity } from '../src/core/packEngine.js';
import {
  calculateSquadScore,
  settleExpedition,
  startExpedition,
} from '../src/core/expeditionEngine.js';
import { createRaidState, dispatchRaid } from '../src/core/raidEngine.js';
import {
  STORAGE_KEY,
  createDefaultState,
  createGameStore,
  hydrateState,
} from '../src/core/gameState.js';

const rarityCounts = { c: 24, u: 16, r: 12, rr: 8, rrr: 6, sr: 4, hr: 3, ur: 2, ssr: 1 };
const powerRanges = {
  c: [1800, 2999],
  u: [3200, 4499],
  r: [4800, 6299],
  rr: [6600, 7999],
  rrr: [8200, 9299],
  sr: [9500, 10999],
  hr: [11500, 12999],
  ur: [13600, 15499],
  ssr: [16500, 18000],
};

const rankOf = (rarity) => RARITY_ORDER.indexOf(rarity);

test('catalog contains 76 unique cards in the requested nine-rarity distribution', () => {
  assert.equal(CARD_CATALOG.length, 76);
  assert.equal(new Set(CARD_CATALOG.map((card) => card.id)).size, 76);
  assert.deepEqual(RARITY_ORDER, Object.keys(rarityCounts));
  assert.deepEqual(
    Object.fromEntries(RARITY_ORDER.map((rarity) => [
      rarity,
      CARD_CATALOG.filter((card) => card.rarity === rarity).length,
    ])),
    rarityCounts,
  );

  for (const card of CARD_CATALOG) {
    assert.match(card.image, /^\.\/assets\/cards\/[a-z0-9-]+\.webp$/);
  }
});

test('rarity combat-power bands are exact, ascending, and non-overlapping', () => {
  RARITY_ORDER.forEach((rarity, index) => {
    const [minimum, maximum] = powerRanges[rarity];
    assert.deepEqual(RARITY_META[rarity].powerRange, [minimum, maximum]);
    if (index > 0) assert.ok(minimum > powerRanges[RARITY_ORDER[index - 1]][1]);

    for (const card of CARD_CATALOG.filter((candidate) => candidate.rarity === rarity)) {
      assert.ok(card.combatPower >= minimum && card.combatPower <= maximum, card.id);
      assert.equal(
        Object.values(card.stats).reduce((sum, value) => sum + value, 0),
        Math.round(card.combatPower / 100),
        card.id,
      );
    }
  });
});

test('legacy cards remain readable without entering the 76-card collectible catalog', () => {
  assert.equal(LEGACY_CARDS.length, 8);
  assert.equal(ALL_CARDS.length, 84);
  assert.equal(CARD_CATALOG.some((card) => card.id === 'rookie-analyst'), false);
  assert.equal(cardById('rookie-analyst')?.legacy, true);
  assert.equal(cardById('hoi-ssr')?.rarity, 'ssr');
});

test('standard pack uses the exact weights and guarantees U or better', () => {
  assert.deepEqual(PACK_DEFINITION.standard.weights, {
    c: 55,
    u: 25,
    r: 12,
    rr: 5,
    rrr: 2,
    sr: 0.7,
    hr: 0.22,
    ur: 0.07,
    ssr: 0.01,
  });
  assert.equal(PACK_DEFINITION.standard.guaranteedRarity, 'u');

  const result = openPack({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: 0,
    random: () => 0,
  });

  assert.equal(result.cards.length, 5);
  assert.ok(result.cards.some((card) => rankOf(card.rarity) >= rankOf('u')));
  assert.equal(result.nextPity, 1);
  assert.equal(result.pityTriggered, false);
});

test('weighted rarity roll preserves the very small SSR interval', () => {
  assert.equal(rollWeightedRarity(PACK_DEFINITION.standard.weights, () => 0), 'c');
  assert.equal(rollWeightedRarity(PACK_DEFINITION.standard.weights, () => 0.55), 'u');
  assert.equal(rollWeightedRarity(PACK_DEFINITION.standard.weights, () => 0.99995), 'ssr');
});

test('SR pity activates on the fiftieth dry pack and resets the counter', () => {
  assert.equal(PACK_DEFINITION.standard.pityPacks, 50);
  assert.equal(PACK_DEFINITION.standard.pityRarity, 'sr');

  const dry = openPack({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: 48,
    random: () => 0,
  });
  assert.equal(dry.nextPity, 49);
  assert.equal(dry.pityTriggered, false);

  const pity = openPack({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: 49,
    random: () => 0,
  });
  assert.ok(pity.cards.some((card) => rankOf(card.rarity) >= rankOf('sr')));
  assert.equal(pity.nextPity, 0);
  assert.equal(pity.pityTriggered, true);
});

test('a naturally rolled SR or better resets pity without reporting a forced pull', () => {
  const result = openPack({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: 12,
    random: () => 0.995,
  });
  assert.equal(result.nextPity, 0);
  assert.equal(result.pityTriggered, false);
});

test('opened duplicates add to existing collection counts', () => {
  const cards = [CARD_CATALOG[0], CARD_CATALOG[0], CARD_CATALOG[2]];
  const collection = addCardsToCollection({ 'simsim-c': 2 }, cards);

  assert.equal(collection['simsim-c'], 4);
  assert.equal(collection['kkamdung-c'], 1);
});

test('expedition uses normalized combat power and settles rewards after its timer', () => {
  const state = createDefaultState(1000);
  const mission = EXPEDITIONS[0];
  const expectedScore = state.selectedExpeditionSquad.reduce((sum, id) => (
    sum + Math.round(cardById(id).combatPower)
  ), 0);
  const score = calculateSquadScore(state.selectedExpeditionSquad, state.collection, CARD_CATALOG);
  const expedition = startExpedition({
    mission,
    cardIds: state.selectedExpeditionSquad,
    collection: state.collection,
    catalog: CARD_CATALOG,
    now: 2000,
  });

  assert.equal(score, expectedScore);
  assert.equal(expedition.score, expectedScore);
  assert.equal(expedition.endsAt, 2000 + mission.durationMs);

  const rolls = [0, 0.5, 0];
  const result = settleExpedition({
    expedition,
    mission,
    now: expedition.endsAt,
    random: () => rolls.shift(),
  });
  assert.equal(result.success, true);
  assert.ok(result.coins >= mission.reward.coins[0]);
  assert.equal(result.packs, 1);
});

test('legacy cards are converted to the current combat-power scale', () => {
  const legacy = cardById('rookie-analyst');
  const score = calculateSquadScore(
    [legacy.id],
    { [legacy.id]: 1 },
    ALL_CARDS,
  );
  assert.equal(score, Object.values(legacy.stats).reduce((sum, value) => sum + value, 0) * 100);
});

test('raid dispatch records damage and enforces dispatch cooldown', () => {
  const raid = createRaidState(RAID_DEFINITION, 1000);
  const first = dispatchRaid({
    raid,
    squadScore: 200,
    definition: RAID_DEFINITION,
    now: 2000,
    random: () => 0.5,
  });

  assert.ok(first.damage > 0);
  assert.equal(first.raid.contribution, first.damage);
  assert.throws(() => dispatchRaid({
    raid: first.raid,
    squadScore: 200,
    definition: RAID_DEFINITION,
    now: 2001,
    random: () => 0.5,
  }), /재정비/);
});

test('saved state hydration preserves legacy squads and migrates incident fields', () => {
  const hydrated = hydrateState({
    version: 1,
    wallet: { coins: 99 },
    collection: { 'pantry-cat': 2 },
    selectedSquad: ['pantry-cat', 'missing-card', 'pantry-cat'],
    activeIncident: { id: 'coffee-order', arrivedAt: 4000 },
    completedInstanceIds: ['done-1', 'done-1'],
    recentIncidentIds: ['coffee-order', 'boss-footsteps', 'coffee-order'],
    incidentScheduled: true,
    resolvedIncidents: 3,
  }, 5000);

  assert.equal(hydrated.version, 3);
  assert.equal(hydrated.wallet.coins, 99);
  assert.equal(hydrated.wallet.linkPoints, 0);
  assert.deepEqual(hydrated.selectedSquad, ['pantry-cat']);
  assert.deepEqual(hydrated.selectedExpeditionSquad, ['pantry-cat']);
  assert.deepEqual(hydrated.selectedRaidSquad, ['pantry-cat']);
  assert.deepEqual(hydrated.activeIncident, {
    id: 'coffee-order',
    instanceId: 'legacy-coffee-order-4000',
    arrivedAt: 4000,
  });
  assert.deepEqual(hydrated.completedIncidentInstanceIds, ['done-1']);
  assert.deepEqual(hydrated.recentIncidentIds, ['coffee-order', 'boss-footsteps']);
  assert.equal(hydrated.nextIncidentAt, null);
  assert.equal(hydrated.pendingIncident, true);
  assert.equal(hydrated.resolvedIncidents, 3);
});

test('store updates and flushes surface storage failures without changing memory state', () => {
  const storageError = new Error('disk full');
  const storage = {
    getItem: () => null,
    setItem: () => { throw storageError; },
  };
  const store = createGameStore(storage);
  const before = store.getState();
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });

  assert.throws(() => store.update((draft) => {
    draft.wallet.coins = 0;
  }), /disk full/);
  assert.deepEqual(store.getState(), before);
  assert.equal(notifications, 0);
  assert.throws(() => store.flush(), /disk full/);
});

test('successful store updates persist the committed state', () => {
  let persisted = null;
  const storage = {
    getItem: () => null,
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      persisted = JSON.parse(value);
    },
  };
  const store = createGameStore(storage);
  const result = store.update((draft) => {
    draft.wallet.coins = 321;
  });

  assert.equal(result.wallet.coins, 321);
  assert.equal(store.getState().wallet.coins, 321);
  assert.equal(store.getState().nextIncidentAt, null);
  assert.equal(persisted.wallet.coins, 321);
});

test('art manifest records both supplied reference sheets and the approved invented 멍프', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/art-manifest.json', import.meta.url), 'utf8'));
  const meongpeu = manifest.cards.find((card) => card.id === 'meongpeu-c');

  assert.equal(manifest.cardCount, 76);
  assert.equal(manifest.cards.length, 76);
  assert.deepEqual(manifest.cards.map((card) => card.id), CARD_CATALOG.map((card) => card.id));
  assert.equal(manifest.cards.filter((card) => /_05\.png$/.test(card.sourceRef || '')).length, 40);
  assert.equal(manifest.cards.filter((card) => /_06\.png$/.test(card.sourceRef || '')).length, 35);
  assert.equal(meongpeu.referenceStatus, 'invented');
  assert.equal(meongpeu.sourceRef, null);
  assert.match(meongpeu.appearance, /cream-colored puppy office intern/);
  assert.match(meongpeu.appearance, /floppy ears/);
  assert.match(meongpeu.appearance, /round glasses/);
  assert.match(meongpeu.appearance, /loose blue tie/);
  assert.match(meongpeu.appearance, /tiny notepad/);
});

test('every catalog card has a packaged artwork file', () => {
  for (const card of CARD_CATALOG) {
    assert.equal(existsSync(new URL(`../public/${card.image.slice(2)}`, import.meta.url)), true, card.id);
  }
});
