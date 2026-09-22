import { MAX_ENHANCEMENT } from './cardManagement.js';
import { roleForCard } from './cardProgression.js';

export const CARD_EMBLEM_ASSET_ROOT = './assets/ui';
export const CARD_EMBLEM_SIZES = Object.freeze(['micro', 'compact', 'standard', 'large']);

const normalizedSize = (value) => (
  CARD_EMBLEM_SIZES.includes(String(value)) ? String(value) : 'standard'
);

export function normalizeEnhancementEmblemStage(value) {
  const stage = Math.floor(Number(value));
  if (!Number.isFinite(stage)) return 0;
  return Math.min(MAX_ENHANCEMENT, Math.max(0, stage));
}

export function enhancementEmblemDefinition(value) {
  const stage = normalizeEnhancementEmblemStage(value);
  return Object.freeze({
    stage,
    label: `강화 +${stage}`,
    asset: `${CARD_EMBLEM_ASSET_ROOT}/card-enhancement-${stage}.svg`,
    maxed: stage === MAX_ENHANCEMENT,
  });
}

export function roleEmblemDefinition(cardOrId) {
  const cardId = String(typeof cardOrId === 'string' ? cardOrId : cardOrId?.id || '').trim();
  if (!cardId) return null;
  const role = roleForCard(cardId);
  return Object.freeze({
    id: role.id,
    label: `${role.label} 역할`,
    asset: `${CARD_EMBLEM_ASSET_ROOT}/card-role-${role.id}.svg`,
  });
}

export function renderEnhancementEmblem(value) {
  const emblem = enhancementEmblemDefinition(value);
  return `<img class="card-enhancement-emblem card-enhancement-emblem--${emblem.stage}${emblem.maxed ? ' is-max' : ''}" src="${emblem.asset}" alt="${emblem.label}" role="img" width="96" height="64" data-enhancement-stage="${emblem.stage}" />`;
}

export function renderRoleEmblem(cardOrId) {
  const emblem = roleEmblemDefinition(cardOrId);
  if (!emblem) return '';
  return `<img class="card-role-emblem card-role-emblem--${emblem.id}" src="${emblem.asset}" alt="${emblem.label}" role="img" width="64" height="64" data-card-role="${emblem.id}" />`;
}

/**
 * Render both art-corner emblems in a single pointer-transparent layer.
 *
 * Sizes are intended for these surfaces:
 * - micro: raid units, 4-up preset thumbnails, and compact squad portraits
 * - compact: pack results and medium selection portraits
 * - standard: collection cards
 * - large: card detail and enhancement focus art
 *
 * Set captioned when the host has a name strip across its bottom edge. The
 * role emblem remains at the visual lower-left, immediately above that strip.
 */
export function renderCardEmblems(cardOrId, enhancement = 0, {
  size = 'standard',
  captioned = false,
  hidden = false,
  showEnhancement = true,
  showRole = true,
} = {}) {
  if (hidden || (!showEnhancement && !showRole)) return '';
  const normalized = normalizedSize(size);
  const enhancementMarkup = showEnhancement ? renderEnhancementEmblem(enhancement) : '';
  const roleMarkup = showRole ? renderRoleEmblem(cardOrId) : '';
  if (!enhancementMarkup && !roleMarkup) return '';
  return `<i class="card-art-emblems card-art-emblems--${normalized}${captioned ? ' has-caption' : ''}">${enhancementMarkup}${roleMarkup}</i>`;
}
