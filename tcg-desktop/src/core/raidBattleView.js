const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

export const RAID_TURN_SECONDS = 20;

export const EFFECT_PRESENTATION = Object.freeze({
  'attack-up': { icon: 'swords', label: '공격력 증가', tone: 'buff' },
  attackUp: { icon: 'swords', label: '공격력 증가', tone: 'buff' },
  'damage-up': { icon: 'zap', label: '주는 피해 증가', tone: 'buff' },
  damageUp: { icon: 'zap', label: '주는 피해 증가', tone: 'buff' },
  'damage-reduction': { icon: 'shield', label: '받는 피해 감소', tone: 'buff' },
  shield: { icon: 'shield', label: '보호막', tone: 'buff' },
  regen: { icon: 'heart-pulse', label: '지속 회복', tone: 'buff' },
  healOverTime: { icon: 'heart-pulse', label: '지속 회복', tone: 'buff' },
  counter: { icon: 'rotate-ccw', label: '반격', tone: 'buff' },
  taunt: { icon: 'megaphone', label: '도발', tone: 'buff' },
  evade: { icon: 'wind', label: '회피 증가', tone: 'buff' },
  skillBoost: { icon: 'sparkles', label: '스킬 강화', tone: 'buff' },
  'attack-down': { icon: 'shield-minus', label: '공격력 감소', tone: 'debuff' },
  'damage-down': { icon: 'shield-minus', label: '주는 피해 감소', tone: 'debuff' },
  damageDown: { icon: 'shield-minus', label: '주는 피해 감소', tone: 'debuff' },
  'damage-taken-up': { icon: 'shield-alert', label: '받는 피해 증가', tone: 'debuff' },
  defenseDown: { icon: 'shield-alert', label: '받는 피해 증가', tone: 'debuff' },
  burn: { icon: 'flame', label: '화상', tone: 'debuff' },
  freeze: { icon: 'snowflake', label: '동결', tone: 'debuff' },
  seal: { icon: 'ban', label: '봉인', tone: 'debuff' },
  'break-stun': { icon: 'orbit', label: '브레이크 스턴', tone: 'debuff' },
  stun: { icon: 'orbit', label: '스턴', tone: 'debuff' },
  'break-taken-flat': { icon: 'target', label: '브레이크 취약', tone: 'debuff' },
  'break-taken-up': { icon: 'target', label: '받는 브레이크 피해 증가', tone: 'debuff' },
  breakVulnerability: { icon: 'target', label: '브레이크 취약', tone: 'debuff' },
  'accuracy-down': { icon: 'eye-off', label: '명중률 감소', tone: 'debuff' },
  accuracyDown: { icon: 'eye-off', label: '명중률 감소', tone: 'debuff' },
});

export function effectPresentation(effect = {}) {
  const id = String(effect.id || effect.type || effect.kind || 'effect');
  const known = EFFECT_PRESENTATION[id];
  const tone = effect.tone === 'debuff' || effect.kind === 'debuff' || effect.negative === true ? 'debuff' : 'buff';
  return {
    id,
    icon: String(effect.icon || known?.icon || (tone === 'buff' ? 'sparkles' : 'circle-alert')),
    label: String(effect.label || effect.name || known?.label || '상태 효과'),
    description: String(effect.description || effect.text || known?.label || '현재 전투에 적용되는 상태 효과입니다.'),
    tone: known?.tone || tone,
    count: Math.max(0, Number(effect.count ?? effect.stacks ?? effect.turns ?? effect.remaining ?? effect.charges ?? effect.duration) || 0),
  };
}

function normalizeEffects(value) {
  return (Array.isArray(value) ? value : []).map(effectPresentation);
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
  if (actor?.type === 'card' && actor.index < 0 && Number.isInteger(value.currentActorIndex)) {
    actor.index = value.currentActorIndex;
  }
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
    boss: {
      ...rawBoss,
      id: String(rawBoss.id || value.bossId || 'deadline-dragon-raid'),
      name: String(rawBoss.name || value.bossName || '마감기한 드래곤'),
      hp: clamp(rawBoss.hp ?? value.bossHp, 0, bossMaxHp),
      maxHp: bossMaxHp,
      breakGauge: clamp(rawBoss.breakGauge ?? value.breakGauge, 0, 100),
      stunned: Boolean(rawBoss.stunned || rawBoss.status === 'stunned' || value.bossStunned),
      effects: normalizeEffects(rawBoss.effects || rawBoss.statusEffects || rawBoss.statuses),
    },
    squad: rawSquad.slice(0, 3).map((member, index) => {
      const maxHp = Math.max(1, Number(member.maxHp) || 100);
      return {
        ...member,
        cardId: String(member.cardId || member.id || ''),
        enhancement: clamp(member.enhancement, 0, 5),
        hp: clamp(member.hp ?? 100, 0, maxHp),
        maxHp,
        skillCooldown: Math.max(0, Number(member.skillCooldown ?? member.cooldownRemaining ?? member.cooldown) || 0),
        shield: Math.max(0, Number(member.shield) || 0),
        effects: normalizeEffects(member.effects || member.statusEffects || member.statuses),
        slot: index + 1,
      };
    }),
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
