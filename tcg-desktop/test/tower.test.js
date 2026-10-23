import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWER_AUGMENTS, createTowerOffer, rerollTowerOffer } from '../src/data/towerAugments.js';
import { towerMonthWindow, towerBossForFloor, towerRankingScore, towerRewardForRank } from '../src/core/towerRules.js';
import { createTowerBattle, stepTowerBattle } from '../src/core/towerBattle.js';
import { renderTowerPanel } from '../src/ui/towerView.js';
import { createTowerGateway } from '../src/services/towerGateway.js';
import { createTowerClient } from '../src/core/towerClient.js';

const cards = ['mango-c', 'winter-c', 'shanghai-c', 'meongpeu-c'].map(cardId => ({ cardId, attack: 1000, maxHp: 100 }));
function battle(ids = [], extra = {}) {
  return stepTowerBattle(createTowerBattle({ cards, boss: { maxHp: 10000000, basicAttackDamage: 20, skills: [] }, augments: ids, seed: 12, now: 0, ...extra }), { type: 'start' }, 0);
}
const act = (state, type = 'basic', extra = {}) => stepTowerBattle(state, { type, ...extra }, 1000);
const damage = state => state.totalDamage;
const aura = (card, id) => card.statuses.filter(status => status.id === id).reduce((sum, status) => sum + status.value, 0);

test('month rollover uses KST midnight, including year changes and leap February', () => {
  assert.equal(towerMonthWindow(Date.parse('2026-10-31T14:59:59.999Z')).seasonKey, '2026-10');
  assert.equal(towerMonthWindow(Date.parse('2026-10-31T15:00:00Z')).seasonKey, '2026-11');
  assert.equal(towerMonthWindow(Date.parse('2026-12-31T15:00:00Z')).seasonKey, '2027-01');
  assert.equal(towerMonthWindow(Date.parse('2028-02-01T00:00:00+09:00')).resetsAt, Date.parse('2028-03-01T00:00:00+09:00'));
});
test('difficulty rises, ranking cannot be farmed by retry damage, and rewards descend', () => {
  let hp = 0;
  for (let floor = 1; floor <= 500; floor++) { const boss = towerBossForFloor(floor); assert.ok(boss.maxHp > hp); hp = boss.maxHp; }
  assert.equal(towerBossForFloor(1).skills.length, 0); assert.ok(towerBossForFloor(40).skills.length > 4);
  assert.ok(towerRankingScore(2, 0) > towerRankingScore(1, 999999));
  assert.equal(towerRankingScore(0, 100000000), 999999);
  assert.equal(towerRewardForRank(1).srPremiumPacks, 5); assert.equal(towerRewardForRank(101).standardPacks, 3);
  assert.equal(towerRewardForRank(0), null);
});
test('24 real augments, same-tier three-choice offers, one reroll for each slot', () => {
  assert.equal(TOWER_AUGMENTS.length, 24); assert.equal(new Set(TOWER_AUGMENTS.map(a => a.id)).size, 24);
  for (const [floor, tier] of [[0, 'silver'], [5, 'gold'], [10, 'prism'], [15, 'silver']]) {
    const offer = createTowerOffer(floor, () => .4); assert.equal(offer.tier, tier); assert.equal(new Set(offer.options).size, 3);
    const rerolled = rerollTowerOffer(offer, 0, () => .4); assert.ok(!offer.options.includes(rerolled.options[0])); assert.equal(offer.rerolledSlots.length, 0);
    assert.throws(() => rerollTowerOffer(rerolled, 0));
  }
});
test('silver attack/HP/start shield/first attack/break effects change real combat', () => {
  assert.equal(damage(act(battle(['keen-edge']))), 1080);
  assert.equal(battle(['sturdy-heart']).cards[0].maxHp, 115);
  assert.equal(battle(['departure-shield']).cards[0].shield, 12);
  const first = act(battle(['first-strike'])); assert.equal(damage(first), 1400); assert.ok(!first.cards[0].statuses.some(s => s.id === 'basic-bonus'));
  const breaker = battle(['crack-finder']); breaker.currentActorIndex = 2;
  assert.equal(act(breaker, 'skill').boss.breakGauge, 20);
});
test('silver sustain/heal amplification/evasion apply to actual HP events', () => {
  const breath = battle(['small-breath']); breath.cards[0].hp = 60; assert.equal(act(breath).cards[0].hp, 63);
  const care = battle(['warm-care']); care.currentActorIndex = 1; care.cards[0].hp = 50;
  assert.equal(act(care, 'skill', { targetId: care.cards[0].id }).cards[0].hp, 64);
  let dodges = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const light = battle(['light-step'], { seed }); light.currentActor = 'boss'; light.currentActorIndex = null;
    if (act(light, 'advance').log.some(entry => entry.type === 'evade')) dodges++;
  }
  assert.ok(dodges > 0, 'evasion must actually prevent at least one seeded attack');
});
test('gold stacks, multiplicative mitigation and skill amplification affect damage', () => {
  const momentum = battle(['momentum']); momentum.tower.actions[momentum.cards[0].id] = 10;
  assert.equal(damage(act(momentum)), 1300);
  const guards = battle(['layered-guard', 'layered-guard']); guards.currentActor = 'boss'; guards.currentActorIndex = null;
  const defended = act(guards, 'advance'); assert.equal(defended.cards.reduce((sum, c) => sum + (100 - c.hp), 0), 16);
  assert.ok(damage(act(battle(['skill-manual']), 'skill')) > damage(act(battle(), 'skill')));
});
test('gold round shield, conditional boosts, risk HP and limited quick starts work', () => {
  const bastion = battle(['round-bastion']); bastion.currentActor = 'boss'; bastion.sequenceIndex = 3;
  assert.equal(act(bastion, 'advance').cards[0].shield, 5);
  const desperate = battle(['desperate-edge']); desperate.cards[0].hp = 50; assert.equal(damage(act(desperate)), 1300);
  assert.equal(damage(act(battle(['full-company']))), 1180);
  const broken = battle(['full-company']); broken.cards[3].hp = 0; assert.equal(damage(act(broken)), 1000);
  const glass = battle(['glass-engine']); assert.equal(glass.cards[0].maxHp, 80); assert.equal(damage(act(glass)), 1300);
  assert.equal(act(battle(['quick-start']), 'skill').cards[0].cooldown, act(battle(), 'skill').cards[0].cooldown - 1);
});
test('prism turn scaling, higher incoming risk, initial shield and cooldown cycle work', () => {
  const climb = battle(['long-climb']); climb.round = 4; assert.equal(damage(act(climb)), 1360);
  const risk = battle(['danger-contract']); assert.equal(risk.boss.baseDamage, 24); assert.equal(damage(act(risk)), 1500);
  const shell = battle(['crystal-shell']); assert.equal(shell.cards[0].maxHp, 75); assert.equal(shell.cards[0].shield, 34);
  const clock = battle(['clockwork']); clock.cards[0].cooldown = 3; clock.tower.actions[clock.cards[0].id] = 2;
  assert.equal(act(clock).cards[0].cooldown, 2);
});
test('prism early/lone conditions, cleansing and overflow have observable effects', () => {
  assert.equal(damage(act(battle(['opening-festival']))), 1450);
  const late = battle(['opening-festival']); late.round = 3; assert.equal(damage(act(late)), 1000);
  const lone = battle(['last-light']); lone.cards.slice(1).forEach(card => card.hp = 0); assert.equal(damage(act(lone)), 2000);
  const clean = battle(['purifying-cycle']); clean.tower.actions[clean.cards[0].id] = 2; clean.cards[0].statuses.push({ id: 'seal', kind: 'debuff', charges: 1 });
  const purified = act(clean); assert.equal(purified.cards[0].shield, 10); assert.ok(!purified.cards[0].statuses.some(status => status.id === 'seal'));
  assert.equal(act(battle(['overflowing-spring'])).cards[0].shield, 3);
  const hurt = battle(['overflowing-spring']); hurt.cards[0].hp = 50; assert.equal(act(hurt).cards[0].hp, 56);
});
test('duplicate augments accumulate, effects survive serialized resume, exhausted party still loses', () => {
  assert.equal(damage(act(battle(['keen-edge', 'keen-edge']))), 1160);
  const saved = JSON.parse(JSON.stringify(battle(['momentum', 'long-climb'])));
  assert.deepEqual(act(saved), act(battle(['momentum', 'long-climb'])));
  const lethal = battle(['small-breath', 'overflowing-spring']); lethal.cards.forEach(card => card.hp = 1); lethal.boss.skills = [{ id: 'all', target: 'all', damage: 999, cooldown: 3, statusEffects: [] }]; lethal.currentActor = 'boss';
  const done = act(lethal, 'advance'); assert.equal(done.status, 'finished'); assert.equal(done.result, 'defeat');
});
test('tower UI hides art in secret mode, exposes candidates/ranking and reuses raid controls', () => {
  const data = { seasonKey: '2026-10', revision: 1, floor: 1, clearedFloor: 0, augments: [], offer: createTowerOffer(0), battle: null };
  const offer = renderTowerPanel({ client: { data } }); assert.equal((offer.match(/data-action="tower-choose"/g) || []).length, 3);
  data.offer = null; data.battle = battle();
  const markup = renderTowerPanel({ client: { data }, secret: true });
  assert.ok(markup.includes('tower-basic')); assert.ok(markup.includes('tower-skill')); assert.ok(!/src="[^\"]*assets\/(?:cards|bosses)\//.test(markup));
});
test('gateway passes only authenticated requests, rejects malformed responses and enforces deadlines', async () => {
  const sent = [];
  const gateway = createTowerGateway({ apiBase: 'https://example.test/', fetchImpl: async (...args) => { sent.push(args); return { ok: true, json: async () => ({ tower: { revision: 0, seasonKey: '2026-10' } }) }; } });
  await gateway.choose('token', { augmentId: 'keen-edge', expectedRevision: 0 });
  assert.equal(sent[0][0], 'https://example.test/api/tcg/tower/choose'); assert.equal(sent[0][1].headers.Authorization, 'Bearer token');
  await assert.rejects(gateway.state(''), { code: 'AUTH_REQUIRED' });
  const timed = createTowerGateway({ apiBase: 'https://example.test', timeoutMs: 5, fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(timed.state('token'), { code: 'TIMEOUT' });
});
test('client rejects late account responses and uses the newest revision after a pending read', async () => {
  let resolveRead, identity = { accountId: 'a', token: 'token-a' }, sent;
  const data = { seasonKey: '2026-10', revision: 3, battleId: 'battle-a', serverNow: 10 };
  const client = createTowerClient({ getIdentity: () => identity, gateway: {
    state: () => new Promise(resolve => { resolveRead = resolve; }),
    choose: async (token, body) => { sent = body; return { tower: { ...data, revision: 4 } }; },
  } });
  const read = client.refresh(), mutation = client.mutate('choose', () => ({ augmentId: 'keen-edge', deviceId: 'pc' }));
  resolveRead({ tower: data }); await read; await mutation;
  assert.equal(sent.expectedRevision, 3); assert.equal(sent.seasonKey, '2026-10'); assert.equal(sent.deviceId, 'pc');
  const old = client.refresh(); identity = { accountId: 'b', token: 'token-b' }; client.reset();
  resolveRead({ tower: data }); await old; assert.equal(client.getState().data, null);
});
