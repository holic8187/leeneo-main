const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

export const RAID_TURN_SECONDS = 20;

export const EFFECT_PRESENTATION = Object.freeze({
  'attack-up': { icon: 'swords', label: '공격력 증가', tone: 'buff', description: '주는 공격력이 증가합니다.' },
  attackUp: { icon: 'swords', label: '공격력 증가', tone: 'buff', description: '주는 공격력이 증가합니다.' },
  'damage-up': { icon: 'zap', label: '주는 피해 증가', tone: 'buff', description: '보스에게 주는 피해가 증가합니다.' },
  damageUp: { icon: 'zap', label: '주는 피해 증가', tone: 'buff', description: '보스에게 주는 피해가 증가합니다.' },
  'damage-reduction': { icon: 'shield', label: '받는 피해 감소', tone: 'buff', description: '받는 피해가 감소합니다.' },
  shield: { icon: 'shield', label: '보호막', tone: 'buff', description: 'HP보다 먼저 피해를 흡수합니다.' },
  regen: { icon: 'heart-pulse', label: '지속 회복', tone: 'buff', description: '아군 행동 시작 시 HP를 회복합니다.' },
  healOverTime: { icon: 'heart-pulse', label: '지속 회복', tone: 'buff', description: '턴마다 HP를 회복합니다.' },
  counter: { icon: 'rotate-ccw', label: '반격', tone: 'buff', description: '피격 시 보스에게 반격합니다.' },
  taunt: { icon: 'megaphone', label: '도발', tone: 'buff', description: '다음 단일 공격의 대상이 됩니다.' },
  evasion: { icon: 'wind', label: '회피율 증가', tone: 'buff', description: '공격을 회피할 확률이 증가합니다.' },
  evade: { icon: 'wind', label: '회피 증가', tone: 'buff', description: '공격을 회피할 확률이 증가합니다.' },
  'skill-damage-up': { icon: 'sparkles', label: '스킬 피해 증가', tone: 'buff', description: '고유 스킬이 주는 피해가 증가합니다.' },
  skillBoost: { icon: 'sparkles', label: '스킬 강화', tone: 'buff', description: '고유 스킬의 효과가 강화됩니다.' },
  'basic-bonus': { icon: 'swords', label: '기본 공격 강화', tone: 'buff', description: '다음 기본 공격의 피해가 증가합니다.' },
  'break-up': { icon: 'target', label: '브레이크 증가', tone: 'buff', description: '다음 공격의 브레이크 피해가 증가합니다.' },
  'effect-up': { icon: 'sparkles', label: '효과량 증가', tone: 'buff', description: '회복·보호막·스킬 효과량이 증가합니다.' },
  'debuff-resist': { icon: 'shield', label: '약화 저항', tone: 'buff', description: '보스의 약화 효과를 저항할 확률이 증가합니다.' },
  'dot-reduction': { icon: 'shield', label: '지속 피해 감소', tone: 'buff', description: '화상 같은 지속 피해가 감소합니다.' },
  'guarded-by': { icon: 'shield', label: '피해 대신 받기', tone: 'buff', description: '받는 피해 일부를 아군이 대신 받습니다.' },
  guarding: { icon: 'shield', label: '수호', tone: 'buff', description: '대신 받은 피해가 감소합니다.' },
  'debuff-block': { icon: 'ban', label: '약화 차단', tone: 'buff', description: '다음에 받는 약화 효과를 막습니다.' },
  'healing-taken-up': { icon: 'heart-pulse', label: '받는 회복 증가', tone: 'buff', description: '받는 회복량이 증가합니다.' },
  'break-reduction': { icon: 'target', label: '브레이크 방어', tone: 'buff', description: '받는 브레이크 피해가 감소합니다.' },
  'shield-break-heal': { icon: 'heart-pulse', label: '보호막 파괴 회복', tone: 'buff', description: '보호막이 파괴되면 HP를 회복합니다.' },
  'emergency-shield': { icon: 'shield-alert', label: '위기 보호막', tone: 'buff', description: 'HP가 낮아지면 보호막을 얻습니다.' },
  quick: { icon: 'clock', label: '행동 가속', tone: 'buff', description: '다음 스킬의 쿨다운이 감소합니다.' },
  'white-night-heart': { icon: 'heart-pulse', label: '백야의 심장', tone: 'buff', description: 'HP가 낮아지면 추가로 회복합니다.' },
  'peach-seed': { icon: 'sparkles', label: '복숭아 씨앗', tone: 'debuff', description: '다음 아군 공격에 추가 피해가 발동합니다.' },
  'star-follow-up': { icon: 'zap', label: '별빛 추가 피해', tone: 'buff', description: '다음 아군 공격에 추가 피해가 발동합니다.' },
  foresight: { icon: 'eye-off', label: '호수의 예지', tone: 'buff', description: '다음 보스 공격의 피해를 크게 줄입니다.' },
  'golden-fruit': { icon: 'heart-pulse', label: '황금 열매', tone: 'buff', description: '아군 행동마다 가장 HP가 낮은 아군을 회복합니다.' },
  'season-cycle': { icon: 'refresh-cw', label: '사계 순환', tone: 'buff', description: '아군 행동마다 계절 효과가 순서대로 발동합니다.' },
  encore: { icon: 'rotate-ccw', label: '별여우 앙코르', tone: 'buff', description: '아군 스킬 사용 뒤 추가 공격과 쿨다운 감소가 발동합니다.' },
  'world-tree-route': { icon: 'map', label: '세계수 항로', tone: 'buff', description: '아군 행동마다 지원 효과가 순서대로 발동합니다.' },
  'full-course': { icon: 'package-open', label: '별가루 풀코스', tone: 'buff', description: '아군 행동마다 전채·본식·디저트 효과가 순서대로 발동합니다.' },
  'eclipse-guard': { icon: 'shield', label: '월식 경계선', tone: 'buff', description: '보스 공격을 막고 아군 피해를 줄입니다.' },
  'finale-guard': { icon: 'shield-alert', label: '피날레 스타링', tone: 'buff', description: '감소시킨 피해를 저장했다가 반격합니다.' },
  'ice-spire': { icon: 'snowflake', label: '얼음 첨탑', tone: 'buff', description: '보스 공격을 줄이고 반격합니다.' },
  'new-galaxy': { icon: 'sparkles', label: '신생은하 육성', tone: 'buff', description: '다음 아군 행동을 기록해 보너스 효과를 준비합니다.' },
  'tiger-seal': { icon: 'ban', label: '백호야행 봉인진', tone: 'debuff', description: '서로 다른 아군 3명이 공격하면 큰 피해가 발동합니다.' },
  'attack-down': { icon: 'shield-minus', label: '공격력 감소', tone: 'debuff', description: '주는 공격 피해가 감소합니다.' },
  'damage-down': { icon: 'shield-minus', label: '주는 피해 감소', tone: 'debuff', description: '보스에게 주는 피해가 감소합니다.' },
  damageDown: { icon: 'shield-minus', label: '주는 피해 감소', tone: 'debuff', description: '보스에게 주는 피해가 감소합니다.' },
  'damage-taken-up': { icon: 'shield-alert', label: '받는 피해 증가', tone: 'debuff', description: '받는 피해가 증가합니다.' },
  defenseDown: { icon: 'shield-alert', label: '받는 피해 증가', tone: 'debuff', description: '받는 피해가 증가합니다.' },
  'healing-down': { icon: 'heart-pulse', label: '회복량 감소', tone: 'debuff', description: '받는 회복량이 감소합니다.' },
  burn: { icon: 'flame', label: '화상', tone: 'debuff', description: '행동 시작 시 지속 피해를 받습니다.' },
  freeze: { icon: 'snowflake', label: '동결', tone: 'debuff', description: '다음 행동을 할 수 없습니다.' },
  seal: { icon: 'ban', label: '봉인', tone: 'debuff', description: '고유 스킬을 사용할 수 없습니다.' },
  'break-stun': { icon: 'orbit', label: '브레이크 스턴', tone: 'debuff', description: '브레이크로 보스가 행동할 수 없습니다.' },
  stun: { icon: 'orbit', label: '스턴', tone: 'debuff', description: '행동할 수 없습니다.' },
  'break-taken-flat': { icon: 'target', label: '브레이크 취약', tone: 'debuff', description: '받는 브레이크 피해가 증가합니다.' },
  'break-taken-up': { icon: 'target', label: '받는 브레이크 피해 증가', tone: 'debuff', description: '받는 브레이크 피해가 증가합니다.' },
  breakVulnerability: { icon: 'target', label: '브레이크 취약', tone: 'debuff', description: '받는 브레이크 피해가 증가합니다.' },
  'accuracy-down': { icon: 'eye-off', label: '명중률 감소', tone: 'debuff', description: '보스 공격이 빗나갈 확률이 증가합니다.' },
  accuracyDown: { icon: 'eye-off', label: '명중률 감소', tone: 'debuff', description: '보스 공격이 빗나갈 확률이 증가합니다.' },
});

export function effectPresentation(effect = {}) {
  const id = String(effect.id || effect.type || effect.kind || 'effect');
  const known = EFFECT_PRESENTATION[id];
  const tone = effect.tone === 'debuff' || effect.kind === 'debuff' || effect.negative === true ? 'debuff' : 'buff';
  return {
    id,
    icon: String(effect.icon || known?.icon || (tone === 'buff' ? 'sparkles' : 'circle-alert')),
    label: String(effect.label || effect.name || known?.label || '상태 효과'),
    description: String(effect.description || effect.text || known?.description || known?.label || '현재 전투에 적용되는 상태 효과입니다.'),
    tone: known?.tone || tone,
    count: Math.max(0, Number(effect.count ?? effect.stacks ?? effect.turns ?? effect.remaining ?? effect.charges ?? effect.duration) || 0),
    scope: effect.scope === 'team' || effect.shared === true ? 'team' : 'single',
  };
}

function normalizeEffects(value) {
  return (Array.isArray(value) ? value : []).map(effectPresentation);
}

function firstEffectArray(...candidates) {
  const firstArray = candidates.find(Array.isArray);
  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length) || firstArray || [];
}

function shieldEffect(amount) {
  const shield = Math.max(0, Math.round(Number(amount) || 0));
  return shield ? [{
    id: 'shield', name: '보호막', kind: 'buff', count: shield,
    description: `보호막 ${shield}이(가) HP보다 먼저 피해를 흡수합니다.`,
  }] : [];
}

function effectsForActor({ effects, statusEffects, statuses, shield = 0, teamStatuses = [] }) {
  const own = firstEffectArray(effects, statusEffects, statuses);
  // Party-wide effects affect every member, so each affected card exposes the
  // same marked icon next to its own HP bar. This prevents a protected card
  // from looking unbuffed merely because another card cast the effect.
  const shared = (Array.isArray(teamStatuses) ? teamStatuses : [])
    .map((status) => ({ ...status, scope: 'team', shared: true }));
  return normalizeEffects([...own, ...shared, ...shieldEffect(shield)]);
}

function normalizeActor(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (value === 'boss') return { type: 'boss', index: -1, cardId: '' };
    if (value === 'card') return { type: 'card', index: -1, cardId: '' };
    return { type: 'card', index: -1, cardId: value };
  }
  const type = value.type === 'boss' || value.side === 'boss' ? 'boss' : 'card';
  return {
    type,
    index: Number.isInteger(value.index) ? value.index : Number(value.slot ?? value.cardIndex ?? -1),
    cardId: String(value.cardId || value.id || ''),
  };
}

export function normalizeRaidBattle(value = {}) {
  const rawBoss = value.boss || value.enemy || {};
  const rawSquad = value.squad || value.cards || value.allies || [];
  const bossMaxHp = Math.max(1, Number(rawBoss.maxHp ?? value.bossMaxHp) || 1);
  const status = String(value.status || (value.started ? 'active' : 'ready'));
  const actor = normalizeActor(value.activeActor || value.currentActor || value.actor);
  const teamStatuses = firstEffectArray(value.teamStatuses, value.partyEffects, value.teamEffects);
  if (actor?.type === 'card' && actor.index < 0 && Number.isInteger(value.currentActorIndex)) {
    actor.index = value.currentActorIndex;
  }
  const boss = {
    ...rawBoss,
    id: String(rawBoss.id || value.bossId || 'deadline-dragon-raid'),
    name: String(rawBoss.name || value.bossName || '마감기한 드래곤'),
    hp: clamp(rawBoss.hp ?? value.bossHp, 0, bossMaxHp),
    maxHp: bossMaxHp,
    breakGauge: clamp(rawBoss.breakGauge ?? value.breakGauge, 0, 100),
    stunned: Boolean(rawBoss.stunned || rawBoss.status === 'stunned' || value.bossStunned),
    effects: effectsForActor({
      effects: rawBoss.effects,
      statusEffects: rawBoss.statusEffects,
      statuses: rawBoss.statuses,
      shield: rawBoss.shield,
    }),
  };
  const squad = rawSquad.slice(0, 3).map((member, index) => {
    const maxHp = Math.max(1, Number(member.maxHp) || 100);
    const normalized = {
      ...member,
      cardId: String(member.cardId || member.id || ''),
      enhancement: clamp(member.enhancement, 0, 5),
      hp: clamp(member.hp ?? 100, 0, maxHp),
      maxHp,
      skillCooldown: Math.max(0, Number(member.skillCooldown ?? member.cooldownRemaining ?? member.cooldown) || 0),
      shield: Math.max(0, Number(member.shield) || 0),
      slot: index + 1,
    };
    normalized.effects = effectsForActor({
      effects: member.effects,
      statusEffects: member.statusEffects,
      statuses: member.statuses,
      shield: normalized.shield,
      teamStatuses,
    });
    return normalized;
  });
  return {
    ...value,
    sessionId: String(value.sessionId || value.id || ''),
    status,
    stage: Math.max(1, Number(value.stage) || 1),
    turn: Math.max(0, Number(value.turn ?? value.round) || 0),
    startedAt: Number(value.startedAt) || 0,
    expiresAt: Number(value.expiresAt) || 0,
    turnDeadlineAt: Number(value.turnDeadlineAt || value.deadlineAt) || 0,
    activeActor: actor,
    boss,
    squad,
    battleLog: (Array.isArray(value.battleLog) ? value.battleLog : Array.isArray(value.log) ? value.log : []).slice(-80),
  };
}

export function createRaidBattlePreview({ serverBattle = {}, squad = [], cardsById = () => null } = {}) {
  return normalizeRaidBattle({
    ...serverBattle,
    status: 'ready',
    activeActor: null,
    boss: {
      id: serverBattle.bossId,
      name: serverBattle.bossName,
      hp: serverBattle.bossHp ?? serverBattle.bossMaxHp,
      maxHp: serverBattle.bossMaxHp,
      breakGauge: 0,
      effects: [],
    },
    squad: squad.map((member) => ({
      ...member,
      hp: 100,
      maxHp: 100,
      effects: [],
      name: cardsById(member.cardId)?.name || member.name,
    })),
  });
}

export function isPlayerRaidTurn(battle) {
  return battle?.status === 'active' && battle?.activeActor?.type === 'card';
}

export function activeRaidCardIndex(battle) {
  if (!isPlayerRaidTurn(battle)) return -1;
  const actor = battle.activeActor;
  if (Number.isInteger(actor.index) && actor.index >= 0) return actor.index;
  return battle.squad.findIndex((member) => member.cardId === actor.cardId);
}

export function raidTurnSecondsRemaining(battle, now = Date.now()) {
  if (!isPlayerRaidTurn(battle) || !battle.turnDeadlineAt) return 0;
  return Math.max(0, Math.ceil((battle.turnDeadlineAt - now) / 1000));
}

export function raidBattleFinished(battle) {
  if (!battle) return false;
  return ['won', 'lost', 'finished', 'victory', 'defeat'].includes(battle.status)
    || battle.boss.hp <= 0
    || battle.squad.every((member) => member.hp <= 0);
}
