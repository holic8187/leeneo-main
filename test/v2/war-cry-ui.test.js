'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'public/v2/styles.css'), 'utf8');

test('war cry shows a clear live debuff marker above affected monsters', () => {
  assert.match(app, /monster-debuff-marker hidden/);
  assert.match(app, /monster\.combatDebuffSkillId === 'war_cry'/);
  assert.match(app, /📣 공격↓ 피해↑ 명중↓/);
  assert.match(styles, /\.monster-debuff-marker\s*\{[^}]*bottom:\s*calc\(100% \+ 25px\)/s);
  assert.match(styles, /@keyframes monster-debuff-pulse/);
});
