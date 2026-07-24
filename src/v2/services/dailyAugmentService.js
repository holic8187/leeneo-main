'use strict';

const crypto = require('node:crypto');

const DAILY_AUGMENT_TIERS = Object.freeze(['silver', 'gold', 'prism']);

function defineAugment(id, tier, name, icon, description) {
  return Object.freeze({ id, tier, name, icon, description });
}

const DAILY_AUGMENTS = Object.freeze([
  defineAugment('punctual_arrival', 'silver', '정시 출근', '🕘', '일반 몬스터 추가 경험치 +0.5%'),
  defineAugment('chunsik_not_hyeji', 'silver', '춘식이 혜지 아니다', '🧃', '포션 회복량 +15%'),
  defineAugment('safety_helmet', 'silver', '안전모 착용', '⛑️', '받는 최종 피해 -3%'),
  defineAugment('fast_report', 'silver', '발 빠른 보고', '🏃', '이동속도 +5%, 넉백 거리 -20%'),
  defineAugment('overtime_knowhow', 'silver', '야근 요령', '🌙', '자동사냥시간 소모 속도 -2%'),
  defineAugment('equipment_appraiser', 'silver', '장비 감식안', '🔍', '드랍 장비의 최저 옵션 편차를 -5에서 -4로 보정'),
  defineAugment('last_train', 'silver', '막차타기', '🚇', 'HP 30% 이하에서 이동속도 +20%, 데미지 +10%'),
  defineAugment('vending_machine_change', 'silver', '자판기 잔돈', '🪙', '77번째 처치마다 해당 몬스터의 돈 보상 10배'),

  defineAugment('overachievement', 'gold', '초과 달성', '📈', '4초 안에 적 연속 처치 시 획득 경험치가 처치당 0.5%, 최대 2%까지 증가'),
  defineAugment('short_approval_line', 'gold', '결재선 단축', '✍️', '버프 지속시간 +10%, 버프 스킬 사용 MP 소모 -50%'),
  defineAugment('overwork_prevention', 'gold', '과로 방지 위원회', '🛟', '1회 죽음에 이르는 공격을 HP 1로 버티고 7초간 무적 상태 돌입'),
  defineAugment('performance_pressure', 'gold', '실적 압박', '📊', '최종 데미지 +10%, 받는 피해 +15%'),
  defineAugment('hoi_tax_invoice', 'gold', '호이의 세금계산서', '🧾', '주문서 실패 시 1회 한정 업그레이드 횟수 보존'),
  defineAugment('rooftop_pigeons', 'gold', '옥상의 비둘기떼', '🕊️', '단일 공격이 3% 확률로 뒤쪽 적에게 50% 피해로 전이'),
  defineAugment('office_politics', 'gold', '사내 정치', '🤝', '2인 이상 파티에서 경험치와 데미지 +1%'),
  defineAugment('overtime_pay', 'gold', '야근 수당', '💵', '18시~24시 몬스터 경험치와 돈 +1.5%'),

  defineAugment('copy_paste', 'prism', '복사·붙여넣기', '📋', '액티브 스킬이 15% 확률로 MP를 소모하지 않음'),
  defineAugment('flying_fingernail', 'prism', '튕겨나간 손톱', '💅', '단일 공격이 10% 확률로 뒤쪽 적 1명에게 75% 피해로 전이'),
  defineAugment('fragile_high_performer', 'prism', '유리 멘탈 고성과자', '🪞', '최종 데미지 +15%, 최대 HP -20%'),
  defineAugment('night_watch', 'prism', '불침번', '🕯️', '2회 한정, 사망 시 10초간 무적, 경험치 손실 없이 제자리에서 완전 부활'),
  defineAugment('automation_revolution', 'prism', '자동화 혁명', '🤖', '자동사냥 시 30분간 사냥시간을 소모하지 않음'),
  defineAugment('quality_assurance', 'prism', '품질 보증', '✅', '첫 3회의 장비 드랍에 장비 옵션 편차가 -2~+5로만 결정됨'),
  defineAugment('guma_celine', 'prism', '구마의 셀린느', '🌌', '액티브 스킬 30회마다 화면 내 적 전체에 공격력 또는 마력의 120% 피해 1회'),
  defineAugment('rayeon_delusion', 'prism', '라연이의 망상', '🦄', '100번째 처치마다 경험치 7배짜리 보너스 몬스터 출현')
]);

const DAILY_AUGMENT_BY_ID = new Map(DAILY_AUGMENTS.map((augment) => [augment.id, augment]));

function getKoreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function getKoreaHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hour12: false
  }).format(now)) % 24;
}

function getNextKoreaMidnight(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcAtKoreaMidnight = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + 1,
    -9,
    0,
    0,
    0
  );
  return new Date(utcAtKoreaMidnight);
}

function hashNumber(value) {
  const digest = crypto.createHash('sha256').update(String(value)).digest();
  return digest.readUInt32BE(0);
}

function getDailyAugmentTier(now = new Date()) {
  const dateKey = typeof now === 'string' ? now : getKoreaDateKey(now);
  return DAILY_AUGMENT_TIERS[hashNumber(`hoi-v2-augment-tier:${dateKey}`) % DAILY_AUGMENT_TIERS.length];
}

function getAugmentsForTier(tier) {
  return DAILY_AUGMENTS.filter((augment) => augment.tier === tier);
}

function orderedCandidateIds(tier, seed) {
  return getAugmentsForTier(tier)
    .map((augment) => ({
      id: augment.id,
      order: hashNumber(`${seed}:${augment.id}`)
    }))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((entry) => entry.id);
}

function rebuildOfferedIds(state, userSeed) {
  const simulatedOptions = orderedCandidateIds(
    state.tier,
    `${state.dateKey}:${userSeed}:initial`
  ).slice(0, 3);
  const offeredIds = new Set(simulatedOptions);
  for (const rawSlot of state.rerolledSlots || []) {
    const slot = Math.floor(Number(rawSlot));
    if (slot < 0 || slot > 2) continue;
    const visibleIds = new Set(simulatedOptions);
    const replacement = orderedCandidateIds(
      state.tier,
      `${state.dateKey}:${userSeed}:reroll:${slot}`
    ).find((id) => !visibleIds.has(id));
    if (!replacement) continue;
    simulatedOptions[slot] = replacement;
    offeredIds.add(replacement);
  }
  for (const id of state.options || []) offeredIds.add(id);
  return [...offeredIds];
}

function ensureDailyAugmentState(character, now = new Date()) {
  if (!character.dailyAugment || typeof character.dailyAugment !== 'object') {
    character.dailyAugment = {};
  }
  const dateKey = getKoreaDateKey(now);
  const userSeed = String(character.userId || character._id || character.displayName || 'user');
  const tier = getDailyAugmentTier(dateKey);
  const stale = String(character.dailyAugment.dateKey || '') !== dateKey
    || String(character.dailyAugment.tier || '') !== tier;
  if (stale) {
    const options = orderedCandidateIds(tier, `${dateKey}:${userSeed}:initial`).slice(0, 3);
    character.dailyAugment = {
      dateKey,
      tier,
      options,
      offeredIds: [...options],
      rerolledSlots: [],
      selectedId: '',
      selectedAt: null,
      counters: {}
    };
    if (typeof character.markModified === 'function') character.markModified('dailyAugment');
  } else {
    if (!Array.isArray(character.dailyAugment.options) || character.dailyAugment.options.length !== 3) {
      character.dailyAugment.options = orderedCandidateIds(
        tier,
        `${dateKey}:${userSeed}:repair`
      ).slice(0, 3);
    }
    if (!Array.isArray(character.dailyAugment.rerolledSlots)) {
      character.dailyAugment.rerolledSlots = [];
    }
    const offeredIds = Array.isArray(character.dailyAugment.offeredIds)
      && character.dailyAugment.offeredIds.length
      ? character.dailyAugment.offeredIds
      : rebuildOfferedIds(character.dailyAugment, userSeed);
    character.dailyAugment.offeredIds = [...new Set([
      ...offeredIds,
      ...character.dailyAugment.options
    ])];
    if (!character.dailyAugment.counters || typeof character.dailyAugment.counters !== 'object') {
      character.dailyAugment.counters = {};
    }
  }
  return character.dailyAugment;
}

function initializeCounters(augmentId) {
  const counters = {
    killCount: 0,
    activeSkillUses: 0,
    consecutiveKills: 0,
    lastKillAt: 0
  };
  if (augmentId === 'overwork_prevention') counters.lethalGuardRemaining = 1;
  if (augmentId === 'hoi_tax_invoice') counters.scrollPreserveRemaining = 1;
  if (augmentId === 'night_watch') counters.reviveRemaining = 2;
  if (augmentId === 'automation_revolution') counters.freeHuntingSeconds = 30 * 60;
  if (augmentId === 'quality_assurance') counters.qualityDropsRemaining = 3;
  return counters;
}

function selectDailyAugment(character, augmentId, now = new Date()) {
  const state = ensureDailyAugmentState(character, now);
  if (state.selectedId) throw new Error('오늘의 증강은 이미 선택했습니다.');
  const selectedId = String(augmentId || '');
  if (!state.options.includes(selectedId)) throw new Error('현재 후보에 없는 증강입니다.');
  state.selectedId = selectedId;
  state.selectedAt = new Date(now);
  state.counters = initializeCounters(selectedId);
  if (typeof character.markModified === 'function') character.markModified('dailyAugment');
  return state;
}

function rerollDailyAugment(character, slot, now = new Date()) {
  const state = ensureDailyAugmentState(character, now);
  if (state.selectedId) throw new Error('증강을 선택한 뒤에는 리롤할 수 없습니다.');
  const slotIndex = Math.floor(Number(slot));
  if (slotIndex < 0 || slotIndex > 2) throw new Error('리롤할 증강 위치가 올바르지 않습니다.');
  if (state.rerolledSlots.includes(slotIndex)) throw new Error('이 선택지는 이미 리롤했습니다.');
  const userSeed = String(character.userId || character._id || character.displayName || 'user');
  const used = new Set([
    ...(Array.isArray(state.offeredIds) ? state.offeredIds : []),
    ...state.options
  ]);
  const candidates = orderedCandidateIds(
    state.tier,
    `${state.dateKey}:${userSeed}:reroll:${slotIndex}`
  ).filter((id) => !used.has(id));
  if (!candidates.length) throw new Error('교체할 수 있는 증강이 없습니다.');
  state.options[slotIndex] = candidates[0];
  state.offeredIds = [...used, candidates[0]];
  state.rerolledSlots.push(slotIndex);
  if (typeof character.markModified === 'function') character.markModified('dailyAugment');
  return state;
}

function getSelectedDailyAugment(character, now = new Date()) {
  const state = character?.dailyAugment;
  if (!state || String(state.dateKey || '') !== getKoreaDateKey(now)) return null;
  return DAILY_AUGMENT_BY_ID.get(String(state.selectedId || '')) || null;
}

function hasDailyAugment(character, augmentId, now = new Date()) {
  return getSelectedDailyAugment(character, now)?.id === augmentId;
}

function updateDailyAugmentCounters(character, updater) {
  if (!character?.dailyAugment || typeof updater !== 'function') return false;
  if (!character.dailyAugment.counters || typeof character.dailyAugment.counters !== 'object') {
    character.dailyAugment.counters = {};
  }
  const before = JSON.stringify(character.dailyAugment.counters);
  updater(character.dailyAugment.counters);
  const changed = before !== JSON.stringify(character.dailyAugment.counters);
  if (changed && typeof character.markModified === 'function') character.markModified('dailyAugment');
  return changed;
}

function consumeDailyAugmentCounter(character, key, amount = 1) {
  let consumed = false;
  updateDailyAugmentCounters(character, (counters) => {
    const current = Math.max(0, Number(counters[key]) || 0);
    const use = Math.min(current, Math.max(0, Number(amount) || 0));
    if (use <= 0) return;
    counters[key] = current - use;
    consumed = true;
  });
  return consumed;
}

function getDailyAugmentEffects(character, context = {}, now = new Date()) {
  const selected = getSelectedDailyAugment(character, now);
  const effects = {
    normalMonsterExpPercent: 0,
    potionRecoveryPercent: 0,
    damageReductionPercent: 0,
    movementSpeedIncrease: 0,
    knockbackReductionPercent: 0,
    huntingTimeReductionPercent: 0,
    equipmentRollMinimum: -5,
    lowHpThresholdPercent: 0,
    lowHpDamageIncreasePercent: 0,
    lowHpMovementIncrease: 0,
    buffDurationPercent: 0,
    buffMpReductionPercent: 0,
    damageIncreasePercent: 0,
    damageTakenIncreasePercent: 0,
    partyExpPercent: 0,
    partyDamagePercent: 0,
    monsterExpPercent: 0,
    moneyPercent: 0,
    noMpCostChance: 0,
    maxHpReductionPercent: 0,
    chainChance: 0,
    chainDamagePercent: 0
  };
  if (!selected) return effects;
  switch (selected.id) {
    case 'punctual_arrival': effects.normalMonsterExpPercent = 0.5; break;
    case 'chunsik_not_hyeji': effects.potionRecoveryPercent = 15; break;
    case 'safety_helmet': effects.damageReductionPercent = 3; break;
    case 'fast_report':
      effects.movementSpeedIncrease = 5;
      effects.knockbackReductionPercent = 20;
      break;
    case 'overtime_knowhow': effects.huntingTimeReductionPercent = 2; break;
    case 'equipment_appraiser': effects.equipmentRollMinimum = -4; break;
    case 'last_train':
      effects.lowHpThresholdPercent = 30;
      effects.lowHpMovementIncrease = 20;
      effects.lowHpDamageIncreasePercent = 10;
      break;
    case 'short_approval_line':
      effects.buffDurationPercent = 10;
      effects.buffMpReductionPercent = 50;
      break;
    case 'performance_pressure':
      effects.damageIncreasePercent = 10;
      effects.damageTakenIncreasePercent = 15;
      break;
    case 'rooftop_pigeons':
      effects.chainChance = 3;
      effects.chainDamagePercent = 50;
      break;
    case 'office_politics':
      if (Number(context.partySize) >= 2) {
        effects.partyExpPercent = 1;
        effects.partyDamagePercent = 1;
      }
      break;
    case 'overtime_pay': {
      const hour = getKoreaHour(now);
      if (hour >= 18 && hour < 24) {
        effects.monsterExpPercent = 1.5;
        effects.moneyPercent = 1.5;
      }
      break;
    }
    case 'copy_paste': effects.noMpCostChance = 15; break;
    case 'flying_fingernail':
      effects.chainChance = 10;
      effects.chainDamagePercent = 75;
      break;
    case 'fragile_high_performer':
      effects.damageIncreasePercent = 15;
      effects.maxHpReductionPercent = 20;
      break;
    default:
      break;
  }
  const hpPercent = Number(context.hpPercent);
  if (
    selected.id === 'last_train'
    && Number.isFinite(hpPercent)
    && hpPercent <= effects.lowHpThresholdPercent
  ) {
    effects.movementSpeedIncrease += effects.lowHpMovementIncrease;
    effects.damageIncreasePercent += effects.lowHpDamageIncreasePercent;
  }
  return effects;
}

function getCounterDisplay(state, augmentId) {
  const counters = state?.counters || {};
  if (augmentId === 'overwork_prevention') return Number(counters.lethalGuardRemaining) || 0;
  if (augmentId === 'hoi_tax_invoice') return Number(counters.scrollPreserveRemaining) || 0;
  if (augmentId === 'night_watch') return Number(counters.reviveRemaining) || 0;
  if (augmentId === 'quality_assurance') return Number(counters.qualityDropsRemaining) || 0;
  if (augmentId === 'automation_revolution') {
    return Math.ceil(Math.max(0, Number(counters.freeHuntingSeconds) || 0) / 60);
  }
  if (augmentId === 'overachievement') return Math.max(0, Number(counters.consecutiveKills) || 0);
  if (augmentId === 'vending_machine_change') {
    const remainder = Math.max(0, Number(counters.killCount) || 0) % 77;
    return remainder === 0 ? 77 : 77 - remainder;
  }
  if (augmentId === 'guma_celine') {
    const remainder = Math.max(0, Number(counters.activeSkillUses) || 0) % 30;
    return remainder === 0 ? 30 : 30 - remainder;
  }
  if (augmentId === 'rayeon_delusion') {
    const remainder = Math.max(0, Number(counters.killCount) || 0) % 100;
    return remainder === 0 ? 100 : 100 - remainder;
  }
  return null;
}

function isConsumedAugment(state, augmentId) {
  const counters = state?.counters || {};
  if (augmentId === 'overwork_prevention') return Number(counters.lethalGuardRemaining) <= 0;
  if (augmentId === 'hoi_tax_invoice') return Number(counters.scrollPreserveRemaining) <= 0;
  if (augmentId === 'night_watch') return Number(counters.reviveRemaining) <= 0;
  if (augmentId === 'quality_assurance') return Number(counters.qualityDropsRemaining) <= 0;
  if (augmentId === 'automation_revolution') return Number(counters.freeHuntingSeconds) <= 0;
  return false;
}

function serializeDailyAugment(character, now = new Date()) {
  const state = ensureDailyAugmentState(character, now);
  const selected = DAILY_AUGMENT_BY_ID.get(String(state.selectedId || '')) || null;
  const expiresAt = getNextKoreaMidnight(now).getTime();
  return {
    dateKey: state.dateKey,
    tier: state.tier,
    options: state.options.map((id, slot) => ({
      ...DAILY_AUGMENT_BY_ID.get(id),
      slot,
      rerolled: state.rerolledSlots.includes(slot)
    })),
    selected: selected ? {
      ...selected,
      selectedAt: state.selectedAt ? new Date(state.selectedAt).getTime() : 0,
      expiresAt,
      remaining: getCounterDisplay(state, selected.id)
    } : null,
    selectionRequired: !selected,
    expiresAt
  };
}

function buildDailyAugmentBuff(character, now = new Date()) {
  const view = serializeDailyAugment(character, now);
  if (!view.selected) return null;
  if (isConsumedAugment(character.dailyAugment, view.selected.id)) return null;
  const createdAt = Number(view.selected.selectedAt) || new Date(now).getTime();
  return {
    skillId: `daily_augment:${view.selected.id}`,
    name: view.selected.name,
    description: view.selected.description,
    icon: view.selected.icon,
    effects: {},
    count: Number.isFinite(Number(view.selected.remaining)) ? Number(view.selected.remaining) : undefined,
    metadata: {
      tier: view.selected.tier,
      remaining: view.selected.remaining,
      dailyAugment: true
    },
    createdAt,
    expiresAt: view.expiresAt,
    durationMs: Math.max(1, view.expiresAt - createdAt),
    dailyAugment: true
  };
}

module.exports = {
  DAILY_AUGMENT_TIERS,
  DAILY_AUGMENTS,
  DAILY_AUGMENT_BY_ID,
  getKoreaDateKey,
  getKoreaHour,
  getNextKoreaMidnight,
  getDailyAugmentTier,
  getAugmentsForTier,
  ensureDailyAugmentState,
  selectDailyAugment,
  rerollDailyAugment,
  getSelectedDailyAugment,
  hasDailyAugment,
  getDailyAugmentEffects,
  updateDailyAugmentCounters,
  consumeDailyAugmentCounter,
  serializeDailyAugment,
  buildDailyAugmentBuff
};
