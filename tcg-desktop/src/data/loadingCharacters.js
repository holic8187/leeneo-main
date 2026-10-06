import { ALL_CARDS } from './cardCatalog.js';
import { LOADING_SPRITE_GEOMETRY } from './loadingSpriteGeometry.js';

// Three physical poses: left stride, passing/neutral, right stride. Reuse the
// exact passing pose on the return beat; the sheet's bottom-right cell is unused.
export const LOADING_WALK_SEQUENCE = Object.freeze([0, 1, 2, 1]);

export const LOADING_SPRITE_LAYOUT = Object.freeze({
  columns: 2,
  rows: 2,
  frames: 4,
  sourcePoses: 3,
  durationMs: 720,
});

// One generated walking sheet per person, not one per card rarity. Keep this
// list explicit so catalog additions require an illustration and coverage check.
const CHARACTER_IDS = Object.freeze([
  'simsim', 'winter', 'kkamdung', 'nanche', 'rayeon', 'mango',
  'morae', 'mond', 'somfist', 'shanghai', 'meongpeu', 'sseubi',
  'gyullak', 'guma', 'wollu', 'easy', 'eungga', 'peach',
  'jandi', 'chuming', 'choonsik', 'coca', 'pie', 'hoi',
  'rookie-analyst', 'sales-fox', 'pantry-cat', 'peach-sentry',
  'hwang-manager', 'gammam-neo', 'kim-manager', 'deadline-dragon',
]);

export const LOADING_CHARACTERS = Object.freeze(CHARACTER_IDS.map((id) => {
  const card = ALL_CARDS.find((entry) => (entry.characterId || entry.id) === id);
  return Object.freeze({
    id,
    name: card?.characterName || card?.name || id,
    // Relative paths also work in packaged Electron file:// and Capacitor apps.
    sprite: `./assets/loading/${id}-walk.png`,
    geometry: LOADING_SPRITE_GEOMETRY[id] || null,
  });
}));

export const loadingCharacterById = (id) => LOADING_CHARACTERS.find((entry) => entry.id === id) || null;

export function loadingFrameTransforms(character) {
  const geometry = character?.geometry;
  if (!geometry || geometry.bounds.length < 3) {
    const fallback = [0, 1, 2].map((sourceFrame) => ({ sourceFrame, x: 8, y: 8, scale: .86 }));
    return LOADING_WALK_SEQUENCE.map((sourceFrame) => fallback[sourceFrame]);
  }
  const unitX = 112 / (geometry.width / 2);
  const unitY = 112 / (geometry.height / 2);
  const poses = geometry.bounds.slice(0, 3);
  const maxWidth = Math.max(...poses.map(([left, , right]) => (right - left) * unitX));
  const maxHeight = Math.max(...poses.map(([, top, , bottom]) => (bottom - top) * unitY));
  // Fit the visible artwork, not the source cell: adding safe transparent
  // margins to a sheet must not make its character smaller than the others.
  const scale = Math.min(92 / maxWidth, 92 / maxHeight);
  const transforms = poses.map(([left, , right, bottom], sourceFrame) => ({
    sourceFrame,
    x: Number((56 - (left + right) / 2 * unitX * scale).toFixed(3)),
    y: Number((104 - (sourceFrame % 2) - bottom * unitY * scale).toFixed(3)),
    scale: Number(scale.toFixed(6)),
  }));
  return LOADING_WALK_SEQUENCE.map((sourceFrame) => transforms[sourceFrame]);
}

export function createLoadingCharacterPicker({ random = Math.random } = {}) {
  let selected = null;
  let previousId = '';
  return {
    beginEpisode() {
      if (selected) return selected;
      const candidates = LOADING_CHARACTERS.filter((entry) => entry.id !== previousId);
      const roll = Number(random());
      const boundedRoll = Number.isFinite(roll) ? Math.max(0, Math.min(1, roll)) : 0;
      const index = Math.min(candidates.length - 1, Math.floor(boundedRoll * candidates.length));
      selected = candidates[index] || LOADING_CHARACTERS[0];
      return selected;
    },
    current: () => selected,
    endEpisode() {
      if (selected) previousId = selected.id;
      selected = null;
    },
  };
}
