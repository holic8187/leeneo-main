const MAX_RELIC_ID_LENGTH = 120;

export const RELIC_CATALOG = Object.freeze([
  Object.freeze({
    id: 'luxury-bag',
    name: '명품 가방',
    description: '누군가가 극도로 싫어하는 가방입니다. 들리는 소문으로는 그 사람이 누군가에게 속아 비싸게 구매한 가방이라는 소문이 있습니다...',
    image: './assets/relics/luxury-bag.png',
    effect: Object.freeze({
      type: 'expedition-coin-multiplier',
      percent: 5,
    }),
  }),
]);

const RELICS_BY_ID = new Map(RELIC_CATALOG.map((relic) => [relic.id, relic]));

function relicId(value) {
  return String(value || '').trim().slice(0, MAX_RELIC_ID_LENGTH);
}

function relicCount(value) {
  const count = Math.floor(Number(value));
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function relicById(id) {
  return RELICS_BY_ID.get(relicId(id)) || null;
}

export function normalizeRelicInventory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const [rawId, rawCount] of Object.entries(value)) {
    const id = relicId(rawId);
    const count = relicCount(rawCount);
    // Preserve unknown IDs so an older client cannot erase relics introduced
    // by a newer release. Unknown relics remain unequippable until catalogued.
    if (id && count) normalized[id] = count;
  }
  return normalized;
}

export function ownedRelic(inventory, id) {
  const normalizedId = relicId(id);
  return Boolean(relicById(normalizedId) && relicCount(inventory?.[normalizedId]));
}

export function addRelicToInventory(inventory, id, quantity = 1) {
  const normalized = normalizeRelicInventory(inventory);
  const normalizedId = relicId(id);
  const added = relicCount(quantity);
  if (!normalizedId || !added) return normalized;
  normalized[normalizedId] = Math.min(
    Number.MAX_SAFE_INTEGER,
    relicCount(normalized[normalizedId]) + added,
  );
  return normalized;
}

export function expeditionCoinMultiplierForRelic(idOrRelic) {
  const id = typeof idOrRelic === 'object' ? idOrRelic?.id : idOrRelic;
  const relic = relicById(id);
  if (relic?.effect?.type !== 'expedition-coin-multiplier') return 1;
  return 1 + (Math.max(0, Number(relic.effect.percent) || 0) / 100);
}
