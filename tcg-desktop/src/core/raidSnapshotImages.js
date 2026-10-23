import { cardById } from '../data/cardCatalog.js';
import { cardArtLocation } from './cardArtLocation.js';

const BOSS_IMAGES = new Map([
  ['coop-tetra', cardArtLocation('coop-tetra','./assets/bosses/coop-tetra.webp')],
]);

/** Saved image paths are presentation hints, not stable asset identities. */
export function currentRaidSnapshotImage(snapshot = {}) {
  const id = String(snapshot.cardId || snapshot.id || '');
  const cardId = id === 'deadline-dragon-raid' ? 'deadline-dragon' : id;
  return cardById(cardId)?.image || BOSS_IMAGES.get(id) || snapshot.image || '';
}

/** Resolve every nested cast/queue snapshot without mutating combat or save data.
 * Exact IDs preserve legacy cards and leave unknown/external image fallbacks alone.
 * Structural sharing avoids copying unchanged logs and other battle fields.
 */
export function normalizeRaidSnapshotImages(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeRaidSnapshotImages);
    return normalized.some((entry, index) => entry !== value[index]) ? normalized : value;
  }
  let normalized = value;
  for (const [key, entry] of Object.entries(value)) {
    const next = normalizeRaidSnapshotImages(entry);
    if (next !== entry) {
      normalized = { ...normalized, [key]: next };
    }
  }
  const image = currentRaidSnapshotImage(value);
  if (image && image !== value.image) {
    if (normalized === value) normalized = { ...value };
    normalized.image = image;
  }
  return normalized;
}
