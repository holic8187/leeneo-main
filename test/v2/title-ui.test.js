'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const index = fs.readFileSync(path.join(ROOT, 'public/v2/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'public/v2/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'public/v2/styles.css'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'src/v2/registerV2Routes.js'), 'utf8');

test('equipped titles render below local and remote character names', () => {
  assert.match(index, /class="character-title hidden"/);
  assert.match(app, /remote-player-title hidden/);
  assert.match(app, /applyEquippedTitleElement/);
  assert.match(styles, /\.character-title\s*\{[^}]*top:-47px/s);
  assert.match(styles, /\.character-tag\s*\{[^}]*top:\s*-70px/s);
  assert.match(styles, /\.character-tag\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /\.remote-player-tag b\s*\{[^}]*white-space:nowrap/s);
});

test('owned titles have a separate inventory panel and equipment slot', () => {
  assert.match(app, /function titleInventoryPanel\(\)/);
  assert.match(app, /획득하기 전까지 칭호와 조건은 공개되지 않습니다/);
  assert.match(app, /title:\s*\{\s*label:\s*'칭호'/s);
  assert.match(app, /data-equip-title/);
  assert.match(app, /data-unequip-title/);
  assert.match(routes, /app\.post\('\/api\/v2\/titles\/equip'/);
  assert.match(routes, /app\.post\('\/api\/v2\/titles\/unequip'/);
});

test('new title awards reveal their condition in a dedicated popup', () => {
  assert.match(index, /id="titleAwardModal"/);
  assert.match(index, /id="titleAwardBannerName"/);
  assert.match(index, /id="titleAwardCondition"/);
  assert.match(app, /획득 조건 · \$\{title\.condition/);
  assert.match(routes, /app\.post\('\/api\/v2\/titles\/acknowledge'/);
  assert.match(styles, /\.title-award-modal\s*\{\s*z-index:120/);
});

test('title display effects include the requested glow and animated motifs', () => {
  const assets = {
    'employee-card': 'new-employee.webp',
    'cat-paws': 'cat-butler.webp',
    'golden-kindness': 'premium-character.webp',
    'beast-heart': 'beast-heart.webp',
    'golden-tycoon': 'tycoon.webp',
    'job-emblem': 'pure-blood.webp',
    'mental-shield': 'mental-champion.webp',
    'evasive-wind': 'evasive-human.webp'
  };
  for (const [effect, asset] of Object.entries(assets)) {
    assert.match(styles, new RegExp(`title-effect-${effect}`));
    assert.match(styles, new RegExp(`/v2/assets/titles/${asset.replace('.', '\\.')}`));
    assert.equal(fs.existsSync(path.join(ROOT, 'public/v2/assets/titles', asset)), true);
    assert.ok(fs.statSync(path.join(ROOT, 'public/v2/assets/titles', asset)).size > 10_000);
  }
  assert.match(styles, /@keyframes title-banner-frames/);
  assert.match(styles, /background-size:200% 300%/);
  assert.match(styles, /@keyframes title-golden-spark/);
  assert.match(styles, /@keyframes title-shield-repair/);
  assert.match(styles, /@keyframes title-wind-shift/);
});
