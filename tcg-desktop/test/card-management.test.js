import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENHANCEMENT_SUCCESS_RATES,
  ENHANCEMENT_TOTAL_BONUSES,
  MAX_ENHANCEMENT,
  SYNTHESIS_MATERIAL_COUNT,
  SYNTHESIS_SUCCESS_RATE,
  attemptCardEnhancement,
  attemptCardSynthesis,
  autoSelectSynthesisMaterials,
  bestAvailableEnhancementForCard,
  bestEnhancementForCard,
  enhancedCardPower,
  enhancementCountsForCard,
  expeditionCardLocks,
  lockedEnhancementCounts,
  normalizeCardEnhancements,
} from '../src/core/cardManagement.js';
import { calculateSquadScore, startExpedition } from '../src/core/expeditionEngine.js';
import { createDefaultState, hydrateState } from '../src/core/gameState.js';

const rarityOrder = ['c', 'u', 'r', 'rr', 'rrr', 'sr', 'hr', 'ur', 'ssr'];
const catalog = [
  { id: 'alpha-c', rarity: 'c', combatPower: 1000 },
  { id: 'beta-c', rarity: 'c', combatPower: 1100 },
  { id: 'alpha-u', rarity: 'u', combatPower: 2000 },
  { id: 'beta-u', rarity: 'u', combatPower: 2100 },
  { id: 'alpha-r', rarity: 'r', combatPower: 3000 },
  { id: 'alpha-ssr', rarity: 'ssr', combatPower: 9000 },
];

const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

test('enhancement constants preserve the requested rates and cumulative power curve', () => {
  assert.equal(MAX_ENHANCEMENT, 5);
  assert.deepEqual(ENHANCEMENT_SUCCESS_RATES, [1, 0.86, 0.72, 0.58, 0.44]);
  assert.deepEqual(ENHANCEMENT_TOTAL_BONUSES, [0, 0.04, 0.10, 0.18, 0.28, 0.40]);
  assert.equal(SYNTHESIS_MATERIAL_COUNT, 5);
  assert.equal(SYNTHESIS_SUCCESS_RATE, 0.6);
  assert.deepEqual(
    ENHANCEMENT_TOTAL_BONUSES.map((_, stage) => enhancedCardPower(1000, stage)),
    [1000, 1040, 1100, 1180, 1280, 1400],
  );
});

test('enhancement save data is sparse, derives +0 copies, and preserves high stages when repairing', () => {
  const collection = { 'alpha-c': 3 };
  const saved = {
    'alpha-c': { 1: 4, 5: 2 },
    missing: { 5: 9 },
  };
  const normalized = normalizeCardEnhancements(saved, collection);

  assert.deepEqual(normalized, { 'alpha-c': { 1: 1, 5: 2 } });
  assert.deepEqual(
    enhancementCountsForCard(collection, normalized, 'alpha-c'),
    [0, 1, 0, 0, 0, 2],
  );
  assert.equal(bestEnhancementForCard(collection, normalized, 'alpha-c'), 5);
  assert.equal(bestEnhancementForCard(collection, normalized, 'missing'), 0);
});

test('enhancement consumes one same-card material and promotes the target on success', () => {
  const result = attemptCardEnhancement({
    collection: { 'alpha-c': 2 },
    cardEnhancements: {},
    cardId: 'alpha-c',
    targetStage: 0,
    materialStage: 0,
    random: () => 0.999,
  });

  assert.equal(result.success, true);
  assert.equal(result.successRate, 1);
  assert.equal(result.resultStage, 1);
  assert.deepEqual(result.collection, { 'alpha-c': 1 });
  assert.deepEqual(result.cardEnhancements, { 'alpha-c': { 1: 1 } });
});

test('failed enhancement keeps the target stage while still consuming its material', () => {
  const result = attemptCardEnhancement({
    collection: { 'alpha-c': 2 },
    cardEnhancements: { 'alpha-c': { 1: 1 } },
    cardId: 'alpha-c',
    targetStage: 1,
    materialStage: 0,
    random: () => 0.9,
  });

  assert.equal(result.success, false);
  assert.equal(result.successRate, 0.86);
  assert.equal(result.resultStage, 1);
  assert.deepEqual(result.collection, { 'alpha-c': 1 });
  assert.deepEqual(result.cardEnhancements, { 'alpha-c': { 1: 1 } });
});

test('enhancement requires separate target and material copies even at the same stage', () => {
  assert.throws(() => attemptCardEnhancement({
    collection: { 'alpha-c': 1 },
    cardEnhancements: { 'alpha-c': { 2: 1 } },
    cardId: 'alpha-c',
    targetStage: 2,
    materialStage: 2,
  }), /각각 준비/);

  const result = attemptCardEnhancement({
    collection: { 'alpha-c': 2 },
    cardEnhancements: { 'alpha-c': { 2: 2 } },
    cardId: 'alpha-c',
    targetStage: 2,
    materialStage: 2,
    random: () => 0,
  });
  assert.deepEqual(result.cardEnhancements, { 'alpha-c': { 3: 1 } });
});

test('enhancement protects the exact copy that departed on an expedition', () => {
  const collection = { 'alpha-c': 3 };
  const cardEnhancements = { 'alpha-c': { 2: 1, 3: 1 } };
  const locks = expeditionCardLocks({
    squad: ['alpha-c'],
    enhancementStages: { 'alpha-c': 3 },
  });

  assert.throws(() => attemptCardEnhancement({
    collection,
    cardEnhancements,
    cardId: 'alpha-c',
    targetStage: 3,
    materialStage: 0,
    lockedCards: locks,
  }), /모험에 참여하지 않는/);

  const freeCopy = attemptCardEnhancement({
    collection,
    cardEnhancements,
    cardId: 'alpha-c',
    targetStage: 2,
    materialStage: 0,
    lockedCards: locks,
    random: () => 0,
  });
  assert.deepEqual(freeCopy.cardEnhancements, { 'alpha-c': { 3: 2 } });
  assert.deepEqual(
    lockedEnhancementCounts(
      freeCopy.collection,
      freeCopy.cardEnhancements,
      locks,
    )['alpha-c'],
    [0, 0, 0, 1, 0, 0],
  );
});

test('a raid can use the strongest free duplicate without reusing the expedition copy', () => {
  const collection = { 'alpha-c': 2 };
  const cardEnhancements = { 'alpha-c': { 5: 1 } };
  const locks = expeditionCardLocks({
    squad: ['alpha-c'],
    enhancementStages: { 'alpha-c': 5 },
  });
  assert.equal(
    bestAvailableEnhancementForCard(collection, cardEnhancements, 'alpha-c', locks),
    0,
  );
  assert.equal(calculateSquadScore(
    ['alpha-c'],
    collection,
    catalog,
    cardEnhancements,
    locks,
  ), 1000);
});

test('legacy expeditions without a stage snapshot still lock the strongest copy', () => {
  const locks = expeditionCardLocks({ squad: ['alpha-c'] });
  assert.deepEqual(locks, ['alpha-c']);
  assert.equal(bestAvailableEnhancementForCard(
    { 'alpha-c': 2 },
    { 'alpha-c': { 4: 1 } },
    'alpha-c',
    locks,
  ), 0);
});

test('auto synthesis selects five lowest-rarity +0 cards and protects a locked strongest copy', () => {
  const locks = lockedEnhancementCounts(
    { 'alpha-c': 6 },
    { 'alpha-c': { 2: 1 } },
    ['alpha-c'],
  );
  assert.equal(locks['alpha-c'][2], 1);

  const fromCommon = autoSelectSynthesisMaterials({
    collection: { 'alpha-c': 6, 'alpha-u': 5 },
    cardEnhancements: { 'alpha-c': { 2: 1 } },
    catalog,
    rarityOrder,
    lockedCardIds: ['alpha-c'],
  });
  assert.deepEqual(fromCommon, Array(5).fill(null).map(() => ({
    cardId: 'alpha-c',
    enhancement: 0,
  })));

  const fromUncommon = autoSelectSynthesisMaterials({
    collection: { 'alpha-c': 5, 'alpha-u': 5 },
    cardEnhancements: {},
    catalog,
    rarityOrder,
    lockedCardIds: ['alpha-c'],
  });
  assert.ok(fromUncommon.every((material) => material.cardId === 'alpha-u'));
});

test('successful synthesis consumes five same-rarity cards and returns one next-rarity +0 card', () => {
  const result = attemptCardSynthesis({
    collection: { 'alpha-c': 5, 'beta-u': 2 },
    cardEnhancements: {},
    materials: Array(5).fill(null).map(() => ({ cardId: 'alpha-c', enhancement: 0 })),
    catalog,
    rarityOrder,
    random: sequence(0.59, 0.999),
  });

  assert.equal(result.success, true);
  assert.equal(result.resultRarity, 'u');
  assert.equal(result.outputCard.id, 'beta-u');
  assert.equal(result.collection['alpha-c'], 0);
  assert.equal(result.collection['beta-u'], 3);
  assert.deepEqual(result.cardEnhancements, {});
});

test('failed synthesis consumes enhanced materials and returns one random source-rarity +0 card', () => {
  const result = attemptCardSynthesis({
    collection: { 'alpha-c': 3, 'beta-c': 2 },
    cardEnhancements: { 'alpha-c': { 1: 1 }, 'beta-c': { 5: 1 } },
    materials: [
      { cardId: 'alpha-c', enhancement: 0 },
      { cardId: 'alpha-c', enhancement: 0 },
      { cardId: 'alpha-c', enhancement: 1 },
      { cardId: 'beta-c', enhancement: 0 },
      { cardId: 'beta-c', enhancement: 5 },
    ],
    catalog,
    rarityOrder,
    random: sequence(0.6, 0.999),
  });

  assert.equal(result.success, false);
  assert.equal(result.resultRarity, 'c');
  assert.equal(result.outputCard.id, 'beta-c');
  assert.equal(result.collection['alpha-c'], 0);
  assert.equal(result.collection['beta-c'], 1);
  assert.deepEqual(result.cardEnhancements, {});
});

test('synthesis rejects mixed rarities, highest-rarity input, and locked materials', () => {
  assert.throws(() => attemptCardSynthesis({
    collection: { 'alpha-c': 4, 'alpha-u': 1 },
    materials: [
      ...Array(4).fill(null).map(() => ({ cardId: 'alpha-c', enhancement: 0 })),
      { cardId: 'alpha-u', enhancement: 0 },
    ],
    catalog,
    rarityOrder,
  }), /같은 등급/);

  assert.throws(() => attemptCardSynthesis({
    collection: { 'alpha-ssr': 5 },
    materials: Array(5).fill(null).map(() => ({ cardId: 'alpha-ssr', enhancement: 0 })),
    catalog,
    rarityOrder,
  }), /더 높은 등급/);

  assert.throws(() => attemptCardSynthesis({
    collection: { 'alpha-c': 5 },
    materials: Array(5).fill(null).map(() => ({ cardId: 'alpha-c', enhancement: 0 })),
    catalog,
    rarityOrder,
    lockedCardIds: ['alpha-c'],
  }), /모험에 참여/);
});

test('state v6 hydrates old saves and clamps sparse enhancement counts to owned totals', () => {
  assert.equal(createDefaultState().version, 6);
  const state = hydrateState({
    version: 5,
    collection: { 'alpha-c': 2 },
    cardEnhancements: {
      'alpha-c': { 1: 4, 4: 1 },
      missing: { 5: 2 },
    },
  });

  assert.equal(state.version, 6);
  assert.deepEqual(state.cardEnhancements, { 'alpha-c': { 1: 1, 4: 1 } });
  assert.deepEqual(enhancementCountsForCard(state.collection, state.cardEnhancements, 'alpha-c'), [0, 1, 0, 0, 1, 0]);
});

test('expedition score uses the strongest owned enhancement and snapshots its stage', () => {
  const collection = { 'alpha-c': 2 };
  const cardEnhancements = { 'alpha-c': { 3: 1 } };
  assert.equal(calculateSquadScore(['alpha-c'], collection, catalog, cardEnhancements), 1180);

  const expedition = startExpedition({
    mission: {
      id: 'test-mission',
      durationMs: 1000,
      requiredCards: 1,
      minimumPower: 1100,
    },
    cardIds: ['alpha-c'],
    collection,
    cardEnhancements,
    catalog,
    now: 5000,
  });
  assert.equal(expedition.score, 1180);
  assert.deepEqual(expedition.enhancementStages, { 'alpha-c': 3 });
});
