'use strict';

const {
  TIER_SP_REQUIREMENTS,
  SKILL_DEFINITIONS
} = require('./skillDefinitions');
const { getMasteryBookRule } = require('./masteryBookConfig');
const { describeSummon, isCompanionSummon } = require('./summonService');

const MAX_ACTIVE_PRESET_SIZE = 10;
const SKILL_UNLOCK_MIGRATION_VERSION = 1;
const NON_PRESET_EFFECTS = new Set(['flash-jump']);
const ACTIVE_BUFF_EFFECT_KEYS = Object.freeze([
  'attackIncrease', 'defenseIncrease', 'magicDefenseIncrease',
  'accuracyIncrease', 'evasionIncrease', 'weaponMastery',
  'shieldDefensePercent', 'attackSpeedStage', 'damageReductionPercent',
  'mpDamageGuardPercent', 'blockChance', 'stanceChance',
  'contactReflectPercent', 'contactReflectCapPercent',
  'doubleStrikeChance', 'doubleStrikeDamagePercent',
  'comboEnabled', 'comboMaximum', 'comboDamagePerCount',
  'comboDoubleChargeChance', 'lowHpThresholdPercent',
  'lowHpDamageIncreasePercent', 'maxResourcePercent',
  'damageIncreasePercent', 'elementDamageIncreasePercent',
  'experienceBonusPercent', 'allStatsPercent',
  'moneyDropIncreasePercent', 'noAmmoConsumption',
  'movementSpeedIncrease', 'criticalChance', 'criticalDamagePercent',
  'attackRangeIncrease', 'dodgeChance', 'consumableEffectPercent',
  'magicMpCostIncreasePercent', 'stealth'
]);

const VALUE_LABELS = Object.freeze({
  healPercent: '회복량',
  levelUpHp: '레벨업 HP 추가',
  statPointHp: '스탯 투자 HP 추가',
  heal: '회복량',
  mpRestore: '정신력 회복',
  mpCost: '정신력 소모',
  hpCost: '체력 소모',
  damagePercent: '데미지',
  fixedDamage: '고정 피해',
  defenseIncrease: '방어력',
  attackIncrease: '공격력',
  mastery: '숙련도',
  masteryIncrease: '숙련도',
  accuracyIncrease: '명중률',
  evasionIncrease: '회피율',
  chance: '발동 확률',
  successChance: '성공 확률',
  stunChance: '기절 확률',
  reductionPercent: '피해 감소',
  blockChance: '무효화 확률',
  attackSpeedStage: '공격속도 단계',
  durationSeconds: '지속시간',
  intervalSeconds: '발동 간격',
  hits: '타격 횟수',
  targetCount: '대상 수',
  range: '사거리',
  distance: '이동 거리',
  maxResourcePercent: '최대 체력·정신력',
  damageIncreasePercent: '최종 데미지 증가',
  enemyDamageReductionPercent: '적 데미지 감소',
  elementDamageIncreasePercent: '속성 추가 데미지',
  preserveElementChance: '속성 유지 확률',
  freezeSeconds: '빙결 시간',
  cooldownSeconds: '재사용 대기시간'
  ,
  channelDurationSeconds: '연사 지속시간',
  channelIntervalSeconds: '발사 간격',
  attackPower: '소환수 공격력',
  experienceBonusPercent: '경험치 증가',
  mpAbsorbChance: '정신력 흡수 확률',
  mpAbsorbPercent: '정신력 흡수량',
  magicDefenseIncrease: '마법 방어력',
  summonHp: '소환수 체력'
});

const PERCENT_KEYS = new Set([
  'healPercent', 'damagePercent', 'mastery', 'masteryIncrease', 'chance',
  'successChance', 'stunChance', 'reductionPercent', 'blockChance',
  'reflectPercent', 'maxResourcePercent', 'maxHpCostPercent',
  'selfDamagePercent', 'hpThresholdPercent', 'damageIncreasePercent',
  'damagePerComboPercent', 'doubleChargeChance', 'stanceChance',
  'enemyDamageReductionPercent',
  'elementDamageIncreasePercent', 'preserveElementChance',
  'experienceBonusPercent', 'mpAbsorbChance', 'mpAbsorbPercent',
  'mpDamageGuardPercent'
]);

const SKILL_ROLE_DESCRIPTIONS = Object.freeze({
  recovery_improvement: '일정 주기마다 최대 체력의 일부를 회복하는 패시브입니다.',
  hp_growth_improvement: '레벨업과 스탯 투자로 증가하는 최대 체력을 추가로 높이는 성장 패시브입니다.',
  endure: '움직이거나 공격하지 않을 때 일정 주기마다 체력을 회복합니다.',
  iron_body: '정신력을 소모해 일정 시간 자신의 방어력을 높입니다.',
  power_strike: '전방의 단일 적에게 강한 물리 공격을 가합니다.',
  scratch: '전방 범위 안의 여러 적을 한 번에 공격합니다.',
  sword_mastery: '한손검과 두손검의 숙련도와 명중률을 높이는 패시브입니다.',
  axe_mastery: '도끼와 둔기 계열 무기의 숙련도와 명중률을 높이는 패시브입니다.',
  double_strike_hr: '공격 후 일정 확률로 추가 공격을 연속 발동하는 패시브입니다.',
  booster_hr: '체력과 정신력을 소모해 일정 시간 무기 공격속도를 높입니다.',
  rage: '일정 시간 파티 전원의 공격력을 높이는 대신 방어력을 낮춥니다.',
  shoulder_charge: '몬스터와 충돌해 받은 피해의 일부를 되돌려주는 효과를 부여합니다.',
  strong_mind: '일정 주기마다 정신력을 자동으로 회복하는 패시브입니다.',
  shield_mastery: '장착한 방패가 제공하는 방어력을 높이는 패시브입니다.',
  combo_attack: '공격할 때 콤보를 쌓고 콤보 수에 비례해 피해를 높이는 버프입니다.',
  panic: '보유한 콤보를 모두 소비해 단일 적에게 강력한 공격을 가합니다.',
  coma: '콤보 하나를 소비해 주변 적들을 공격하고 일정 확률로 기절시킵니다.',
  smash_buff: '단일 적의 방어력 증가 효과를 일정 확률로 제거합니다.',
  shout: '주변의 여러 적을 공격하고 일정 확률로 기절시킵니다.',
  come_here_hr: '전방의 적들을 자신의 앞으로 끌어당깁니다.',
  firm_will_hr: '일정 시간 피격 시 뒤로 밀려나는 현상을 확률적으로 막습니다.',
  upgraded_combo: '최대 콤보 수를 늘리고 콤보가 두 개 쌓일 확률을 부여합니다.',
  sturdy_body_hr: '적에게 받는 모든 피해를 상시 감소시키는 패시브입니다.',
  blocked_it: '방패 착용 중 일정 확률로 피해를 막고 잠시 무적이 됩니다.',
  charge_hr: '전방으로 돌진하며 경로상의 적들을 밀고 피해를 줍니다.',
  double_attack: '전방의 적 최대 3명을 빠르게 두 번 공격합니다.',
  true_rage: '콤보 10개를 소비해 일정 시간 자신의 공격력을 크게 높입니다.',
  mace_mastery: '둔기 계열 무기의 숙련도와 명중률을 높이는 패시브입니다.',
  double_strike_field: '공격 시 일정 확률로 추가 공격을 연속 발동하는 패시브입니다.',
  booster_field: '체력과 정신력을 소비해 일정 시간 무기 공격속도를 높입니다.',
  war_cry: '주변 적의 공격을 약화시키고 자신의 데미지를 높이는 대신 명중률이 감소합니다.',
  element_explosion: '무기에 부여된 속성을 폭발시켜 여러 적을 공격하고 기절시킵니다.',
  element_fire: '무기에 불 속성을 부여하고 자신의 데미지를 높입니다. 얼음 속성과는 공존할 수 없습니다.',
  element_ice: '무기에 얼음 속성을 부여하고 비반감 적을 빙결시킵니다. 불 속성과는 공존할 수 없습니다.',
  element_lightning: '다른 속성과 중첩 가능한 번개 속성을 무기에 부여합니다.',
  element_enhancement: '속성 공격으로 입히는 추가 데미지를 높이는 패시브입니다.',
  element_holy: '무기에 강력한 성 속성을 부여하는 퀘스트 스킬입니다.',
  wall_break: '근거리의 적 하나에게 강력한 단일 공격을 가합니다.',
  element_enhancement_2: '속성 폭발을 강화하고 폭발 후 속성을 보존할 확률을 부여합니다.',
  gombang: '주변의 다수 적에게 치명적인 광역 피해를 주되 체력을 1 아래로 낮추지 않습니다.',
  spear_mastery: '창의 숙련도와 명중률을 높이는 패시브입니다.',
  polearm_mastery: '폴암의 숙련도와 명중률을 높이는 패시브입니다.',
  double_strike_quality: '공격 후 일정 확률로 추가 공격을 연속 발동하는 패시브입니다.',
  booster_quality: '체력과 정신력을 소모해 일정 시간 무기 공격속도를 높입니다.',
  iron_wall: '일정 시간 파티 전원의 방어력을 높입니다.',
  quality_inspection: '일정 시간 파티 전원의 최대 체력과 최대 정신력을 높입니다.',
  pride: '적으로부터 받는 모든 피해를 상시 감소시키는 패시브입니다.',
  quality_improvement: '전방의 여러 적을 여러 차례 공격하며 레벨에 따라 대상과 타격 수가 늘어납니다.',
  reprimand: '체력과 정신력을 소모해 전방 다수의 적에게 강한 일격을 가합니다.',
  sacrifice: '자신의 체력을 일부 희생해 단일 적의 방어력을 무시하는 공격을 가합니다.',
  presentation: '넓은 범위의 다수 적을 공격한 뒤 잠시 행동할 수 없게 되는 광역기입니다.',
  criticism: '단일 적의 공격력 증가 효과를 일정 확률로 제거합니다.',
  bleeding_endurance: '일정 시간 공격력이 상승하지만 주기적으로 자신의 체력을 소모합니다.',
  come_here_quality: '전방의 적들을 자신의 앞으로 끌어당깁니다.',
  firm_will_quality: '일정 시간 피격 시 뒤로 밀려나는 현상을 확률적으로 막습니다.',
  charge_quality: '전방으로 돌진하며 경로상의 적들을 밀고 피해를 줍니다.',
  sturdy_body_quality: '적에게 받는 모든 피해를 상시 감소시키는 패시브입니다.',
  firmness: '체력이 일정 비율 이하일 때 자신이 입히는 피해가 증가하는 패시브입니다.',
  small_companion: '작은 동반자를 소환해 유지되는 동안 무기 숙련도를 높입니다.',
  companion_heal: '동반자가 소환된 동안 일정 주기마다 체력을 회복시키는 패시브입니다.',
  companion_buff: '동반자가 주기적으로 방어력, 명중률, 회피율 버프를 부여합니다.'
});

function ensureSkillState(character) {
  if (!character.skills || typeof character.skills !== 'object') character.skills = {};
  const skills = character.skills;
  if (!skills.levels || typeof skills.levels !== 'object') skills.levels = {};
  if (!Array.isArray(skills.activePreset)) skills.activePreset = [];
  if (!Array.isArray(skills.autoPreset)) skills.autoPreset = [];
  skills.activePreset = skills.activePreset.filter(
    (skillId) => !NON_PRESET_EFFECTS.has(SKILL_DEFINITIONS[String(skillId)]?.effect)
  );
  const activePresetSet = new Set(skills.activePreset.map(String));
  skills.autoPreset = skills.autoPreset.filter((skillId) => activePresetSet.has(String(skillId)));
  if (!Array.isArray(skills.unlockedQuestSkills)) skills.unlockedQuestSkills = [];
  if (!skills.unlockProgress || typeof skills.unlockProgress !== 'object') {
    skills.unlockProgress = {};
  }
  skills.unlockMigrationVersion = Math.max(
    0,
    Math.floor(Number(skills.unlockMigrationVersion) || 0)
  );
  if (!Array.isArray(skills.activeBuffs)) skills.activeBuffs = [];
  if (!skills.cooldowns || typeof skills.cooldowns !== 'object') skills.cooldowns = {};
  if (!skills.summon || typeof skills.summon !== 'object') skills.summon = null;
  skills.comboCount = Math.max(0, Math.min(10, Math.floor(Number(skills.comboCount) || 0)));
  if (typeof character.markModified === 'function') character.markModified('skills');
  return skills;
}

function getSkillStageForLevel(level, maxLevel) {
  const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
  const safeMaximum = Math.max(1, Math.floor(Number(maxLevel) || 1));
  if (safeLevel <= 0) return 0;
  if (safeLevel <= 10) return Math.min(10, safeMaximum);
  if (safeLevel <= 20) return Math.min(20, safeMaximum);
  return safeMaximum;
}

function getSkillUnlockRule(definition, departmentId) {
  if (!definition) return null;
  const masteryRule = getMasteryBookRule(definition.id, departmentId);
  if (!definition.quest && !masteryRule) return null;
  return {
    mode: masteryRule ? 'mastery' : 'quest',
    masteryRule,
    initialCap: definition.quest ? 0 : Math.min(10, definition.maxLevel)
  };
}

function getDepartmentUnlockProgress(skills, departmentId, create = false) {
  const key = String(departmentId || 'unassigned');
  if (!skills.unlockProgress[key] || typeof skills.unlockProgress[key] !== 'object') {
    if (!create) return null;
    skills.unlockProgress[key] = {};
  }
  return skills.unlockProgress[key];
}

function migrateSkillUnlockProgress(character) {
  const skills = ensureSkillState(character);
  if (skills.unlockMigrationVersion >= SKILL_UNLOCK_MIGRATION_VERSION) return false;
  let changed = false;
  const legacyUnlocked = new Set(skills.unlockedQuestSkills.map(String));
  for (const definition of Object.values(SKILL_DEFINITIONS)) {
    const currentLevel = Math.max(0, Math.floor(Number(skills.levels[definition.id]) || 0));
    for (const departmentId of definition.departments || []) {
      const rule = getSkillUnlockRule(definition, departmentId);
      if (!rule) continue;
      const department = getDepartmentUnlockProgress(skills, departmentId, true);
      const existing = department[definition.id] && typeof department[definition.id] === 'object'
        ? department[definition.id]
        : {};
      let cap = Math.max(0, Math.floor(Number(existing.cap) || 0));
      if (!definition.quest) cap = Math.max(cap, rule.initialCap);
      if (definition.quest && legacyUnlocked.has(definition.id)) {
        cap = Math.max(cap, Math.min(10, definition.maxLevel));
      }
      cap = Math.max(cap, getSkillStageForLevel(currentLevel, definition.maxLevel));
      if (cap > 0 || Object.keys(existing).length) {
        department[definition.id] = {
          ...existing,
          cap: Math.min(definition.maxLevel, cap),
          failures: existing.failures && typeof existing.failures === 'object'
            ? existing.failures
            : {}
        };
      }
      changed = true;
    }
  }
  skills.unlockMigrationVersion = SKILL_UNLOCK_MIGRATION_VERSION;
  if (changed && typeof character.markModified === 'function') character.markModified('skills');
  return changed;
}

function getSkillUnlockEntry(character, skillId, departmentId, create = false) {
  const skills = ensureSkillState(character);
  migrateSkillUnlockProgress(character);
  const department = getDepartmentUnlockProgress(skills, departmentId, create);
  if (!department) return null;
  if (!department[skillId] || typeof department[skillId] !== 'object') {
    if (!create) return null;
    department[skillId] = { cap: 0, failures: {} };
  }
  if (!department[skillId].failures || typeof department[skillId].failures !== 'object') {
    department[skillId].failures = {};
  }
  return department[skillId];
}

function getSkillInvestmentCap(character, definition, departmentId = character.job?.departmentId) {
  if (!definition) return 0;
  const rule = getSkillUnlockRule(definition, departmentId);
  if (!rule) return definition.maxLevel;
  const entry = getSkillUnlockEntry(character, definition.id, departmentId, false);
  const currentStage = getSkillStageForLevel(
    Math.max(0, Math.floor(Number(ensureSkillState(character).levels[definition.id]) || 0)),
    definition.maxLevel
  );
  return Math.min(
    definition.maxLevel,
    Math.max(rule.initialCap, currentStage, Math.floor(Number(entry?.cap) || 0))
  );
}

function getNextSkillUnlockStage(character, definition, departmentId = character.job?.departmentId) {
  const cap = getSkillInvestmentCap(character, definition, departmentId);
  if (cap >= definition.maxLevel) return null;
  if (cap < 10) return Math.min(10, definition.maxLevel);
  if (cap < 20) return Math.min(20, definition.maxLevel);
  return definition.maxLevel;
}

function unlockSkillCap(
  character,
  skillId,
  requestedCap,
  departmentId = character.job?.departmentId,
  now = new Date()
) {
  const definition = SKILL_DEFINITIONS[String(skillId || '')];
  if (!definition || !definition.departments.includes(departmentId)) {
    throw new Error('현재 부서에서 해금할 수 없는 스킬입니다.');
  }
  const rule = getSkillUnlockRule(definition, departmentId);
  if (!rule) throw new Error('별도 해금 단계가 없는 스킬입니다.');
  const cap = Math.min(
    definition.maxLevel,
    Math.max(0, Math.floor(Number(requestedCap) || 0))
  );
  const entry = getSkillUnlockEntry(character, definition.id, departmentId, true);
  const previousCap = getSkillInvestmentCap(character, definition, departmentId);
  entry.cap = Math.max(previousCap, cap);
  entry.unlockedAt = entry.unlockedAt || new Date(now).toISOString();
  if (definition.quest && entry.cap > 0) {
    const skills = ensureSkillState(character);
    if (!skills.unlockedQuestSkills.includes(definition.id)) {
      skills.unlockedQuestSkills.push(definition.id);
    }
  }
  if (typeof character.markModified === 'function') character.markModified('skills');
  return { skillId: definition.id, departmentId, previousCap, cap: entry.cap };
}

function getMasteryFailureCount(character, skillId, stage, departmentId = character.job?.departmentId) {
  const entry = getSkillUnlockEntry(character, String(skillId || ''), departmentId, true);
  return Math.max(0, Math.floor(Number(entry.failures?.[stage]) || 0));
}

function setMasteryFailureCount(
  character,
  skillId,
  stage,
  count,
  departmentId = character.job?.departmentId
) {
  const entry = getSkillUnlockEntry(character, String(skillId || ''), departmentId, true);
  entry.failures[String(stage)] = Math.max(0, Math.floor(Number(count) || 0));
  if (typeof character.markModified === 'function') character.markModified('skills');
  return entry.failures[String(stage)];
}

function getSkillLevel(character, skillId) {
  return Math.max(0, Math.floor(Number(ensureSkillState(character).levels[skillId]) || 0));
}

function interpolate(start, end, level, maxLevel) {
  if (maxLevel <= 1) return end;
  const progress = (Math.max(1, level) - 1) / (maxLevel - 1);
  const value = Number(start) + (Number(end) - Number(start)) * progress;
  return Number.isInteger(start) && Number.isInteger(end)
    ? Math.round(value)
    : Math.round(value * 100) / 100;
}

function resolveValue(value, level, maxLevel) {
  if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)) {
    return interpolate(value[0], value[1], level, maxLevel);
  }
  return value;
}

function resolveSkillValues(definition, level) {
  return Object.fromEntries(Object.entries(definition.values || {}).map(([key, value]) => [
    key,
    resolveValue(value, level, definition.maxLevel)
  ]));
}

function resolveSkillCastProfile(values = {}) {
  const channelDurationSeconds = Math.max(0, Number(values.channelDurationSeconds) || 0);
  const channelIntervalSeconds = Math.max(0, Number(values.channelIntervalSeconds) || 0);
  const calculatedHits = channelDurationSeconds > 0 && channelIntervalSeconds > 0
    ? Math.ceil(channelDurationSeconds / channelIntervalSeconds)
    : 1;
  const hitCount = Math.max(
    1,
    Math.floor(Number(values.hits) || calculatedHits)
  );
  return {
    hitCount,
    mpCostMultiplier: Number(values.mpCostPerHit) > 0 ? hitCount : 1,
    channelDurationSeconds,
    channelIntervalSeconds,
    lockSeconds: Math.max(
      Math.max(0, Number(values.cooldownSeconds) || 0),
      channelDurationSeconds
    )
  };
}

function getDepartmentSkillDefinitions(departmentId) {
  return Object.values(SKILL_DEFINITIONS).filter(
    (definition) => definition.departments.includes(departmentId)
  );
}

function getTierSpent(character, tier) {
  return getDepartmentSkillDefinitions(character.job?.departmentId)
    .filter((definition) => definition.tier === Number(tier))
    .reduce((total, definition) => total + getSkillLevel(character, definition.id), 0);
}

function getEarnedSkillPointsForTier(character, tier) {
  const level = Math.max(1, Math.min(200, Math.floor(Number(character.progression?.level) || 1)));
  const advancementTier = Math.max(0, Math.min(4, Math.floor(Number(character.job?.advancementTier) || 0)));
  const requestedTier = Number(tier);
  if (requestedTier === 0) return Math.min(9, level - 1);
  if (requestedTier > advancementTier) return 0;
  const boundaries = {
    1: { start: 10, end: 30 },
    2: { start: 30, end: 70 },
    3: { start: 70, end: 120 },
    4: { start: 120, end: 200 }
  };
  const boundary = boundaries[requestedTier];
  if (!boundary) return 0;
  return 1 + Math.max(0, Math.min(boundary.end, level) - boundary.start) * 3;
}

function getInvestmentBlockReason(character, definition) {
  if (!definition) return '존재하지 않는 스킬입니다.';
  if (!definition.departments.includes(character.job?.departmentId)) {
    return '현재 부서에서 배울 수 없는 스킬입니다.';
  }
  if (Number(character.job?.advancementTier) < definition.tier) {
    return `${definition.tier}차 전직 후 배울 수 있습니다.`;
  }
  if (getTierSpent(character, definition.tier) >= getEarnedSkillPointsForTier(character, definition.tier)) {
    return `${definition.tier}차 스킬 포인트를 모두 사용했습니다.`;
  }
  const investmentCap = getSkillInvestmentCap(character, definition);
  if (definition.quest && investmentCap <= 0) {
    return '퀘스트를 완료해야 해금됩니다.';
  }
  const tierRequirement = TIER_SP_REQUIREMENTS[definition.tier];
  if (tierRequirement && getTierSpent(character, definition.tier - 1) < tierRequirement) {
    return `${definition.tier - 1}차 스킬에 ${tierRequirement} SP를 먼저 투자해야 합니다.`;
  }
  const departmentPrerequisites = definition.prerequisitesByDepartment?.[
    character.job?.departmentId
  ] || [];
  const prerequisites = [
    ...(definition.prerequisites || []),
    ...departmentPrerequisites
  ];
  for (const prerequisite of prerequisites) {
    if (getSkillLevel(character, prerequisite.skillId) < prerequisite.level) {
      const skillName = SKILL_DEFINITIONS[prerequisite.skillId]?.name || prerequisite.skillId;
      return `${skillName} ${prerequisite.level}레벨이 필요합니다.`;
    }
  }
  if (definition.prerequisiteAny?.length) {
    const satisfied = definition.prerequisiteAny.some(
      (requirement) => getSkillLevel(character, requirement.skillId) >= requirement.level
    );
    if (!satisfied) {
      return definition.prerequisiteAny.map((requirement) => (
        `${SKILL_DEFINITIONS[requirement.skillId]?.name || requirement.skillId} ${requirement.level}레벨`
      )).join(' 또는 ') + '이 필요합니다.';
    }
  }
  const currentLevel = getSkillLevel(character, definition.id);
  if (currentLevel >= definition.maxLevel) return '이미 마스터했습니다.';
  if (currentLevel >= investmentCap) {
    const nextStage = getNextSkillUnlockStage(character, definition);
    return getMasteryBookRule(definition.id, character.job?.departmentId)
      ? `마스터리북 ${nextStage}이(가) 필요합니다.`
      : '연계 해금 퀘스트를 완료해야 합니다.';
  }
  if (Number(character.progression?.unspentSkillPoints) <= 0) return '사용 가능한 스킬 포인트가 없습니다.';
  return '';
}

function investSkill(character, skillId, amount = 1) {
  const definition = SKILL_DEFINITIONS[String(skillId || '')];
  const reason = getInvestmentBlockReason(character, definition);
  if (reason) throw new Error(reason);
  const current = getSkillLevel(character, definition.id);
  const requested = Math.max(1, Math.floor(Number(amount) || 1));
  const investment = Math.min(
    requested,
    getSkillInvestmentCap(character, definition) - current,
    getEarnedSkillPointsForTier(character, definition.tier)
      - getTierSpent(character, definition.tier),
    Math.max(0, Math.floor(Number(character.progression?.unspentSkillPoints) || 0))
  );
  if (!investment) throw new Error('투자할 수 있는 스킬 포인트가 없습니다.');
  ensureSkillState(character).levels[definition.id] = current + investment;
  character.progression.unspentSkillPoints -= investment;
  if (typeof character.markModified === 'function') character.markModified('skills');
  return { skillId: definition.id, invested: investment, level: current + investment };
}

function setActivePreset(character, skillIds = []) {
  const normalized = [...new Set((Array.isArray(skillIds) ? skillIds : [])
    .map((skillId) => String(skillId || ''))
    .filter(Boolean))].slice(0, MAX_ACTIVE_PRESET_SIZE);
  for (const skillId of normalized) {
    const definition = SKILL_DEFINITIONS[skillId];
    if (
      !definition
      || definition.passive
      || NON_PRESET_EFFECTS.has(definition.effect)
      || getSkillLevel(character, skillId) <= 0
    ) {
      throw new Error('배운 액티브 스킬만 프리셋에 등록할 수 있습니다.');
    }
  }
  ensureSkillState(character).activePreset = normalized;
  const activeSet = new Set(normalized);
  ensureSkillState(character).autoPreset = ensureSkillState(character).autoPreset
    .filter((skillId) => activeSet.has(String(skillId)));
  if (typeof character.markModified === 'function') character.markModified('skills');
  return normalized;
}

function setAutoPreset(character, skillIds = []) {
  const skills = ensureSkillState(character);
  const activeSet = new Set(skills.activePreset.map(String));
  const normalized = [...new Set((Array.isArray(skillIds) ? skillIds : [])
    .map((skillId) => String(skillId || ''))
    .filter((skillId) => activeSet.has(skillId)))].slice(0, MAX_ACTIVE_PRESET_SIZE);
  for (const skillId of normalized) {
    const definition = SKILL_DEFINITIONS[skillId];
    if (
      !definition
      || definition.passive
      || NON_PRESET_EFFECTS.has(definition.effect)
      || getSkillLevel(character, skillId) <= 0
    ) {
      throw new Error('자동 사용은 전투 프리셋에 등록된 액티브 스킬만 설정할 수 있습니다.');
    }
  }
  skills.autoPreset = normalized;
  if (typeof character.markModified === 'function') character.markModified('skills');
  return normalized;
}

function formatValue(key, value) {
  if (typeof value !== 'number') return String(value);
  if (PERCENT_KEYS.has(key)) return `${value}%`;
  if (key.endsWith('Seconds')) return `${value}초`;
  return String(value);
}

function describeSkill(definition, values) {
  const coefficients = Object.entries(values)
    .filter(([key]) => VALUE_LABELS[key])
    .map(([key, value]) => `${VALUE_LABELS[key]} ${formatValue(key, value)}`)
    .join(' · ');
  const role = definition.description || SKILL_ROLE_DESCRIPTIONS[definition.id]
    || (definition.passive
      ? '조건을 만족하면 자동으로 적용되는 패시브 스킬입니다.'
      : '직접 사용해 효과를 발동하는 액티브 스킬입니다.');
  return coefficients ? `${role} 현재 효과: ${coefficients}` : role;
}

function pruneExpiredSkillState(character, now = Date.now()) {
  const skills = ensureSkillState(character);
  const before = skills.activeBuffs.length;
  skills.activeBuffs = skills.activeBuffs.filter(
    (buff) => !buff.expiresAt || new Date(buff.expiresAt).getTime() > now
  );
  if (skills.summon?.expiresAt && new Date(skills.summon.expiresAt).getTime() <= now) {
    skills.summon = null;
  }
  for (const [skillId, expiresAt] of Object.entries(skills.cooldowns)) {
    if (Number(expiresAt) <= now) delete skills.cooldowns[skillId];
  }
  if (before !== skills.activeBuffs.length && typeof character.markModified === 'function') {
    character.markModified('skills');
  }
  return skills;
}

function buildActiveBuffEffects(values = {}, extraEffects = {}) {
  const effects = {};
  for (const key of ACTIVE_BUFF_EFFECT_KEYS) {
    if (Number.isFinite(Number(values[key]))) effects[key] = Number(values[key]);
  }
  for (const [key, value] of Object.entries(extraEffects || {})) {
    if (Number.isFinite(Number(value))) effects[key] = Number(value);
  }
  return effects;
}

function upsertActiveBuff(character, buff = {}, now = Date.now()) {
  const skillId = String(buff.skillId || '');
  if (!skillId) throw new Error('버프 스킬 정보가 올바르지 않습니다.');
  const skills = ensureSkillState(character);
  const createdAtMs = Number.isFinite(new Date(buff.createdAt).getTime())
    ? new Date(buff.createdAt).getTime()
    : now;
  const durationSeconds = Math.max(0, Number(buff.durationSeconds) || 0);
  const explicitExpiryMs = buff.expiresAt == null ? 0 : new Date(buff.expiresAt).getTime();
  const expiresAtMs = Number.isFinite(explicitExpiryMs) && explicitExpiryMs > 0
    ? explicitExpiryMs
    : (durationSeconds > 0 ? createdAtMs + durationSeconds * 1000 : 0);
  const normalized = {
    skillId,
    name: String(buff.name || SKILL_DEFINITIONS[skillId]?.name || '버프'),
    effects: { ...(buff.effects || {}) },
    createdAt: new Date(createdAtMs),
    expiresAt: expiresAtMs > 0 ? new Date(expiresAtMs) : null
  };
  skills.activeBuffs = skills.activeBuffs.filter((entry) => String(entry.skillId) !== skillId);
  skills.activeBuffs.push(normalized);
  if (typeof character.markModified === 'function') {
    character.markModified('skills');
    character.markModified('skills.activeBuffs');
  }
  return normalized;
}

function getActiveSkillEffects(character, now = Date.now()) {
  const skills = pruneExpiredSkillState(character, now);
  const effects = {
    attackIncrease: 0,
    defenseIncrease: 0,
    magicDefenseIncrease: 0,
    accuracyIncrease: 0,
    evasionIncrease: 0,
    weaponMastery: 0,
    shieldDefensePercent: 0,
    attackSpeedStage: 0,
    damageReductionPercent: 0,
    mpDamageGuardPercent: 0,
    blockChance: 0,
    stanceChance: 0,
    contactReflectPercent: 0,
    contactReflectCapPercent: 0,
    doubleStrikeChance: 0,
    doubleStrikeDamagePercent: 0,
    comboEnabled: 0,
    comboMaximum: 5,
    comboDamagePerCount: 0,
    comboDoubleChargeChance: 0,
    lowHpThresholdPercent: 0,
    lowHpDamageIncreasePercent: 0,
    maxResourcePercent: 0,
    damageIncreasePercent: 0,
    elementDamageIncreasePercent: 0,
    elementExplosionDamagePercent: 250,
    elementPreserveChance: 0,
    experienceBonusPercent: 0,
    allStatsPercent: 0,
    moneyDropIncreasePercent: 0,
    noAmmoConsumption: 0,
    movementSpeedIncrease: 0,
    criticalChance: 0,
    criticalDamagePercent: 200,
    attackRangeIncrease: 0,
    dodgeChance: 0,
    consumableEffectPercent: 100,
    upgradedAuditHits: 0,
    upgradedAuditDamagePercent: 0,
    poisonChance: 0,
    poisonAttack: 0,
    poisonDurationSeconds: 0,
    poisonMaxStacks: 0,
    closeRangeChance: 0,
    closeRangeDamagePercent: 0,
    executeThresholdPercent: 0,
    executeChance: 0,
    magicMpCostIncreasePercent: 0,
    periodicHpRestore: 0,
    periodicMpRestore: 0,
    periodicRestoreIntervalSeconds: 10,
    mpAbsorbChance: 0,
    mpAbsorbPercent: 0,
    stealth: 0
  };
  const weaponType = character.loadout?.weapon?.weaponType;
  for (const definition of getDepartmentSkillDefinitions(character.job?.departmentId)) {
    const level = getSkillLevel(character, definition.id);
    if (!level || !definition.passive) continue;
    const values = resolveSkillValues(definition, level);
    if (definition.effect === 'weapon-mastery' && definition.weaponTypes.includes(weaponType)) {
      effects.weaponMastery = Math.max(effects.weaponMastery, Number(values.mastery) || 0);
      effects.accuracyIncrease += Number(values.accuracyIncrease) || 0;
    }
    if (definition.effect === 'shield-mastery') {
      effects.shieldDefensePercent += Number(values.shieldDefensePercent) || 0;
    }
    if (definition.effect === 'damage-reduction') {
      effects.damageReductionPercent += Number(values.reductionPercent) || 0;
    }
    if (definition.effect === 'double-strike') {
      effects.doubleStrikeChance = Math.max(effects.doubleStrikeChance, Number(values.chance) || 0);
      effects.doubleStrikeDamagePercent = Math.max(
        effects.doubleStrikeDamagePercent,
        Number(values.damagePercent) || 0
      );
    }
    if (definition.effect === 'critical-passive') {
      effects.criticalChance += Number(values.criticalChance) || 0;
      effects.criticalDamagePercent = Math.max(
        effects.criticalDamagePercent,
        Number(values.criticalDamagePercent) || 200
      );
    }
    if (
      definition.effect === 'range-passive'
      && (!definition.weaponTypes?.length || definition.weaponTypes.includes(weaponType))
    ) {
      effects.attackRangeIncrease += Number(values.attackRangeIncrease) || 0;
    }
    if (definition.effect === 'dodge-passive') {
      effects.dodgeChance += Number(values.dodgeChance) || 0;
    }
    if (definition.effect === 'consumable-boost') {
      effects.consumableEffectPercent = Math.max(
        effects.consumableEffectPercent,
        Number(values.consumableEffectPercent) || 100
      );
    }
    if (definition.effect === 'skill-upgrade' && values.upgradedSkillName === '4중 검산') {
      effects.upgradedAuditHits = Math.max(
        effects.upgradedAuditHits,
        Number(values.upgradedHits) || 0
      );
      effects.upgradedAuditDamagePercent = Math.max(
        effects.upgradedAuditDamagePercent,
        Number(values.upgradedDamagePercent) || 0
      );
    }
    if (definition.effect === 'poison-passive') {
      effects.poisonChance = Math.max(effects.poisonChance, Number(values.poisonChance) || 0);
      effects.poisonAttack = Math.max(effects.poisonAttack, Number(values.poisonAttack) || 0);
      effects.poisonDurationSeconds = Math.max(
        effects.poisonDurationSeconds,
        Number(values.poisonDurationSeconds) || 0
      );
      effects.poisonMaxStacks = Math.max(
        effects.poisonMaxStacks,
        Number(values.poisonMaxStacks) || 0
      );
    }
    if (
      definition.effect === 'close-range-passive'
      && (!definition.weaponTypes?.length || definition.weaponTypes.includes(weaponType))
    ) {
      effects.closeRangeChance = Math.max(
        effects.closeRangeChance,
        Number(values.closeRangeChance) || 0
      );
      effects.closeRangeDamagePercent = Math.max(
        effects.closeRangeDamagePercent,
        Number(values.closeRangeDamagePercent) || 0
      );
      effects.executeThresholdPercent = Math.max(
        effects.executeThresholdPercent,
        Number(values.executeThresholdPercent) || 0
      );
      effects.executeChance = Math.max(
        effects.executeChance,
        Number(values.executeChance) || 0
      );
    }
    if (definition.effect === 'stat-passive') {
      effects.accuracyIncrease += Number(values.accuracyIncrease) || 0;
      effects.evasionIncrease += Number(values.evasionIncrease) || 0;
      effects.movementSpeedIncrease += Number(values.movementSpeedIncrease) || 0;
    }
    if (definition.effect === 'periodic-recovery') {
      effects.periodicHpRestore += Number(values.periodicHpRestore) || 0;
      effects.periodicMpRestore += Number(values.periodicMpRestore) || 0;
      effects.periodicMpRestore += Math.floor(
        Math.max(0, Number(character.progression?.level) || 1)
          * level
          * Math.max(0, Number(values.periodicMpLevelSkillFactor) || 0)
          + Math.max(0, Number(values.periodicMpFlat) || 0)
      );
      effects.periodicRestoreIntervalSeconds = Math.min(
        effects.periodicRestoreIntervalSeconds,
        Number(values.intervalSeconds) || 10
      );
    }
    if (definition.effect === 'periodic-mp') {
      effects.periodicMpRestore += Number(values.mpRestore) || 0;
      effects.periodicRestoreIntervalSeconds = Math.min(
        effects.periodicRestoreIntervalSeconds,
        Number(values.intervalSeconds) || 10
      );
    }
    if (definition.effect === 'mp-absorb') {
      effects.mpAbsorbChance = Math.max(
        effects.mpAbsorbChance,
        Number(values.mpAbsorbChance) || 0
      );
      effects.mpAbsorbPercent = Math.max(
        effects.mpAbsorbPercent,
        Number(values.mpAbsorbPercent) || 0
      );
    }
    if (definition.effect === 'shield-block' && character.loadout?.shield) {
      effects.blockChance += Number(values.blockChance) || 0;
    }
    if (definition.effect === 'combo-upgrade') {
      effects.comboMaximum = Math.max(effects.comboMaximum, Number(values.maxCombo) || 5);
      effects.comboDoubleChargeChance += Number(values.doubleChargeChance) || 0;
    }
    if (definition.effect === 'low-hp-damage') {
      effects.lowHpThresholdPercent = Math.max(
        effects.lowHpThresholdPercent,
        Number(values.hpThresholdPercent) || 0
      );
      effects.lowHpDamageIncreasePercent = Math.max(
        effects.lowHpDamageIncreasePercent,
        Number(values.damageIncreasePercent) || 0
      );
    }
    if (definition.effect === 'element-enhancement') {
      effects.elementDamageIncreasePercent += Number(values.elementDamageIncreasePercent) || 0;
    }
    if (definition.effect === 'element-explosion-upgrade') {
      effects.elementExplosionDamagePercent = Math.max(
        effects.elementExplosionDamagePercent,
        Number(values.damagePercent) || 250
      );
      effects.elementPreserveChance = Math.max(
        effects.elementPreserveChance,
        Number(values.preserveElementChance) || 0
      );
    }
  }
  for (const buff of skills.activeBuffs) {
    for (const key of Object.keys(effects)) {
      if (['weaponMastery', 'comboMaximum', 'contactReflectCapPercent'].includes(key)) {
        effects[key] = Math.max(effects[key], Number(buff.effects?.[key]) || 0);
      }
      else effects[key] += Number(buff.effects?.[key]) || 0;
    }
  }
  if (skills.summon) {
    effects.weaponMastery += Number(skills.summon.masteryIncrease) || 0;
  }
  if (isCompanionSummon(skills.summon)) {
    const summonCreatedAt = new Date(skills.summon.createdAt || Date.now()).getTime();
    const summonAgeSeconds = Math.max(0, (Date.now() - summonCreatedAt) / 1000);
    for (const definition of getDepartmentSkillDefinitions(character.job?.departmentId)) {
      const level = getSkillLevel(character, definition.id);
      if (!level || !definition.passive) continue;
      const values = resolveSkillValues(definition, level);
      if (definition.effect === 'summon-heal') {
        effects.periodicHpRestore += Number(values.heal) || 0;
        effects.periodicRestoreIntervalSeconds = Math.min(
          effects.periodicRestoreIntervalSeconds,
          Number(values.intervalSeconds) || 10
        );
      }
      if (definition.effect === 'summon-buff') {
        const interval = Math.max(1, Number(values.intervalSeconds) || 60);
        const duration = Math.max(0, Number(values.durationSeconds) || 0);
        const buffStarted = summonAgeSeconds >= interval;
        const activeInCycle = duration >= interval
          || summonAgeSeconds % interval <= duration;
        if (buffStarted && activeInCycle) {
          effects.defenseIncrease += Number(values.defenseIncrease) || 0;
          effects.accuracyIncrease += Number(values.accuracyIncrease) || 0;
          effects.evasionIncrease += Number(values.evasionIncrease) || 0;
        }
      }
    }
  }
  return effects;
}

function buildSkillTree(character) {
  const skills = pruneExpiredSkillState(character);
  const definitions = getDepartmentSkillDefinitions(character.job?.departmentId)
    .sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name, 'ko'));
  const activeBuffs = skills.activeBuffs.map((buff) => {
    const definition = SKILL_DEFINITIONS[buff.skillId];
    const level = definition ? Math.max(1, getSkillLevel(character, definition.id)) : 1;
    const values = definition ? resolveSkillValues(definition, level) : {};
    const createdAt = new Date(buff.createdAt || Date.now()).getTime();
    const expiresAt = buff.expiresAt ? new Date(buff.expiresAt).getTime() : 0;
    return {
      skillId: String(buff.skillId || ''),
      name: String(buff.name || definition?.name || '버프'),
      description: definition
        ? describeSkill(definition, values)
        : '현재 캐릭터에게 적용 중인 버프입니다.',
      effects: { ...(buff.effects || {}) },
      createdAt,
      expiresAt,
      durationMs: expiresAt > createdAt ? expiresAt - createdAt : 0
    };
  });
  const summonCreatedAt = skills.summon
    ? new Date(skills.summon.createdAt || Date.now()).getTime()
    : 0;
  const summonExpiresAt = skills.summon?.expiresAt
    ? new Date(skills.summon.expiresAt).getTime()
    : 0;
  const summon = skills.summon
    ? {
      ...skills.summon,
      description: describeSummon(skills.summon),
      createdAt: summonCreatedAt,
      expiresAt: summonExpiresAt,
      durationMs: summonExpiresAt > summonCreatedAt ? summonExpiresAt - summonCreatedAt : 0
    }
    : null;
  return {
    tierSpent: Object.fromEntries([0, 1, 2, 3, 4].map((tier) => [tier, getTierSpent(character, tier)])),
    tierEarned: Object.fromEntries([0, 1, 2, 3, 4].map((tier) => [
      tier, getEarnedSkillPointsForTier(character, tier)
    ])),
    tierRequirements: TIER_SP_REQUIREMENTS,
    activePreset: [...skills.activePreset],
    autoPreset: [...skills.autoPreset],
    summon,
    activeBuffs,
    comboCount: skills.comboCount,
    skills: definitions.map((definition) => {
      const level = getSkillLevel(character, definition.id);
      const previewLevel = Math.max(1, level);
      const values = resolveSkillValues(definition, previewLevel);
      return {
        id: definition.id,
        name: definition.name,
        tier: definition.tier,
        level,
        maxLevel: definition.maxLevel,
        investmentCap: getSkillInvestmentCap(character, definition),
        nextUnlockStage: getNextSkillUnlockStage(character, definition),
        unlockMethod: getSkillUnlockRule(definition, character.job?.departmentId)?.mode || 'level',
        passive: definition.passive,
        quest: definition.quest,
        target: definition.target,
        range: Number(values.range ?? definition.range) || 0,
        effect: definition.effect,
        element: definition.element,
        values,
        cooldownUntil: Number(skills.cooldowns?.[definition.id]) || 0,
        cooldownRemainingMs: Math.max(
          0,
          Number(skills.cooldowns?.[definition.id]) - Date.now()
        ),
        description: describeSkill(definition, values),
        blockReason: getInvestmentBlockReason(character, definition),
        canInvest: !getInvestmentBlockReason(character, definition)
      };
    })
  };
}

function unlockQuestSkill(character, skillId) {
  const definition = SKILL_DEFINITIONS[skillId];
  if (!definition?.quest) throw new Error('퀘스트 해금 스킬이 아닙니다.');
  return unlockSkillCap(
    character,
    skillId,
    Math.min(10, definition.maxLevel),
    character.job?.departmentId
  );
}

module.exports = {
  MAX_ACTIVE_PRESET_SIZE,
  SKILL_UNLOCK_MIGRATION_VERSION,
  ensureSkillState,
  migrateSkillUnlockProgress,
  getSkillLevel,
  getSkillInvestmentCap,
  getNextSkillUnlockStage,
  unlockSkillCap,
  getMasteryFailureCount,
  setMasteryFailureCount,
  resolveSkillValues,
  getTierSpent,
  getEarnedSkillPointsForTier,
  getInvestmentBlockReason,
  investSkill,
  setActivePreset,
  setAutoPreset,
  pruneExpiredSkillState,
  resolveSkillCastProfile,
  buildActiveBuffEffects,
  upsertActiveBuff,
  getActiveSkillEffects,
  buildSkillTree,
  unlockQuestSkill
};
