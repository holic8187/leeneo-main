'use strict';

const TIER_SP_REQUIREMENTS = Object.freeze({ 2: 61, 3: 121, 4: 151 });
const WARRIOR_DEPARTMENTS = Object.freeze(['hr', 'field_operations', 'quality']);
const ALL_DEPARTMENTS = Object.freeze([
  'unassigned',
  'hr',
  'accounting',
  'management_support',
  'sales',
  'marketing',
  'development',
  'field_operations',
  'facilities',
  'quality',
  'research'
]);
const EXTENDED_SKILL_DEFINITIONS = require('./extendedSkillDefinitions.generated.json');
const TELEPORT_SKILL_IDS = new Set([
  'extended_fc8e88e986',
  'extended_85efaaf08e',
  'extended_83750dd151'
]);
const FLASH_JUMP_SKILL_ID = 'extended_729f1a7cf5';
const MP_DAMAGE_GUARD_SKILL_ID = 'extended_51dd415210';
const STEALTH_SKILL_ID = 'extended_47fcdc0ba0';
const MONEY_DROP_BUFF_SKILL_ID = 'extended_51403b1515';
const EMPLOYEE_EMPOWERMENT_SKILL_ID = 'extended_e76286335c';
const WAKE_UP_SKILL_ID = 'extended_b067160f36';
const RESURRECTION_SKILL_ID = 'extended_76e11d2ec7';
const WORK_REDUCTION_SKILL_ID = 'extended_245ea8ab5c';
const GENESIS_SKILL_ID = 'extended_aef3d1db17';
const LARGE_AREA_SKILL_IDS = new Set([
  GENESIS_SKILL_ID,
  'extended_5620bb5a09',
  'extended_efc52e591a'
]);
const LARGE_AREA_MP_COSTS = Object.freeze({
  [GENESIS_SKILL_ID]: Object.freeze([
    ...Array(21).fill(5_500),
    5_450, 5_400, 5_350, 5_300, 5_250, 5_200, 5_150, 5_100, 5_000
  ]),
  extended_5620bb5a09: Object.freeze([
    ...Array(21).fill(5_000),
    4_950, 4_900, 4_850, 4_800, 4_750, 4_700, 4_650, 4_600, 4_500
  ]),
  extended_efc52e591a: Object.freeze([
    ...Array(21).fill(5_000),
    4_950, 4_900, 4_850, 4_800, 4_750, 4_700, 4_650, 4_600, 4_500
  ])
});
const LARGE_AREA_HORIZONTAL_RANGE = 540;
const LARGE_AREA_VERTICAL_RANGE = Math.round(LARGE_AREA_HORIZONTAL_RANGE * 0.85);
const ACCUMULATED_PIERCING_SKILL_ID = 'extended_cd94045605';
const ZERO_ERROR_SKILL_ID = 'extended_e9c47b999a';
const SIX_STEP_REPAIR_SKILL_ID = 'extended_de980f68ec';
const BIG_BANG_SKILL_IDS = new Set([
  'extended_b517ab1d69',
  'extended_2e29f80103',
  'extended_72b5477b43'
]);
const STORM_CHANNEL_SKILL_ID = 'extended_fc89f3cfc2';
const INFINITE_MP_SKILL_IDS = new Set([
  'extended_0dcef657e3',
  'extended_69705b66e7',
  'extended_4d105c3f1f'
]);
const TEN_MINUTE_COOLDOWN_SECONDS = 10 * 60;
const TEN_MINUTE_COOLDOWN_SKILL_NAMES = new Set([
  '집중 캠페인', '비상 연막', '무한 리소스', '무한 동력', '무한 예산', '복지 방패'
]);

function withTenMinuteCooldownDescription(description) {
  const source = String(description || '').trim();
  if (/쿨타임\s*[^,.]+/.test(source)) {
    return source.replace(/쿨타임\s*[^,.]+/, '쿨타임 10분');
  }
  return `${source}${source ? '. ' : ''}쿨타임 10분`;
}

const EXTENDED_RUNTIME_OVERRIDES_BY_NAME = Object.freeze({
  '재빠른 손놀림': { values: { accuracyIncrease: [1, 20] } },
  '반려 처리': {
    values: {
      targetCount: [2, 6], knockbackChance: [20, 70], knockbackDistancePx: 180
    }
  },
  '동결 계정': { values: { freezeSeconds: [1, 3] } },
  '결산 충격파': {
    values: { knockbackChance: 100, knockbackDistancePx: 260 }
  },
  '업무 방해': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 400,
    values: { enemyAttackReduction: [1, 20], enemyPhysicalDefenseReduction: [1, 20], durationSeconds: [7, 60] }
  },
  '에너지 드링크': {
    effect: 'damage', target: 'enemy', range: 360,
    values: { damagePercent: [20, 55], mastery: [15, 60] }
  },
  '이중 카페인': {
    effect: 'damage', target: 'enemy', range: 360,
    values: { damagePercent: [16, 40], mastery: [15, 60], hits: 2 }
  },
  '관통 결산': {
    effect: 'damage', target: 'enemies', maxTargets: 6, range: 600, piercing: true,
    values: { damagePercent: [70, 180], targetCount: 6, piercingDamageLossPercent: 5 }
  },
  '회계 무기 숙련': { values: { attackIncrease: [1, 10] } },
  '분식회계 적발': {
    effect: 'buff',
    values: {
      onHitAccuracyDebuffChance: [10, 40],
      onHitAccuracyDebuffPercent: 30,
      onHitDebuffSeconds: 15
    }
  },
  '집중 캠페인': {
    effect: 'buff',
    values: { mpCostReductionPercent: [5, 50], cooldownSeconds: TEN_MINUTE_COOLDOWN_SECONDS }
  },
  '경쟁사 발목잡기': {
    effect: 'buff',
    values: {
      onHitMovementSlowChance: [10, 40],
      onHitMovementSlowAmount: 60,
      onHitDebuffSeconds: 15
    }
  },
  '브랜드 밀어내기': {
    values: {
      targetCount: [2, 6], knockbackChance: [20, 70], knockbackDistancePx: 180
    }
  },
  '바이럴 폭발': {
    values: { stunChance: [20, 60], stunSeconds: [1, 4] }
  },
  '불타는 캠페인': {
    values: {
      dotChance: 100, dotDurationSeconds: 6, dotDamagePercentOfHit: 20,
      dotIntervalSeconds: 1, dotElement: 'fire', dotNonlethal: true
    }
  },
  '브랜드 파동': {
    values: { knockbackChance: 100, knockbackDistancePx: 260 }
  },
  '마케팅 무기 숙련': { values: { attackIncrease: [1, 10] } },
  '계약망': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: { bindChance: [20, 80], bindSeconds: [2, 8], targetCount: 6 }
  },
  '공개 경쟁입찰': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: {
      enemyDefenseIncreasePercent: 40,
      enemyExperienceIncreasePercent: [5, 40],
      enemyDropRateIncreasePercent: [5, 40],
      targetCount: 6,
      durationSeconds: 120
    }
  },
  '돈으로 설득': {
    effect: 'ignore-defense-damage', target: 'enemy',
    values: {
      moneyCost: [340, 800], damagePercent: 100,
      bonusDamageChance: 10, bonusFinalDamagePercent: 50
    }
  },
  '대형 명함 투척': { values: { ammunitionCost: 3 } },
  '명함 투척 숙련': { values: { throwingStarCapacityIncrease: [20, 400] } },
  '숨은 영업팀': {
    values: {
      dotDurationSeconds: [4, 12], dotDamagePercentOfHit: 100,
      dotIntervalSeconds: 1, dotNonlethal: true
    }
  },
  '계약금 회수': {
    effect: 'damage', target: 'enemy', maxTargets: 1, range: 180,
    values: { damagePercent: [80, 160], lifeStealPercent: [10, 45] }
  },
  '부품 회수': {
    values: { additionalMiscDropChance: [5, 40], additionalMiscDropOncePerMonster: true }
  },
  '고객 밀어내기': {
    values: { knockbackChance: [42, 100], knockbackDistancePx: [100, 300] }
  },
  '응급 정비': {
    target: 'self',
    description: '현재 HP가 50% 미만일 때 MP 10 → 27을 소모해 회복력 100% → 300%로 HP 회복. 사용 직후 1초간 받는 피해 100% → 70%',
    values: {
      useHpBelowPercent: 50,
      castDamageReductionPercent: [0, 30],
      castProtectionSeconds: 1
    }
  },
  '부품 낙하': {
    effect: 'buff', values: { componentDropChance: [10, 60] }
  },
  '수리비 처리': {
    effect: 'buff',
    values: { moneyGuardPercent: 50, moneyGuardEfficiencyPercent: [120, 78] }
  },
  '위험구역 표식': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 260,
    values: {
      enemyDefenseIncreasePercent: 40,
      enemyExperienceIncreasePercent: [5, 40],
      enemyDropRateIncreasePercent: [5, 40],
      targetCount: 6,
      durationSeconds: 120
    }
  },
  '부품 폭파': {
    effect: 'component-explosion', target: 'enemies', maxTargets: 6, range: 240,
    values: { componentCount: [3, 20], damagePercent: 100, targetCount: 6 }
  },
  '긴급 차단': {
    values: {
      preCastDelaySeconds: [4, 8], requiresStealth: true,
      finalHitCriticalChance: [32, 90], finalHitCriticalDamagePercent: [105, 250]
    }
  },
  '매복 정비반': {
    values: {
      dotDurationSeconds: [4, 12], dotDamagePercentOfHit: 100,
      dotIntervalSeconds: 1, dotNonlethal: true
    }
  },
  '비상 연막': {
    effect: 'smoke-zone', target: 'party', maxTargets: 6,
    values: {
      range: [110, 200], damageImmunity: 1,
      cooldownSeconds: TEN_MINUTE_COOLDOWN_SECONDS
    }
  },
  '왕복 점검': {
    maxTargets: 4,
    values: { targetCount: [2, 4], stunChance: [32, 90], stunSeconds: 2 }
  },
  '코드 리뷰': {
    effect: 'buff', values: { magicAttackIncrease: [1, 20] }
  },
  '성능 저하': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: { movementSpeedReduction: [5, 40], durationSeconds: 40, targetCount: 6 }
  },
  '악성 코드': {
    values: {
      mastery: [15, 60], dotChance: [20, 60], dotDurationSeconds: [10, 40],
      dotDamagePercentOfHit: 20, dotIntervalSeconds: 1, dotNonlethal: true
    }
  },
  '내결함성: 화염·독': {
    values: { damageReductionElements: ['fire', 'poison'] }
  },
  '버그 확산': {
    maxTargets: 6, range: 220,
    values: {
      mastery: [15, 60], targetCount: 6, dotChance: [20, 70],
      dotDurationSeconds: [10, 40], dotDamagePercentOfHit: 20,
      dotIntervalSeconds: 1, dotNonlethal: true
    }
  },
  '복합 오류': {
    elements: ['fire', 'poison'],
    values: {
      mastery: [15, 60], dotChance: [20, 70], dotDurationSeconds: 40,
      dotDamagePercentOfHit: 20, dotIntervalSeconds: 1, dotNonlethal: true
    }
  },
  '프로세스 봉쇄': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: { skillSealChance: [20, 95], skillSealSeconds: 20, targetCount: 6 }
  },
  '개발 가속': {
    effect: 'buff', values: { attackSpeedStage: [1, 2] }
  },
  '오류 반환': {
    effect: 'magic-reflect', target: 'self',
    values: {
      magicReflectChance: [31, 60], magicReflectPercent: [55, 200],
      magicReflectCapPercent: 20
    }
  },
  '레드팀 침투': {
    maxTargets: 6,
    values: {
      mastery: [15, 60], targetCount: [2, 6], dotDurationSeconds: [10, 15],
      dotDamagePercentOfHit: 20, dotIntervalSeconds: 1,
      temporaryWeaknessElement: 'ice', temporaryWeaknessMultiplier: 1.5
    }
  },
  '프로세스 정지': {
    values: { mastery: [15, 60], stunChance: 100, stunSeconds: [5, 15] }
  },
  '핫픽스': { values: { mastery: [15, 60] } },
  '서버 폭발': { values: { mastery: [15, 60] } },
  '공동 연구': {
    effect: 'buff', values: { magicAttackIncrease: [1, 20] }
  },
  '시간 지연': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: { movementSpeedReduction: [5, 40], durationSeconds: 40, targetCount: 6 }
  },
  '실험체 봉쇄': {
    effect: 'monster-debuff', target: 'enemies', maxTargets: 6, range: 420,
    values: { skillSealChance: [20, 95], skillSealSeconds: 20, targetCount: 6 }
  },
  '연산 가속': {
    effect: 'buff', values: { attackSpeedStage: [1, 2] }
  },
  '에너지 역류': {
    effect: 'magic-reflect', target: 'self',
    values: {
      magicReflectChance: [31, 60], magicReflectPercent: [55, 200],
      magicReflectCapPercent: 20
    }
  },
  '극저온 광선': { values: { mastery: [15, 60] } },
  '전자기 방전': { values: { mastery: [15, 60] } },
  '급속 냉각': { values: { mastery: [15, 60] } },
  '전류 창': { values: { mastery: [15, 60] } },
  '복합 실험': {
    element: 'ice', elements: ['ice', 'lightning'],
    values: { mastery: [15, 60], freezeSeconds: [1, 2] }
  },
  '극저온 표본': {
    maxTargets: 6,
    values: {
      mastery: [15, 60], targetCount: [2, 6], dotDurationSeconds: [10, 15],
      dotDamagePercentOfHit: 20, dotIntervalSeconds: 1,
      temporaryWeaknessElement: 'fire', temporaryWeaknessMultiplier: 1.5,
      disableIntrinsicFreeze: true
    }
  },
  '연쇄 방전': {
    maxTargets: 6,
    values: { mastery: [15, 60], targetCount: [2, 6], chainFromPrimaryTarget: true }
  },
  '절연·내한': {
    values: { damageReductionElements: ['ice', 'lightning'] }
  },
  '지원 요청': { values: { mastery: [15, 60] } },
  '지원의 빛': { values: { mastery: [15, 60] } },
  '민원 반송': {
    effect: 'magic-reflect', target: 'self',
    values: {
      magicReflectChance: [31, 60], magicReflectPercent: [55, 200],
      magicReflectCapPercent: 20
    }
  },
  '전략 지원선': {
    values: { mastery: [15, 60], pathPartyHealPercent: 20 }
  },
  '전사 내성 교육': {
    values: { damageReductionElements: ['fire', 'poison', 'ice', 'lightning', 'holy'] }
  },
  '산재 예방': {
    values: { physicalDamageReductionPercent: [2, 30], damageReductionPercent: 0 }
  },
  '고충 처리': {
    effect: 'party-cleanse-dispel', target: 'party', maxTargets: 6, range: 450,
    values: { dispelEnemyBuffChance: [10, 100] }
  },
  '복지 방패': {
    effect: 'buff', target: 'party',
    values: { statusImmunity: 1, cooldownSeconds: TEN_MINUTE_COOLDOWN_SECONDS }
  }
});

function applyExtendedRuntimeOverride(definition) {
  const override = EXTENDED_RUNTIME_OVERRIDES_BY_NAME[definition.name];
  if (!override) return definition;
  return {
    ...definition,
    ...override,
    description: TEN_MINUTE_COOLDOWN_SKILL_NAMES.has(definition.name)
      ? withTenMinuteCooldownDescription(override.description || definition.description)
      : (override.description || definition.description),
    values: {
      ...(definition.values || {}),
      ...(override.values || {})
    }
  };
}

function defineSkill(id, options) {
  return Object.freeze({
    id,
    passive: false,
    quest: false,
    prerequisites: [],
    element: 'neutral',
    target: 'self',
    maxTargets: 1,
    range: 100,
    ...options
  });
}

const SKILL_DEFINITIONS = Object.freeze({
  ...Object.fromEntries(Object.entries(EXTENDED_SKILL_DEFINITIONS).map(([id, definition]) => {
    if (id === EMPLOYEE_EMPOWERMENT_SKILL_ID) {
      return [id, {
        ...definition,
        departments: ALL_DEPARTMENTS,
        maxLevel: 20,
        values: {
          ...(definition.values || {}),
          durationSeconds: [30, 900],
          primaryPercent: [1, 15],
          allStatsPercent: [1, 15]
        }
      }];
    }
    if (id === STEALTH_SKILL_ID) {
      return [id, {
        ...definition,
        effect: 'buff',
        values: {
          ...(definition.values || {}),
          stealth: 1
        }
      }];
    }
    if (id === MP_DAMAGE_GUARD_SKILL_ID) {
      return [id, {
        ...definition,
        effect: 'buff',
        values: {
          ...(definition.values || {}),
          mpDamageGuardPercent: definition.values?.primaryPercent || [4, 80]
        }
      }];
    }
    if (id === MONEY_DROP_BUFF_SKILL_ID) {
      return [id, {
        ...definition,
        values: {
          ...(definition.values || {}),
          moneyDropIncreasePercent: definition.values?.primaryPercent || [5, 50]
        }
      }];
    }
    if (INFINITE_MP_SKILL_IDS.has(id)) {
      return [id, {
        ...definition,
        description: withTenMinuteCooldownDescription(definition.description),
        effect: 'buff',
        values: {
          ...(definition.values || {}),
          noMpCost: 1,
          cooldownSeconds: TEN_MINUTE_COOLDOWN_SECONDS
        }
      }];
    }
    if (id === WAKE_UP_SKILL_ID) {
      return [id, {
        ...definition,
        description: String(definition.description || '')
          .replace(/쿨타임\s*10분(?:\s*→\s*5분)?/g, '쿨타임 10분 → 5분'),
        departments: ALL_DEPARTMENTS,
        effect: 'cleanse-self',
        values: {
          ...(definition.values || {}),
          cooldownSeconds: [TEN_MINUTE_COOLDOWN_SECONDS, 5 * 60]
        }
      }];
    }
    if (id === RESURRECTION_SKILL_ID) {
      return [id, {
        ...definition,
        description: 'MP 40, 같은 맵에서 사망한 파티원 1명을 HP 50%, MP는 사망 당시 수치로 부활. 쿨타임 57분 → 10분',
        effect: 'resurrection',
        values: {
          ...(definition.values || {}),
          hpCost: 0,
          reviveHpPercent: 50,
          cooldownSeconds: [57 * 60, 10 * 60]
        }
      }];
    }
    if (id === WORK_REDUCTION_SKILL_ID) {
      return [id, {
        ...definition,
        effect: 'monster-transform',
        target: 'enemies',
        values: {
          ...(definition.values || {}),
          successChance: definition.values?.primaryPercent || [20, 90],
          enemyDamageReductionPercent: 50
        }
      }];
    }
    if (LARGE_AREA_SKILL_IDS.has(id)) {
      const mpCostByLevel = LARGE_AREA_MP_COSTS[id];
      const mpCostDescription = id === GENESIS_SKILL_ID
        ? 'MP 5,500(Lv.1~21) → 5,000(Lv.30)'
        : 'MP 5,000(Lv.1~21) → 4,500(Lv.30)';
      const description = String(definition.description || '')
        .replace(/^MP [\d,]+\s*→\s*[\d,]+/, mpCostDescription)
        .replace('최대 15명에게', '최대 12명에게');
      return [id, {
        ...definition,
        description,
        maxTargets: 12,
        range: LARGE_AREA_HORIZONTAL_RANGE,
        verticalFloorRange: 0,
        verticalRangePx: LARGE_AREA_VERTICAL_RANGE,
        values: {
          ...(definition.values || {}),
          mpCost: { byLevel: mpCostByLevel },
          range: LARGE_AREA_HORIZONTAL_RANGE,
          targetCount: 12,
          verticalFloorRange: 0,
          verticalRangePx: LARGE_AREA_VERTICAL_RANGE,
          postCastDelaySeconds: 3
        }
      }];
    }
    if (id === ACCUMULATED_PIERCING_SKILL_ID) {
      return [id, {
        ...definition,
        description: 'MP 18 → 33, 1초 충전 후 직선상의 최대 6명을 관통합니다. 첫 대상 250%, 관통마다 증가하여 마지막 대상 최대 850% 피해를 입힙니다.',
        effect: 'progressive-piercing-damage',
        target: 'enemies',
        maxTargets: 6,
        range: 650,
        piercing: true,
        values: {
          mpCost: [18, 33],
          damagePercent: 250,
          piercingStartPercent: 250,
          piercingEndPercent: 850,
          preCastDelaySeconds: 1,
          range: 650,
          targetCount: 6
        }
      }];
    }
    if (id === SIX_STEP_REPAIR_SKILL_ID) {
      return [id, {
        ...definition,
        description: 'MP 9 → 27, 단일 적에게 40% → 80% 피해를 6회 입힙니다.',
        values: {
          ...(definition.values || {}),
          hits: 6
        }
      }];
    }
    if (id === ZERO_ERROR_SKILL_ID) {
      return [id, {
        ...definition,
        description: 'MP 11, 일반 몬스터에게 199,999 피해를 입힙니다. 보스에게는 600% 피해를 입힙니다. 쿨타임 20초 → 5초.',
        values: {
          ...(definition.values || {}),
          instantKillNormalMonster: true
        }
      }];
    }
    if (BIG_BANG_SKILL_IDS.has(id)) {
      return [id, {
        ...definition,
        description: String(definition.description || '')
          .replace('최대 1초 충전', '1초 자동 충전')
          .replace('주변 최대 6명', '반경 150 이내 최대 3명')
          .replace('최대 3명에게 스킬 공격력', '최대 3명에게 각각 3회 스킬 공격력'),
        target: 'enemies',
        maxTargets: 3,
        range: 150,
        values: {
          ...(definition.values || {}),
          hits: 3,
          mastery: [35, 80],
          splitDamageAcrossHits: true,
          preCastDelaySeconds: 1,
          range: 150,
          targetCount: 3
        }
      }];
    }
    if (id === STORM_CHANNEL_SKILL_ID) {
      return [id, {
        ...definition,
        values: {
          ...(definition.values || {}),
          damagePercent: [66, 110],
          preCastDelaySeconds: 0,
          postCastDelaySeconds: 0
        }
      }];
    }
    if (id === FLASH_JUMP_SKILL_ID) {
      return [id, {
        ...definition,
        description: '공중에서 점프를 한 번 더 누르면 MP를 소모해 바라보는 방향으로 빠르게 도약합니다.',
        effect: 'flash-jump',
        target: 'self',
        range: 320,
        values: {
          ...(definition.values || {}),
          mpCost: [25, 13],
          distance: [120, 320],
          flashJumpCount: 1
        }
      }];
    }
    if (!TELEPORT_SKILL_IDS.has(id)) return [id, applyExtendedRuntimeOverride(definition)];
    return [id, {
      ...definition,
      effect: 'teleport',
      target: 'self',
      range: 150,
      values: {
        ...(definition.values || {}),
        mpCost: [30, 13],
        distance: [60, 150]
      }
    }];
  })),
  field_training: defineSkill('field_training', {
    name: '현장실습!',
    description: '정신력을 10 소모해 전방의 적 1인에게 고정 피해를 입힙니다.',
    tier: 0,
    maxLevel: 5,
    departments: ALL_DEPARTMENTS,
    target: 'enemy',
    range: 110,
    effect: 'fixed-damage',
    values: { mpCost: 10, fixedDamage: [10, 30] }
  }),
  outstanding_recovery: defineSkill('outstanding_recovery', {
    name: '뛰어난 회복력',
    description: '정신력을 10 소모해 자신의 체력을 즉시 회복합니다.',
    tier: 0,
    maxLevel: 5,
    departments: ALL_DEPARTMENTS,
    effect: 'heal',
    values: { mpCost: 10, heal: [20, 150], cooldownSeconds: 300, selfOnly: true }
  }),
  recovery_improvement: defineSkill('recovery_improvement', {
    name: '회복력 향상', tier: 1, maxLevel: 16, departments: WARRIOR_DEPARTMENTS,
    passive: true, effect: 'periodic-heal', values: { healPercent: [0.2, 2], intervalSeconds: 10 }
  }),
  hp_growth_improvement: defineSkill('hp_growth_improvement', {
    name: '체력증가량 향상', tier: 1, maxLevel: 10, departments: WARRIOR_DEPARTMENTS,
    passive: true, prerequisites: [{ skillId: 'recovery_improvement', level: 5 }],
    effect: 'hp-growth', values: { levelUpHp: [4, 40] }
  }),
  endure: defineSkill('endure', {
    name: '견디기', tier: 1, maxLevel: 8, departments: WARRIOR_DEPARTMENTS,
    passive: true, prerequisites: [{ skillId: 'hp_growth_improvement', level: 3 }],
    effect: 'idle-heal', values: { heal: 30, intervalSeconds: 5 }
  }),
  iron_body: defineSkill('iron_body', {
    name: '강철몸', tier: 1, maxLevel: 20, departments: WARRIOR_DEPARTMENTS,
    prerequisites: [{ skillId: 'endure', level: 3 }], effect: 'buff',
    values: { mpCost: 15, durationSeconds: 300, defenseIncrease: [3, 50] }
  }),
  power_strike: defineSkill('power_strike', {
    name: '강한 일격', tier: 1, maxLevel: 20, departments: WARRIOR_DEPARTMENTS,
    target: 'enemy', range: 120, effect: 'damage',
    values: { mpCost: [4, 12], damagePercent: [114, 260] }
  }),
  scratch: defineSkill('scratch', {
    name: '긁기', tier: 1, maxLevel: 20, departments: WARRIOR_DEPARTMENTS,
    prerequisites: [{ skillId: 'power_strike', level: 1 }],
    target: 'enemies', maxTargets: 6, range: 140, effect: 'damage',
    values: { mpCost: [8, 16], damagePercent: [57, 130] }
  }),

  sword_mastery: defineSkill('sword_mastery', {
    name: '소드 마스터리', tier: 2, maxLevel: 20, departments: ['hr', 'field_operations'], passive: true,
    effect: 'weapon-mastery', weaponTypes: ['oneHandedSword', 'twoHandedSword'],
    values: { mastery: [10, 60], accuracyIncrease: [1, 20] }
  }),
  axe_mastery: defineSkill('axe_mastery', {
    name: '엑스 마스터리', tier: 2, maxLevel: 20, departments: ['hr'], passive: true,
    effect: 'weapon-mastery',
    weaponTypes: ['oneHandedAxe', 'twoHandedAxe', 'oneHandedBlunt', 'twoHandedBlunt'],
    values: { mastery: [10, 70], accuracyIncrease: [1, 30] }
  }),
  double_strike_hr: defineSkill('double_strike_hr', {
    name: '두번치기', tier: 2, maxLevel: 30, departments: ['hr'], passive: true,
    effect: 'double-strike', values: { chance: [2, 60], damagePercent: [105, 250] }
  }),
  booster_hr: defineSkill('booster_hr', {
    name: '부스터', tier: 2, maxLevel: 20, departments: ['hr'],
    prerequisiteAny: [
      { skillId: 'sword_mastery', level: 5 },
      { skillId: 'axe_mastery', level: 5 }
    ],
    effect: 'buff', values: {
      hpCost: [50, 10], mpCost: [30, 10], durationSeconds: 200, attackSpeedStage: [1, 2]
    }
  }),
  rage: defineSkill('rage', {
    name: '분노', tier: 2, maxLevel: 20, departments: ['hr'], target: 'party', effect: 'buff',
    values: { mpCost: 20, durationSeconds: 160, attackIncrease: 10, defenseIncrease: -10 }
  }),
  shoulder_charge: defineSkill('shoulder_charge', {
    name: '어깨빵', tier: 2, maxLevel: 30, departments: ['hr', 'field_operations'],
    prerequisitesByDepartment: {
      hr: [{ skillId: 'rage', level: 3 }],
      field_operations: [{ skillId: 'booster_field', level: 3 }]
    },
    effect: 'contact-reflect',
    values: {
      mpCost: 30, durationSeconds: 200,
      reflectPercent: [2, 40], targetMaxHpCapPercent: 10
    }
  }),

  strong_mind: defineSkill('strong_mind', {
    name: '강한정신력', tier: 3, maxLevel: 20, departments: ['hr', 'field_operations'], passive: true,
    effect: 'periodic-mp', values: { mpRestore: [2, 30], intervalSeconds: 10 }
  }),
  shield_mastery: defineSkill('shield_mastery', {
    name: '방패 마스터리', tier: 3, maxLevel: 20, departments: ['hr', 'field_operations'], passive: true,
    effect: 'shield-mastery', values: { shieldDefensePercent: [7.5, 150] }
  }),
  combo_attack: defineSkill('combo_attack', {
    name: '콤보어택', tier: 3, maxLevel: 30, departments: ['hr'], effect: 'combo-buff',
    values: { mpCost: 35, durationSeconds: 200, maxCombo: 5, damagePerComboPercent: [1, 20] }
  }),
  panic: defineSkill('panic', {
    name: '패닉', tier: 3, maxLevel: 30, departments: ['hr'],
    prerequisites: [{ skillId: 'combo_attack', level: 1 }],
    target: 'enemy', effect: 'consume-combo-damage',
    values: { mpCost: 24, damagePercent: [100, 350], consumeAllCombo: true }
  }),
  coma: defineSkill('coma', {
    name: '콤마', tier: 3, maxLevel: 30, departments: ['hr'],
    prerequisites: [{ skillId: 'combo_attack', level: 1 }],
    target: 'enemies', maxTargets: 15, range: 300, effect: 'damage-stun',
    values: {
      hpCost: 30, mpCost: 30, damagePercent: [70, 200],
      stunChance: [30, 90], stunSeconds: 2, consumeCombo: 1
    }
  }),
  smash_buff: defineSkill('smash_buff', {
    name: '개박살', tier: 3, maxLevel: 20, departments: ['hr'],
    prerequisites: [{ skillId: 'shout', level: 3 }],
    target: 'enemy', range: 400, effect: 'monster-dispel',
    values: { successChance: [5, 100], dispelDefenseBuff: true }
  }),
  shout: defineSkill('shout', {
    name: '소리지르기', tier: 3, maxLevel: 30, departments: ['hr'],
    target: 'enemies', maxTargets: 15, range: 450, effect: 'damage-stun',
    values: { mpCost: 16, damagePercent: [20, 70], stunChance: [20, 95], stunSeconds: [1, 10] }
  }),

  come_here_hr: defineSkill('come_here_hr', {
    name: '이리와봐', tier: 4, maxLevel: 30, departments: ['hr', 'field_operations'],
    target: 'enemies', maxTargets: 6, range: 350, effect: 'pull',
    values: { mpCost: 30, successChance: [30, 100] }
  }),
  firm_will_hr: defineSkill('firm_will_hr', {
    name: '굳건한의지', tier: 4, maxLevel: 30, departments: ['hr', 'field_operations'], quest: true,
    effect: 'buff', values: { mpCost: [30, 50], durationSeconds: [10, 300], stanceChance: [42, 95] }
  }),
  upgraded_combo: defineSkill('upgraded_combo', {
    name: '업글 콤보', tier: 4, maxLevel: 30, departments: ['hr'],
    prerequisites: [{ skillId: 'combo_attack', level: 30 }], passive: true, effect: 'combo-upgrade',
    values: { maxCombo: [6, 10], doubleChargeChance: [2, 60] }
  }),
  sturdy_body_hr: defineSkill('sturdy_body_hr', {
    name: '굳건한신체', tier: 4, maxLevel: 30, departments: ['hr', 'field_operations'], passive: true,
    effect: 'damage-reduction', values: { reductionPercent: [0.5, 15] }
  }),
  blocked_it: defineSkill('blocked_it', {
    name: '막았죠?', tier: 4, maxLevel: 30, departments: ['hr', 'field_operations'], passive: true, quest: true,
    effect: 'shield-block', values: { blockChance: [0.5, 15], invincibleSeconds: 1 }
  }),
  charge_hr: defineSkill('charge_hr', {
    name: '돌진', tier: 4, maxLevel: 30, departments: ['hr', 'field_operations'], quest: true,
    target: 'enemies', maxTargets: 15, effect: 'charge',
    values: { distance: [300, 500], range: [300, 500], moveCasterToTarget: true, damagePercent: [72, 130] }
  }),
  double_attack: defineSkill('double_attack', {
    name: '더블어택', tier: 4, maxLevel: 30, departments: ['hr'],
    target: 'enemies', maxTargets: 3, range: 200, effect: 'multi-damage',
    values: { mpCost: [16, 25], damagePercent: [135, 260], hits: 2 }
  }),
  true_rage: defineSkill('true_rage', {
    name: '찐텐분노', tier: 4, maxLevel: 30, departments: ['hr'], quest: true,
    effect: 'buff', values: {
      mpCost: [11, 40], comboCost: 10, durationSeconds: [10, 240], attackIncrease: [11, 26]
    }
  }),

  mace_mastery: defineSkill('mace_mastery', {
    name: '메이스 마스터리', tier: 2, maxLevel: 20, departments: ['field_operations'],
    passive: true, effect: 'weapon-mastery',
    weaponTypes: ['oneHandedBlunt', 'twoHandedBlunt'],
    values: { mastery: [10, 70], accuracyIncrease: [1, 30] }
  }),
  double_strike_field: defineSkill('double_strike_field', {
    name: '두번치기', tier: 2, maxLevel: 30, departments: ['field_operations'],
    passive: true, effect: 'double-strike',
    values: { chance: [2, 60], damagePercent: [105, 250] }
  }),
  booster_field: defineSkill('booster_field', {
    name: '부스터', tier: 2, maxLevel: 20, departments: ['field_operations'],
    prerequisiteAny: [
      { skillId: 'sword_mastery', level: 5 },
      { skillId: 'mace_mastery', level: 5 }
    ],
    effect: 'buff',
    values: {
      hpCost: [50, 10], mpCost: [30, 10], durationSeconds: 200, attackSpeedStage: [1, 2]
    }
  }),
  war_cry: defineSkill('war_cry', {
    name: '고함', tier: 2, maxLevel: 20, departments: ['field_operations'],
    target: 'enemies', maxTargets: 15, range: 450, effect: 'debuff-self-buff',
    description: '자신 주변의 적에게 고함을 질러 받는 피해를 증가시키고 공격력과 명중률을 약화시킵니다.',
    values: {
      mpCost: [10, 25], successChance: [35, 70], durationSeconds: [15, 60],
      enemyDamageReductionPercent: [1, 10],
      enemyDamageTakenIncreasePercent: [1, 7],
      enemyAccuracyReductionPercent: [1, 10]
    }
  }),

  element_explosion: defineSkill('element_explosion', {
    name: '속성 폭발', tier: 3, maxLevel: 30, departments: ['field_operations'],
    target: 'enemies', maxTargets: 6, range: 300, effect: 'element-explosion',
    values: {
      hpCost: 25, mpCost: 26, damagePercent: 250, stunChance: 90, stunSeconds: 4
    }
  }),
  element_fire: defineSkill('element_fire', {
    name: '속성 부여: 불', tier: 3, maxLevel: 30, departments: ['field_operations'],
    effect: 'element-buff', element: 'fire',
    values: { mpCost: 35, durationSeconds: 200, damageIncreasePercent: 20 }
  }),
  element_ice: defineSkill('element_ice', {
    name: '속성 부여: 얼음', tier: 3, maxLevel: 30, departments: ['field_operations'],
    effect: 'element-buff', element: 'ice',
    values: {
      mpCost: 35, durationSeconds: 200, damageIncreasePercent: 10, freezeSeconds: 4
    }
  }),
  element_lightning: defineSkill('element_lightning', {
    name: '속성 부여: 번개', tier: 3, maxLevel: 30, departments: ['field_operations'],
    effect: 'element-buff', element: 'lightning',
    values: { mpCost: 35, durationSeconds: 200, damageIncreasePercent: 25 }
  }),
  element_enhancement: defineSkill('element_enhancement', {
    name: '속성 강화', tier: 3, maxLevel: 20, departments: ['field_operations'],
    passive: true, effect: 'element-enhancement',
    values: { elementDamageIncreasePercent: [0.5, 10] }
  }),

  element_holy: defineSkill('element_holy', {
    name: '속성 부여: 성', tier: 4, maxLevel: 20, departments: ['field_operations'],
    quest: true, effect: 'element-buff', element: 'holy',
    values: { mpCost: [100, 30], durationSeconds: [30, 300], damageIncreasePercent: [10, 55] }
  }),
  wall_break: defineSkill('wall_break', {
    name: '벽부수기', tier: 4, maxLevel: 30, departments: ['field_operations'],
    target: 'enemy', range: 130, effect: 'damage',
    values: { mpCost: [17, 24], damagePercent: [170, 580] }
  }),
  element_enhancement_2: defineSkill('element_enhancement_2', {
    name: '속성 강화2', tier: 4, maxLevel: 10, departments: ['field_operations'],
    passive: true, prerequisites: [{ skillId: 'element_explosion', level: 30 }],
    effect: 'element-explosion-upgrade',
    values: { damagePercent: [260, 350], preserveElementChance: [10, 100] }
  }),
  gombang: defineSkill('gombang', {
    name: '곰방', tier: 4, maxLevel: 30, departments: ['field_operations'],
    quest: true, target: 'enemies', maxTargets: 15, range: 400, effect: 'nonlethal-damage',
    values: {
      mpCost: [31, 60], damagePercent: [420, 900], cooldownSeconds: [310, 15]
    }
  }),

  spear_mastery: defineSkill('spear_mastery', {
    name: '스피어 마스터리', tier: 2, maxLevel: 20, departments: ['quality'], passive: true,
    effect: 'weapon-mastery', weaponTypes: ['spear'],
    values: { mastery: [10, 70], accuracyIncrease: [1, 30] }
  }),
  polearm_mastery: defineSkill('polearm_mastery', {
    name: '폴암 마스터리', tier: 2, maxLevel: 20, departments: ['quality'], passive: true,
    effect: 'weapon-mastery', weaponTypes: ['polearm'],
    values: { mastery: [10, 60], accuracyIncrease: [1, 20] }
  }),
  double_strike_quality: defineSkill('double_strike_quality', {
    name: '두번치기', tier: 2, maxLevel: 30, departments: ['quality'], passive: true,
    effect: 'double-strike', values: { chance: [2, 60], damagePercent: [105, 250] }
  }),
  booster_quality: defineSkill('booster_quality', {
    name: '부스터', tier: 2, maxLevel: 20, departments: ['quality'],
    prerequisiteAny: [
      { skillId: 'spear_mastery', level: 5 },
      { skillId: 'polearm_mastery', level: 5 }
    ],
    effect: 'buff', values: {
      hpCost: [50, 10], mpCost: [30, 10], durationSeconds: 200, attackSpeedStage: [1, 2]
    }
  }),
  iron_wall: defineSkill('iron_wall', {
    name: '철벽', tier: 2, maxLevel: 20, departments: ['quality'], target: 'party', effect: 'buff',
    values: { mpCost: 24, durationSeconds: 300, defenseIncrease: [2, 30] }
  }),
  quality_inspection: defineSkill('quality_inspection', {
    name: '품질검사', tier: 2, maxLevel: 30, departments: ['quality'],
    prerequisites: [{ skillId: 'iron_wall', level: 3 }], target: 'party', effect: 'buff',
    values: { mpCost: 50, durationSeconds: 155, maxResourcePercent: [2, 60] }
  }),

  pride: defineSkill('pride', {
    name: '자존심', tier: 3, maxLevel: 20, departments: ['quality'], passive: true,
    effect: 'damage-reduction', values: { reductionPercent: [0.5, 5] }
  }),
  quality_improvement: defineSkill('quality_improvement', {
    name: '품질개선', tier: 3, maxLevel: 30, departments: ['quality'],
    target: 'enemies', maxTargets: 3, range: 200, effect: 'multi-damage',
    values: {
      targetCount: [1, 3], mpCost: [10, 24], damagePercent: [55, 170], hits: [1, 3]
    }
  }),
  reprimand: defineSkill('reprimand', {
    name: '질타', tier: 3, maxLevel: 30, departments: ['quality'],
    target: 'enemies', maxTargets: 6, range: 250, effect: 'damage',
    values: { hpCost: [20, 30], mpCost: [10, 20], damagePercent: [80, 250] }
  }),
  sacrifice: defineSkill('sacrifice', {
    name: '희생', tier: 3, maxLevel: 30, departments: ['quality'],
    target: 'enemy', range: 200, effect: 'ignore-defense-damage',
    values: { mpCost: [12, 18], damagePercent: [205, 350], selfDamagePercent: [20, 5] }
  }),
  presentation: defineSkill('presentation', {
    name: '발표', tier: 3, maxLevel: 30, departments: ['quality'],
    target: 'enemies', maxTargets: 15, range: 1500, effect: 'damage-lock',
    values: {
      range: [1000, 1500], mpCost: [16, 30], maxHpCostPercent: [59, 30],
      damagePercent: [96, 240], actionLockSeconds: 2, minimumHpPercent: 50
    }
  }),
  criticism: defineSkill('criticism', {
    name: '비판', tier: 3, maxLevel: 20, departments: ['quality'],
    prerequisites: [{ skillId: 'bleeding_endurance', level: 3 }],
    target: 'enemy', range: 400, effect: 'monster-dispel',
    values: { successChance: [5, 100], dispelAttackBuff: true }
  }),
  bleeding_endurance: defineSkill('bleeding_endurance', {
    name: '출혈감수', tier: 3, maxLevel: 20, departments: ['quality'], effect: 'buff-drain',
    values: { mpCost: 24, durationSeconds: 160, attackIncrease: [1, 12], hpDrain: 20, intervalSeconds: 4 }
  }),

  come_here_quality: defineSkill('come_here_quality', {
    name: '이리와봐', tier: 4, maxLevel: 30, departments: ['quality'],
    target: 'enemies', maxTargets: 6, range: 350, effect: 'pull',
    values: { mpCost: 30, successChance: [30, 100] }
  }),
  firm_will_quality: defineSkill('firm_will_quality', {
    name: '굳건한의지', tier: 4, maxLevel: 30, departments: ['quality'], quest: true,
    effect: 'buff', values: { mpCost: [30, 50], durationSeconds: [10, 300], stanceChance: [42, 95] }
  }),
  charge_quality: defineSkill('charge_quality', {
    name: '돌진', tier: 4, maxLevel: 30, departments: ['quality'], quest: true,
    target: 'enemies', maxTargets: 15, effect: 'charge',
    values: { distance: [300, 500], range: [300, 500], moveCasterToTarget: true, damagePercent: [72, 130] }
  }),
  sturdy_body_quality: defineSkill('sturdy_body_quality', {
    name: '굳건한신체', tier: 4, maxLevel: 30, departments: ['quality'], passive: true,
    effect: 'damage-reduction', values: { reductionPercent: [0.5, 15] }
  }),
  firmness: defineSkill('firmness', {
    name: '단호함', tier: 4, maxLevel: 30, departments: ['quality'], passive: true, quest: true,
    effect: 'low-hp-damage', values: { hpThresholdPercent: [21, 50], damageIncreasePercent: [132, 200] }
  }),
  small_companion: defineSkill('small_companion', {
    name: '작은 동반자', tier: 4, maxLevel: 10, departments: ['quality'],
    effect: 'summon', values: {
      mpCost: [114, 60], durationSeconds: [660, 1200], masteryIncrease: [5, 20]
    }
  }),
  companion_heal: defineSkill('companion_heal', {
    name: '동반자: 회복', tier: 4, maxLevel: 25, departments: ['quality'], passive: true, quest: true,
    prerequisites: [{ skillId: 'small_companion', level: 1 }],
    effect: 'summon-heal', values: { intervalSeconds: [10, 4], heal: [40, 500] }
  }),
  companion_buff: defineSkill('companion_buff', {
    name: '동반자: 버프', tier: 4, maxLevel: 25, departments: ['quality'], passive: true, quest: true,
    prerequisites: [{ skillId: 'small_companion', level: 1 }],
    effect: 'summon-buff', values: {
      intervalSeconds: [60, 4], durationSeconds: [20, 100],
      defenseIncrease: 30, accuracyIncrease: 30, evasionIncrease: 30
    }
  })
});

module.exports = {
  TIER_SP_REQUIREMENTS,
  WARRIOR_DEPARTMENTS,
  SKILL_DEFINITIONS
};
