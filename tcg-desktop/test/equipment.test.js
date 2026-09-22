import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPEDITIONS } from '../src/data/cardCatalog.js';
import {
  EQUIPMENT_BASE_BONUSES,
  createEquipment,
  equipmentDropChanceForMission,
  equipmentPartyAttackMultiplier,
  equipmentPartyHpMultiplier,
  equipmentRarityWeightsForMission,
  normalizeEquipmentInventory,
  rollExpeditionEquipmentDrop,
} from '../src/core/equipment.js';

test('equipment base stats match armor and weapon rarity rules', () => {
  assert.deepEqual(EQUIPMENT_BASE_BONUSES.armor, { c: 3, r: 6, ur: 8, ssr: 10 });
  assert.deepEqual(EQUIPMENT_BASE_BONUSES.weapon, { c: 1, r: 2, ur: 3.5, ssr: 5 });
});

test('equipment stat variance stays within ten percent and displays one decimal', () => {
  const low = createEquipment({ type: 'armor', rarity: 'ssr', random: () => 0, idFactory: () => 'low' });
  const high = createEquipment({ type: 'weapon', rarity: 'ur', random: () => 0.999999, idFactory: () => 'high' });
  assert.equal(low.bonusPercent, 9);
  assert.equal(high.bonusPercent, 3.9);
  assert.equal(Number.isInteger(low.bonusPercent * 10), true);
  assert.equal(equipmentPartyHpMultiplier(low), 1.09);
  assert.equal(equipmentPartyAttackMultiplier(high), 1.039);
});

test('longer expeditions improve equipment rarity without making SSR common', () => {
  const short = EXPEDITIONS.find((mission) => mission.durationMs === 60_000);
  const long = EXPEDITIONS.find((mission) => mission.durationMs === 720 * 60_000 && mission.powerBand === 'expert');
  const shortWeights = equipmentRarityWeightsForMission(short);
  const longWeights = equipmentRarityWeightsForMission(long);
  assert.ok(longWeights.r > shortWeights.r);
  assert.ok(longWeights.ur > shortWeights.ur);
  assert.equal(shortWeights.ssr, 0.01);
  assert.equal(longWeights.ssr, 0.01);
  assert.ok(equipmentDropChanceForMission(long) > equipmentDropChanceForMission(short));
});

test('expedition equipment drops are optional and normalized inventory rejects duplicates', () => {
  const mission = EXPEDITIONS.at(-1);
  assert.equal(rollExpeditionEquipmentDrop({ mission, random: () => 0.99 }), null);
  const draws = [0, 0.5, 0, 0.5];
  const item = rollExpeditionEquipmentDrop({
    mission,
    now: 123,
    random: () => draws.shift() ?? 0.5,
    idFactory: () => 'equipment-fixed',
  });
  assert.ok(item);
  assert.equal(item.source.missionId, mission.id);
  assert.equal(normalizeEquipmentInventory([item, item]).length, 1);
});

test('the advertised overall equipment chance is decided before any rarity or stat roll', () => {
  for (const mission of EXPEDITIONS) {
    const chance = equipmentDropChanceForMission(mission);
    let calls = 0;
    const miss = rollExpeditionEquipmentDrop({ mission, random: () => { calls += 1; return chance; } });
    assert.equal(miss, null);
    assert.equal(calls, 1, mission.id);
    const rolls = [chance - 0.000001, 0.5, 0, 0.5];
    assert.ok(rollExpeditionEquipmentDrop({ mission, random: () => rolls.shift(), idFactory: () => 'drop-test' }), mission.id);
  }
});
