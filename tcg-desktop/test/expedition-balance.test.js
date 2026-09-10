import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CARDS, CARD_CATALOG, EXPEDITIONS, cardById } from '../src/data/cardCatalog.js';
import {
  calculateSquadScore,
  cardExpeditionPower,
  missionMinimumPower,
  settleExpedition,
  startExpedition,
} from '../src/core/expeditionEngine.js';

const rewardMidpoint = (mission) => (
  (mission.reward.coins[0] + mission.reward.coins[1]) / 2
);

const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

test('squad score is the exact sum of owned modern-card combat power', () => {
  const ids = ['simsim-c', 'winter-rr', 'hoi-ssr'];
  const collection = Object.fromEntries(ids.map((id) => [id, 1]));
  const expected = ids.reduce((total, id) => total + cardById(id).combatPower, 0);

  assert.equal(calculateSquadScore(ids, collection, ALL_CARDS), expected);
  assert.equal(calculateSquadScore([...ids, ids[0]], collection, ALL_CARDS), expected);
  assert.equal(calculateSquadScore([...ids, 'mango-c'], collection, ALL_CARDS), expected);
});

test('legacy stats are converted onto the current combat-power scale', () => {
  const legacy = cardById('rookie-analyst');
  const statSum = Object.values(legacy.stats).reduce((sum, value) => sum + value, 0);

  assert.equal(cardExpeditionPower(legacy), statSum * 100);
  assert.equal(
    calculateSquadScore([legacy.id], { [legacy.id]: 1 }, ALL_CARDS),
    statSum * 100,
  );
});

test('missions span one minute through twelve hours with starter and expert choices', () => {
  assert.equal(EXPEDITIONS.length, 18);
  assert.equal(Math.min(...EXPEDITIONS.map((mission) => mission.durationMs)), 60 * 1000);
  assert.equal(Math.max(...EXPEDITIONS.map((mission) => mission.durationMs)), 12 * 60 * 60 * 1000);

  const durations = [...new Set(EXPEDITIONS.map((mission) => mission.durationMs))];
  assert.ok(durations.length >= 8);
  for (const duration of durations) {
    const pair = EXPEDITIONS.filter((mission) => mission.durationMs === duration);
    assert.deepEqual(pair.map((mission) => mission.powerBand).sort(), ['expert', 'starter']);
    const starter = pair.find((mission) => mission.powerBand === 'starter');
    const expert = pair.find((mission) => mission.powerBand === 'expert');
    assert.ok(missionMinimumPower(expert) > missionMinimumPower(starter));
    assert.ok(rewardMidpoint(expert) > rewardMidpoint(starter));
  }

  const oneMinute = EXPEDITIONS.filter((mission) => mission.durationMs === 60 * 1000);
  assert.deepEqual(oneMinute.map(missionMinimumPower).sort((a, b) => a - b), [4000, 20000]);
});

test('coin expectation per hour rewards active short-mission play in both power bands', () => {
  for (const powerBand of ['starter', 'expert']) {
    const curve = EXPEDITIONS
      .filter((mission) => mission.powerBand === powerBand)
      .sort((a, b) => a.durationMs - b.durationMs)
      .map((mission) => rewardMidpoint(mission) / (mission.durationMs / (60 * 60 * 1000)));

    for (let index = 1; index < curve.length; index += 1) {
      assert.ok(curve[index - 1] > curve[index], `${powerBand}: ${curve[index - 1]} > ${curve[index]}`);
    }
  }
});

test('every mission is attainable by the three strongest current cards', () => {
  const strongestPower = CARD_CATALOG
    .map((card) => card.combatPower)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, power) => sum + power, 0);

  for (const mission of EXPEDITIONS) {
    assert.ok(missionMinimumPower(mission) <= strongestPower, mission.id);
    assert.equal(mission.recommendedScore, mission.minimumPower);
  }
});

test('an expedition cannot start below its minimum aggregate combat power', () => {
  const mission = EXPEDITIONS[0];
  const weakCard = cardById('simsim-c');
  const strongIds = ['simsim-c', 'winter-c', 'kkamdung-c'];
  const collection = Object.fromEntries(strongIds.map((id) => [id, 1]));

  assert.throws(() => startExpedition({
    mission,
    cardIds: [weakCard.id],
    collection,
    catalog: ALL_CARDS,
    now: 1000,
  }), /최소 합산 전투력 4,000/);

  const started = startExpedition({
    mission,
    cardIds: strongIds,
    collection,
    catalog: ALL_CARDS,
    now: 1000,
  });
  assert.equal(started.score, 6444);
  assert.equal(started.combatPower, 6444);
  assert.equal(started.powerScale, 'combat-power-v1');
});

test('settlement varies its roll and grants a capped bonus for excess squad power', () => {
  const mission = EXPEDITIONS[0];
  const atMinimum = {
    endsAt: 1000,
    score: mission.minimumPower,
    combatPower: mission.minimumPower,
    powerScale: 'combat-power-v1',
  };
  const overpowered = {
    ...atMinimum,
    score: mission.minimumPower * 2,
    combatPower: mission.minimumPower * 2,
  };

  const lowRoll = settleExpedition({
    expedition: atMinimum,
    mission,
    now: 1000,
    random: sequence(0, 0.1, 1),
  });
  const highRoll = settleExpedition({
    expedition: atMinimum,
    mission,
    now: 1000,
    random: sequence(0, 0.9, 1),
  });
  const powerResult = settleExpedition({
    expedition: overpowered,
    mission,
    now: 1000,
    random: sequence(0, 0.1, 1),
  });

  assert.ok(highRoll.coins > lowRoll.coins);
  assert.ok(powerResult.coins > lowRoll.coins);
  assert.equal(lowRoll.powerMultiplier, 1);
  assert.equal(powerResult.powerMultiplier, 1.22);
});

test('an in-progress expedition saved by the previous score scale still settles sensibly', () => {
  const mission = EXPEDITIONS[0];
  const result = settleExpedition({
    expedition: { endsAt: 1000, score: 100 },
    mission,
    now: 1000,
    random: sequence(0, 0.5, 1),
  });

  assert.equal(result.effectivePower, 4000);
  assert.equal(result.powerMultiplier, 1);
  assert.equal(result.success, true);
});
