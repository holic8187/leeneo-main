'use strict';

const {
  getEquipmentDropsForMonsterLevel,
  rollEquipmentInstanceData
} = require('../items/equipmentCatalog');
const { buildScrollDropsForMonsters } = require('../items/scrollCatalog');
const {
  getMasteryBookByOriginalSkill,
  listNormalMonsterMasteryBooks
} = require('../items/masteryBookCatalog');

const ELEMENTS = Object.freeze(['neutral', 'fire', 'lightning', 'ice', 'holy']);
const MONSTER_EXP_MULTIPLIER = 1;

function scaleMonsterExp(expReward) {
  return Math.max(1, Math.round(Math.max(0, Number(expReward) || 0) * MONSTER_EXP_MULTIPLIER));
}

// HP and EXP are explicit so the internal EXP/HP ratio remains reviewable.
// Nearby monsters vary slightly, while the overall curve stays smooth.
const MONSTER_ROWS = [
  ['paper_dust', '서류 먼지뭉치', 3, 30, 5, '구겨진 메모지', '🧾'],
  ['runaway_stapler', '도망친 스테이플러', 10, 120, 18, '휘어진 심', '📎'],
  ['coffee_slime', '커피 얼룩 슬라임', 17, 300, 30, '굳은 커피 찌꺼기', '☕', { fire: 0.5, ice: 1.5 }],
  ['meeting_mouse', '회의실 생쥐', 24, 600, 48, '갉아먹은 회의록', '📄'],
  ['overtime_bat', '야근 박쥐', 31, 1_000, 68, '검은 출입 기록', '🦇', { holy: 1.5 }, true],
  ['payroll_mimic', '급여대장 미믹', 38, 1_800, 92, '찢어진 급여명세서', '🧮'],
  ['audit_ghost', '감사실 유령', 45, 2_500, 112, '희미한 감사 도장', '👻', { neutral: 0.75, holy: 1.5 }, true],
  ['ad_chameleon', '광고 카멜레온', 59, 7_000, 252, '바랜 광고 전단', '🦎', { lightning: 1.5 }],
  ['sales_fox', '영업 여우', 62, 4_200, 160, '낡은 계약서', '🦊'],
  ['bug_beetle', '버그 딱정벌레', 66, 10_500, 340, '깨진 코드 조각', '🐞'],
  ['server_wisp', '서버실 도깨비불', 73, 15_000, 455, '그을린 케이블', '🔥', { fire: 0.5, ice: 1.5, holy: 1.5 }, true],
  ['prototype_golem', '시제품 골렘', 80, 27_000, 850, '불량 부품', '🗿', { lightning: 1.5 }],
  ['conveyor_crab', '컨베이어 게', 87, 37_000, 1_300, '녹슨 톱니', '🦀'],
  ['quality_spider', '품질검사 거미', 94, 50_000, 2_250, '검사 탈락표', '🕷️', { fire: 1.5, ice: 0.75, holy: 1.5 }, true],
  ['warehouse_boar', '물류창고 멧돼지', 101, 57_000, 3_050, '부서진 운송장', '🐗'],
  ['facility_drone', '시설관리 드론', 108, 72_000, 3_900, '방전된 배터리', '🤖', { lightning: 1.5 }],
  ['research_chimera', '연구동 키메라', 115, 100_000, 5_200, '정체불명 시료', '🧪'],
  ['executive_lion', '임원실 사자', 122, 140_000, 7_000, '금이 간 명패', '🦁', { fire: 0.75, ice: 1.25 }],
  ['overtime_reaper', '무한야근 사신', 131, 210_000, 10_000, '낡은 퇴근 카드', '💀', { neutral: 0.75, holy: 1.75 }, true],
  ['deadline_dragon', '마감기한 드래곤', 140, 320_000, 15_000, '타버린 결재 문서', '🐉', { fire: 0.5, lightning: 0.75, ice: 1.5 }],
  ['peach_gate_sentry', '피치전자 게이트 센트리', 130, 200_000, 11_000, '파손된 방문증', '🛡️', { lightning: 1.25 }, false, {
    contactDamage: 620, physicalDefense: 150, magicDefense: 140, counterAttackType: 'swing'
  }],
  ['peach_parcel_bot', '피치 택배 분류봇', 133, 225_000, 12_500, '찌그러진 택배 라벨', '📦', { lightning: 1.25 }, false, {
    contactDamage: 660, physicalDefense: 165, magicDefense: 155, counterAttackType: 'projectile'
  }],
  ['peach_invoice_scanner', '폭주한 전표 스캐너', 136, 250_000, 14_500, '타버린 전표 필름', '🧾', { fire: 1.25 }, false, {
    contactDamage: 700, physicalDefense: 180, magicDefense: 195, counterAttackType: 'projectile'
  }],
  ['peach_solder_drone', '과열 납땜 드론', 139, 280_000, 16_500, '굳은 합금 납', '🛸', { ice: 1.5, fire: 0.5 }, false, {
    contactDamage: 740, physicalDefense: 205, magicDefense: 190, counterAttackType: 'projectile'
  }],
  ['peach_assembly_robot', '조립라인 근무 로봇', 142, 310_000, 19_000, '부러진 조립 팔', '🦾', { lightning: 1.35 }, false, {
    contactDamage: 790, physicalDefense: 230, magicDefense: 210, counterAttackType: 'swing'
  }],
  ['peach_quality_laser', '불량 판정 레이저', 145, 340_000, 22_000, '금이 간 검수 렌즈', '🔦', { lightning: 0.75, ice: 1.25 }, false, {
    contactDamage: 840, physicalDefense: 245, magicDefense: 270, counterAttackType: 'projectile'
  }],
  ['peach_circuit_specter', '회로 기판 망령', 147, 370_000, 26_000, '유령 전도체', '👾', { neutral: 0.75, holy: 1.5 }, true, {
    contactDamage: 890, physicalDefense: 265, magicDefense: 300, counterAttackType: 'projectile'
  }],
  ['peach_executive_android', '임원 경호 안드로이드', 148, 395_000, 29_000, '보안 등급 칩', '🤖', { lightning: 1.25 }, false, {
    contactDamage: 930, physicalDefense: 300, magicDefense: 275, counterAttackType: 'swing'
  }],
  ['peach_overclock_server', '오버클럭 서버랙', 149, 420_000, 33_000, '녹아내린 냉각판', '🖥️', { ice: 1.5, fire: 0.5 }, false, {
    contactDamage: 970, physicalDefense: 290, magicDefense: 340, counterAttackType: 'projectile'
  }],
  ['peach_mainframe_guardian', '피치 메인프레임 수호기', 150, 450_000, 40_000, '중앙처리 코어 조각', '🧠', { lightning: 0.75, holy: 1.25 }, false, {
    contactDamage: 1_020, physicalDefense: 340, magicDefense: 370, counterAttackType: 'swing'
  }]
];

const MONSTER_SCROLL_DROPS = buildScrollDropsForMonsters(MONSTER_ROWS.map((row) => ({
  id: row[0],
  level: row[2],
  // This catalog entry currently has no normal spawn map, so it cannot count
  // toward the two obtainable sources guaranteed for every scroll.
  eligibleForCoverage: row[0] !== 'executive_lion'
})));

const HIGH_LEVEL_MASTERY_MONSTER_IDS = Object.freeze(
  MONSTER_ROWS.filter((row) => Number(row[2]) >= 110).map((row) => row[0])
);
const NORMAL_MONSTER_MASTERY_BOOKS = Object.freeze(listNormalMonsterMasteryBooks());
const NORMAL_MONSTER_MASTERY_BOOK_CHANCE = 0.000015;

function createMasteryBookDrop(item, chance = NORMAL_MONSTER_MASTERY_BOOK_CHANCE) {
  if (!item) return null;
  return Object.freeze({
    itemId: item.id,
    name: item.name,
    icon: item.icon,
    quantity: 1,
    chance
  });
}

function getExtraMasteryBookDropsForMonster(monsterId) {
  if (String(monsterId || '') !== 'deadline_dragon') return [];
  return [
    createMasteryBookDrop(getMasteryBookByOriginalSkill('genesis', 30))
  ].filter(Boolean);
}

function getMasteryBookDropsForMonster(monsterId, level) {
  if (Number(level) < 110) return [];
  const monsterIndex = HIGH_LEVEL_MASTERY_MONSTER_IDS.indexOf(String(monsterId || ''));
  if (monsterIndex < 0 || !HIGH_LEVEL_MASTERY_MONSTER_IDS.length) return [];
  const regularDrops = NORMAL_MONSTER_MASTERY_BOOKS
    .filter((item, index) => index % HIGH_LEVEL_MASTERY_MONSTER_IDS.length === monsterIndex)
    .map((item) => createMasteryBookDrop(item));
  return [
    ...regularDrops,
    ...getExtraMasteryBookDropsForMonster(monsterId)
  ];
}

function getPotionDropsForMonsterLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const drops = [];
  if (safeLevel >= 40 && safeLevel <= 110) {
    const chance = 0.001 + (safeLevel - 40) / 70 * 0.001;
    drops.push(Object.freeze({
      itemId: 'elixir',
      name: '엘릭서',
      icon: '🧪',
      quantity: 1,
      chance
    }));
  }
  if (safeLevel >= 60) {
    const interpolatedLevel = Math.min(110, safeLevel);
    const chance = 0.002 - (interpolatedLevel - 60) / 50 * 0.0005;
    drops.push(Object.freeze({
      itemId: 'power_elixir',
      name: '파워엘릭서',
      icon: '⚗️',
      quantity: 1,
      chance
    }));
  }
  if (safeLevel >= 60) {
    const interpolatedLevel = Math.min(140, safeLevel);
    const chance = Number((0.002 + (interpolatedLevel - 60) / 80 * 0.007).toFixed(6));
    drops.push(Object.freeze({
      itemId: 'chunsik_blessing_potion',
      name: '춘식이의 축복의 물약',
      icon: '✨',
      quantity: 1,
      chance
    }));
  }
  return drops;
}

const THROWING_STAR_DROP_GROUPS = Object.freeze({
  compressed_badge_star: Object.freeze({
    name: '압축 명찰 표창', icon: '🔹', quantity: 600, chance: 0.00002,
    monsterIds: Object.freeze(['server_wisp', 'prototype_golem', 'conveyor_crab'])
  }),
  circuit_shard_star: Object.freeze({
    name: '회로 파편 표창', icon: '🔸', quantity: 600, chance: 0.00002,
    monsterIds: Object.freeze(['facility_drone', 'research_chimera', 'executive_lion'])
  }),
  peach_alloy_star: Object.freeze({
    name: '피치 합금 표창', icon: '✳️', quantity: 600, chance: 0.00002,
    monsterIds: Object.freeze([
      'overtime_reaper', 'peach_solder_drone', 'peach_assembly_robot', 'peach_quality_laser'
    ])
  }),
  executive_approval_star: Object.freeze({
    name: '임원 결재 표창', icon: '✴️', quantity: 600, chance: 0.00002,
    monsterIds: Object.freeze([
      'deadline_dragon', 'peach_executive_android', 'peach_overclock_server',
      'peach_mainframe_guardian'
    ])
  })
});

function getThrowingStarDropsForMonster(monsterId) {
  return Object.entries(THROWING_STAR_DROP_GROUPS)
    .filter(([, group]) => group.monsterIds.includes(String(monsterId || '')))
    .map(([itemId, group]) => Object.freeze({
      itemId,
      name: group.name,
      icon: group.icon,
      quantity: group.quantity,
      chance: group.chance
    }));
}

function getQueenDollFragmentDropsForMonster(monsterId, level) {
  if (!String(monsterId || '').startsWith('peach_')) return [];
  const safeLevel = Math.max(130, Math.min(150, Number(level) || 130));
  const chance = Number((0.00003 + (safeLevel - 130) / 20 * 0.00006).toFixed(8));
  return [Object.freeze({
    itemId: 'queen_doll_fragment',
    name: '퀸돌 조각',
    icon: '💠',
    quantity: 1,
    chance
  })];
}

function getMonsterRetaliationDamageRange(level) {
  const safeLevel = Math.max(1, Math.min(150, Math.floor(Number(level) || 1)));
  const bands = [
    { minimumLevel: 140, minimum: 3_000, maximum: 3_900 },
    { minimumLevel: 130, minimum: 2_350, maximum: 3_000 },
    { minimumLevel: 110, minimum: 1_700, maximum: 2_350 },
    { minimumLevel: 90, minimum: 1_150, maximum: 1_700 },
    { minimumLevel: 70, minimum: 750, maximum: 1_150 },
    { minimumLevel: 50, minimum: 450, maximum: 750 }
  ];
  const band = bands.find((entry) => safeLevel >= entry.minimumLevel);
  if (!band) return { minimum: 0, maximum: 0 };
  const nextBand = bands[bands.indexOf(band) - 1];
  const maximumLevel = nextBand ? nextBand.minimumLevel - 1 : 150;
  const progress = maximumLevel === band.minimumLevel
    ? 1
    : (safeLevel - band.minimumLevel) / (maximumLevel - band.minimumLevel);
  const center = Math.round(band.minimum + (band.maximum - band.minimum) * progress);
  return {
    minimum: Math.max(1, Math.round(center * 0.9)),
    maximum: Math.max(1, Math.round(center * 1.1))
  };
}

function getDefaultCounterAttackType(monsterId) {
  const hash = Array.from(String(monsterId || '')).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  return hash % 2 === 0 ? 'projectile' : 'swing';
}

const MONSTER_CATALOG = Object.freeze(MONSTER_ROWS.map((
  [
    id,
    name,
    level,
    maxHp,
    expReward,
    lootName,
    icon,
    elementalMultipliers = {},
    undead = false,
    combatOptions = {}
  ]
) => {
  const lootItemId = `monster_loot_${id}`;
  const counterAttackDamage = getMonsterRetaliationDamageRange(level);
  const counterAttackType = Number(level) >= 50
    ? (combatOptions.counterAttackType || getDefaultCounterAttackType(id))
    : '';
  return Object.freeze({
    id,
    name,
    level,
    maxHp,
    expReward: scaleMonsterExp(expReward),
    icon,
    lootItemId,
    lootName,
    lootIcon: icon,
    undead,
    contactDamage: combatOptions.contactDamage,
    physicalDefense: combatOptions.physicalDefense,
    magicDefense: combatOptions.magicDefense,
    movementSpeed: combatOptions.movementSpeed,
    counterAttackType,
    counterAttackRangePx: counterAttackType === 'swing' ? 180 : 680,
    counterAttackWindupMs: counterAttackType === 'swing' ? 450 : 700,
    counterAttackCooldownMs: 3_500,
    counterAttackMinDamage: counterAttackDamage.minimum,
    counterAttackMaxDamage: counterAttackDamage.maximum,
    elementalMultipliers: Object.freeze({ ...elementalMultipliers }),
    dropTable: Object.freeze({
      misc: Object.freeze([
        Object.freeze({ itemId: lootItemId, name: lootName, icon, quantity: 1, chance: 0.7 }),
        ...getThrowingStarDropsForMonster(id),
        ...getQueenDollFragmentDropsForMonster(id, level)
      ]),
      equipment: Object.freeze(
        getEquipmentDropsForMonsterLevel(level).map((entry) => Object.freeze(entry))
      ),
      scrolls: Object.freeze(
        (MONSTER_SCROLL_DROPS[id] || []).map((entry) => Object.freeze(entry))
      ),
      masteryBooks: Object.freeze(getMasteryBookDropsForMonster(id, level)),
      potions: Object.freeze(getPotionDropsForMonsterLevel(level))
    })
  });
}));

function buildMonsterStats(level, overrides = {}) {
  const safeLevel = Math.max(1, Math.min(150, Math.floor(Number(level) || 1)));
  const matched = MONSTER_CATALOG.find((monster) => monster.level === safeLevel);
  const maxHp = Number(overrides.maxHp ?? matched?.maxHp)
    || Math.max(8, Math.round(8 * (1.078 ** (safeLevel - 1))));
  const expReward = Number(overrides.expReward ?? matched?.expReward)
    || scaleMonsterExp(maxHp * Math.max(0.04, 0.2 - safeLevel * 0.0011));
  return {
    maxHp,
    maxMp: Math.max(10, Math.round(18 + safeLevel * 7.5)),
    contactDamage: Number(overrides.contactDamage)
      || Math.max(4, Math.round(6 + safeLevel * 1.35)),
    physicalDefense: Number(overrides.physicalDefense)
      || Math.max(1, Math.round(safeLevel * 0.45)),
    magicDefense: Number(overrides.magicDefense)
      || Math.max(1, Math.round(safeLevel * 0.42)),
    movementSpeed: Number(overrides.movementSpeed) || 30 + safeLevel % 16,
    monsterAccuracy: 15 + safeLevel * 1.5,
    monsterEvasion: Math.max(1, Math.floor(1 + safeLevel * 0.18)),
    counterAttackType: String(overrides.counterAttackType || ''),
    counterAttackRangePx: Math.max(0, Number(overrides.counterAttackRangePx) || 0),
    counterAttackWindupMs: Math.max(0, Number(overrides.counterAttackWindupMs) || 0),
    counterAttackCooldownMs: Math.max(0, Number(overrides.counterAttackCooldownMs) || 0),
    counterAttackMinDamage: Math.max(0, Number(overrides.counterAttackMinDamage) || 0),
    counterAttackMaxDamage: Math.max(0, Number(overrides.counterAttackMaxDamage) || 0),
    expReward
  };
}

function getElementMultiplier(monster, element = 'neutral') {
  const normalized = ELEMENTS.includes(element) ? element : 'neutral';
  return Math.max(0, Number(monster?.elementalMultipliers?.[normalized]) || 1);
}

function getMonsterSpeciesForMap(map) {
  if (!map || map.safeZone) return [];
  if (Array.isArray(map.monsterIds) && map.monsterIds.length) {
    const selected = map.monsterIds
      .map((monsterId) => MONSTER_CATALOG.find((monster) => monster.id === monsterId))
      .filter(Boolean);
    if (selected.length) return selected;
  }
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
  const dropRateMultiplier = Math.max(0, Number(monster.dropRateMultiplier) || 1);
  const money = getMoneyDrop(monster.level, random);
  const drops = [{
    kind: 'money',
    amount: money,
    icon: getMoneyIcon(money),
    name: `${money.toLocaleString('ko-KR')}원`
  }];
  for (const category of ['misc', 'equipment', 'scrolls', 'masteryBooks', 'potions']) {
    for (const entry of monster.dropTable?.[category] || []) {
      if (random() >= Math.min(1, Number(entry.chance || 0) * dropRateMultiplier)) continue;
      drops.push({
        kind: 'item',
        itemId: entry.itemId,
        quantity: Math.max(1, Math.floor(Number(entry.quantity) || 1)),
        icon: entry.icon || '📦',
        name: entry.name || entry.itemId,
        category,
        instanceData: category === 'equipment'
          ? rollEquipmentInstanceData({ stats: entry.baseStats }, random)
          : null
      });
    }
  }
  return drops;
}

module.exports = {
  ELEMENTS,
  MONSTER_EXP_MULTIPLIER,
  MONSTER_CATALOG,
  buildMonsterStats,
  getElementMultiplier,
  getMonsterSpeciesForMap,
  getMoneyDrop,
  getMoneyIcon,
  getMasteryBookDropsForMonster,
  getPotionDropsForMonsterLevel,
  getThrowingStarDropsForMonster,
  getQueenDollFragmentDropsForMonster,
  getMonsterRetaliationDamageRange,
  rollMonsterDrops
};
