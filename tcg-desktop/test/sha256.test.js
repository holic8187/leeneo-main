import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {sha256Fallback, sha256Hex} from '../src/core/sha256.js';

const expected = bytes => createHash('sha256').update(bytes).digest('hex');

test('SHA-256 fallback matches published empty, abc and million-a vectors', async () => {
  for (const [text, hash] of [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['a'.repeat(1000000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
  ]) assert.equal(await sha256Fallback(new TextEncoder().encode(text)), hash);
});

test('binary padding and chunk boundaries match Node SHA-256 with no input mutation', async () => {
  for (const size of [1, 7, 31, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1023, 1024, 1025, 262143, 262144, 262145, 2097155]) {
    const input = Uint8Array.from({length: size}, (_, i) => ((i * 131) ^ (i >>> 3) ^ (i >>> 11)) & 255);
    const before = expected(input);
    assert.equal(await sha256Fallback(input), before, `length ${size}`);
    assert.equal(expected(input), before, 'input remains untouched');
  }
  const bytes = new TextEncoder().encode('앞부분:호이 카드 원화❄️:뒷부분');
  const slice = bytes.subarray(5, bytes.length - 4);
  assert.equal(await sha256Fallback(slice), expected(slice));
  assert.equal(await sha256Fallback(new DataView(slice.buffer, slice.byteOffset, slice.byteLength)), expected(slice));
  assert.equal(await sha256Fallback(bytes.buffer), expected(bytes));
});

test('native WebCrypto is preferred and unavailable or throwing implementations still verify the digest', async () => {
  const input = new TextEncoder().encode('원화 해시 검증');let calls = 0;
  assert.equal(await sha256Hex(input, {subtle: {digest: (...args) => {calls++;return webcrypto.subtle.digest(...args);}}}), expected(input));
  assert.equal(calls, 1);
  const blocked = {get subtle() {throw new Error('SecurityError');}};
  for (const cryptoImpl of [null, {}, {subtle: undefined}, {subtle: {digest: async () => {throw new DOMException('unsupported', 'NotSupportedError');}}}, blocked,
    {subtle: {digest: async () => new ArrayBuffer(0)}}]) {
    assert.equal(await sha256Hex(input, cryptoImpl), expected(input));
  }
  // Explicit undefined follows the current global environment, as on a WebView.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true});
    assert.equal(await sha256Hex(input, undefined), expected(input));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);else delete globalThis.crypto;
  }
});
