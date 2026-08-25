'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TITLE_DEFINITIONS,
  PREMIUM_CHARACTER_SECONDS,
  serializeTitleState,
  reconcileAdvancementTitles,
  recordTitleEvent,
  equipTitle,
  unequipTitle,
  acknowledgeTitleAward
} = require('../../src/v2/services/titleService');

function characterFixture(overrides = {}) {
  const modified = [];
  return {
    progression: { level: 1 },
    job: { departmentId: 'unassigned', advancementTier: 0 },
    economy: { money: 0 },
    titles: {
      ownedIds: [],
      equippedId: '',
      pendingAwardIds: [],
      progress: {}
    },
    markModified(path) { modified.push(path); },
    modified,
    ...overrides
  };
}

test('the title catalog matches the configured eight titles and stat rewards', () => {
  assert.deepEqual(TITLE_DEFINITIONS.map((title) => title.name), [
    '신입사원', '고양이 집사', '명품 인성', '야수의 심장',
    '대부호', '순혈주의자', '멘탈甲', '회피형 인간'
  ]);
  const byName = Object.fromEntries(TITLE_DEFINITIONS.map((title) => [title.name, title]));
  assert.deepEqual(byName['신입사원'].stats, {
    grit: 1, processingSpeed: 1, workKnowledge: 1, awareness: 1, maxHp: 50, maxMp: 50
  });
  assert.deepEqual(byName['명품 인성'].stats, {
    grit: 3, processingSpeed: 3, workKnowledge: 3, awareness: 3,
    defense: 30, magicDefense: 30
  });
  assert.deepEqual(byName['멘탈甲'].stats, {
    grit: 3, processingSpeed: 3, workKnowledge: 3, awareness: 3,
    maxMp: 300, statusResistance: 5, magicDefense: 50
  });
  assert.deepEqual(byName['회피형 인간'].stats, {
    grit: 3, processingSpeed: 3, workKnowledge: 3, awareness: 3,
    evasion: 35, movementSpeed: 5, jump: 5
  });
});

test('locked titles and their conditions are not serialized before acquisition', () => {
  const character = characterFixture();
  const state = serializeTitleState(character);
  assert.deepEqual(state, { owned: [], equipped: null, pendingAwards: [] });
  assert.doesNotMatch(JSON.stringify(state), /레벨 10 이상|누적 12시간|주문서/);
});

test('advancement titles are awarded once and can be equipped, unequipped, and acknowledged', () => {
  const character = characterFixture({
    progression: { level: 150 },
    job: { departmentId: 'sales', advancementTier: 4 }
  });
  assert.deepEqual(
    reconcileAdvancementTitles(character).map((title) => title.name),
    ['신입사원', '순혈주의자']
  );
  assert.deepEqual(reconcileAdvancementTitles(character), []);

  const equipped = equipTitle(character, 'pure_blood');
  assert.equal(equipped.name, '순혈주의자');
  assert.equal(serializeTitleState(character).equipped.id, 'pure_blood');
  assert.equal(unequipTitle(character).id, 'pure_blood');
  assert.equal(serializeTitleState(character).equipped, null);
  assert.equal(acknowledgeTitleAward(character, 'new_employee'), true);
  assert.equal(
    serializeTitleState(character).pendingAwards.some((title) => title.id === 'new_employee'),
    false
  );
  assert.throws(() => equipTitle(character, 'cat_butler'), /획득하지 않은 칭호/);
});

test('every existing character at first advancement or higher receives the new employee title', () => {
  const beginner = characterFixture({
    progression: { level: 150 },
    job: { departmentId: 'unassigned', advancementTier: 0 }
  });
  assert.deepEqual(reconcileAdvancementTitles(beginner), []);

  for (const advancementTier of [1, 2, 3, 4]) {
    const character = characterFixture({
      progression: { level: 10 },
      job: { departmentId: 'sales', advancementTier }
    });
    reconcileAdvancementTitles(character);
    assert.equal(
      character.titles.ownedIds.includes('new_employee'),
      true,
      `${advancementTier}차 전직 캐릭터가 신입사원 칭호를 받지 못했습니다.`
    );
  }
});

test('legacy characters qualify by level and assigned job even when advancement tier is zero', () => {
  const migratedCharacter = characterFixture({
    progression: { level: 80 },
    job: { departmentId: 'sales', advancementTier: 0 }
  });
  assert.deepEqual(
    reconcileAdvancementTitles(migratedCharacter).map((title) => title.name),
    ['신입사원']
  );

  const levelNineCharacter = characterFixture({
    progression: { level: 9 },
    job: { departmentId: 'sales', advancementTier: 0 }
  });
  assert.deepEqual(reconcileAdvancementTitles(levelNineCharacter), []);
});

test('event progress awards cat, scroll, money, crafting, and evasion titles at their thresholds', () => {
  const character = characterFixture();
  recordTitleEvent(character, { type: 'cat-daily-complete', amount: 30 });
  recordTitleEvent(character, { type: 'ten-percent-scroll-failure', amount: 100 });
  recordTitleEvent(character, { type: 'money-earned', amount: 1_000_000_000 });
  recordTitleEvent(character, { type: 'side-job-craft-failure' });
  recordTitleEvent(character, { type: 'evasion', amount: 10_000 });
  assert.deepEqual(new Set(character.titles.ownedIds), new Set([
    'cat_butler', 'beast_heart', 'tycoon', 'mental_champion', 'evasive_human'
  ]));
});

test('premium character progress counts only continuous qualified hunting windows', () => {
  const character = characterFixture();
  const startedAt = 1_000;
  recordTitleEvent(character, {
    type: 'qualified-lower-level-party-hunting', now: startedAt
  });
  recordTitleEvent(character, {
    type: 'qualified-lower-level-party-hunting', now: startedAt + 120_001
  });
  assert.equal(character.titles.progress.lowerLevelPartyHuntingSeconds || 0, 0);

  const resumedAt = startedAt + 300_000;
  for (let index = 0; index <= 360; index += 1) {
    recordTitleEvent(character, {
      type: 'qualified-lower-level-party-hunting',
      now: resumedAt + index * 120_000
    });
  }
  assert.equal(character.titles.progress.lowerLevelPartyHuntingSeconds, PREMIUM_CHARACTER_SECONDS);
  assert.ok(character.titles.ownedIds.includes('premium_character'));
});
