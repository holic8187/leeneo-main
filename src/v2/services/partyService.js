'use strict';

const crypto = require('crypto');

const PARTY_INVITE_TTL_MS = 30_000;
const MAX_PARTY_SIZE = 6;
const parties = new Map();
const partyIdByUser = new Map();
const invitationsByTarget = new Map();

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
    isLeader: String(party.leaderId) === String(viewerId),
    members: party.members.map((member) => ({
      ...member,
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

function invitePlayer(inviter, target) {
  const source = normalizeUser(inviter);
  const destination = normalizeUser(target);
  if (!source.userId || !destination.userId || source.userId === destination.userId) {
    throw new Error('초대할 플레이어를 확인해주세요.');
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
  const invitation = getPendingInvitation(member.userId);
  if (!invitation || invitation.id !== String(invitationId || '')) {
    throw new Error('유효한 파티 초대가 없습니다.');
  }
  if (getParty(member.userId)) throw new Error('이미 파티에 참여 중입니다.');
  let party = getParty(invitation.inviterId);
  if (!party) {
    party = {
      id: crypto.randomUUID(),
      leaderId: invitation.inviterId,
      members: [{
        userId: invitation.inviterId,
        nickname: invitation.inviterNickname
      }]
    };
    parties.set(party.id, party);
    partyIdByUser.set(invitation.inviterId, party.id);
  }
  if (party.leaderId !== invitation.inviterId) {
    throw new Error('파티 구성이 변경되어 초대가 만료되었습니다.');
  }
  if (party.members.length >= MAX_PARTY_SIZE) throw new Error('파티 정원이 가득 찼습니다.');
  party.members.push(member);
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

function resetPartyRuntime() {
  parties.clear();
  partyIdByUser.clear();
  invitationsByTarget.clear();
}

module.exports = {
  PARTY_INVITE_TTL_MS,
  MAX_PARTY_SIZE,
  getPartyState,
  getPartyMemberIds,
  invitePlayer,
  acceptInvitation,
  declineInvitation,
  removeMember,
  resetPartyRuntime
};
