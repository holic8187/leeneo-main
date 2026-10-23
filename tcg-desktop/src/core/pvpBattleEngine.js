import * as raidEngine from './turnRaidEngine.js';
import { PVP_RULES } from './pvpRules.js';
import { characterIdForCard } from './cooperativeRaidRules.js';

const clone = value => JSON.parse(JSON.stringify(value));
const living = card => card.hp > 0;
const log = (state, type, message, extra = {}) => {
  state.log.push({ index: state.logIndex++, type, message, ...extra });
  if (state.log.length > 160) state.log = state.log.slice(-160);
};
function nextCard(team, from = team.cursor) {
  for (let offset = 0; offset < team.cards.length; offset += 1) {
    const index = (from + offset) % team.cards.length;
    if (living(team.cards[index])) return index;
  }
  return -1;
}
function finishIfNeeded(state, now) {
  const alive = state.teams.map(team => team.cards.some(living));
  if (alive.every(Boolean) && state.actionCount < PVP_RULES.maxActions) return false;
  state.status = 'finished';
  state.winnerAccountId = alive[0] !== alive[1] ? state.teams[alive[0] ? 0 : 1].accountId : '';
  state.terminationReason = alive.every(Boolean) ? 'action-limit' : state.winnerAccountId ? 'team-defeated' : 'mutual-defeat';
  state.finishedAt = now; state.turnDeadlineAt = null; state.activeTeam = -1; state.activeCardIndex = -1;
  log(state, 'pvp-finish', state.winnerAccountId ? '승부가 결정되었습니다.' : '무승부로 종료되었습니다.', { winnerAccountId: state.winnerAccountId });
  return true;
}
function setTurn(state, teamIndex, now) {
  state.activeTeam = teamIndex;
  const team = state.teams[teamIndex];
  state.activeCardIndex = nextCard(team);
  // A later slot can be defeated while the other team acts. The new round
  // begins only when the next surviving slot actually wraps back to the front.
  if (state.activeCardIndex < team.cursor) team.round += 1;
  team.cursor = state.activeCardIndex;
  state.turnStartedAt = now; state.turnDeadlineAt = now + PVP_RULES.turnMs;
}

export function createPvpBattle({ players, seed = 1, now = Date.now() } = {}) {
  if (!Array.isArray(players) || players.length !== 2 || !players.every(player => player.accountId)
    || players[0].accountId === players[1].accountId) throw new Error('서로 다른 두 플레이어가 필요합니다.');
  const teams = players.map(player => {
    if (player.cards?.length !== 4 || new Set(player.cards.map(card => characterIdForCard(card.cardId || card.id))).size !== 4) {
      throw new Error('서로 다른 인물의 카드 4장이 필요합니다.');
    }
    const prepared = raidEngine.createRaidBattle({ cards: player.cards.map((card, index) => ({ ...card,
      instanceId: `pvp:${player.accountId}:${index}`, attack: Math.max(1, Number(card.attack || card.combatPower) * PVP_RULES.attackMultiplier),
      maxHp: Math.max(1, Number(card.maxHp) || 100) * PVP_RULES.hpMultiplier,
    })), now, seed }).cards;
    return { accountId: String(player.accountId), nickname: String(player.nickname || ''), rating: Number.isFinite(Number(player.rating)) ? Math.max(0, Number(player.rating)) : PVP_RULES.startingRating,
      cards: prepared, teamStatuses: [], lastCopyableSkill: null, runtime: {}, cursor: 0,
      round: 1, playerActionCount: 0, breakGauge: 0, skipTurns: 0 };
  });
  const state = { version: 1, mode: 'pvp', status: 'active', teams, seed: seed >>> 0 || 1,
    actionCount: 0, activeTeam: -1, activeCardIndex: -1, log: [], logIndex: 0,
    startedAt: now, finishedAt: null, winnerAccountId: '', terminationReason: null };
  const first = teams[0].rating <= teams[1].rating ? 0 : 1;
  setTurn(state, first, now);
  log(state, 'pvp-start', `${teams[first].nickname || '낮은 점수의 플레이어'}부터 시작합니다.`);
  return state;
}

export function performPvpAction(input, action = {}, now = Date.now(), resolveAction = raidEngine.resolvePvpCardAction) {
  const state = clone(input);
  if (state.status !== 'active') throw new Error('이미 종료된 대전입니다.');
  if (typeof resolveAction !== 'function') throw new Error('공유 PvP 전투 기능을 준비하고 있습니다.');
  const teamIndex = state.activeTeam, enemyIndex = 1 - teamIndex;
  const team = state.teams[teamIndex], enemy = state.teams[enemyIndex];
  const actorIndex = nextCard(team, state.activeCardIndex);
  if (actorIndex < 0) { finishIfNeeded(state, now); return state; }
  const target = action.targetId ? enemy.cards.find(card => card.id === action.targetId && living(card)) : enemy.cards.find(living);
  if (!target) throw new Error('행동할 적 대상을 선택해주세요.');
  if (action.allyTargetId && !team.cards.some(card => card.id === action.allyTargetId && living(card))) throw new Error('아군 대상을 다시 선택해주세요.');
  const resolved = resolveAction({ ...team.runtime, runtime: team.runtime, enemyRuntime: enemy.runtime,
    cards: team.cards, enemies: enemy.cards, teamStatuses: team.teamStatuses, enemyTeamStatuses: enemy.teamStatuses,
    lastCopyableSkill: team.lastCopyableSkill, enemyLastCopyableSkill: enemy.lastCopyableSkill,
    actorIndex, seed: state.seed, round: team.round, playerActionCount: team.playerActionCount,
    enemyBreakGauge: enemy.breakGauge, enemyStunned: enemy.skipTurns > 0,
  }, { ...action, type: action.type === 'skill' ? 'skill' : 'basic', targetId: target.id }, now);
  const { cards, enemies, teamStatuses, enemyTeamStatuses, lastCopyableSkill, enemyLastCopyableSkill,
    seed, breakDamage = 0, selfBreakDamage = 0, log: events = [], runtime, enemyRuntime, ...extra } = resolved;
  if (!Array.isArray(cards) || !Array.isArray(enemies) || cards.length !== 4 || enemies.length !== 4) throw new Error('PvP 전투 상태를 확인할 수 없습니다.');
  team.cards = cards; enemy.cards = enemies;
  team.teamStatuses = teamStatuses || []; enemy.teamStatuses = enemyTeamStatuses || [];
  team.lastCopyableSkill = lastCopyableSkill ?? team.lastCopyableSkill;
  enemy.lastCopyableSkill = enemyLastCopyableSkill ?? enemy.lastCopyableSkill;
  team.runtime = { ...team.runtime, ...extra, ...(runtime || {}) };
  enemy.runtime = { ...enemy.runtime, ...(enemyRuntime || {}) };
  state.seed = Number(seed) >>> 0 || state.seed;
  for (const event of events) log(state, event.type || 'pvp-effect', event.message || '', { ...event, index: state.logIndex, teamIndex });
  enemy.breakGauge += Math.max(0, Number(breakDamage) || 0);
  if (enemy.breakGauge >= PVP_RULES.breakMaximum) {
    enemy.breakGauge = 0; enemy.skipTurns += 1;
    log(state, 'pvp-break', `${enemy.nickname || '상대'}의 다음 차례를 끊었습니다.`, { teamIndex: enemyIndex });
  }
  team.breakGauge += Math.max(0, Number(selfBreakDamage) || 0);
  if (team.breakGauge >= PVP_RULES.breakMaximum) {
    team.breakGauge = 0; team.skipTurns += 1;
    log(state, 'pvp-break', `${team.nickname || '아군'}의 다음 차례가 끊겼습니다.`, { teamIndex });
  }
  team.playerActionCount += 1; state.actionCount += 1;
  team.cursor = (actorIndex + 1) % 4;
  if (team.cursor === 0) team.round += 1;
  if (finishIfNeeded(state, now)) return state;
  let next = enemyIndex;
  for (let attempts = 0; attempts < 4 && state.teams[next].skipTurns > 0; attempts += 1) {
    state.teams[next].skipTurns -= 1;
    log(state, 'pvp-skip', `${state.teams[next].nickname || '상대'}의 차례가 브레이크로 넘어갑니다.`, { teamIndex: next });
    next = 1 - next;
  }
  setTurn(state, next, now);
  return state;
}

export function advancePvpTimeouts(input, now = Date.now(), resolveAction = raidEngine.resolvePvpCardAction) {
  let state = input;
  for (let steps = 0; state.status === 'active' && state.turnDeadlineAt <= now && steps < PVP_RULES.maxActions; steps += 1) {
    state = performPvpAction(state, { type: 'basic', automatic: true }, state.turnDeadlineAt, resolveAction);
  }
  return state;
}
