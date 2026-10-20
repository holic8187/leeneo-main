import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ALL_CARDS, CARD_CATALOG, RARITY_ORDER } from '../src/data/cardCatalog.js';
import { FIVE_CHARACTER_SKILLS } from '../src/data/fiveCharacterSkills.js';
import { skillDescriptionAtEnhancement } from '../src/data/cardSkills.js';
import { roleForCard } from '../src/core/cardProgression.js';
import { EFFECT_PRESENTATION, normalizeRaidBattle, effectPresentation } from '../src/core/raidBattleView.js';
import { createRaidBattle, startRaidBattle, performPlayerAction, performBossAction, performFollowUpAction } from '../src/core/turnRaidEngine.js';

function battle(first, enhancement = 0, boss = {}) {
  return startRaidBattle(createRaidBattle({ cards: [first, 'winter-c', 'nanche-c', 'hoi-ssr'].map((id, index) => ({
    id, attack: index === 3 ? 2000 : 1000, enhancement: index === 0 ? enhancement : 0,
  })), boss: { maxHp: 1_000_000, baseDamage: 20, ...boss }, seed: 123 }), 0);
}
function atCard(state, index, type = 'basic') {
  state.currentActor = 'card'; state.currentActorIndex = index; state.sequenceIndex = index;
  return performPlayerAction(state, { type }, 10);
}
function atBoss(state) { state.currentActor = 'boss'; state.currentActorIndex = null; return performBossAction(state, 11); }
function settle(state) { while (state.currentActor === 'follow-up') state = performFollowUpAction(state, 12); return state; }
const status = (state, id) => state.teamStatuses.find(effect => effect.id === id);
const bossAoe = { skills: [{ id: 'wave', name: '검증 파동', target: 'all', damage: 20, cooldown: 1 }] };

test('all five requested characters now have nine rarities with matching server stats and roles', () => {
  assert.equal(FIVE_CHARACTER_SKILLS.length, 29);
  assert.equal(CARD_CATALOG.length, 161);
  assert.equal(createHash('sha256').update(JSON.stringify(CARD_CATALOG.slice(0,132).map(card => [card.id,card.combatPower]))).digest('hex'),
    '734f8bac22bc0d7584bc11292e8d56e36396491950f7d2cf332bcddb05e26d48');
  for (const character of ['guma', 'kkamdung', 'somfist', 'easy', 'peach']) {
    assert.deepEqual(CARD_CATALOG.filter(card => card.characterId === character).map(card => card.rarity).sort((a,b)=>RARITY_ORDER.indexOf(a)-RARITY_ORDER.indexOf(b)), RARITY_ORDER);
  }
  const powers = JSON.parse(readFileSync(new URL('../../src/tcg/data/cardCombatPower.json', import.meta.url), 'utf8'));
  const roles = JSON.parse(readFileSync(new URL('../../src/tcg/data/cardRoles.json', import.meta.url), 'utf8'));
  for (const card of ALL_CARDS) { assert.equal(powers[card.id], card.combatPower, card.id); assert.equal(roles[card.id], roleForCard(card.id).id, card.id); }
});

test('all 29 skills produce real effects and remain copyable after the caster is defeated', () => {
  for (const skill of FIVE_CHARACTER_SKILLS) {
    let state = battle(skill.id, 5, { shield: 10000 });
    state.cards.forEach(card => { card.hp = 40; card.cooldown = 2; card.statuses = [{ id: 'seal', kind: 'debuff', duration: 2 }]; });
    state.cards[0].cooldown = 0; state.cards[0].statuses = [];
    const effects = value => JSON.stringify({ cards: value.cards.map(({ hp, shield, statuses }) => ({ hp, shield, statuses })), boss: value.boss, team: value.teamStatuses });
    const before = effects(state);
    state = settle(performPlayerAction(state, { type: 'skill' }, 1));
    assert.notEqual(effects(state), before, skill.id);
    state.cards[0].hp = 0; state.cards[0].defeated = true;
    state.cards[3].cooldown = 0; state.cards[3].statuses = [];
    const originalEffects = effects(state);
    state = settle(atCard(state, 3, 'skill'));
    assert.notEqual(effects(state), originalEffects, `${skill.id} copy`);
    assert.equal(state.cards[0].hp, 0, `${skill.id} does not revive source`);
    for (const effect of [...state.teamStatuses, ...state.cards.flatMap(card => card.statuses), ...state.boss.statuses]) {
      assert.ok(EFFECT_PRESENTATION[effect.id], `${skill.id}: missing ${effect.id} icon`);
      assert.ok(effectPresentation(effect).description.length > 8);
    }
  }
});

test('UR Guma converts precisely two incoming debuffs per target and preserves copied charges', () => {
  let state = performPlayerAction(battle('guma-ur', 5, { skills: [{ id: 'curse', target: 'all', damage: 1, statusEffects: [{ id: 'seal', duration: 2 }] }] }), { type: 'skill' }, 1);
  state = atBoss(state);
  assert.equal(state.cards[0].shield, 17);
  assert.equal(state.cards[0].statuses.find(effect => effect.id === 'scarlet-exchange').charges, 1);
  assert.ok(state.cards.every(card => !card.statuses.some(effect => effect.id === 'seal')));
  state = atCard(state, 3, 'skill');
  const wards = state.cards[1].statuses.filter(effect => effect.id === 'scarlet-exchange');
  assert.equal(wards.length, 2); assert.deepEqual(wards.map(effect => effect.charges), [1, 2]);
  assert.equal(wards[1].value, 17 * .85);
});

test('SSR Guma records actual HP loss once per boss action and resolves in an explicit follow-up', () => {
  let state = performPlayerAction(battle('guma-ssr', 0, bossAoe), { type: 'skill' }, 1);
  for (let index = 0; index < 3; index += 1) {
    state.boss.cooldowns.wave = 0;
    state = atBoss(state);
  }
  assert.equal(status(state, 'karma-ledger').storedDamage, 168);
  assert.equal(status(state, 'karma-ledger').ready, true);
  assert.equal(state.totalDamage, 0);
  state.cards[0].hp = 0; state.cards[0].defeated = true;
  state = atCard(state, 1);
  assert.equal(state.currentActor, 'follow-up');
  const count = state.playerActionCount;
  const before = state.totalDamage;
  state = performFollowUpAction(JSON.parse(JSON.stringify(state)), 12);
  assert.equal(state.totalDamage - before, 5760);
  assert.equal(state.playerActionCount, count);
  assert.equal(state.cards[1].hp, 76);
  assert.equal(state.cards[0].hp, 0);
});

test('UR Kkamdung blocks direct HP damage but not debuffs and waits until the next ally acts to strike', () => {
  let state = battle('kkamdung-ur', 0, { skills: [{ id: 'curse', target: 'all', damage: 20, statusEffects: [{ id: 'damage-down', value: 10, duration: 2 }] }] });
  state.cards[1].hp = 80;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  state = atBoss(state);
  assert.equal(state.cards[1].hp, 80);
  assert.ok(state.cards[1].statuses.some(effect => effect.id === 'damage-down'));
  assert.equal(state.totalDamage, 0);
  state = atCard(state, 2);
  assert.equal(state.currentActor, 'follow-up');
  const before = state.totalDamage;
  state = settle(state);
  assert.equal(state.totalDamage - before, 1100);
  assert.equal(state.boss.breakGauge, 15);
  assert.equal(status(state, 'shadow-retaliation'), undefined);
});

test('SSR Kkamdung steals actual boss buffs, never debuffs, and keeps charges when nothing can be stolen', () => {
  let state = battle('kkamdung-ssr', 0, { skills: [{ id: 'armor', target: 'self', damage: 0, selfBuff: { id: 'damage-reduction', value: 30, turns: 3 } }] });
  state.boss.statuses = [{ id: 'attack-up', kind: 'buff', value: 10 }, { id: 'attack-down', kind: 'debuff', value: 10, duration: 3 }];
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.boss.statuses.filter(effect => effect.kind === 'buff').length, 0);
  state = atBoss(state);
  assert.equal(status(state, 'moon-usurp').charges, 2);
  assert.equal(state.boss.statuses.filter(effect => effect.kind === 'buff').length, 0);
  assert.ok(state.boss.statuses.some(effect => effect.id === 'attack-down'));
  assert.ok(state.cards.every(card => card.statuses.some(effect => effect.id === 'damage-up')));
  state = atBoss(state);
  assert.equal(status(state, 'moon-usurp').charges, 2);
});

test('UR Somfist passes only absorbed shield damage to the next living party member', () => {
  let state = performPlayerAction(battle('somfist-ur'), { type: 'skill' }, 1);
  state.cards[1].hp = 0; state.cards[1].defeated = true;
  state.cards[0].statuses.push({ id: 'taunt', charges: 1, kind: 'buff' });
  state = atBoss(state);
  assert.equal(state.cards[0].shield, 4);
  assert.equal(state.cards[2].shield, 36);
  assert.equal(state.cards[1].shield, 24);
  assert.equal(state.log.filter(entry => entry.type === 'cushion-relay').length, 1);
});

test('SSR Somfist borrows exactly enough shield without cloning it or touching defeated donors', () => {
  let state = performPlayerAction(battle('somfist-ssr', 0, { baseDamage: 50 }), { type: 'skill' }, 1);
  state.cards[0].statuses.push({ id: 'taunt', charges: 1, kind: 'buff' });
  const before = state.cards.reduce((sum, card) => sum + card.shield, 0);
  state = atBoss(state);
  assert.equal(state.cards[0].hp, 100);
  assert.equal(state.cards[0].shield, 0);
  assert.equal(state.cards[1].shield, 10);
  assert.equal(state.cards.reduce((sum, card) => sum + card.shield, 0), before - 50);
  state.cards[1].hp = 0; state.cards[1].shield = 1000;
  state.cards[0].statuses.push({ id: 'taunt', charges: 1, kind: 'buff' });
  state = atBoss(state);
  assert.equal(state.cards[1].shield, 1000);
});

test('UR Easy crossfade counts only regular later actions and triggers on alternating kinds', () => {
  let state = performPlayerAction(battle('easy-ur'), { type: 'skill' }, 1);
  assert.equal(status(state, 'crossfade-beat').charges, 4);
  state = atCard(state, 1); assert.equal(state.currentActor, 'boss');
  state = atCard(state, 2); assert.equal(state.currentActor, 'boss');
  state.cards[1].hp = 50;
  state = atCard(state, 1, 'skill');
  assert.equal(state.currentActor, 'follow-up');
  const count = state.playerActionCount, before = state.totalDamage;
  state = settle(state);
  assert.equal(state.totalDamage - before, 900);
  assert.equal(state.cards[1].hp, 70);
  assert.equal(state.playerActionCount, count);
  assert.equal(status(state, 'crossfade-beat').charges, 1);
  state = settle(atCard(state, 2));
  assert.equal(status(state, 'crossfade-beat'), undefined);
});

test('SSR Easy records HP after healing, excludes its cast, and consumes each target only once', () => {
  let state = battle('easy-ssr'); state.cards[1].hp = 50;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.cards[0].statuses.find(effect => effect.id === 'backbeat-rewind').charges, 1);
  assert.equal(state.cards[1].statuses.find(effect => effect.id === 'backbeat-rewind').recordedHp, 68);
  state.cards[1].hp = 20;
  state = atCard(state, 1, 'skill');
  assert.equal(state.cards[1].hp, 68);
  assert.equal(state.cards[1].shield, 18);
  assert.ok(!state.cards[1].statuses.some(effect => effect.id === 'backbeat-rewind'));
  state.cards[1].hp = 20; state.cards[1].cooldown = 0;
  state = atCard(state, 1, 'skill');
  assert.equal(state.cards[1].hp, 32);
});

test('UR Peach grows only on the recipients own actions and blooms at the fixed 60 percent threshold', () => {
  let state = performPlayerAction(battle('peach-ur', 5), { type: 'skill' }, 1);
  state = atCard(state, 1);
  assert.equal(state.cards[1].statuses.find(effect => effect.id === 'blossom-letter').growthCount, 1);
  assert.equal(state.cards[2].statuses.find(effect => effect.id === 'blossom-letter').growthCount, 0);
  state.cards[1].hp = 40;
  state = atCard(state, 1);
  assert.equal(state.cards[1].hp, 90); // 42 + 8 growth, never rescaled.
  assert.equal(state.cards[1].shield, 21);
  assert.ok(!state.cards[1].statuses.some(effect => effect.id === 'blossom-letter'));
  assert.match(skillDescriptionAtEnhancement('peach-ur', 5), /60% 이하/);
  assert.match(skillDescriptionAtEnhancement('peach-ur', 5), /42% 회복/);
});

test('SSR Peach redistributes total HP by max HP, never revives, and skips non-attacking boss actions', () => {
  let state = battle('peach-ssr');
  state.cards[0].hp = 20; state.cards[1].maxHp = 200; state.cards[1].hp = 100;
  state.cards[2].hp = 60; state.cards[3].hp = 0;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.deepEqual(state.cards.map(card => card.hp), [65, 130, 65, 0]);
  const view = normalizeRaidBattle(state);
  assert.ok(view.squad[0].effects.some(effect => effect.id === 'spring-link' && effect.scope === 'team'));
  state.boss.stunned = true; state = atBoss(state);
  assert.equal(status(state, 'spring-link').charges, 2);
  state.boss.stunned = false;
  state = atBoss(state);
  assert.equal(state.cards[3].hp, 0);
  assert.equal(status(state, 'spring-link').charges, 1);
  assert.equal(state.cards[0].hp / 100, state.cards[1].hp / 200);
});

test('copied enhanced karma uses separate snapshots at 85 percent after both casters fall', () => {
  let state = performPlayerAction(battle('guma-ssr', 5), { type: 'skill' }, 1);
  state = atCard(state, 3, 'skill');
  const ledgers = state.teamStatuses.filter(effect => effect.id === 'karma-ledger');
  assert.equal(ledgers.length, 2);
  assert.deepEqual(ledgers.map(effect => effect.finisher), [336, 336 * .85]);
  ledgers.forEach(effect => { effect.ready = true; effect.storedDamage = 10; });
  state.cards[0].hp = 0; state.cards[3].hp = 0;
  state.cards[1].hp = 40;
  state = atCard(state, 1);
  assert.equal(state.pendingFollowUps.length, 2);
  const before = state.totalDamage;
  state = settle(JSON.parse(JSON.stringify(state)));
  assert.equal(state.totalDamage - before, 3660 + 6222);
  assert.equal(state.cards[1].hp, 86);
  assert.equal(state.cards[0].hp, 0); assert.equal(state.cards[3].hp, 0);
  assert.equal(state.teamStatuses.filter(effect => effect.id === 'karma-ledger').length, 0);
});

test('copied shadow cannot consume the original charge and its deferred strike scales exactly once', () => {
  let state = battle('kkamdung-ur', 5, { baseDamage: 50 });
  state.cards[1].hp = 80;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  state = atCard(state, 3, 'skill');
  state.cards[0].hp = 0; state.cards[3].hp = 0;
  // Three real hits consume the original two shadows, then exactly one copy.
  for (let index = 0; index < 3; index += 1) {
    state.cards[1].statuses.push({ id: 'taunt', kind: 'buff', charges: 1 });
    state = atBoss(state);
  }
  const remaining = state.cards[1].statuses.filter(effect => effect.id === 'moon-double');
  assert.equal(remaining.length, 1); assert.equal(remaining[0].sourceId, state.cards[3].id); assert.equal(remaining[0].charges, 1);
  state = atCard(state, 1);
  assert.equal(state.pendingFollowUps.length, 3);
  const before = state.totalDamage;
  state = settle(state);
  assert.equal(state.totalDamage - before, 1540 * 2 + 2618);
  assert.equal(state.cards[1].hp, 80);
});

test('lethal regular attacks discard pending expansion follow-ups without phantom damage or revival', () => {
  let state = performPlayerAction(battle('guma-ssr'), { type: 'skill' }, 1);
  Object.assign(status(state, 'karma-ledger'), { ready: true, storedDamage: 100 });
  state.boss.hp = 10;
  state = atCard(state, 1);
  assert.equal(state.status, 'finished');
  assert.equal(state.totalDamage, 10);
  assert.equal(state.pendingFollowUps.length, 0);
  assert.ok(!state.log.some(entry => entry.type === 'expansion-karma'));
});

test('SSR Easy keeps its rewind when HP has not fallen and activates only on a later damaged skill', () => {
  let state = performPlayerAction(battle('easy-ssr'), { type: 'skill' }, 1);
  state = atCard(state, 1, 'skill');
  assert.equal(state.cards[1].hp, 100);
  assert.equal(state.cards[1].shield, 0);
  assert.equal(state.cards[1].statuses.find(effect => effect.id === 'backbeat-rewind').charges, 1);
  assert.ok(!state.log.some(entry => entry.type === 'backbeat-rewind'));
  state.cards[1].hp = 60; state.cards[1].cooldown = 0;
  state = atCard(state, 1, 'skill');
  assert.equal(state.cards[1].hp, 100);
  assert.equal(state.cards[1].shield, 18);
  assert.ok(!state.cards[1].statuses.some(effect => effect.id === 'backbeat-rewind'));
  assert.equal(state.log.filter(entry => entry.type === 'backbeat-rewind').length, 1);
});

test('Guma and Peach SSR count one boss attack action even when every target evades', () => {
  for (const [cardId, effectId, limit] of [['guma-ssr', 'karma-ledger', 3], ['peach-ssr', 'spring-link', 2]]) {
    let state = performPlayerAction(battle(cardId, 0, bossAoe), { type: 'skill' }, 1);
    state.cards.forEach(card => card.statuses.push({ id: 'evasion', value: 100, kind: 'buff', duration: 3 }));
    for (let index = 0; index < limit; index += 1) {
      state.boss.cooldowns.wave = 0;
      state = atBoss(state);
      if (index < limit - 1) assert.equal(status(state, effectId).charges, limit - index - 1, cardId);
    }
    assert.equal(state.log.filter(entry => entry.type === 'evade').length, 4 * limit, cardId);
    if (cardId === 'guma-ssr') {
      assert.equal(status(state, effectId).ready, true);
      assert.equal(status(state, effectId).storedDamage, 0);
      state = atCard(state, 1);
      assert.equal(state.currentActor, 'follow-up');
    } else assert.equal(status(state, effectId), undefined);
  }
});

test('SSR direct-attack counters exclude skips, self buffs and mark preparation', () => {
  for (const [cardId, effectId, initial] of [['guma-ssr', 'karma-ledger', 3], ['peach-ssr', 'spring-link', 2]]) {
    for (const mode of ['stun', 'freeze', 'self-buff', 'mark']) {
      const boss = mode === 'self-buff' ? { skills: [{ id: 'armor', target: 'self', selfShield: 100, cooldown: 1 }] }
        : mode === 'mark' ? { skills: [{ id: 'mark', cooperativePattern: 'resonance-mark', markDamage: 30, cooldown: 3 }] } : {};
      let state = performPlayerAction(battle(cardId, 0, boss), { type: 'skill' }, 1);
      if (mode === 'stun') state.boss.stunned = true;
      if (mode === 'freeze') state.boss.statuses.push({ id: 'freeze', kind: 'debuff', charges: 1 });
      state = atBoss(state);
      assert.equal(status(state, effectId).charges, initial, `${cardId} ${mode}`);
    }
  }
});

test('SSR Kkamdung never steals a buff during a skipped boss action', () => {
  for (const skip of ['stun', 'freeze']) {
    let state = performPlayerAction(battle('kkamdung-ssr'), { type: 'skill' }, 1);
    state.boss.statuses.push({ id: 'attack-up', kind: 'buff', value: 20, duration: 3 });
    if (skip === 'stun') state.boss.stunned = true;
    else state.boss.statuses.push({ id: 'freeze', kind: 'debuff', charges: 1 });
    state = atBoss(state);
    assert.equal(status(state, 'moon-usurp').charges, 3, skip);
    assert.ok(state.boss.statuses.some(effect => effect.id === 'attack-up'));
    assert.ok(!state.log.some(entry => entry.type === 'moon-usurp'));
    state.boss.stunned = false;
    state = atBoss(state);
    assert.equal(status(state, 'moon-usurp').charges, 2);
    assert.ok(!state.boss.statuses.some(effect => effect.id === 'attack-up'));
  }
});

test('UR Kkamdung chooses the lowest living HP ratio without a manual target, including when copied', () => {
  let state = battle('kkamdung-ur');
  state.cards[1].hp = 70; // 70 percent, less damage in absolute HP.
  state.cards[2].maxHp = 200; state.cards[2].hp = 100; // 50 percent wins.
  state = performPlayerAction(state, { type: 'skill', targetId: state.cards[1].id }, 1);
  assert.ok(state.cards[2].statuses.some(effect => effect.id === 'moon-double'));
  assert.ok(!state.cards[1].statuses.some(effect => effect.id === 'moon-double'));
  state.cards[2].hp = 0;
  state = atCard(state, 3, 'skill');
  assert.ok(state.cards[1].statuses.some(effect => effect.id === 'moon-double' && effect.sourceId === state.cards[3].id));
  assert.match(skillDescriptionAtEnhancement('kkamdung-ur'), /HP 비율이 가장 낮은 생존 아군/);
});
