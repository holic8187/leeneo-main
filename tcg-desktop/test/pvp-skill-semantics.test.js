import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePvpCardAction } from '../src/core/turnRaidEngine.js';

const card = (cardId, side, index) => ({ id: `${side}-${index}`, cardId, name: cardId, attack: 1000,
  maxHp: 5000, hp: 5000, shield: 0, cooldown: 0, statuses: [], enhancement: 0, skillUses: 0, defeated: false });
function battle(first, enemy = 'winter-c') {
  return { cards: [first, 'hoi-ssr', 'morae-c', 'pie-c'].map((id, i) => card(id, 'a', i)),
    enemies: [enemy, 'coca-c', 'guma-c', 'jandi-c'].map((id, i) => card(id, 'b', i)),
    teamStatuses: [], enemyTeamStatuses: [], actorIndex: 0, round: 1, seed: 37, playerActionCount: 0, runtime: {}, enemyRuntime: {} };
}
function opposite(state, actorIndex = 0, round = 1) {
  return { ...state, cards: state.enemies, enemies: state.cards,
    teamStatuses: state.enemyTeamStatuses, enemyTeamStatuses: state.teamStatuses, actorIndex, round,
    runtime: state.enemyRuntime, enemyRuntime: state.runtime, playerActionCount: state.enemyRuntime?.playerActionCount || 0,
    lastCopyableSkill: state.enemyLastCopyableSkill, enemyLastCopyableSkill: state.lastCopyableSkill };
}
const has = (entity, id) => entity.statuses.some(effect => effect.id === id && (effect.charges == null || effect.charges > 0));

test('taunt redirects the complete single-target skill, including all debuffs, exactly once', () => {
  for (const id of ['sseubi-c', 'easy-c']) {
    let state = battle(id);
    state.enemies[1].statuses.push({ id: 'taunt', kind: 'buff', charges: 1 });
    state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
    assert.equal(has(state.enemies[1], 'attack-down'), true, `${id}: attack debuff follows the redirected target`);
    assert.equal(has(state.enemies[0], 'attack-down'), false, `${id}: chosen target not debuffed`);
    if (id === 'sseubi-c') assert.equal(state.enemies[1].hp, 3900);
    if (id === 'easy-c') assert.equal(has(state.enemies[1], 'accuracy-down'), true);
  }
});

test('single-target shield removal and damage affect the same taunting opponent', () => {
  let state = battle('kkamdung-sr');
  state.enemies[1].statuses.push({ id: 'taunt', kind: 'buff', charges: 1 });
  state.enemies[0].shield = 1000; state.enemies[1].shield = 1000;
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.enemies[0].shield, 1000);
  assert.equal(state.enemies[1].shield, 0);
  assert.equal(state.enemies[1].hp, 2900);
  assert.equal(has(state.enemies[1], 'accuracy-down'), true);
});

test('an after-hit cleansing ward removes a newly applied debuff after the complete enemy skill', () => {
  let state = battle('sseubi-c');
  state.enemies[0].statuses.push({ id: 'after-hit-cleanse', kind: 'buff', charges: 2, duration: 3 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.enemies[0].hp, 3900);
  assert.equal(has(state.enemies[0], 'attack-down'), false);
  assert.equal(state.enemies[0].statuses.find(effect => effect.id === 'after-hit-cleanse').charges, 1);
});

test('freeze cannot expire unused when the victim next acts at a new round boundary', () => {
  let state = resolvePvpCardAction(battle('winter-sr'), { type: 'skill', targetId: 'b-0' });
  assert.equal(has(state.enemies[0], 'freeze'), true);
  const before = state.cards[0].hp;
  state = resolvePvpCardAction(opposite(state, 0, 2), { type: 'basic', targetId: 'a-0' });
  assert.equal(state.enemies[0].hp, before);
  assert.ok(state.log.some(entry => entry.type === 'skip'));
});

test('a skipped frozen action does not trigger an opponent moon-usurp reward', () => {
  let state = battle('winter-c');
  state.cards[0].statuses = [{ id: 'freeze', kind: 'debuff', charges: 1 }, { id: 'attack-up', kind: 'buff', value: 20, duration: 3 }];
  state.enemyTeamStatuses = [{ id: 'moon-usurp', kind: 'buff', charges: 3, duration: 3, value: 20, break: 18,
    sourceId: state.enemies[0].id, sourceSnapshot: { ...state.enemies[0] } }];
  state = resolvePvpCardAction(state, { type: 'basic', targetId: 'b-0' });
  assert.equal(has(state.cards[0], 'attack-up'), true);
  assert.equal(state.enemyTeamStatuses[0].charges, 3);
  assert.equal(state.selfBreakDamage, 0);
});

test('SSR Guma HP conversion is based on unscaled HP units in PvP', () => {
  let state = resolvePvpCardAction(battle('guma-ssr'), { type: 'skill' });
  state.cards.forEach(member => { member.shield = 0; });
  let attacks = opposite(state);
  attacks.cards[0].attack = 1000;
  for (let count = 0; count < 3; count += 1) attacks = resolvePvpCardAction(attacks, { type: 'basic', targetId: 'a-2' });
  state = opposite(attacks, 3);
  assert.equal(state.teamStatuses.find(effect => effect.id === 'karma-ledger').storedDamage, 3000);
  const before = state.enemies.map(member => member.hp);
  state = resolvePvpCardAction(state, { type: 'basic', targetId: 'b-0' });
  // The 3000 PvP HP are 60 ordinary HP. (240 + 60 * 2)% at an area scale of .4.
  assert.equal(before[1] - state.enemies[1].hp, 1440);
  assert.equal(before[0] - state.enemies[0].hp, 2440);
});

test('a legacy custom seal goes through the same talisman interception as ordinary debuffs', () => {
  let state = resolvePvpCardAction(battle('guma-ur', 'guma-rrr'), { type: 'skill' });
  state = resolvePvpCardAction(opposite(state), { type: 'skill', targetId: 'a-0' });
  assert.equal(has(state.enemies[0], 'tiger-seal'), false);
  assert.equal(state.enemies[0].statuses.find(effect => effect.id === 'scarlet-exchange').charges, 1);
  assert.equal(state.enemies[0].shield, 600);
  assert.equal(state.selfBreakDamage, 10);
});

test('area damage and debuffs use the declared target count and each target own resistance', () => {
  let state = battle('peach-rr');
  state.enemies[2].statuses.push({ id: 'debuff-block', kind: 'buff', charges: 1 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-2' });
  assert.deepEqual(state.enemies.map(member => member.hp), [3765, 5000, 3765, 5000]);
  assert.equal(has(state.enemies[2], 'damage-taken-up'), false);
  assert.equal(state.enemies[0].statuses.find(effect => effect.id === 'damage-taken-up').value, 10);
});

test('team break resistance reduces the shared gauge, even if the guarded member is not the direct target', () => {
  let state = battle('winter-r');
  state.enemies[3].statuses.push({ id: 'break-reduction', kind: 'buff', value: 20, duration: 2 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.breakDamage, Math.round(32 * .85 * .8));
});

test('talisman conversion and a simultaneous direct-hit counter affect the correct attacking team', () => {
  let state = resolvePvpCardAction(battle('guma-ur', 'sseubi-c'), { type: 'skill' });
  state.cards[2].statuses.push({ id: 'counter', kind: 'buff', value: 50, charges: 1 });
  state = resolvePvpCardAction(opposite(state), { type: 'skill', targetId: 'a-2' });
  assert.equal(state.cards[0].hp, 4500);
  assert.equal(state.enemies[2].hp, 3900);
  assert.equal(state.enemies[2].shield, 600);
  assert.equal(has(state.enemies[2], 'attack-down'), false);
  assert.equal(state.selfBreakDamage, 10);
  assert.equal(state.enemies[2].statuses.find(effect => effect.id === 'scarlet-exchange').charges, 1);
});

test('SSR Hoi reproduces enemy area profile using its own power and original enhancement after source death', () => {
  let state = battle('coca-ssr'); state.cards[0].enhancement = 5;
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  state.cards[0].hp = 0; state.cards[0].defeated = true; state.cards[1].attack = 2000;
  const before = state.enemies.map(member => member.hp);
  state = resolvePvpCardAction({ ...state, actorIndex: 1 }, { type: 'skill', targetId: 'b-0' });
  assert.deepEqual(state.enemies.map((member, i) => before[i] - member.hp), [1999, 1999, 1999, 1999]);
  assert.equal(state.teamStatuses.filter(effect => effect.id === 'prism-torrent').length, 2);
  assert.equal(state.cards[0].hp, 0);
});

test('opponent actions do not advance the defending team cooldown or duration, and snapshot restores them', () => {
  let state = resolvePvpCardAction(battle('winter-hr'), { type: 'skill' });
  state = resolvePvpCardAction(opposite(state), { type: 'basic', targetId: 'a-0' });
  assert.equal(state.enemies[0].cooldown, 5);
  assert.equal(state.enemies[1].statuses.find(effect => effect.id === 'damage-reduction').duration, 2);
  state = resolvePvpCardAction({ ...opposite(JSON.parse(JSON.stringify(state)), 1, 2) }, { type: 'basic', targetId: 'b-0' });
  assert.equal(state.cards[0].cooldown, 4);
  assert.equal(state.cards[1].statuses.find(effect => effect.id === 'damage-reduction').duration, 1);
});

test('a caster defeated by a counter is not revived by its subsequent conditional healing', () => {
  let state = battle('simsim-hr'); state.cards[0].hp = 300;
  state.enemies[0].statuses.push({ id: 'counter', kind: 'buff', value: 50, charges: 1 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.cards[0].hp, 0);
  assert.equal(state.cards[0].defeated, true);
  assert.equal(state.enemies[1].hp, 5000); // The second target is not hit after the attacker is defeated.
});

test('a lethal skill does not move its remaining debuffs or target-bound seed onto another enemy', () => {
  let state = battle('sseubi-c'); state.enemies[0].hp = 100;
  state.enemies[0].statuses.push({ id: 'peach-seed', kind: 'debuff', charges: 1, value: 45 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.enemies[0].hp, 0);
  assert.equal(state.enemies[1].hp, 5000);
  assert.ok(state.enemies.slice(1).every(member => !has(member, 'attack-down')));
});

test('area hits trigger each struck living enemy seed on that same enemy', () => {
  let state = battle('peach-rr');
  state.enemies[0].statuses.push({ id: 'peach-seed', kind: 'debuff', charges: 1, value: 45 });
  state.enemies[2].statuses.push({ id: 'peach-seed', kind: 'debuff', charges: 1, value: 45 });
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-2' });
  assert.equal(has(state.enemies[0], 'peach-seed'), false);
  assert.equal(has(state.enemies[2], 'peach-seed'), false);
  assert.equal(state.enemies[0].hp, state.enemies[2].hp);
  assert.equal(state.enemies[1].hp, 5000);
});
