import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeRaidCardIndex,
  EFFECT_PRESENTATION,
  effectPresentation,
  normalizeRaidBattle,
  raidBattleFinished,
  raidTurnSecondsRemaining,
} from '../src/core/raidBattleView.js';

test('raid effects expose a color tone, icon, description, and remaining count', () => {
  assert.deepEqual(effectPresentation({ id: 'attack-up', turns: 2 }), {
    id: 'attack-up',
    icon: 'swords',
    label: '공격력 증가',
    description: '주는 공격력이 증가합니다.',
    tone: 'buff',
    count: 2,
    scope: 'single',
  });
  assert.equal(effectPresentation({ id: 'burn', duration: 1 }).tone, 'debuff');
  assert.equal(effectPresentation({ type: 'seal', charges: 3 }).count, 3);
});

test('every active combat status has explicit icon metadata', () => {
  const combatStatuses = [
    'accuracy-down', 'attack-down', 'attack-up', 'basic-bonus', 'break-reduction', 'break-stun',
    'break-taken-flat', 'break-taken-up', 'break-up', 'counter', 'damage-down', 'damage-reduction',
    'damage-taken-up', 'damage-up', 'debuff-block', 'debuff-resist', 'dot-reduction', 'eclipse-guard',
    'effect-up', 'emergency-shield', 'encore', 'evasion', 'finale-guard', 'foresight', 'freeze',
    'full-course', 'golden-fruit', 'guarded-by', 'guarding', 'healing-down', 'healing-taken-up',
    'ice-spire', 'new-galaxy', 'peach-seed', 'quick', 'regen', 'season-cycle', 'seal', 'shield',
    'shield-break-heal', 'skill-damage-up', 'star-follow-up', 'taunt', 'tiger-seal', 'white-night-heart',
    'world-tree-route', 'burn',
  ];
  for (const id of combatStatuses) {
    assert.ok(EFFECT_PRESENTATION[id], `${id} needs icon metadata`);
    assert.ok(EFFECT_PRESENTATION[id].icon, `${id} needs an icon`);
    assert.ok(EFFECT_PRESENTATION[id].description, `${id} needs tooltip text`);
  }
});

test('raid view uses non-empty status arrays, exposes shields, and projects party-wide effects', () => {
  const battle = normalizeRaidBattle({
    boss: {
      hp: 95, maxHp: 100, shield: 17, effects: [],
      statuses: [{ id: 'attack-down', duration: 2 }],
    },
    teamStatuses: [{ id: 'regen', name: '지속 회복', kind: 'buff', duration: 3, sourceId: 'winter-c:1' }],
    cards: [
      { id: 'winter-c:1', cardId: 'winter-c', hp: 80, maxHp: 100, shield: 9, effects: [], statuses: [{ id: 'evasion', duration: 2 }] },
      { id: 'mango-c:1', cardId: 'mango-c', hp: 62, maxHp: 100 },
      { id: 'hoi-c:1', cardId: 'hoi-c', hp: 50, maxHp: 100 },
    ],
  });
  assert.deepEqual(battle.boss.effects.map((effect) => effect.id), ['attack-down', 'shield']);
  assert.equal(battle.boss.effects.at(-1).count, 17);
  assert.equal(battle.squad[0].effects.some((effect) => effect.id === 'evasion'), true);
  assert.equal(battle.squad[0].effects.find((effect) => effect.id === 'shield').count, 9);
  assert.equal(battle.squad.every((member) => member.effects.some((effect) => effect.id === 'regen' && effect.scope === 'team')), true);
});

test('raid view normalizes engine state and reports the active card countdown', () => {
  const battle = normalizeRaidBattle({
    status: 'active',
    round: 4,
    currentActor: 'card',
    currentActorIndex: 1,
    turnDeadlineAt: 30_000,
    boss: { hp: 75_000, maxHp: 100_000, statuses: [{ id: 'freeze', duration: 1 }] },
    cards: [
      { cardId: 'winter-c', hp: 100, maxHp: 100 },
      { cardId: 'mango-c', hp: 62, maxHp: 100, cooldown: 2 },
      { cardId: 'hoi-c', hp: 0, maxHp: 100 },
    ],
  });
  assert.equal(battle.turn, 4);
  assert.equal(activeRaidCardIndex(battle), 1);
  assert.equal(raidTurnSecondsRemaining(battle, 20_001), 10);
  assert.equal(battle.squad[1].skillCooldown, 2);
  assert.equal(battle.boss.effects[0].tone, 'debuff');
  assert.equal(raidBattleFinished(battle), false);
});

test('raid view treats seven-turn and total-party-KO results as finished', () => {
  const turnLimit = normalizeRaidBattle({
    status: 'finished',
    result: 'turn-limit',
    terminationReason: 'round-limit',
    boss: { hp: 1, maxHp: 100 },
    cards: [{ hp: 100 }, { hp: 100 }, { hp: 100 }],
  });
  assert.equal(raidBattleFinished(turnLimit), true);

  const allKo = normalizeRaidBattle({
    status: 'active',
    boss: { hp: 100, maxHp: 100 },
    cards: [{ hp: 0 }, { hp: 0 }, { hp: 0 }],
  });
  assert.equal(raidBattleFinished(allKo), true);
});
