'use strict';

const { getNpc, getQuest, getNpcsForMap } = require('../quests/questCatalog');
const { unlockSkillCap } = require('../skills/skillService');
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

function getQuestObjectives(definition) {
  if (Array.isArray(definition?.objectives) && definition.objectives.length) {
    return definition.objectives;
  }
  if (!definition) return [];
  return [{
    id: 'primary',
    type: definition.type,
    targetIds: definition.targetId ? [definition.targetId] : [],
    mapIds: definition.type === 'visit' && definition.targetId ? [definition.targetId] : [],
    targetName: definition.targetName,
    required: definition.required
  }];
}

function getObjectiveKey(objective, index) {
  return String(objective.id || `objective_${index}`);
}

function getObjectiveProgress(character, definition, entry, objective, index) {
  if (!entry) return 0;
  if (objective.type === 'collect') {
    return (objective.targetIds || []).reduce(
      (sum, itemId) => sum + getItemQuantity(character, itemId),
      0
    );
  }
  if (!definition.objectives && typeof entry.progress !== 'object') {
    return Math.max(0, Number(entry.progress) || 0);
  }
  const key = getObjectiveKey(objective, index);
  return Math.max(0, Number(entry.progress?.[key]) || 0);
}

function getSerializedObjectives(character, definition, entry) {
  return getQuestObjectives(definition).map((objective, index) => {
    const required = Math.max(1, Math.floor(Number(objective.required) || 1));
    return {
      ...objective,
      progress: Math.min(required, getObjectiveProgress(
        character, definition, entry, objective, index
      )),
      required
    };
  });
}

function isQuestCompletedForPeriod(state, definition, now) {
  return state.completedIds.includes(definition.id) || (
    definition.repeat !== 'once'
    && state.repeatCompletions[definition.id] === getQuestPeriodKey(definition, now)
  );
}

function isQuestEligible(character, definition, now = new Date(), { includeCompleted = true } = {}) {
  if (!definition) return false;
  const state = normalizeRecurringQuestState(character, now);
  if (includeCompleted && isQuestCompletedForPeriod(state, definition, now)) return true;
  if (getActiveEntry(character, definition.id)) return true;
  if (
    Array.isArray(definition.departments)
    && definition.departments.length
    && !definition.departments.includes(String(character.job?.departmentId || ''))
  ) return false;
  if (
    Number(character.job?.advancementTier || 0)
    < Math.max(0, Number(definition.minimumAdvancementTier) || 0)
  ) return false;
  return (definition.prerequisiteQuestIds || []).every(
    (questId) => state.completedIds.includes(questId)
  );
}

function serializeQuest(character, definition, now = new Date()) {
  const state = normalizeRecurringQuestState(character, now);
  const entry = getActiveEntry(character, definition.id);
  const objectives = getSerializedObjectives(character, definition, entry);
  const completed = isQuestCompletedForPeriod(state, definition, now);
  const ready = Boolean(entry) && objectives.every(
    (objective) => objective.progress >= objective.required
  );
  const status = completed ? 'completed' : (entry ? (ready ? 'ready' : 'active') : 'available');
  const progress = objectives.reduce((sum, objective) => sum + objective.progress, 0);
  const required = objectives.reduce((sum, objective) => sum + objective.required, 0);
  return {
    ...definition,
    rewards: status === 'ready' || status === 'completed' ? definition.rewards : undefined,
    status,
    objectives,
    progress: Math.min(required, progress),
    required,
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
    quests: npc.quests
      .filter((definition) => isQuestEligible(character, {
        ...definition, npcId: npc.id, mapId: npc.mapId
      }, now))
      .map((definition) => serializeQuest(character, {
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
  if (!isQuestEligible(character, definition, now, { includeCompleted: false })) {
    throw new Error('현재 부서·직급 또는 선행 퀘스트 조건을 충족하지 못했습니다.');
  }
  const periodKey = getQuestPeriodKey(definition, now);
  if (periodKey && state.repeatCompletions[definition.id] === periodKey) {
    throw new Error(definition.repeat === 'daily'
      ? '오늘 이미 완료한 퀘스트입니다.'
      : '이번 주에 이미 완료한 퀘스트입니다.');
  }
  if (getActiveEntry(character, definition.id)) return serializeQuest(character, definition, now);
  state.active.push({
    questId: definition.id,
    progress: definition.objectives ? {} : 0,
    uniqueTargets: {},
    acceptedAt: new Date(now),
    acceptedPeriod: periodKey
  });
  if (typeof character.markModified === 'function') character.markModified('quests');
  return serializeQuest(character, definition, now);
}

function eventMatchesObjective(objective, event) {
  if (objective.type !== event.type) return false;
  if (objective.mapIds?.length && !objective.mapIds.includes(String(event.mapId || ''))) return false;
  if (objective.targetIds?.length) {
    const targetId = String(event.targetId || '');
    if (!objective.targetIds.includes(targetId)) return false;
  }
  if (objective.element && objective.element !== event.element) return false;
  if (objective.undeadOnly && !event.undead) return false;
  if (objective.stealth && !event.stealth) return false;
  if (objective.solo && event.partySize > 1) return false;
  if (objective.partyRequired && event.partySize < 2) return false;
  if (objective.singleTarget && Number(event.targetCount || 1) !== 1) return false;
  if (
    Number.isFinite(Number(objective.maxHpPercent))
    && Number(event.hpPercent) > Number(objective.maxHpPercent)
  ) return false;
  if (
    Number.isFinite(Number(objective.minimumCombo))
    && Number(event.comboSpent) < Number(objective.minimumCombo)
  ) return false;
  return true;
}

function recordQuestEvent(character, event = {}, now = new Date()) {
  const state = normalizeRecurringQuestState(character, now);
  if (!event.type) return false;
  let changed = false;
  if (event.type === 'death') {
    for (const entry of state.active) {
      const definition = getQuest(entry.questId);
      getQuestObjectives(definition).forEach((objective, index) => {
        if (!objective.noDeath || objective.type === 'collect') return;
        if (typeof entry.progress !== 'object') entry.progress = 0;
        else entry.progress[getObjectiveKey(objective, index)] = 0;
        changed = true;
      });
    }
  } else {
    for (const entry of state.active) {
      const definition = getQuest(entry.questId);
      getQuestObjectives(definition).forEach((objective, index) => {
        if (objective.type === 'collect' || !eventMatchesObjective(objective, event)) return;
        const key = getObjectiveKey(objective, index);
        const previous = getObjectiveProgress(character, definition, entry, objective, index);
        let next = previous;
        if (objective.uniqueTargets) {
          if (!entry.uniqueTargets || typeof entry.uniqueTargets !== 'object') entry.uniqueTargets = {};
          const seen = new Set(entry.uniqueTargets[key] || []);
          const identity = String(event.targetId || event.mapId || '');
          if (!identity || seen.has(identity)) return;
          seen.add(identity);
          entry.uniqueTargets[key] = [...seen];
          next = seen.size;
        } else {
          next += Math.max(1, Math.floor(Number(event.amount) || 1));
        }
        const capped = Math.min(Math.max(1, Number(objective.required) || 1), next);
        if (!definition.objectives && typeof entry.progress !== 'object') entry.progress = capped;
        else {
          if (!entry.progress || typeof entry.progress !== 'object') entry.progress = {};
          entry.progress[key] = capped;
        }
        changed = changed || capped !== previous;
      });
    }
  }
  if (changed && typeof character.markModified === 'function') character.markModified('quests');
  return changed;
}

function recordMapVisit(character, mapId, now = new Date()) {
  return recordQuestEvent(character, { type: 'visit', targetId: mapId, mapId }, now);
}

function recordNpcVisit(character, npcId, now = new Date()) {
  return recordQuestEvent(character, { type: 'npc-visit', targetId: npcId }, now);
}

function recordMonsterKills(character, monsterIds = [], context = {}, now = new Date()) {
  if (context instanceof Date) {
    now = context;
    context = {};
  }
  const counts = new Map();
  monsterIds.filter(Boolean).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  let changed = false;
  for (const [targetId, amount] of counts) {
    changed = recordQuestEvent(character, {
      ...context, type: 'kill', targetId, amount
    }, now) || changed;
    const elements = [...new Set(
      (Array.isArray(context.elements) && context.elements.length
        ? context.elements
        : [context.element])
        .map((element) => String(element || '').trim())
        .filter(Boolean)
    )];
    if (!elements.length) elements.push('neutral');
    for (const element of elements) {
      changed = recordQuestEvent(character, {
        ...context, type: 'element-kill', targetId, amount, element
      }, now) || changed;
    }
  }
  return changed;
}

function recordBossKill(character, bossId, context = {}, now = new Date()) {
  if (context instanceof Date) {
    now = context;
    context = {};
  }
  const event = { ...context, type: 'boss', targetId: bossId, amount: 1 };
  const regular = recordQuestEvent(character, event, now);
  const combo = recordQuestEvent(character, {
    ...event, type: 'boss-combo'
  }, now);
  return regular || combo;
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
    huntingMinutes: Math.max(0, Number(rewards.huntingMinutes) || 0),
    skillUnlocks: (rewards.skillUnlocks || []).map((entry) => ({ ...entry }))
  };
}

function consumeCollectObjective(character, objective) {
  let remaining = Math.max(1, Math.floor(Number(objective.required) || 1));
  for (const itemId of objective.targetIds || []) {
    const quantity = Math.min(remaining, getItemQuantity(character, itemId));
    if (quantity > 0 && !consumeInventoryItem(character, itemId, quantity)) return false;
    remaining -= quantity;
    if (remaining <= 0) return true;
  }
  return remaining <= 0;
}

function claimQuest(character, questId, random = Math.random, now = new Date()) {
  const definition = getQuest(questId);
  const state = normalizeRecurringQuestState(character, now);
  const entry = getActiveEntry(character, questId);
  if (!definition || !entry) throw new Error('수락한 퀘스트를 찾을 수 없습니다.');
  const objectives = getSerializedObjectives(character, definition, entry);
  if (!objectives.every((objective) => objective.progress >= objective.required)) {
    throw new Error('퀘스트 목표를 아직 달성하지 못했습니다.');
  }
  for (const objective of getQuestObjectives(definition)) {
    if (objective.type === 'collect' && !consumeCollectObjective(character, objective)) {
      throw new Error('제출할 아이템이 부족합니다.');
    }
  }
  const rewards = resolveQuestRewards(definition.rewards, random);
  rewards.skillUnlocks = rewards.skillUnlocks.map((unlock) => ({
    ...unlock,
    ...unlockSkillCap(
      character,
      unlock.skillId,
      unlock.cap,
      unlock.departmentId,
      now
    )
  }));
  state.active = state.active.filter((active) => active.questId !== questId);
  const periodKey = getQuestPeriodKey(definition, now);
  if (periodKey) state.repeatCompletions[questId] = periodKey;
  else if (!state.completedIds.includes(questId)) state.completedIds.push(questId);
  if (typeof character.markModified === 'function') character.markModified('quests');
  return rewards;
}

function getPublicNpcsForMap(mapId) {
  return getNpcsForMap(mapId).map(({ id, name, icon, x }) => ({ id, name, icon, x }));
}

module.exports = {
  ensureQuestState,
  getQuestPeriodKey,
  normalizeRecurringQuestState,
  getQuestObjectives,
  isQuestEligible,
  buildNpcView,
  buildQuestJournal,
  acceptQuest,
  recordQuestEvent,
  recordMapVisit,
  recordNpcVisit,
  recordMonsterKills,
  recordBossKill,
  resolveQuestRewards,
  claimQuest,
  getPublicNpcsForMap
};
