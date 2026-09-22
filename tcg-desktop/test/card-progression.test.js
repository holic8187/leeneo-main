import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_CARD_HP,
  CARD_ROLES,
  MAX_CARD_LEVEL,
  cardCombatPowerAtLevel,
  cardExperienceForNextLevel,
  cardLevelUpCoinCost,
  cardMaxHpAtLevel,
  expeditionExperienceReward,
  grantCardExperience,
  normalizeCardProgression,
  purchaseCardLevel,
  raidExperienceReward,
  roleForCard,
} from '../src/core/cardProgression.js';
import { completeDueExpedition, startExpedition } from '../src/core/expeditionEngine.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';
import { ALL_CARDS, EXPEDITIONS, cardById } from '../src/data/cardCatalog.js';

test('every playable card is assigned to defense, attack, or support', () => {
  const validRoles = new Set(Object.keys(CARD_ROLES));
  for (const card of ALL_CARDS) {
    assert.equal(validRoles.has(roleForCard(card).id), true, card.id);
  }
  assert.equal(roleForCard('winter-ur').id, 'defense');
  assert.equal(roleForCard('mango-c').id, 'attack');
  assert.equal(roleForCard('meongpeu-c').id, 'support');
  assert.equal(roleForCard('coca-u').id, 'support');
  assert.equal(roleForCard('coca-rrr').id, 'defense');
  assert.equal(roleForCard('coca-ssr').id, 'attack');
});

test('level requirements rise through level 100', () => {
  let previous = 0;
  for (let level = 1; level < MAX_CARD_LEVEL; level += 1) {
    const required = cardExperienceForNextLevel(level);
    assert.ok(required > previous, `level ${level}: ${required} > ${previous}`);
    previous = required;
  }
  assert.equal(cardExperienceForNextLevel(MAX_CARD_LEVEL), 0);
});

test('roles apply their requested attack and HP growth exactly', () => {
  const level = 11;
  assert.equal(cardMaxHpAtLevel('winter-ur', { 'winter-ur': { level, experience: 0 } }), BASE_CARD_HP + 10);
  assert.equal(cardCombatPowerAtLevel(1000, 'mango-c', { 'mango-c': { level, experience: 0 } }), 1020);
  assert.equal(cardMaxHpAtLevel('meongpeu-c', { 'meongpeu-c': { level, experience: 0 } }), BASE_CARD_HP + 5);
  assert.equal(cardCombatPowerAtLevel(1000, 'meongpeu-c', { 'meongpeu-c': { level, experience: 0 } }), 1010);
});

test('save hydration migrates every owned card to level 1 and repairs invalid progress', () => {
  const hydrated = hydrateState({
    collection: { 'mango-c': 2, 'winter-ur': 1 },
    cardProgression: {
      'mango-c': { level: 15, experience: 12 },
      'winter-ur': { level: 999, experience: 999999 },
      'not-owned': { level: 50, experience: 20 },
    },
  });
  assert.deepEqual(hydrated.cardProgression['mango-c'], { level: 15, experience: 12 });
  assert.deepEqual(hydrated.cardProgression['winter-ur'], { level: 100, experience: 0 });
  assert.deepEqual(hydrated.cardProgression['simsim-c'], { level: 1, experience: 0 });
  assert.equal(hydrated.cardProgression['not-owned'], undefined);
  assert.equal(hydrated.version, 9);

  const newlyOwned = normalizeCardProgression(hydrated.cardProgression, {
    ...hydrated.collection,
    'hoi-ssr': 1,
  });
  assert.deepEqual(newlyOwned['hoi-ssr'], { level: 1, experience: 0 });
});

test('experience levels cards automatically, preserves overflow, and stops at 100', () => {
  const collection = { 'mango-c': 1 };
  const firstRequirement = cardExperienceForNextLevel(1);
  const secondRequirement = cardExperienceForNextLevel(2);
  const gained = grantCardExperience({}, ['mango-c'], firstRequirement + secondRequirement + 7, collection);
  assert.deepEqual(gained.cardProgression['mango-c'], { level: 3, experience: 7 });
  assert.equal(gained.awards[0].levelsGained, 2);

  const capped = grantCardExperience({ 'mango-c': { level: 99, experience: 0 } }, ['mango-c'], 9999999, collection);
  assert.deepEqual(capped.cardProgression['mango-c'], { level: 100, experience: 0 });
});

test('coin level-up cost follows remaining experience and rises with level', () => {
  const collection = { 'mango-c': 1 };
  const levelOne = { 'mango-c': { level: 1, experience: 0 } };
  const partiallyTrained = { 'mango-c': { level: 1, experience: 50 } };
  const highLevel = { 'mango-c': { level: 40, experience: 0 } };
  assert.ok(cardLevelUpCoinCost(levelOne, 'mango-c') > cardLevelUpCoinCost(partiallyTrained, 'mango-c'));
  assert.ok(cardLevelUpCoinCost(highLevel, 'mango-c') > cardLevelUpCoinCost(levelOne, 'mango-c'));

  const cost = cardLevelUpCoinCost(partiallyTrained, 'mango-c');
  const result = purchaseCardLevel({
    cardProgression: partiallyTrained,
    collection,
    wallet: { coins: cost + 100 },
    cardId: 'mango-c',
  });
  assert.deepEqual(result.cardProgression['mango-c'], { level: 2, experience: 0 });
  assert.equal(result.wallet.coins, 100);
  assert.throws(() => purchaseCardLevel({
    cardProgression: levelOne,
    collection,
    wallet: { coins: 0 },
    cardId: 'mango-c',
  }), /동전이 부족/);
});

test('longer and harder expeditions and higher raid performance award more experience', () => {
  const shortStarter = EXPEDITIONS.find((mission) => mission.durationMs === 60_000 && mission.powerBand === 'starter');
  const shortExpert = EXPEDITIONS.find((mission) => mission.durationMs === 60_000 && mission.powerBand === 'expert');
  const longExpert = EXPEDITIONS.find((mission) => mission.durationMs === 12 * 60 * 60 * 1000 && mission.powerBand === 'expert');
  assert.ok(expeditionExperienceReward(shortExpert) > expeditionExperienceReward(shortStarter));
  assert.ok(expeditionExperienceReward(longExpert) > expeditionExperienceReward(shortExpert));
  assert.ok(raidExperienceReward({ damageDealt: 100000, stage: 3, cleared: true })
    > raidExperienceReward({ damageDealt: 10000, stage: 1, cleared: false }));
});

test('expedition completion grants equal experience to every deployed card', () => {
  const state = createDefaultState(1000);
  const mission = EXPEDITIONS[0];
  const expedition = startExpedition({
    mission,
    cardIds: state.selectedExpeditionSquad,
    collection: state.collection,
    cardEnhancements: state.cardEnhancements,
    cardProgression: state.cardProgression,
    catalog: ALL_CARDS,
    now: 2000,
  });
  const completion = completeDueExpedition({
    state: { ...state, expedition },
    mission,
    now: expedition.endsAt,
    random: () => 0,
  });
  const expected = expeditionExperienceReward(mission);
  assert.equal(completion.result.experiencePerCard, expected);
  assert.equal(completion.result.experienceAwards.length, 4);
  for (const cardId of expedition.squad) {
    assert.equal(completion.state.cardProgression[cardId].experience, expected);
  }
});

test('level attack growth contributes to expedition squad power', () => {
  const card = cardById('shanghai-r');
  const mission = EXPEDITIONS[0];
  const collection = { [card.id]: 1 };
  const cardProgression = { [card.id]: { level: 11, experience: 0 } };
  const expedition = startExpedition({
    mission,
    cardIds: [card.id],
    collection,
    cardProgression,
    catalog: ALL_CARDS,
    now: 1000,
  });
  assert.equal(expedition.score, card.combatPower + 20);
  assert.equal(expedition.cardLevels[card.id], 11);
});
