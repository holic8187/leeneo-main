'use strict';

const ADVANCEMENT_LEVELS = Object.freeze([10, 30, 70, 120]);

const DEPARTMENTS = Object.freeze({
  hr: {
    name: '인사팀',
    jobs: ['인사담당자', '인재매니저', '조직관리자', '최고인사책임자'],
    primaryStat: 'grit',
    secondaryStat: 'processingSpeed',
    archetype: 'warrior'
  },
  accounting: {
    name: '회계팀',
    jobs: ['회계사원', '재무분석가', '회계감사관', '재무총괄'],
    primaryStat: 'processingSpeed',
    secondaryStat: 'grit',
    archetype: 'archer'
  },
  management_support: {
    name: '경영지원팀',
    jobs: ['지원담당자', '운영기획자', '경영전략가', '전략총괄'],
    primaryStat: 'workKnowledge',
    secondaryStat: 'awareness',
    archetype: 'mage'
  },
  sales: {
    name: '영업직',
    jobs: ['영업사원', '영업매니저', '사업개발자(BD)', '영업본부장'],
    primaryStat: 'awareness',
    secondaryStat: 'processingSpeed',
    archetype: 'thief'
  },
  marketing: {
    name: '마케팅',
    jobs: ['마케터', '브랜드매니저', '마케팅전략가', '최고마케팅책임자'],
    primaryStat: 'processingSpeed',
    secondaryStat: 'grit',
    archetype: 'archer'
  },
  development: {
    name: '개발직',
    jobs: ['주니어개발자', '개발자', '시니어개발자', '최고기술책임자'],
    primaryStat: 'workKnowledge',
    secondaryStat: 'awareness',
    archetype: 'mage'
  },
  field_operations: {
    name: '현장직',
    jobs: ['현장사원', '작업반장', '현장소장', '생산본부장'],
    primaryStat: 'grit',
    secondaryStat: 'processingSpeed',
    archetype: 'warrior'
  },
  facilities: {
    name: '시설관리팀',
    jobs: ['시설관리원', '설비기사', '유지보수전문가', '시설관리책임자'],
    primaryStat: 'awareness',
    secondaryStat: 'processingSpeed',
    archetype: 'thief'
  },
  quality: {
    name: '품질관리',
    jobs: ['품질검사원', '품질엔지니어', '품질관리자', 'QA매니저'],
    primaryStat: 'grit',
    secondaryStat: 'processingSpeed',
    archetype: 'warrior'
  },
  research: {
    name: '연구직',
    jobs: ['주임연구원', '선임연구원', '책임연구원', '연구소장'],
    primaryStat: 'workKnowledge',
    secondaryStat: 'awareness',
    archetype: 'mage'
  }
});

function normalizeAdvancementTier(value) {
  return Math.max(0, Math.min(4, Math.floor(Number(value) || 0)));
}

function getAdvancementBonusSkillPoints(advancementTier) {
  return normalizeAdvancementTier(advancementTier);
}

function getJobName(departmentId, advancementTier) {
  const tier = normalizeAdvancementTier(advancementTier);
  if (!tier || !DEPARTMENTS[departmentId]) return '미전직';
  return DEPARTMENTS[departmentId].jobs[tier - 1];
}

function getNextAdvancementRequirement({ level, advancementTier }) {
  const tier = normalizeAdvancementTier(advancementTier);
  if (tier >= ADVANCEMENT_LEVELS.length) return null;
  const requiredLevel = ADVANCEMENT_LEVELS[tier];
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return {
    currentTier: tier,
    targetTier: tier + 1,
    requiredLevel,
    eligible: safeLevel >= requiredLevel,
    departmentSelectionRequired: tier === 0
  };
}

function getAvailableAdvancementQuest(character = {}) {
  const progression = character.progression || {};
  const job = character.job || {};
  const requirement = getNextAdvancementRequirement({
    level: progression.level,
    advancementTier: job.advancementTier
  });
  if (!requirement?.eligible) return null;

  const department = DEPARTMENTS[job.departmentId];
  return {
    id: `advancement-tier-${requirement.targetTier}`,
    ...requirement,
    departmentId: job.departmentId || 'unassigned',
    departmentName: department?.name || '부서 미정',
    nextJobName: requirement.departmentSelectionRequired
      ? '부서 선택'
      : department?.jobs[requirement.targetTier - 1] || `${requirement.targetTier}차 전직`,
    bonusSkillPoints: 1
  };
}

module.exports = {
  ADVANCEMENT_LEVELS,
  DEPARTMENTS,
  normalizeAdvancementTier,
  getAdvancementBonusSkillPoints,
  getJobName,
  getNextAdvancementRequirement,
  getAvailableAdvancementQuest
};
