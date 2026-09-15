import assert from 'node:assert/strict';
import test from 'node:test';
import { createMailboxGateway, createMailboxRequestGuard, normalizeMail } from '../src/services/mailboxGateway.js';

function fakeFetch(routes, calls) {
  return async (url, options) => {
    calls.push({ url, options });
    const payload = routes[new URL(url).pathname];
    return { ok: true, status: 200, json: async () => payload };
  };
}

test('mailbox gateway normalizes mail and adopts claim snapshots', async () => {
  const calls = [];
  const gateway = createMailboxGateway({
    apiBase: 'https://example.test',
    fetchImpl: fakeFetch({
      '/api/tcg/mail': { mailbox: [{ id: 'm1', title: '선물', rewards: { coins: 10, standardPacks: 1 } }] },
      '/api/tcg/mail/claim': {
        mailbox: [], leaseId: 'l1', generation: 2, revision: 8,
        state: { wallet: { coins: 10 } },
      },
    }, calls),
  });
  const listed = await gateway.list('player-token');
  assert.deepEqual(listed.mailbox[0].rewards, { coins: 10, standardPacks: 1 });
  const claimed = await gateway.claim('player-token', { mailId: 'm1', baseRevision: 7 });
  assert.equal(claimed.snapshot.revision, 8);
  assert.deepEqual(claimed.snapshot.state, { wallet: { coins: 10 } });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer player-token');
});

test('admin gateway keeps credentials in a POST body and uses only the returned token afterward', async () => {
  const calls = [];
  const gateway = createMailboxGateway({
    apiBase: 'https://example.test',
    fetchImpl: fakeFetch({
      '/api/tcg/admin/auth/login': { token: 'admin-token' },
      '/api/tcg/admin/users': { users: [] },
      '/api/tcg/admin/grants/catalog': { packages: [{ id: 'tester-package-1' }] },
    }, calls),
  });
  assert.equal((await gateway.adminLogin('operator', 'secret')).token, 'admin-token');
  await gateway.adminUsers('admin-token');
  const catalog = await gateway.adminGrantCatalog('admin-token');
  assert.equal(catalog.packages[0].id, 'tester-package-1');
  assert.equal(JSON.parse(calls[0].options.body).password, 'secret');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer admin-token');
  assert.equal(calls[1].options.body, undefined);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer admin-token');
});

test('mail normalization clamps invalid rewards', () => {
  assert.deepEqual(normalizeMail({ id: 'm', rewards: { coins: -5, packs: '2.9' } }).rewards, {
    coins: 0,
    standardPacks: 2,
  });
});

test('mail normalization preserves pending, expired, and claimed status', () => {
  assert.equal(normalizeMail({ id: 'pending' }).status, 'pending');
  assert.equal(normalizeMail({
    id: 'expired',
    expiresAt: '2000-01-01T00:00:00.000Z',
  }).status, 'expired');
  assert.equal(normalizeMail({
    id: 'claimed',
    status: 'expired',
    claimedAt: '2026-09-14T00:00:00.000Z',
  }).status, 'claimed');
});

test('mailbox request guard rejects late responses after account or token changes', () => {
  const guard = createMailboxRequestGuard();
  const accountA = guard.begin({ accountId: 'account-a', token: 'token-a' });
  assert.equal(guard.isCurrent(accountA, { accountId: 'account-a', token: 'token-a' }), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(accountA, { accountId: 'account-a', token: 'token-a' }), false);

  const accountB = guard.begin({ accountId: 'account-b', token: 'token-b' });
  assert.equal(guard.isCurrent(accountA, { accountId: 'account-b', token: 'token-b' }), false);
  assert.equal(guard.isCurrent(accountB, { accountId: 'account-b', token: 'token-b' }), true);
  assert.equal(guard.isCurrent(accountB, { accountId: 'account-b', token: 'stale-token' }), false);
});
