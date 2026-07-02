'use strict';

const MONSTER_CATALOG = Object.freeze([
  ['paper_dust', '서류 먼지뭉치', 3, '구겨진 메모지', '🧾'],
  ['runaway_stapler', '도망친 스테이플러', 10, '휘어진 심', '📎'],
  ['coffee_slime', '커피 얼룩 슬라임', 17, '굳은 커피 찌꺼기', '☕'],
  ['meeting_mouse', '회의실 생쥐', 24, '갉아먹은 회의록', '📄'],
  ['overtime_bat', '야근 박쥐', 31, '검은 출입 기록', '🦇'],
  ['payroll_mimic', '급여대장 미믹', 38, '찢어진 급여명세서', '🧮'],
  ['audit_ghost', '감사실 유령', 45, '희미한 감사 도장', '👻'],
  ['sales_fox', '영업 여우', 52, '낡은 계약서', '🦊'],
  ['ad_chameleon', '광고 카멜레온', 59, '바랜 광고 전단', '🦎'],
  ['bug_beetle', '버그 딱정벌레', 66, '깨진 코드 조각', '🐞'],
  ['server_wisp', '서버실 도깨비불', 73, '그을린 케이블', '🔥'],
  ['prototype_golem', '시제품 골렘', 80, '불량 부품', '🗿'],
  ['conveyor_crab', '컨베이어 게', 87, '녹슨 톱니', '🦀'],
  ['quality_spider', '품질검사 거미', 94, '검사 탈락표', '🕷️'],
  ['warehouse_boar', '물류창고 멧돼지', 101, '부서진 운송장', '🐗'],
  ['facility_drone', '시설관리 드론', 108, '방전된 배터리', '🤖'],
  ['research_chimera', '연구동 키메라', 115, '정체불명 시료', '🧪'],
  ['executive_lion', '임원실 사자', 122, '금이 간 명패', '🦁'],
  ['overtime_reaper', '무한야근 사신', 131, '낡은 퇴근 카드', '💀'],
  ['deadline_dragon', '마감기한 드래곤', 140, '타버린 결재 문서', '🐉']
].map(([id, name, level, lootName, icon]) => {
  const lootItemId = `monster_loot_${id}`;
  return Object.freeze({
    id,
    name,
    level,
    icon,
    lootItemId,
    lootName,
    lootIcon: icon,
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

function buildMonsterStats(level) {
  const safeLevel = Math.max(1, Math.min(140, Math.floor(Number(level) || 1)));
  if (safeLevel <= 3) {
    return {
      maxHp: 30,
      contactDamage: 10,
      physicalDefense: 1,
      magicDefense: 1,
      movementSpeed: 35,
      expReward: 1
    };
  }
  return {
    maxHp: 30 + (safeLevel - 3) * 20,
    contactDamage: 10 + Math.floor((safeLevel - 3) / 10) * 3,
    physicalDefense: 1 + Math.floor((safeLevel - 3) / 8),
    magicDefense: 1 + Math.floor((safeLevel - 3) / 9),
    movementSpeed: 30 + safeLevel % 16,
    // The user will provide the final monster EXP table separately.
    expReward: 1
  };
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
  const categories = ['misc', 'equipment', 'scrolls', 'potions'];
  for (const category of categories) {
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
  MONSTER_CATALOG,
  buildMonsterStats,
  getMonsterSpeciesForMap,
  getMoneyDrop,
  getMoneyIcon,
  rollMonsterDrops
};
