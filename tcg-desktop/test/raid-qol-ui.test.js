import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { createPendingPackOpening, revealAllPendingPackCards, packFocusIndex } from '../src/core/packOpeningSession.js';
import { createCooperativeRaidGateway } from '../src/services/cooperativeRaidGateway.js';
import { renderCooperativePanel, renderCooperativeReady } from '../src/ui/cooperativeRaidView.js';
import { createRaidBattle, startRaidBattle } from '../src/core/turnRaidEngine.js';
import { createCooperativeBoss } from '../src/core/cooperativeRaidRules.js';
import { cardById } from '../src/data/cardCatalog.js';

test('raid secret preference persists and retired incident migration preserves earned inventory', () => {
  const legacy = createDefaultState();
  legacy.wallet.coins = 87654; legacy.collection['hoi-ssr'] = 2; legacy.packs.standard = 17;
  legacy.settings = { incidentNotifications: false, raidSecretMode: true, quietHoursNotifications: true };
  legacy.activeIncident = { id: 'old', expiresAt: Date.now() + 999999 }; legacy.pendingIncident = { id: 'later' };
  const restored = hydrateState(legacy);
  assert.equal(restored.settings.expeditionNotifications, false);
  assert.equal(restored.settings.raidSecretMode, true);
  assert.equal(restored.settings.quietHoursNotifications, true);
  assert.equal(restored.settings.incidentNotifications, undefined);
  assert.equal(restored.activeIncident, undefined); assert.equal(restored.pendingIncident, undefined);
  assert.equal(restored.wallet.coins, 87654); assert.equal(restored.collection['hoi-ssr'], 2); assert.equal(restored.packs.standard, 17);
  assert.equal(hydrateState(restored).settings.raidSecretMode, true);
  assert.equal(hydrateState({ settings: { expeditionNotifications: true, incidentNotifications: false } }).settings.expeditionNotifications, true);
});

test('single-card pack viewer can resume the next hidden card and reveal all without rerolling', () => {
  const cards = ['winter-c', 'hoi-ssr', 'hoi-ur', 'coca-c', 'winter-r'].map(cardById);
  const requires = (card) => ['ssr', 'ur'].includes(card.rarity);
  const opening = createPendingPackOpening({ cards, id: 'safe-result' });
  assert.equal(packFocusIndex(cards, [], -1, requires), 1);
  assert.equal(packFocusIndex(cards, [1], -1, requires), 2);
  assert.equal(packFocusIndex(cards, [], 4, requires), 4);
  const result = revealAllPendingPackCards(opening, cards, requires);
  assert.equal(result.completed, true); assert.equal(result.changed, true);
  assert.deepEqual(result.opening.cardIds, opening.cardIds); assert.equal(result.opening.id, opening.id);
  assert.deepEqual(result.opening.revealedIndices, [1, 2]);
  assert.equal(revealAllPendingPackCards(result.opening, cards, requires).changed, false);
  assert.equal(revealAllPendingPackCards(opening, [], requires).completed, false);
});

test('coop auto requests only own authenticated room flag; no client-side action loop', async () => {
  let request;
  const gateway = createCooperativeRaidGateway({ apiBase: 'https://cards.test', fetchImpl: async (url, options) => {
    request = { url, ...options };
    return { ok: true, json: async () => ({ cooperative: { phase: 'battle', room: { autoAccountIds: ['me'] } } }) };
  } });
  await gateway.auto('token', { roomId: 'r', enabled: true, leaseId: 'l', deviceId: 'd', generation: 1 });
  assert.equal(request.url, 'https://cards.test/api/tcg/raids/cooperative/auto');
  assert.equal(request.method, 'POST'); assert.equal(request.headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(request.body), { roomId: 'r', enabled: true, leaseId: 'l', deviceId: 'd', generation: 1 });
});

test('coop secret mode omits actual illustration URLs from battle and ready popup', () => {
  const ids = ['winter-ur', 'hoi-ssr', 'coca-ssr', 'morae-ssr'];
  const cards = ids.map((cardId, index) => ({ ...cardById(cardId), cardId, instanceId: `c${index}`, attack: 10000 }));
  const battle = startRaidBattle(createRaidBattle({ cards, boss: createCooperativeBoss(24), seed: 5 }), 1000);
  const participants = cards.map((card, index) => ({ accountId: index ? `other${index}` : 'me', cardId: card.cardId, instanceId: card.instanceId, card, nickname: `사원${index}`, stage: 6 }));
  const room = { id: 'r', stageSum: 24, participants, activeAccountId: 'me', battle, autoAccountIds: ['me'] };
  const html = renderCooperativePanel({ client: { data: { phase: 'battle', room }, pending: '' }, accountId: 'me', secret: true });
  assert.match(html, /data-action="coop-auto" aria-pressed="true"/);
  assert.match(html, /data-action="toggle-raid-secret" aria-pressed="true"/);
  const ready = renderCooperativeReady({ data: { phase: 'ready', match: { participants, expiresAt: 30000 } }, accountId: 'me', secret: true });
  for (const card of cards) { assert.equal(html.includes(card.image), false); assert.equal(ready.includes(card.image), false); }
  assert.equal(html.includes(battle.boss.image), false);
  const visible = renderCooperativePanel({ client: { data: { phase: 'battle', room }, pending: '' }, accountId: 'me', secret: false });
  assert.ok(visible.includes(cards[0].image));
});
