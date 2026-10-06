import assert from 'node:assert/strict';
import test from 'node:test';
import { createReconnectController, reconnectErrorKind } from '../src/core/reconnectController.js';
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('cold boot, repeated online and manual retry share one pending attempt', async () => {
  const pending = deferred(); let calls = 0;
  const controller = createReconnectController({ attempt: () => { calls += 1; return pending.promise; } });
  const first = controller.start();
  assert.equal(controller.start(), first);
  assert.equal(controller.retry(), first);
  await settle(); assert.equal(calls, 1);
  pending.resolve(true); assert.equal(await first, true);
  assert.equal(controller.getSnapshot().phase, 'connected'); controller.cancel();
});

test('503 schedules bounded automatic retry and recovery clears it', async () => {
  const timers = new Map(); let clock = 1000; let serial = 0; let calls = 0;
  const controller = createReconnectController({
    attempt: async () => { if (++calls < 3) throw Object.assign(new Error('db down'), { status: 503 }); return true; },
    now: () => clock, backoffMs: [100, 200],
    setTimeoutImpl: (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id; },
    clearTimeoutImpl: (id) => timers.delete(id),
  });
  await controller.start();
  assert.equal(controller.getSnapshot().phase, 'waiting');
  assert.equal(controller.getSnapshot().nextRetryAt, 1100);
  let entry = [...timers.entries()][0]; timers.delete(entry[0]); clock += entry[1].delay; entry[1].fn(); await settle();
  assert.equal(controller.getSnapshot().nextRetryAt, 1300);
  entry = [...timers.entries()][0]; timers.delete(entry[0]); clock += entry[1].delay; entry[1].fn(); await settle();
  assert.equal(calls, 3); assert.equal(controller.getSnapshot().phase, 'connected'); assert.equal(timers.size, 0);
  controller.cancel();
});

test('timeout aborts attempt; late results cannot unlock the UI', async () => {
  let signal; const pending = deferred();
  const controller = createReconnectController({ timeoutMs: 10, attempt: (context) => { signal = context.signal; return pending.promise; } });
  assert.equal(await controller.start(), false);
  assert.equal(signal.aborted, true);
  assert.equal(controller.getSnapshot().phase, 'waiting');
  pending.resolve(true); await settle();
  assert.equal(controller.getSnapshot().phase, 'waiting'); controller.cancel();
});

test('background cancels stale attempts, foreground reconnects once, logout ignores late callbacks', async () => {
  const first = deferred(); const second = deferred(); let calls = 0; const signals = [];
  const controller = createReconnectController({ attempt: ({ signal }) => { signals.push(signal); return ++calls === 1 ? first.promise : second.promise; } });
  const boot = controller.start(); await settle();
  await controller.setForeground(false); assert.equal(signals[0].aborted, true);
  first.resolve(true); await boot; assert.equal(controller.getSnapshot().phase, 'suspended');
  const foreground = controller.setForeground(true); await settle();
  assert.equal(controller.start(), foreground); assert.equal(calls, 2);
  controller.cancel(); second.resolve(true); await foreground;
  assert.equal(controller.getSnapshot().phase, 'idle'); assert.equal(await controller.start(), false);
});

test('expired credentials end retry while conflicts and other-device play require explicit action', async () => {
  let expired = 0;
  for (const error of [Object.assign(new Error('expired'), { status: 401 }), Object.assign(new Error('moved'), { code: 'PLAYING_ELSEWHERE' }), Object.assign(new Error('conflict'), { code: 'CLOUD_SAVE_CONFLICT' })]) {
    let calls = 0;
    const controller = createReconnectController({ attempt: async () => { calls += 1; throw error; }, onExpired: () => expired++ });
    await controller.start(); await controller.start();
    await controller.setForeground(false); await controller.setForeground(true);
    assert.equal(calls, 1); assert.ok(['blocked', 'expired'].includes(controller.getSnapshot().phase)); controller.cancel();
  }
  assert.equal(expired, 1); assert.equal(reconnectErrorKind({ status: 503, code: 'DATABASE_UNAVAILABLE' }), 'retry');
});

test('an explicit block wins over a late successful attempt without aborting the conflict lease', async () => {
  const pending = deferred(); let signal;
  const controller = createReconnectController({ attempt: (context) => { signal = context.signal; return pending.promise; } });
  const attempt = controller.start(); await settle();
  controller.block(); assert.equal(signal.aborted, false);
  await controller.setForeground(false); await controller.setForeground(true);
  assert.equal(signal.aborted, false);
  pending.resolve(true); assert.equal(await attempt, false);
  assert.equal(controller.getSnapshot().phase, 'blocked'); controller.cancel();
});

test('a detached blocked attempt deadline cannot dispose the live conflict lease', async () => {
  let signal;
  const controller = createReconnectController({ timeoutMs: 10, attempt: (context) => { signal = context.signal; return new Promise(() => {}); } });
  const pending = controller.start(); await settle(); controller.block();
  await pending;
  assert.equal(signal.aborted, false); assert.equal(controller.getSnapshot().phase, 'blocked'); controller.cancel();
});
