import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CARDS, CARD_CATALOG, EXPEDITIONS, cardById } from '../src/data/cardCatalog.js';
import {
  calculateSquadScore,
  cardExpeditionPower,
  expeditionEligibility,
  missionMinimumPower,
  settleExpedition,
  startExpedition,
} from '../src/core/expeditionEngine.js';
import { createEquipment } from '../src/core/equipment.js';

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

test('legacy cards use the same unified combat-power scale', () => {
  const legacy = cardById('rookie-analyst');

  assert.equal(legacy.stats, undefined);
  assert.equal(cardExpeditionPower(legacy), legacy.combatPower);
  assert.equal(
    calculateSquadScore([legacy.id], { [legacy.id]: 1 }, ALL_CARDS),
    legacy.combatPower,
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
  assert.deepEqual(oneMinute.map(missionMinimumPower).sort((a, b) => a - b), [5400, 26700]);
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

test('every mission is attainable by the four strongest current cards', () => {
  const strongestPower = CARD_CATALOG
    .map((card) => card.combatPower)
    .sort((a, b) => b - a)
    .slice(0, 4)
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
  }), /최소 합산 전투력 5,400/);

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
    random: sequence(0.1, 1),
  });
  const highRoll = settleExpedition({
    expedition: atMinimum,
    mission,
    now: 1000,
    random: sequence(0.9, 1),
  });
  const powerResult = settleExpedition({
    expedition: overpowered,
    mission,
    now: 1000,
    random: sequence(0.1, 1),
  });

  assert.ok(highRoll.coins > lowRoll.coins);
  assert.ok(powerResult.coins > lowRoll.coins);
  assert.equal(lowRoll.powerMultiplier, 1);
  assert.equal(powerResult.powerMultiplier, 1.22);
});

test('every expedition always completes and guarantees its displayed minimum', () => {
  for (const mission of EXPEDITIONS) {
    for (const combatPower of [mission.minimumPower, mission.minimumPower * 100]) {
      for (const rewardRoll of [0, 0.999999]) {
        const result = settleExpedition({
          expedition: {
            endsAt: 1000,
            score: combatPower,
            combatPower,
            powerScale: 'combat-power-v1',
          },
          mission,
          now: 1000,
          random: sequence(rewardRoll, 1),
        });

        assert.equal(result.success, true, mission.id);
        assert.equal(result.successChance, 1, mission.id);
        assert.ok(result.coins >= mission.reward.coins[0], mission.id);
      }
    }
  }
});

test('an in-progress expedition saved by the previous score scale still settles sensibly', () => {
  const mission = EXPEDITIONS[0];
  const result = settleExpedition({
    expedition: { endsAt: 1000, score: 100 },
    mission,
    now: 1000,
    random: sequence(0.5, 1),
  });

  assert.equal(result.effectivePower, 4000);
  assert.equal(result.powerMultiplier, 1);
  assert.equal(result.success, true);
});

test('sufficient power cannot hide a missing-card requirement in the expedition preview', () => {
  const input = {
    mission: EXPEDITIONS.find((mission) => mission.id === 'lobby-lost-found'),
    cardIds: ['hoi-ssr'],
    collection: { 'hoi-ssr': 1 },
    catalog: ALL_CARDS,
  };
  const preview = expeditionEligibility(input);
  assert.ok(preview.score >= preview.minimumPower);
  assert.equal(preview.canStart, false);
  assert.equal(preview.code, 'INSUFFICIENT_CARDS');
  assert.equal(preview.missingCards, 1);
  assert.match(preview.message, /현재 1장/);
  assert.throws(() => startExpedition(input), { message: preview.message });
});

test('expedition eligibility and dispatch agree at the level and weapon bonus boundary', () => {
  const catalog = [{ id: 'alpha', characterId: 'alpha', combatPower: 1000, role: 'attack' }];
  const input = {
    mission: { id: 'boundary', requiredCards: 1, minimumPower: 1010, durationMs: 60_000 },
    cardIds: ['alpha'], collection: { alpha: 1 }, catalog,
  };
  const insufficient = expeditionEligibility(input);
  assert.equal(insufficient.code, 'INSUFFICIENT_POWER');
  assert.equal(insufficient.missingPower, 10);
  assert.throws(() => startExpedition(input), { message: insufficient.message });

  const weapon = createEquipment({ type: 'weapon', rarity: 'c', random: () => 0.5, idFactory: () => 'weapon' });
  const equipped = { ...input, equipment: weapon };
  assert.equal(expeditionEligibility(equipped).canStart, true);
  assert.equal(expeditionEligibility(equipped).score, startExpedition(equipped).score);
  assert.equal(startExpedition(equipped).score, 1010);

  const armor = createEquipment({ type: 'armor', rarity: 'ssr', random: () => 0.5, idFactory: () => 'armor' });
  assert.equal(expeditionEligibility({ ...input, equipment: armor }).canStart, false);
  const leveled = { ...input, cardProgression: { alpha: { level: 100, experience: 0 } } };
  assert.equal(expeditionEligibility(leveled).canStart, true);
  assert.equal(expeditionEligibility(leveled).score, startExpedition(leveled).score);
});

test('every mission uses the same eligibility result for preview and dispatch', () => {
  const ids = ['hoi-ssr', 'winter-ur', 'mango-c', 'simsim-c'];
  for (const mission of EXPEDITIONS) {
    for (let count = 0; count <= ids.length; count += 1) {
      const input = { mission, cardIds: ids.slice(0, count), collection: Object.fromEntries(ids.map((id) => [id, 1])), catalog: ALL_CARDS };
      const preview = expeditionEligibility(input);
      if (preview.canStart) assert.equal(startExpedition(input).score, preview.score);
      else assert.throws(() => startExpedition(input), { message: preview.message });
    }
  }
});

test('unowned, unknown, repeated, and same-character cards cannot bypass eligibility', () => {
  const mission = { id: 'validation', requiredCards: 2, minimumPower: 1, durationMs: 60_000 };
  const base = { mission, collection: { 'hoi-ssr': 1, 'winter-ur': 0, unknown: 1, 'hoi-c': 1 }, catalog: ALL_CARDS };
  const invalid = expeditionEligibility({ ...base, cardIds: ['hoi-ssr', 'hoi-ssr', 'winter-ur', 'unknown'] });
  assert.equal(invalid.code, 'INSUFFICIENT_CARDS');
  assert.deepEqual(invalid.squad, ['hoi-ssr']);
  const duplicate = { ...base, cardIds: ['hoi-ssr', 'hoi-c'] };
  assert.equal(expeditionEligibility(duplicate).code, 'DUPLICATE_CHARACTER');
  assert.throws(() => startExpedition(duplicate), /같은 인물/);
});
