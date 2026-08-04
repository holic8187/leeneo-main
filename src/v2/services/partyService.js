'use strict';

const crypto = require('crypto');

const PARTY_INVITE_TTL_MS = 30_000;
const MAX_PARTY_SIZE = 6;
const PARTY_EXP_ACTIVITY_WINDOW_MS = 120_000;
const parties = new Map();
const partyIdByUser = new Map();
const invitationsByTarget = new Map();
const bossPartyLockByUser = new Map();

function normalizeUser(user) {
  return {
    userId: String(user?.userId || ''),
    nickname: String(user?.nickname || '사원')
  };
}

function serializeParty(party, viewerId = '') {
  if (!party) return null;
  return {
    id: party.id,
    leaderId: party.leaderId,
    bossExpeditionId: party.bossExpeditionId || '',
    lockedByBossExpedition: Boolean(party.bossExpeditionId),
    isLeader: String(party.leaderId) === String(viewerId),
    members: party.members.map((member) => ({
      userId: member.userId,
      nickname: member.nickname,
      isLeader: member.userId === party.leaderId,
      isSelf: member.userId === String(viewerId)
    }))
  };
}

function getParty(userId) {
  return parties.get(partyIdByUser.get(String(userId))) || null;
}

function getPendingInvitation(userId, now = Date.now()) {
  const invitation = invitationsByTarget.get(String(userId));
  if (!invitation) return null;
  if (invitation.expiresAt <= now) {
    invitationsByTarget.delete(String(userId));
    return null;
  }
  return { ...invitation };
}

function getPartyState(userId) {
  return {
    party: serializeParty(getParty(userId), userId),
    invitation: getPendingInvitation(userId)
  };
}

function getPartyMemberIds(userId) {
  const party = getParty(userId);
  return party
    ? party.members.map((member) => String(member.userId))
    : [String(userId)];
}

function recordPartyMonsterKill(userId, now = Date.now()) {
  const party = getParty(userId);
  const member = party?.members.find((entry) => entry.userId === String(userId));
  if (!member) return false;
  member.lastKillAt = Number(now) || Date.now();
  return true;
}

function isPartyExperienceEligible(userId, now = Date.now()) {
  const party = getParty(userId);
  if (!party) return true;
  const member = party.members.find((entry) => entry.userId === String(userId));
  if (!member) return false;
  const activityAt = Math.max(
    Number(member.lastKillAt) || 0,
    Number(member.joinedAt) || 0
  );
  return Number(now) - activityAt <= PARTY_EXP_ACTIVITY_WINDOW_MS;
}

function invitePlayer(inviter, target) {
  const source = normalizeUser(inviter);
  const destination = normalizeUser(target);
  if (!source.userId || !destination.userId || source.userId === destination.userId) {
    throw new Error('초대할 플레이어를 확인해주세요.');
  }
  if (bossPartyLockByUser.has(source.userId) || bossPartyLockByUser.has(destination.userId)) {
    throw new Error('보스 원정대 파티는 대기열에서만 변경할 수 있습니다.');
  }
  if (getParty(destination.userId)) throw new Error('상대방은 이미 파티에 참여 중입니다.');
  const sourceParty = getParty(source.userId);
  if (sourceParty && sourceParty.leaderId !== source.userId) {
    throw new Error('파티장만 새 파티원을 초대할 수 있습니다.');
  }
  if (sourceParty && sourceParty.members.length >= MAX_PARTY_SIZE) {
    throw new Error('파티 정원이 가득 찼습니다.');
  }
  const invitation = {
    id: crypto.randomUUID(),
    inviterId: source.userId,
    inviterNickname: source.nickname,
    targetId: destination.userId,
    targetNickname: destination.nickname,
    createdAt: Date.now(),
    expiresAt: Date.now() + PARTY_INVITE_TTL_MS
  };
  invitationsByTarget.set(destination.userId, invitation);
  return { ...invitation };
}

function acceptInvitation(target, invitationId) {
  const member = normalizeUser(target);
  if (bossPartyLockByUser.has(member.userId)) {
    throw new Error('보스 원정대 파티는 대기열에서만 변경할 수 있습니다.');
  }
  const invitation = getPendingInvitation(member.userId);
  if (!invitation || invitation.id !== String(invitationId || '')) {
    throw new Error('유효한 파티 초대가 없습니다.');
  }
  if (getParty(member.userId)) throw new Error('이미 파티에 참여 중입니다.');
  let party = getParty(invitation.inviterId);
  if (!party) {
    const joinedAt = Date.now();
    party = {
      id: crypto.randomUUID(),
      leaderId: invitation.inviterId,
      members: [{
        userId: invitation.inviterId,
        nickname: invitation.inviterNickname,
        joinedAt,
        lastKillAt: 0
      }]
    };
    parties.set(party.id, party);
    partyIdByUser.set(invitation.inviterId, party.id);
  }
  if (party.leaderId !== invitation.inviterId) {
    throw new Error('파티 구성이 변경되어 초대가 만료되었습니다.');
  }
  if (party.members.length >= MAX_PARTY_SIZE) throw new Error('파티 정원이 가득 찼습니다.');
  party.members.push({
    ...member,
    joinedAt: Date.now(),
    lastKillAt: 0
  });
  partyIdByUser.set(member.userId, party.id);
  invitationsByTarget.delete(member.userId);
  return serializeParty(party, member.userId);
}

function declineInvitation(userId, invitationId) {
  const invitation = getPendingInvitation(userId);
  if (invitation && invitation.id === String(invitationId || '')) {
    invitationsByTarget.delete(String(userId));
  }
}

function removeMember(userId, requestedBy = userId) {
  const party = getParty(userId);
  if (!party) throw new Error('참여 중인 파티가 없습니다.');
  const targetId = String(userId);
  const actorId = String(requestedBy);
  if (bossPartyLockByUser.has(targetId) || bossPartyLockByUser.has(actorId)) {
    throw new Error('보스 원정대 파티는 대기열 등록을 해제해야 나갈 수 있습니다.');
  }
  if (actorId !== targetId && party.leaderId !== actorId) {
    throw new Error('파티장만 파티원을 추방할 수 있습니다.');
  }
  party.members = party.members.filter((member) => member.userId !== targetId);
  partyIdByUser.delete(targetId);
  if (!party.members.length) {
    parties.delete(party.id);
    return null;
  }
  if (party.leaderId === targetId) party.leaderId = party.members[0].userId;
  return serializeParty(party, actorId);
}

function forceDetachUser(userId) {
  const key = String(userId || '');
  const party = getParty(key);
  partyIdByUser.delete(key);
  if (!party) return;
  party.members = party.members.filter((member) => member.userId !== key);
  if (!party.members.length) {
    parties.delete(party.id);
    return;
  }
  if (party.leaderId === key) party.leaderId = party.members[0].userId;
}

function setBossExpeditionParties(bossExpeditionId, groups = []) {
  const bossId = String(bossExpeditionId || '');
  if (!bossId) throw new Error('보스 원정대를 확인할 수 없습니다.');
  const previousIds = [...bossPartyLockByUser.entries()]
    .filter(([, lockedBossId]) => lockedBossId === bossId)
    .map(([userId]) => userId);
  const nextMembers = groups.flatMap((group) => group || []).map(normalizeUser);
  const nextIds = nextMembers.map((member) => member.userId);
  for (const userId of new Set([...previousIds, ...nextIds])) {
    bossPartyLockByUser.delete(userId);
    forceDetachUser(userId);
  }
  for (const group of groups) {
    const members = (group || []).map(normalizeUser).filter((member) => member.userId);
    if (!members.length) continue;
    if (members.length > MAX_PARTY_SIZE) throw new Error('한 파티에는 최대 6명까지 배치할 수 있습니다.');
    const joinedAt = Date.now();
    const party = {
      id: crypto.randomUUID(),
      leaderId: members[0].userId,
      bossExpeditionId: bossId,
      members: members.map((member) => ({
        ...member,
        joinedAt,
        lastKillAt: 0
      }))
    };
    parties.set(party.id, party);
    for (const member of party.members) {
      partyIdByUser.set(member.userId, party.id);
      bossPartyLockByUser.set(member.userId, bossId);
    }
  }
  return nextIds.map((userId) => getPartyState(userId).party);
}

function removeBossExpeditionMember(userId, bossExpeditionId) {
  const key = String(userId || '');
  const lockedBossId = bossPartyLockByUser.get(key);
  if (!lockedBossId) return false;
  if (bossExpeditionId && lockedBossId !== String(bossExpeditionId)) return false;
  bossPartyLockByUser.delete(key);
  forceDetachUser(key);
  return true;
}

function unlockBossExpeditionParties(bossExpeditionId) {
  const bossId = String(bossExpeditionId || '');
  for (const [userId, lockedBossId] of bossPartyLockByUser.entries()) {
    if (lockedBossId !== bossId) continue;
    bossPartyLockByUser.delete(userId);
    const party = getParty(userId);
    if (party?.bossExpeditionId === bossId) party.bossExpeditionId = '';
  }
}

function resetPartyRuntime() {
  parties.clear();
  partyIdByUser.clear();
  invitationsByTarget.clear();
  bossPartyLockByUser.clear();
}

module.exports = {
  PARTY_INVITE_TTL_MS,
  MAX_PARTY_SIZE,
  PARTY_EXP_ACTIVITY_WINDOW_MS,
  getPartyState,
  getPartyMemberIds,
  recordPartyMonsterKill,
  isPartyExperienceEligible,
  invitePlayer,
  acceptInvitation,
  declineInvitation,
  removeMember,
  setBossExpeditionParties,
  removeBossExpeditionMember,
  unlockBossExpeditionParties,
  resetPartyRuntime
};
