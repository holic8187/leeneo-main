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
  ...EXTENDED_SKILL_DEFINITIONS,
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
    values: { mpCost: 10, heal: [20, 150], cooldownSeconds: 300 }
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
    values: { mpCost: 30, reflectPercent: [2, 40], targetMaxHpCapPercent: 10 }
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
    values: { hpCost: 30, mpCost: 30, damagePercent: [70, 200], stunChance: [30, 90], consumeCombo: 1 }
  }),
  smash_buff: defineSkill('smash_buff', {
    name: '개박살', tier: 3, maxLevel: 20, departments: ['hr'],
    prerequisites: [{ skillId: 'shout', level: 3 }],
    target: 'enemy', range: 400, effect: 'dispel-defense',
    values: { successChance: [5, 100] }
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
    prerequisites: [{ skillId: 'combo_attack', level: 30 }], effect: 'combo-upgrade',
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
    values: { distance: [300, 500], damagePercent: [72, 130] }
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
    values: {
      mpCost: 25, successChance: 95, durationSeconds: 80,
      enemyDamageReductionPercent: 5, damageIncreasePercent: 5, accuracyIncrease: -10
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
    values: { mpCost: 30, durationSeconds: 300, damageIncreasePercent: 50 }
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
    target: 'enemy', range: 400, effect: 'dispel-attack',
    values: { successChance: [5, 100] }
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
    values: { distance: [300, 500], damagePercent: [72, 130] }
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
