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
