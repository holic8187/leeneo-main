'use strict';

const fs = require('fs');
const path = require('path');
const { listItemDefinitions } = require('../src/v2/items/itemCatalog');
const { MONSTER_CATALOG } = require('../src/v2/world/monsterCatalog');

const ARCHETYPE_LABELS = Object.freeze({
  warrior: '전사',
  archer: '궁수',
  thief: '도적',
  mage: '마법사'
});

const SLOT_LABELS = Object.freeze({
  weapon: '무기',
  helmet: '투구',
  gloves: '장갑',
  shoes: '신발',
  cape: '망토',
  top: '상의',
  bottom: '하의',
  earrings: '귀걸이',
  necklace: '목걸이',
  ring: '반지',
  shield: '방패'
});

const WEAPON_TYPE_LABELS = Object.freeze({
  oneHandedSword: '한손검',
  twoHandedSword: '두손검',
  oneHandedAxe: '한손도끼',
  twoHandedAxe: '두손도끼',
  oneHandedBlunt: '한손둔기',
  twoHandedBlunt: '두손둔기',
  spear: '창',
  polearm: '폴암',
  bow: '활',
  crossbow: '석궁',
  claw: '아대',
  dagger: '단검',
  wand: '완드',
  staff: '스태프'
});

const itemById = new Map(
  listItemDefinitions().map((item) => [String(item.id), item])
);

function formatChance(chance) {
  return `${(Math.max(0, Number(chance) || 0) * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

function getJobLabel(item, drop) {
  const allowed = item?.requirements?.allowedArchetypes;
  if (Array.isArray(allowed) && allowed.length >= 4) return '공용';
  const archetypes = Array.isArray(allowed) && allowed.length
    ? allowed
    : [item?.requirements?.archetype || drop?.archetype].filter(Boolean);
  return archetypes.length
    ? archetypes.map((key) => ARCHETYPE_LABELS[key] || key).join('/')
    : '공용';
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const monsters = [...MONSTER_CATALOG].sort((left, right) => (
  Number(left.level) - Number(right.level)
  || String(left.name).localeCompare(String(right.name), 'ko')
));
const jobTotals = new Map();
let totalDropRows = 0;
const lines = [
  '# V2 몬스터별 장비 드랍표 (직업군 구분)',
  '',
  '> 이 문서는 실제 `MONSTER_CATALOG`의 장비 드랍 테이블을 읽어 자동 생성됩니다.',
  `> 생성 시각: ${new Date().toISOString()}`,
  ''
];

for (const monster of monsters) {
  const drops = [...(monster.dropTable?.equipment || [])].sort((left, right) => {
    const leftItem = itemById.get(String(left.itemId));
    const rightItem = itemById.get(String(right.itemId));
    return getJobLabel(leftItem, left).localeCompare(getJobLabel(rightItem, right), 'ko')
      || Number(leftItem?.requiredLevel || 0) - Number(rightItem?.requiredLevel || 0)
      || String(left.name).localeCompare(String(right.name), 'ko');
  });
  totalDropRows += drops.length;
  lines.push(`## Lv.${monster.level} ${monster.name}`);
  lines.push('');
  lines.push('| 직업군 | 장비명 | 장착 부위 | 무기 종류 | 착용 레벨 | 개별 드랍률 |');
  lines.push('|---|---|---|---|---:|---:|');
  for (const drop of drops) {
    const item = itemById.get(String(drop.itemId));
    const job = getJobLabel(item, drop);
    jobTotals.set(job, (jobTotals.get(job) || 0) + 1);
    lines.push([
      escapeCell(job),
      escapeCell(item?.name || drop.name || drop.itemId),
      escapeCell(SLOT_LABELS[item?.equipmentSlot || drop.equipmentSlot] || item?.equipmentSlot || drop.equipmentSlot || '-'),
      escapeCell(WEAPON_TYPE_LABELS[item?.weaponType] || item?.weaponType || '-'),
      Math.max(1, Number(item?.requiredLevel || item?.requirements?.level) || 1),
      formatChance(drop.chance)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  if (!drops.length) lines.push('| - | 장비 드랍 없음 | - | - | - | - |');
  lines.push('');
}

lines.splice(5, 0,
  '## 요약',
  '',
  `- 몬스터 수: ${monsters.length}종`,
  `- 전체 장비 드랍 항목: ${totalDropRows}개`,
  `- 몬스터 1종당 평균 장비 종류: ${(totalDropRows / Math.max(1, monsters.length)).toFixed(1)}개`,
  `- 직업군별 항목 수: ${[...jobTotals.entries()].map(([job, count]) => `${job} ${count}개`).join(', ')}`,
  ''
);

const outputPath = path.join(__dirname, '..', 'docs', 'v2', 'MONSTER_EQUIPMENT_DROPS_BY_JOB.md');
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(outputPath);

