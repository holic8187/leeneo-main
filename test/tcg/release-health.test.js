'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { version } = require('../../tcg-desktop/package.json');
const { releaseHealth } = require('../../src/tcg/services/releaseHealth');

test('release health preserves existing fields and reports the packaged TCG version', () => {
  for (const appMode of ['v1', 'v2']) {
    assert.deepEqual(releaseHealth(appMode), {
      ok: true,
      message: 'server is running',
      appMode,
      tcgVersion: version,
    });
  }
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('release health responses have independent payloads and only public fields', () => {
  const first = releaseHealth('v2');
  first.tcgVersion = 'changed';
  first.secret = 'not part of the health response';
  const next = releaseHealth('v2');
  assert.equal(next.tcgVersion, version);
  assert.deepEqual(Object.keys(next).sort(), ['appMode', 'message', 'ok', 'tcgVersion']);
});
