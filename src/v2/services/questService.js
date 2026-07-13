'use strict';

const { getNpc, getQuest, getNpcsForMap } = require('../quests/questCatalog');
const { getItemQuantity, consumeInventoryItem } = require('./inventoryService');

function ensureQuestState(character) {
  if (!character.quests || typeof character.quests !== 'object') character.quests = {};
  if (!Array.isArray(character.quests.active)) character.quests.active = [];
  if (!Array.isArray(character.quests.completedIds)) character.quests.completedIds = [];
  if (!character.quests.repeatCompletions || typeof character.quests.repeatCompletions !== 'object') {
    character.quests.repeatCompletions = {};
  }
  return character.quests;
}

function getKoreaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [
    part.type, Number(part.value)
  ]));
}

function getQuestPeriodKey(definition, now = new Date()) {
  if (!definition || definition.repeat === 'once') return '';
  const { year, month, day } = getKoreaDateParts(now);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (definition.repeat === 'weekly') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return `week:${date.toISOString().slice(0, 10)}`;
  }
  return `day:${date.toISOString().slice(0, 10)}`;
}

function normalizeRecurringQuestState(character, now = new Date()) {
  const state = ensureQuestState(character);
  let changed = false;
  const legacyRecurringIds = state.completedIds.filter((questId) => {
    const definition = getQuest(questId);
    return definition && definition.repeat !== 'once';
  });
  if (legacyRecurringIds.length) {
    const recurringSet = new Set(legacyRecurringIds);
    state.completedIds = state.completedIds.filter((questId) => !recurringSet.has(questId));
    changed = true;
  }
  state.active = state.active.filter((entry) => {
    const definition = getQuest(entry.questId);
    if (!definition || definition.repeat === 'once') return true;
    const currentPeriod = getQuestPeriodKey(definition, now);
    const keep = entry.acceptedPeriod === currentPeriod;
    if (!keep) changed = true;
    return keep;
  });
  if (changed && typeof character.markModified === 'function') character.markModified('quests');
  return state;
}

function getActiveEntry(character, questId) {
  return ensureQuestState(character).active.find((entry) => entry.questId === questId) || null;
}

function getQuestProgress(character, definition, entry) {
  if (!definition || !entry) return 0;
  if (definition.type === 'collect') return getItemQuantity(character, definition.targetId);
  return Math.max(0, Number(entry.progress) || 0);
}

function serializeQuest(character, definition, now = new Date()) {
  const state = normalizeRecurringQuestState(character, now);
  const entry = getActiveEntry(character, definition.id);
  const progress = entry ? getQuestProgress(character, definition, entry) : 0;
  const repeatCompleted = definition.repeat !== 'once'
    && state.repeatCompletions[definition.id] === getQuestPeriodKey(definition, now);
  const status = state.completedIds.includes(definition.id) || repeatCompleted
    ? 'completed'
    : (entry ? (progress >= definition.required ? 'ready' : 'active') : 'available');
  return {
    ...definition,
    rewards: status === 'ready' || status === 'completed' ? definition.rewards : undefined,
    status,
    progress: Math.min(definition.required, progress),
    acceptedAt: entry?.acceptedAt || null
  };
}

function buildNpcView(character, npcId, now = new Date()) {
  const npc = getNpc(npcId);
  if (!npc) return null;
  return {
    id: npc.id,
    name: npc.name,
    mapId: npc.mapId,
    icon: npc.icon,
    x: npc.x,
    quests: npc.quests.map((definition) => serializeQuest(character, {
      ...definition,
      npcId: npc.id,
      mapId: npc.mapId
    }, now))
  };
}

function buildQuestJournal(character, now = new Date()) {
  const state = normalizeRecurringQuestState(character, now);
  return {
    active: state.active.map((entry) => getQuest(entry.questId))
      .filter(Boolean)
      .map((definition) => serializeQuest(character, definition, now)),
    completedCount: state.completedIds.length + Object.keys(state.repeatCompletions).length
  };
}

function acceptQuest(character, questId, now = new Date()) {
  const definition = getQuest(questId);
  if (!definition) throw new Error('존재하지 않는 퀘스트입니다.');
  const state = normalizeRecurringQuestState(character, now);
  if (state.completedIds.includes(definition.id)) throw new Error('이미 완료한 퀘스트입니다.');
  const periodKey = getQuestPeriodKey(definition, now);
  if (periodKey && state.repeatCompletions[definition.id] === periodKey) {
    throw new Error(definition.repeat === 'daily'
      ? '오늘 이미 완료한 퀘스트입니다.'
      : '이번 주에 이미 완료한 퀘스트입니다.');
  }
  if (getActiveEntry(character, definition.id)) return serializeQuest(character, definition, now);
  state.active.push({
    questId: definition.id,
    progress: 0,
    acceptedAt: new Date(now),
    acceptedPeriod: periodKey
  });
  if (typeof character.markModified === 'function') character.markModified('quests');
  return serializeQuest(character, definition, now);
}

function recordMapVisit(character, mapId, now = new Date()) {
  const state = normalizeRecurringQuestState(character, now);
  let changed = false;
  for (const entry of state.active) {
    const definition = getQuest(entry.questId);
    if (definition?.type !== 'visit' || definition.targetId !== mapId || entry.progress >= 1) continue;
    entry.progress = 1;
    changed = true;
  }
  if (changed && typeof character.markModified === 'function') character.markModified('quests');
  return changed;
}

function recordMonsterKills(character, monsterIds = [], now = new Date()) {
  const counts = new Map();
  monsterIds.filter(Boolean).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  if (!counts.size) return false;
  let changed = false;
  for (const entry of normalizeRecurringQuestState(character, now).active) {
    const definition = getQuest(entry.questId);
    if (definition?.type !== 'kill' || !counts.has(definition.targetId)) continue;
    entry.progress = Math.min(
      definition.required,
      Math.max(0, Number(entry.progress) || 0) + counts.get(definition.targetId)
    );
    changed = true;
  }
  if (changed && typeof character.markModified === 'function') character.markModified('quests');
  return changed;
}

function recordBossKill(character, bossId, now = new Date()) {
  let changed = false;
  for (const entry of normalizeRecurringQuestState(character, now).active) {
    const definition = getQuest(entry.questId);
    if (definition?.type !== 'boss' || definition.targetId !== bossId) continue;
    entry.progress = Math.min(definition.required, Math.max(0, Number(entry.progress) || 0) + 1);
    changed = true;
  }
  if (changed && typeof character.markModified === 'function') character.markModified('quests');
  return changed;
}

function resolveQuestRewards(rewards = {}, random = Math.random) {
  const items = (rewards.items || []).map((entry) => ({ ...entry }));
  for (const pool of rewards.randomItems || []) {
    if (!Array.isArray(pool.options) || !pool.options.length) continue;
    const index = Math.min(
      pool.options.length - 1,
      Math.max(0, Math.floor(Number(random()) * pool.options.length))
    );
    items.push({ ...pool.options[index] });
  }
  return {
    exp: Math.max(0, Number(rewards.exp) || 0),
    money: Math.max(0, Number(rewards.money) || 0),
    items,
    huntingMinutes: Math.max(0, Number(rewards.huntingMinutes) || 0)
  };
}

function claimQuest(character, questId, random = Math.random, now = new Date()) {
  const definition = getQuest(questId);
  const state = normalizeRecurringQuestState(character, now);
  const entry = getActiveEntry(character, questId);
  if (!definition || !entry) throw new Error('수락한 퀘스트를 찾을 수 없습니다.');
  if (getQuestProgress(character, definition, entry) < definition.required) {
    throw new Error('퀘스트 목표를 아직 달성하지 못했습니다.');
  }
  if (
    definition.type === 'collect'
    && !consumeInventoryItem(character, definition.targetId, definition.required)
  ) {
    throw new Error('제출할 아이템이 부족합니다.');
  }
  state.active = state.active.filter((active) => active.questId !== questId);
  const periodKey = getQuestPeriodKey(definition, now);
  if (periodKey) state.repeatCompletions[questId] = periodKey;
  else state.completedIds.push(questId);
  if (typeof character.markModified === 'function') character.markModified('quests');
  return resolveQuestRewards(definition.rewards, random);
}

function getPublicNpcsForMap(mapId) {
  return getNpcsForMap(mapId).map(({ id, name, icon, x }) => ({ id, name, icon, x }));
}

module.exports = {
  ensureQuestState,
  getQuestPeriodKey,
  normalizeRecurringQuestState,
  buildNpcView,
  buildQuestJournal,
  acceptQuest,
  recordMapVisit,
  recordMonsterKills,
  recordBossKill,
  resolveQuestRewards,
  claimQuest,
  getPublicNpcsForMap
};
