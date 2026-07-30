'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  invitePlayer,
  acceptInvitation,
  removeMember,
  getPartyState,
  recordPartyMonsterKill,
  isPartyExperienceEligible,
  PARTY_EXP_ACTIVITY_WINDOW_MS,
  resetPartyRuntime
} = require('../../src/v2/services/partyService');

test.beforeEach(resetPartyRuntime);

test('accepting an invitation creates a party led by the inviter', () => {
  const invitation = invitePlayer(
    { userId: 'leader', nickname: '파티장' },
    { userId: 'member', nickname: '파티원' }
  );
  const party = acceptInvitation(
    { userId: 'member', nickname: '파티원' },
    invitation.id
  );
  assert.equal(party.leaderId, 'leader');
  assert.equal(party.members.length, 2);
  assert.equal(getPartyState('leader').party.isLeader, true);
});

test('only the leader can kick another party member', () => {
  const invitation = invitePlayer(
    { userId: 'leader', nickname: '파티장' },
    { userId: 'member', nickname: '파티원' }
  );
  acceptInvitation({ userId: 'member', nickname: '파티원' }, invitation.id);
  assert.throws(() => removeMember('leader', 'member'), /파티장만/);
  removeMember('member', 'leader');
  assert.equal(getPartyState('member').party, null);
});

test('party experience stops after two minutes without a kill and resumes on kill', () => {
  const joinedAt = Date.now();
  const invitation = invitePlayer(
    { userId: 'leader', nickname: 'leader' },
    { userId: 'member', nickname: 'member' }
  );
  acceptInvitation({ userId: 'member', nickname: 'member' }, invitation.id);

  assert.equal(
    isPartyExperienceEligible('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS - 1),
    true
  );
  assert.equal(
    isPartyExperienceEligible('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS + 10),
    false
  );

  recordPartyMonsterKill('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS + 20);
  assert.equal(
    isPartyExperienceEligible('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS + 30),
    true
  );
  assert.equal(
    Object.hasOwn(getPartyState('member').party.members[0], 'lastKillAt'),
    false
  );
});
