import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeRaidCardIndex,
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
    description: '공격력 증가',
    tone: 'buff',
    count: 2,
  });
  assert.equal(effectPresentation({ id: 'burn', duration: 1 }).tone, 'debuff');
  assert.equal(effectPresentation({ type: 'seal', charges: 3 }).count, 3);
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
