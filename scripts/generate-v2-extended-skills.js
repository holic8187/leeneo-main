'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'docs', 'v2', 'DEPARTMENT_SKILL_DRAFT_RANGED_MAGIC.md');
const outputPath = path.join(root, 'src', 'v2', 'skills', 'extendedSkillDefinitions.generated.json');
const DEPARTMENT_IDS = {
  '회계팀': 'accounting',
  '마케팅팀': 'marketing',
  '영업팀': 'sales',
  '시설관리팀': 'facilities',
  '개발팀': 'development',
  '연구팀': 'research',
  '경영지원팀': 'management_support'
};
const ARCHETYPE_SHARED = {
  '궁수 계열 공통 1차': ['accounting', 'marketing'],
  '도적 계열 공통 1차': ['sales', 'facilities'],
  '마법 계열 공통 1차': ['development', 'research', 'management_support']
};
const ALL_DEPARTMENTS = Object.values(DEPARTMENT_IDS);
const PASSIVE_OVERRIDES = Object.freeze({
  '멀리 보는 안목': {
    effect: 'range-passive',
    values: { attackRangeIncrease: [15, 120] },
    weaponTypes: ['bow', 'crossbow']
  },
  '멀리 보는 눈': {
    effect: 'range-passive',
    values: { attackRangeIncrease: [25, 200] },
    weaponTypes: ['claw']
  },
  '정신력 증가량 향상': {
    effect: 'mp-growth',
    values: { levelUpMp: [2, 20], statPointMp: [1, 10] }
  },
  '접대 노하우': {
    effect: 'consumable-boost',
    values: { consumableEffectPercent: [102, 150] }
  },
  '가짜 일정': {
    effect: 'dodge-passive',
    values: { dodgeChance: [1, 30] }
  },
  '안전 대피': {
    effect: 'dodge-passive',
    values: { dodgeChance: [1, 40] }
  },
  '안전장비 숙련': {
    effect: 'shield-mastery',
    values: { shieldDefensePercent: [5, 100] }
  },
  '6중 검산': {
    effect: 'skill-upgrade',
    values: { upgradedSkillName: '4중 검산', upgradedHits: 6, upgradedDamagePercent: [80, 120] }
  },
  '독한 영업': {
    effect: 'poison-passive',
    values: {
      poisonChance: [12, 30],
      poisonAttack: [31, 60],
      poisonDurationSeconds: [2, 4],
      poisonMaxStacks: 3
    }
  },
  '부식성 도포': {
    effect: 'poison-passive',
    values: {
      poisonChance: [12, 30],
      poisonAttack: [31, 60],
      poisonDurationSeconds: [2, 4],
      poisonMaxStacks: 3
    }
  },
  '오류 말소': {
    effect: 'close-range-passive',
    values: {
      closeRangeChance: [30, 90],
      closeRangeDamagePercent: [110, 250],
      executeThresholdPercent: 50,
      executeChance: [1, 10]
    },
    weaponTypes: ['crossbow']
  },
  '시장 퇴출': {
    effect: 'close-range-passive',
    values: {
      closeRangeChance: [30, 90],
      closeRangeDamagePercent: [110, 250],
      executeThresholdPercent: 50,
      executeChance: [1, 10]
    },
    weaponTypes: ['bow']
  },
  '오버클럭': {
    passive: false,
    effect: 'toggle-amplifier',
    values: {
      magicMpCostIncreasePercent: [3, 100],
      damageIncreasePercent: [1, 35]
    }
  },
  '출력 증폭': {
    passive: false,
    effect: 'toggle-amplifier',
    values: {
      magicMpCostIncreasePercent: [3, 100],
      damageIncreasePercent: [1, 35]
    }
  }
});
const SUMMON_OVERRIDES = Object.freeze({
  '대체 장부': {
    summonRole: 'decoy',
    summonIcon: '📒'
  },
  '감사 드론': {
    summonRole: 'attacker',
    summonIcon: '🦅',
    values: {
      attackPower: [30, 100],
      attackIntervalSeconds: 3,
      stunChance: [30, 99],
      stunSeconds: 2
    }
  },
  '동결감사 드론': {
    summonRole: 'attacker',
    summonIcon: '❄️',
    element: 'ice',
    maxTargets: 4,
    values: {
      attackPower: [120, 500],
      attackIntervalSeconds: 3,
      freezeSeconds: 4
    }
  },
  '마스코트 배치': {
    summonRole: 'decoy',
    summonIcon: '🧸'
  },
  '홍보 드론': {
    summonRole: 'attacker',
    summonIcon: '🦅',
    values: {
      attackPower: [30, 100],
      attackIntervalSeconds: 3,
      stunChance: [30, 99],
      stunSeconds: 2
    }
  },
  '불사조 캠페인': {
    summonRole: 'attacker',
    summonIcon: '🔥',
    element: 'fire',
    maxTargets: 4,
    values: {
      attackPower: [130, 550],
      attackIntervalSeconds: 2.5
    }
  },
  '영업 대리인': {
    summonRole: 'follow-up',
    summonIcon: '👥',
    values: {
      basicFollowUpPercent: [20, 80],
      skillFollowUpPercent: [15, 50],
      attackIntervalSeconds: 0
    }
  },
  '냉각 서버': {
    summonRole: 'attacker',
    summonIcon: '🧚',
    element: 'ice',
    maxTargets: 3,
    values: {
      attackPower: [183, 270],
      attackIntervalSeconds: 3,
      freezeSeconds: 4
    }
  },
  '가열 실험체': {
    summonRole: 'attacker',
    summonIcon: '🧯',
    element: 'fire',
    maxTargets: 3,
    values: {
      attackPower: [183, 300],
      attackIntervalSeconds: 3
    }
  },
  '지원 드론': {
    summonRole: 'attacker',
    summonIcon: '🐉',
    element: 'holy',
    values: {
      attackPower: [30, 150],
      attackIntervalSeconds: 3
    }
  },
  '지원 수호체': {
    summonRole: 'attacker',
    summonIcon: '🐲',
    element: 'holy',
    maxTargets: 3,
    values: {
      attackPower: [113, 230],
      attackIntervalSeconds: 3
    }
  }
});

function clean(value) {
  return String(value || '')
    .replaceAll('`', '')
    .replace(/\*\*/g, '')
    .trim();
}

function makeId(name, departments, tier) {
  const digest = crypto.createHash('sha1')
    .update(`${name}:${departments.join(',')}:${tier}`)
    .digest('hex')
    .slice(0, 10);
  return `extended_${digest}`;
}

function numberPair(text, pattern) {
  const match = text.match(pattern);
  if (!match) return null;
  const first = Number(String(match[1]).replaceAll(',', ''));
  const last = Number(String(match[2] ?? match[1]).replaceAll(',', ''));
  return Number.isFinite(first) && Number.isFinite(last)
    ? (first === last ? first : [first, last])
    : null;
}

function inferDefinition({ marker, name, tier, maxLevel, effectText, rangeText, departments }) {
  const passive = marker.includes('p.');
  const quest = marker.includes('q.');
  const description = clean(effectText);
  const isDamage = /피해|공격력의|스킬 공격력|즉사|공격\./.test(description)
    && !/피해.*감소|받는.*피해|피해를 MP로/.test(description);
  const isSummon = /소환/.test(description);
  const isParty = /파티/.test(description);
  const isArea = /최대 \d+명|주변|전방|직선상|범위|전체/.test(description);
  const isHeal = !passive && /(?:HP|체력).*회복|회복력.*회복/.test(description);
  const isMpAbsorb = passive && /최대 MP.*흡수/.test(description);
  const isTimedBuff = !passive
    && /(?:[0-9,]+\s*→\s*)?[0-9,]+초간/.test(description)
    && /증가|감소|면역|부여|소비하지 않음|크리티컬/.test(description);
  let effect = passive ? 'utility-passive' : 'buff';
  if (isSummon) effect = 'summon';
  if (name === '귀환 지원') effect = 'party-portal';
  else if (isHeal) effect = 'heal';
  else if (isTimedBuff) effect = 'buff';
  else if (isDamage) effect = /기절|빙결|마비/.test(description) ? 'damage-stun' : 'damage';
  if (passive && /숙련도/.test(description)) effect = 'weapon-mastery';
  else if (passive && /추가 공격|따라 공격/.test(description)) effect = 'double-strike';
  else if (passive && /크리티컬/.test(description)) effect = 'critical-passive';
  else if (isMpAbsorb) effect = 'mp-absorb';
  else if (passive && /10초마다.*(?:HP|MP)/.test(description)) effect = 'periodic-recovery';
  else if (passive && /피해.*감소|데미지.*감소/.test(description)) effect = 'damage-reduction';
  else if (passive && /명중률|회피율|이동속도/.test(description)) effect = 'stat-passive';

  const values = {};
  const mpCost = numberPair(description, /MP\s*([0-9,]+)(?:\s*→\s*([0-9,]+))?/i);
  const hpCost = numberPair(description, /HP\s*([0-9,]+)(?:\s*→\s*([0-9,]+))?/i);
  const percentages = [...description.matchAll(/([0-9.]+)%\s*→\s*([0-9.]+)%/g)]
    .map((match) => [Number(match[1]), Number(match[2])]);
  const fixedPercentage = description.match(/([0-9.]+)%/);
  const duration = numberPair(description, /([0-9,]+)\s*→\s*([0-9,]+)초/)
    ?? numberPair(description, /([0-9,]+)초간/);
  const cooldown = numberPair(description, /쿨타임\s*([0-9,]+)(?:초|분)\s*→\s*([0-9,]+)(?:초|분)/);
  if (mpCost != null) values.mpCost = mpCost;
  if (hpCost != null) {
    if (effect === 'summon' && /HP\s*[0-9,]+(?:\s*→\s*[0-9,]+)?인/.test(description)) {
      values.summonHp = hpCost;
    } else {
      values.hpCost = hpCost;
    }
  }
  if (duration != null) values.durationSeconds = duration;
  if (cooldown != null) values.cooldownSeconds = cooldown;
  if (/화살을 소비하지 않음|표창을 소비하지 않음/.test(description)) {
    values.noAmmoConsumption = 1;
  }
  if (effect.startsWith('damage')) {
    const skillAttack = numberPair(description, /스킬 공격력\s*([0-9,]+)\s*→\s*([0-9,]+)/);
    values.damagePercent = skillAttack || percentages[0] || Number(fixedPercentage?.[1]) || 100;
    const hits = description.match(/피해\s*([2-9])회|([2-9])회\s*(?:공격|타격)/);
    if (hits) values.hits = Number(hits[1] || hits[2]);
  } else {
    if (percentages[0]) values.primaryPercent = percentages[0];
  }
  if (effect === 'heal') {
    values.healPercent = percentages[0] || Number(fixedPercentage?.[1]) || 0;
    delete values.primaryPercent;
  }
  if (effect === 'mp-absorb') {
    values.mpAbsorbChance = percentages[0] || 0;
    values.mpAbsorbPercent = percentages[1] || 0;
    delete values.primaryPercent;
  }
  if (effect === 'weapon-mastery') {
    values.mastery = numberPair(description, /숙련도\s*([0-9.]+)%\s*→\s*([0-9.]+)%/) || 0;
    values.accuracyIncrease = numberPair(description, /명중률\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
  }
  if (effect === 'double-strike') {
    values.chance = percentages[0] || 0;
    values.damagePercent = percentages[1] || 100;
  }
  if (effect === 'critical-passive') {
    values.criticalChance = numberPair(
      description,
      /크리티컬 확률\s*([0-9.]+)%\s*→\s*([0-9.]+)%/
    ) || 0;
    values.criticalDamagePercent = numberPair(
      description,
      /크리티컬 (?:추가|최종) 피해\s*([0-9.]+)%\s*→\s*([0-9.]+)%/
    ) || 0;
    values.criticalDamagePercent = values.criticalDamagePercent || Number(
      description.match(/크리티컬 최종 피해\s*([0-9.]+)%/)?.[1]
    ) || 200;
  }
  if (effect === 'periodic-recovery') {
    values.periodicHpRestore = numberPair(description, /HP\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.periodicMpRestore = numberPair(description, /MP\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    if (/캐릭터 레벨\s*×\s*스킬 레벨\s*×\s*0\.1\s*\+\s*3/.test(description)) {
      values.periodicMpLevelSkillFactor = 0.1;
      values.periodicMpFlat = 3;
    }
    values.intervalSeconds = 10;
  }
  if (effect === 'damage-reduction') {
    values.reductionPercent = percentages[0] || Number(fixedPercentage?.[1]) || 0;
  }
  if (effect === 'stat-passive') {
    values.accuracyIncrease = numberPair(description, /명중률\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.evasionIncrease = numberPair(description, /회피율\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.movementSpeedIncrease = numberPair(description, /이동속도\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
  }
  if (!passive && effect === 'buff') {
    values.attackIncrease = numberPair(description, /공격력\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.defenseIncrease = numberPair(description, /방어력\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.accuracyIncrease = numberPair(description, /명중률(?:·회피율)?\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.evasionIncrease = /회피율/.test(description) ? values.accuracyIncrease : 0;
    values.movementSpeedIncrease = numberPair(description, /이동속도\s*([0-9.]+)\s*→\s*([0-9.]+)/) || 0;
    values.attackSpeedStage = Number(description.match(/공격속도\s*([1-9])단계/)?.[1]) || 0;
    values.damageReductionPercent = /(?:피해|데미지).*감소/.test(description)
      ? (percentages[0] || 0)
      : 0;
    values.criticalChance = numberPair(
      description,
      /크리티컬 확률\s*([0-9.]+)%\s*→\s*([0-9.]+)%/
    ) || 0;
    values.criticalDamagePercent = numberPair(
      description,
      /크리티컬 (?:추가|최종) 피해\s*([0-9.]+)%\s*→\s*([0-9.]+)%/
    ) || 0;
    const sharedDefenseIncrease = numberPair(
      description,
      /물리 방어력·마법 방어력\s*([0-9.]+)\s*→\s*([0-9.]+)/
    );
    if (sharedDefenseIncrease != null) {
      values.defenseIncrease = sharedDefenseIncrease;
      values.magicDefenseIncrease = sharedDefenseIncrease;
    }
    const sharedSupportIncrease = numberPair(
      description,
      /명중률·회피율·물리 방어력·마법 방어력\s*([0-9.]+)\s*→\s*([0-9.]+)/
    );
    if (sharedSupportIncrease != null) {
      values.accuracyIncrease = sharedSupportIncrease;
      values.evasionIncrease = sharedSupportIncrease;
      values.defenseIncrease = sharedSupportIncrease;
      values.magicDefenseIncrease = sharedSupportIncrease;
    }
    const experienceMultiplier = numberPair(
      description,
      /경험치 배율\s*([0-9.]+)%\s*→\s*([0-9.]+)%/
    );
    if (experienceMultiplier != null) {
      values.experienceBonusPercent = Array.isArray(experienceMultiplier)
        ? experienceMultiplier.map((value) => Math.max(0, value - 100))
        : Math.max(0, experienceMultiplier - 100);
    }
  }
  const maxTargets = Number(description.match(/최대\s*([0-9]+)명/)?.[1])
    || (isArea ? 6 : 1);
  const range = Number(clean(rangeText).match(/[0-9,]+/)?.[0]?.replaceAll(',', ''))
    || (isArea ? 320 : 100);
  const element = /불 속성/.test(description)
    ? 'fire'
    : /얼음 속성/.test(description)
      ? 'ice'
      : /번개 속성/.test(description)
        ? 'lightning'
        : /성 속성/.test(description)
          ? 'holy'
          : /독 속성/.test(description)
            ? 'poison'
            : 'neutral';
  const weaponTypes = /표창|아대/.test(description) ? ['claw']
    : /석궁/.test(description) ? ['crossbow']
    : /활 숙련도/.test(description) ? ['bow']
      : /아대 숙련도/.test(description) ? ['claw']
        : /단검 숙련도/.test(description) ? ['dagger']
          : undefined;
  const passiveOverride = PASSIVE_OVERRIDES[name] || null;
  const summonOverride = SUMMON_OVERRIDES[name] || null;
  if (summonOverride) effect = 'summon';
  return {
    id: makeId(name, departments, tier),
    name,
    description,
    tier,
    maxLevel,
    departments,
    passive: passiveOverride?.passive ?? passive,
    quest,
    prerequisites: [],
    element: summonOverride?.element || element,
    target: passive ? 'self' : (summonOverride ? 'self' : (isParty ? 'party' : (isArea ? 'enemies' : (isDamage ? 'enemy' : 'self')))),
    maxTargets: summonOverride?.maxTargets || maxTargets,
    range,
    effect: passiveOverride?.effect || effect,
    values: passiveOverride
      ? { ...values, ...passiveOverride.values }
      : { ...values, ...(summonOverride?.values || {}) },
    ...(summonOverride ? {
      summonRole: summonOverride.summonRole,
      summonIcon: summonOverride.summonIcon
    } : {}),
    ...((passiveOverride?.weaponTypes || weaponTypes)
      ? { weaponTypes: passiveOverride?.weaponTypes || weaponTypes }
      : {})
  };
}

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
const definitions = {};
let department = '';
let departments = [];
let tier = 0;
let tableHeader = [];

for (const line of lines) {
  if (line.startsWith('# ')) {
    department = clean(line.slice(2));
    departments = DEPARTMENT_IDS[department] ? [DEPARTMENT_IDS[department]] : [];
    tier = 0;
    continue;
  }
  if (line.startsWith('## ')) {
    const heading = clean(line.replace(/^##\s+(?:\d+\.\s*)?/, ''));
    const shared = Object.entries(ARCHETYPE_SHARED).find(([label]) => heading.includes(label));
    departments = shared ? shared[1] : (DEPARTMENT_IDS[department] ? [DEPARTMENT_IDS[department]] : []);
    if (heading.includes('전 직업 공통 4차')) departments = ALL_DEPARTMENTS;
    tier = Number(heading.match(/([1-4])차/)?.[1]) || (heading.includes('공통 4차') ? 4 : 0);
    tableHeader = [];
    continue;
  }
  if (!tier || !departments.length || !line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map(clean);
  if (!cells.length || cells.every((cell) => /^-+$/.test(cell))) continue;
  if (!tableHeader.length && cells.some((cell) => /스킬명|표기/.test(cell))) {
    tableHeader = cells;
    continue;
  }
  if (!tableHeader.length || cells.length < 4) continue;
  const marker = cells[0];
  const rawName = cells[1];
  const name = clean(rawName.replace(/\s*\([^)]*\)\s*$/, ''));
  const maxLevel = Number(cells[2]);
  if (!name || !maxLevel || /보류/.test(cells[2])) continue;
  const definition = inferDefinition({
    marker,
    name,
    tier,
    maxLevel,
    effectText: cells[3],
    rangeText: cells[4] || '',
    departments
  });
  definitions[definition.id] = definition;
}

for (const definition of Object.values(definitions)) {
  const requirement = definition.description.match(/필요:\s*([^0-9.]+?)\s*([0-9]+)(?:레벨)?(?:\.|\s|$)/);
  if (!requirement) continue;
  const requiredName = clean(requirement[1]);
  const prerequisite = Object.values(definitions).find((candidate) => (
    candidate.name === requiredName
    && candidate.tier <= definition.tier
    && candidate.departments.some((departmentId) => definition.departments.includes(departmentId))
  ));
  if (prerequisite) {
    definition.prerequisites = [{
      skillId: prerequisite.id,
      level: Number(requirement[2])
    }];
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(definitions, null, 2)}\n`, 'utf8');
console.log(`Generated ${Object.keys(definitions).length} V2 extended skills.`);
