import assert from 'node:assert/strict';
import test from 'node:test';
import { REMAINING_ROSTER_SKILLS, REMAINING_SKILL_RULES, skillChoices } from '../src/data/remainingRosterSkills.js';
import { skillDescriptionAtEnhancement, skillMagnitude } from '../src/data/cardSkills.js';
import { EFFECT_PRESENTATION, effectPresentation } from '../src/core/raidBattleView.js';
import { createRaidBattle, startRaidBattle, performPlayerAction, performBossAction, performFollowUpAction, resolvePvpCardAction } from '../src/core/turnRaidEngine.js';

function battle(first, enhancement = 0, boss = {}) {
  return startRaidBattle(createRaidBattle({ cards: [first, 'winter-c', 'nanche-c', 'hoi-ssr'].map((id, index) => ({
    id, attack: index === 3 ? 2000 : 1000, enhancement: index === 0 ? enhancement : 0,
  })), boss: { maxHp: 1_000_000, baseDamage: 20, ...boss }, seed: 123 }), 0);
}
function act(state, index = 0, action = { type: 'skill' }) {
  state.currentActor = 'card'; state.currentActorIndex = index; state.sequenceIndex = index;
  return performPlayerAction(state, action, 10);
}
function recast(state, index = 0, action = { type: 'skill' }) {
  state.cards[index].cooldown = 0;
  return act(state, index, action);
}
function bossAct(state) { state.currentActor = 'boss'; state.currentActorIndex = null; return performBossAction(state, 11); }
function settle(state) { while (state.currentActor === 'follow-up') state = performFollowUpAction(state, 12); return state; }
const team = (state, id) => state.teamStatuses.filter(effect => effect.id === id);
const own = (state, id, index = 0) => state.cards[index].statuses.find(effect => effect.id === id);
const aoe = (damage = 20) => ({ skills: [{ id: 'wave', name: '검증 파동', target: 'all', damage, cooldown: 1 }] });
const forceHit = state => { state.cards[0].statuses.push({ id: 'taunt', kind: 'buff', charges: 1 }); return state; };
const dead = card => { card.hp = 0; card.defeated = true; };

test('all 55 skills have real effects, complete status icons, and remain copyable after source death', () => {
  assert.equal(REMAINING_ROSTER_SKILLS.length, 55);
  for (const skill of REMAINING_ROSTER_SKILLS) {
    let state = battle(skill.id, 5, { shield: 10000 });
    state.cards.forEach(card => { card.hp = 40; card.cooldown = 2; card.statuses = [{ id: 'attack-down', kind: 'debuff', value: 10, duration: 2 }]; });
    state.cards[0].cooldown = 0; state.cards[0].statuses = [];
    const effects = value => JSON.stringify({ cards: value.cards.map(({ hp, shield, statuses }) => ({ hp, shield, statuses })), boss: value.boss, team: value.teamStatuses });
    const before = effects(state);
    state = settle(act(state));
    assert.notEqual(effects(state), before, skill.id);
    dead(state.cards[0]); state.cards[3].statuses = [];
    const originalEffects = effects(state);
    state = settle(recast(state, 3));
    assert.notEqual(effects(state), originalEffects, `${skill.id}: copy`);
    assert.equal(state.cards[0].hp, 0, `${skill.id}: source is not resurrected`);
    for (const effect of [...state.teamStatuses, ...state.cards.flatMap(card => card.statuses), ...state.boss.statuses]) {
      assert.ok(EFFECT_PRESENTATION[effect.id] || effect.icon, `${skill.id}: missing ${effect.id} icon`);
      assert.ok(effectPresentation(effect).description.length > 8, `${skill.id}: ${effect.id} description`);
    }
  }
});

test('CD0 and CD1 preparation always spends one normal action; bank caps persist through basics', () => {
  for (const [id, bankId, cap] of [
    ['simsim-ur', 'pause-fragments', 3], ['mango-ur', 'sun-seeds', 4], ['shanghai-ur', 'sword-droplets', 3],
    ['meongpeu-ur', 'future-report', 3], ['jandi-ur', 'season-leaves', 4],
  ]) {
    let state = battle(id);
    for (let count = 1; count <= cap + 1; count += 1) {
      state = recast(state, 0, { type: 'skill', choice: 'charge' });
      assert.equal(state.playerActionCount, count, id);
      assert.equal(state.currentActor, 'boss', id);
      assert.equal(own(state, bankId).stacks, Math.min(count, cap), id);
      assert.equal(state.cards[0].cooldown, REMAINING_SKILL_RULES[id].cooldown);
    }
    state = act(state, 0, { type: 'basic' });
    assert.equal(own(state, bankId).stacks, cap, id);
    state = recast(state, 0, { type: 'skill', choice: 'release' });
    assert.equal(own(state, bankId).stacks, 0, id);
    assert.equal(state.playerActionCount, cap + 3, id);
    assert.deepEqual(skillChoices(id).map(choice => choice.value), ['charge', 'release']);
  }
});

test('empty release falls back to preparation; copied banks belong to the copier', () => {
  let state = act(battle('shanghai-ur'), 0, { type: 'skill', choice: 'release' });
  assert.equal(own(state, 'sword-droplets').stacks, 1);
  assert.equal(state.totalDamage, 0);
  state = act(state, 3, { type: 'skill', choice: 'charge' });
  assert.equal(own(state, 'sword-droplets').stacks, 1);
  assert.equal(own(state, 'sword-droplets', 3).stacks, 1);
  dead(state.cards[0]);
  const before = state.totalDamage;
  state = recast(state, 3, { type: 'skill', choice: 'release' });
  assert.equal(state.totalDamage - before, Math.round(2000 * 195 / 100 * .85));
  assert.equal(own(state, 'sword-droplets').stacks, 1);
  assert.equal(own(state, 'sword-droplets', 3).stacks, 0);
});

test('stored shields, heals and attacks scale with enhancement once when released', () => {
  let state = battle('simsim-ur', 5);
  for (let n = 0; n < 3; n += 1) state = recast(state);
  state.cards.forEach(card => { card.shield = 0; });
  state = recast(state, 0, { type: 'skill', choice: 'release' });
  assert.deepEqual(state.cards.map(card => card.shield), Array(4).fill(skillMagnitude(9, 5) * 3));
  assert.equal(state.boss.statuses.find(effect => effect.id === 'freeze').charges, 1);
  state = battle('mango-ur', 5);
  for (let n = 0; n < 3; n += 1) state = recast(state);
  state.cards.forEach(card => { card.hp = 10; card.cooldown = 3; });
  state = recast(state, 0, { type: 'skill', choice: 'release' });
  assert.equal(state.cards[1].hp, 10 + skillMagnitude(8, 5) * 3);
  assert.equal(state.cards[1].cooldown, 2);
});

test('each displayed per-stack coefficient is rounded before multiplication at all six enhancements', () => {
  for (let enhancement = 0; enhancement <= 5; enhancement += 1) {
    for (const [id, base, perStack, breakPerStack] of [
      ['shanghai-ur', 100, 95, 12], ['meongpeu-ur', 90, 90, 12], ['jandi-ur', 0, 90, 10],
    ]) {
      let state = battle(id, enhancement);
      for (let count = 0; count < 3; count += 1) state = recast(state);
      const before = state.totalDamage, beforeBreak = state.boss.breakGauge;
      state = recast(state, 0, { type: 'skill', choice: 'release' });
      assert.equal(state.totalDamage - before, (skillMagnitude(base, enhancement) + 3 * skillMagnitude(perStack, enhancement)) * 10, `${id} +${enhancement}`);
      assert.equal(state.boss.breakGauge - beforeBreak, 3 * skillMagnitude(breakPerStack, enhancement), `${id} +${enhancement} break`);
    }
  }
});

test('combined lowest-HP heal and shield keep the same recipient', () => {
  let state = battle('jandi-u'); state.cards[1].hp = 50; state.cards[2].hp = 55;
  state = act(state);
  assert.equal(state.cards[1].hp, 64);
  assert.equal(state.cards[1].shield, 8);
  assert.equal(state.cards[2].shield, 0);
});

test('moon observation alternates automatically and its icon describes the actual next phase', () => {
  let state = act(battle('rayeon-ur', 5));
  assert.equal(state.totalDamage, 1820);
  assert.equal(state.boss.breakGauge, 28);
  assert.match(own(state, 'moon-observation').description, /보름.*280%/);
  assert.doesNotMatch(own(state, 'moon-observation').description, /방출/);
  state = recast(state);
  assert.equal(state.totalDamage, 4620);
  assert.equal(state.boss.statuses.find(effect => effect.id === 'damage-taken-up').value, 21);
  assert.match(own(state, 'moon-observation').description, /초승.*182%/);
});

test('checkpoint records post-heal HP, survives one direct lethal hit, and does not revive dead cards', () => {
  let state = battle('simsim-ssr', 5, { baseDamage: 200 });
  state.cards[0].hp = 50; dead(state.cards[2]);
  state = act(state);
  assert.equal(own(state, 'ghost-checkpoint').recordedHp, 78);
  assert.equal(own(state, 'ghost-checkpoint', 2), undefined);
  state = bossAct(forceHit(state));
  assert.equal(state.cards[0].hp, Math.round(78 * .84));
  state = bossAct(forceHit(state));
  assert.equal(state.cards[0].hp, 0);
  assert.equal(state.cards[2].hp, 0);
  assert.match(skillDescriptionAtEnhancement('simsim-ssr', 5), /직접 공격/);
  assert.match(skillDescriptionAtEnhancement('simsim-ssr', 5), /84%/);
});

test('checkpoint does not stop lethal damage over time', () => {
  let state = act(battle('simsim-ssr'));
  state.cards[1].hp = 2; state.cards[1].statuses.push({ id: 'burn', kind: 'debuff', value: 10, dotDamage: 10, duration: 2 });
  state = act(state, 1, { type: 'basic' });
  assert.equal(state.cards[1].hp, 0);
  assert.equal(state.cards[1].defeated, true);
});

test('dawn calendar counts enemy attack actions once, not number of targets, and ignores self buffs', () => {
  let state = act(battle('rayeon-ssr', 5, aoe(10)));
  state = bossAct(state);
  assert.equal(team(state, 'dawn-calendar')[0].charges, 2);
  state.boss.skills = [{ id: 'rest', target: 'self', damage: 0, selfBuff: { id: 'attack-up', value: 10, turns: 1 }, cooldown: 1 }];
  state = bossAct(state);
  assert.equal(team(state, 'dawn-calendar')[0].charges, 2);
  state.boss.skills = []; state.cards.forEach(card => card.statuses.push({ id: 'evasion', kind: 'buff', value: 100 }));
  state = bossAct(state);
  assert.equal(team(state, 'dawn-calendar')[0].charges, 1);
  state = bossAct(state);
  assert.equal(state.boss.breakGauge, 49);
  assert.ok(state.boss.statuses.some(effect => effect.id === 'freeze'));
});

test('fruit follow-up retains each original/copy source and scales only once after both sources die', () => {
  let state = act(battle('mango-ssr', 5));
  state = act(state, 3);
  assert.deepEqual(team(state, 'sun-orchard').map(effect => effect.charges), [3, 3]);
  dead(state.cards[0]); dead(state.cards[3]); state.cards[1].hp = 10;
  const before = state.totalDamage;
  state = act(state, 2, { type: 'basic' });
  assert.equal(state.pendingFollowUps.length, 2);
  assert.equal(state.currentActor, 'follow-up');
  const actions = state.playerActionCount;
  state = settle(JSON.parse(JSON.stringify(state)));
  assert.equal(state.totalDamage - before, 1000 + 1330 + 2261);
  assert.equal(state.cards[1].hp, 10 + 11 + 9);
  assert.equal(state.cards[0].hp, 0); assert.equal(state.cards[3].hp, 0);
  assert.equal(state.playerActionCount, actions);
  assert.deepEqual(team(state, 'sun-orchard').map(effect => effect.charges), [2, 2]);
});

test('explorer passport excludes its own cast and duplicate contributors; third distinct skill queues reward', () => {
  let state = act(battle('mond-ssr', 5));
  assert.equal(team(state, 'explorer-passport')[0].charges, 3);
  state = act(state, 1); state = recast(state, 1);
  assert.equal(team(state, 'explorer-passport')[0].charges, 2);
  state = act(state, 2);
  assert.equal(team(state, 'explorer-passport')[0].charges, 1);
  state.cards[1].hp = 10;
  state = act(state, 3, { type: 'skill' });
  assert.equal(state.currentActor, 'follow-up');
  const before = state.totalDamage;
  state = settle(state);
  assert.equal(state.totalDamage - before, 3080);
  assert.equal(state.cards[1].hp, 45);
  assert.equal(team(state, 'explorer-passport').length, 0);
});

test('returning tide caps by enhanced caster HP, stops collecting after three rounds, and survives until recast', () => {
  let state = act(battle('shanghai-ssr', 5, aoe(500)));
  const tide = team(state, 'returning-tide')[0];
  assert.equal(tide.cap, 168);
  assert.match(skillDescriptionAtEnhancement('shanghai-ssr', 5), /168%까지/);
  state.cards.forEach(card => { card.shield = 1000; });
  state = bossAct(state);
  assert.equal(team(state, 'returning-tide')[0].storedDamage, 168);
  state.round = 4; state.cards.forEach(card => { card.shield = 1000; });
  team(state, 'returning-tide')[0].storedDamage = 100;
  state.boss.cooldowns.wave = 0; state = bossAct(state);
  assert.equal(team(state, 'returning-tide')[0].storedDamage, 100);
  state.round = 6; dead(state.cards[2]); state.cards.forEach(card => { card.shield = 0; });
  state = recast(JSON.parse(JSON.stringify(state)));
  assert.equal(state.cards[0].shield, Math.floor(100 / 3) + 34);
  assert.equal(state.cards[2].shield, 0);
  assert.equal(team(state, 'returning-tide')[0].storedDamage, 0);
});

test('ink editing stores only a real cleanse and preserves stacks across idle healing', () => {
  let state = battle('sseubi-ur'); state.cards[1].hp = 10;
  state = act(state, 0, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(state.cards[1].hp, 16);
  assert.equal(own(state, 'ink-edit').stacks, 0);
  state.cards[1].statuses.push({ id: 'seal', kind: 'debuff', duration: 2 });
  state = recast(state, 0, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(own(state, 'ink-edit').stacks, 1);
  state = recast(state, 0, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(own(state, 'ink-edit').stacks, 1);
  state = recast(state, 0, { type: 'skill', choice: 'release' });
  assert.deepEqual(state.cards.map(card => card.shield), [8, 8, 8, 8]);
});

test('first stroke extends duration debuffs only and caps its bonus at four real extensions', () => {
  let state = battle('sseubi-ssr');
  state.boss.statuses = [
    ...['a', 'b', 'c', 'd', 'e'].map(id => ({ id, kind: 'debuff', duration: 2 })),
    { id: 'full', kind: 'debuff', duration: 4 }, { id: 'freeze', kind: 'debuff', duration: 1 },
    { id: 'stun', kind: 'debuff', duration: 1 }, { id: 'break-stun', kind: 'debuff', duration: 1 },
    { id: 'buff', kind: 'buff', duration: 2 }, { id: 'charges-only', kind: 'debuff', charges: 2 },
  ];
  state = act(state);
  assert.equal(state.totalDamage, 3600);
  assert.deepEqual(state.boss.statuses.slice(0, 5).map(effect => effect.duration), [3, 3, 3, 3, 3]);
  assert.equal(state.boss.statuses.find(effect => effect.id === 'full').duration, 4);
  for (const id of ['freeze', 'stun', 'break-stun']) assert.equal(state.boss.statuses.find(effect => effect.id === id).duration, 1);
  assert.equal(state.boss.statuses.find(effect => effect.id === 'buff').duration, 2);
});

test('spring hearts heal the hurt acting ally, skip full HP and do not consume on the initial cast', () => {
  let state = battle('jandi-ssr', 5); state.cards[0].hp = 10;
  state = act(state);
  assert.equal(team(state, 'spring-hearts')[0].charges, 4);
  state = act(state, 2); // Nanche is full and only deals damage.
  assert.equal(team(state, 'spring-hearts')[0].charges, 4);
  state.cards[2].hp = 60;
  state = recast(state, 2);
  assert.equal(state.cards[2].hp, 85);
  assert.equal(state.cards[2].shield, 17);
  assert.equal(state.cards[0].hp, 41); // Lower HP ally was not selected instead.
  assert.equal(team(state, 'spring-hearts')[0].charges, 3);
});

test('safe coordinates and picnic paths grant extra effects only when actual previous selection changes', () => {
  let state = battle('mond-ur'); state.cards[1].statuses.push({ id: 'seal', kind: 'debuff', duration: 2 });
  state = act(state, 0, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(state.cards[1].shield, 14); assert.ok(own(state, 'seal', 1));
  state = recast(state, 0, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(state.cards[1].shield, 28); assert.ok(own(state, 'seal', 1));
  state.cards[2].statuses.push({ id: 'seal', kind: 'debuff', duration: 2 });
  state = recast(state, 0, { type: 'skill', targetId: state.cards[2].id });
  assert.equal(state.cards[2].shield, 24); assert.equal(own(state, 'seal', 2), undefined);
  state = battle('choonsik-ur'); state.cards[1].cooldown = 3;
  state = act(state, 0, { type: 'skill', targetId: state.cards[1].id, choice: 'bridge' });
  assert.equal(state.cards[1].cooldown, 3);
  state = recast(state, 0, { type: 'skill', targetId: state.cards[1].id, choice: 'rest' });
  state = recast(state, 0, { type: 'skill', targetId: state.cards[1].id, choice: 'bridge' });
  assert.equal(state.cards[1].cooldown, 2);
});

test('tomorrow picnic resolves four growing follow-ups without spending extra normal turns', () => {
  let state = act(battle('choonsik-ssr', 5));
  dead(state.cards[0]);
  for (const multiplier of [98, 147, 196, 245]) {
    const before = state.totalDamage;
    state = act(state, 2, { type: 'basic' });
    const actions = state.playerActionCount;
    state = settle(state);
    assert.equal(state.totalDamage - before, 1000 + multiplier * 10);
    assert.equal(state.playerActionCount, actions);
  }
  assert.equal(team(state, 'tomorrow-picnic').length, 0);
});

test('star tickets consume only on later basics and reduce the attacker cooldown even if the caster died', () => {
  let state = act(battle('hoi-hr', 5));
  state = act(state, 2);
  assert.equal(team(state, 'star-transfer')[0].charges, 3);
  dead(state.cards[0]); state.cards[2].cooldown = 3; state.cards[1].hp = 20;
  state = act(state, 2, { type: 'basic' });
  assert.equal(state.cards[2].cooldown, 2);
  assert.equal(state.cards[1].hp, 31);
  assert.equal(team(state, 'star-transfer')[0].charges, 2);
});

test('newly granted next-skill buffs survive their cast and basics, then apply exactly once', () => {
  let state = act(battle('meongpeu-hr'), 0, { type: 'skill' });
  assert.equal(own(state, 'effect-up').charges, 1);
  assert.equal(own(state, 'effect-up', 1).charges, 1);
  state.cards[1].hp = 10;
  state = act(state, 1, { type: 'basic' });
  assert.equal(own(state, 'effect-up', 1).charges, 1);
  state = act(state, 1, { type: 'skill', targetId: state.cards[1].id });
  assert.equal(state.cards[1].hp, 25);
  assert.equal(own(state, 'effect-up', 1), undefined);
  state = recast(state, 0); // The refreshed buff must not be mistaken for the prior consumed one.
  assert.equal(own(state, 'effect-up').charges, 1);
});

test('break boosts survive non-breaking support and consume when a basic actually applies flat break', () => {
  let state = battle('meongpeu-u');
  state.cards[0].statuses.push({ id: 'break-up', kind: 'buff', value: 17, charges: 1 });
  state = act(state);
  assert.equal(own(state, 'break-up').charges, 1);
  state = act(state, 0, { type: 'basic' });
  assert.equal(state.boss.breakGauge, 17);
  assert.equal(own(state, 'break-up'), undefined);
});

const pvpCard = (id, side, index) => ({ id: `${side}-${index}`, cardId: id, name: id, attack: 1000, maxHp: 5000, hp: 5000,
  shield: 0, cooldown: 0, statuses: [], enhancement: 0, skillUses: 0, defeated: false });
function pvp(first) {
  return { cards: [first, 'winter-c', 'nanche-c', 'hoi-ssr'].map((id, i) => pvpCard(id, 'a', i)),
    enemies: ['winter-c', 'coca-c', 'guma-c', 'jandi-c'].map((id, i) => pvpCard(id, 'b', i)),
    teamStatuses: [], enemyTeamStatuses: [], actorIndex: 0, round: 1, seed: 37, playerActionCount: 0, runtime: {}, enemyRuntime: {} };
}
function opposite(state, actorIndex = 0) {
  return { ...state, cards: state.enemies, enemies: state.cards, teamStatuses: state.enemyTeamStatuses, enemyTeamStatuses: state.teamStatuses,
    actorIndex, runtime: state.enemyRuntime, enemyRuntime: state.runtime, playerActionCount: state.enemyRuntime?.playerActionCount || 0,
    lastCopyableSkill: state.enemyLastCopyableSkill, enemyLastCopyableSkill: state.lastCopyableSkill };
}

test('PvP dream comeback uses 50 percent HP threshold at 5000 HP and enhancement scales the heal only', () => {
  let state = pvp('simsim-hr'); state.cards[0].enhancement = 5; state.cards[0].hp = 2500;
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.cards[0].hp, 4250);
  state = pvp('simsim-hr'); state.cards[0].enhancement = 5; state.cards[0].hp = 2501;
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  assert.equal(state.cards[0].hp, 2501);
  assert.match(skillDescriptionAtEnhancement('simsim-hr', 5), /50% 이하/);
});

test('PvP emergency approval requires 25 percent actual HP loss and never revives a defeated recipient', () => {
  let state = resolvePvpCardAction(pvp('meongpeu-ssr'), { type: 'skill' });
  assert.equal(state.cards[0].shield, 1100);
  state.cards[0].shield = 0; state.cards[1].shield = 0;
  state.enemies[0].attack = 1250; state.enemies[1].attack = 1249;
  state.cards[0].statuses.push({ id: 'seal', kind: 'debuff', duration: 2 });
  let attack = resolvePvpCardAction(opposite(state), { type: 'basic', targetId: 'a-0' });
  assert.equal(attack.enemies[0].hp, 4375);
  assert.equal(attack.enemies[0].statuses.some(effect => effect.id === 'seal'), false);
  attack = resolvePvpCardAction({ ...attack, actorIndex: 1 }, { type: 'basic', targetId: 'a-1' });
  assert.equal(attack.enemies[1].hp, 3751);
  assert.equal(attack.enemies[1].statuses.find(effect => effect.id === 'emergency-approval').charges, 1);
  attack.cards[1].attack = 9999;
  attack = resolvePvpCardAction({ ...attack, actorIndex: 1 }, { type: 'basic', targetId: 'a-1' });
  assert.equal(attack.enemies[1].hp, 0);
});

test('PvP checkpoint and returning tide scale records and storage with card maximum HP', () => {
  let state = pvp('simsim-ssr'); state.cards[0].hp = 2500;
  state = resolvePvpCardAction(state, { type: 'skill' });
  assert.equal(state.cards[0].statuses.find(effect => effect.id === 'ghost-checkpoint').recordedHp, 3500);
  state.enemies[0].attack = 9999;
  const attack = resolvePvpCardAction(opposite(state), { type: 'basic', targetId: 'a-0' });
  assert.equal(attack.enemies[0].hp, 2100);
  state = pvp('shanghai-ssr'); state.cards[0].enhancement = 5;
  state = resolvePvpCardAction(state, { type: 'skill' });
  assert.equal(state.teamStatuses[0].cap, 8400);
});

test('PvP copied fruit stays independent through source death and serialized restoration', () => {
  let state = pvp('mango-ssr'); state.cards[0].enhancement = 5;
  state = resolvePvpCardAction(state, { type: 'skill', targetId: 'b-0' });
  state = resolvePvpCardAction({ ...state, actorIndex: 3 }, { type: 'skill', targetId: 'b-0' });
  assert.equal(team(state, 'sun-orchard').length, 2);
  dead(state.cards[0]); dead(state.cards[3]); state.cards[1].hp = 100;
  state = resolvePvpCardAction({ ...JSON.parse(JSON.stringify(state)), actorIndex: 2 }, { type: 'basic', targetId: 'b-1' });
  assert.equal(state.cards[1].hp, 1118); // 550 original + 468 copied, based on 5000 maximum HP.
  assert.deepEqual(team(state, 'sun-orchard').map(effect => effect.charges), [2, 2]);
  assert.equal(state.cards[0].hp, 0); assert.equal(state.cards[3].hp, 0);
});

test('growth and PvP defensive HP thresholds use a ratio rather than literal HP 50', () => {
  for (const id of ['emergency-shield', 'white-night-heart']) {
    let state = pvp('winter-c'); state.enemies[0].hp = 2600;
    state.enemies[0].statuses.push({ id, kind: 'buff', value: 20, charges: 1 });
    state.cards[0].attack = 200;
    state = resolvePvpCardAction(state, { type: 'basic', targetId: 'b-0' });
    if (id === 'emergency-shield') assert.equal(state.enemies[0].shield, 1000);
    else assert.equal(state.enemies[0].hp, 3400);
  }
});
