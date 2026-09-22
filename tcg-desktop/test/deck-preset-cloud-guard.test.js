import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('applying a remote cloud snapshot dismisses a stale deck preset draft', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const functionBody = source.match(/function applyRemoteGameState\(nextState\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(functionBody, /if \(ui\.modal\?\.type === 'deck-preset'\) ui\.modal = null;/);
  assert.match(functionBody, /store\.replace\(nextState\);/);
});
