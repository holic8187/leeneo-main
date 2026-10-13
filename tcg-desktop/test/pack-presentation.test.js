import test from 'node:test';
import assert from 'node:assert/strict';
import { cardById } from '../src/data/cardCatalog.js';
import { packPresentation, packCardRequiresReveal, packShowcaseFocus } from '../src/core/packPresentation.js';
import { createPendingPackOpening, hydratePendingPackOpening, cardsForPendingPack, revealPendingPackCard, revealAllPendingPackCards } from '../src/core/packOpeningSession.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { renderPackResults } from '../src/ui/packResults.js';
import { renderPackShop } from '../src/ui/packShop.js';

const cards = ['winter-c', 'winter-c', 'hoi-c', 'winter-sr', 'winter-sr'].map(cardById);
test('only first discoveries and SR+ enter the carousel, never spoil a hidden duplicate', () => {
  const pending = packPresentation(cards, [0]);
  assert.deepEqual(pending.showcaseIndices, [0, 3, 4]);
  assert.deepEqual(pending.hiddenIndices, [0, 3, 4]);
  assert.deepEqual(pending.duplicateGroups.map(group => [group.card.id,group.count]), [['hoi-c',1]]);
  const partial = packPresentation(cards, [0], [0, 3]);
  assert.deepEqual(partial.duplicateGroups.map(group => [group.card.id,group.count]), [['winter-c',1],['hoi-c',1]]);
  const done = packPresentation(cards, [0], [0, 3, 4]);
  assert.deepEqual(done.duplicateGroups.map(group => [group.card.id,group.count]), [['winter-c',1],['hoi-c',1],['winter-sr',2]]);
  assert.equal(packShowcaseFocus(partial, 1), 4);
  assert.equal(packShowcaseFocus(done, 0), 0);
});

test('known low-rarity results are grouped without face-down cards', () => {
  const result = packPresentation(cards.slice(0,3));
  assert.deepEqual(result.showcaseIndices, []);
  assert.equal(result.duplicateGroups[0].count, 2);
  assert.equal(packShowcaseFocus(result), -1);
});

for (const packId of ['standard','premium','ssrTicket']) test(`${packId} remembers its source and reveal progress through save hydration`, () => {
  const chosen = packId === 'ssrTicket' ? [cardById('winter-ssr')] : cards;
  const original = createPendingPackOpening({packId,cards:chosen,newCardIndices:[0],id:'durable-result'});
  const state = createDefaultState(); state.pendingPackOpening = original;
  const restored = hydrateState(JSON.parse(JSON.stringify(state))).pendingPackOpening;
  const needsReveal = (card,index) => packCardRequiresReveal(card,index,restored.newCardIndices);
  const first = revealPendingPackCard(restored,0,chosen,needsReveal);
  const again = hydratePendingPackOpening(JSON.parse(JSON.stringify(first.opening)));
  assert.equal(again.packId, packId);
  assert.deepEqual(again.cardIds, chosen.map(card=>card.id));
  assert.deepEqual(again.revealedIndices, [0]);
  assert.deepEqual(cardsForPendingPack(again,cardById).map(card=>card.id), again.cardIds);
  assert.equal(revealPendingPackCard(again,0,chosen,needsReveal).changed, false);
  assert.equal(revealAllPendingPackCards(again,chosen,needsReveal).completed, true);
});

test('result renderer keeps only featured cards, summary, horizontal controls and reveal all', () => {
  const rendered = [];
  const html = renderPackResults({cards,modal:{newCardIndices:[0],revealedCards:[],packId:'premium'},state:createDefaultState(),renderCard:(card,index)=>{rendered.push(index);return `<button>${index}</button>`;}});
  assert.deepEqual(rendered,[0,3,4]);
  assert.match(html,/pack-carousel/);
  assert.match(html,/중복 카드/);
  assert.match(html,/reveal-all-pack-cards/);
  assert.doesNotMatch(html,/최고등급|최고 등급/);
  assert.doesNotMatch(html,/겨울/);
});

test('SSR voucher cannot expose a purchase action; ordinary/premium packs offer 10 at ten owned', () => {
  const state = createDefaultState(); state.packs = {standard:10,premium:10,ssrTicket:0}; state.wallet.coins=15000;
  const html = renderPackShop(state);
  assert.match(html,/data-action="buy-pack" data-pack-id="premium"/);
  assert.doesNotMatch(html,/data-action="buy-pack" data-pack-id="ssrTicket"/);
  for(const id of ['standard','premium']) assert.match(html,new RegExp(`data-pack-id="${id}" data-pack-count="10" >10팩 개봉`));
  const result = renderPackResults({cards:[cardById('winter-ssr')],modal:{packId:'ssrTicket',newCardIndices:[0],revealedCards:[0]},state,renderCard:()=>''});
  assert.doesNotMatch(result,/buy-and-open-pack/);
});
