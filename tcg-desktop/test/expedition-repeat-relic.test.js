import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CARDS, EXPEDITIONS } from '../src/data/cardCatalog.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { createEquipment } from '../src/core/equipment.js';
import { startExpedition, settleExpedition, completeDueExpedition, repeatExpedition } from '../src/core/expeditionEngine.js';

function fixture() {
  const state = createDefaultState(1000);
  state.relicInventory = { 'luxury-bag': 2 };
  const mission = EXPEDITIONS[0];
  state.equipmentInventory = [createEquipment({ id: 'repeat-armor', type: 'armor', rarity: 'c', variancePercent: 0, now: 1000 })];
  state.expedition = startExpedition({
    mission, cardIds: state.selectedExpeditionSquad, collection: state.collection,
    equipment: state.equipmentInventory[0], relicId: 'luxury-bag', relicInventory: state.relicInventory,
    catalog: ALL_CARDS, now: 1000,
  });
  return { state, mission };
}

test('bag grants exactly 5% of final coins, rounds once, does not multiply packs or duplicate relic count', () => {
  const { state, mission } = fixture();
  const now = state.expedition.endsAt;
  const base = settleExpedition({ expedition: { ...state.expedition, relicId: '' }, mission, now, random: () => 0.3 });
  const result = settleExpedition({ expedition: state.expedition, mission, now, random: () => 0.3 });
  assert.equal(result.coins, Math.round(base.coins * 1.05));
  assert.equal(result.packs, base.packs);
  assert.equal(result.relicBonusCoins, result.coins - base.coins);
  assert.equal(result.relicMultiplier, 1.05);
});

test('only owned known relics can enter the dispatch snapshot; changing selection does not affect settlement', () => {
  const { state, mission } = fixture();
  const plain = startExpedition({ mission, cardIds: state.selectedExpeditionSquad, collection: state.collection, relicId: 'luxury-bag', catalog: ALL_CARDS });
  assert.equal(plain.relicId, '');
  state.selectedExpeditionArtifactId = '';
  const completion = completeDueExpedition({ state, mission, now: state.expedition.endsAt, random: () => 0.5 });
  assert.equal(completion.result.relicMultiplier, 1.05);
  assert.equal(completion.state.lastCompletedExpedition.artifactCardId, 'luxury-bag');
});

test('completed adventure survives hydration and repeats the original mission, ordered cards, equipment and relic', () => {
  const { state, mission } = fixture();
  const completion = completeDueExpedition({ state, mission, now: state.expedition.endsAt, random: () => 0.9 });
  const saved = hydrateState(completion.state);
  saved.selectedExpeditionSquad = ['winter-c'];
  saved.selectedExpeditionEquipmentId = '';
  saved.selectedExpeditionArtifactId = '';
  const repeated = repeatExpedition({ state: saved, missions: EXPEDITIONS, catalog: ALL_CARDS, now: 500000 });
  assert.equal(repeated.missionId, state.expedition.missionId);
  assert.deepEqual(repeated.squad, state.expedition.squad);
  assert.equal(repeated.equipment.id, state.expedition.equipment.id);
  assert.equal(repeated.relicId, 'luxury-bag');
  assert.equal(repeated.startedAt, 500000);
  assert.equal(repeated.endsAt, 500000 + mission.durationMs);
  assert.equal(completeDueExpedition({ state: saved, mission, now: 500000 }), null);
  assert.throws(() => repeatExpedition({ state: { ...saved, expedition: repeated }, missions: EXPEDITIONS, catalog: ALL_CARDS }), /진행 중/);
});

test('repeat never silently drops missing cards, equipment, or relics and rechecks mission power', () => {
  const { state, mission } = fixture();
  const saved = completeDueExpedition({ state, mission, now: state.expedition.endsAt, random: () => 0.9 }).state;
  const call = (candidate, missions = EXPEDITIONS) => repeatExpedition({ state: candidate, missions, catalog: ALL_CARDS });
  assert.throws(() => call({ ...saved, collection: {} }), /카드가 부족/);
  assert.throws(() => call({ ...saved, equipmentInventory: [] }), /장비가 없/);
  assert.throws(() => call({ ...saved, relicInventory: {} }), /유물이 없/);
  assert.throws(() => call(saved, [{ ...mission, minimumPower: 99999999 }]), /전투력/);
  assert.throws(() => call({ ...saved, lastCompletedExpedition: null }), /완료 모험/);
});
