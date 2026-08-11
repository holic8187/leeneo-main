'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const styles = fs.readFileSync(path.join(ROOT, 'public/v2/styles.css'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');

test('raid clear dialog stays above its blur scrim and the death dialog', () => {
  assert.match(styles, /\.boss-raid-clear-modal\s*\{[^}]*z-index:\s*60/s);
  assert.match(
    styles,
    /\.boss-raid-clear-sheet\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/s
  );
  assert.match(index, /\/v2\/styles\.css\?v=50/);
});

test('boss entry confirmation uses explicit accept and decline button styles', () => {
  assert.match(index, /id="bossEntryAccept"[^>]*>수락<\/button>/);
  assert.match(index, /id="bossEntryDecline"[^>]*>거절<\/button>/);
  assert.match(
    styles,
    /\.boss-entry-confirmation button\s*\{[^}]*background:\s*#f0c541/s
  );
  assert.match(
    styles,
    /\.boss-entry-confirmation button\.secondary-action\s*\{[^}]*background:\s*#3f5d51/s
  );
});

test('Bald Kim retreat NPC opens a two-choice prompt and calls the abandon route', () => {
  assert.match(index, /id="bossRaidAbandonAccept"[^>]*>나간다</);
  assert.match(index, /id="bossRaidAbandonCancel"[^>]*>아니다</);
  assert.match(app, /data-npc-action="\$\{escapeHtml\(npc\.action \|\| ''\)\}"/);
  assert.match(app, /\/api\/v2\/boss-raids\/abandon/);
  assert.match(routes, /app\.post\('\/api\/v2\/boss-raids\/abandon'/);
  assert.match(styles, /\.boss-raid-abandon-sheet\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/s);
});
