'use strict';

const {
  TIER_SP_REQUIREMENTS,
  SKILL_DEFINITIONS
} = require('./skillDefinitions');

const MAX_ACTIVE_PRESET_SIZE = 10;

const VALUE_LABELS = Object.freeze({
  healPercent: '회복량',
  levelUpHp: '레벨업 HP 추가',
  statPointHp: '스탯 투자 HP 추가',
  heal: '회복량',
  mpRestore: '정신력 회복',
  mpCost: '정신력 소모',
  hpCost: '체력 소모',
  damagePercent: '데미지',
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
  distance: '이동 거리'
});

const PERCENT_KEYS = new Set([
  'healPercent', 'damagePercent', 'mastery', 'masteryIncrease', 'chance',
  'successChance', 'stunChance', 'reductionPercent', 'blockChance',
  'reflectPercent', 'maxResourcePercent', 'maxHpCostPercent',
  'selfDamagePercent', 'hpThresholdPercent', 'damageIncreasePercent',
  'damagePerComboPercent', 'doubleChargeChance', 'stanceChance'
]);

function ensureSkillState(character) {
  if (!character.skills || typeof character.skills !== 'object') character.skills = {};
  const skills = character.skills;
  if (!skills.levels || typeof skills.levels !== 'object') skills.levels = {};
  if (!Array.isArray(skills.activePreset)) skills.activePreset = [];
  if (!Array.isArray(skills.unlockedQuestSkills)) skills.unlockedQuestSkills = [];
  if (!Array.isArray(skills.activeBuffs)) skills.activeBuffs = [];
  if (!skills.summon || typeof skills.summon !== 'object') skills.summon = null;
  skills.comboCount = Math.max(0, Math.min(10, Math.floor(Number(skills.comboCount) || 0)));
  if (typeof character.markModified === 'function') character.markModified('skills');
  return skills;
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

function getInvestmentBlockReason(character, definition) {
  if (!definition) return '존재하지 않는 스킬입니다.';
  if (!definition.departments.includes(character.job?.departmentId)) {
    return '현재 부서에서 배울 수 없는 스킬입니다.';
  }
  if (Number(character.job?.advancementTier) < definition.tier) {
    return `${definition.tier}차 전직 후 배울 수 있습니다.`;
  }
  if (definition.quest && !ensureSkillState(character).unlockedQuestSkills.includes(definition.id)) {
    return '퀘스트를 완료해야 해금됩니다.';
  }
  const tierRequirement = TIER_SP_REQUIREMENTS[definition.tier];
  if (tierRequirement && getTierSpent(character, definition.tier - 1) < tierRequirement) {
    return `${definition.tier - 1}차 스킬에 ${tierRequirement} SP를 먼저 투자해야 합니다.`;
  }
  for (const prerequisite of definition.prerequisites || []) {
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
  if (getSkillLevel(character, definition.id) >= definition.maxLevel) return '이미 마스터했습니다.';
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
    definition.maxLevel - current,
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
    if (!definition || definition.passive || getSkillLevel(character, skillId) <= 0) {
      throw new Error('배운 액티브 스킬만 프리셋에 등록할 수 있습니다.');
    }
  }
  ensureSkillState(character).activePreset = normalized;
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
  return Object.entries(values)
    .filter(([key]) => VALUE_LABELS[key])
    .map(([key, value]) => `${VALUE_LABELS[key]} ${formatValue(key, value)}`)
    .join(' · ');
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
  if (before !== skills.activeBuffs.length && typeof character.markModified === 'function') {
    character.markModified('skills');
  }
  return skills;
}

function getActiveSkillEffects(character, now = Date.now()) {
  const skills = pruneExpiredSkillState(character, now);
  const effects = {
    attackIncrease: 0,
    defenseIncrease: 0,
    accuracyIncrease: 0,
    evasionIncrease: 0,
    weaponMastery: 0,
    shieldDefensePercent: 0,
    attackSpeedStage: 0,
    damageReductionPercent: 0,
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
    maxResourcePercent: 0
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
  return effects;
}

function buildSkillTree(character) {
  const skills = ensureSkillState(character);
  const definitions = getDepartmentSkillDefinitions(character.job?.departmentId)
    .sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name, 'ko'));
  return {
    tierSpent: Object.fromEntries([1, 2, 3, 4].map((tier) => [tier, getTierSpent(character, tier)])),
    tierRequirements: TIER_SP_REQUIREMENTS,
    activePreset: [...skills.activePreset],
    summon: skills.summon ? { ...skills.summon } : null,
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
        passive: definition.passive,
        quest: definition.quest,
        target: definition.target,
        range: Number(values.range ?? definition.range) || 0,
        effect: definition.effect,
        values,
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
  const skills = ensureSkillState(character);
  if (!skills.unlockedQuestSkills.includes(skillId)) skills.unlockedQuestSkills.push(skillId);
  if (typeof character.markModified === 'function') character.markModified('skills');
}

module.exports = {
  MAX_ACTIVE_PRESET_SIZE,
  ensureSkillState,
  getSkillLevel,
  resolveSkillValues,
  getTierSpent,
  getInvestmentBlockReason,
  investSkill,
  setActivePreset,
  pruneExpiredSkillState,
  getActiveSkillEffects,
  buildSkillTree,
  unlockQuestSkill
};
