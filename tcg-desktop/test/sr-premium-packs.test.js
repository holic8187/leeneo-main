import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG, PACK_DEFINITION, cardById } from '../src/data/cardCatalog.js';
import { addCardsToCollection, openPack, openPacks } from '../src/core/packEngine.js';
import { createDefaultState, createGameStore, hydrateState } from '../src/core/gameState.js';
import { createCloudPlaySession } from '../src/core/cloudPlaySession.js';
import { newCardIndices, registerDiscoveredCards } from '../src/core/cardDiscovery.js';
import { hasMailRewards, mailRewardEntries } from '../src/core/mailRewards.js';
import { packCardRequiresReveal, packPresentation } from '../src/core/packPresentation.js';
import {
  cardsForPendingPack,
  createPendingPackOpening,
  revealAllPendingPackCards,
  revealPendingPackCard,
  unrevealedPackCardCount,
} from '../src/core/packOpeningSession.js';
import { rewardForRank } from '../src/core/weeklyRankingRewards.js';
import { createMailboxGateway, normalizeMail } from '../src/services/mailboxGateway.js';
import mailboxService from '../../src/tcg/services/mailboxService.js';

const { applyMailRewards } = mailboxService;
const packId = 'srPremium';
const accountId = 'weekly-reward-player';
const definition = PACK_DEFINITION[packId];
const clone = (value) => JSON.parse(JSON.stringify(value));
const cardCount = (collection) => Object.values(collection).reduce((sum, count) => sum + count, 0);

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
}

function snapshot(state, revision = 3) {
  return { state, revision, initialized: true, leaseId: 'reward-lease', generation: 1, expiresAt: 10000, serverNow: 1000 };
}

function makeCloud(store, storage, saves = []) {
  return createCloudPlaySession({
    gateway: {
      open: async () => snapshot(store.getState()),
      saveState: async (_token, body) => {
        saves.push(clone(body));
        return snapshot(null, body.baseRevision + 1);
      },
    },
    token: 'test-token', accountId, storage, deviceId: 'reward-test-device', platform: 'pc', appVersion: '0.14.0',
    onRemoteState: (state) => store.replace(state),
    setTimeoutImpl: () => 1, clearTimeoutImpl: () => {},
    setIntervalImpl: () => 1, clearIntervalImpl: () => {},
  });
}

// main.js owns the UI transaction. Exercise its core boundaries with a real
// persistent store, rather than making a second implementation of the rolls.
function beginOpening(store, packCount = 1, random = () => 0) {
  const before = store.getState();
  assert.equal(before.pendingPackOpening, null);
  assert.ok(before.packs[packId] >= packCount);
  const result = openPacks({ catalog: CARD_CATALOG, definition, packCount, pity: before.pity[packId], random });
  const opening = createPendingPackOpening({
    cards: result.cards, packId, packCount: result.packCount,
    newCardIndices: newCardIndices(result.cards, before.discoveredCardIds),
    pityTriggered: result.pityTriggered,
  });
  store.update((draft) => {
    draft.packs[packId] -= result.packCount;
    draft.pity[packId] = result.nextPity;
    draft.pendingPackOpening = opening;
  });
  return { result, opening };
}

function finishOpening(store) {
  const opening = store.getState().pendingPackOpening;
  if (!opening) return false;
  const cards = cardsForPendingPack(opening, cardById);
  const reveal = revealAllPendingPackCards(opening, cards, packCardRequiresReveal);
  assert.equal(reveal.completed, true);
  store.update((draft) => {
    draft.collection = addCardsToCollection(draft.collection, cards);
    draft.discoveredCardIds = registerDiscoveredCards(draft.discoveredCardIds, cards);
    draft.pendingPackOpening = null;
  });
  return true;
}

test('weekly reward pack contains five SR+ cards with exact 70/22/7/1 odds and no shop price', () => {
  assert.equal(definition.cardCount, 5);
  assert.equal(definition.rewardOnly, true);
  assert.equal(definition.coinPrice, null);
  assert.equal(definition.guaranteedRarity, 'sr');
  assert.deepEqual(definition.weights, { sr: 70, hr: 22, ur: 7, ssr: 1 });
  for (const [random, rarity] of [
    [0, 'sr'], [0.699999, 'sr'], [0.7, 'hr'], [0.919999, 'hr'],
    [0.92, 'ur'], [0.989999, 'ur'], [0.99, 'ssr'], [0.999999, 'ssr'],
  ]) {
    const result = openPack({ catalog: CARD_CATALOG, definition, pity: 49, random: () => random });
    assert.equal(result.cards.length, 5);
    assert.deepEqual(result.cards.map((card) => card.rarity), Array(5).fill(rarity));
    assert.equal(result.nextPity, 49, 'a reward pack does not advance or reset another pack pity counter');
    assert.equal(result.pityTriggered, false);
  }
});

test('actual five-card rolls preserve the configured odds across every card position', () => {
  const totals = { sr: 0, hr: 0, ur: 0, ssr: 0 };
  const byPosition = Array.from({ length: 5 }, () => ({ ...totals }));
  for (let sample = 0; sample < 100; sample += 1) {
    const result = openPack({ catalog: CARD_CATALOG, definition, random: () => (sample + 0.5) / 100 });
    result.cards.forEach((card, index) => {
      assert.ok(Object.hasOwn(totals, card.rarity), `${card.id} is below SR`);
      totals[card.rarity] += 1;
      byPosition[index][card.rarity] += 1;
    });
  }
  assert.deepEqual(totals, { sr: 350, hr: 110, ur: 35, ssr: 5 });
  for (const position of byPosition) assert.deepEqual(position, definition.weights);
});

test('weekly mail claim reaches inventory, then a half-revealed pack survives restart and spends once', async (t) => {
  const storage = memoryStorage();
  let store = createGameStore(storage, { userId: accountId });
  const before = store.getState();
  const rewards = rewardForRank(1);
  assert.deepEqual(rewards, { srPremiumPacks: 5 });
  const pendingMail = normalizeMail({ id: 'weekly-2026-10-19', rewards });
  assert.equal(hasMailRewards(pendingMail), true);
  assert.deepEqual(mailRewardEntries(pendingMail.rewards).map(({ key, amount }) => [key, amount]), [['srPremiumPacks', 5]]);
  const granted = applyMailRewards(before, [pendingMail]);
  const cloud = makeCloud(store, storage);
  t.after(() => cloud.dispose());
  await cloud.open();
  const mutation = cloud.beginAuthoritativeMutation(store.getState());
  const mailbox = createMailboxGateway({
    apiBase: 'https://test.invalid',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://test.invalid/api/tcg/mail/claim');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.deepEqual(JSON.parse(options.body), { mailId: pendingMail.id, baseRevision: 3 });
      return {
        ok: true,
        json: async () => ({
          ...snapshot(granted.state, 4), rewards: granted.rewards,
          mailbox: [{ ...pendingMail, claimedAt: '2026-10-26T00:00:00+09:00' }],
        }),
      };
    },
  });
  const response = await mailbox.claim('test-token', { mailId: pendingMail.id, baseRevision: mutation.baseRevision });
  cloud.commitAuthoritativeMutation(response.snapshot);
  assert.equal(response.mailbox[0].status, 'claimed');
  assert.equal(store.getState().packs.srPremium, 5);
  assert.deepEqual(store.getState().wallet, before.wallet);
  assert.equal(store.getState().packs.standard, before.packs.standard);

  const { result, opening } = beginOpening(store);
  assert.equal(store.getState().packs.srPremium, 4);
  assert.deepEqual(store.getState().collection, before.collection, 'hidden cards remain in the durable opening until revealed');
  assert.equal(unrevealedPackCardCount(opening, result.cards, packCardRequiresReveal), 5);
  const revealed = revealPendingPackCard(opening, 2, result.cards, packCardRequiresReveal);
  assert.equal(revealed.changed, true);
  assert.equal(revealed.completed, false);
  store.update((draft) => { draft.pendingPackOpening = revealed.opening; });

  store = createGameStore(storage, { userId: accountId });
  const restored = store.getState().pendingPackOpening;
  assert.equal(restored.id, opening.id);
  assert.equal(restored.packId, packId);
  assert.equal(restored.packCount, 1);
  assert.deepEqual(restored.revealedIndices, [2]);
  assert.deepEqual(cardsForPendingPack(restored, cardById).map((card) => card.id), result.cards.map((card) => card.id));
  assert.equal(unrevealedPackCardCount(restored, result.cards, packCardRequiresReveal), 4);
  assert.equal(revealPendingPackCard(restored, 2, result.cards, packCardRequiresReveal).changed, false);
  assert.equal(store.getState().packs.srPremium, 4, 'resume does not spend another pack');
  assert.equal(finishOpening(store), true);
  assert.equal(finishOpening(store), false, 'a finished opening cannot grant its cards a second time');

  const completed = createGameStore(storage, { userId: accountId }).getState();
  assert.equal(completed.packs.srPremium, 4);
  assert.equal(completed.pendingPackOpening, null);
  assert.equal(cardCount(completed.collection) - cardCount(before.collection), 5);
  for (const card of result.cards) {
    assert.ok(completed.discoveredCardIds.includes(card.id));
    assert.equal(completed.cardProgression[card.id].level, 1);
  }
});

test('ten SR+ packs retain all fifty hidden cards and their consumed balance across save hydration', () => {
  const storage = memoryStorage();
  let store = createGameStore(storage, { userId: accountId });
  store.update((draft) => { draft.packs.srPremium = 10; });
  const countBefore = cardCount(store.getState().collection);
  const { result } = beginOpening(store, 10, () => 0.995);
  assert.equal(result.cards.length, 50);
  assert.equal(result.cards.every((card) => card.rarity === 'ssr'), true);
  store = createGameStore(storage, { userId: accountId });
  const opening = store.getState().pendingPackOpening;
  const restoredCards = cardsForPendingPack(opening, cardById);
  assert.equal(opening.packCount, 10);
  assert.equal(opening.cardIds.length, 50);
  assert.equal(unrevealedPackCardCount(opening, restoredCards, packCardRequiresReveal), 50);
  assert.equal(packPresentation(restoredCards, opening.newCardIndices).showcaseIndices.length, 50);
  assert.equal(store.getState().packs.srPremium, 0);
  finishOpening(store);
  assert.equal(cardCount(store.getState().collection) - countBefore, 50);
  assert.equal(store.getState().packs.srPremium, 0);
});

test('an SR+ mail claim rebases an in-flight local pack opening without losing cards or restoring the spent pack', async (t) => {
  const storage = memoryStorage();
  const store = createGameStore(storage, { userId: accountId });
  store.update((draft) => { draft.packs.srPremium = 2; });
  const base = store.getState();
  const saves = [];
  const cloud = makeCloud(store, storage, saves);
  t.after(() => cloud.dispose());
  await cloud.open();
  cloud.beginAuthoritativeMutation(base);
  const { opening } = beginOpening(store);
  cloud.queueState(store.getState());
  await cloud.flush();
  assert.equal(saves.length, 0, 'old-revision saves wait for the mail claim');
  const granted = applyMailRewards(base, [{ rewards: rewardForRank(1) }]);
  const commit = cloud.commitAuthoritativeMutation(snapshot(granted.state, 4));
  assert.equal(commit.rebased, true);
  assert.equal(store.getState().packs.srPremium, 6, '2 old + 5 mail - 1 opened');
  assert.deepEqual(store.getState().pendingPackOpening, opening);
  await cloud.flush();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].baseRevision, 4);
  assert.equal(saves[0].state.packs.srPremium, 6);
  assert.deepEqual(saves[0].state.pendingPackOpening, opening);
});

test('old saves get a zero SR+ balance while existing and future pack balances survive repeated hydration', () => {
  const oldSave = {
    version: 1, wallet: { coins: 123 },
    packs: { standard: 7, premium: 2, ssrTicket: 3, futurePack: 8 },
    pity: { standard: 31, premium: 4 },
  };
  const migrated = hydrateState(oldSave);
  assert.deepEqual(migrated.packs, { standard: 7, premium: 2, srPremium: 0, ssrTicket: 3, futurePack: 8 });
  assert.deepEqual(migrated.pity, { standard: 31, premium: 4, srPremium: 0, ssrTicket: 0 });
  assert.equal(createDefaultState().packs.srPremium, 0);
  const rewarded = applyMailRewards(oldSave, [{ rewards: rewardForRank(9) }]).state;
  const roundTrip = hydrateState(clone(hydrateState(rewarded)));
  assert.equal(roundTrip.packs.srPremium, 1);
  assert.equal(roundTrip.packs.futurePack, 8);
  assert.equal(roundTrip.packs.standard, 7);
  assert.equal(roundTrip.wallet.coins, 123);
  assert.equal(roundTrip.pity.standard, 31);
});
