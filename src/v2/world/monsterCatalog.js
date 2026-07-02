'use strict';

const ELEMENTS = Object.freeze(['neutral', 'fire', 'lightning', 'ice', 'holy']);

// HP and EXP are explicit so the internal EXP/HP ratio remains reviewable.
// Nearby monsters vary slightly, while the overall curve stays smooth.
const MONSTER_ROWS = [
  ['paper_dust', '서류 먼지뭉치', 3, 30, 5, '구겨진 메모지', '🧾'],
  ['runaway_stapler', '도망친 스테이플러', 10, 120, 18, '휘어진 심', '📎'],
  ['coffee_slime', '커피 얼룩 슬라임', 17, 300, 30, '굳은 커피 찌꺼기', '☕', { fire: 0.5, ice: 1.5 }],
  ['meeting_mouse', '회의실 생쥐', 24, 600, 48, '갉아먹은 회의록', '📄'],
  ['overtime_bat', '야근 박쥐', 31, 1_000, 68, '검은 출입 기록', '🦇', { holy: 1.5 }],
  ['payroll_mimic', '급여대장 미믹', 38, 1_800, 92, '찢어진 급여명세서', '🧮'],
  ['audit_ghost', '감사실 유령', 45, 2_500, 112, '희미한 감사 도장', '👻', { neutral: 0.75, holy: 1.5 }],
  ['sales_fox', '영업 여우', 52, 4_200, 160, '낡은 계약서', '🦊'],
  ['ad_chameleon', '광고 카멜레온', 59, 7_000, 252, '바랜 광고 전단', '🦎', { lightning: 1.5 }],
  ['bug_beetle', '버그 딱정벌레', 66, 10_500, 340, '깨진 코드 조각', '🐞'],
  ['server_wisp', '서버실 도깨비불', 73, 15_000, 455, '그을린 케이블', '🔥', { fire: 0.5, ice: 1.5 }],
  ['prototype_golem', '시제품 골렘', 80, 27_000, 850, '불량 부품', '🗿', { lightning: 1.5 }],
  ['conveyor_crab', '컨베이어 게', 87, 37_000, 1_300, '녹슨 톱니', '🦀'],
  ['quality_spider', '품질검사 거미', 94, 50_000, 2_250, '검사 탈락표', '🕷️', { fire: 1.5, ice: 0.75 }],
  ['warehouse_boar', '물류창고 멧돼지', 101, 57_000, 3_050, '부서진 운송장', '🐗'],
  ['facility_drone', '시설관리 드론', 108, 72_000, 3_900, '방전된 배터리', '🤖', { lightning: 1.5 }],
  ['research_chimera', '연구동 키메라', 115, 100_000, 5_200, '정체불명 시료', '🧪'],
  ['executive_lion', '임원실 사자', 122, 140_000, 7_000, '금이 간 명패', '🦁', { fire: 0.75, ice: 1.25 }],
  ['overtime_reaper', '무한야근 사신', 131, 210_000, 10_000, '낡은 퇴근 카드', '💀', { neutral: 0.75, holy: 1.75 }],
  ['deadline_dragon', '마감기한 드래곤', 140, 320_000, 15_000, '타버린 결재 문서', '🐉', { fire: 0.5, lightning: 0.75, ice: 1.5 }]
];

const MONSTER_CATALOG = Object.freeze(MONSTER_ROWS.map((
  [id, name, level, maxHp, expReward, lootName, icon, elementalMultipliers = {}]
) => {
  const lootItemId = `monster_loot_${id}`;
  return Object.freeze({
    id,
    name,
    level,
    maxHp,
    expReward,
    icon,
    lootItemId,
    lootName,
    lootIcon: icon,
    elementalMultipliers: Object.freeze({ ...elementalMultipliers }),
    dropTable: Object.freeze({
      misc: Object.freeze([
        Object.freeze({ itemId: lootItemId, name: lootName, icon, quantity: 1, chance: 0.7 })
      ]),
      equipment: Object.freeze([]),
      scrolls: Object.freeze([]),
      potions: Object.freeze([])
    })
  });
}));

function buildMonsterStats(level, overrides = {}) {
  const safeLevel = Math.max(1, Math.min(140, Math.floor(Number(level) || 1)));
  const matched = MONSTER_CATALOG.find((monster) => monster.level === safeLevel);
  const maxHp = Number(overrides.maxHp ?? matched?.maxHp)
    || Math.max(8, Math.round(8 * (1.078 ** (safeLevel - 1))));
  const expReward = Number(overrides.expReward ?? matched?.expReward)
    || Math.max(1, Math.round(maxHp * Math.max(0.04, 0.2 - safeLevel * 0.0011)));
  return {
    maxHp,
    contactDamage: Math.max(4, Math.round(6 + safeLevel * 1.35)),
    physicalDefense: Math.max(1, Math.round(safeLevel * 0.45)),
    magicDefense: Math.max(1, Math.round(safeLevel * 0.42)),
    movementSpeed: 30 + safeLevel % 16,
    monsterAccuracy: 15 + safeLevel * 1.5,
    monsterEvasion: 3 + safeLevel * 0.45,
    expReward
  };
}

function getElementMultiplier(monster, element = 'neutral') {
  const normalized = ELEMENTS.includes(element) ? element : 'neutral';
  return Math.max(0, Number(monster?.elementalMultipliers?.[normalized]) || 1);
}

function getMonsterSpeciesForMap(map) {
  if (!map || map.safeZone) return [];
  const center = (Number(map.minLevel) + Number(map.maxLevel)) / 2;
  return [...MONSTER_CATALOG]
    .sort((left, right) => {
      const difference = Math.abs(left.level - center) - Math.abs(right.level - center);
      return difference || left.level - right.level;
    })
    .slice(0, 2);
}

function getMoneyDrop(level, random = Math.random) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const minimum = safeLevel * 6;
  const maximum = safeLevel * 9;
  return Math.floor(minimum + random() * (maximum - minimum + 1));
}

function getMoneyIcon(amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (value < 100) return '🪙';
  if (value < 500) return '💵';
  if (value < 1_000) return '💴';
  return '💰';
}

function rollMonsterDrops(monster, random = Math.random) {
  if (!monster) return [];
  const money = getMoneyDrop(monster.level, random);
  const drops = [{
    kind: 'money',
    amount: money,
    icon: getMoneyIcon(money),
    name: `${money.toLocaleString('ko-KR')}원`
  }];
  for (const category of ['misc', 'equipment', 'scrolls', 'potions']) {
    for (const entry of monster.dropTable?.[category] || []) {
      if (random() >= Number(entry.chance || 0)) continue;
      drops.push({
        kind: 'item',
        itemId: entry.itemId,
        quantity: Math.max(1, Math.floor(Number(entry.quantity) || 1)),
        icon: entry.icon || '📦',
        name: entry.name || entry.itemId,
        category
      });
    }
  }
  return drops;
}

module.exports = {
  ELEMENTS,
  MONSTER_CATALOG,
  buildMonsterStats,
  getElementMultiplier,
  getMonsterSpeciesForMap,
  getMoneyDrop,
  getMoneyIcon,
  rollMonsterDrops
};
