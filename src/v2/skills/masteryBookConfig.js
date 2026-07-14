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

function mastery(skillId, departments, stages = [20, 30]) {
  return Object.freeze({
    skillId,
    departments: Object.freeze([...departments]),
    stages: Object.freeze([...stages])
  });
}

const MASTERY_BOOK_SKILLS = Object.freeze([
  mastery('firm_will_hr', ['hr']),
  mastery('blocked_it', ['hr']),
  mastery('charge_hr', ['hr']),
  mastery('gombang', ['field_operations']),
  mastery('firmness', ['quality']),
  mastery('extended_2926a732db', ['accounting']),
  mastery('extended_cd94045605', ['accounting']),
  mastery('extended_e9c47b999a', ['accounting']),
  mastery('extended_2973270a08', ['marketing']),
  mastery('extended_fc89f3cfc2', ['marketing']),
  mastery('extended_eb778160dd', ['sales']),
  mastery('extended_0dcef657e3', ['development']),
  mastery('extended_efc52e591a', ['development']),
  mastery('extended_69705b66e7', ['research']),
  mastery('extended_5620bb5a09', ['research']),
  mastery('extended_4d105c3f1f', ['management_support']),
  mastery('extended_aef3d1db17', ['management_support']),

  mastery('extended_e76286335c', COMMON_ADVANCED_DEPARTMENTS, [20]),
  mastery('extended_ccb060a442', ['accounting']),
  mastery('extended_2dc9886c3e', ['marketing']),
  mastery('extended_69a82b671f', ['sales']),
  mastery('extended_47cf15f1d3', ['sales']),
  mastery('extended_403879a67d', ['facilities']),
  mastery('extended_8bf14061cf', ['facilities']),
  mastery('extended_83bf2e5362', ['facilities']),
  mastery('extended_b517ab1d69', ['development']),
  mastery('extended_bb8a82a4b8', ['development']),
  mastery('extended_2e29f80103', ['research']),
  mastery('extended_c074142eb3', ['research']),
  mastery('extended_4561b07dd3', ['research']),
  mastery('extended_72b5477b43', ['management_support']),
  mastery('extended_e3ac6849e3', ['management_support']),
  mastery('extended_7fbad835e4', ['management_support'])
]);

function getMasteryBookRule(skillId, departmentId) {
  return MASTERY_BOOK_SKILLS.find((entry) => (
    entry.skillId === String(skillId || '')
    && entry.departments.includes(String(departmentId || ''))
  )) || null;
}

function isMasteryBookSkill(skillId, departmentId) {
  return Boolean(getMasteryBookRule(skillId, departmentId));
}

module.exports = {
  COMMON_ADVANCED_DEPARTMENTS,
  MASTERY_BOOK_SKILLS,
  getMasteryBookRule,
  isMasteryBookSkill
};
