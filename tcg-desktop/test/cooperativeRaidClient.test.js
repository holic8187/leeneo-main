import test from 'node:test';
import assert from 'node:assert/strict';
import { createCooperativeRaidClient, toggleCooperativeRepresentative } from '../src/core/cooperativeRaidClient.js';
import { createCooperativeRaidGateway } from '../src/services/cooperativeRaidGateway.js';
import { renderCooperativePanel, renderCooperativeReady } from '../src/ui/cooperativeRaidView.js';

const deferred = () => { let resolve; let reject; const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; }); return { promise, resolve, reject }; };
const payload = (phase = 'idle', extra = {}) => ({ cooperative: { phase, serverNow: 1000, entriesRemaining: 2, entriesUsed: 0, ...extra } });
const identity = { accountId: 'a', token: 'secret-a' };

test('cooperative representatives reject same person in different rarities and more than three', () => {
  assert.deepEqual(toggleCooperativeRepresentative([], 'morae-ssr'), ['morae-ssr']);
  assert.throws(() => toggleCooperativeRepresentative(['morae-ssr'], 'morae-r'), /같은 인물/);
  assert.throws(() => toggleCooperativeRepresentative(['morae-ssr', 'coca-ssr', 'hoi-r'], 'winter-c'), /3장/);
  assert.deepEqual(toggleCooperativeRepresentative(['morae-ssr', 'coca-ssr'], 'morae-ssr'), ['coca-ssr']);
});

test('cooperative gateway uses authenticated API and normalizes claim snapshot', async () => {
  const requests = [];
  const gateway = createCooperativeRaidGateway({ apiBase: 'https://test.example/', fetchImpl: async (url, request) => {
    requests.push({ url, ...request });
    return { ok: true, json: async () => ({ ...payload(), snapshot: { revision: '7', state: { wallet: { coins: 5 } }, lease: { id: 'lease' } } }) };
  } });
  await gateway.state('token');
  const result = await gateway.claim('token', { roomId: 'room', baseRevision: 6 });
  assert.equal(requests[0].url, 'https://test.example/api/tcg/raids/cooperative/state');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].body, undefined);
  assert.equal(requests[1].headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(requests[1].body), { roomId: 'room', baseRevision: 6 });
  assert.equal(result.snapshot.revision, 7);
  assert.equal(result.snapshot.leaseId, 'lease');
});

test('cooperative gateway rejects unauthenticated, malformed, and server-denied results', async () => {
  const gateway = createCooperativeRaidGateway({ apiBase: 'https://test.example', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(gateway.state(''), { code: 'AUTH_REQUIRED' });
  await assert.rejects(gateway.state('token'), { code: 'INVALID_RESPONSE' });
  const denied = createCooperativeRaidGateway({ apiBase: 'https://test.example', fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ code: 'COOP_NOT_YOUR_TURN', message: '다른 사원 차례' }) }) });
  await assert.rejects(denied.action('token', {}), { code: 'COOP_NOT_YOUR_TURN', status: 409 });
  const conflict = createCooperativeRaidGateway({ apiBase: 'https://test.example', fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ code: 'SAVE_CONFLICT', msg: '최신 저장 기록을 불러와 주세요.', revision: 9, state: { wallet: { coins: 12 } } }) }) });
  await assert.rejects(conflict.claim('token', {}), (error) => {
    assert.equal(error.message, '최신 저장 기록을 불러와 주세요.');
    assert.equal(error.snapshot.revision, 9);
    assert.equal(error.snapshot.state.wallet.coins, 12);
    return true;
  });
});

test('cooperative gateway bounds a fetch that ignores abort', async () => {
  const gateway = createCooperativeRaidGateway({ apiBase: 'https://test.example', timeoutMs: 8, fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(gateway.state('token'), { code: 'TIMEOUT' });
});

test('cooperative claim retries an uncertain result with the same receipt and revision', async () => {
  const calls = [];
  const gateway = createCooperativeRaidGateway({ apiBase: 'https://test.example', fetchImpl: async (_url, request) => {
    calls.push(request.body);
    if (calls.length === 1) throw new Error('response lost after server saved');
    return { ok: true, json: async () => ({ ...payload(), alreadyClaimed: true, snapshot: { revision: 8, state: { wallet: { coins: 5 } } } }) };
  } });
  const result = await gateway.claim('token', { roomId: 'r1', baseRevision: 7, leaseId: 'lease' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
  assert.equal(result.snapshot.revision, 8);
  assert.equal(result.alreadyClaimed, true);
});

test('cooperative client coalesces polls and updates server clock without redundant render', async () => {
  const response = deferred(); let calls = 0; let changes = 0;
  const client = createCooperativeRaidClient({ gateway: { state: () => { calls += 1; return response.promise; } }, getIdentity: () => identity, now: () => 900, onChange: () => { changes += 1; } });
  const first = client.refresh(); const second = client.refresh();
  assert.equal(calls, 1);
  response.resolve(payload()); await Promise.all([first, second]);
  assert.equal(client.getState().clockOffset, 100);
  assert.equal(client.getState().loading, false);
  const previousChanges = changes;
  await client.refresh();
  assert.equal(changes, previousChanges);
});

test('cooperative client ignores old account reads after logout and reset', async () => {
  let who = { ...identity }; const old = deferred();
  const client = createCooperativeRaidClient({ gateway: { state: (token) => token === 'secret-a' ? old.promise : Promise.resolve(payload('queued')) }, getIdentity: () => who });
  const first = client.refresh();
  who = { accountId: 'b', token: 'secret-b' }; client.reset();
  await client.refresh(); old.resolve(payload('battle')); await first;
  assert.equal(client.getState().data.phase, 'queued');
});

test('cooperative client serializes writes after reads and prevents duplicate write/poll', async () => {
  const read = deferred(); const write = deferred(); const calls = [];
  const client = createCooperativeRaidClient({ gateway: { state: () => { calls.push('read'); return read.promise; }, action: () => { calls.push('write'); return write.promise; } }, getIdentity: () => identity });
  const poll = client.refresh(); const action = client.mutate('action', () => ({ action: 'basic' }));
  await client.mutate('action');
  client.refresh();
  assert.deepEqual(calls, ['read']);
  read.resolve(payload('battle')); await poll; await Promise.resolve();
  assert.deepEqual(calls, ['read', 'write']);
  write.resolve(payload('finished')); await action;
  assert.equal(client.getState().data.phase, 'finished');
  assert.equal(client.getState().pending, '');
});

test('cooperative mutation commits authoritative snapshot before exposing received state', async () => {
  const commits = [];
  const client = createCooperativeRaidClient({ gateway: { claim: async () => ({ ...payload(), snapshot: { revision: 2 } }) }, getIdentity: () => identity });
  await client.mutate('claim', () => ({ baseRevision: 1 }), (result) => { commits.push(result.snapshot.revision); assert.equal(client.getState().data, null); });
  assert.deepEqual(commits, [2]);
  assert.equal(client.getState().data.phase, 'idle');
});

test('cooperative mutation never commits another login response', async () => {
  const response = deferred(); let who = identity; let commits = 0;
  const client = createCooperativeRaidClient({ gateway: { claim: () => response.promise }, getIdentity: () => who });
  const action = client.mutate('claim', () => ({}), () => { commits += 1; });
  await Promise.resolve();
  who = { accountId: 'b', token: 'secret-b' }; client.reset(); response.resolve(payload());
  await action;
  assert.equal(commits, 0);
  assert.equal(client.getState().data, null);
});

test('cooperative failed requests release controls and record attempts for retry backoff', async () => {
  const client = createCooperativeRaidClient({ gateway: { state: async () => { throw new Error('offline'); }, queue: async () => { throw new Error('full'); } }, getIdentity: () => identity, now: () => 12345 });
  await client.refresh();
  assert.equal(client.getState().lastAttemptAt, 12345);
  assert.equal(client.getState().loading, false);
  await assert.rejects(client.mutate('queue'), /full/);
  assert.equal(client.getState().pending, '');
});

const participants = ['winter-c', 'hoi-c', 'morae-c', 'coca-c'].map((cardId, i) => ({ accountId: `a${i}`, nickname: i === 0 ? '<script>x</script>' : `사원 ${i}`, cardId, instanceId: `i${i}`, stage: 6 }));
const room = { id: 'r1', revision: 1, stageSum: 24, activeAccountId: 'a0', turnExpiresAt: 30000, participants, battle: {
  status: 'active', currentActor: 'card', currentActorIndex: 0, round: 1,
  boss: { name: '사중공명체 테트라', hp: 100, maxHp: 1000, breakGauge: 40, skills: [{ name: '붕괴 예고', description: '브레이크로 해제' }] },
  cards: participants.map((p) => ({ id: p.instanceId, cardId: p.cardId, hp: 100, maxHp: 100, statuses: [] })),
} };

test('cooperative global ready popup escapes names and cannot reaccept after accepting', () => {
  assert.equal(renderCooperativeReady({ data: payload().cooperative }), '');
  const html = renderCooperativeReady({ data: payload('ready', { match: { id: 'm', expiresAt: 31000, acceptedAccountIds: ['a0'], participants } }).cooperative, accountId: 'a0', now: 1000 });
  assert.match(html, /role="dialog"/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, /data-action="coop-accept" disabled/);
  assert.match(html, /입장 확인 완료/);
});

test('cooperative battlefield exposes actions only for the authenticated owner', () => {
  const client = { data: payload('battle', { room }).cooperative };
  const mine = renderCooperativePanel({ client, accountId: 'a0', now: 1000 });
  const other = renderCooperativePanel({ client, accountId: 'a1', now: 1000 });
  assert.match(mine, /data-action="coop-basic"/);
  assert.match(mine, /data-coop-target/);
  assert.match(mine, /브레이크로 해제/);
  assert.doesNotMatch(other, /data-action="coop-basic"/);
  assert.equal((mine.match(/class="coop-combat-card /g) || []).length, 4);
});

test('cooperative finished battle exposes server reward claim, not player actions', () => {
  const client = { data: payload('finished', { room, reward: { coins: 12000, standardPacks: 6, cards: [{ cardId: 'morae-sr', quantity: 1 }] } }).cooperative };
  const html = renderCooperativePanel({ client, accountId: 'a0' });
  assert.match(html, /data-action="coop-claim"/);
  assert.match(html, /12,000 동전/);
  assert.doesNotMatch(html, /data-action="coop-basic"/);
});
