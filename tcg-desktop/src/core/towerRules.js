import { cardArtLocation } from './cardArtLocation.js';
export const TOWER_RULE_VERSION = 1;
export const TOWER_MAX_ROUNDS = 7;
export const TOWER_MONTHLY_REWARD_TIERS = Object.freeze([
  { maxRank: 1, rewards: { coins: 100000, srPremiumPacks: 5 } },
  { maxRank: 3, rewards: { coins: 70000, srPremiumPacks: 3 } },
  { maxRank: 10, rewards: { coins: 50000, srPremiumPacks: 2 } },
  { maxRank: 30, rewards: { coins: 30000, premiumPacks: 3 } },
  { maxRank: 100, rewards: { coins: 15000, premiumPacks: 2 } },
  { maxRank: null, rewards: { coins: 5000, standardPacks: 3 } },
]);

export function towerMonthWindow(now = Date.now()) {
  const value = Number(now instanceof Date ? now.getTime() : now);
  if (!Number.isFinite(value)) throw new TypeError('날짜가 올바르지 않습니다.');
  const shifted = new Date(value + 9 * 3600000);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth();
  return { seasonKey: `${y}-${String(m + 1).padStart(2, '0')}`, startsAt: Date.UTC(y, m, 1, -9), resetsAt: Date.UTC(y, m + 1, 1, -9) };
}

export function towerRewardForRank(rank, tiers = TOWER_MONTHLY_REWARD_TIERS) {
  if (!Number.isSafeInteger(rank) || rank < 1) return null;
  const band = tiers.find(entry => entry.maxRank == null || rank <= entry.maxRank);
  return band ? { ...band.rewards } : null;
}

// A failed floor records its best attempt, never accumulated retry damage.
export function towerRankingScore(clearedFloor, progress = 0) {
  return Math.max(0, Math.floor(Number(clearedFloor) || 0)) * 1000000 + Math.min(999999, Math.max(0, Math.floor(Number(progress) || 0)));
}

export function towerBossForFloor(floor = 1) {
  const level = Math.max(1, Math.floor(Number(floor) || 1));
  const stage = Math.min(8, 1 + Math.floor((level - 1) / 5));
  const damage = 5 + Math.floor(Math.sqrt(level) * 2);
  // Polynomial growth avoids numeric overflow and keeps later floors rising.
  const maxHp = Math.min(Number.MAX_SAFE_INTEGER / 4, Math.round(18000 * Math.pow(level, 1.7)));
  const skills = [
    { id: 'tower-swipe', name: '탑의 휩쓸기', unlock: 2, target: 'random-two-living-cards', damage: damage + 10, cooldownTurns: 3, description: '무작위 생존 아군 2장에게 강화된 공격을 합니다.' },
    { id: 'tower-roar', name: '수호자의 포효', unlock: 3, target: 'all-living-cards', damage: damage + 4, cooldownTurns: 4, description: '모든 생존 아군에게 피해를 줍니다.' },
    { id: 'tower-seal', name: '봉인된 계단', unlock: 4, target: 'highest-power-living-card', damage: damage + 14, cooldownTurns: 4, status: { id: 'seal', turns: 1 }, description: '공격력이 가장 높은 아군을 공격하고 스킬을 봉인합니다.' },
    { id: 'tower-fire', name: '고층의 열기', unlock: 5, target: 'all-living-cards', damage: damage + 6, cooldownTurns: 5, status: { id: 'burn', damage: 6, turns: 2 }, description: '전체 공격과 함께 2턴 동안 화상을 남깁니다.' },
    { id: 'tower-armor', name: '수호자의 갑주', unlock: 6, target: 'self', shieldPercentOfStageHp: 4, cooldownTurns: 5, description: '최대 HP의 4% 보호막을 얻습니다.' },
    { id: 'tower-pressure', name: '정상의 압박', unlock: 7, target: 'all-living-cards', damage: damage + 12, cooldownTurns: 5, status: { id: 'damage-down', percent: 15, turns: 2 }, description: '전체 공격 후 2턴 동안 아군의 피해량을 15% 낮춥니다.' },
  ].filter(skill => skill.unlock <= stage);
  return { id: 'deadline-dragon', name: `${level}층 · 마감기한 드래곤`, image: cardArtLocation('deadline-dragon','./assets/cards/deadline-dragon.webp'), floor: level, stage, maxHp, basicAttackDamage: damage, skills };
}
