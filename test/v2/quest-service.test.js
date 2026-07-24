'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { NPC_CATALOG } = require('../../src/v2/quests/questCatalog');
const {
  acceptQuest,
  buildNpcView,
  buildQuestJournal,
  getQuestPeriodKey,
  recordMapVisit,
  recordMonsterKills,
  recordBossKill,
  recordQuestEvent,
  resolveQuestRewards,
  claimQuest
} = require('../../src/v2/services/questService');
const { getSkillInvestmentCap } = require('../../src/v2/skills/skillService');
const { SKILL_DEFINITIONS } = require('../../src/v2/skills/skillDefinitions');
const { addInventoryItem, getItemQuantity } = require('../../src/v2/services/inventoryService');

function characterFixture() {
  return {
    quests: { active: [], completedIds: [] },
    inventory: {
      items: [], potions: [],
      slotCapacities: { equipment: 20, consumable: 20, misc: 20, cash: 20 },
      quickSlots: { hp: '', mp: '' }
    },
    markModified() {}
  };
}

test('NPCs cover at least seventy percent of maps and include every requested name', () => {
  assert.ok(new Set(NPC_CATALOG.map((npc) => npc.mapId)).size >= 29);
  const names = NPC_CATALOG.map((npc) => npc.name).join(' ');
  for (const requested of ['피치','심심쓰','비숍이','겨부장','코카','호이','몬드','쓰바리','멍프','이지','난체','솜주먹','파이','춘식이']) {
    assert.ok(names.includes(requested), requested);
  }
});

test('kill, visit, collect, and boss quests persist and complete independently', () => {
  const character = characterFixture();
  acceptQuest(character, 'simsim_dust');
  recordMonsterKills(character, Array(40).fill('paper_dust'));
  assert.equal(buildQuestJournal(character).active[0].status, 'ready');
  const simsimRewards = claimQuest(character, 'simsim_dust');
  assert.equal(simsimRewards.exp, 70);
  assert.equal(simsimRewards.money, 3000);
  assert.deepEqual(simsimRewards.items, [{ itemId: 'hard_candy', name: '알사탕', quantity: 50 }]);
  assert.throws(
    () => acceptQuest(character, 'simsim_dust'),
    /이미 완료한 퀘스트/
  );

  acceptQuest(character, 'hoi_delivery');
  recordMapVisit(character, 'hr_reception');
  assert.equal(buildQuestJournal(character).active[0].status, 'ready');
  claimQuest(character, 'hoi_delivery');

  acceptQuest(character, 'bishop_memo');
  addInventoryItem(character, 'monster_loot_paper_dust', 50);
  assert.equal(buildQuestJournal(character).active[0].status, 'ready');
  claimQuest(character, 'bishop_memo');
  assert.equal(getItemQuantity(character, 'monster_loot_paper_dust'), 0);

  acceptQuest(character, 'winter_hwang');
  recordBossKill(character, 'mad_hwang_manager');
  assert.equal(buildQuestJournal(character).active[0].status, 'ready');
});

test('quest rewards stay hidden until the objective is complete', () => {
  const character = characterFixture();
  const available = buildNpcView(character, 'training_simsim').quests.find((quest) => quest.id === 'simsim_dust');
  assert.equal(available.status, 'available');
  assert.equal(available.rewards, undefined);

  acceptQuest(character, 'simsim_dust');
  const active = buildQuestJournal(character).active[0];
  assert.equal(active.status, 'active');
  assert.equal(active.rewards, undefined);

  recordMonsterKills(character, Array(40).fill('paper_dust'));
  const ready = buildQuestJournal(character).active[0];
  assert.equal(ready.status, 'ready');
  assert.ok(ready.rewards);
});

test('random quest rewards resolve exactly one item from the configured pool', () => {
  const rewards = resolveQuestRewards({
    exp: 100,
    randomItems: [{
      name: '테스트 주문서',
      options: [
        { itemId: 'first', name: '첫째', quantity: 1 },
        { itemId: 'second', name: '둘째', quantity: 1 }
      ]
    }]
  }, () => 0.99);
  assert.deepEqual(rewards.items, [{ itemId: 'second', name: '둘째', quantity: 1 }]);
});

test('special contract quest consumes fifty contracts and grants its selected glove scroll', () => {
  const character = characterFixture();
  acceptQuest(character, 'neo_contract');
  addInventoryItem(character, 'monster_loot_sales_fox', 50);

  const ready = buildQuestJournal(character).active.find(
    (quest) => quest.id === 'neo_contract'
  );
  assert.equal(ready.status, 'ready');

  const rewards = claimQuest(character, 'neo_contract', () => 0);
  for (const item of rewards.items) {
    addInventoryItem(character, item.itemId, item.quantity);
  }
  assert.equal(getItemQuantity(character, 'monster_loot_sales_fox'), 0);
  assert.equal(getItemQuantity(character, 'scroll_gloves_공격력_10'), 1);
  assert.equal(buildQuestJournal(character).active.length, 0);
  assert.ok(character.quests.completedIds.includes('neo_contract'));
});

test('daily quests reset at Korea midnight while weekly quests reset on Monday', () => {
  const character = characterFixture();
  const monday = new Date('2026-07-13T01:00:00.000Z');
  const mondayEvening = new Date('2026-07-13T14:00:00.000Z');
  const nextKoreaDay = new Date('2026-07-13T15:01:00.000Z');
  const nextMonday = new Date('2026-07-20T01:00:00.000Z');

  acceptQuest(character, 'chunsik_ghost', mondayEvening);
  recordMonsterKills(character, Array(180).fill('audit_ghost'), mondayEvening);
  claimQuest(character, 'chunsik_ghost', Math.random, mondayEvening);
  assert.throws(() => acceptQuest(character, 'chunsik_ghost', mondayEvening), /오늘 이미/);
  assert.doesNotThrow(() => acceptQuest(character, 'chunsik_ghost', nextKoreaDay));

  acceptQuest(character, 'jjor_chameleon', monday);
  recordMonsterKills(character, Array(240).fill('ad_chameleon'), monday);
  claimQuest(character, 'jjor_chameleon', Math.random, monday);
  assert.throws(() => acceptQuest(character, 'jjor_chameleon', nextKoreaDay), /이번 주에 이미/);
  assert.doesNotThrow(() => acceptQuest(character, 'jjor_chameleon', nextMonday));

  assert.equal(getQuestPeriodKey(
    NPC_CATALOG.flatMap((npc) => npc.quests).find((quest) => quest.id === 'jjor_chameleon'),
    nextMonday
  ), 'week:2026-07-20');
});

test('skill unlock quests track every objective and expand the investment cap', () => {
  const character = characterFixture();
  character.job = { departmentId: 'hr', advancementTier: 4 };
  character.skills = {
    levels: {}, activePreset: [], autoPreset: [], unlockedQuestSkills: [],
    unlockProgress: {}, unlockMigrationVersion: 0, activeBuffs: [], cooldowns: {},
    summon: null, comboCount: 0
  };

  acceptQuest(character, 'skill_hr_firm_will_10');
  recordMapVisit(character, 'executive_strategy');
  recordMonsterKills(character, Array(199).fill('overtime_bat'));
  let quest = buildQuestJournal(character).active[0];
  assert.equal(quest.status, 'active');
  assert.deepEqual(quest.objectives.map((entry) => entry.progress), [1, 199]);

  recordMonsterKills(character, ['overtime_reaper']);
  quest = buildQuestJournal(character).active[0];
  assert.equal(quest.status, 'ready');
  const rewards = claimQuest(character, 'skill_hr_firm_will_10');
  assert.equal(rewards.skillUnlocks[0].cap, 10);
  assert.equal(getSkillInvestmentCap(character, SKILL_DEFINITIONS.firm_will_hr), 10);
});

test('skill-use quests count every use and identify the unlocked skill in advance', () => {
  const character = characterFixture();
  character.job = { departmentId: 'field_operations', advancementTier: 4 };
  character.skills = {
    levels: { firm_will_hr: 10 }, activePreset: [], autoPreset: [],
    unlockedQuestSkills: [], unlockProgress: {}, unlockMigrationVersion: 0,
    activeBuffs: [], cooldowns: {}, summon: null, comboCount: 0
  };
  character.quests.completedIds.push('skill_field_firm_will_10');

  acceptQuest(character, 'skill_field_firm_will_20');
  let quest = buildQuestJournal(character).active[0];
  assert.match(quest.title, /^\[굳건한의지 Lv\.20 해금\]/);
  assert.deepEqual(quest.skillUnlock, {
    skillId: 'firm_will_hr',
    departmentId: 'field_operations',
    cap: 20,
    skillName: '굳건한의지'
  });
  assert.equal(quest.rewards, undefined);

  recordQuestEvent(character, {
    type: 'skill-use', targetId: 'firm_will_hr', amount: 99
  });
  quest = buildQuestJournal(character).active[0];
  assert.equal(quest.objectives[0].progress, 99);
  assert.equal(quest.status, 'active');

  recordQuestEvent(character, {
    type: 'skill-use', targetId: 'firm_will_hr', amount: 1
  });
  quest = buildQuestJournal(character).active[0];
  assert.equal(quest.objectives[0].progress, 100);
  assert.equal(quest.status, 'ready');
});

test('skill-use quests accept canonical and requested skill ids as one use', () => {
  const character = characterFixture();
  character.job = { departmentId: 'field_operations', advancementTier: 4 };
  character.skills = {
    levels: { firm_will_hr: 10 }, activePreset: [], autoPreset: [],
    unlockedQuestSkills: [], unlockProgress: {}, unlockMigrationVersion: 0,
    activeBuffs: [], cooldowns: {}, summon: null, comboCount: 0
  };
  character.quests.completedIds.push('skill_field_firm_will_10');
  acceptQuest(character, 'skill_field_firm_will_20');

  recordQuestEvent(character, {
    type: 'skill-use',
    targetId: 'legacy_firm_will_alias',
    targetIds: ['legacy_firm_will_alias', 'firm_will_hr'],
    amount: 1
  });

  const quest = buildQuestJournal(character).active[0];
  assert.equal(quest.objectives[0].progress, 1);
});

test('blocked-it mastery quest advances from actual shield blocks', () => {
  const character = characterFixture();
  character.job = { departmentId: 'field_operations', advancementTier: 4 };
  character.skills = {
    levels: { blocked_it: 10 }, activePreset: [], autoPreset: [],
    unlockedQuestSkills: [], unlockProgress: {}, unlockMigrationVersion: 0,
    activeBuffs: [], cooldowns: {}, summon: null, comboCount: 0
  };
  character.quests.completedIds.push('skill_field_blocked_10');
  acceptQuest(character, 'skill_field_blocked_20');

  recordQuestEvent(character, { type: 'block', amount: 99 });
  let quest = buildQuestJournal(character).active[0];
  assert.equal(quest.objectives[0].progress, 99);
  assert.equal(quest.status, 'active');

  recordQuestEvent(character, { type: 'block', amount: 1 });
  quest = buildQuestJournal(character).active[0];
  assert.equal(quest.objectives[0].progress, 100);
  assert.equal(quest.status, 'ready');
});
