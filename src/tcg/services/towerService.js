'use strict';
const { randomInt, randomUUID } = require('node:crypto');
const { assertActivePlaySession } = require('./playerStateService');
const { validatePersonalRaidSquad } = require('./personalRaidService');
const { settleTowerRewards } = require('./towerRewardService');
const { loadTowerModules } = require('./towerModules');
const { normalizeBattleOptions } = require('./battleRequestOptions');
const lean = value => typeof value?.lean === 'function' ? value.lean() : value;
const plain = value => typeof value?.toObject === 'function' ? value.toObject() : value;
const clone = value => structuredClone(value);
const secureRandom = () => randomInt(0x100000000) / 0x100000000;

class TowerError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'TowerError'; this.code = code; this.status = status; }
}

function publicTower(record, rules, now, rewardTiers) {
  const window = rules.towerMonthWindow(now);
  const battle = record.battle ? clone(record.battle) : null;
  if (battle) { delete battle.seed; battle.log = battle.log.slice(-100); }
  return { seasonKey: record.seasonKey, resetsAt: window.resetsAt, serverNow: now, revision: record.revision,
    floor: record.clearedFloor + 1, clearedFloor: record.clearedFloor, bestProgress: record.bestProgress, rankingScore: record.rankingScore,
    augments: record.augments, offer: record.offer, attempts: record.attempts, battleId: record.battleId, battle,
    phase: battle && battle.status !== 'finished' ? 'battle' : record.offer ? 'augment' : 'ready',
    nextBoss: rules.towerBossForFloor(record.clearedFloor + 1), rewardTiers: rewardTiers || rules.TOWER_MONTHLY_REWARD_TIERS,
  };
}

function recordBattleResult(record, modules, random) {
  const battle = record.battle;
  if (!battle || battle.status !== 'finished' || battle.tower.recorded) return;
  battle.tower.recorded = true;
  if (battle.result === 'victory') {
    record.clearedFloor += 1;
    record.bestProgress = 0;
    if (record.clearedFloor % 5 === 0) record.offer = modules.augments.createTowerOffer(record.clearedFloor, random);
  } else {
    // Actual boss HP removed is used, not reported totals (which can include
    // shield damage). Replaying a failed floor cannot farm ranking points.
    record.bestProgress = Math.max(record.bestProgress, Math.min(999999, Math.floor((1 - battle.boss.hp / battle.boss.maxHp) * 1000000)));
  }
  record.rankingScore = modules.rules.towerRankingScore(record.clearedFloor, record.bestProgress);
}

function advanceDueBattle(record, modules, now, random) {
  let changed = false;
  // Replay missed deadlines using their original times. Reopening the app
  // cannot grant a fresh 20-second timer to every already expired action.
  for (let step = 0; step < 256; step += 1) {
    const battle = record.battle;
    if (!battle || battle.status !== 'active') break;
    const automatic = ['boss', 'follow-up'].includes(battle.currentActor);
    const dueAt = automatic ? battle.turnStartedAt + 1000 : battle.turnDeadlineAt;
    if (!Number.isFinite(dueAt) || now < dueAt) break;
    record.battle = modules.battle.stepTowerBattle(battle, { type: automatic ? 'advance' : 'timeout' }, dueAt);
    recordBattleResult(record, modules, random);
    changed = true;
  }
  return changed;
}

function createTowerService({ TcgTowerSeason, TcgPlayerState, now: clock = Date.now, random = secureRandom, rewardTiers } = {}) {
  async function prepare(account, now, modules) {
    const accountId = account._id || account.id;
    const { seasonKey } = modules.rules.towerMonthWindow(now);
    // Paying finished months never depends on a client copying old progress.
    await settleTowerRewards({ TcgTowerSeason, TcgPlayerState, accountId, now, rewardTiers });
    if (modules.rules.towerMonthWindow(clock()).seasonKey !== seasonKey) throw new TowerError('TOWER_SEASON_CHANGED', '새로운 달이 시작되었습니다. 탑 기록을 다시 불러와 주세요.', 409);
    const key = { accountId, seasonKey };
    try { await TcgTowerSeason.updateOne(key, { $setOnInsert: { ...key, nickname: String(account.nickname || ''), revision: 0, clearedFloor: 0, bestProgress: 0, rankingScore: 0, augments: [], offer: modules.augments.createTowerOffer(0, random), battle: null, battleId: '', attempts: 0, rankingFrozenAt: null, rankingRewardSettledAt: null, rankingRewardRetryAt: null, rankingReward: null } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    return plain(await lean(TcgTowerSeason.findOne(key)));
  }

  async function commit(previous, next, modules) {
    if (modules.rules.towerMonthWindow(clock()).seasonKey !== previous.seasonKey) throw new TowerError('TOWER_SEASON_CHANGED', '이번 달의 탑 도전이 종료되었습니다. 새 달 기록을 불러와 주세요.', 409);
    const fields = ['nickname', 'clearedFloor', 'bestProgress', 'rankingScore', 'augments', 'offer', 'battle', 'battleId', 'attempts'];
    const updated = await TcgTowerSeason.findOneAndUpdate({ _id: previous._id, revision: previous.revision, rankingFrozenAt: null }, {
      $set: Object.fromEntries(fields.map(key => [key, next[key]])), $inc: { revision: 1 },
    }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new TowerError('TOWER_CONFLICT', '다른 요청에서 탑 기록이 변경되었습니다. 최신 상태를 불러와 주세요.', 409);
    return plain(updated);
  }

  async function state({ account } = {}) {
    const modules = await loadTowerModules(), now = clock();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const record = await prepare(account, now, modules), next = clone(record);
      if (!advanceDueBattle(next, modules, now, random)) return { tower: publicTower(record, modules.rules, now, rewardTiers) };
      try { return { tower: publicTower(await commit(record, next, modules), modules.rules, now, rewardTiers) }; }
      catch (error) { if (error.code !== 'TOWER_CONFLICT' || attempt === 2) throw error; }
    }
  }

  async function mutate(operation, { account, request = {} } = {}) {
    const modules = await loadTowerModules(), now = clock(), accountId = account._id || account.id;
    const player = await assertActivePlaySession({ TcgPlayerState, accountId, request, now });
    const record = await prepare(account, now, modules);
    if (request.seasonKey !== record.seasonKey) throw new TowerError('TOWER_SEASON_CHANGED', '탑의 월간 기록을 다시 불러와 주세요.', 409);
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision !== record.revision) throw new TowerError('TOWER_CONFLICT', '탑 기록이 변경되었습니다. 최신 상태에서 다시 시도해 주세요.', 409);
    const next = clone(record); next.nickname = String(account.nickname || record.nickname || '');
    const engaged = next.battle && next.battle.status !== 'finished';
    if (operation === 'choose' || operation === 'reroll') {
      if (engaged || !next.offer) throw new TowerError('TOWER_NO_OFFER', '지금 선택할 증강이 없습니다.', 409);
      if (operation === 'choose') {
        const id = String(request.augmentId || '');
        if (!next.offer.options.includes(id)) throw new TowerError('TOWER_INVALID_AUGMENT', '제시된 증강 중 하나를 골라 주세요.');
        next.augments.push(id); next.offer = null;
      } else {
        try { next.offer = modules.augments.rerollTowerOffer(next.offer, request.slot, random); }
        catch (error) { throw new TowerError('TOWER_REROLL_USED', error.message, 409); }
      }
    } else if (operation === 'enter') {
      if (engaged || next.offer) throw new TowerError('TOWER_NOT_READY', next.offer ? '먼저 증강을 선택해 주세요.' : '이미 진행 중인 탑 전투가 있습니다.', 409);
      const verified = validatePersonalRaidSquad({ playerState: player.state, squad: request.squad, now });
      const cards = verified.squad.map(card => {
        const catalog = modules.catalog.cardById(card.cardId);
        return { ...card, name: catalog.name, image: catalog.image, attack: card.power, maxHp: modules.progression.cardMaxHpAtLevel(card.cardId, player.state.cardProgression) };
      });
      const boss = modules.rules.towerBossForFloor(next.clearedFloor + 1);
      boss.image = modules.catalog.cardById('deadline-dragon')?.image || boss.image;
      next.battle = modules.battle.createTowerBattle({ cards, boss, augments: next.augments, seed: Math.floor(random() * 0x100000000) || 1, now });
      next.battleId = randomUUID(); next.attempts += 1;
    } else if (operation === 'action') {
      if (!engaged || request.battleId !== next.battleId) throw new TowerError('TOWER_BATTLE_CHANGED', '진행 중인 탑 전투를 다시 불러와 주세요.', 409);
      const action = request.action || {};
      if (!['start', 'basic', 'skill'].includes(action.type)) throw new TowerError('TOWER_INVALID_ACTION', '사용할 수 없는 전투 행동입니다.');
      if (action.type === 'start' && next.battle.status !== 'ready') throw new TowerError('TOWER_ALREADY_STARTED', '이미 시작된 전투입니다.', 409);
      if (action.type !== 'start' && (next.battle.currentActor !== 'card' || now >= next.battle.turnDeadlineAt)) throw new TowerError('TOWER_TURN_EXPIRED', '행동 차례가 변경되었습니다. 전투를 새로 불러와 주세요.', 409);
      try { next.battle = modules.battle.stepTowerBattle(next.battle, { type: action.type, targetId: typeof action.targetId === 'string' && action.targetId.length <= 128 ? action.targetId : '', ...normalizeBattleOptions(action) }, now); }
      catch (error) { throw new TowerError('TOWER_INVALID_ACTION', error.message, 409); }
      recordBattleResult(next, modules, random);
    } else if (operation === 'abandon') {
      if (!engaged || request.battleId !== next.battleId) throw new TowerError('TOWER_BATTLE_CHANGED', '진행 중인 전투가 없습니다.', 409);
      Object.assign(next.battle, { status: 'finished', result: 'abandoned', terminationReason: 'abandoned', currentActor: null, currentActorIndex: null, turnDeadlineAt: null, finishedAt: now });
      recordBattleResult(next, modules, random);
    } else throw new TowerError('TOWER_INVALID_ACTION', '지원하지 않는 요청입니다.');
    // Re-check the active device after potentially expensive imports/settlement.
    await assertActivePlaySession({ TcgPlayerState, accountId, request, now: clock() });
    return { tower: publicTower(await commit(record, next, modules), modules.rules, clock(), rewardTiers) };
  }

  async function ranking({ account, request = {} } = {}) {
    const modules = await loadTowerModules(), now = clock(), own = await prepare(account, now, modules);
    const rows = await lean(TcgTowerSeason.find({ seasonKey: own.seasonKey, rankingScore: { $gt: 0 } }).sort({ rankingScore: -1, _id: 1 }).limit(Math.max(1, Math.min(100, Number(request.limit) || 50))));
    let rank = 0, previous = -1;
    const entries = rows.map((row, index) => { if (row.rankingScore !== previous) rank = index + 1; previous = row.rankingScore; return { rank, nickname: row.nickname, clearedFloor: row.clearedFloor, bestProgress: row.bestProgress, score: row.rankingScore, own: String(row.accountId) === String(own.accountId) }; });
    const ownRank = own.rankingScore > 0 ? 1 + await TcgTowerSeason.countDocuments({ seasonKey: own.seasonKey, rankingScore: { $gt: own.rankingScore } }) : null;
    return { ranking: { seasonKey: own.seasonKey, resetsAt: modules.rules.towerMonthWindow(now).resetsAt, entries, ownRank, rewardTiers: rewardTiers || modules.rules.TOWER_MONTHLY_REWARD_TIERS } };
  }
  return { state, ranking, ...Object.fromEntries(['choose', 'reroll', 'enter', 'action', 'abandon'].map(operation => [operation, input => mutate(operation, input)])) };
}
module.exports = { TowerError, createTowerService, publicTower, recordBattleResult, advanceDueBattle };
