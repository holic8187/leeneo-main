import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CARDS } from '../src/data/cardCatalog.js';
import { CARD_SKILLS, skillDescriptionAtEnhancement } from '../src/data/cardSkills.js';
import {
  createRaidBattle,
  performBossAction,
  performPlayerAction,
  skillForCard,
  startRaidBattle,
} from '../src/core/turnRaidEngine.js';

const card = (id, attack = 1000, enhancement = 0) => ({ id, name: id, combatPower: attack, enhancement });
const deck = () => [card('nanche-c'), card('winter-c'), card('hoi-c'), card('simsim-c')];
const cocaVariants = ['coca-u', 'coca-rr', 'coca-rrr', 'coca-sr', 'coca-hr', 'coca-ur', 'coca-ssr'];

test('all 83 main cards and 8 legacy cards have explicit skill information', () => {
  assert.equal(CARD_SKILLS.length, 91);
  assert.equal(ALL_CARDS.length, 91);
  for (const item of ALL_CARDS) {
    const skill = skillForCard(item.id, 0);
    assert.ok(skill, `${item.id} skill`);
    assert.ok(skill.name);
    assert.ok(skill.description);
  }
});

test('enhancement changes effect magnitudes but preserves durations and condition thresholds', () => {
  const attack = skillForCard('nanche-c', 5);
  assert.match(attack.description, /공격력 133% 피해/);
  assert.match(attack.description, /브레이크 피해 25/);
  const conditional = skillForCard('mango-c', 5);
  assert.match(conditional.description, /HP가 70% 이상/);
  assert.match(conditional.description, /피해량이 28% 증가/);
  assert.equal(skillDescriptionAtEnhancement('winter-c', 1).includes('1턴간'), true);
});

test('battle follows all four cards with one boss action after each living card', () => {
  let state = startRaidBattle(createRaidBattle({ cards: deck(), boss: { maxHp: 100000, baseDamage: 1 } }), 0);
  assert.equal(state.currentActor, 'card');
  assert.equal(state.currentActorIndex, 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.cards[0].cooldown, 3);
  assert.equal(state.currentActor, 'boss');
  state = performBossAction(state, 2);
  assert.equal(state.currentActorIndex, 1);
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  assert.equal(state.currentActorIndex, 2);
  state = performPlayerAction(state, { type: 'basic' }, 5);
  state = performBossAction(state, 6);
  assert.equal(state.currentActorIndex, 3);
  state = performPlayerAction(state, { type: 'basic' }, 7);
  state = performBossAction(state, 8);
  assert.equal(state.currentActorIndex, 0);
  assert.equal(state.round, 2);
  assert.equal(state.cards[0].cooldown, 2);
});

test('break at 100 resets gauge and skips boss actions through the breaker next turn', () => {
  let state = startRaidBattle(createRaidBattle({ cards: deck(), boss: { maxHp: 100000, baseDamage: 10 } }), 0);
  state.boss.breakGauge = 90;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.boss.breakGauge, 0);
  assert.equal(state.boss.stunned, true);
  const initialHp = state.cards.reduce((sum, item) => sum + item.hp, 0);
  for (let skipped = 0; skipped < 5; skipped += 1) {
    state = performBossAction(state, 2 + skipped * 2);
    assert.equal(state.cards.reduce((sum, item) => sum + item.hp, 0), initialHp);
    state = performPlayerAction(state, { type: 'basic' }, 3 + skipped * 2);
  }
  assert.equal(state.boss.stunned, false);
  state = performBossAction(state, 20);
  assert.equal(state.cards.reduce((sum, item) => sum + item.hp, 0), initialHp - 10);
});

test('stageConfig is retained and a boss skill damages distinct random living targets', () => {
  const stageConfig = {
    stage: 2, maxHp: 200000, basicAttackDamage: 11,
    skills: [{ id: 'double-crunch', name: '이중 마감 압박', description: '랜덤 2인에게 30 피해', cooldown: 3, targetCount: 2, damage: 30 }],
  };
  let state = startRaidBattle(createRaidBattle({ cards: deck(), stageConfig, seed: 123 }), 0);
  assert.deepEqual(state.boss.stageConfig, stageConfig);
  state = performPlayerAction(state, { type: 'basic' }, 1);
  state = performBossAction(state, 2);
  assert.equal(state.cards.reduce((sum, item) => sum + item.hp, 0), 340);
  assert.equal(state.boss.cooldowns['double-crunch'], 3);
});

test('all battle state is JSON serializable and player timeout can use deterministic basic action', () => {
  let state = startRaidBattle(createRaidBattle({ cards: deck(), seed: 99 }), 0);
  state = performPlayerAction(state, { type: 'basic', automatic: true }, 20000);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.currentActor, 'boss');
  assert.equal(restored.totalDamage, 1000);
});

test('battle keeps the server remaining HP and uses displayed enhanced power exactly once', () => {
  const cards = [card('nanche-c', 12345, 5), card('winter-c', 9000, 2), card('hoi-c', 8000, 1), card('simsim-c', 7000, 0)];
  let state = createRaidBattle({
    cards,
    stageConfig: { stage: 3, maxHp: 400000, hp: 175000, basicAttack: { damage: 12 }, skills: [] },
  });
  assert.equal(state.stage, 3);
  assert.equal(state.boss.hp, 175000);
  assert.equal(state.cards[0].attack, 12345);
  state = startRaidBattle(state, 0);
  state = performPlayerAction(state, { type: 'basic' }, 1);
  assert.equal(state.totalDamage, 12345);
});

test('an uncleared raid ends after seven full rounds and preserves this attempt score', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: deck(),
    boss: { maxHp: 1000000, baseDamage: 1 },
  }), 0);
  while (state.status === 'active') {
    state = state.currentActor === 'card'
      ? performPlayerAction(state, { type: 'basic' }, state.playerActionCount + 1)
      : performBossAction(state, state.playerActionCount + 1);
  }
  assert.equal(state.round, 7);
  assert.equal(state.result, 'turn-limit');
  assert.equal(state.terminationReason, 'round-limit');
  assert.equal(state.totalDamage, 28000);
  assert.equal(state.currentActor, null);
});

test('the raid ends immediately when every allied card is unable to act', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: deck(),
    boss: { maxHp: 1000000, baseDamage: 1000 },
  }), 0);
  while (state.status === 'active') {
    state = state.currentActor === 'card'
      ? performPlayerAction(state, { type: 'basic' }, Date.now())
      : performBossAction(state, Date.now());
  }
  assert.equal(state.result, 'defeat');
  assert.equal(state.terminationReason, 'party-defeated');
  assert.equal(state.cards.every((member) => member.hp === 0), true);
});

test('server boss skill fields map to distinct targets, cooldowns, and debuffs', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: deck(),
    stageConfig: {
      stage: 6,
      maxHp: 3200000,
      hp: 3200000,
      basicAttack: { damage: 15 },
      skills: [{
        id: 'burning-overtime', name: '불타는 야근', cooldownTurns: 4,
        target: 'all-living-cards', damage: 24,
        status: { id: 'burn', damage: 8, turns: 2 },
      }],
    },
  }), 0);
  state = performPlayerAction(state, { type: 'basic' }, 1);
  state = performBossAction(state, 2);
  assert.deepEqual(state.cards.map((member) => member.hp), [76, 76, 76, 76]);
  assert.equal(state.cards.every((member) => member.statuses.some((status) => status.id === 'burn' && status.dotDamage === 8)), true);
  assert.equal(state.boss.cooldowns['burning-overtime'], 4);
});

test('duration-based freeze skips the next boss action even when it has no charges field', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('winter-r'), card('nanche-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 10 },
  }), 0);
  state.boss.breakGauge = 68;
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.boss.statuses.some((status) => status.id === 'freeze' && status.duration === 1), true);

  // The skill also breaks the boss. Remove the break state to prove that the
  // duration-only freeze, rather than break stun, is what skips this action.
  state.boss.stunned = false;
  state.boss.statuses = state.boss.statuses.filter((status) => status.id !== 'break-stun');
  const hpBefore = state.cards.reduce((total, member) => total + member.hp, 0);
  state = performBossAction(state, 2);
  assert.equal(state.cards.reduce((total, member) => total + member.hp, 0), hpBefore);
  assert.equal(state.boss.statuses.some((status) => status.id === 'freeze'), false);
});

test('raw boss statusEffects preserve percent, duration, and damage aliases', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: deck(),
    stageConfig: {
      stage: 6, maxHp: 3_200_000, basicAttack: { damage: 1 },
      skills: [{
        id: 'raw-burn', name: '원시 화상', cooldown: 3,
        target: 'all-living-cards', damage: 1,
        statusEffects: [{ id: 'burn', damage: 7, turns: 2 }],
      }],
    },
  }), 0);
  state = performPlayerAction(state, { type: 'basic' }, 1);
  state = performBossAction(state, 2);
  for (const member of state.cards) {
    const burn = member.statuses.find((status) => status.id === 'burn');
    assert.ok(burn);
    assert.equal(burn.value, 7);
    assert.equal(burn.dotDamage, 7);
    assert.equal(burn.duration, 2);
  }
});

test('stored party effects use the caster magnitude once instead of scaling again for the acting card', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('jandi-c', 1000, 5), card('nanche-c', 1000, 5), card('hoi-c', 1000, 0), card('simsim-c', 1000, 0)],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state.cards.forEach((member) => { member.hp = 50; });
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.teamStatuses.find((status) => status.id === 'regen').value, 4);
  state = performBossAction(state, 2);
  state.cards[1].hp = 50;
  state = performPlayerAction(state, { type: 'basic' }, 3);
  assert.equal(state.cards[1].hp, 54);
});

test('seed, follow-up, and tiger seal effects each resolve once without recursively triggering each other', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('hoi-r'), card('guma-rrr'), card('coca-ur'), card('peach-c')],
    boss: { maxHp: 1_000_000, baseDamage: 1 },
    seed: 7,
  }), 0);
  for (let turn = 0; turn < 4; turn += 1) {
    state = performPlayerAction(state, { type: 'skill' }, 1 + turn * 2);
    state = performBossAction(state, 2 + turn * 2);
  }
  assert.equal(state.boss.statuses.some((status) => status.id === 'peach-seed'), true);
  assert.equal(state.boss.statuses.some((status) => status.id === 'tiger-seal'), true);
  assert.equal(state.teamStatuses.some((status) => status.name === '극광 급류 추격'), true);

  const damageBefore = state.totalDamage;
  const logIndex = state.log.length;
  state = performPlayerAction(state, { type: 'basic' }, 20);
  const linkedDamage = state.log.slice(logIndex).filter((entry) => entry.type === 'damage').map((entry) => entry.amount);
  assert.deepEqual(linkedDamage, [1000, 450, 500, 1800]);
  assert.equal(state.totalDamage - damageBefore, 3750);
  assert.equal(state.boss.statuses.some((status) => status.id === 'peach-seed'), false);
  assert.equal(state.boss.statuses.some((status) => status.id === 'tiger-seal'), false);
  assert.equal(state.teamStatuses.find((status) => status.name === '극광 급류 추격')?.charges, 2);
});

test('솜주먹 U receives its shielded-boss damage bonus without requiring an unrelated debuff', () => {
  const cards = [card('somfist-u'), card('nanche-c'), card('hoi-c'), card('simsim-c')];
  let state = startRaidBattle(createRaidBattle({
    cards,
    boss: { maxHp: 100_000, shield: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.boss.shield, 98_115);
});

test('every one of the 91 card skills applies a battle effect instead of being metadata only', () => {
  const fallbackIds = ['winter-c', 'hoi-c', 'nanche-c', 'simsim-c'];
  const effectSnapshot = (state) => JSON.stringify({
    boss: { hp: state.boss.hp, shield: state.boss.shield, breakGauge: state.boss.breakGauge, statuses: state.boss.statuses },
    cards: state.cards.map((item, index) => ({ hp: item.hp, shield: item.shield, statuses: item.statuses, supportCooldown: index ? item.cooldown : undefined })),
    teamStatuses: state.teamStatuses,
  });
  for (const skill of CARD_SKILLS) {
    const companions = fallbackIds.filter((id) => id !== skill.id).slice(0, 3);
    let state = startRaidBattle(createRaidBattle({
      cards: [card(skill.id, 1000, 2), ...companions.map((id) => card(id, 900))],
      boss: { maxHp: 100000, baseDamage: 10 },
    }), 0);
    state.cards.forEach((item, index) => { item.hp = 50 + index * 5; item.cooldown = index ? 2 : 0; });
    if (skill.id === 'hoi-ssr') state.lastCopyableSkill = { cardId: 'nanche-c', enhancement: 0, targetId: state.cards[1].id };
    const before = effectSnapshot(state);
    state = performPlayerAction(state, { type: 'skill', targetId: state.cards[1].id, choice: 'misfortune' }, 1);
    assert.notEqual(effectSnapshot(state), before, `${skill.id} (${skill.name}) must change combat state`);
  }
});

test('all seven added Coca skills apply their described immediate and persistent effects', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('coca-u'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.cards.every((member) => member.statuses.some((status) => status.id === 'evasion' && status.value === 10)), true);
  assert.equal(state.cards.every((member) => member.statuses.some((status) => status.id === 'debuff-resist' && status.value === 18)), true);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-rr'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.totalDamage, 1800);
  assert.equal(state.boss.breakGauge, 24);
  assert.equal(state.cards[0].cooldown, 3);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-rrr'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.deepEqual(state.cards.map((member) => member.shield), [15, 15, 15, 15]);
  assert.equal(state.cards.every((member) => member.statuses.some((status) => status.id === 'damage-reduction' && status.value === 18)), true);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-sr'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state.cards.forEach((member) => {
    member.hp = 50;
    member.statuses.push({ id: 'test-debuff', name: '시험 약화', kind: 'debuff', duration: 2, sourceId: 'boss' });
  });
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.deepEqual(state.cards.map((member) => member.hp), [68, 68, 68, 68]);
  assert.equal(state.cards.every((member) => member.statuses.every((status) => status.id !== 'test-debuff')), true);
  assert.equal(state.teamStatuses.find((status) => status.id === 'lotus-regen')?.charges, 3);
  state = performBossAction(state, 2);
  state = performPlayerAction(state, { type: 'basic' }, 3);
  assert.equal(state.teamStatuses.find((status) => status.id === 'lotus-regen')?.charges, 2);
  assert.equal(state.cards.reduce((sum, member) => sum + member.hp, 0), 291);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-hr'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.totalDamage, 2850);
  assert.equal(state.boss.breakGauge, 35);
  assert.equal(state.boss.statuses.some((status) => status.id === 'break-taken-up' && status.value === 25), true);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-ur'), card('winter-c'), card('hoi-c'), card('simsim-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.totalDamage, 1900);
  assert.equal(state.teamStatuses.find((status) => status.name === '극광 급류 추격')?.charges, 4);
  state = performBossAction(state, 2);
  state = performPlayerAction(state, { type: 'basic' }, 3);
  assert.equal(state.totalDamage, 3400);
  assert.equal(state.boss.breakGauge, 23);
  assert.equal(state.teamStatuses.find((status) => status.name === '극광 급류 추격')?.charges, 3);

  state = startRaidBattle(createRaidBattle({
    cards: [card('coca-ssr'), card('nanche-c'), card('winter-c'), card('hoi-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.totalDamage, 2100);
  assert.equal(state.teamStatuses.find((status) => status.id === 'prism-torrent')?.charges, 3);
  for (let index = 0; index < 3; index += 1) {
    state = performBossAction(state, 2 + index * 2);
    state = performPlayerAction(state, { type: 'basic' }, 3 + index * 2);
  }
  assert.equal(state.totalDamage, 8500);
  assert.equal(state.boss.breakGauge, 55);
  assert.equal(state.teamStatuses.some((status) => status.id === 'prism-torrent'), false);
  assert.equal(state.log.some((entry) => entry.type === 'prism-burst' && entry.storedDamage === 600), true);
});

test('SSR Hoi copies every new Coca skill after its original caster is defeated', () => {
  const effectSnapshot = (state) => JSON.stringify({
    boss: { hp: state.boss.hp, breakGauge: state.boss.breakGauge, statuses: state.boss.statuses },
    cards: state.cards.map((member) => ({ hp: member.hp, shield: member.shield, statuses: member.statuses })),
    teamStatuses: state.teamStatuses,
  });
  for (const cardId of cocaVariants) {
    let state = startRaidBattle(createRaidBattle({
      cards: [card(cardId), card('nanche-c'), card('hoi-ssr'), card('simsim-c')],
      boss: { maxHp: 1_000_000, baseDamage: 1 },
    }), 0);
    state.cards.forEach((member) => { member.hp = 60; });
    state = performPlayerAction(state, { type: 'skill' }, 1);
    state = performBossAction(state, 2);
    state.cards[0].hp = 0;
    state.cards[0].defeated = true;
    state = performPlayerAction(state, { type: 'basic' }, 3);
    state = performBossAction(state, 4);
    const beforeCopy = effectSnapshot(state);
    state = performPlayerAction(state, { type: 'skill' }, 5);
    assert.notEqual(effectSnapshot(state), beforeCopy, `${cardId} copy must apply an observable effect`);
    if (cardId === 'coca-ssr') {
      const torrents = state.teamStatuses.filter((status) => status.id === 'prism-torrent');
      assert.equal(torrents.length, 2);
      assert.equal(torrents.some((status) => status.sourceId === state.cards[2].id && status.captureRate === 17 && status.finisher === 238), true);
      assert.equal(torrents.some((status) => status.sourceId === state.cards[0].id), true);
    }
  }
});

test('copied SSR Coca prism torrent resolves from its own snapshot while the original Coca remains defeated', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('coca-ssr'), card('nanche-c'), card('hoi-ssr'), card('winter-c')],
    boss: { maxHp: 1_000_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  state = performBossAction(state, 2);
  state.cards[0].hp = 0;
  state.cards[0].defeated = true;
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  state = performPlayerAction(state, { type: 'skill' }, 5);
  const copied = state.teamStatuses.find((status) => status.id === 'prism-torrent' && status.sourceId === state.cards[2].id);
  assert.ok(copied);
  assert.equal(copied.sourceAttack, 1000);
  state = performBossAction(state, 6);
  state = performPlayerAction(state, { type: 'basic' }, 7);
  state = performBossAction(state, 8);
  state = performPlayerAction(state, { type: 'basic' }, 9);
  state = performBossAction(state, 10);
  state = performPlayerAction(state, { type: 'basic' }, 11);
  assert.equal(state.cards[0].hp, 0);
  assert.equal(state.log.some((entry) => entry.type === 'prism-burst' && entry.sourceId === state.cards[2].id), true);
});

test('a lethal contributor attack suppresses the pending prism hit and post-defeat break effects', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('coca-ssr'), card('nanche-c'), card('winter-c'), card('hoi-c')],
    boss: { maxHp: 100_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  state = performBossAction(state, 2);
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  state = performPlayerAction(state, { type: 'basic' }, 5);
  state = performBossAction(state, 6);

  const prism = state.teamStatuses.find((status) => status.id === 'prism-torrent');
  assert.equal(prism?.charges, 1);
  assert.equal(prism?.contributors.length, 2);
  state.boss.hp = 500;
  state.boss.breakGauge = 40;
  const damageBefore = state.totalDamage;
  const logStart = state.log.length;

  state = performPlayerAction(state, { type: 'basic' }, 7);

  const finalLogs = state.log.slice(logStart);
  assert.equal(state.status, 'finished');
  assert.equal(state.result, 'victory');
  assert.equal(state.totalDamage, damageBefore + 500);
  assert.equal(state.boss.breakGauge, 40);
  assert.equal(finalLogs.filter((entry) => entry.type === 'damage').length, 1);
  assert.equal(finalLogs.some((entry) => entry.type === 'prism-charge' || entry.type === 'prism-burst' || entry.type === 'break'), false);
  assert.equal(state.teamStatuses.find((status) => status.id === 'prism-torrent')?.charges, 1);
});

test('a defeated squad slot is skipped without granting the boss an extra action', () => {
  let state = startRaidBattle(createRaidBattle({ cards: deck(), boss: { maxHp: 1_000_000, baseDamage: 1 } }), 0);
  state.cards[1].hp = 0;
  state.cards[1].defeated = true;
  state = performPlayerAction(state, { type: 'basic' }, 1);
  state = performBossAction(state, 2);
  assert.equal(state.currentActor, 'card');
  assert.equal(state.currentActorIndex, 2);
  const bossActions = state.log.filter((entry) => entry.type === 'boss-basic' || entry.type === 'boss-skill').length;
  assert.equal(bossActions, 1);
});

test('SSR Hoi copies a snapshotted UR Winter skill after its original caster is defeated', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('winter-ur'), card('nanche-c'), card('hoi-ssr'), card('simsim-c')],
    boss: { maxHp: 1_000_000, baseDamage: 10 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.ok(state.teamStatuses.some((status) => status.id === 'ice-spire'));
  state = performBossAction(state, 2);
  state.cards[0].hp = 0;
  state.cards[0].defeated = true;
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  state = performPlayerAction(state, { type: 'skill' }, 5);
  const spires = state.teamStatuses.filter((status) => status.id === 'ice-spire');
  assert.equal(spires.length, 2);
  assert.ok(spires.every((status) => status.sourceId === state.cards[2].id || status.sourceId === state.cards[0].id));
});

test('SSR Hoi keeps copied self buffs when the original caster is defeated', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('shanghai-u'), card('nanche-c'), card('hoi-ssr'), card('simsim-c')],
    boss: { maxHp: 1_000_000, baseDamage: 1 },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  state = performBossAction(state, 2);
  state.cards[0].hp = 0;
  state.cards[0].defeated = true;
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  state = performPlayerAction(state, { type: 'skill' }, 5);
  assert.equal(state.cards[2].statuses.some((status) => status.id === 'damage-reduction'), true);
  assert.equal(state.cards[2].statuses.some((status) => status.id === 'counter'), true);
});

test('damage reduction buffs stack multiplicatively', () => {
  let state = startRaidBattle(createRaidBattle({ cards: deck(), boss: { maxHp: 1_000_000, baseDamage: 100 } }), 0);
  state.cards[0].statuses.push(
    { id: 'damage-reduction', value: 50, kind: 'buff', sourceId: 'a' },
    { id: 'damage-reduction', value: 50, kind: 'buff', sourceId: 'b' },
    { id: 'taunt', value: 0, kind: 'buff', charges: 1, sourceId: 'a' },
  );
  state = performPlayerAction(state, { type: 'basic' }, 1);
  state = performBossAction(state, 2);
  assert.equal(state.cards[0].hp, 75);
});

test('stage four boss actions do not erase party buffs or boss debuffs', () => {
  let state = startRaidBattle(createRaidBattle({
    cards: [card('winter-rr'), card('nanche-c'), card('rayeon-sr'), card('simsim-c')],
    stageConfig: {
      stage: 4,
      maxHp: 800_000,
      basicAttack: { damage: 13 },
      skills: [{
        id: 'urgent-revision', name: '긴급 수정 요청', cooldownTurns: 4,
        target: 'highest-power-living-card', damage: 42,
        status: { id: 'seal', turns: 1 },
      }],
    },
  }), 0);
  state = performPlayerAction(state, { type: 'skill' }, 1);
  assert.equal(state.cards.every((member) => member.statuses.some((status) => status.id === 'damage-reduction')), true);
  state = performBossAction(state, 2);
  state = performPlayerAction(state, { type: 'basic' }, 3);
  state = performBossAction(state, 4);
  state = performPlayerAction(state, { type: 'skill' }, 5);
  assert.equal(state.boss.statuses.some((status) => status.id === 'damage-taken-up'), true);
  assert.equal(state.cards.some((member) => member.statuses.some((status) => status.id === 'damage-reduction')), true);
});
