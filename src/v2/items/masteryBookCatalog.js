'use strict';

const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');
const { MASTERY_BOOK_SKILLS } = require('../skills/masteryBookConfig');

const BASE_SUCCESS_RATES = Object.freeze({ 20: 90, 30: 70 });

function getMasteryBookItemId(skillId, stage) {
  return `mastery_book_${String(skillId || '')}_${Math.floor(Number(stage) || 0)}`;
}

const MASTERY_BOOK_ITEMS = Object.freeze(MASTERY_BOOK_SKILLS.flatMap((rule) => {
  const definition = SKILL_DEFINITIONS[rule.skillId];
  if (!definition) return [];
  return rule.stages
    .filter((stage) => stage <= definition.maxLevel)
    .map((stage) => Object.freeze({
      id: getMasteryBookItemId(rule.skillId, stage),
      name: `${definition.name} 마스터리북 ${stage}`,
      category: 'consumable',
      itemType: 'mastery-book',
      icon: stage >= 30 ? '📕' : '📘',
      maxStack: 1,
      buyPrice: 0,
      sellPrice: 1,
      tradeable: true,
      adminGrantOnly: true,
      masterySkillId: rule.skillId,
      masteryStage: stage,
      masteryDepartments: [...rule.departments],
      baseSuccessRate: BASE_SUCCESS_RATES[stage],
      description: `${definition.name}의 투자 상한을 ${stage}레벨까지 해금합니다. 기본 성공 확률 ${BASE_SUCCESS_RATES[stage]}%, 실패할 때마다 다음 확률이 1%p 증가합니다.`
    }));
}));

module.exports = {
  BASE_SUCCESS_RATES,
  MASTERY_BOOK_ITEMS,
  getMasteryBookItemId
};
