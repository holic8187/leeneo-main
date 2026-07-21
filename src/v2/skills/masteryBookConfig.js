'use strict';

const COMMON_ADVANCED_DEPARTMENTS = Object.freeze([
  'accounting',
  'marketing',
  'sales',
  'facilities',
  'development',
  'research',
  'management_support'
]);

function mastery(skillId, departments, stages = [20, 30], options = {}) {
  return Object.freeze({
    skillId,
    departments: Object.freeze([...departments]),
    stages: Object.freeze([...stages]),
    originalSkillId: String(options.originalSkillId || skillId),
    bookName: String(options.bookName || '')
  });
}

const MASTERY_BOOK_SKILLS = Object.freeze([
  mastery('firm_will_hr', ['hr', 'field_operations'], [20, 30], { originalSkillId: 'stance', bookName: '굳건한 의지 계열 공용' }),
  mastery('firm_will_quality', ['quality'], [20, 30], { originalSkillId: 'stance', bookName: '굳건한 의지 계열 공용' }),
  mastery('blocked_it', ['hr', 'field_operations']),
  mastery('charge_hr', ['hr', 'field_operations'], [20, 30], { originalSkillId: 'rush', bookName: '돌진 계열 공용' }),
  mastery('charge_quality', ['quality'], [20, 30], { originalSkillId: 'rush', bookName: '돌진 계열 공용' }),
  mastery('upgraded_combo', ['hr'], [20, 30], { originalSkillId: 'advanced_combo', bookName: '업글 콤보' }),
  mastery('double_attack', ['hr'], [20, 30], { originalSkillId: 'brandish', bookName: '더블어택' }),
  mastery('wall_break', ['field_operations'], [20, 30], { originalSkillId: 'blast', bookName: '벽부수기' }),
  mastery('gombang', ['field_operations']),
  mastery('firmness', ['quality'], [20, 30], { originalSkillId: 'berserk', bookName: '단호함' }),

  mastery('extended_2926a732db', ['accounting'], [20, 30], { originalSkillId: 'dragon_pulse', bookName: '파동 계열 공용' }),
  mastery('extended_2973270a08', ['marketing'], [20, 30], { originalSkillId: 'dragon_pulse', bookName: '파동 계열 공용' }),
  mastery('extended_cd94045605', ['accounting'], [20, 30], { originalSkillId: 'piercing', bookName: '누적 관통결산' }),
  mastery('extended_e9c47b999a', ['accounting']),
  mastery('extended_fc89f3cfc2', ['marketing']),
  mastery('extended_eb778160dd', ['sales'], [20, 30], { originalSkillId: 'triple_throw', bookName: '삼중 제안' }),

  mastery('extended_0dcef657e3', ['development'], [20, 30], { originalSkillId: 'infinity', bookName: '무한 자원 계열 공용' }),
  mastery('extended_69705b66e7', ['research'], [20, 30], { originalSkillId: 'infinity', bookName: '무한 자원 계열 공용' }),
  mastery('extended_4d105c3f1f', ['management_support'], [20, 30], { originalSkillId: 'infinity', bookName: '무한 자원 계열 공용' }),
  mastery('extended_efc52e591a', ['development'], [20, 30], { originalSkillId: 'meteor', bookName: '프로덕션 대폭발' }),
  mastery('extended_5620bb5a09', ['research'], [20, 30], { originalSkillId: 'blizzard', bookName: '기후 제어 실험' }),
  mastery('extended_aef3d1db17', ['management_support'], [20, 30], { originalSkillId: 'genesis', bookName: '전사 비상지원' }),

  mastery('extended_e76286335c', COMMON_ADVANCED_DEPARTMENTS, [20], { originalSkillId: 'maple_warrior', bookName: '전 직원 역량강화' }),
  mastery('extended_ccb060a442', ['accounting'], [20, 30], { originalSkillId: 'sharp_eyes', bookName: '통찰 계열 공용' }),
  mastery('extended_2dc9886c3e', ['marketing'], [20, 30], { originalSkillId: 'sharp_eyes', bookName: '통찰 계열 공용' }),
  mastery('extended_69a82b671f', ['sales'], [20, 30], { originalSkillId: 'fake', bookName: '회피 위장 계열 공용' }),
  mastery('extended_403879a67d', ['facilities'], [20, 30], { originalSkillId: 'fake', bookName: '회피 위장 계열 공용' }),
  mastery('extended_47cf15f1d3', ['sales'], [20, 30], { originalSkillId: 'showdown', bookName: '표식 계열 공용' }),
  mastery('extended_8bf14061cf', ['facilities'], [20, 30], { originalSkillId: 'showdown', bookName: '표식 계열 공용' }),
  mastery('extended_83bf2e5362', ['facilities'], [20, 30], { originalSkillId: 'boomerang_step', bookName: '왕복 점검' }),
  mastery('extended_b517ab1d69', ['development'], [20, 30], { originalSkillId: 'big_bang', bookName: '대폭발 계열 공용' }),
  mastery('extended_2e29f80103', ['research'], [20, 30], { originalSkillId: 'big_bang', bookName: '대폭발 계열 공용' }),
  mastery('extended_72b5477b43', ['management_support'], [20, 30], { originalSkillId: 'big_bang', bookName: '대폭발 계열 공용' }),
  mastery('extended_bb8a82a4b8', ['development'], [20, 30], { originalSkillId: 'mana_reflection', bookName: '피해 반송 계열 공용' }),
  mastery('extended_c074142eb3', ['research'], [20, 30], { originalSkillId: 'mana_reflection', bookName: '피해 반송 계열 공용' }),
  mastery('extended_e3ac6849e3', ['management_support'], [20, 30], { originalSkillId: 'mana_reflection', bookName: '피해 반송 계열 공용' }),
  mastery('extended_4561b07dd3', ['research'], [20, 30], { originalSkillId: 'chain_lightning', bookName: '연쇄 방전' }),
  mastery('extended_7fbad835e4', ['management_support'])
]);

const BOSS_ONLY_MASTERY_STAGES = Object.freeze({
  stance: Object.freeze([20]),
  piercing: Object.freeze([30]),
  sharp_eyes: Object.freeze([20]),
  berserk: Object.freeze([30]),
  triple_throw: Object.freeze([20, 30]),
  boomerang_step: Object.freeze([30]),
  maple_warrior: Object.freeze([20]),
  genesis: Object.freeze([30]),
  advanced_combo: Object.freeze([30]),
  big_bang: Object.freeze([30]),
  blizzard: Object.freeze([30]),
  rush: Object.freeze([30]),
  chain_lightning: Object.freeze([30]),
  dragon_pulse: Object.freeze([30]),
  blast: Object.freeze([30]),
  brandish: Object.freeze([30]),
  meteor: Object.freeze([30])
});

function getMasteryBookRule(skillId, departmentId) {
  return MASTERY_BOOK_SKILLS.find((entry) => (
    entry.skillId === String(skillId || '')
    && entry.departments.includes(String(departmentId || ''))
  )) || null;
}

function isBossOnlyMasteryStage(originalSkillId, stage) {
  return (BOSS_ONLY_MASTERY_STAGES[String(originalSkillId || '')] || [])
    .includes(Math.floor(Number(stage) || 0));
}

function isMasteryBookSkill(skillId, departmentId) {
  return Boolean(getMasteryBookRule(skillId, departmentId));
}

module.exports = {
  COMMON_ADVANCED_DEPARTMENTS,
  MASTERY_BOOK_SKILLS,
  BOSS_ONLY_MASTERY_STAGES,
  getMasteryBookRule,
  isBossOnlyMasteryStage,
  isMasteryBookSkill
};
