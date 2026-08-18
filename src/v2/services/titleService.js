'use strict';

const TITLE_GRADES = Object.freeze({
  common: '일반',
  rare: '희귀',
  heroic: '영웅'
});

function allStats(amount) {
  return {
    grit: amount,
    processingSpeed: amount,
    workKnowledge: amount,
    awareness: amount
  };
}

const TITLE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'new_employee',
    name: '신입사원',
    grade: 'common',
    icon: '📛',
    stats: Object.freeze({ ...allStats(1), maxHp: 50, maxMp: 50 }),
    condition: '1차 전직 이상 달성',
    effectClass: 'employee-card',
    effectDescription: '연한 초록빛 사원증 테두리'
  }),
  Object.freeze({
    id: 'cat_butler',
    name: '고양이 집사',
    grade: 'rare',
    icon: '🐈',
    stats: Object.freeze({ ...allStats(3), evasion: 20 }),
    condition: '고양이 NPC의 일일 의뢰를 누적 30회 완료',
    effectClass: 'cat-paws',
    effectDescription: '분홍빛 발자국과 고양이 귀'
  }),
  Object.freeze({
    id: 'premium_character',
    name: '명품 인성',
    grade: 'rare',
    icon: '✨',
    stats: Object.freeze({ ...allStats(3), defense: 30, magicDefense: 30 }),
    condition: '자신보다 레벨이 15 이상 낮고 최근 2분 안에 몬스터를 처치한 캐릭터와 같은 맵에서 파티사냥 누적 12시간 달성',
    effectClass: 'golden-kindness',
    effectDescription: '따뜻한 금빛 후광과 반짝이는 별'
  }),
  Object.freeze({
    id: 'beast_heart',
    name: '야수의 심장',
    grade: 'heroic',
    icon: '🔥',
    stats: Object.freeze({ ...allStats(3), attack: 5, magic: 5, maxHp: 80 }),
    condition: '성공률 10% 주문서 사용에 누적 100회 실패',
    effectClass: 'beast-heart',
    effectDescription: '붉은 심장 박동과 타오르는 주문서 조각'
  }),
  Object.freeze({
    id: 'tycoon',
    name: '대부호',
    grade: 'heroic',
    icon: '🪙',
    stats: Object.freeze({ ...allStats(5), accuracy: 10, evasion: 10 }),
    condition: '누적 순수 획득 자산 10억 원 달성',
    effectClass: 'golden-tycoon',
    effectDescription: '금화가 흩날리는 황금빛 오라'
  }),
  Object.freeze({
    id: 'pure_blood',
    name: '순혈주의자',
    grade: 'rare',
    icon: '◆',
    stats: Object.freeze({ ...allStats(5), maxHp: 150, maxMp: 150 }),
    condition: '4차 전직 완료',
    effectClass: 'job-emblem',
    effectDescription: '직업군 색상의 문장과 은은한 오라'
  }),
  Object.freeze({
    id: 'mental_champion',
    name: '멘탈甲',
    grade: 'rare',
    icon: '🛡️',
    stats: Object.freeze({
      ...allStats(3), maxMp: 300, statusResistance: 5, magicDefense: 50
    }),
    condition: '부업 무기 제작에 1회 이상 실패',
    effectClass: 'mental-shield',
    effectDescription: '깨졌다가 복구되는 푸른 방패'
  }),
  Object.freeze({
    id: 'evasive_human',
    name: '회피형 인간',
    grade: 'heroic',
    icon: '💨',
    stats: Object.freeze({
      ...allStats(3), evasion: 35, movementSpeed: 5, jump: 5
    }),
    condition: '몬스터와 보스의 공격을 누적 10,000회 회피',
    effectClass: 'evasive-wind',
    effectDescription: '캐릭터 주변에 흐릿한 잔상과 바람 궤적'
  })
]);

const TITLE_BY_ID = new Map(TITLE_DEFINITIONS.map((title) => [title.id, title]));
const PREMIUM_CHARACTER_SECONDS = 12 * 60 * 60;
const PARTY_ACTIVITY_WINDOW_MS = 2 * 60 * 1000;

function markTitlesModified(character) {
  character?.markModified?.('titles');
}

function ensureTitleState(character) {
  if (!character.titles || typeof character.titles !== 'object') character.titles = {};
  const state = character.titles;
  if (!Array.isArray(state.ownedIds)) state.ownedIds = [];
  if (!Array.isArray(state.pendingAwardIds)) state.pendingAwardIds = [];
  if (!state.progress || typeof state.progress !== 'object') state.progress = {};
  if (typeof state.equippedId !== 'string') state.equippedId = '';
  if (!Number.isFinite(Number(state.progress.lifetimeEarnedMoney))) {
    state.progress.lifetimeEarnedMoney = Math.max(0, Number(character.economy?.money) || 0);
  }
  return state;
}

function serializeTitle(title) {
  if (!title) return null;
  return {
    id: title.id,
    name: title.name,
    grade: title.grade,
    gradeName: TITLE_GRADES[title.grade] || title.grade,
    icon: title.icon,
    stats: { ...title.stats },
    condition: title.condition,
    effectClass: title.effectClass,
    effectDescription: title.effectDescription
  };
}

function getTitleDefinition(titleId) {
  return TITLE_BY_ID.get(String(titleId || '')) || null;
}

function awardTitle(character, titleId) {
  const definition = getTitleDefinition(titleId);
  if (!definition) throw new Error('존재하지 않는 칭호입니다.');
  const state = ensureTitleState(character);
  if (state.ownedIds.includes(definition.id)) return null;
  state.ownedIds.push(definition.id);
  if (!state.pendingAwardIds.includes(definition.id)) {
    state.pendingAwardIds.push(definition.id);
  }
  markTitlesModified(character);
  return serializeTitle(definition);
}

function reconcileAdvancementTitles(character) {
  const tier = Math.max(0, Number(character.job?.advancementTier) || 0);
  const awarded = [];
  if (tier >= 1) {
    const title = awardTitle(character, 'new_employee');
    if (title) awarded.push(title);
  }
  if (tier >= 4) {
    const title = awardTitle(character, 'pure_blood');
    if (title) awarded.push(title);
  }
  return awarded;
}

function unlockProgressTitles(character) {
  const state = ensureTitleState(character);
  const progress = state.progress;
  const awarded = [];
  const checks = [
    ['cat_butler', Number(progress.catDailyCompletions) >= 30],
    ['premium_character', Number(progress.lowerLevelPartyHuntingSeconds) >= PREMIUM_CHARACTER_SECONDS],
    ['beast_heart', Number(progress.failedTenPercentScrolls) >= 100],
    ['tycoon', Number(progress.lifetimeEarnedMoney) >= 1_000_000_000],
    ['mental_champion', Number(progress.failedSideJobCrafts) >= 1],
    ['evasive_human', Number(progress.evadedAttacks) >= 10_000]
  ];
  for (const [titleId, unlocked] of checks) {
    if (!unlocked) continue;
    const title = awardTitle(character, titleId);
    if (title) awarded.push(title);
  }
  return awarded;
}

function recordTitleEvent(character, event = {}) {
  const state = ensureTitleState(character);
  const progress = state.progress;
  const amount = Math.max(0, Number(event.amount) || 0);
  let changed = false;
  switch (String(event.type || '')) {
    case 'cat-daily-complete':
      progress.catDailyCompletions = Math.max(0, Number(progress.catDailyCompletions) || 0) + Math.max(1, amount || 1);
      changed = true;
      break;
    case 'ten-percent-scroll-failure':
      progress.failedTenPercentScrolls = Math.max(0, Number(progress.failedTenPercentScrolls) || 0) + Math.max(1, amount || 1);
      changed = true;
      break;
    case 'side-job-craft-failure':
      progress.failedSideJobCrafts = Math.max(0, Number(progress.failedSideJobCrafts) || 0) + Math.max(1, amount || 1);
      changed = true;
      break;
    case 'evasion':
      progress.evadedAttacks = Math.max(0, Number(progress.evadedAttacks) || 0) + Math.max(1, amount || 1);
      changed = true;
      break;
    case 'money-earned':
      if (amount > 0) {
        progress.lifetimeEarnedMoney = Math.max(0, Number(progress.lifetimeEarnedMoney) || 0) + amount;
        changed = true;
      }
      break;
    case 'qualified-lower-level-party-hunting': {
      const now = Math.max(0, Number(event.now) || Date.now());
      const previous = Math.max(0, Number(progress.lowerLevelPartyHuntingLastAt) || 0);
      if (previous > 0 && now > previous && now - previous <= PARTY_ACTIVITY_WINDOW_MS) {
        progress.lowerLevelPartyHuntingSeconds = Math.max(
          0,
          Number(progress.lowerLevelPartyHuntingSeconds) || 0
        ) + Math.min(PARTY_ACTIVITY_WINDOW_MS, now - previous) / 1000;
      }
      progress.lowerLevelPartyHuntingLastAt = now;
      changed = true;
      break;
    }
    default:
      break;
  }
  if (changed) markTitlesModified(character);
  return unlockProgressTitles(character);
}

function equipTitle(character, titleId) {
  const definition = getTitleDefinition(titleId);
  const state = ensureTitleState(character);
  if (!definition || !state.ownedIds.includes(definition.id)) {
    throw new Error('획득하지 않은 칭호입니다.');
  }
  state.equippedId = definition.id;
  markTitlesModified(character);
  return serializeTitle(definition);
}

function unequipTitle(character) {
  const state = ensureTitleState(character);
  const previous = getTitleDefinition(state.equippedId);
  if (!previous) throw new Error('장착 중인 칭호가 없습니다.');
  state.equippedId = '';
  markTitlesModified(character);
  return serializeTitle(previous);
}

function acknowledgeTitleAward(character, titleId) {
  const state = ensureTitleState(character);
  const before = state.pendingAwardIds.length;
  state.pendingAwardIds = state.pendingAwardIds.filter((id) => id !== String(titleId || ''));
  if (state.pendingAwardIds.length !== before) markTitlesModified(character);
  return before !== state.pendingAwardIds.length;
}

function getEquippedTitle(character) {
  const state = ensureTitleState(character);
  return serializeTitle(getTitleDefinition(state.equippedId));
}

function serializeTitleState(character) {
  const state = ensureTitleState(character);
  const owned = state.ownedIds
    .map((titleId) => serializeTitle(getTitleDefinition(titleId)))
    .filter(Boolean);
  return {
    owned,
    equipped: serializeTitle(getTitleDefinition(state.equippedId)),
    pendingAwards: state.pendingAwardIds
      .map((titleId) => serializeTitle(getTitleDefinition(titleId)))
      .filter(Boolean)
  };
}

module.exports = {
  TITLE_DEFINITIONS,
  PREMIUM_CHARACTER_SECONDS,
  PARTY_ACTIVITY_WINDOW_MS,
  ensureTitleState,
  getTitleDefinition,
  getEquippedTitle,
  serializeTitleState,
  awardTitle,
  reconcileAdvancementTitles,
  recordTitleEvent,
  equipTitle,
  unequipTitle,
  acknowledgeTitleAward
};
