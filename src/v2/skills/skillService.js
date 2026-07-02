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
  const coefficients = Object.entries(values)
    .filter(([key]) => VALUE_LABELS[key])
    .map(([key, value]) => `${VALUE_LABELS[key]} ${formatValue(key, value)}`)
    .join(' · ');
  const role = SKILL_ROLE_DESCRIPTIONS[definition.id]
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
