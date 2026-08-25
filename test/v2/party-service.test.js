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
  hasRecentPartyMonsterKill,
  setBossExpeditionParties,
  removeBossExpeditionMember,
  unlockBossExpeditionParties,
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

test('boss expedition parties stay locked until unregister or entry', () => {
  setBossExpeditionParties('gammam_neo', [[
    { userId: 'leader', nickname: 'leader' },
    { userId: 'member', nickname: 'member' }
  ]]);
  assert.equal(getPartyState('leader').party.lockedByBossExpedition, true);
  assert.throws(() => removeMember('member', 'member'), /대기열 등록을 해제/);

  removeBossExpeditionMember('member', 'gammam_neo');
  assert.equal(getPartyState('member').party, null);
  unlockBossExpeditionParties('gammam_neo');
  assert.equal(getPartyState('leader').party.lockedByBossExpedition, false);
  removeMember('leader', 'leader');
  assert.equal(getPartyState('leader').party, null);
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
    hasRecentPartyMonsterKill('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS - 1),
    false
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
    hasRecentPartyMonsterKill('member', joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS + 30),
    true
  );
  assert.equal(
    hasRecentPartyMonsterKill(
      'member',
      joinedAt + PARTY_EXP_ACTIVITY_WINDOW_MS * 2 + 21
    ),
    false
  );
  assert.equal(
    Object.hasOwn(getPartyState('member').party.members[0], 'lastKillAt'),
    false
  );
});
