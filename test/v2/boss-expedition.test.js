'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ENTRY_CONFIRMATION_MS,
  configureBossExpeditionDefinitions,
  getBossExpeditionState,
  toggleBossExpeditionSlot,
  transferBossExpeditionLeadership,
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

test.beforeEach(() => {
  configureBossExpeditionDefinitions([{
    id: 'test_boss',
    name: '테스트 보스',
    level: 120,
    mapId: 'test_boss_map'
  }]);
});

test.after(() => configureBossExpeditionDefinitions([]));

test('the live expedition list stays empty until an instance boss is released', () => {
  configureBossExpeditionDefinitions([]);
  assert.deepEqual(getBossExpeditionState('viewer').definitions, []);
  assert.deepEqual(getBossExpeditionState('viewer').queues, []);
});

test('members may register before the leader slot is occupied', () => {
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 1, user: member('member'), now: 900 });
  const queue = getBossExpeditionState('member', 950).queues[0];
  assert.equal(queue.slots[0], null);
  assert.equal(queue.slots[1].userId, 'member');
  assert.equal(queue.isLeader, false);
});

test('the leader can transfer leadership to another expedition member', () => {
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 3, user: member('successor'), now: 1_100 });
  transferBossExpeditionLeadership({
    bossId: 'test_boss',
    leaderId: 'leader',
    newLeaderId: 'successor',
    now: 1_200
  });
  const successorView = getBossExpeditionState('successor', 1_300).queues[0];
  assert.equal(successorView.slots[0].userId, 'successor');
  assert.equal(successorView.slots[3].userId, 'leader');
  assert.equal(successorView.isLeader, true);
  assert.throws(() => transferBossExpeditionLeadership({
    bossId: 'test_boss',
    leaderId: 'leader',
    newLeaderId: 'successor',
    now: 1_400
  }), /현재 원정대장/);
});

test('users can register, move, and unregister a selected expedition slot', () => {
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 4, user: member('member'), now: 1_100 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 5, user: member('member'), now: 1_200 });
  let queue = getBossExpeditionState('member', 1_300).queues[0];
  assert.equal(queue.slots[5].userId, 'member');
  assert.equal(queue.viewerSlot, 5);

  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 5, user: member('member'), now: 1_400 });
  queue = getBossExpeditionState('member', 1_500).queues[0];
  assert.equal(queue.viewerSlot, -1);
  assert.equal(queue.memberCount, 1);
});

test('leader assigns every member before starting a 30 second confirmation', () => {
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 1, user: member('member'), now: 1_100 });
  assert.throws(() => startBossEntryConfirmation({
    bossId: 'test_boss', leaderId: 'leader', now: 2_000
  }), /모든 원정대원/);

  const layout = setBossExpeditionPartyLayout({
    bossId: 'test_boss',
    leaderId: 'leader',
    parties: [{ memberIds: ['leader', 'member'] }],
    now: 2_100
  });
  assert.equal(layout.members.length, 2);
  const queue = startBossEntryConfirmation({
    bossId: 'test_boss', leaderId: 'leader', now: 3_000
  });
  assert.equal(queue.confirmation.expiresAt, 3_000 + ENTRY_CONFIRMATION_MS);
});

test('all confirmations enter together while a cancellation removes only that member', () => {
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 0, user: member('leader'), now: 1_000 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 1, user: member('member'), now: 1_100 });
  setBossExpeditionPartyLayout({
    bossId: 'test_boss',
    leaderId: 'leader',
    parties: [{ memberIds: ['leader', 'member'] }],
    now: 1_200
  });
  const queue = startBossEntryConfirmation({
    bossId: 'test_boss', leaderId: 'leader', now: 1_300
  });
  const confirmationId = queue.confirmation.id;
  assert.equal(respondBossEntry({
    bossId: 'test_boss', userId: 'leader', confirmationId, accepted: true, now: 1_400
  }).ready, false);
  const ready = respondBossEntry({
    bossId: 'test_boss', userId: 'member', confirmationId, accepted: true, now: 1_500
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.members.map((entry) => entry.userId), ['leader', 'member']);

  resetBossExpeditionRuntime();
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 0, user: member('leader'), now: 2_000 });
  toggleBossExpeditionSlot({ bossId: 'test_boss', slotIndex: 1, user: member('member'), now: 2_100 });
  setBossExpeditionPartyLayout({
    bossId: 'test_boss', leaderId: 'leader', parties: [{ memberIds: ['leader', 'member'] }], now: 2_200
  });
  const second = startBossEntryConfirmation({
    bossId: 'test_boss', leaderId: 'leader', now: 2_300
  });
  const declined = respondBossEntry({
    bossId: 'test_boss',
    userId: 'member',
    confirmationId: second.confirmation.id,
    accepted: false,
    now: 2_400
  });
  assert.equal(declined.declinedUserId, 'member');
  assert.equal(getBossExpeditionState('leader', 2_500).queues[0].memberCount, 1);
});
