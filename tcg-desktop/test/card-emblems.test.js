import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CARD_EMBLEM_SIZES,
  enhancementEmblemDefinition,
  normalizeEnhancementEmblemStage,
  renderCardEmblems,
  renderEnhancementEmblem,
  renderRoleEmblem,
  roleEmblemDefinition,
} from '../src/core/cardEmblems.js';

const assetUrl = (name) => new URL(`../public/assets/ui/${name}`, import.meta.url);

test('enhancement emblems clamp to +0 through +5 and always include +0', () => {
  assert.equal(normalizeEnhancementEmblemStage(-9), 0);
  assert.equal(normalizeEnhancementEmblemStage('2.9'), 2);
  assert.equal(normalizeEnhancementEmblemStage(99), 5);
  assert.equal(normalizeEnhancementEmblemStage('invalid'), 0);

  for (let stage = 0; stage <= 5; stage += 1) {
    const definition = enhancementEmblemDefinition(stage);
    assert.equal(definition.label, `강화 +${stage}`);
    assert.equal(definition.asset, `./assets/ui/card-enhancement-${stage}.svg`);
    assert.equal(existsSync(assetUrl(`card-enhancement-${stage}.svg`)), true);
  }

  assert.match(renderEnhancementEmblem(0), /alt="강화 \+0"/);
  assert.match(renderEnhancementEmblem(5), /card-enhancement-emblem--5 is-max/);
});

test('role emblems use progression roles and accessible image labels', () => {
  assert.deepEqual(roleEmblemDefinition('mango-c'), {
    id: 'attack', label: '공격 역할', asset: './assets/ui/card-role-attack.svg',
  });
  assert.equal(roleEmblemDefinition('winter-ur').id, 'defense');
  assert.equal(roleEmblemDefinition('meongpeu-c').id, 'support');
  assert.equal(roleEmblemDefinition(null), null);
  assert.match(renderRoleEmblem('winter-ur'), /alt="방어 역할" role="img"/);
  assert.equal(renderRoleEmblem(null), '');

  for (const role of ['attack', 'defense', 'support']) {
    assert.equal(existsSync(assetUrl(`card-role-${role}.svg`)), true);
  }
});

test('combined card emblem helper supports every scale and caption clearance', () => {
  assert.deepEqual(CARD_EMBLEM_SIZES, ['micro', 'compact', 'standard', 'large']);
  for (const size of CARD_EMBLEM_SIZES) {
    const markup = renderCardEmblems('mango-c', 3, { size });
    assert.match(markup, new RegExp(`card-art-emblems--${size}`));
    assert.match(markup, /data-enhancement-stage="3"/);
    assert.match(markup, /data-card-role="attack"/);
  }
  assert.match(renderCardEmblems('winter-ur', 5, { size: 'micro', captioned: true }), /card-art-emblems--micro has-caption/);
  assert.match(renderCardEmblems('winter-ur', 5, { size: 'unknown' }), /card-art-emblems--standard/);
  assert.equal(renderCardEmblems('winter-ur', 5, { hidden: true }), '');
  assert.equal(renderCardEmblems('winter-ur', 5, { showEnhancement: false, showRole: false }), '');
});

test('SVG assets are self-contained, titled, and use stable view boxes', () => {
  const assets = [
    ...Array.from({ length: 6 }, (_, stage) => `card-enhancement-${stage}.svg`),
    'card-role-attack.svg',
    'card-role-defense.svg',
    'card-role-support.svg',
  ];
  for (const asset of assets) {
    const source = readFileSync(assetUrl(asset), 'utf8');
    assert.match(source, /<svg[^>]+viewBox=/, asset);
    assert.match(source, /<title(?:\s[^>]*)?>/, asset);
    assert.doesNotMatch(source, /<(?:script|image)|href=/, asset);
  }
});
