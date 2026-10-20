import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CARDS, cardById } from '../src/data/cardCatalog.js';
import { currentRaidSnapshotImage, normalizeRaidSnapshotImages } from '../src/core/raidSnapshotImages.js';
import { normalizeRaidBattle, getRaidActionFeedback } from '../src/core/raidBattleView.js';
import { createRaidBattle, startRaidBattle, performPlayerAction, performFollowUpAction } from '../src/core/turnRaidEngine.js';
import { createCooperativeRaidClient } from '../src/core/cooperativeRaidClient.js';
import { renderCooperativePanel } from '../src/ui/cooperativeRaidView.js';
import { renderRaidArena } from '../src/ui/raidArena.js';

const restore = value => JSON.parse(JSON.stringify(value));
const current = id => cardById(id).image;
function oldBattle(bossId = 'deadline-dragon-raid') {
  return startRaidBattle(createRaidBattle({
    cards: ['coca-ssr', 'winter-ur', 'nanche-c', 'rookie-analyst'].map(cardId => ({
      cardId, name: cardId, attack: 1000, image: `./assets/cards/${cardId}.png`,
    })),
    boss: { id: bossId, name: '저장된 보스', hp: 1000000, baseDamage: 10,
      image: bossId === 'coop-tetra' ? './assets/bosses/coop-tetra.png' : './assets/cards/deadline-dragon.png' },
    seed: 23, now: 1000,
  }), 1000);
}
function withoutImages(value) {
  if (Array.isArray(value)) return value.map(withoutImages);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'image')
    .map(([key, entry]) => [key, withoutImages(entry)]));
}

test('every exact catalog ID including legacy cards overrides stale snapshot art, unknown paths remain intact', () => {
  for (const card of ALL_CARDS) {
    assert.equal(currentRaidSnapshotImage({ cardId: card.id, image: './obsolete/card.png' }), card.image);
    assert.equal(currentRaidSnapshotImage({ id: card.id, image: './obsolete/card.png' }), card.image);
  }
  for (const image of ['https://cdn.example.test/future-card.png', './assets/future-card.png', '']) {
    const snapshot = { id: 'future-card:1', cardId: 'future-card', image, attack: 40 };
    assert.equal(currentRaidSnapshotImage(snapshot), image);
    assert.strictEqual(normalizeRaidSnapshotImages(snapshot), snapshot);
  }
  assert.equal(currentRaidSnapshotImage({ cardId: 'winter-ur:1', image: './custom.png' }), './custom.png');
  assert.equal(currentRaidSnapshotImage({ id: 'future-boss', image: 'https://cdn.example.test/boss.png' }), 'https://cdn.example.test/boss.png');
  for (const id of ['constructor', 'toString', '__proto__']) {
    assert.equal(currentRaidSnapshotImage({ id, image: './unknown.png' }), './unknown.png');
  }
});

test('JSON-restored personal and cooperative battle views resolve current art without changing the saved engine state', () => {
  for (const bossId of ['deadline-dragon-raid', 'deadline-dragon', 'coop-tetra']) {
    const saved = restore(oldBattle(bossId));
    const untouched = restore(saved);
    const view = normalizeRaidBattle(saved);
    const expectedBoss = bossId === 'coop-tetra' ? './assets/bosses/coop-tetra.webp' : current('deadline-dragon');
    assert.equal(view.boss.image, expectedBoss);
    for (const member of view.squad) assert.equal(member.image, current(member.cardId));
    const html = renderRaidArena({ battle: view, cooperative: bossId === 'coop-tetra' });
    assert(html.includes(`src="${expectedBoss}"`));
    assert.doesNotMatch(html, /src="[^\"]+\.png"/);
    assert.deepEqual(saved, untouched);
  }
  const alias = normalizeRaidBattle({ bossId: 'coop-tetra', enemy: { hp: 10, maxHp: 10, image: './assets/bosses/coop-tetra.png' } });
  assert.equal(alias.boss.image, './assets/bosses/coop-tetra.webp');
});

test('nested follow-up and effect source snapshots resolve art while preserving every combat value', () => {
  let saved = oldBattle();
  saved.teamStatuses.push({ id: 'star-follow-up', name: '별빛 추격', kind: 'buff', value: 50, charges: 1 });
  saved = restore(performPlayerAction(saved, { type: 'basic' }, 1001));
  assert.equal(saved.currentActor, 'follow-up');
  assert(saved.pendingFollowUps[0].source.image.endsWith('.png'));
  saved.teamStatuses.push({ id: 'encore', kind: 'buff', value: 100, charges: 2,
    sourceSnapshot: { id: saved.cards[3].id, cardId: 'rookie-analyst', attack: 3456, image: './assets/cards/rookie-analyst.png' } });
  const original = restore(saved);
  const normalized = normalizeRaidSnapshotImages(saved);
  assert.equal(normalized.pendingFollowUps[0].source.image, current('coca-ssr'));
  assert.equal(normalized.teamStatuses.at(-1).sourceSnapshot.image, current('rookie-analyst'));
  assert.deepEqual(withoutImages(normalized), withoutImages(saved));
  assert.deepEqual(saved, original);
  assert.strictEqual(normalizeRaidSnapshotImages(normalized), normalized);

  const oldResult = performFollowUpAction(restore(saved), 1002);
  const resolvedResult = performFollowUpAction(restore(normalized), 1002);
  assert.deepEqual(withoutImages(oldResult), withoutImages(resolvedResult));
  const feedback = getRaidActionFeedback(saved, oldResult);
  assert.equal(feedback.skillCutIn.image, current('coca-ssr'));
  const html = renderRaidArena({ battle: normalizeRaidBattle(oldResult), animation: feedback });
  assert.match(html, /raid-skill-cut-in/);
  assert.doesNotMatch(html, /src="[^\"]+\.png"/);
});

test('an independently restored animation uses catalog art even when its cached cut-in predates WebP', () => {
  const view = normalizeRaidBattle(restore(oldBattle()));
  for (const cardId of ['winter-ur', 'rookie-analyst']) {
    const animation = restore({ skillCutIn: { cardId, image: `./assets/cards/${cardId}.png`, name: '이전 연출' } });
    const html = renderRaidArena({ battle: view, animation });
    assert(html.includes(`src="${current(cardId)}"`));
    assert.doesNotMatch(html, /src="[^\"]+\.png"/);
    assert(animation.skillCutIn.image.endsWith('.png'));
  }
  const external = 'https://cdn.example.test/future-skill.png';
  const html = renderRaidArena({ battle: view, animation: { skillCutIn: { cardId: 'future-card', image: external, name: '추가 카드' } } });
  assert(html.includes(`src="${external}"`));
});

test('old cooperative network snapshots and subsequent skill feedback use current boss and card art', async () => {
  const before = restore(oldBattle('coop-tetra'));
  const after = restore(performPlayerAction(before, { type: 'skill' }, 2000));
  const room = (battle, revision) => ({ id: 'saved-room', revision, battle, stageSum: 16, turnExpiresAt: 20000,
    participants: battle.cards.map((card, index) => ({ accountId: `account-${index}`, instanceId: card.id, cardId: card.cardId, nickname: `사원 ${index}` })) });
  const payloads = [before, after].map((battle, index) => ({ cooperative: {
    phase: 'battle', serverNow: 2000, entriesRemaining: 1, room: room(battle, index + 1),
  } }));
  const client = createCooperativeRaidClient({ gateway: { state: async () => payloads.shift() },
    getIdentity: () => ({ accountId: 'account-0', token: 'test-token' }), now: () => 2000 });
  await client.refresh();
  const initialHtml = renderCooperativePanel({ client: client.getState(), accountId: 'account-0', now: 2000 });
  assert(initialHtml.includes('src="./assets/bosses/coop-tetra.webp"'));
  assert.doesNotMatch(initialHtml, /src="[^\"]+\.png"/);
  await client.refresh();
  assert.equal(client.getState().feedback.skillCutIn.image, current('coca-ssr'));
  const actionHtml = renderCooperativePanel({ client: client.getState(), accountId: 'account-0', now: 2000 });
  assert.match(actionHtml, /raid-skill-cut-in/);
  assert.doesNotMatch(actionHtml, /src="[^\"]+\.png"/);
});
