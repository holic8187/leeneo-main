'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DAILY_AUGMENTS,
  getDailyAugmentTier,
  ensureDailyAugmentState,
  selectDailyAugment,
  rerollDailyAugment,
  getDailyAugmentEffects,
  updateDailyAugmentCounters,
  consumeDailyAugmentCounter,
  serializeDailyAugment,
  buildDailyAugmentBuff
} = require('../../src/v2/services/dailyAugmentService');

function characterFixture(userId = 'augment-user') {
  return {
    userId,
    dailyAugment: {},
    markModified() {}
  };
}

test('every player receives three personal candidates from the shared daily tier', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const first = characterFixture('first');
  const second = characterFixture('second');
  const firstState = ensureDailyAugmentState(first, now);
  const secondState = ensureDailyAugmentState(second, now);

  assert.equal(firstState.tier, getDailyAugmentTier(now));
  assert.equal(secondState.tier, firstState.tier);
  assert.equal(firstState.options.length, 3);
  assert.equal(new Set(firstState.options).size, 3);
  assert.equal(secondState.options.length, 3);
  const definitions = new Map(DAILY_AUGMENTS.map((augment) => [augment.id, augment]));
  assert.ok(firstState.options.every((id) => definitions.get(id)?.tier === firstState.tier));
  assert.ok(secondState.options.every((id) => definitions.get(id)?.tier === secondState.tier));
});

test('each daily candidate slot can be rerolled once and selection is final for the day', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const character = characterFixture();
  const state = ensureDailyAugmentState(character, now);
  const original = [...state.options];

  rerollDailyAugment(character, 1, now);
  assert.equal(character.dailyAugment.options[0], original[0]);
  assert.notEqual(character.dailyAugment.options[1], original[1]);
  assert.equal(character.dailyAugment.options[2], original[2]);
  assert.throws(() => rerollDailyAugment(character, 1, now));

  selectDailyAugment(character, character.dailyAugment.options[0], now);
  assert.throws(() => selectDailyAugment(character, character.dailyAugment.options[2], now));
  assert.throws(() => rerollDailyAugment(character, 0, now));
});

test('rerolls never offer an augment that appeared in an earlier slot', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const character = characterFixture('no-repeat-reroll');
  const state = ensureDailyAugmentState(character, now);
  const offered = new Set(state.options);

  rerollDailyAugment(character, 0, now);
  const firstReplacement = character.dailyAugment.options[0];
  assert.equal(offered.has(firstReplacement), false);
  offered.add(firstReplacement);

  rerollDailyAugment(character, 2, now);
  const secondReplacement = character.dailyAugment.options[2];
  assert.equal(offered.has(secondReplacement), false);
  offered.add(secondReplacement);
  assert.deepEqual(new Set(character.dailyAugment.offeredIds), offered);
});

test('legacy reroll state restores candidates that disappeared before the history field existed', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const character = characterFixture('legacy-reroll-history');
  const state = ensureDailyAugmentState(character, now);
  const original = [...state.options];

  rerollDailyAugment(character, 0, now);
  delete character.dailyAugment.offeredIds;
  const repaired = ensureDailyAugmentState(character, now);

  assert.ok(original.every((id) => repaired.offeredIds.includes(id)));
  assert.ok(repaired.options.every((id) => repaired.offeredIds.includes(id)));
});

test('daily state, rerolls, and selection reset after Korea midnight', () => {
  const beforeMidnight = new Date('2026-07-24T14:59:00.000Z');
  const afterMidnight = new Date('2026-07-24T15:01:00.000Z');
  const character = characterFixture();
  ensureDailyAugmentState(character, beforeMidnight);
  rerollDailyAugment(character, 0, beforeMidnight);
  selectDailyAugment(character, character.dailyAugment.options[1], beforeMidnight);

  const state = ensureDailyAugmentState(character, afterMidnight);
  assert.equal(state.selectedId, '');
  assert.deepEqual(state.rerolledSlots, []);
  assert.deepEqual(state.counters, {});
  assert.equal(state.options.length, 3);
  assert.deepEqual(state.offeredIds, state.options);
});

test('augment effects expose the requested static, low-HP, party, and night values', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const character = characterFixture();
  character.dailyAugment = {
    dateKey: '2026-07-24',
    tier: 'silver',
    options: ['last_train', 'safety_helmet', 'fast_report'],
    rerolledSlots: [],
    selectedId: 'last_train',
    selectedAt: now,
    counters: {}
  };
  let effects = getDailyAugmentEffects(character, { hpPercent: 30 }, now);
  assert.equal(effects.damageIncreasePercent, 10);
  assert.equal(effects.movementSpeedIncrease, 20);

  character.dailyAugment.tier = 'gold';
  character.dailyAugment.options = ['office_politics', 'overtime_pay', 'performance_pressure'];
  character.dailyAugment.selectedId = 'office_politics';
  effects = getDailyAugmentEffects(character, { partySize: 2 }, now);
  assert.equal(effects.partyExpPercent, 1);
  assert.equal(effects.partyDamagePercent, 1);

  character.dailyAugment.selectedId = 'overtime_pay';
  effects = getDailyAugmentEffects(character, {}, now);
  assert.equal(effects.monsterExpPercent, 1.5);
  assert.equal(effects.moneyPercent, 1.5);
});

test('consumable augment counters are visible and exhausted buffs disappear', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const character = characterFixture();
  character.dailyAugment = {
    dateKey: '2026-07-24',
    tier: getDailyAugmentTier(now),
    options: ['overwork_prevention', 'performance_pressure', 'office_politics'],
    rerolledSlots: [],
    selectedId: 'overwork_prevention',
    selectedAt: now,
    counters: { lethalGuardRemaining: 1 }
  };

  assert.equal(serializeDailyAugment(character, now).selected.remaining, 1);
  assert.equal(buildDailyAugmentBuff(character, now).metadata.remaining, 1);
  assert.equal(consumeDailyAugmentCounter(character, 'lethalGuardRemaining', 1), true);
  assert.equal(buildDailyAugmentBuff(character, now), null);
});

test('progress counters update without replacing the selected augment state', () => {
  const now = new Date('2026-07-24T03:00:00.000Z');
  const character = characterFixture();
  character.dailyAugment = {
    dateKey: '2026-07-24',
    tier: getDailyAugmentTier(now),
    options: ['guma_celine', 'rayeon_delusion', 'copy_paste'],
    rerolledSlots: [],
    selectedId: 'guma_celine',
    selectedAt: now,
    counters: { activeSkillUses: 0 }
  };
  updateDailyAugmentCounters(character, (counters) => {
    counters.activeSkillUses = 29;
  });
  assert.equal(serializeDailyAugment(character, now).selected.remaining, 1);
  assert.equal(character.dailyAugment.selectedId, 'guma_celine');
});
