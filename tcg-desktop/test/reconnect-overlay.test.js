import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_CARDS } from '../src/data/cardCatalog.js';
import { LOADING_CHARACTERS, LOADING_SPRITE_LAYOUT, LOADING_WALK_SEQUENCE, createLoadingCharacterPicker, loadingFrameTransforms } from '../src/data/loadingCharacters.js';
import { renderReconnectOverlay, RECONNECT_FALLBACK_DELAY_MS } from '../src/ui/reconnectOverlay.js';
import { auditLoadingSprites } from '../scripts/audit-loading-sprites.mjs';

test('loading illustration manifest covers every unique current and legacy character exactly once', () => {
  const catalogIds = [...new Set(ALL_CARDS.map((card) => card.characterId || card.id))].sort();
  const manifestIds = LOADING_CHARACTERS.map((character) => character.id).sort();
  assert.deepEqual(manifestIds, catalogIds);
  assert.equal(LOADING_CHARACTERS.length, 32);
  assert.equal(new Set(manifestIds).size, manifestIds.length);
  for (const character of LOADING_CHARACTERS) {
    assert.ok(character.name);
    assert.equal(character.sprite, `./assets/loading/${character.id}-walk.png`);
    assert.ok(Object.isFrozen(character));
  }
  assert.deepEqual(LOADING_SPRITE_LAYOUT, { columns: 2, rows: 2, frames: 4, sourcePoses: 3, durationMs: 720 });
});

test('loading character stays unchanged during an episode and never immediately repeats', () => {
  let rolls = 0;
  const picker = createLoadingCharacterPicker({ random: () => { rolls += 1; return 0; } });
  assert.equal(picker.current(), null);
  const first = picker.beginEpisode();
  for (let render = 0; render < 12; render += 1) {
    assert.equal(picker.beginEpisode(), first);
    assert.equal(picker.current(), first);
  }
  assert.equal(rolls, 1);
  picker.endEpisode();
  assert.equal(picker.current(), null);
  picker.endEpisode();
  const second = picker.beginEpisode();
  assert.notEqual(second.id, first.id);
  assert.equal(rolls, 2);
  for (const roll of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(LOADING_CHARACTERS.includes(createLoadingCharacterPicker({ random: () => roll }).beginEpisode()));
  }
});

test('each character can be chosen with equal-width random ranges', () => {
  const seen = LOADING_CHARACTERS.map((_, index) => createLoadingCharacterPicker({
    random: () => (index + .5) / LOADING_CHARACTERS.length,
  }).beginEpisode().id);
  assert.deepEqual(seen, LOADING_CHARACTERS.map((character) => character.id));
});

test('initial loader remains minimal, accessible, and stable without error text or premature actions', () => {
  const character = LOADING_CHARACTERS[4];
  const html = renderReconnectOverlay({ character, phase: 'connection-error', detail: 'noisy transport error', elapsedMs: RECONNECT_FALLBACK_DELAY_MS - 1 });
  assert.match(html, /로딩 중…/);
  assert.match(html, /id="reconnect-overlay"/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.ok(html.includes(character.sprite));
  assert.equal((html.match(/class="reconnect-walker-frame"/g) || []).length, 4);
  assert.equal(html.includes('noisy transport error'), false);
  assert.equal(html.includes('<button'), false);
  assert.equal(html.includes('cloud-takeover'), false);
  assert.equal(html, renderReconnectOverlay({ character, phase: 'connection-error', elapsedMs: RECONNECT_FALLBACK_DELAY_MS - 1 }));
});

test('prolonged outage explains automatic retry and exposes only safe explicit fallback actions', () => {
  const html = renderReconnectOverlay({
    character: 'coca', phase: 'offline', elapsedMs: RECONNECT_FALLBACK_DELAY_MS,
    nextRetryMs: 2401, detail: '<script>unsafe</script>', secretMode: true,
  });
  assert.match(html, /인터넷이 연결되면 자동으로 다시 이어집니다/);
  assert.match(html, /data-action="cloud-retry"/);
  assert.match(html, /data-action="logout"/);
  assert.match(html, /3초 후 다시 확인/);
  assert.match(html, /is-secret/);
  assert.match(html, /reconnect-walker-neutral/);
  assert.equal(html.includes('assets/loading/'), false);
  assert.equal(html.includes('data-loading-character='), false);
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('cloud-takeover'), false);
  assert.equal(html.includes('cloud-conflict-local'), false);
  const pendingSave = renderReconnectOverlay({ phase: 'saving', canLogout: false, elapsedMs: 20000 });
  assert.equal(pendingSave.includes('data-action="logout"'), false);
  const unexpectedSprite = renderReconnectOverlay({ character: { id: 'unknown', sprite: 'javascript:untrusted' } });
  assert.equal(unexpectedSprite.includes('javascript:'), false);
  assert.ok(unexpectedSprite.includes(LOADING_CHARACTERS[0].sprite));
});

test('mobile overlay uses safe areas and discrete four-frame motion with a reduced-motion option', () => {
  const css = readFileSync(new URL('../src/reconnect-overlay.css', import.meta.url), 'utf8');
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /inset:\s*0/);
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.ok(css.includes(`safe-area-inset-${edge}`));
  assert.match(css, /backdrop-filter:\s*blur\(13px\)/);
  assert.match(css, /width:\s*min\(100%, 320px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /background-size:\s*200% 200%/);
  assert.match(css, /calc\(var\(--walk-frame-ms, 180ms\) \* 4\) steps\(1, end\) infinite/);
  const html = renderReconnectOverlay();
  for (const position of ['0% 0%', '100% 0%', '0% 100%']) assert.ok(html.includes(`background-position:${position}`));
  assert.equal(html.includes('background-position:100% 100%'), false);
  assert.match(css, /animation-delay:\s*calc\(\(var\(--walk-frame\) - 4\) \* var\(--walk-frame-ms, 180ms\)\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation:\s*none/);
});

test('frame transforms align audited image anchors with safe padding and only a one-pixel walking bob', () => {
  for (const character of LOADING_CHARACTERS.filter((entry) => entry.geometry)) {
    const { width, height, bounds } = character.geometry;
    const transforms = loadingFrameTransforms(character);
    assert.equal(transforms.length, 4);
    const scales = new Set(transforms.map((frame) => frame.scale));
    assert.equal(scales.size, 1, `${character.id} must not stretch or resize between frames`);
    const largestRenderedExtent = Math.max(...bounds.slice(0, 3).flatMap(([left, top, right, bottom]) => [
      (right - left) * 112 / (width / 2) * transforms[0].scale,
      (bottom - top) * 112 / (height / 2) * transforms[0].scale,
    ]));
    assert.ok(Math.abs(largestRenderedExtent - 92) < .001, `${character.id}: transparent source padding must not shrink the character`);
    for (let index = 0; index < 4; index += 1) {
      const { x, y, scale, sourceFrame } = transforms[index];
      const [left, top, right, bottom] = bounds[sourceFrame];
      const xUnit = 112 / (width / 2) * scale;
      const yUnit = 112 / (height / 2) * scale;
      assert.ok(left * xUnit + x >= 9.9, `${character.id} left padding`);
      assert.ok(right * xUnit + x <= 102.1, `${character.id} right padding`);
      assert.ok(top * yUnit + y >= 10.9, `${character.id} top padding`);
      assert.ok(Math.abs(bottom * yUnit + y - (104 - sourceFrame % 2)) < .002, `${character.id} shared baseline`);
    }
  }
});

test('walking order reuses the exact intermediate pose and never reads the unused fourth cell', () => {
  assert.deepEqual(LOADING_WALK_SEQUENCE, [0, 1, 2, 1]);
  for (const character of LOADING_CHARACTERS) {
    const frames = loadingFrameTransforms(character);
    assert.deepEqual(frames.map((frame) => frame.sourceFrame), [0, 1, 2, 1]);
    assert.strictEqual(frames[1], frames[3], `${character.id}: the intermediate pose must be identical`);
    const html = renderReconnectOverlay({ character });
    assert.deepEqual([...html.matchAll(/data-walk-source-frame="(\d)"/g)].map((match) => Number(match[1])), [0, 1, 2, 1]);
    assert.equal(html.includes('background-position:100% 100%'), false);
    const changedUnusedCell = {
      ...character,
      geometry: { ...character.geometry, bounds: [...character.geometry.bounds.slice(0, 3), [0, 0, 99999, 99999]] },
    };
    assert.deepEqual(loadingFrameTransforms(changedUnusedCell), frames, `${character.id}: unused cell cannot affect visible scale or alignment`);
  }
  const fallback = loadingFrameTransforms(null);
  assert.strictEqual(fallback[1], fallback[3]);
});

test('walking preview exposes per-character physical pose stepping and slow or normal playback', () => {
  const preview = readFileSync(new URL('../scripts/loading-preview.html', import.meta.url), 'utf8');
  for (const mode of ['pose-0', 'pose-1', 'pose-2', 'normal', 'slow']) assert.ok(preview.includes(`'${mode}'`));
  assert.ok(preview.includes('data-walk-source-frame') || preview.includes('dataset.walkSourceFrame'));
  assert.ok(preview.includes('600ms'));
  assert.ok(preview.includes('180ms'));
  assert.ok(preview.includes('1 → 2 → 3 → 2'));
  assert.ok(preview.includes('renderReconnectOverlay({character})'));
});

test('all loading characters ship real transparent three-pose PNGs with current alignment geometry', () => {
  const { geometry, audits, missing } = auditLoadingSprites();
  assert.deepEqual(missing, [], 'each character needs its generated walking sheet');
  assert.equal(Object.keys(audits).length, LOADING_CHARACTERS.length);
  for (const character of LOADING_CHARACTERS) {
    const audit = audits[character.id];
    assert.equal(audit.alphaMin, 0, `${character.id} needs genuine transparent pixels`);
    assert.equal(audit.alphaMax, 255, `${character.id} needs opaque illustration pixels`);
    assert.equal(new Set(audit.frameHashes.slice(0, 3)).size, 3, `${character.id} needs three distinct physical poses`);
    assert.deepEqual(character.geometry, geometry[character.id], `${character.id}: re-audit alignment after replacing its illustration`);
    const cellPixels = audit.width * audit.height / 4;
    for (const cell of audit.cells.slice(0, 3)) {
      assert.ok(cell.transparent > cellPixels * .01, `${character.id}: each cell needs a transparent background`);
      assert.ok(cell.visible > cellPixels * .01, `${character.id}: each cell needs a visible character`);
      const [left, top, right, bottom] = cell.bounds;
      assert.ok(left > 0 && top > 0 && right < audit.width / 2 && bottom < audit.height / 2,
        `${character.id}: keep each visible pose inside its cell so neighbouring art cannot enter the crop`);
    }
  }
});
