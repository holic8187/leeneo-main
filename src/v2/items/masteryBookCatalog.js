'use strict';

const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');
const {
  MASTERY_BOOK_SKILLS,
  isBossOnlyMasteryStage
} = require('../skills/masteryBookConfig');

const BASE_SUCCESS_RATES = Object.freeze({ 20: 90, 30: 70 });

function getMasteryBookItemId(skillId, stage) {
  return `mastery_book_${String(skillId || '')}_${Math.floor(Number(stage) || 0)}`;
}

const groupedRules = new Map();
for (const rule of MASTERY_BOOK_SKILLS) {
  const definition = SKILL_DEFINITIONS[rule.skillId];
  if (!definition) continue;
  for (const stage of rule.stages) {
    if (stage > definition.maxLevel) continue;
    const key = `${rule.originalSkillId}:${stage}`;
    if (!groupedRules.has(key)) groupedRules.set(key, []);
    groupedRules.get(key).push({ rule, definition, stage });
  }
}

const MASTERY_BOOK_ITEMS = Object.freeze([...groupedRules.values()].flatMap((members) => {
  const primary = members[0];
  const stage = primary.stage;
  const skillIds = [...new Set(members.map((member) => member.rule.skillId))];
  const departments = [...new Set(members.flatMap((member) => member.rule.departments))];
  const bookName = primary.rule.bookName || primary.definition.name;
  const bossOnly = isBossOnlyMasteryStage(primary.rule.originalSkillId, stage);
  return members.map((member, index) => Object.freeze({
    id: getMasteryBookItemId(member.rule.skillId, stage),
    name: `${bookName} 마스터리북 ${stage}`,
    category: 'consumable',
    itemType: 'mastery-book',
    icon: stage >= 30 ? '📕' : '📘',
    maxStack: 1,
    buyPrice: 0,
    sellPrice: 1,
    tradeable: true,
    adminGrantOnly: true,
    dropEligible: index === 0,
    bossOnly,
    masterySkillId: member.rule.skillId,
    masterySkillIds: [...skillIds],
    masteryOriginalSkillId: primary.rule.originalSkillId,
    masteryStage: stage,
    masteryDepartments: [...departments],
    baseSuccessRate: BASE_SUCCESS_RATES[stage],
    description: `${bookName} 계열 스킬의 투자 상한을 ${stage}레벨까지 해금합니다. 같은 원본 스킬을 사용하는 모든 부서에 공용입니다. 기본 성공 확률 ${BASE_SUCCESS_RATES[stage]}%, 실패할 때마다 다음 확률이 1%p 증가합니다.`
  }));
}));

function getMasteryBookByOriginalSkill(originalSkillId, stage) {
  return MASTERY_BOOK_ITEMS.find((item) => (
    item.dropEligible
    && item.masteryOriginalSkillId === String(originalSkillId || '')
    && item.masteryStage === Math.floor(Number(stage) || 0)
  )) || null;
}

function listNormalMonsterMasteryBooks() {
  return MASTERY_BOOK_ITEMS.filter((item) => item.dropEligible && !item.bossOnly);
}

module.exports = {
  BASE_SUCCESS_RATES,
  MASTERY_BOOK_ITEMS,
  getMasteryBookItemId,
  getMasteryBookByOriginalSkill,
  listNormalMonsterMasteryBooks
};
