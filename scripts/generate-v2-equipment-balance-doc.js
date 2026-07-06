'use strict';

const fs = require('fs');
const path = require('path');
const { listItemDefinitions } = require('../src/v2/items/itemCatalog');

const STAT_LABELS = Object.freeze({
  attack: '공격력',
  magic: '마력',
  defense: '방어력',
  magicDefense: '마법방어력',
  grit: '맷집',
  processingSpeed: '처리속도',
  workKnowledge: '업무지식',
  awareness: '눈치',
  maxHp: '최대 체력',
  maxMp: '최대 정신력',
  accuracy: '명중률',
  evasion: '회피율',
  movementSpeed: '이동속도'
});

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
  earrings: '귀걸이'
});

function csv(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function formatStats(stats = {}, withRange = false) {
  return Object.entries(stats)
    .map(([key, value]) => {
      const label = STAT_LABELS[key] || key;
      const minimum = Number(value) > 0 ? Math.max(1, Number(value) - 5) : Number(value) - 5;
      const suffix = withRange ? ` (${minimum}~${Number(value) + 5})` : '';
      return `${label} ${value}${suffix}`;
    })
    .join(' / ');
}

function formatRequirements(item) {
  const stats = item.requirements?.stats || {};
  return Object.entries(stats)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${STAT_LABELS[key] || key} ${value}`)
    .join(' / ');
}

const headers = [
  '아이템 ID',
  '이름',
  '직업군',
  '장착 부위',
  '무기 종류',
  '착용 레벨',
  '요구 스탯',
  '기본 옵션',
  '드랍 옵션 범위(-5~+5)',
  '공격속도 배율',
  '상점 판매가',
  '업그레이드 가능 횟수',
  '일반 몬스터 드랍률',
  '보스 전용'
];

const rows = listItemDefinitions()
  .filter((item) => item.category === 'equipment')
  .slice()
  .sort((left, right) => (
    Number(left.requiredLevel) - Number(right.requiredLevel)
    || String(left.requirements?.archetype).localeCompare(String(right.requirements?.archetype))
    || String(left.equipmentSlot).localeCompare(String(right.equipmentSlot))
    || String(left.name).localeCompare(String(right.name), 'ko')
  ))
  .map((item) => {
    const archetypes = item.requirements?.allowedArchetypes
      || [item.requirements?.archetype].filter(Boolean);
    return [
      item.id,
      item.name,
      archetypes.map((key) => ARCHETYPE_LABELS[key] || key).join('/'),
      SLOT_LABELS[item.equipmentSlot] || item.equipmentSlot,
      item.weaponType || '',
      item.requiredLevel || item.requirements?.level || 1,
      formatRequirements(item),
      formatStats(item.stats),
      formatStats(item.stats, true),
      item.attackSpeedMultiplier || '',
      item.sellPrice || 0,
      item.upgradeSlots || 0,
      Number(item.dropChance) > 0 ? `${(Number(item.dropChance) * 100).toFixed(4)}%` : '',
      item.bossDropOnly ? '예' : '아니오'
    ].map(csv).join(',');
  });

const outputPath = path.join(__dirname, '..', 'docs', 'V2_EQUIPMENT_BALANCE.csv');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `\uFEFF${headers.map(csv).join(',')}\n${rows.join('\n')}\n`, 'utf8');
console.log(`Generated ${rows.length} equipment rows: ${outputPath}`);
