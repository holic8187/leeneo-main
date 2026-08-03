'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ENTRY_CONFIRMATION_MS,
  getBossExpeditionState,
  toggleBossExpeditionSlot,
  setBossExpeditionPartyLayout,
  startBossEntryConfirmation,
  respondBossEntry,
  resetBossExpeditionRuntime
} = require('../../src/v2/services/bossExpeditionService');

const member = (userId, level = 120) => ({
  userId,
  nickname: userId,
  level,
  jobName: '테스트 직업'
});

test.beforeEach(resetBossExpeditionRuntime);

test('users can register, move, and unregister a selected expedition slot', () => {
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 4, user: member('member'), now: 1_100 });
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 5, user: member('member'), now: 1_200 });
  let queue = getBossExpeditionState('member', 1_300).queues[0];
  assert.equal(queue.slots[5].userId, 'member');
  assert.equal(queue.viewerSlot, 5);

  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 5, user: member('member'), now: 1_400 });
  queue = getBossExpeditionState('member', 1_500).queues[0];
  assert.equal(queue.viewerSlot, -1);
  assert.equal(queue.memberCount, 1);
});

test('leader assigns every member before starting a 30 second confirmation', () => {
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 1, user: member('member'), now: 1_100 });
  assert.throws(() => startBossEntryConfirmation({
    bossId: 'gammam_neo', leaderId: 'leader', now: 2_000
  }), /모든 원정대원/);

  const layout = setBossExpeditionPartyLayout({
    bossId: 'gammam_neo',
    leaderId: 'leader',
    parties: [{ memberIds: ['leader', 'member'] }],
    now: 2_100
  });
  assert.equal(layout.members.length, 2);
  const queue = startBossEntryConfirmation({
    bossId: 'gammam_neo', leaderId: 'leader', now: 3_000
  });
  assert.equal(queue.confirmation.expiresAt, 3_000 + ENTRY_CONFIRMATION_MS);
});

test('all confirmations enter together while a cancellation removes only that member', () => {
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 1, user: member('member'), now: 1_100 });
  setBossExpeditionPartyLayout({
    bossId: 'gammam_neo',
    leaderId: 'leader',
    parties: [{ memberIds: ['leader', 'member'] }],
    now: 1_200
  });
  const queue = startBossEntryConfirmation({
    bossId: 'gammam_neo', leaderId: 'leader', now: 1_300
  });
  const confirmationId = queue.confirmation.id;
  assert.equal(respondBossEntry({
    bossId: 'gammam_neo', userId: 'leader', confirmationId, accepted: true, now: 1_400
  }).ready, false);
  const ready = respondBossEntry({
    bossId: 'gammam_neo', userId: 'member', confirmationId, accepted: true, now: 1_500
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.members.map((entry) => entry.userId), ['leader', 'member']);

  resetBossExpeditionRuntime();
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 0, user: member('leader'), now: 2_000 });
  toggleBossExpeditionSlot({ bossId: 'gammam_neo', slotIndex: 1, user: member('member'), now: 2_100 });
  setBossExpeditionPartyLayout({
    bossId: 'gammam_neo', leaderId: 'leader', parties: [{ memberIds: ['leader', 'member'] }], now: 2_200
  });
  const second = startBossEntryConfirmation({
    bossId: 'gammam_neo', leaderId: 'leader', now: 2_300
  });
  const declined = respondBossEntry({
    bossId: 'gammam_neo',
    userId: 'member',
    confirmationId: second.confirmation.id,
    accepted: false,
    now: 2_400
  });
  assert.equal(declined.declinedUserId, 'member');
  assert.equal(getBossExpeditionState('leader', 2_500).queues[0].memberCount, 1);
});
