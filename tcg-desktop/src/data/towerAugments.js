const define = (id, tier, name, description) => Object.freeze({ id, tier, name, description });

// These are combat rules, not display-only bonuses. towerBattle applies every ID.
export const TOWER_AUGMENTS = Object.freeze([
  define('keen-edge', 'silver', '벼린 칼날', '모든 아군의 공격력이 8% 증가합니다.'),
  define('sturdy-heart', 'silver', '든든한 심장', '모든 아군의 최대 HP가 15% 증가합니다.'),
  define('departure-shield', 'silver', '출발 안전띠', '전투 시작 시 모든 아군이 최대 HP의 12% 보호막을 얻습니다.'),
  define('small-breath', 'silver', '작은 숨 고르기', '각 아군은 자신의 행동 후 최대 HP의 3%를 회복합니다.'),
  define('first-strike', 'silver', '첫인상은 강렬하게', '각 아군의 첫 기본공격 피해 배율이 40%p 증가합니다.'),
  define('crack-finder', 'silver', '균열 탐지', '아군의 공격에 브레이크 피해 4를 추가합니다.'),
  define('warm-care', 'silver', '따뜻한 간호', '모든 아군이 카드 스킬로 받는 회복량이 15% 증가합니다.'),
  define('light-step', 'silver', '가벼운 발걸음', '모든 아군의 회피율이 8%p 증가합니다. 회피율 상한은 90%입니다.'),
  define('momentum', 'gold', '멈추지 않는 기세', '각 아군은 행동을 마칠 때마다 주는 피해가 3% 증가하며, 증강 1개당 최대 30%까지 쌓입니다.'),
  define('layered-guard', 'gold', '겹겹의 방호', '모든 아군이 받는 직접 피해가 10% 감소합니다. 다른 피해 감소와 곱연산합니다.'),
  define('skill-manual', 'gold', '숙련자의 비급', '모든 아군의 스킬 공격 피해가 20% 증가합니다.'),
  define('round-bastion', 'gold', '차곡차곡 성벽', '2턴부터 새 턴이 시작될 때마다 생존 아군이 최대 HP의 5% 보호막을 얻습니다.'),
  define('desperate-edge', 'gold', '벼랑 끝의 칼날', 'HP가 최대 HP의 절반 이하인 아군은 주는 피해가 30% 증가합니다.'),
  define('full-company', 'gold', '완전한 원정대', '아군 4명이 모두 살아 있는 동안 모든 아군의 주는 피해가 18% 증가합니다.'),
  define('glass-engine', 'gold', '유리 동력로', '모든 아군의 공격력이 30% 증가하지만 최대 HP가 20% 감소합니다. HP 감소는 중첩 시 곱연산합니다.'),
  define('quick-start', 'gold', '빠른 준비', '각 아군의 첫 스킬 사용 후 쿨타임이 1턴 감소합니다. 중첩하면 적용 횟수가 늘어납니다.'),
  define('long-climb', 'prism', '끝없는 오르막', '2턴부터 턴마다 모든 아군의 공격력이 12%씩 증가합니다. 증강 1개당 최대 72%입니다.'),
  define('danger-contract', 'prism', '위험한 계약', '모든 아군의 공격력이 50% 증가하지만 보스의 직접 공격 피해가 20% 증가합니다. 위험은 중첩 시 곱연산합니다.'),
  define('crystal-shell', 'prism', '수정 번데기', '모든 아군의 최대 HP가 25% 감소하는 대신 전투 시작 시 변경된 최대 HP의 45% 보호막을 얻습니다. HP 감소는 중첩 시 곱연산합니다.'),
  define('clockwork', 'prism', '세 번째 태엽', '각 아군은 자신의 행동 3회마다 남은 스킬 쿨타임이 1턴 감소합니다.'),
  define('opening-festival', 'prism', '개막의 축제', '첫 2턴 동안 모든 아군이 주는 피해가 45% 증가합니다.'),
  define('last-light', 'prism', '마지막 불빛', '생존 아군이 1명일 때 그 아군이 주는 피해가 100% 증가합니다.'),
  define('purifying-cycle', 'prism', '정화의 순환', '각 아군은 자신의 행동 3회마다 자신에게 걸린 약화 효과 1개를 제거하고 최대 HP의 10% 보호막을 얻습니다.'),
  define('overflowing-spring', 'prism', '넘치는 샘물', '각 아군은 자신의 행동 후 최대 HP의 6%를 회복합니다. 회복 직전 HP가 가득 차 있으면 대신 최대 HP의 3% 보호막을 얻습니다.'),
]);
export const TOWER_AUGMENT_BY_ID = Object.freeze(Object.fromEntries(TOWER_AUGMENTS.map(entry => [entry.id, entry])));
export const TOWER_AUGMENT_TIERS = Object.freeze(['silver', 'gold', 'prism']);

export function towerAugmentCounts(ids = []) {
  return ids.reduce((counts, id) => { if (TOWER_AUGMENT_BY_ID[id]) counts[id] = (counts[id] || 0) + 1; return counts; }, {});
}

export function createTowerOffer(checkpoint, random = Math.random) {
  // Each five-floor checkpoint advances the tier; later cycles still contain
  // silver choices so sustain and utility remain available throughout the run.
  const tier = TOWER_AUGMENT_TIERS[Math.floor(Math.max(0, checkpoint) / 5) % 3];
  const pool = TOWER_AUGMENTS.filter(entry => entry.tier === tier).map(entry => entry.id);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(Math.max(0, Math.min(.999999999, Number(random()) || 0)) * (i + 1)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { checkpoint, tier, options: pool.slice(0, 3), rerolledSlots: [] };
}

export function rerollTowerOffer(offer, slot, random = Math.random) {
  if (!offer || !Number.isInteger(slot) || slot < 0 || slot > 2 || offer.rerolledSlots.includes(slot)) throw new Error('이 후보는 더 이상 재추첨할 수 없습니다.');
  const pool = TOWER_AUGMENTS.filter(entry => entry.tier === offer.tier && !offer.options.includes(entry.id));
  const next = structuredClone(offer);
  next.options[slot] = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(.999999999, Number(random()) || 0)) * pool.length))].id;
  next.rerolledSlots.push(slot);
  return next;
}
