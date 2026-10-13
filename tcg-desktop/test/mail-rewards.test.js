import assert from 'node:assert/strict';
import test from 'node:test';
import { adminMailRewards, createAdminMailDraft, hasMailRewards, mailRewardEntries } from '../src/core/mailRewards.js';

test('SSR-only and premium-only mails remain claimable after being marked read', () => {
  for (const key of ['premiumPacks', 'ssrTickets']) {
    const mail = { status: 'pending', readAt: 1, rewards: { [key]: 2 } };
    assert.equal(hasMailRewards(mail), true);
    const entries = mailRewardEntries(mail.rewards);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].key, key);
    assert.equal(entries[0].amount, 2);
  }
  assert.equal(hasMailRewards({ rewards: { premiumPacks: 0, ssrTickets: -1 } }), false);
  assert.equal(hasMailRewards({}), false);
});

test('reward display differentiates all pack types and ignores invalid balances', () => {
  assert.deepEqual(mailRewardEntries({ coins: 10, standardPacks: 1, premiumPacks: 2, ssrTickets: 3 })
    .map(({ label, amount }) => [label, amount]), [
    ['동전', 10], ['표준 카드팩', 1], ['고급 카드팩', 2], ['SSR 확정 랜덤 뽑기권', 3],
  ]);
  assert.deepEqual(mailRewardEntries({ coins: Infinity, premiumPacks: 'bad', ssrTickets: -1 }), []);
});

test('admin custom form submits new rewards and every fresh account draft resets them', () => {
  const form = new FormData();
  form.set('coins', '100');
  form.set('standardPacks', '2');
  form.set('premiumPacks', '3');
  form.set('ssrTickets', '4');
  assert.deepEqual(adminMailRewards(form), { coins: 100, standardPacks: 2, premiumPacks: 3, ssrTickets: 4 });
  const first = createAdminMailDraft();
  first.ssrTickets = '99';
  const next = createAdminMailDraft();
  assert.equal(next.ssrTickets, '0');
  assert.equal(next.premiumPacks, '0');
  assert.equal(next.target, 'all');
  assert.equal(next.presetId, 'custom');
});

test('server package rewards override custom quantities when form inputs are disabled', () => {
  const form = new FormData();
  form.set('ssrTickets', '999');
  form.set('premiumPacks', '999');
  assert.deepEqual(adminMailRewards(form, { rewards: { coins: 1500, standardPacks: 15 } }),
    { coins: 1500, standardPacks: 15, premiumPacks: 0, ssrTickets: 0 });
  assert.deepEqual(adminMailRewards(new FormData(), { rewards: { ssrTickets: 2 } }),
    { coins: 0, standardPacks: 0, premiumPacks: 0, ssrTickets: 2 });
});
