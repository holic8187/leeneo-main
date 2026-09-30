import { roleForCard } from './cardProgression.js';
import { createEquipment } from './equipment.js';
import { secureRandom } from './packEngine.js';

// Pure, shared rules. The server owns admission, randomness and rewards;
// importing these numbers in the client is presentation, not authorization.
export const COOP_RULES = Object.freeze({
  partySize: 4, representativesPerPlayer: 3, dailyEntries: 2,
  readyTimeoutMs: 30_000, turnTimeoutMs: 20_000, maxRounds: 7,
  srCardStageSum: 24,
});

const unit = (random) => Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
const stageSumValue = (value) => Math.min(40, Math.max(4, Math.floor(Number(value) || 4)));

export function characterIdForCard(cardOrId) {
  const id = typeof cardOrId === 'object' ? cardOrId?.cardId || cardOrId?.id : cardOrId;
  return String(id || '').replace(/-(?:c|u|r|rr|rrr|sr|hr|ur|ssr)$/u, '');
}

/** Exhaust all 3^4 assignments: greedy selection can miss a valid party. */
export function selectCooperativeParty(players, random = secureRandom) {
  if (!Array.isArray(players) || players.length !== COOP_RULES.partySize) return null;
  if (new Set(players.map((player) => String(player.accountId || ''))).size !== 4
    || players.some((player) => !player.accountId || !Array.isArray(player.cards)
      || player.cards.length !== 3 || player.cards.some((card) => !characterIdForCard(card))
      || new Set(player.cards.map(characterIdForCard)).size !== 3)) return null;
  // A common queue case is everybody registering the same three people.
  // Reject it before enumerating assignments, including large waiting queues.
  if (new Set(players.flatMap((player) => player.cards.map(characterIdForCard))).size < 4) return null;
  let best = null;
  let bestCoverage = -1;
  let bestPower = -1;
  let tied = 0;
  const visit = (index, selected, characters) => {
    if (index === players.length) {
      const coverage = new Set(selected.map(({ card }) => {
        const role = card.role?.id || card.role;
        return ['attack', 'defense', 'support'].includes(role) ? role : roleForCard(card.cardId || card.id).id;
      })).size;
      const power = selected.reduce((sum, { card }) => sum + Math.max(0, Number(card.attack ?? card.combatPower ?? card.power) || 0), 0);
      if (coverage > bestCoverage || (coverage === bestCoverage && power > bestPower)) {
        best = selected.slice(); bestCoverage = coverage; bestPower = power; tied = 1;
      } else if (coverage === bestCoverage && power === bestPower) {
        tied += 1;
        if (unit(random) < 1 / tied) best = selected.slice();
      }
      return;
    }
    for (const card of players[index].cards) {
      const character = characterIdForCard(card);
      if (characters.has(character)) continue;
      characters.add(character);
      selected.push({ ...players[index], card });
      visit(index + 1, selected, characters);
      selected.pop(); characters.delete(character);
    }
  };
  visit(0, [], new Set());
  return best;
}

export function getCooperativeDifficulty(value) {
  const stageSum = stageSumValue(value);
  const progress = (stageSum - 4) / 36;
  return {
    stageSum, maxHp: stageSum * 12_500,
    baseDamage: 8 + stageSum * 0.25,
    skillCount: 2 + Math.floor((stageSum - 4) / 9),
    coins: stageSum * 500, standardPacks: Math.ceil(stageSum / 4),
    relicChance: (1 + 9 * progress) / 1000,
    equipmentChance: 0.15 + 0.35 * progress,
    guaranteedSrCard: stageSum >= COOP_RULES.srCardStageSum,
  };
}

export function createCooperativeBoss(value) {
  const difficulty = getCooperativeDifficulty(value);
  const { stageSum } = difficulty;
  const skills = [
    {
      id: 'tetra-linked-pulse', name: '사중 공명파', cooperativePattern: 'linked-pulse',
      description: '공명 피해를 살아 있는 아군이 나누어 받습니다. 생존 인원이 줄면 한 명이 받는 피해가 커집니다.',
      target: 'all', totalDamage: 36 + stageSum, cooldown: 3,
    },
    {
      id: 'tetra-resonance-mark', name: '붕괴 예고', cooperativePattern: 'resonance-mark',
      description: '공격력이 가장 높은 아군을 표시하고 다음 보스 행동에 폭발시킵니다. 폭발 전 브레이크로 해제할 수 있습니다.',
      target: 'highest-power', damage: 0, markDamage: 30 + stageSum * 0.5, cooldown: 3,
    },
    {
      id: 'tetra-prism-shift', name: '삼색 위상막', cooperativePattern: 'prism-shift',
      description: '받는 피해를 40% 줄입니다. 서로 다른 아군 3명이 공격하거나 브레이크를 일으키면 해제됩니다.',
      target: 'self', damage: 0, value: 40, requiredAttackers: 3, cooldown: 4,
    },
    {
      id: 'tetra-echo-strike', name: '잔향 역류', cooperativePattern: 'echo-strike',
      description: '직전 아군 행동이 스킬이면 추가 피해를 줍니다. 기본 공격으로 위험한 잔향을 줄일 수 있습니다.',
      target: 'random', damage: 18 + stageSum * 0.25, skillBonusDamage: 12, cooldown: 3,
    },
    {
      id: 'tetra-shield-siphon', name: '결계 조율', cooperativePattern: 'shield-siphon',
      description: '아군 보호막의 30%를 흡수해 자신의 보호막으로 바꾼 뒤 공격합니다. 남은 보호막은 이어지는 피해를 흡수합니다.',
      target: 'all', drainPercent: 30, shieldConversion: 100, damage: 18, cooldown: 4,
    },
    {
      id: 'tetra-cross-current', name: '엇갈린 파장', cooperativePattern: 'cross-current',
      description: '서로 다른 아군 둘을 공격해 한 명은 피해량, 다른 한 명은 받는 회복량을 2턴간 20% 감소시킵니다.',
      target: 'random', targetCount: 2, damage: 20, debuffPercent: 20, duration: 2, cooldown: 3,
    },
  ];
  return {
    id: 'coop-tetra', name: '사중공명체 테트라', image: './assets/bosses/coop-tetra.png',
    stage: Math.ceil(stageSum / 4), stageSum, maxHp: difficulty.maxHp,
    baseDamage: difficulty.baseDamage, skills: skills.slice(0, difficulty.skillCount),
  };
}

function weightedChoice(weights, random) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  let roll = unit(random) * entries.reduce((total, [, weight]) => total + weight, 0);
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return entries.at(-1)?.[0];
}

/** Roll once per player on the server, then persist before showing results. */
export function rollCooperativeRewards(value, {
  random = secureRandom, cardPools = {}, equipmentFactory = createEquipment,
  relicIds = ['luxury-bag'], victory = true,
} = {}) {
  const difficulty = getCooperativeDifficulty(value);
  const rewards = {
    coins: victory ? difficulty.coins : Math.floor(difficulty.coins * 0.1),
    standardPacks: victory ? difficulty.standardPacks : 0,
    cards: [], relics: [], equipment: [],
  };
  if (!victory) return rewards;
  if (difficulty.guaranteedSrCard) {
    const weights = Object.fromEntries(Object.entries({ sr: 70, hr: 22, ur: 7, ssr: 1 })
      .filter(([rarity]) => Array.isArray(cardPools[rarity]) && cardPools[rarity].length));
    const rarity = weightedChoice(weights, random);
    const pool = cardPools[rarity] || [];
    if (!pool.length) throw new Error('협동 레이드 SR 이상 카드 보상 풀이 비어 있습니다.');
    rewards.cards.push({ cardId: pool[Math.floor(unit(random) * pool.length)], quantity: 1 });
  }
  if (unit(random) < difficulty.relicChance && relicIds.length) {
    rewards.relics.push({ relicId: relicIds[Math.floor(unit(random) * relicIds.length)], quantity: 1 });
  }
  if (unit(random) < difficulty.equipmentChance) {
    const progress = (difficulty.stageSum - 4) / 36;
    const rarity = weightedChoice({ c: 92 - 22 * progress, r: 7.8 + 18 * progress, ur: 0.19 + 4 * progress, ssr: 0.01 }, random);
    const item = equipmentFactory({ type: unit(random) < 0.5 ? 'armor' : 'weapon', rarity, random });
    if (item) rewards.equipment.push({ ...item, source: { type: 'cooperative-raid', missionId: 'coop-tetra' } });
  }
  return rewards;
}
