import { CARD_SKILL_BY_ID, cardSkillAtEnhancement, skillMagnitude } from '../data/cardSkills.js';

export const CARD_MAX_HP = 100;
export const BREAK_GAUGE_MAX = 100;
export const PLAYER_TURN_SECONDS = 20;
export const RAID_MAX_ROUNDS = 7;
export const RAID_SQUAD_SIZE = 4;

const DIRECT_ATTACKS = Object.freeze({
  'nanche-c':[95,1,18], 'mango-c':[115,1,0], 'shanghai-c':[100,1,16], 'sseubi-c':[110,1,0],
  'gyullak-c':[35,3,12], 'peach-c':[90,1,0], 'choonsik-c':[120,1,0], 'coca-c':[45,3,0], 'hoi-c':[100,1,10],
  'mond-u':[120,1,22], 'somfist-u':[145,1,0], 'guma-u':[45,3,0],
  'winter-r':[140,1,32], 'kkamdung-r':[180,1,0], 'rayeon-r':[145,1,0], 'mango-r':[175,1,0],
  'morae-r':[145,1,35], 'shanghai-r':[190,1,0], 'chuming-r':[155,1,0], 'pie-r':[105,1,0], 'hoi-r':[180,1,0],
  'somfist-rr':[170,1,40], 'winter-sr':[100,1,25], 'rayeon-sr':[260,1,0],
  'shanghai-sr':[240,1,25], 'hoi-sr':[220,1,20], 'mango-hr':[260,1,35],
  'coca-rr':[90,2,24], 'coca-hr':[95,3,35], 'coca-ur':[190,1,15], 'coca-ssr':[210,1,20],
  'rookie-analyst':[100,1,10], 'sales-fox':[110,1,0], 'hwang-manager':[180,1,0],
  'kim-manager':[250,1,25], 'deadline-dragon':[220,1,30],
});

const HEALS = Object.freeze({
  'winter-c':[['ally',12]], 'meongpeu-c':[['lowest',9]], 'wollu-c':[['self',15]],
  'pie-c':[['ally',10]], 'hoi-c':[['lowest',4]], 'gyullak-u':[['all',8],['lowest',6]],
  'peach-u':[['ally',14]], 'hoi-u':[['all',8]], 'mango-rr':[['all',16]],
  'hoi-rr':[['ally',25]], 'winter-rrr':[['all',18]],
  'coca-sr':[['all',18]],
  'pantry-cat':[['all',10]],
});

const SHIELDS = Object.freeze({
  'kkamdung-c':[['self',12]], 'morae-c':[['lowest',11]], 'eungga-c':[['all',5],['lowest',5]],
  'choonsik-c':[['self',5]], 'winter-u':[['ally',16]], 'nanche-u':[['all',9]],
  'mango-u':[['all',10]], 'sseubi-u':[['all',10]], 'rayeon-r':[['all',8]],
  'mond-r':[['all',14]], 'guma-r':[['all',16]], 'winter-rr':[['self',30]],
  'coca-rrr':[['all',15]],
  'peach-sentry':[['all',12]], 'gammam-neo':[['self',20]],
});

const clone = (value) => structuredClone(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const alive = (card) => card.hp > 0;
const magnitude = (value, member, scale = member?.skillScale ?? 1) => skillMagnitude(value, member.enhancement) * scale;
const log = (state, type, message, data = {}) => state.log.push({ index: state.log.length, type, message, ...data });
const NON_COPYABLE_SKILLS = new Set(['hoi-rrr', 'hoi-ssr']);

function normalizedMember(raw, index) {
  const cardId = String(raw.cardId || raw.id || '');
  const enhancement = clamp(Math.floor(Number(raw.enhancement) || 0), 0, 5);
  // Callers pass the same enhanced combat power that is displayed in deck
  // building. Treating it as a base value here would apply enhancement twice.
  const combatPower = Math.max(1, Math.round(Number(raw.attack ?? raw.power ?? raw.combatPower) || 1));
  return {
    id: String(raw.instanceId || `${cardId}:${index + 1}`), cardId, name: raw.name || cardId,
    image: raw.image || '', order: index + 1, enhancement,
    attack: combatPower,
    maxHp: Math.max(1, Number(raw.maxHp) || CARD_MAX_HP),
    hp: Math.max(1, Number(raw.maxHp) || CARD_MAX_HP),
    shield: 0, cooldown: 0, statuses: [], skillUses: 0, defeated: false,
  };
}

function normalizedBossSkill(raw = {}) {
  const targetAliases = {
    'random-living-card': 'random',
    'random-two-living-cards': 'random',
    'all-living-cards': 'all',
    'highest-power-living-card': 'highest-power',
  };
  const target = targetAliases[raw.target] || raw.target || 'random';
  const status = raw.status
    ? [{
      id: raw.status.id,
      name: raw.status.name || raw.status.id,
      value: raw.status.percent ?? raw.status.damage ?? raw.status.value ?? 0,
      duration: raw.status.turns ?? raw.status.duration ?? 1,
      dotDamage: raw.status.damage ?? 0,
    }]
    : [];
  return {
    ...clone(raw),
    target,
    targetCount: raw.target === 'random-two-living-cards' ? 2 : (raw.targetCount ?? raw.targets ?? 1),
    cooldown: Math.max(1, Number(raw.cooldown ?? raw.cooldownTurns) || 3),
    statusEffects: Array.isArray(raw.statusEffects)
      ? clone(raw.statusEffects)
      : Array.isArray(raw.statuses) ? clone(raw.statuses) : status,
    selfShieldPercent: Math.max(0, Number(raw.selfShieldPercent ?? raw.shieldPercentOfStageHp) || 0),
    selfBuff: raw.selfBuff || raw.buff || null,
  };
}

function normalizedBoss(raw = {}) {
  const maxHp = Math.max(1, Math.round(Number(raw.maxHp) || Number(raw.hp) || 100000));
  const currentHp = clamp(Math.round(Number(raw.currentHp ?? raw.hp ?? maxHp) || maxHp), 0, maxHp);
  return {
    id: String(raw.id || 'deadline-dragon'), name: raw.name || '마감기한 드래곤', image: raw.image || '',
    stage: Math.max(1, Math.floor(Number(raw.stage) || 1)), maxHp, hp: currentHp, shield: Math.max(0, Number(raw.shield) || 0),
    baseDamage: Math.max(1, Number(raw.baseDamage ?? raw.basicAttackDamage ?? raw.basicAttack?.damage) || (9 + Math.max(1, Number(raw.stage) || 1))),
    breakGauge: 0, breakMax: BREAK_GAUGE_MAX, stunned: false, stunReleaseAtPlayerAction: 0,
    statuses: [], cooldowns: {}, skillUses: {}, skills: Array.isArray(raw.skills) ? raw.skills.map(normalizedBossSkill) : [], stageConfig: clone(raw),
  };
}

export function createRaidBattle({ cards = [], boss = {}, stageConfig = null, seed = 1, now = Date.now() } = {}) {
  if (cards.length !== RAID_SQUAD_SIZE) throw new Error(`개인 레이드에는 카드 ${RAID_SQUAD_SIZE}장이 필요합니다.`);
  const ids = cards.map((card) => String(card.cardId || card.id || ''));
  if (new Set(ids).size !== ids.length) throw new Error('같은 종류의 카드는 한 덱에 함께 편성할 수 없습니다.');
  if (ids.some((id) => !CARD_SKILL_BY_ID[id])) throw new Error('고유 스킬이 없는 카드가 편성되어 있습니다.');
  return {
    version: 1, status: 'ready', createdAt: now, startedAt: null, finishedAt: null,
    stage: Math.max(1, Math.floor(Number((stageConfig || boss)?.stage) || 1)),
    maxRounds: RAID_MAX_ROUNDS, terminationReason: null,
    round: 0, sequenceIndex: 0, currentActor: null, currentActorIndex: null,
    playerActionCount: 0, turnStartedAt: null, turnDeadlineAt: null,
    cards: cards.map(normalizedMember), boss: normalizedBoss(stageConfig || boss),
    seed: (Number(seed) >>> 0) || 1, totalDamage: 0, lastCopyableSkill: null,
    teamStatuses: [], log: [], result: null,
  };
}

export function startRaidBattle(input, now = Date.now()) {
  const state = clone(input);
  if (state.status !== 'ready') return state;
  state.status = 'active'; state.startedAt = now; state.round = 1;
  setActor(state, 'card', 0, now);
  log(state, 'battle-start', `${state.boss.name} 전투를 시작했습니다.`);
  return state;
}

function setActor(state, type, index, now = Date.now()) {
  state.currentActor = type;
  state.currentActorIndex = type === 'card' ? index : null;
  state.turnStartedAt = now;
  state.turnDeadlineAt = type === 'card' ? now + PLAYER_TURN_SECONDS * 1000 : null;
}

function nextRandom(state) {
  let x = state.seed >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.seed = x >>> 0; return state.seed / 0x100000000;
}

function statusValue(entity, id) {
  return (entity.statuses || []).filter((status) => status.id === id).reduce((sum, status) => sum + Number(status.value || 0), 0);
}

function activeStatuses(entity, id) {
  return (entity?.statuses || []).filter((status) => status.id === id && statusIsActive(status));
}

function damageRemainingMultiplier(statuses) {
  return statuses.reduce((remaining, status) => (
    remaining * (1 - clamp(Number(status?.value) || 0, 0, 100) / 100)
  ), 1);
}

function statusIsActive(status) {
  if (!status) return false;
  return (status.duration == null || Number(status.duration) > 0)
    && (status.charges == null || Number(status.charges) > 0);
}

function addStatus(entity, status) {
  const normalized = { kind: 'buff', duration: null, charges: null, ...status };
  const old = entity.statuses.find((item) => item.id === normalized.id && item.sourceId === normalized.sourceId);
  if (old) Object.assign(old, normalized);
  else entity.statuses.push(normalized);
}

function removeExpired(entity) {
  entity.statuses = (entity.statuses || []).filter((status) => status.duration == null || status.duration > 0)
    .filter((status) => status.charges == null || status.charges > 0);
}

function tickRound(state) {
  state.round += 1;
  for (const card of state.cards) {
    card.cooldown = Math.max(0, card.cooldown - 1);
    for (const status of card.statuses) if (status.duration != null) status.duration -= 1;
    removeExpired(card);
  }
  for (const status of state.boss.statuses) if (status.duration != null) status.duration -= 1;
  for (const status of state.teamStatuses) if (status.duration != null) status.duration -= 1;
  Object.keys(state.boss.cooldowns).forEach((key) => { state.boss.cooldowns[key] = Math.max(0, state.boss.cooldowns[key] - 1); });
  removeExpired(state.boss);
  state.teamStatuses = state.teamStatuses.filter((status) => status.duration == null || status.duration > 0)
    .filter((status) => status.charges == null || status.charges > 0);
}

function checkBattleEnd(state, now = Date.now()) {
  if (state.boss.hp <= 0) {
    state.status = 'finished'; state.result = 'victory'; state.terminationReason = 'boss-defeated'; state.finishedAt = now;
  } else if (!state.cards.some(alive)) {
    state.status = 'finished'; state.result = 'defeat'; state.terminationReason = 'party-defeated'; state.finishedAt = now;
  }
  if (state.status === 'finished') { state.currentActor = null; state.currentActorIndex = null; state.turnDeadlineAt = null; }
  return state.status === 'finished';
}

function advance(state, now = Date.now()) {
  if (checkBattleEnd(state, now)) return;
  if (state.currentActor === 'card') {
    setActor(state, 'boss', null, now);
    return;
  }
  advanceToNextLivingCard(state, now);
}

function finishAtRoundLimit(state, now) {
  state.status = 'finished';
  state.result = 'turn-limit';
  state.terminationReason = 'round-limit';
  state.finishedAt = now;
  state.currentActor = null;
  state.currentActorIndex = null;
  state.turnDeadlineAt = null;
  log(state, 'battle-end', `${state.maxRounds || RAID_MAX_ROUNDS}턴이 지나 전투가 종료되었습니다.`, { totalDamage: state.totalDamage });
}

function advanceToNextLivingCard(state, now = Date.now()) {
  if (checkBattleEnd(state, now)) return;
  const previous = Math.max(0, Number(state.sequenceIndex) || 0);
  let next = -1;
  let wrapped = false;
  for (let step = 1; step <= state.cards.length; step += 1) {
    const candidate = (previous + step) % state.cards.length;
    if (!alive(state.cards[candidate])) {
      log(state, 'skip', `${state.cards[candidate].name}은(는) 행동불능이라 차례를 건너뜁니다.`, { actorId: state.cards[candidate].id });
      continue;
    }
    next = candidate;
    wrapped = previous + step >= state.cards.length;
    break;
  }
  if (next < 0) {
    checkBattleEnd(state, now);
    return;
  }
  // A round is one complete pass over every squad slot. Defeated slots are
  // skipped without creating a matching boss action.
  if (wrapped && state.round >= (state.maxRounds || RAID_MAX_ROUNDS)) {
    finishAtRoundLimit(state, now);
    return;
  }
  state.sequenceIndex = next;
  if (wrapped) tickRound(state);
  setActor(state, 'card', next, now);
}

function targetsFor(state, actor, mode, targetId) {
  const living = state.cards.filter(alive);
  if (mode === 'self') return [actor];
  if (mode === 'all') return living;
  if (mode === 'lowest') return [living.toSorted((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0]].filter(Boolean);
  const requested = living.find((card) => card.id === targetId || card.cardId === targetId);
  if (mode === 'ally') {
    return [requested || living.toSorted((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || actor];
  }
  return [requested || actor];
}

function heal(state, targets, percent, actor, scale = 1, { scaleMagnitude = true } = {}) {
  for (const target of targets) {
    const boost = 1 + (statusValue(target, 'healing-taken-up') + statusValue(actor, 'effect-up')) / 100;
    const magnitudeValue = scaleMagnitude ? magnitude(percent, actor, scale) : Math.max(0, Number(percent) || 0);
    const amount = Math.max(1, Math.round(target.maxHp * magnitudeValue / 100 * boost));
    const applied = Math.min(target.maxHp - target.hp, amount); target.hp += applied;
    log(state, 'heal', `${target.name}의 HP가 ${applied} 회복되었습니다.`, { sourceId: actor.id, targetId: target.id, amount: applied });
  }
}

function shield(state, targets, percent, actor, scale = 1, { scaleMagnitude = true } = {}) {
  for (const target of targets) {
    const boost = 1 + statusValue(actor, 'effect-up') / 100;
    const magnitudeValue = scaleMagnitude ? magnitude(percent, actor, scale) : Math.max(0, Number(percent) || 0);
    const amount = Math.max(1, Math.round(target.maxHp * magnitudeValue / 100 * boost));
    target.shield += amount;
    log(state, 'shield', `${target.name}에게 보호막 ${amount}이 생겼습니다.`, { sourceId: actor.id, targetId: target.id, amount });
  }
}

function reduceCooldown(targets, amount = 1) { for (const target of targets) target.cooldown = Math.max(0, target.cooldown - amount); }
function cleanse(targets, count = 1) {
  for (const target of targets) {
    let left = count === Infinity ? Number.MAX_SAFE_INTEGER : count;
    target.statuses = target.statuses.filter((status) => status.kind !== 'debuff' || left-- <= 0);
  }
}

function applyBreak(state, actor, base, scale = 1) {
  if (!base) return false;
  const flat = statusValue(actor, 'break-up') + statusValue(state.boss, 'break-taken-flat');
  const rate = 1 + statusValue(state.boss, 'break-taken-up') / 100;
  const effectBoost = 1 + statusValue(actor, 'effect-up') / 100;
  const amount = Math.max(0, Math.round((magnitude(base, actor, scale) * effectBoost + flat) * rate));
  state.boss.breakGauge += amount;
  log(state, 'break', `브레이크 게이지가 ${amount} 올랐습니다.`, { sourceId: actor.id, amount });
  if (state.boss.breakGauge < state.boss.breakMax) return false;
  state.boss.breakGauge = 0; state.boss.stunned = true;
  // The boss stays stunned through the breaker card's next action, then wakes
  // before the following card. This scales with the current squad size.
  state.boss.stunReleaseAtPlayerAction = state.playerActionCount + state.cards.length + 2;
  addStatus(state.boss, { id: 'break-stun', name: '브레이크 스턴', kind: 'debuff', sourceId: actor.id });
  log(state, 'break-stun', `${state.boss.name}이(가) 브레이크되어 스턴에 빠졌습니다.`, { sourceId: actor.id });
  return true;
}

function damageBoss(state, actor, multiplier, hits = 1, breakDamage = 0, scale = 1, options = {}) {
  // Once lethal damage has landed, no queued follow-up may create a zero-
  // damage hit, extra break, or another combat animation on the defeated boss.
  if (state.boss.hp <= 0) return false;
  let conditional = 1;
  if (options.selfHpAbove && actor.hp / actor.maxHp >= options.selfHpAbove) conditional *= options.bonus || 1;
  if (options.bossHpAbove && state.boss.hp / state.boss.maxHp >= options.bossHpAbove) conditional *= options.bonus || 1;
  if (options.bossDebuffed && state.boss.statuses.some((s) => s.kind === 'debuff')) conditional *= options.bonus || 1;
  if (options.bossShielded && state.boss.shield > 0) conditional *= options.bonus || 1;
  if (options.bossStunned && state.boss.stunned) conditional *= options.bonus || 1;
  if (options.breakAtMost != null && state.boss.breakGauge <= options.breakAtMost) conditional *= options.bonus || 1;
  const outgoing = Math.max(0, 1 + (
    statusValue(actor, 'attack-up')
    + statusValue(actor, 'damage-up')
    + (options.skill ? statusValue(actor, 'skill-damage-up') : 0)
    + (options.skill ? statusValue(actor, 'effect-up') : 0)
    - statusValue(actor, 'damage-down')
  ) / 100);
  const incoming = 1 + statusValue(state.boss, 'damage-taken-up') / 100;
  const scaledMultiplier = options.scaleMagnitude === false
    ? Math.max(0, Number(multiplier) || 0) * scale
    : magnitude(multiplier, actor, scale);
  const flatBonus = Math.max(0, Number(options.flatBonus) || 0);
  const total = Math.max(1, Math.round(actor.attack * scaledMultiplier / 100 * hits * conditional * outgoing * incoming + flatBonus));
  const shieldDamage = Math.min(state.boss.shield, total); state.boss.shield -= shieldDamage;
  const applied = Math.min(state.boss.hp, total - shieldDamage); state.boss.hp -= applied; state.totalDamage += applied;
  log(state, options.counter ? 'counter' : 'damage', `${actor.name}이(가) ${applied} 피해를 입혔습니다.`, { sourceId: actor.id, targetId: state.boss.id, amount: applied, hits });
  const broken = applyBreak(state, actor, breakDamage, scale);
  if (state.boss.hp <= 0) return broken;
  const seeds = activeStatuses(state.boss, 'peach-seed');
  if (seeds.length && !options.secondary && !options.seed && !options.prism) {
    for (const seed of seeds) {
      seed.charges -= 1;
      damageBoss(state, actor, seed.value, 1, 0, 1, { seed: true, secondary: true, scaleMagnitude: false });
    }
    removeExpired(state.boss);
  }
  const stars = state.teamStatuses.filter((status) => status.id === 'star-follow-up' && statusIsActive(status));
  if (stars.length && !options.secondary && !options.followUp && !options.prism) {
    for (const star of stars) {
      star.charges -= 1;
      damageBoss(state, actor, star.value, 1, star.break || 0, 1, { followUp: true, secondary: true, scaleMagnitude: false });
    }
    state.teamStatuses = state.teamStatuses.filter((s) => s.charges == null || s.charges > 0);
  }
  const seals = activeStatuses(state.boss, 'tiger-seal');
  if (seals.length && !options.secondary && !options.seal && !options.prism) {
    for (const seal of seals) {
      seal.attackers ||= [];
      if (!seal.attackers.includes(actor.id)) seal.attackers.push(actor.id);
      if (seal.attackers.length >= 3) {
        state.boss.statuses = state.boss.statuses.filter((status) => status !== seal);
        damageBoss(state, actor, seal.value, 1, seal.break || 0, 1, { seal: true, secondary: true, scaleMagnitude: false });
        addBossStatus(state, actor, 'attack-down', '봉인 공격 약화', 25, null, 1);
      }
    }
  }
  resolvePrismTorrents(state, actor, applied, options);
  return broken;
}

function resolvePrismTorrents(state, actor, appliedDamage, options = {}) {
  if (state.boss.hp <= 0 || appliedDamage <= 0 || options.secondary || options.prism || options.followUp || options.counter || options.seed || options.seal) return;
  const torrents = state.teamStatuses.filter((status) => status.id === 'prism-torrent' && statusIsActive(status));
  for (const torrent of torrents) {
    torrent.contributors ||= [];
    if (torrent.contributors.includes(actor.id)) continue;
    torrent.contributors.push(actor.id);
    const captured = Math.max(0, Math.round(appliedDamage * clamp(Number(torrent.captureRate) || 0, 0, 100) / 100));
    torrent.storedDamage = Math.max(0, Number(torrent.storedDamage) || 0) + captured;
    torrent.charges -= 1;
    log(state, 'prism-charge', `프리즘 급류가 ${captured} 피해를 저장했습니다.`, {
      sourceId: torrent.sourceId, contributorId: actor.id, amount: captured, storedDamage: torrent.storedDamage,
    });
    if (torrent.charges > 0) continue;
    const source = {
      id: torrent.sourceId,
      cardId: torrent.sourceCardId,
      name: torrent.sourceName,
      attack: torrent.sourceAttack,
      enhancement: torrent.sourceEnhancement,
      hp: 1,
      maxHp: 1,
      statuses: [],
    };
    damageBoss(state, source, torrent.finisher, 1, torrent.break, 1, {
      skill: true,
      prism: true,
      secondary: true,
      scaleMagnitude: false,
      flatBonus: torrent.storedDamage,
    });
    log(state, 'prism-burst', `저장한 피해 ${torrent.storedDamage}을 더해 성하 프리즘 급류가 폭발했습니다.`, {
      sourceId: torrent.sourceId, storedDamage: torrent.storedDamage,
    });
  }
  state.teamStatuses = state.teamStatuses.filter((status) => status.charges == null || status.charges > 0);
}

function addCardStatus(targets, actor, id, name, value, duration, kind = 'buff', charges = null) {
  for (const target of targets) addStatus(target, { id, name, value: magnitude(value, actor), duration, kind, charges, sourceId: actor.id });
}
function addBossStatus(state, actor, id, name, value, duration, charges = null) {
  addStatus(state.boss, { id, name, value: magnitude(value, actor), duration, kind: 'debuff', charges, sourceId: actor.id });
}

function commonEffects(state, actor, skill, targetId, scale) {
  const spec = DIRECT_ATTACKS[actor.cardId]; let broken = false;
  if (spec) {
    const options = { skill: true };
    if (actor.cardId === 'mango-c') Object.assign(options, { selfHpAbove: .7, bonus: 1.2 });
    if (actor.cardId === 'somfist-u') Object.assign(options, { bossShielded: true, bonus: 1.3 });
    if (actor.cardId === 'kkamdung-r') Object.assign(options, { bossDebuffed: true, bonus: 1.25 });
    if (actor.cardId === 'mango-r') Object.assign(options, { bossHpAbove: .5, bonus: 1.5 });
    if (actor.cardId === 'shanghai-r') Object.assign(options, { bossStunned: true, bonus: 1.45 });
    if (actor.cardId === 'shanghai-sr') Object.assign(options, { breakAtMost: 50, bonus: 1.8 });
    broken = damageBoss(state, actor, ...spec, scale, options);
  }
  for (const [mode, percent] of HEALS[actor.cardId] || []) heal(state, targetsFor(state, actor, mode, targetId), percent, actor, scale);
  for (const [mode, percent] of SHIELDS[actor.cardId] || []) shield(state, targetsFor(state, actor, mode, targetId), percent, actor, scale);
  return broken;
}

function specialEffects(state, actor, targetId, choice, scale, broken) {
  const ally = targetsFor(state, actor, 'ally', targetId), all = targetsFor(state, actor, 'all'), low = targetsFor(state, actor, 'lowest');
  switch (actor.cardId) {
    case 'simsim-c': addBossStatus(state,actor,'attack-down','공격력 감소',10,2); addBossStatus(state,actor,'break-taken-flat','브레이크 취약',4,2); break;
    case 'winter-c': addCardStatus(ally,actor,'damage-reduction','피해 감소',10,1); break;
    case 'kkamdung-c': addCardStatus([actor],actor,'taunt','도발',0,null,'buff',1); break;
    case 'rayeon-c': addCardStatus(ally,actor,'damage-up','피해량 증가',12,2); addCardStatus(ally,actor,'break-up','다음 공격 브레이크',6,null,'buff',1); break;
    case 'morae-c': addCardStatus(low,actor,'debuff-resist','약화 저항',20,2); break;
    case 'mond-c': reduceCooldown(ally); addCardStatus(ally,actor,'effect-up','다음 효과 강화',8,null,'buff',1); break;
    case 'somfist-c': addCardStatus(ally,actor,'guarded-by','폭신한 가드',50,2); addCardStatus([actor],actor,'guarding','대신 막기',20,2); break;
    case 'meongpeu-c': cleanse(low,1); break;
    case 'sseubi-c': addBossStatus(state,actor,'attack-down','공격력 감소',8,2); break;
    case 'guma-c': cleanse(ally,1); addCardStatus(ally,actor,'debuff-block','약화 차단',0,null,'buff',1); break;
    case 'wollu-c': addCardStatus([actor],actor,'damage-reduction','피해 감소',15,2); break;
    case 'easy-c': addBossStatus(state,actor,'attack-down','공격력 감소',8,2); addBossStatus(state,actor,'accuracy-down','명중률 감소',8,2); break;
    case 'peach-c': addBossStatus(state,actor,'peach-seed','복숭아 씨앗',45,null,1); break;
    case 'jandi-c': state.teamStatuses.push({id:'regen','name':'지속 회복',kind:'buff',value:magnitude(3,actor,scale),duration:3,sourceId:actor.id}); break;
    case 'chuming-c': addCardStatus(all,actor,'attack-up','공격력 증가',8,2); addCardStatus(all,actor,'break-up','브레이크 증가',4,2); break;
    case 'coca-c': addCardStatus([actor],actor,'quick','행동 가속',10,null,'buff',1); break;
    case 'pie-c': addCardStatus(ally,actor,'attack-up','공격력 증가',10,2); break;
    case 'winter-u': addCardStatus(ally,actor,'damage-reduction','피해 감소',12,2); break;
    case 'kkamdung-u': addBossStatus(state,actor,'damage-taken-up','받는 피해 증가',12,2); addCardStatus(all,actor,'evasion','회피율 증가',12,1); break;
    case 'nanche-u': addCardStatus(all,actor,'break-reduction','브레이크 피해 감소',20,2); break;
    case 'rayeon-u': reduceCooldown(all); addCardStatus(all,actor,'healing-taken-up','받는 회복 증가',12,2); break;
    case 'mango-u': addCardStatus(all,actor,'dot-reduction','지속 피해 감소',30,2); break;
    case 'morae-u': cleanse(all,1); addCardStatus(all,actor,'evasion','회피율 증가',10,2); break;
    case 'mond-u': addBossStatus(state,actor,'break-taken-flat','브레이크 취약',5,2); break;
    case 'shanghai-u': addCardStatus([actor],actor,'taunt','도발',0,null,'buff',1); addCardStatus([actor],actor,'damage-reduction','피해 감소',30,null,'buff',1); addCardStatus([actor],actor,'counter','반격',75,null,'buff',1); break;
    case 'sseubi-u': addCardStatus(all,actor,'debuff-resist','약화 저항',25,2); break;
    case 'guma-u': addBossStatus(state,actor,'attack-down','공격력 감소',10,2); break;
    case 'easy-u': addCardStatus(all,actor,'skill-damage-up','스킬 피해 증가',13,2); addCardStatus(all,actor,'basic-bonus','다음 기본 공격 강화',40,null,'buff',1); break;
    case 'peach-u': { const before=ally[0].statuses.filter(s=>s.kind==='debuff').length; cleanse(ally,Infinity); if(!before) heal(state,ally,4,actor,scale); break; }
    case 'choonsik-u': addCardStatus(all,actor,'damage-reduction','피해 감소',14,2); addCardStatus(all,actor,'emergency-shield','위기 보호막',6,2); break;
    case 'hoi-u': addCardStatus(all,actor,'damage-up','피해량 증가',8,2); addCardStatus(all,actor,'healing-taken-up','회복량 증가',8,2); break;
    case 'winter-r': if (broken) addBossStatus(state,actor,'freeze','빙결',0,1); break;
    case 'rayeon-r': break;
    case 'morae-r': addBossStatus(state,actor,'break-taken-flat','브레이크 취약',7,2); break;
    case 'mond-r': addCardStatus(all,actor,'shield-break-heal','보호막 파괴 회복',5,3); break;
    case 'guma-r': cleanse(all,1); break;
    case 'chuming-r': addCardStatus(all,actor,'attack-up','공격력 증가',14,2); break;
    case 'coca-r': addCardStatus(all,actor,'damage-up','피해량 증가',12,2); addCardStatus(all,actor,'evasion','회피율 증가',12,2); applyBreak(state,actor,8,scale); break;
    case 'pie-r': addBossStatus(state,actor,'attack-down','공격력 감소',12,2); addBossStatus(state,actor,'healing-down','회복량 감소',12,2); break;
    case 'hoi-r': state.teamStatuses.push({id:'star-follow-up',name:'별빛 추가 피해',kind:'buff',value:magnitude(25,actor,scale),break:0,charges:2,sourceId:actor.id}); break;
    case 'winter-rr': addCardStatus([actor],actor,'taunt','도발',0,null,'buff',2); addCardStatus(all,actor,'damage-reduction','수정왕관 보호',15,2); break;
    case 'rayeon-rr': state.teamStatuses.push({id:'foresight',name:'호수의 예지',kind:'buff',value:magnitude(50,actor,scale),successBoost:magnitude(30,actor,scale),charges:1,sourceId:actor.id}); break;
    case 'mango-rr': state.teamStatuses.push({id:'golden-fruit',name:'황금 열매',kind:'buff',value:magnitude(6,actor,scale),charges:3,sourceId:actor.id}); break;
    case 'somfist-rr': if(broken) reduceCooldown(all); break;
    case 'shanghai-rr': addCardStatus([actor],actor,'taunt','도발',0,null,'buff',2); addCardStatus([actor],actor,'damage-reduction','피해 감소',35,null,'buff',2); addCardStatus([actor],actor,'counter','반격',80,null,'buff',2); break;
    case 'jandi-rr': state.teamStatuses.push({id:'season-cycle',name:'사계 순환',kind:'buff',charges:4,step:0,sourceId:actor.id}); break;
    case 'chuming-rr': state.teamStatuses.push({id:'encore',name:'별여우 앙코르',kind:'buff',value:magnitude(70,actor,scale),duration:2,sourceId:actor.id}); break;
    case 'hoi-rr': cleanse(ally,1); reduceCooldown(ally); break;
    case 'winter-rrr': cleanse(all,1); addCardStatus(all,actor,'white-night-heart','백야의 심장',12,3,'buff',1); break;
    case 'guma-rrr': addStatus(state.boss,{id:'tiger-seal',name:'백호야행 봉인진',kind:'debuff',value:magnitude(180,actor,scale),break:magnitude(30,actor,scale),attackers:[],charges:3,sourceId:actor.id}); break;
    case 'mond-rrr': state.teamStatuses.push({id:'world-tree-route',name:'세계수 항로',kind:'buff',charges:3,step:0,value:magnitude(30,actor,scale),sourceId:actor.id}); break;
    case 'pie-rrr': state.teamStatuses.push({id:'full-course',name:'별가루 풀코스',kind:'buff',charges:3,step:0,sourceId:actor.id}); break;
    case 'kkamdung-rrr': state.teamStatuses.push({id:'eclipse-guard',name:'월식 경계선',kind:'buff',value:magnitude(30,actor,scale),accuracyDown:magnitude(20,actor,scale),charges:2,shadow:1,sourceId:actor.id}); break;
    case 'hoi-rrr': { const target=ally[0]; target.cooldown=0; damageBoss(state,target,70,1,0,scale,{skill:true}); break; }
    case 'winter-sr': addBossStatus(state,actor,'freeze','빙점 정지',0,null,1); addBossStatus(state,actor,'attack-down','공격력 감소',30,2); addBossStatus(state,actor,'break-taken-up','브레이크 취약',35,2); break;
    case 'rayeon-sr': addBossStatus(state,actor,'damage-taken-up','받는 피해 증가',18,2); break;
    case 'hoi-sr': state.teamStatuses.push({id:'star-follow-up',name:'태양별 추가 피해',kind:'buff',value:magnitude(40,actor,scale),break:magnitude(10,actor,scale),charges:2,sourceId:actor.id}); break;
    case 'guma-hr': {
      const oracle = choice || 'fortune';
      if(oracle==='misfortune') damageBoss(state,actor,220,1,25,scale,{skill:true});
      else if(oracle==='reversal'){shield(state,all,18,actor,scale);reduceCooldown(all);}
      else {heal(state,all,18,actor,scale);cleanse(all,1);} break;
    }
    case 'chuming-hr': state.teamStatuses.push({id:'finale-guard',name:'피날레 스타링',kind:'buff',value:magnitude(35,actor,scale),counter:magnitude(160,actor,scale),charges:2,stored:0,sourceId:actor.id,attack:actor.attack}); break;
    case 'mango-hr': if(state.boss.stunned) shield(state,all,15,actor,scale); else addBossStatus(state,actor,'attack-down','다음 공격 약화',25,null,1); break;
    case 'winter-ur': state.teamStatuses.push({id:'ice-spire',name:'얼음 첨탑',kind:'buff',value:magnitude(30,actor,scale),counter:magnitude(70,actor,scale),break:magnitude(10,actor,scale),charges:3,sourceId:actor.id,attack:actor.attack}); break;
    case 'hoi-ur': state.teamStatuses.push({id:'new-galaxy',name:'신생은하 육성',kind:'buff',charges:3,records:[],startsAfterPlayerAction:state.playerActionCount+1,sourceId:actor.id}); break;
    case 'hoi-ssr': {
      const copied=state.lastCopyableSkill;
      if(copied && copied.cardId!==actor.cardId){
        // The cast is a snapshot of the last skill. It deliberately does not
        // look up the original caster, so it remains valid after that card is
        // defeated. Share/copy mutable self state back so copied self-buffs do
        // not disappear with the temporary skill identity.
        const fake={...actor,statuses:actor.statuses,cardId:copied.cardId,enhancement:copied.enhancement,attack:actor.attack,skillScale:.85};
        executeSkill(state,fake,copied.targetId,copied.choice,.85,true);
        actor.hp=fake.hp; actor.shield=fake.shield; actor.statuses=fake.statuses;
      }
      break;
    }
    case 'coca-u': addCardStatus(all,actor,'evasion','잔물결 회피',10,2); addCardStatus(all,actor,'debuff-resist','잔물결 약화 저항',18,2); break;
    case 'coca-rr': addCardStatus([actor],actor,'quick','파도 가속',0,null,'buff',1); break;
    case 'coca-rrr': addCardStatus(all,actor,'damage-reduction','우산물막',18,2); break;
    case 'coca-sr': cleanse(all,1); state.teamStatuses.push({id:'lotus-regen',name:'달연꽃 물방울',kind:'buff',value:magnitude(5,actor,scale),charges:3,sourceId:actor.id}); break;
    case 'coca-hr': addBossStatus(state,actor,'break-taken-up','폭포선 균열',25,2); break;
    case 'coca-ur': state.teamStatuses.push({id:'star-follow-up',name:'극광 급류 추격',kind:'buff',value:magnitude(50,actor,scale),break:magnitude(8,actor,scale),charges:4,sourceId:actor.id}); break;
    case 'coca-ssr': state.teamStatuses.push({
      id:'prism-torrent',name:'성하 프리즘 급류',kind:'buff',charges:3,contributors:[],storedDamage:0,
      captureRate:magnitude(20,actor,scale),finisher:magnitude(280,actor,scale),break:magnitude(35,actor,scale),
      sourceId:actor.id,sourceCardId:actor.cardId,sourceName:actor.name,sourceAttack:actor.attack,sourceEnhancement:actor.enhancement,
    }); break;
    case 'rookie-analyst': addCardStatus([actor],actor,'evasion','회피율 증가',15,1); break;
    case 'sales-fox': addBossStatus(state,actor,'attack-down','공격력 감소',10,2); break;
    case 'pantry-cat': addCardStatus(all,actor,'healing-taken-up','받는 회복 증가',10,2); break;
    case 'peach-sentry': addCardStatus(all,actor,'debuff-block','약화 차단',0,null,'buff',1); break;
    case 'hwang-manager': addCardStatus(all,actor,'attack-up','공격력 증가',12,2); break;
    case 'gammam-neo': addCardStatus([actor],actor,'taunt','도발',0,null,'buff',2); addCardStatus([actor],actor,'counter','반격',65,null,'buff',2); break;
    case 'kim-manager': addBossStatus(state,actor,'damage-taken-up','받는 피해 증가',15,2); break;
    case 'deadline-dragon': addBossStatus(state,actor,'attack-down','공격력 감소',15,2); break;
    default: break;
  }
}

function prePlayerAction(state, actor) {
  // Damage-over-time effects tick when the affected card receives its action.
  // A defeated card will be skipped by performPlayerAction immediately after.
  for (const status of actor.statuses.filter((item) => item.kind === 'debuff' && Number(item.dotDamage) > 0)) {
    const dotReduction = clamp(statusValue(actor, 'dot-reduction'), 0, 90);
    const hpDamage = Math.min(actor.hp, Math.max(0, Math.round((Number(status.dotDamage) || 0) * (1 - dotReduction / 100))));
    actor.hp -= hpDamage;
    actor.defeated = actor.hp <= 0;
    log(state, 'status-damage', `${actor.name}이(가) ${status.name || '지속 피해'}로 ${hpDamage} 피해를 받았습니다.`, {
      sourceId: status.sourceId || state.boss.id,
      targetId: actor.id,
      amount: hpDamage,
      statusId: status.id,
    });
  }
  const sourceFor = (status) => state.cards.find((card) => card.id === status.sourceId) || actor;
  for (const regen of state.teamStatuses.filter(s=>s.id==='regen'&&statusIsActive(s))) heal(state,state.cards.filter(alive),regen.value,sourceFor(regen),1,{scaleMagnitude:false});
  for (const lotus of state.teamStatuses.filter(s=>s.id==='lotus-regen'&&statusIsActive(s))){heal(state,state.cards.filter(alive),lotus.value,sourceFor(lotus),1,{scaleMagnitude:false});lotus.charges-=1;}
  for (const fruit of state.teamStatuses.filter(s=>s.id==='golden-fruit'&&statusIsActive(s))){heal(state,targetsFor(state,actor,'lowest'),fruit.value,sourceFor(fruit),1,{scaleMagnitude:false});fruit.charges-=1;}
  for (const season of state.teamStatuses.filter(s=>s.id==='season-cycle'&&statusIsActive(s))){ const source=sourceFor(season); if(season.step===0)heal(state,state.cards.filter(alive),8,source); if(season.step===1)addCardStatus([actor],source,'effect-up','여름 효과 강화',20,null,'buff',1); if(season.step===2)addCardStatus([actor],source,'break-up','가을 브레이크',20,null,'buff',1); if(season.step===3)shield(state,state.cards.filter(alive),10,source); season.step+=1;season.charges-=1; }
  for (const route of state.teamStatuses.filter(s=>s.id==='world-tree-route'&&statusIsActive(s))){const source=sourceFor(route);if(route.step===0)addCardStatus([actor],source,'break-up','세계수 브레이크',30,null,'buff',1);if(route.step===1)heal(state,targetsFor(state,actor,'lowest'),15,source);if(route.step===2)reduceCooldown(state.cards.filter(alive));route.step+=1;route.charges-=1;}
  for (const course of state.teamStatuses.filter(s=>s.id==='full-course'&&statusIsActive(s))){const source=sourceFor(course);if(course.step===0)shield(state,state.cards.filter(alive),12,source);if(course.step===1)heal(state,state.cards.filter(alive),15,source);if(course.step===2){addCardStatus(state.cards.filter(alive),source,'effect-up','디저트 강화',25,null,'buff',1);reduceCooldown(state.cards.filter(alive));}course.step+=1;course.charges-=1;}
  state.teamStatuses = state.teamStatuses.filter(s=>s.charges==null||s.charges>0);
}

function resolveGalaxy(state, actor, actionType, skill, preferred) {
  const galaxies=state.teamStatuses.filter(s=>s.id==='new-galaxy'&&statusIsActive(s)); if(!galaxies.length)return;
  const role = actionType === 'basic' || /공격|브레이크/.test(skill?.role || '') ? 'attack'
    : /회복/.test(skill?.role || '') ? 'heal' : 'support';
  for (const galaxy of galaxies) {
    if (state.playerActionCount < Number(galaxy.startsAfterPlayerAction || 0)) continue;
    galaxy.records.push(role); galaxy.charges -= 1;
    if(galaxy.charges > 0)continue;
    const counts=galaxy.records.reduce((map,key)=>({...map,[key]:(map[key]||0)+1}),{});
    const best=Math.max(...Object.values(counts)); const tied=Object.keys(counts).filter(key=>counts[key]===best);
    const outcome=tied.includes(preferred)?preferred:tied[0];
    const source=state.cards.find(card=>card.id===galaxy.sourceId)||actor;
    if(outcome==='heal'){heal(state,state.cards.filter(alive),25,source);shield(state,state.cards.filter(alive),15,source);}
    else if(outcome==='support'){reduceCooldown(state.cards.filter(alive),2);addBossStatus(state,source,'attack-down','신생은하 약화',25,2);}
    else damageBoss(state,source,320,1,30,1,{skill:true});
    state.teamStatuses=state.teamStatuses.filter(status=>status!==galaxy);
  }
}

function executeSkill(state, actor, targetId, choice, scale = 1, copied = false) {
  const skill = cardSkillAtEnhancement(actor.cardId, actor.enhancement);
  const broken = commonEffects(state,actor,skill,targetId,scale);
  specialEffects(state,actor,targetId,choice,scale,broken);
  if(!copied && skill && !NON_COPYABLE_SKILLS.has(actor.cardId)) {
    state.lastCopyableSkill={cardId:actor.cardId,enhancement:actor.enhancement,targetId,choice};
  }
  return skill;
}

export function performPlayerAction(input, action = {}, now = Date.now()) {
  const state = clone(input);
  if (state.status !== 'active' || state.currentActor !== 'card') throw new Error('현재는 카드의 행동 차례가 아닙니다.');
  const actor = state.cards[state.currentActorIndex];
  if (!alive(actor)) { advanceToNextLivingCard(state,now); return state; }
  const actionType = action.type === 'skill' ? 'skill' : 'basic';
  prePlayerAction(state,actor);
  if (!alive(actor)) {
    log(state, 'skip', `${actor.name}은(는) 지속 피해로 행동불능이 되었습니다.`, { actorId: actor.id });
    state.playerActionCount += 1;
    advanceToNextLivingCard(state, now);
    return state;
  }
  let usedSkill = null;
  if (actionType === 'skill') {
    const skill = CARD_SKILL_BY_ID[actor.cardId]; usedSkill = skill;
    if (!skill) throw new Error('이 카드의 고유 스킬을 찾을 수 없습니다.');
    const seal = actor.statuses.find((status) => status.id === 'seal' && (status.charges == null || status.charges > 0));
    if (seal) throw new Error('봉인 상태에서는 스킬을 사용할 수 없습니다.');
    if (actor.cooldown > 0) throw new Error(`스킬 쿨타임이 ${actor.cooldown}턴 남았습니다.`);
    if (skill.oncePerBattle && actor.skillUses > 0) throw new Error('전투당 한 번만 사용할 수 있는 스킬입니다.');
    executeSkill(state,actor,action.targetId,action.choice); actor.skillUses += 1; actor.cooldown = skill.cooldown;
    const quick = actor.statuses.find((status) => status.id === 'quick' && (status.charges == null || status.charges > 0));
    if (quick) {
      actor.cooldown = Math.max(0, actor.cooldown - 1);
      if (quick.charges != null) quick.charges -= 1;
    }
    log(state,'skill',`${actor.name}이(가) ${skill.name}을(를) 사용했습니다.`,{actorId:actor.id,skillId:actor.cardId});
    const encore=state.teamStatuses.find(s=>s.id==='encore'&&s.sourceId!==actor.id);
    if(encore){const source=state.cards.find(c=>c.id===encore.sourceId);if(source&&alive(source)){damageBoss(state,source,encore.value,1,0,1,{followUp:true});actor.cooldown=Math.max(0,actor.cooldown-1);}}
  } else {
    let multiplier=100; const bonus=actor.statuses.find(s=>s.id==='basic-bonus'); if(bonus){multiplier+=bonus.value;bonus.charges-=1;removeExpired(actor);}
    damageBoss(state,actor,multiplier,1,0,1,{scaleMagnitude:false}); log(state,'basic',`${actor.name}의 기본 공격!`,{actorId:actor.id});
  }
  resolveGalaxy(state,actor,actionType,usedSkill,action.galaxyChoice);
  actor.statuses.filter(s=>s.id==='effect-up'||s.id==='break-up').forEach(s=>{if(s.charges!=null)s.charges-=1;}); removeExpired(actor);
  state.playerActionCount += 1;
  if(state.boss.stunned && state.playerActionCount >= state.boss.stunReleaseAtPlayerAction){state.boss.stunned=false;state.boss.statuses=state.boss.statuses.filter(s=>s.id!=='break-stun');}
  advance(state,now); return state;
}

function pickBossTarget(state) {
  const living=state.cards.filter(alive); const taunt=living.find(card=>card.statuses.some(s=>s.id==='taunt'&&s.charges>0));
  if(taunt){const s=taunt.statuses.find(x=>x.id==='taunt');s.charges-=1;removeExpired(taunt);return taunt;}
  return living[Math.floor(nextRandom(state)*living.length)] || null;
}

function hurtCard(state, target, rawDamage, source = 'boss') {
  if(!target||!alive(target))return 0;
  const bossSource = source === 'boss' || source === state.boss.id || state.boss.skills.some((skill) => skill.id === source);
  const accuracyDown = bossSource ? clamp(statusValue(state.boss, 'accuracy-down'), 0, 90) : 0;
  if(accuracyDown>0&&nextRandom(state)<accuracyDown/100){log(state,'miss',`${state.boss.name}의 공격이 빗나갔습니다.`,{targetId:target.id});return 0;}
  const evasion=statusValue(target,'evasion'); if(evasion>0&&nextRandom(state)<evasion/100){log(state,'evade',`${target.name}이(가) 공격을 피했습니다.`,{targetId:target.id});return 0;}
  const guarded = target.statuses.find((status) => status.id === 'guarded-by');
  const guardian = guarded ? state.cards.find((card) => card.id === guarded.sourceId && alive(card)) : null;
  if (guardian && guardian !== target) {
    const shared = Math.max(0, Math.round(rawDamage * clamp(Number(guarded.value) || 0, 0, 100) / 100));
    rawDamage -= shared;
    const guardedDamage = Math.max(0, Math.round(shared * (1 - clamp(statusValue(guardian, 'guarding'), 0, 90) / 100)));
    const guardAbsorbed = Math.min(guardian.shield, guardedDamage);
    guardian.shield -= guardAbsorbed;
    const guardHpDamage = Math.min(guardian.hp, guardedDamage - guardAbsorbed);
    guardian.hp -= guardHpDamage;
    guardian.defeated = guardian.hp <= 0;
    log(state, 'guard', `${guardian.name}이(가) ${target.name}의 피해 ${guardHpDamage}을 대신 받았습니다.`, {
      sourceId: source, targetId: guardian.id, protectedId: target.id, amount: guardHpDamage, absorbed: guardAbsorbed,
    });
  }
  let remainingMultiplier=damageRemainingMultiplier(activeStatuses(target,'damage-reduction'));
  const foresight=state.teamStatuses.find(s=>s.id==='foresight'&&statusIsActive(s)); if(foresight){remainingMultiplier*=1-clamp(foresight.value,0,100)/100;foresight.charges-=1;addCardStatus(state.cards.filter(alive),target,'effect-up','예지 성공',foresight.successBoost||30,null,'buff',1);}
  const eclipse=state.teamStatuses.find(s=>s.id==='eclipse-guard'&&statusIsActive(s)); if(eclipse){if(eclipse.shadow>0){eclipse.shadow=0;rawDamage=0;addStatus(state.boss,{id:'accuracy-down',name:'그림자 교란',kind:'debuff',value:eclipse.accuracyDown||20,duration:2,sourceId:eclipse.sourceId});}else remainingMultiplier*=1-clamp(eclipse.value,0,100)/100;eclipse.charges-=1;}
  const finale=state.teamStatuses.find(s=>s.id==='finale-guard'&&statusIsActive(s)); if(finale){const saved=rawDamage*clamp(finale.value,0,100)/100;finale.stored+=saved;rawDamage-=saved;finale.charges-=1;}
  const spire=state.teamStatuses.find(s=>s.id==='ice-spire'&&statusIsActive(s)); if(spire){remainingMultiplier*=1-clamp(spire.value,0,100)/100;spire.charges-=1;const sourceCard=state.cards.find(c=>c.id===spire.sourceId);if(sourceCard)damageBoss(state,sourceCard,spire.counter,1,spire.break,1,{counter:true});}
  let damage=Math.max(0,Math.round(rawDamage*remainingMultiplier));
  const absorbed=Math.min(target.shield,damage);target.shield-=absorbed;damage-=absorbed;
  const hpDamage=Math.min(target.hp,damage);target.hp-=hpDamage;target.defeated=target.hp<=0;
  if(absorbed>0&&target.shield<=0){const recovery=statusValue(target,'shield-break-heal');if(recovery)heal(state,[target],recovery,target,1,{scaleMagnitude:false});}
  const emergency=target.statuses.find(s=>s.id==='emergency-shield');if(target.hp>0&&target.hp<50&&statusIsActive(emergency)){shield(state,[target],emergency.value,target,1,{scaleMagnitude:false});emergency.charges=0;}
  const heart=target.statuses.find(s=>s.id==='white-night-heart');if(target.hp>0&&target.hp<50&&statusIsActive(heart)){heal(state,[target],heart.value,target,1,{scaleMagnitude:false});if(heart.charges!=null)heart.charges-=1;else if(heart.duration!=null)heart.duration=0;}
  log(state,'boss-damage',`${target.name}이(가) ${hpDamage} 피해를 받았습니다.`,{sourceId:source,targetId:target.id,amount:hpDamage,absorbed});
  const counter=target.statuses.find(s=>s.id==='counter'&&s.charges>0);if(counter){damageBoss(state,target,counter.value,1,target.cardId==='shanghai-rr'?10:0,1,{counter:true});counter.charges-=1;}
  if(finale&&finale.charges<=0){const sourceCard=state.cards.find(card=>card.id===finale.sourceId);if(sourceCard){damageBoss(state,sourceCard,finale.counter||160,1,0,1,{counter:true});const extra=Math.min(state.boss.hp,Math.round(finale.stored));state.boss.hp-=extra;state.totalDamage+=extra;log(state,'counter',`저장한 피해 ${extra}을 되돌려주었습니다.`,{sourceId:sourceCard.id,targetId:state.boss.id,amount:extra});}}
  state.teamStatuses=state.teamStatuses.filter(s=>s.charges==null||s.charges>0);
  removeExpired(target); return hpDamage;
}

function consumeBossAttackDebuffs(state) {
  state.boss.statuses.filter(status=>status.id==='attack-down'&&status.charges!=null).forEach(status=>{status.charges-=1;});
  removeExpired(state.boss);
}

function applyBossStatusToCard(state, target, effect) {
  const blocker=target.statuses.find(status=>status.id==='debuff-block'&&status.charges>0);
  if(blocker){blocker.charges-=1;removeExpired(target);return;}
  const resistance = clamp(statusValue(target, 'debuff-resist'), 0, 90);
  if (resistance > 0 && nextRandom(state) < resistance / 100) {
    log(state, 'resist', `${target.name}이(가) ${effect.name || '약화 효과'}에 저항했습니다.`, { targetId: target.id, statusId: effect.id });
    return;
  }
  addStatus(target,{
    id:effect.id||'boss-debuff',name:effect.name||'보스 약화',kind:'debuff',
    value:Number(effect.value ?? effect.percent ?? effect.amount ?? effect.damage) || 0,
    duration:Math.max(1, Number(effect.duration ?? effect.turns ?? effect.rounds) || 1),
    charges:effect.charges ?? effect.stacks ?? null,
    dotDamage:Math.max(0,Number(effect.dotDamage ?? effect.damage) || 0),sourceId:'boss'
  });
}

function defaultBossAction(state) {
  const usable=state.boss.skills
    .filter(skill=>(state.boss.cooldowns[skill.id]||0)<=0&&(!skill.minStage||state.boss.stage>=skill.minStage)&&(!skill.oncePerBattle||!(state.boss.skillUses[skill.id]>0)))
    .toSorted((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0));
  const skill=usable[0];
  const attackRate=Math.max(0,1+(statusValue(state.boss,'attack-up')-statusValue(state.boss,'attack-down'))/100);
  if(skill){
    const living=state.cards.filter(alive);
    const requested=skill.target==='all'||skill.allTargets?living.length:(skill.targetCount??skill.targets??1);
    const count=Math.max(1,Math.floor(requested));const picked=[];
    if (skill.target === 'highest-power') {
      const strongest = living.toSorted((a, b) => b.attack - a.attack)[0];
      if (strongest) picked.push(strongest);
    } else if (skill.target !== 'self') {
      for(let i=0;i<count;i+=1){const candidates=living.filter(card=>!picked.includes(card));if(!candidates.length)break;picked.push(candidates[Math.floor(nextRandom(state)*candidates.length)]);}
    }
    const hits=Math.max(1,Math.floor(Number(skill.hits)||1));
    for(const target of picked){hurtCard(state,target,(Number(skill.damage)||state.boss.baseDamage)*hits*attackRate,skill.id);for(const effect of skill.statusEffects||skill.statuses||[])applyBossStatusToCard(state,target,effect);}
    if(skill.selfShield)state.boss.shield+=Math.max(0,Number(skill.selfShield)||0);
    if(skill.selfShieldPercent)state.boss.shield+=Math.max(0,Math.round(state.boss.maxHp*skill.selfShieldPercent/100));
    if(skill.selfBuff){
      const buff=skill.selfBuff;
      addStatus(state.boss,{
        id:buff.id||'attack-up',name:buff.name||'보스 강화',kind:'buff',
        value:Number(buff.percent??buff.value)||0,duration:Number(buff.bossActions??buff.turns??buff.duration)||1,
        charges:Number(buff.bossActions??buff.charges)||null,sourceId:state.boss.id
      });
    }
    state.boss.cooldowns[skill.id]=Math.max(1,Number(skill.cooldown)||3);state.boss.skillUses[skill.id]=(state.boss.skillUses[skill.id]||0)+1;
    if (!skill.selfBuff) state.boss.statuses.filter(status=>status.kind==='buff'&&status.charges!=null).forEach(status=>{status.charges-=1;});
    consumeBossAttackDebuffs(state);log(state,'boss-skill',`${state.boss.name}이(가) ${skill.name||'스킬'}을 사용했습니다.`,{skillId:skill.id});return;
  }
  hurtCard(state,pickBossTarget(state),state.boss.baseDamage*attackRate,state.boss.id);
  state.boss.statuses.filter(status=>status.kind==='buff'&&status.charges!=null).forEach(status=>{status.charges-=1;});
  consumeBossAttackDebuffs(state);log(state,'boss-basic',`${state.boss.name}의 기본 공격!`);
}

export function performBossAction(input, now = Date.now()) {
  const state=clone(input); if(state.status!=='active'||state.currentActor!=='boss')throw new Error('현재는 보스의 행동 차례가 아닙니다.');
  const frozen=state.boss.statuses.find((status) => status.id === 'freeze' && statusIsActive(status));
  if(state.boss.stunned||frozen){
    if(frozen){
      if(frozen.charges != null) frozen.charges-=1;
      else if(frozen.duration != null) frozen.duration=0;
      removeExpired(state.boss);
    }
    log(state,'boss-skip',`${state.boss.name}은(는) 행동할 수 없습니다.`);
  }
  else defaultBossAction(state);
  advance(state,now);checkBattleEnd(state,now);return state;
}

export function reduceTurnRaidBattle(state, action, now = Date.now()) {
  if(action?.type==='START')return startRaidBattle(state,now);
  if(action?.type==='BOSS_ACTION')return performBossAction(state,now);
  if(action?.type==='PLAYER_BASIC')return performPlayerAction(state,{type:'basic'},now);
  if(action?.type==='PLAYER_SKILL')return performPlayerAction(state,{type:'skill',targetId:action.targetId,choice:action.choice},now);
  if(action?.type==='PLAYER_TIMEOUT')return performPlayerAction(state,{type:'basic',automatic:true},now);
  return clone(state);
}

export function skillForCard(cardId, enhancement = 0) { return cardSkillAtEnhancement(cardId,enhancement); }
export function skillDescriptionForCard(cardId, enhancement = 0) { return cardSkillAtEnhancement(cardId,enhancement)?.description || ''; }
