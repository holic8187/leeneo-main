'use strict';

const { applyWeaponRequirements } = require('./weaponRequirements');

const DROP_RATE_MIN = 0.00002;
const DROP_RATE_MAX = 0.00008;
const EQUIPMENT_LEVELS = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);

const WEAPON_LINES = Object.freeze([
  ['warrior', 'oneHandedSword', '⚔️', ['목검', '바이킹 소드', '글라디우스', '커틀러스', '쥬얼 쿠아다라', '네오코라', '레드 카타나', '프라우테', '스파타', '골드 아룬드', '드래곤 카라벨라', '타임리스 세이버', '본부장 세이버', '마감의 검']],
  ['warrior', 'twoHandedSword', '🗡️', ['양손검', '클레이모어', '호검', '하이랜더', '쟈드', '그리스', '그륜힐', '라 투핸더', '참화도', '드래곤 클레이모어', '집행의 대검', '타임리스 니플하임', '본부장 대검', '결재 파쇄검']],
  ['warrior', 'oneHandedAxe', '🪓', ['손도끼', '버크', '콘트라 액스', '블루 카운터', '호크헤드', '버드빌', '리프 액스', '토마호크', '레드 너클액스', '드래곤 액스', '감사 대응 도끼', '타임리스 타바르', '실적 절단기', '임원용 손도끼']],
  ['warrior', 'twoHandedAxe', '🪓', ['쇠도끼', '미스릴 폴액스', '버크', '더블테일 너클', '라이징', '샤이닝', '헬리오스', '크로노', '드래곤 배틀액스', '타임리스 문라이트', '공정 파쇄도끼', '현장 총괄도끼', '생산본부 도끼', '마감 분쇄기']],
  ['warrior', 'oneHandedBlunt', '🔨', ['몽둥이', '사각 망치', '퓨전 메이스', '워 해머', '호스맨즈', '골든 해머', '스튬', '배틀 해머', '드래곤 메이스', '타임리스 엔릴티어', '현장 안전망치', '품질 보증망치', '본부장 망치', '최종 승인망치']],
  ['warrior', 'spear', '🔱', ['창', '포크 창', '제코', '나카마키', '십자창', '스페판', '스카이 스노우보드', '피나카', '드래곤 팔티잔', '타임리스 알슈피스', '공정 점검창', 'QA 장창', '생산 지휘창', '마감 관통창']],
  ['warrior', 'polearm', '⚜️', ['폴암', '철제 폴암', '미스릴 폴암', '크레센트', '구룡도', '방천극', '월아산', '헬리오스', '드래곤 헬버드', '타임리스 디에스이라에', '공정 절삭기', '현장 집행폴암', '생산 지휘폴암', '마감 대낫']],
  ['archer', 'bow', '🏹', ['워 보우', '사냥꾼의 활', '라이덴', '발터2000', '올림푸스', '봉황위궁', '힌켈', '아룬드', '메투스', '니스록', '드래곤 샤인보우', '타임리스 엔가우', '마케팅 장궁', '캠페인 피날레']],
  ['archer', 'crossbow', '🎯', ['석궁', '산양 석궁', '발란쉐', '헤클러', '로우어', '골든 크로우', '그로스야거', '아다만티움 석궁', '네쉐르', '드래곤 샤인크로스', '타임리스 블랙뷰티', '회계 결산석궁', '정산 집행석궁', '마감 명세서']],
  ['thief', 'claw', '✴️', ['가니어', '이고르', '메바', '가즈', '스틸 티탄즈', '브론즈 가디언', '보닌', '슬레인', '스칸다', '캐스터스', '드래곤 퍼플 슬레브', '타임리스 람피온', '영업 비밀아대', '계약 종결아대']],
  ['thief', 'dagger', '🗡️', ['후르츠 대거', '삼각 자마다르', '게파트', '반월 자마다르', '신기타', '게타', '칸디네', '용천권', '블러드 대거', '드래곤 크리스', '타임리스 패스워드', '시설 비상단검', '보안 절단검', '최종 점검단검']],
  ['mage', 'wand', '🪄', ['우드 완드', '미스릴 완드', '위저드 완드', '페어리 완드', '크리스탈 완드', '이블테일러', '레이든 완드', '엔젤윙즈', '다이몬 완드', '드래곤 완드', '타임리스 에아스 핸드', '개발자 완드', '연구총괄 완드', '최종 배포완드']],
  ['mage', 'staff', '🔮', ['우드 스태프', '사파이어 스태프', '에메랄드 스태프', '페탈 스태프', '쏜즈', '이블윙즈', '레이든 스태프', '케이그', '블루 마린', '드래곤 스태프', '타임리스 에아스 핸드', '연구소 스태프', '기술이사 스태프', '최종 빌드스태프']]
]);

const ARMOR_SLOTS = Object.freeze([
  ['helmet', '투구', '🪖', 1],
  ['gloves', '장갑', '🧤', 0.58],
  ['shoes', '신발', '🥾', 0.52],
  ['cape', '망토', '🧥', 0.48],
  ['top', '상의', '👔', 1.18],
  ['bottom', '하의', '👖', 0.92],
  ['necklace', '목걸이', '📿', 0.25],
  ['earrings', '귀걸이', '💎', 0.22]
]);

const ARCHETYPE_PREFIX = Object.freeze({
  warrior: '현장',
  archer: '정산',
  thief: '영업',
  mage: '연구'
});

function deterministicRate(id) {
  let hash = 0;
  for (const character of String(id)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return Math.min(DROP_RATE_MAX, DROP_RATE_MIN + (hash % 7) * 0.00001);
}

function weaponStats(archetype, level, weaponType) {
  const attack = Math.min(94, Math.max(6, Math.round(6 + level * 0.72)));
  if (archetype === 'mage') {
    return {
      attack: Math.max(3, Math.round(2 + level * 0.18)),
      magic: Math.min(112, Math.round(7 + level * 0.82)),
      workKnowledge: Math.max(0, Math.floor(level / 30))
    };
  }
  const speedBonus = ['twoHandedAxe', 'spear', 'polearm', 'crossbow'].includes(weaponType) ? 3 : 0;
  const mainStat = archetype === 'archer'
    ? 'processingSpeed'
    : archetype === 'thief' ? 'awareness' : 'grit';
  return {
    attack: attack + speedBonus,
    [mainStat]: Math.max(0, Math.floor(level / 30))
  };
}

function weaponSpeed(weaponType) {
  if (['twoHandedAxe', 'spear', 'polearm'].includes(weaponType)) return 0.82;
  if (weaponType === 'crossbow' || weaponType === 'staff') return 0.9;
  if (['bow', 'twoHandedSword'].includes(weaponType)) return 1;
  if (['claw', 'wand'].includes(weaponType)) return 1.12;
  return 1.06;
}

function createWeapon(line, level, index) {
  const [archetype, weaponType, icon, names] = line;
  const id = `drop_${weaponType}_${level}`;
  const item = applyWeaponRequirements({
    id,
    name: names[index],
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: level,
    stats: weaponStats(archetype, level, weaponType),
    attackSpeedMultiplier: weaponSpeed(weaponType),
    maxStack: 1,
    sellPrice: Math.max(40, Math.round(level * level * 1.8)),
    sourceReference: 'dreaminfo-maple-drop-list',
    description: `${level}레벨 ${archetype} 계열 무기입니다. 직업과 요구 능력치를 충족해야 장착할 수 있습니다.`
  });
  item.dropChance = deterministicRate(id);
  return item;
}

function createArmor(archetype, slotRow, level) {
  const [slot, label, icon, defenseRatio] = slotRow;
  const id = `drop_${archetype}_${slot}_${level}`;
  const mainStat = archetype === 'warrior'
    ? 'grit'
    : archetype === 'archer'
      ? 'processingSpeed'
      : archetype === 'mage' ? 'workKnowledge' : 'awareness';
  const isAccessory = ['necklace', 'earrings'].includes(slot);
  const stats = {
    defense: Math.max(1, Math.round((3 + level * 0.72) * defenseRatio)),
    [mainStat]: Math.max(1, Math.floor(level / (isAccessory ? 24 : 18)))
  };
  if (archetype === 'mage') stats.magicDefense = Math.max(1, Math.round(level * defenseRatio * 0.5));
  return {
    id,
    name: `${ARCHETYPE_PREFIX[archetype]} ${level}제 ${label}`,
    category: 'equipment',
    itemType: isAccessory ? 'accessory' : 'armor',
    equipmentSlot: slot,
    icon,
    requiredLevel: level,
    requirements: {
      level,
      stats: {},
      archetype,
      allowedArchetypes: [archetype]
    },
    stats,
    maxStack: 1,
    sellPrice: Math.max(25, Math.round(level * level * defenseRatio)),
    dropChance: deterministicRate(id),
    description: `${level}레벨 ${archetype} 계열 ${label}입니다. 해당 직업만 장착할 수 있습니다.`
  };
}

function createBossWeapon({
  id,
  name,
  archetype,
  weaponType,
  icon,
  attack,
  magic = 0,
  extraStats = {}
}) {
  const item = applyWeaponRequirements({
    id,
    name,
    category: 'equipment',
    itemType: 'weapon',
    equipmentSlot: 'weapon',
    icon,
    weaponType,
    requiredLevel: 100,
    stats: { attack, ...(magic ? { magic } : {}), ...extraStats },
    attackSpeedMultiplier: weaponSpeed(weaponType),
    maxStack: 1,
    sellPrice: 1,
    bossDropOnly: true,
    endgameTier: true,
    description: '보스에게서만 획득할 수 있는 100레벨 종결급 드래곤 장비입니다.'
  });
  item.requirements.allowedArchetypes = [archetype];
  item.requirements.archetype = archetype;
  return item;
}

const BOSS_ENDGAME_WEAPONS = Object.freeze([
  createBossWeapon({ id: 'boss_dragon_carabella', name: '드래곤 카라벨라', archetype: 'warrior', weaponType: 'oneHandedSword', icon: '⚔️', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_claymore', name: '드래곤 클레이모어', archetype: 'warrior', weaponType: 'twoHandedSword', icon: '🗡️', attack: 105 }),
  createBossWeapon({ id: 'boss_dragon_axe', name: '드래곤 엑스', archetype: 'warrior', weaponType: 'oneHandedAxe', icon: '🪓', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_battleaxe', name: '드래곤 배틀엑스', archetype: 'warrior', weaponType: 'twoHandedAxe', icon: '🪓', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_mace', name: '드래곤 메이스', archetype: 'warrior', weaponType: 'oneHandedBlunt', icon: '🔨', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_flame', name: '드래곤 플레임', archetype: 'warrior', weaponType: 'twoHandedBlunt', icon: '🔨', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_halberd', name: '드래곤 헬버드', archetype: 'warrior', weaponType: 'polearm', icon: '⚜️', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_partisan', name: '드래곤 팔티잔', archetype: 'warrior', weaponType: 'spear', icon: '🔱', attack: 107 }),
  createBossWeapon({ id: 'boss_dragon_wand', name: '드래곤 완드', archetype: 'mage', weaponType: 'wand', icon: '🪄', attack: 75, magic: 123 }),
  createBossWeapon({ id: 'boss_dragon_staff', name: '드래곤 스태프', archetype: 'mage', weaponType: 'staff', icon: '🔮', attack: 80, magic: 125 }),
  createBossWeapon({ id: 'boss_dragon_shinebow', name: '드래곤 샤인보우', archetype: 'archer', weaponType: 'bow', icon: '🏹', attack: 100 }),
  createBossWeapon({ id: 'boss_dragon_shinecross', name: '드래곤 샤인크로스', archetype: 'archer', weaponType: 'crossbow', icon: '🎯', attack: 103 }),
  createBossWeapon({ id: 'boss_dragon_kris', name: '드래곤 크리스', archetype: 'thief', weaponType: 'dagger', icon: '🗡️', attack: 98 }),
  createBossWeapon({ id: 'boss_dragon_khanjar', name: '드래곤 칸자르', archetype: 'thief', weaponType: 'dagger', icon: '🗡️', attack: 100 }),
  createBossWeapon({
    id: 'boss_dragon_green_sleeve',
    name: '드래곤 그린 슬레브',
    archetype: 'thief',
    weaponType: 'claw',
    icon: '✴️',
    attack: 50,
    extraStats: { processingSpeed: 7, awareness: 7, maxHp: 50, evasion: 7 }
  })
].map((item) => Object.freeze(item)));

const EQUIPMENT_ITEMS = Object.freeze([
  ...WEAPON_LINES.flatMap((line) => EQUIPMENT_LEVELS.map((level, index) => createWeapon(line, level, index))),
  ...Object.keys(ARCHETYPE_PREFIX).flatMap((archetype) => (
    EQUIPMENT_LEVELS.filter((level) => level % 20 === 0).flatMap((level) => (
      ARMOR_SLOTS.map((slot) => createArmor(archetype, slot, level))
    ))
  )),
  ...BOSS_ENDGAME_WEAPONS
].map((item) => Object.freeze(item)));

function getEquipmentDropsForMonsterLevel(monsterLevel) {
  const level = Math.max(1, Math.floor(Number(monsterLevel) || 1));
  return EQUIPMENT_ITEMS
    .filter((item) => {
      if (item.bossDropOnly) return false;
      const requiredLevel = Number(item.requiredLevel || item.requirements?.level) || 1;
      return requiredLevel <= level + 2 && requiredLevel >= Math.max(1, level - 14);
    })
    .sort((left, right) => (
      Math.abs(Number(left.requiredLevel) - level) - Math.abs(Number(right.requiredLevel) - level)
      || String(left.id).localeCompare(String(right.id))
    ))
    .slice(0, 8)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      quantity: 1,
      chance: item.dropChance
    }));
}

module.exports = {
  DROP_RATE_MIN,
  DROP_RATE_MAX,
  EQUIPMENT_LEVELS,
  EQUIPMENT_ITEMS,
  BOSS_ENDGAME_WEAPONS,
  getEquipmentDropsForMonsterLevel
};
