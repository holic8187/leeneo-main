import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG, PACK_DEFINITION, RARITY_ORDER } from '../src/data/cardCatalog.js';
import { openPack, openPacks, rollWeightedRarity } from '../src/core/packEngine.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { createPendingPackOpening, hydratePendingPackOpening } from '../src/core/packOpeningSession.js';
import { mergeAuthoritativeState } from '../src/core/cloudPlaySession.js';
import { normalizeMail } from '../src/services/mailboxGateway.js';
import playerStateService from '../../src/tcg/services/playerStateService.js';
import raidService from '../../src/tcg/services/personalRaidService.js';

test('premium packs normalize standard RR+ odds without promoting a lower rarity', () => {
  const premium = PACK_DEFINITION.premium;
  assert.equal(premium.cardCount, 5);
  assert.equal(premium.coinPrice, 15000);
  const rarities = RARITY_ORDER.slice(RARITY_ORDER.indexOf('rr'));
  assert.deepEqual(Object.keys(premium.weights), rarities);
  const eligibleWeight = rarities.reduce((sum, rarity) => sum + PACK_DEFINITION.standard.weights[rarity], 0);
  assert.equal(Object.values(premium.weights).reduce((sum, weight) => sum + weight, 0), 100);
  let cursor = 0;
  for (const rarity of rarities) {
    const probability = PACK_DEFINITION.standard.weights[rarity] / eligibleWeight;
    assert.ok(Math.abs(premium.weights[rarity] / 100 - probability) < 1e-12);
    assert.equal(rollWeightedRarity(premium.weights, () => cursor + probability / 2), rarity);
    cursor += probability;
  }
  const result = openPacks({ catalog: CARD_CATALOG, definition: premium, packCount: 10, random: () => 0 });
  assert.equal(result.cards.length, 50);
  assert.ok(result.cards.every((card) => card.rarity === 'rr'));
  assert.equal(result.pityTriggered, false);
});

test('SSR tickets grant one card uniformly from every SSR, including all three new SSRs', () => {
  const ticket = PACK_DEFINITION.ssrTicket;
  assert.equal(ticket.adminOnly, true);
  assert.equal(ticket.coinPrice, null);
  const pool = CARD_CATALOG.filter((card) => card.rarity === 'ssr');
  assert.equal(pool.length, 24);
  const draws = pool.map((_, index) => {
    const result = openPack({
      catalog: CARD_CATALOG, definition: ticket,
      random: () => (index + 0.5) / pool.length,
    });
    assert.equal(result.cards.length, 1);
    return result.cards[0].id;
  });
  assert.deepEqual(draws, pool.map((card) => card.id));
  for (const id of ['winter-ssr', 'nanche-ssr', 'chuming-ssr']) assert.ok(draws.includes(id));
});

test('all winter, nanche and chuming rarities exist while raid reward pools cover new cards', () => {
  for (const characterId of ['winter', 'nanche', 'chuming']) {
    assert.deepEqual(CARD_CATALOG.filter((card) => card.characterId === characterId)
      .map((card) => card.rarity).sort(), [...RARITY_ORDER].sort());
  }
  for (const rarity of ['sr', 'hr', 'ur', 'ssr']) {
    assert.deepEqual([...raidService.RAID_SR_PLUS_CARD_POOLS[rarity]].sort(),
      CARD_CATALOG.filter((card) => card.rarity === rarity).map((card) => card.id).sort());
  }
});

test('old saves default new pack types to zero and retain independent inventory and pending openings', () => {
  const legacy = { packs: { standard: 4 }, pity: { standard: 32 } };
  assert.deepEqual(hydrateState(legacy).packs, { standard: 4, premium: 0, srPremium: 0, ssrTicket: 0 });
  assert.deepEqual(hydrateState(legacy).pity, { standard: 32, premium: 0, srPremium: 0, ssrTicket: 0 });
  for (const packId of ['premium', 'srPremium', 'ssrTicket', 'futurePack']) {
    const opening = createPendingPackOpening({
      cards: ['winter-ssr'], packId, newCardIndices: [0], id: `opening-${packId}`, openedAt: 1000,
    });
    const saved = hydrateState({ ...legacy, packs: { standard: 4, premium: 3, srPremium: 0, ssrTicket: 2, futurePack: 1 }, pendingPackOpening: opening });
    assert.equal(saved.pendingPackOpening.packId, packId);
    assert.deepEqual(hydratePendingPackOpening(opening), opening);
    const server = playerStateService.serializePlayerState({
      initialized: true, state: playerStateService.normalizeGameState(saved),
    }).state;
    assert.deepEqual(server.packs, saved.packs);
    assert.deepEqual(server.pendingPackOpening, opening);
  }
});

test('mail grants and simultaneous local spends retain separate premium and SSR ticket balances', () => {
  const base = createDefaultState();
  base.packs = { standard: 10, premium: 4, srPremium: 0, ssrTicket: 2 };
  const local = structuredClone(base);
  local.packs.premium -= 1;
  local.packs.ssrTicket -= 1;
  local.pity.standard = 7;
  const server = structuredClone(base);
  server.packs.premium += 3;
  server.packs.ssrTicket += 4;
  const restored = hydrateState(mergeAuthoritativeState(base, local, server));
  assert.deepEqual(restored.packs, { standard: 10, premium: 6, srPremium: 0, ssrTicket: 5 });
  assert.deepEqual(restored.pity, { standard: 7, premium: 0, srPremium: 0, ssrTicket: 0 });
  assert.deepEqual(normalizeMail({ rewards: { packs: { standard: 1, premium: 2, srPremium: 0, ssrTicket: 3 } } }).rewards,
    { coins: 0, standardPacks: 1, premiumPacks: 2, srPremiumPacks: 0, ssrTickets: 3 });
});
