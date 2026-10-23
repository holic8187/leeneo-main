'use strict';

const { randomUUID, randomInt } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { assertActivePlaySession, normalizeGameState, serializePlayerState, PlayerStateError, PLAYER_LEASE_DURATION_MS } = require('./playerStateService');
const { normalizeBattleOptions } = require('./battleRequestOptions');
const COORDINATOR_ID = 'pvp-v1';
const MAX_QUEUE = 128, MAX_ROOMS = 32, MAX_CAS = 12;
const clone = value => JSON.parse(JSON.stringify(value));
const accountId = account => String(account?._id || account?.id || '');
const lean = value => value && typeof value.lean === 'function' ? value.lean() : value;
const plain = value => value?.toObject ? value.toObject() : value;
const secureRandom = () => randomInt(0x100000000) / 0x100000000;
class PvpError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'PvpError'; this.code = code; this.status = status; }
}
let sharedPromise;
function loadPvpModules() {
  sharedPromise ||= Promise.all(['core/pvpRules.js', 'core/pvpBattleEngine.js', 'data/cardCatalog.js', 'core/cardProgression.js', 'core/cooperativeRaidRules.js']
    .map(file => import(pathToFileURL(path.resolve(__dirname, '../../../tcg-desktop/src', file)).href)))
    .then(([rules, engine, catalog, progression, cooperative]) => ({ rules, engine, catalog, progression, cooperative }))
    .catch(error => { sharedPromise = null; throw error; });
  return sharedPromise;
}

function validatePvpDeck(state, descriptors, shared, id, now) {
  if (!Array.isArray(descriptors) || descriptors.length !== 4) throw new PvpError('PVP_FOUR_CARDS_REQUIRED', '대전 덱에 카드 4장을 편성해주세요.');
  const seen = new Set();
  return descriptors.map(descriptor => {
    const cardId = String(descriptor?.cardId || ''), enhancement = Number(descriptor?.enhancement);
    const card = shared.catalog.cardById(cardId);
    const characterId = shared.cooperative.characterIdForCard(cardId);
    if (!card || !Number.isSafeInteger(enhancement) || enhancement < 0 || enhancement > 5 || seen.has(characterId)) {
      throw new PvpError('PVP_INVALID_DECK', '서로 다른 인물의 보유 카드를 선택해주세요.');
    }
    seen.add(characterId);
    const counts = Array(6).fill(0);
    let remaining = Math.max(0, Math.floor(Number(state?.collection?.[cardId]) || 0));
    for (let stage = 5; stage >= 1; stage -= 1) {
      counts[stage] = Math.min(remaining, Math.max(0, Math.floor(Number(state?.cardEnhancements?.[cardId]?.[stage]) || 0)));
      remaining -= counts[stage];
    }
    counts[0] = remaining;
    if (state?.expedition?.endsAt > now && state.expedition.squad?.includes(cardId)) {
      let locked = Number(state.expedition.enhancementStages?.[cardId]);
      if (!Number.isSafeInteger(locked) || locked < 0 || locked > 5) locked = counts.findLastIndex(count => count > 0);
      if (locked >= 0) counts[locked] -= 1;
    }
    if (counts[enhancement] <= 0) throw new PvpError('PVP_CARD_UNAVAILABLE', '보유하지 않았거나 모험 중인 카드가 있습니다.', 409);
    const enhanced = Math.round(card.combatPower * (1 + [0, .04, .10, .18, .28, .40][enhancement]));
    return { cardId, characterId, enhancement, instanceId: `pvp:${id}:${cardId}`, name: card.name, rarity: card.rarity, image: card.image,
      attack: shared.progression.cardCombatPowerAtLevel(enhanced, cardId, state.cardProgression),
      maxHp: shared.progression.cardMaxHpAtLevel(cardId, state.cardProgression) };
  });
}

function createPvpService({ TcgPvp, TcgPlayerState, modules: suppliedModules, random = secureRandom, rewardPolicy } = {}) {
  const modules = () => suppliedModules ? Promise.resolve(suppliedModules) : loadPvpModules();
  const session = (account, request, now) => assertActivePlaySession({ TcgPlayerState, accountId: accountId(account), request, now });
  const record = async query => plain(await lean(TcgPvp.findOne(query)));
  const player = async id => plain(await lean(TcgPlayerState.findOne({ accountId: id })));
  async function insert(id, data) {
    try { await TcgPvp.updateOne({ _id: id }, { $setOnInsert: { revision: 0, data } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  async function profile(id, nickname, season, shared) {
    const key = `rating:${season.key}:${id}`;
    await insert(key, { kind: 'rating', accountId: id, nickname, seasonKey: season.key,
      rating: shared.rules.PVP_RULES.startingRating, wins: 0, losses: 0, draws: 0, settledMatches: [] });
    return record({ _id: key });
  }
  async function settleRating(room, participant, shared) {
    const season = { key: room.seasonKey };
    for (let attempt = 0; attempt < MAX_CAS; attempt += 1) {
      const current = await profile(participant.accountId, participant.nickname, season, shared);
      if (current.data.settledMatches.includes(room.id)) return;
      const outcome = room.outcomes[participant.accountId];
      const data = { ...current.data, nickname: participant.nickname,
        rating: Math.max(0, current.data.rating + outcome.ratingDelta),
        wins: current.data.wins + (outcome.result === 'victory' ? 1 : 0),
        losses: current.data.losses + (outcome.result === 'defeat' ? 1 : 0),
        draws: current.data.draws + (outcome.result === 'draw' ? 1 : 0),
        settledMatches: [...current.data.settledMatches, room.id] };
      if (await TcgPvp.findOneAndUpdate({ _id: current._id, revision: current.revision }, { $set: { data }, $inc: { revision: 1 } }, { returnDocument: 'after' })) return;
    }
    throw new PvpError('PVP_RATING_BUSY', '대전 점수를 저장하고 있습니다. 잠시 후 다시 확인해주세요.', 409);
  }
  function finish(room, now, shared) {
    if (room.battle.status !== 'finished' || room.outcomes) return;
    room.finishedAt = now; room.outcomes = {};
    for (const participant of room.participants) {
      const opponent = room.participants.find(entry => entry.accountId !== participant.accountId);
      const result = shared.rules.pvpResultFor(room.battle, participant.accountId);
      const coins = Math.max(0, Math.floor(Number((rewardPolicy || shared.rules.PVP_RULES.rewards)[result]) || 0));
      room.outcomes[participant.accountId] = { result, coins,
        ratingDelta: shared.rules.pvpRatingDelta(participant.rating, opponent.rating, result) };
    }
  }
  async function archive(room, shared) {
    await insert(`archive:${room.id}`, { kind: 'archive', ...room });
    for (const participant of room.participants) await settleRating(room, participant, shared);
  }
  function requeue(data, match, now, excluded = '') {
    for (const participant of match.players) if (participant.accountId !== excluded && match.acceptedAccountIds.includes(participant.accountId)) {
      data.queue.push({ ...participant, lastSeenAt: now });
    }
    data.matches = data.matches.filter(entry => entry.id !== match.id);
  }
  function matchPlayers(data, now, shared) {
    while (data.queue.length > 1 && data.rooms.length + data.matches.length < MAX_ROOMS) {
      const pair = shared.rules.findPvpPair(data.queue, now);
      if (!pair) break;
      data.matches.push({ id: randomUUID(), players: pair, acceptedAccountIds: [], createdAt: now, expiresAt: now + shared.rules.PVP_RULES.readyMs });
      const ids = pair.map(entry => entry.accountId);
      data.queue = data.queue.filter(entry => !ids.includes(entry.accountId));
    }
  }
  async function mutate(now, operation, heartbeat = '', revalidate = null) {
    await insert(COORDINATOR_ID, { kind: 'coordinator', queue: [], matches: [], rooms: [] });
    const shared = await modules();
    for (let attempt = 0; attempt < MAX_CAS; attempt += 1) {
      const snapshot = await record({ _id: COORDINATOR_ID });
      // Only already-committed outcomes may enter the archive or change rating.
      for (const room of snapshot.data.rooms.filter(entry => entry.battle.status === 'finished')) await archive(room, shared);
      const data = clone(snapshot.data);
      data.rooms = data.rooms.filter(entry => entry.battle.status !== 'finished');
      for (const match of [...data.matches]) if (match.expiresAt <= now) requeue(data, match, now);
      const season = shared.rules.pvpSeasonAt(now);
      data.queue = data.queue.filter(entry => now - entry.lastSeenAt < shared.rules.PVP_RULES.queueTtlMs && entry.seasonKey === season.key);
      for (const match of [...data.matches]) if (match.players.some(entry => entry.seasonKey !== season.key)) data.matches = data.matches.filter(entry => entry.id !== match.id);
      const queued = data.queue.find(entry => entry.accountId === heartbeat);
      if (queued && now - queued.lastSeenAt >= 15_000) queued.lastSeenAt = now;
      for (const room of data.rooms) {
        const before = room.battle.actionCount;
        room.battle = shared.engine.advancePvpTimeouts(room.battle, now);
        room.revision += room.battle.actionCount - before;
        finish(room, now, shared);
      }
      matchPlayers(data, now, shared);
      const result = await operation(data, shared);
      // A device takeover can happen while archive/rating/deck reads await DB.
      // Recheck the submitting session on every CAS attempt before its writes.
      if (revalidate) await revalidate();
      if (JSON.stringify(data) === JSON.stringify(snapshot.data)) return { data, result };
      if (await TcgPvp.findOneAndUpdate({ _id: COORDINATOR_ID, revision: snapshot.revision }, { $set: { data }, $inc: { revision: 1 } }, { returnDocument: 'after' })) {
        // Rating can be recovered from this committed room if the process exits here.
        for (const room of data.rooms.filter(entry => entry.battle.status === 'finished')) await archive(room, shared);
        return { data, result };
      }
    }
    throw new PvpError('PVP_BUSY', '대전 요청이 겹쳤습니다. 잠시 후 다시 시도해주세요.', 409);
  }
  const owns = (room, id) => room?.participants.some(entry => entry.accountId === id);
  const currentRoom = (data, id) => data.rooms.find(room => owns(room, id));
  async function pendingArchive(id) {
    const saved = await player(id);
    const excluded = (saved?.pvpRewardClaims || []).map(roomId => `archive:${roomId}`);
    return (await record({ 'data.kind': 'archive', 'data.participants.accountId': id, _id: { $nin: excluded } }))?.data || null;
  }
  function publicRoom(room, id) {
    return { id: room.id, revision: room.revision, seasonKey: room.seasonKey, participants: room.participants,
      battle: room.battle, activeAccountId: room.battle.status === 'active' ? room.battle.teams[room.battle.activeTeam].accountId : '',
      turnExpiresAt: room.battle.turnDeadlineAt, outcome: room.outcomes?.[id] || null };
  }
  async function response(data, account, now, extra = {}) {
    const shared = await modules(), id = accountId(account), season = shared.rules.pvpSeasonAt(now);
    const standing = await profile(id, String(account.nickname || ''), season, shared);
    const pvp = { phase: 'idle', accountId: id, serverNow: now, rating: standing.data.rating,
      season: { ...season, rewardPolicy: shared.rules.PVP_RULES.seasonRewardPolicy }, rewards: rewardPolicy || shared.rules.PVP_RULES.rewards };
    const room = currentRoom(data, id) || await pendingArchive(id);
    if (room) { pvp.phase = room.battle.status === 'finished' ? 'finished' : 'battle'; pvp.room = publicRoom(room, id); }
    else {
      const match = data.matches.find(entry => entry.players.some(person => person.accountId === id));
      const queued = data.queue.find(entry => entry.accountId === id);
      if (match) { pvp.phase = 'ready'; pvp.match = { id: match.id, expiresAt: match.expiresAt, acceptedAccountIds: match.acceptedAccountIds,
        players: match.players.map(({ accountId, nickname, rating, cards }) => ({ accountId, nickname, rating, cards })) }; }
      else if (queued) { pvp.phase = 'queued'; pvp.queue = { queuedAt: queued.queuedAt, ratingGap: shared.rules.pvpMatchGap(queued, now), cards: queued.cards }; }
    }
    return { pvp, ...extra };
  }
  async function state({ account, now = Date.now() }) {
    const { data } = await mutate(now, () => null, accountId(account));
    return response(data, account, now);
  }
  async function queue({ account, request = {}, now = Date.now() }) {
    const saved = await session(account, request, now), id = accountId(account), shared = await modules();
    const cards = validatePvpDeck(saved.state, request.cards, shared, id, now);
    if (await pendingArchive(id)) throw new PvpError('PVP_REWARD_PENDING', '지난 대전 보상을 먼저 받아주세요.', 409);
    const season = shared.rules.pvpSeasonAt(now), standing = await profile(id, account.nickname, season, shared);
    const { data } = await mutate(now, async current => {
      if (currentRoom(current, id) || current.matches.some(match => match.players.some(p => p.accountId === id))) throw new PvpError('PVP_ALREADY_PARTICIPATING', '진행 중인 대전을 먼저 완료해주세요.', 409);
      if (await pendingArchive(id)) throw new PvpError('PVP_REWARD_PENDING', '지난 대전 보상을 먼저 받아주세요.', 409);
      const previous = current.queue.find(entry => entry.accountId === id);
      if (!previous && current.queue.length >= MAX_QUEUE) throw new PvpError('PVP_QUEUE_FULL', '대기열이 가득 찼습니다.', 503);
      current.queue = current.queue.filter(entry => entry.accountId !== id);
      current.queue.push({ accountId: id, nickname: String(account.nickname || ''), cards, rating: standing.data.rating, seasonKey: season.key,
        leaseId: request.leaseId, generation: Number(request.generation), queuedAt: previous?.queuedAt || now, lastSeenAt: now });
      matchPlayers(current, now, shared);
    }, '', () => session(account, request, now));
    return response(data, account, now);
  }
  async function leave({ account, request = {}, now = Date.now() }) {
    await session(account, request, now); const id = accountId(account);
    const { data } = await mutate(now, current => {
      if (currentRoom(current, id)) throw new PvpError('PVP_BATTLE_ACTIVE', '전투는 재접속하여 이어갈 수 있습니다.', 409);
      current.queue = current.queue.filter(entry => entry.accountId !== id);
      const match = current.matches.find(entry => entry.players.some(p => p.accountId === id));
      if (match) requeue(current, match, now, id);
    }, '', () => session(account, request, now));
    return response(data, account, now);
  }
  async function accept({ account, request = {}, now = Date.now() }) {
    await session(account, request, now); const id = accountId(account);
    const { data } = await mutate(now, async (current, shared) => {
      if (current.rooms.some(room => room.matchId === request.matchId && owns(room, id))) return;
      const match = current.matches.find(entry => entry.id === request.matchId && entry.players.some(p => p.accountId === id));
      if (!match || match.expiresAt <= now) throw new PvpError('PVP_MATCH_EXPIRED', '입장 확인 시간이 지났습니다.', 409);
      if (!match.acceptedAccountIds.includes(id)) match.acceptedAccountIds.push(id);
      if (match.acceptedAccountIds.length !== 2) return;
      for (const p of match.players) {
        const saved = await player(p.accountId);
        try {
          if (saved?.activeLease?.leaseId !== p.leaseId || Number(saved?.activeLease?.generation) !== p.generation || new Date(saved?.activeLease?.expiresAt).getTime() <= now) {
            throw new PvpError('PVP_SESSION_CHANGED', '참가자의 접속 상태가 변경되었습니다.', 409);
          }
          p.cards = validatePvpDeck(saved.state, p.cards, shared, p.accountId, now);
          const standing = await profile(p.accountId, p.nickname, { key: p.seasonKey }, shared);
          p.rating = standing.data.rating;
        } catch (error) {
          if (!(error instanceof PvpError)) throw error;
          requeue(current, match, now, p.accountId); return;
        }
      }
      const battle = shared.engine.createPvpBattle({ players: match.players, seed: Math.floor(random() * 0x100000000) || 1, now });
      current.rooms.push({ id: randomUUID(), matchId: match.id, revision: 0, seasonKey: match.players[0].seasonKey,
        participants: match.players.map(({ accountId, nickname, rating }) => ({ accountId, nickname, rating })),
        battle, startedAt: now, finishedAt: null, actionReceipts: [], outcomes: null });
      current.matches = current.matches.filter(entry => entry.id !== match.id);
    }, '', () => session(account, request, now));
    return response(data, account, now);
  }
  async function action({ account, request = {}, now = Date.now() }) {
    await session(account, request, now); const id = accountId(account);
    if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(String(request.actionId || '')) || !['basic', 'skill'].includes(request.action)) throw new PvpError('PVP_INVALID_ACTION', '행동 요청이 올바르지 않습니다.');
    let options;
    try { options = normalizeBattleOptions(request); }
    catch (error) { throw new PvpError('PVP_INVALID_ACTION', error.message); }
    const { data } = await mutate(now, async (current, shared) => {
      const room = current.rooms.find(entry => entry.id === request.roomId) || (await record({ _id: `archive:${String(request.roomId || '')}` }))?.data;
      if (!owns(room, id)) throw new PvpError('PVP_ROOM_NOT_FOUND', '참가 중인 대전을 찾을 수 없습니다.', 404);
      const receipt = `${id}:${request.actionId}`;
      if (room.actionReceipts.includes(receipt)) return;
      if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision !== room.revision) throw new PvpError('PVP_STALE_TURN', '전투가 갱신되었습니다. 현재 차례를 확인해주세요.', 409);
      if (room.battle.status !== 'active' || room.battle.teams[room.battle.activeTeam].accountId !== id) throw new PvpError('PVP_NOT_YOUR_TURN', '상대 플레이어의 차례입니다.', 409);
      try {
        room.battle = shared.engine.performPvpAction(room.battle, { type: request.action, targetId: request.targetId,
          allyTargetId: request.allyTargetId, ...options }, now);
      } catch (error) { throw new PvpError('PVP_ACTION_UNAVAILABLE', error.message, 409); }
      room.revision += 1; room.actionReceipts.push(receipt); finish(room, now, shared);
    }, '', () => session(account, request, now));
    return response(data, account, now);
  }
  async function claim({ account, request = {}, now = Date.now() }) {
    await session(account, request, now); const id = accountId(account);
    const { data } = await mutate(now, () => null);
    const room = data.rooms.find(entry => entry.id === request.roomId) || (await record({ _id: `archive:${String(request.roomId || '')}` }))?.data;
    let saved = await player(id);
    if (!owns(room, id) || room.battle.status !== 'finished' || !room.outcomes?.[id]) throw new PvpError('PVP_REWARD_NOT_READY', '아직 받을 대전 보상이 없습니다.', 409);
    let alreadyClaimed = saved.pvpRewardClaims?.includes(room.id);
    if (!alreadyClaimed) {
      if (!Number.isSafeInteger(request.baseRevision) || request.baseRevision !== saved.revision) throw new PlayerStateError('SAVE_CONFLICT', '최신 기록을 불러온 후 보상을 다시 받아주세요.', 409, serializePlayerState(saved, now));
      const next = clone(saved.state); next.wallet ||= {};
      next.wallet.coins = Math.max(0, Number(next.wallet.coins) || 0) + room.outcomes[id].coins;
      const updated = await TcgPlayerState.findOneAndUpdate({ accountId: id, initialized: true, revision: request.baseRevision,
        pvpRewardClaims: { $ne: room.id }, 'activeLease.leaseId': request.leaseId, 'activeLease.deviceId': request.deviceId,
        'activeLease.generation': Number(request.generation), 'activeLease.expiresAt': { $gt: new Date(now) } },
      { $set: { state: normalizeGameState(next), 'activeLease.heartbeatAt': new Date(now), 'activeLease.expiresAt': new Date(now + PLAYER_LEASE_DURATION_MS) },
        $inc: { revision: 1 }, $push: { pvpRewardClaims: room.id } }, { returnDocument: 'after', runValidators: true });
      if (updated) saved = plain(updated);
      else {
        await session(account, request, now); saved = await player(id);
        if (!saved.pvpRewardClaims?.includes(room.id)) throw new PlayerStateError('SAVE_CONFLICT', '저장 기록이 바뀌었습니다. 다시 받아주세요.', 409, serializePlayerState(saved, now));
        alreadyClaimed = true;
      }
    }
    // The archived immutable outcome remains available for replay/reward retries.
    const fresh = await mutate(now, () => null);
    return response(fresh.data, account, now, { snapshot: serializePlayerState(saved, now), outcome: room.outcomes[id], alreadyClaimed: Boolean(alreadyClaimed) });
  }
  async function rankings({ account, now = Date.now() }) {
    const shared = await modules(), season = shared.rules.pvpSeasonAt(now);
    const { data } = await mutate(now, () => null);
    let query = TcgPvp.find({ 'data.kind': 'rating', 'data.seasonKey': season.key });
    if (typeof query.sort === 'function' && !Array.isArray(query)) query = query.sort({ 'data.rating': -1, 'data.wins': -1, _id: 1 }).limit(100);
    const rows = (await lean(query)).map(plain).map(row => row.data).sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.accountId.localeCompare(b.accountId)).slice(0, 100);
    let previousRating = null, rank = 0;
    const result = rows.map((row, index) => { if (row.rating !== previousRating) rank = index + 1; previousRating = row.rating;
      return { rank, accountId: row.accountId, nickname: row.nickname, rating: row.rating, wins: row.wins, losses: row.losses, draws: row.draws }; });
    return response(data, account, now, { rankings: result });
  }
  return { state, queue, leave, accept, action, claim, rankings };
}

module.exports = { COORDINATOR_ID, PvpError, loadPvpModules, validatePvpDeck, createPvpService };
