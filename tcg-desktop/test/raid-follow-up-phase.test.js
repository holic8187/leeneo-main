import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaidBattle, startRaidBattle, performPlayerAction, performFollowUpAction, performBossAction, skillForCard } from '../src/core/turnRaidEngine.js';
import { getRaidActionFeedback, raidIceSpires, normalizeRaidBattle, isPlayerRaidTurn } from '../src/core/raidBattleView.js';

const card = (id, enhancement = 0) => ({ id, name: id, attack: 1000, enhancement, image: `/${id}.png` });
function battle(first, enhancement = 0) {
  return startRaidBattle(createRaidBattle({ cards: [card(first, enhancement), card('winter-c'), card('nanche-c'), card('hoi-ssr')], boss: { maxHp: 1_000_000, baseDamage: 1 } }), 0);
}
function actAt(state, index, type = 'basic', now = 1) {
  state.currentActor = 'card'; state.currentActorIndex = index; state.sequenceIndex = index;
  return performPlayerAction(state, { type }, now);
}
function settle(state) {
  while (state.currentActor === 'follow-up') state = performFollowUpAction(state, 10);
  return state;
}

test('SSR Coca exposes a distinct stored-damage action before the boss without advancing round or cooldowns', () => {
  let state = performPlayerAction(battle('coca-ssr'), { type: 'skill' }, 1);
  state = actAt(state, 1); state = actAt(state, 2); state = actAt(state, 3);
  assert.equal(state.currentActor, 'follow-up');
  assert.equal(state.totalDamage, 5100);
  assert.equal(state.pendingFollowUps.length, 1);
  assert.equal(state.pendingFollowUps[0].options.flatBonus, 600);
  assert.equal(state.turnDeadlineAt, null);
  assert.equal(isPlayerRaidTurn(normalizeRaidBattle(state)), false);
  const restored = JSON.parse(JSON.stringify(state));
  const next = performFollowUpAction(restored, 5);
  assert.equal(next.currentActor, 'boss');
  assert.equal(next.totalDamage, 8500);
  assert.equal(next.playerActionCount, state.playerActionCount);
  assert.equal(next.round, state.round);
  assert.deepEqual(next.cards.map(c => c.cooldown), state.cards.map(c => c.cooldown));
  assert.deepEqual(next.cards.map(c => c.hp), state.cards.map(c => c.hp));
  assert.equal(next.log.at(-1).type, 'prism-burst');
  const animation = getRaidActionFeedback(state, next);
  assert.equal(animation.attacker, 0);
  assert.deepEqual(animation.targets, ['boss']);
  assert.equal(animation.damageAmount, 3400);
  assert.equal(animation.skillCutIn.cardId, 'coca-ssr');
  assert.equal(performBossAction(next, 6).currentActor, 'card');
});

test('UR Hoi resolves all three outcomes only in the extra action, including after caster KO', () => {
  for (const outcome of ['attack', 'heal', 'support']) {
    let state = performPlayerAction(battle('hoi-ur', 5), { type: 'skill' }, 1);
    const galaxy = state.teamStatuses.find(s => s.id === 'new-galaxy');
    galaxy.records = [outcome, outcome]; galaxy.charges = 1;
    state.cards[0].hp = 0;
    state.cards[1].hp = 20; state.cards[1].cooldown = 3;
    state = actAt(state, 2, 'basic');
    assert.equal(state.currentActor, 'follow-up');
    assert.equal(state.log.some(e => e.type === 'galaxy-resolve'), false);
    const next = performFollowUpAction(state, 5);
    assert.equal(next.log.at(-1).outcome, outcome);
    assert.equal(next.cards[0].hp, 0);
    if (outcome === 'attack') assert.equal(next.totalDamage - state.totalDamage, 4480);
    if (outcome === 'heal') { assert.equal(next.cards[1].hp, 55); assert.equal(next.cards[1].shield, 21); }
    if (outcome === 'support') { assert.equal(next.cards[1].cooldown, 1); assert.equal(next.boss.statuses.find(s => s.id === 'attack-down').value, 35); }
  }
});

test('one direct hit queues distinct secondary effects without recursively charging a prism or galaxy', () => {
  let state = battle('coca-ssr');
  state.teamStatuses = [
    { id: 'prism-torrent', kind: 'buff', charges: 3, contributors: [], captureRate: 20, storedDamage: 0 },
    { id: 'star-follow-up', kind: 'buff', value: 50, charges: 3 },
    { id: 'new-galaxy', kind: 'buff', charges: 3, records: [], sourceId: state.cards[0].id },
  ];
  state.boss.statuses = [{ id: 'peach-seed', kind: 'debuff', value: 45, charges: 1 }];
  state = performPlayerAction(state, { type: 'basic' }, 1);
  assert.equal(state.pendingFollowUps.length, 2);
  const count = state.playerActionCount;
  state = settle(state);
  assert.equal(state.totalDamage, 1950);
  assert.equal(state.playerActionCount, count);
  assert.equal(state.teamStatuses.find(s => s.id === 'prism-torrent').contributors.length, 1);
  assert.equal(state.teamStatuses.find(s => s.id === 'new-galaxy').records.length, 1);
});

test('lethal follow-up cancels remaining extra actions and does not manufacture a boss turn', () => {
  let state = battle('coca-ssr');
  state.boss.hp = 1500;
  state.teamStatuses = [{ id: 'star-follow-up', kind: 'buff', value: 100, charges: 2 }];
  state.boss.statuses = [{ id: 'peach-seed', kind: 'debuff', value: 100, charges: 1 }];
  state = performPlayerAction(state, { type: 'basic' }, 1);
  assert.equal(state.pendingFollowUps.length, 2);
  state = performFollowUpAction(state, 2);
  assert.equal(state.result, 'victory'); assert.equal(state.totalDamage, 1500);
  assert.equal(state.pendingFollowUps.length, 0);
  assert.equal(state.log.filter(e => e.type === 'follow-up').length, 1);
  assert.equal(state.log.filter(e => e.type === 'boss-basic').length, 0);
});

test('a follow-up break uses its triggering regular turn and does not extend the stun by an extra turn', () => {
  let state = battle('coca-ssr');
  state.boss.breakGauge = 95;
  state.teamStatuses = [{ id: 'star-follow-up', kind: 'buff', value: 40, break: 10, charges: 1 }];
  state = performPlayerAction(state, { type: 'basic' }, 1);
  assert.equal(state.playerActionCount, 1);
  state = performFollowUpAction(state, 2);
  assert.equal(state.boss.stunned, true);
  assert.equal(state.boss.stunReleaseAtPlayerAction, 6);
});

test('ice pillars have independent stable identities and retain a broken pillar for its exit animation', () => {
  const before = battle('winter-ur');
  const cast = performPlayerAction(before, { type: 'skill' }, 1);
  const spawn = getRaidActionFeedback(before, cast).iceSpires;
  assert.equal(spawn.length, 3); assert.ok(spawn.every(t => t.phase === 'summoning'));
  const hit = performBossAction(cast, 2);
  const pillars = getRaidActionFeedback(cast, hit).iceSpires;
  assert.equal(pillars.filter(t => t.phase === 'standing').length, 2);
  assert.equal(pillars.filter(t => t.phase === 'breaking').length, 1);
  assert.equal(pillars.find(t => t.phase === 'breaking').id, spawn[2].id);
  assert.equal(raidIceSpires(hit).length, 2);
});

test('all fourteen added variants apply enhancement and remain copyable after caster defeat', () => {
  const ids = ['winter-hr','winter-ssr','nanche-r','nanche-rr','nanche-rrr','nanche-sr','nanche-hr','nanche-ur','nanche-ssr','chuming-u','chuming-rrr','chuming-sr','chuming-ur','chuming-ssr'];
  for (const id of ids) {
    let state = battle(id, 5);
    state.cards.forEach(c => { c.hp = 30; c.cooldown = 3; c.statuses = [{ id: 'seal', kind: 'debuff', duration: 2 }]; });
    state.cards[0].cooldown = 0; state.cards[0].statuses = [];
    assert.notEqual(skillForCard(id, 5).description, skillForCard(id, 0).description, id);
    state = settle(performPlayerAction(state, { type: 'skill' }, 1));
    assert.equal(state.lastCopyableSkill.cardId, id);
    state.cards[0].hp = 0; state.cards[3].cooldown = 0; state.cards[3].statuses = [];
    const snapshot = value => JSON.stringify({ cards: value.cards.map(({ hp, shield, statuses }) => ({ hp, shield, statuses })), boss: value.boss, team: value.teamStatuses });
    const before = snapshot(state);
    state = settle(actAt(state, 3, 'skill'));
    assert.notEqual(snapshot(state), before, id);
    assert.equal(state.cards[0].hp, 0, id);
    assert.equal(state.cards[3].cardId, 'hoi-ssr', id);
  }
});

test('copied multi-step support retains source enhancement and 85 percent magnitude after both casters fall', () => {
  for (const [id, statusId, step, expectedHp, expectedShield] of [
    ['jandi-rr','season-cycle',0,39,0], ['mond-rrr','world-tree-route',1,48,0], ['pie-rrr','full-course',0,30,14],
  ]) {
    let state = performPlayerAction(battle(id,5), { type: 'skill' }, 1);
    state.cards[0].hp = 0;
    state = settle(actAt(state,3,'skill'));
    const copied = state.teamStatuses.find(s => s.id === statusId && s.sourceId === state.cards[3].id);
    assert.equal(copied.sourceSnapshot.enhancement,5,id);
    assert.equal(copied.sourceSnapshot.skillScale,.85,id);
    copied.step = step; copied.charges = 2;
    state.teamStatuses = [copied];
    state.cards[3].hp = 0;
    state.cards[1].hp = 30; state.cards[2].hp = 40;
    state.cards.forEach(card => { card.shield = 0; card.statuses = []; });
    state = actAt(state,1);
    assert.equal(state.cards[1].hp,expectedHp,id);
    assert.equal(state.cards[1].shield,expectedShield,id);
    assert.equal(state.cards[0].hp,0,id); assert.equal(state.cards[3].hp,0,id);
  }
});

test('stored reactive counter magnitudes apply enhancement once', () => {
  let state = performPlayerAction(battle('nanche-hr',5), { type: 'skill' }, 1);
  state = performBossAction(state,2);
  assert.equal(state.totalDamage,1540);
});
