'use strict';

const crypto = require('crypto');

const MAX_EXPEDITION_MEMBERS = 10;
const MAX_EXPEDITION_PARTIES = 3;
const MAX_EXPEDITION_PARTY_SIZE = 6;
const ENTRY_CONFIRMATION_MS = 30_000;

const BOSS_EXPEDITION_DEFINITIONS = [];

const queues = new Map();
const registrationByUser = new Map();

function getDefinition(bossId) {
  return BOSS_EXPEDITION_DEFINITIONS.find((definition) => definition.id === String(bossId || '')) || null;
}

function configureBossExpeditionDefinitions(definitions = []) {
  resetBossExpeditionRuntime();
  const normalized = (Array.isArray(definitions) ? definitions : [])
    .map((definition) => Object.freeze({
      id: String(definition?.id || ''),
      name: String(definition?.name || ''),
      level: Math.max(1, Math.floor(Number(definition?.level) || 1)),
      mapId: String(definition?.mapId || '')
    }))
    .filter((definition) => definition.id && definition.name && definition.mapId);
  BOSS_EXPEDITION_DEFINITIONS.splice(0, BOSS_EXPEDITION_DEFINITIONS.length, ...normalized);
}

function getQueue(bossId) {
  const definition = getDefinition(bossId);
  if (!definition) throw new Error('존재하지 않는 보스입니다.');
  if (!queues.has(definition.id)) {
    queues.set(definition.id, {
      bossId: definition.id,
      slots: Array(MAX_EXPEDITION_MEMBERS).fill(null),
      partyByUser: new Map(),
      confirmation: null
    });
  }
  return queues.get(definition.id);
}

function normalizeMember(user, now = Date.now()) {
  const userId = String(user?.userId || '');
  if (!userId) throw new Error('원정대원을 확인할 수 없습니다.');
  return {
    userId,
    nickname: String(user?.nickname || '이름 없음'),
    level: Math.max(1, Math.floor(Number(user?.level) || 1)),
    jobName: String(user?.jobName || '초보 사원'),
    registeredAt: Number(now) || Date.now()
  };
}

function clearConfirmation(queue) {
  queue.confirmation = null;
}

function removeUserFromQueue(queue, userId) {
  const key = String(userId);
  const slotIndex = queue.slots.findIndex((member) => member?.userId === key);
  if (slotIndex < 0) return false;
  queue.slots[slotIndex] = null;
  queue.partyByUser.delete(key);
  registrationByUser.delete(key);
  clearConfirmation(queue);
  if (slotIndex === 0) {
    const successorIndex = queue.slots.findIndex(Boolean);
    if (successorIndex > 0) {
      queue.slots[0] = queue.slots[successorIndex];
      queue.slots[successorIndex] = null;
    }
  }
  return true;
}

function expireConfirmation(queue, now = Date.now()) {
  const confirmation = queue.confirmation;
  if (!confirmation || Number(confirmation.expiresAt) > Number(now)) return [];
  const declinedUserIds = queue.slots
    .filter(Boolean)
    .map((member) => member.userId)
    .filter((userId) => confirmation.responses.get(userId) !== true);
  for (const userId of declinedUserIds) removeUserFromQueue(queue, userId);
  clearConfirmation(queue);
  return declinedUserIds;
}

function serializeQueue(queue, viewerId = '', now = Date.now()) {
  expireConfirmation(queue, now);
  const viewerKey = String(viewerId || '');
  const members = queue.slots.filter(Boolean);
  const allAssigned = members.length > 0 && members.every((member) => (
    queue.partyByUser.has(member.userId)
  ));
  const confirmation = queue.confirmation
    ? {
      id: queue.confirmation.id,
      startedAt: queue.confirmation.startedAt,
      expiresAt: queue.confirmation.expiresAt,
      viewerResponse: queue.confirmation.responses.has(viewerKey)
        ? queue.confirmation.responses.get(viewerKey)
        : null,
      acceptedCount: Array.from(queue.confirmation.responses.values()).filter(Boolean).length,
      memberCount: members.length
    }
    : null;
  return {
    bossId: queue.bossId,
    slots: queue.slots.map((member, slotIndex) => (member ? {
      ...member,
      slotIndex,
      partyNumber: queue.partyByUser.get(member.userId) || 0,
      isSelf: member.userId === viewerKey
    } : null)),
    memberCount: members.length,
    viewerSlot: queue.slots.findIndex((member) => member?.userId === viewerKey),
    isLeader: queue.slots[0]?.userId === viewerKey,
    allAssigned,
    confirmation
  };
}

function getBossExpeditionState(userId, now = Date.now()) {
  const expiredUserIds = [];
  for (const definition of BOSS_EXPEDITION_DEFINITIONS) {
    expiredUserIds.push(...expireConfirmation(getQueue(definition.id), now));
  }
  return {
    definitions: BOSS_EXPEDITION_DEFINITIONS.map((definition) => ({ ...definition })),
    queues: BOSS_EXPEDITION_DEFINITIONS.map((definition) => (
      serializeQueue(getQueue(definition.id), userId, now)
    )),
    registeredBossId: registrationByUser.get(String(userId || '')) || '',
    expiredUserIds
  };
}

function toggleBossExpeditionSlot({ bossId, slotIndex, user, now = Date.now() } = {}) {
  const queue = getQueue(bossId);
  expireConfirmation(queue, now);
  const member = normalizeMember(user, now);
  const targetIndex = Math.floor(Number(slotIndex));
  if (targetIndex < 0 || targetIndex >= MAX_EXPEDITION_MEMBERS) {
    throw new Error('선택할 수 없는 원정대 칸입니다.');
  }
  const currentBossId = registrationByUser.get(member.userId);
  const currentQueue = currentBossId ? getQueue(currentBossId) : null;
  const currentIndex = currentQueue?.slots.findIndex((entry) => entry?.userId === member.userId) ?? -1;
  const previousRegisteredAt = currentIndex >= 0
    ? currentQueue?.slots[currentIndex]?.registeredAt
    : 0;
  if (currentQueue === queue && currentIndex === targetIndex) {
    removeUserFromQueue(queue, member.userId);
    return { action: 'unregistered', bossId: queue.bossId, userId: member.userId };
  }
  if (currentQueue === queue && currentIndex === 0 && targetIndex !== 0) {
    throw new Error('원정대장은 1번 칸을 유지해야 합니다.');
  }
  if (queue.slots[targetIndex] && queue.slots[targetIndex].userId !== member.userId) {
    throw new Error('이미 다른 원정대원이 선택한 칸입니다.');
  }
  if (currentQueue && currentQueue !== queue) removeUserFromQueue(currentQueue, member.userId);
  if (currentQueue === queue && currentIndex >= 0) queue.slots[currentIndex] = null;
  queue.slots[targetIndex] = {
    ...member,
    registeredAt: previousRegisteredAt || member.registeredAt
  };
  registrationByUser.set(member.userId, queue.bossId);
  clearConfirmation(queue);
  return {
    action: currentIndex >= 0 ? 'moved' : 'registered',
    bossId: queue.bossId,
    userId: member.userId
  };
}

function transferBossExpeditionLeadership({ bossId, leaderId, newLeaderId, now = Date.now() } = {}) {
  const queue = getQueue(bossId);
  expireConfirmation(queue, now);
  const currentLeaderId = String(leaderId || '');
  const successorId = String(newLeaderId || '');
  if (queue.slots[0]?.userId !== currentLeaderId) {
    throw new Error('현재 원정대장만 원정대장을 양도할 수 있습니다.');
  }
  if (queue.confirmation) {
    throw new Error('입장 동의가 진행 중일 때는 원정대장을 양도할 수 없습니다.');
  }
  const successorIndex = queue.slots.findIndex((member) => member?.userId === successorId);
  if (successorIndex <= 0) {
    throw new Error('원정대장을 양도할 원정대원을 선택해주세요.');
  }
  const previousLeader = queue.slots[0];
  queue.slots[0] = queue.slots[successorIndex];
  queue.slots[successorIndex] = previousLeader;
  clearConfirmation(queue);
  return serializeQueue(queue, currentLeaderId, now);
}

function setBossExpeditionPartyLayout({ bossId, leaderId, parties, now = Date.now() } = {}) {
  const queue = getQueue(bossId);
  expireConfirmation(queue, now);
  if (queue.slots[0]?.userId !== String(leaderId || '')) {
    throw new Error('원정대장만 파티를 편집할 수 있습니다.');
  }
  const registeredIds = queue.slots.filter(Boolean).map((member) => member.userId);
  const partyList = Array.isArray(parties) ? parties : [];
  if (!registeredIds.length || partyList.length < 1 || partyList.length > MAX_EXPEDITION_PARTIES) {
    throw new Error('원정대 파티 구성을 확인해주세요.');
  }
  const nextAssignments = new Map();
  const normalizedParties = partyList.map((party, index) => {
    const partyNumber = index + 1;
    const memberIds = [...new Set((party?.memberIds || []).map(String).filter(Boolean))];
    if (memberIds.length > MAX_EXPEDITION_PARTY_SIZE) {
      throw new Error('한 파티에는 최대 6명까지 배치할 수 있습니다.');
    }
    for (const userId of memberIds) {
      if (!registeredIds.includes(userId) || nextAssignments.has(userId)) {
        throw new Error('중복되거나 등록되지 않은 원정대원이 포함되어 있습니다.');
      }
      nextAssignments.set(userId, partyNumber);
    }
    return { partyNumber, memberIds };
  });
  if (nextAssignments.size !== registeredIds.length) {
    throw new Error('모든 원정대원을 파티에 배치해야 합니다.');
  }
  queue.partyByUser = nextAssignments;
  clearConfirmation(queue);
  return {
    parties: normalizedParties,
    members: queue.slots.filter(Boolean).map((member) => ({
      ...member,
      partyNumber: nextAssignments.get(member.userId)
    }))
  };
}

function startBossEntryConfirmation({ bossId, leaderId, now = Date.now() } = {}) {
  const queue = getQueue(bossId);
  expireConfirmation(queue, now);
  const members = queue.slots.filter(Boolean);
  if (queue.slots[0]?.userId !== String(leaderId || '')) {
    throw new Error('원정대장만 입장을 시작할 수 있습니다.');
  }
  if (!members.length || members.some((member) => !queue.partyByUser.has(member.userId))) {
    throw new Error('모든 원정대원을 파티에 배치한 뒤 입장할 수 있습니다.');
  }
  queue.confirmation = {
    id: crypto.randomUUID(),
    startedAt: Number(now) || Date.now(),
    expiresAt: (Number(now) || Date.now()) + ENTRY_CONFIRMATION_MS,
    responses: new Map()
  };
  return serializeQueue(queue, leaderId, now);
}

function respondBossEntry({ bossId, userId, confirmationId, accepted, now = Date.now() } = {}) {
  const queue = getQueue(bossId);
  expireConfirmation(queue, now);
  const key = String(userId || '');
  const confirmation = queue.confirmation;
  if (!confirmation || confirmation.id !== String(confirmationId || '')) {
    throw new Error('보스 입장 확인 시간이 만료되었습니다.');
  }
  if (!queue.slots.some((member) => member?.userId === key)) {
    throw new Error('현재 원정대에 등록되어 있지 않습니다.');
  }
  if (accepted !== true) {
    removeUserFromQueue(queue, key);
    return { ready: false, declinedUserId: key, bossId: queue.bossId };
  }
  confirmation.responses.set(key, true);
  const members = queue.slots.filter(Boolean);
  const ready = members.length > 0 && members.every((member) => (
    confirmation.responses.get(member.userId) === true
  ));
  const definition = getDefinition(queue.bossId);
  return {
    ready,
    bossId: queue.bossId,
    mapId: definition.mapId,
    members: ready ? members.map((member) => ({
      ...member,
      partyNumber: queue.partyByUser.get(member.userId)
    })) : [],
    queue: serializeQueue(queue, key, now)
  };
}

function finalizeBossEntry(bossId) {
  const queue = getQueue(bossId);
  for (const member of queue.slots.filter(Boolean)) registrationByUser.delete(member.userId);
  queue.slots = Array(MAX_EXPEDITION_MEMBERS).fill(null);
  queue.partyByUser.clear();
  queue.confirmation = null;
}

function resetBossExpeditionRuntime() {
  queues.clear();
  registrationByUser.clear();
}

module.exports = {
  MAX_EXPEDITION_MEMBERS,
  MAX_EXPEDITION_PARTIES,
  MAX_EXPEDITION_PARTY_SIZE,
  ENTRY_CONFIRMATION_MS,
  BOSS_EXPEDITION_DEFINITIONS,
  configureBossExpeditionDefinitions,
  getBossExpeditionState,
  toggleBossExpeditionSlot,
  transferBossExpeditionLeadership,
  setBossExpeditionPartyLayout,
  startBossEntryConfirmation,
  respondBossEntry,
  finalizeBossEntry,
  resetBossExpeditionRuntime
};
