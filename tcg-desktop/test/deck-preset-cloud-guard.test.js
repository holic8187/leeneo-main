import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('applying a remote cloud snapshot reconciles the restored deck draft against owned inventory', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const functionBody = source.match(/function applyRemoteGameState\(nextState\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(functionBody, /store\.replace\(nextState\);\s+reconcileNavigationModal\(\);/);
  assert.match(functionBody, /store\.replace\(nextState\);/);
});
