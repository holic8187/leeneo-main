'use strict';

const { randomUUID, randomInt } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const {
  assertActivePlaySession, normalizeGameState, serializePlayerState, PlayerStateError,
  PLAYER_LEASE_DURATION_MS
} = require('./playerStateService');
const { getKstDayWindow, getPersonalRaidState } = require('./personalRaidService');

const COORDINATOR_ID = 'cooperative-v1';
const MAX_QUEUE = 128;
const MAX_ROOMS = 64;
const QUEUE_TTL_MS = 90_000;
const READY_MS = 30_000;
const AUTO_ACTION_DELAY_MS = 1_000;
const MAX_CAS_ATTEMPTS = 12;
const clone = (value) => JSON.parse(JSON.stringify(value));
const accountKey = (account) => String(account?._id || account?.id || '');
const secureRandom = () => randomInt(0x100000000) / 0x100000000;

class CooperativeRaidError extends Error {
  constructor(code, message, status = 400) {
    super(message); this.name = 'CooperativeRaidError'; this.code = code; this.status = status;
  }
}

let sharedPromise;
function loadCooperativeModules() {
  sharedPromise ||= Promise.all([
    'core/cooperativeRaidRules.js', 'core/turnRaidEngine.js', 'data/cardCatalog.js',
    'core/cardProgression.js', 'core/equipment.js', 'core/relics.js', 'core/raidAutoBattle.js'
  ].map((file) => import(pathToFileURL(path.resolve(__dirname, '../../..', 'tcg-desktop/src', file)).href)))
    .then(([rules, engine, catalog, progression, equipment, relics, autoBattle]) => ({ rules, engine, catalog, progression, equipment, relics, autoBattle }))
    .catch((error) => { sharedPromise = null; throw error; });
  return sharedPromise;
}

async function lean(value) { return value && typeof value.lean === 'function' ? value.lean() : value; }
function plain(value) { return typeof value?.toObject === 'function' ? value.toObject() : value; }
function initialData(now) { return { queue: [], matches: [], rooms: [], entryDay: getKstDayWindow(now).dayKey, entries: {} }; }

function validateRepresentatives(playerState, cards, modules, accountId, now) {
  if (!Array.isArray(cards) || cards.length !== 3) throw new CooperativeRaidError('COOP_THREE_CARDS_REQUIRED', '서로 다른 인물의 대표 카드 3장을 선택해주세요.');
  const seen = new Set();
  return cards.map((descriptor) => {
    const cardId = String(descriptor?.cardId || '');
    const card = modules.catalog.cardById(cardId);
    const characterId = modules.rules.characterIdForCard(cardId);
    const enhancement = Number(descriptor?.enhancement);
    if (!card || !Number.isSafeInteger(enhancement) || enhancement < 0 || enhancement > 5 || seen.has(characterId)) {
      throw new CooperativeRaidError('COOP_INVALID_REPRESENTATIVES', '대표 카드의 인물 또는 강화 정보가 올바르지 않습니다.');
    }
    seen.add(characterId);
    const counts = Array(6).fill(0);
    let remaining = Math.max(0, Math.floor(Number(playerState?.collection?.[cardId]) || 0));
    for (let level = 5; level >= 1; level -= 1) {
      counts[level] = Math.min(remaining, Math.max(0, Math.floor(Number(playerState?.cardEnhancements?.[cardId]?.[level]) || 0)));
      remaining -= counts[level];
    }
    counts[0] = remaining;
    const expedition = playerState?.expedition;
    if (expedition && Number(expedition.endsAt) > now && expedition.squad?.includes(cardId)) {
      let locked = Number(expedition.enhancementStages?.[cardId]);
      if (!Number.isSafeInteger(locked) || locked < 0 || locked > 5) locked = counts.findLastIndex((count) => count > 0);
      if (locked >= 0) counts[locked] -= 1;
    }
    if (counts[enhancement] <= 0) throw new CooperativeRaidError('COOP_CARD_UNAVAILABLE', '보유하지 않았거나 모험 중인 카드입니다. 덱을 다시 확인해주세요.', 409);
    const enhanced = Math.round(Number(card.combatPower || card.power) * (1 + [0, .04, .10, .18, .28, .40][enhancement]));
    return {
      cardId, characterId, enhancement, instanceId: `coop:${accountId}:${cardId}`,
      name: card.name, image: card.image, rarity: card.rarity,
      role: modules.progression.roleForCard(cardId).id,
      attack: modules.progression.cardCombatPowerAtLevel(enhanced, cardId, playerState.cardProgression),
      maxHp: modules.progression.cardMaxHpAtLevel(cardId, playerState.cardProgression)
    };
  });
}

function currentRoom(data, accountId, includeClaimed = false) {
  return [...data.rooms].reverse().find((room) => room.participants.some((p) => p.accountId === accountId)
    && (includeClaimed || !room.claimedAccountIds.includes(accountId)));
}
function currentMatch(data, accountId) { return data.matches.find((match) => match.players.some((p) => p.accountId === accountId)); }
function ownsRoom(room, accountId) { return room?.participants.some((p) => p.accountId === accountId); }
function publicParticipant(player, card = player.card) {
  return { accountId: player.accountId, nickname: player.nickname, stage: player.stage, cardId: card.cardId, instanceId: card.instanceId, card };
}
function publicRoom(room, accountId) {
  const actor = room.battle.cards[room.battle.currentActorIndex];
  return {
    id: room.id, revision: room.revision, stageSum: room.stageSum, participants: room.participants,
    autoAccountIds: room.autoAccountIds || [],
    // Keep original event indexes: clients can reconcile effects while polling
    // without retransmitting a full battle's log every second.
    battle: { ...room.battle, log: room.battle.log.slice(-100) }, startedAt: room.startedAt, finishedAt: room.finishedAt || null,
    activeAccountId: room.battle.status === 'active' && room.battle.currentActor === 'card'
      ? room.participants.find((p) => p.instanceId === actor?.id)?.accountId || '' : '',
    turnExpiresAt: room.battle.turnDeadlineAt,
    reward: room.rewards?.[accountId] || null,
    rewardClaimed: room.claimedAccountIds.includes(accountId)
  };
}

function serializeCooperative(data, accountId, now) {
  // A request captured just before midnight may finish after a newer request.
  // Never present or restore a previous day's already-rotated entry ledger.
  const ledgerStart = Date.parse(`${data.entryDay}T00:00:00+09:00`);
  const day = getKstDayWindow(Math.max(now, ledgerStart || 0));
  const entriesUsed = data.entryDay === day.dayKey ? Number(data.entries[accountId] || 0) : 0;
  const result = { phase: 'idle', serverNow: now, accountId, entriesUsed, entriesRemaining: Math.max(0, 2 - entriesUsed), resetsAt: day.resetsAt.getTime() };
  const room = currentRoom(data, accountId);
  if (room) {
    result.phase = room.battle.status === 'finished' ? 'finished' : 'battle';
    result.room = publicRoom(room, accountId); result.reward = result.room.reward; result.rewardClaimed = result.room.rewardClaimed;
  } else {
    const match = currentMatch(data, accountId);
    const queued = data.queue.find((p) => p.accountId === accountId);
    if (match) {
      result.phase = 'ready';
      result.match = { id: match.id, expiresAt: match.expiresAt, stageSum: match.stageSum, acceptedAccountIds: match.acceptedAccountIds, participants: match.participants };
    } else if (queued) {
      result.phase = 'queued';
      result.queue = { cards: queued.cards, queuedAt: queued.queuedAt, queuedCount: data.queue.length, reason: data.rooms.length + data.matches.length >= MAX_ROOMS ? '진행 중인 전투가 많아 빈 전투방을 기다립니다.' : data.queue.length >= 4 ? '서로 다른 인물 4명을 구성할 수 있는 동료를 기다립니다.' : '4명이 모이면 입장 확인이 표시됩니다.' };
    }
  }
  return result;
}

function applyCooperativeReward(state, reward, progression = null) {
  const next = clone(state);
  next.wallet ||= {}; next.packs ||= {}; next.collection ||= {}; next.cardProgression ||= {};
  next.wallet.coins = Math.max(0, Number(next.wallet.coins) || 0) + Math.max(0, Number(reward.coins) || 0);
  next.packs.standard = Math.max(0, Number(next.packs.standard) || 0) + Math.max(0, Number(reward.packs ?? reward.standardPacks) || 0);
  for (const entry of reward.cards || (reward.cardIds || (reward.cardId ? [reward.cardId] : [])).map((cardId) => ({ cardId, quantity: 1 }))) {
    const { cardId } = entry;
    next.collection[cardId] = Math.max(0, Number(next.collection[cardId]) || 0) + Math.max(1, Number(entry.quantity) || 1);
    next.cardProgression[cardId] ||= { level: 1, experience: 0 };
    next.discoveredCardIds = [...new Set([...(next.discoveredCardIds || []), cardId])];
  }
  for (const entry of reward.relics || (reward.relicIds || (reward.relicId ? [reward.relicId] : [])).map((relicId) => ({ relicId, quantity: 1 }))) {
    const { relicId } = entry;
    next.relicInventory ||= {}; next.relicInventory[relicId] = Math.max(0, Number(next.relicInventory[relicId]) || 0) + Math.max(1, Number(entry.quantity) || 1);
  }
  for (const item of Array.isArray(reward.equipment) ? reward.equipment : (reward.equipment ? [reward.equipment] : [])) {
    next.equipmentInventory ||= [];
    if (!next.equipmentInventory.some((owned) => owned.id === item.id)) next.equipmentInventory.push(item);
  }
  if (reward.experience?.cardId && Number(reward.experience.amount) > 0 && progression) {
    const awarded = progression.grantCardExperience(next.cardProgression, [reward.experience.cardId], reward.experience.amount, next.collection);
    next.cardProgression = awarded.cardProgression;
  }
  return normalizeGameState(next);
}

function createCooperativeRaidService({ TcgCooperativeRaid, TcgPlayerState, TcgPersonalRaidDaily, random = secureRandom, modules: suppliedModules } = {}) {
  const modules = () => suppliedModules ? Promise.resolve(suppliedModules) : loadCooperativeModules();
  async function ensure(now) {
    try { await TcgCooperativeRaid.updateOne({ _id: COORDINATOR_ID }, { $setOnInsert: { revision: 0, data: initialData(now) } }, { upsert: true }); }
    catch (error) { if (error?.code !== 11000) throw error; }
  }
  async function mutate(now, operation, heartbeatAccountId = '') {
    await ensure(now);
    const shared = await modules();
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const snapshot = plain(await lean(TcgCooperativeRaid.findOne({ _id: COORDINATOR_ID })));
      // Only committed results may enter the immutable archive. If a process
      // exits before the coordinator CAS, the next worker repeats this upsert;
      // if a player claims concurrently, its separate receipt remains final.
      for (const room of snapshot.data.rooms.filter((entry) => entry.battle.status === 'finished')) {
        try {
          const archived = { ...room, battle: { ...room.battle, log: room.battle.log.slice(-500) } };
          await TcgCooperativeRaid.updateOne({ _id: `archive:${room.id}` }, { $setOnInsert: { revision: 0, data: archived } }, { upsert: true });
        } catch (error) { if (error?.code !== 11000) throw error; }
      }
      const data = clone(snapshot.data);
      await advance(data, now, shared, heartbeatAccountId);
      const result = await operation(data, shared);
      if (JSON.stringify(data) === JSON.stringify(snapshot.data)) return { data, result };
      const updated = await TcgCooperativeRaid.findOneAndUpdate({ _id: COORDINATOR_ID, revision: snapshot.revision }, { $set: { data }, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true });
      if (updated) return { data, result };
    }
    throw new CooperativeRaidError('COOP_BUSY', '협동 레이드 요청이 겹쳤습니다. 잠시 후 다시 시도해주세요.', 409);
  }
  function finishRoom(room, now, shared) {
    if (room.battle.status !== 'finished' || room.rewards) return;
    room.finishedAt = now; room.rewards = {};
    const victory = room.battle.result === 'victory';
    const cardPools = Object.fromEntries(['sr', 'hr', 'ur', 'ssr'].map((rarity) => [rarity, shared.catalog.ALL_CARDS.filter((card) => card.rarity === rarity).map((card) => card.id)]));
    for (const participant of room.participants) {
      room.rewards[participant.accountId] = victory ? shared.rules.rollCooperativeRewards(room.stageSum, {
        random, cardPools, relicIds: shared.relics.RELIC_CATALOG.map((relic) => relic.id),
        equipmentFactory: (options) => ({ ...shared.equipment.createEquipment({ ...options, now, random, missionId: 'cooperative-raid', idFactory: () => `coop-equipment-${randomUUID()}` }), source: { type: 'cooperative-raid', roomId: room.id } })
      }) : { coins: room.stageSum * 50, standardPacks: 0, cards: [], relics: [], equipment: [], consolation: true };
      room.rewards[participant.accountId].experience = {
        cardId: participant.cardId,
        amount: shared.progression.raidExperienceReward({ damageDealt: room.battle.totalDamage, stage: Math.ceil(room.stageSum / 4), cleared: victory })
      };
    }
  }
  function stepRoom(room, now, shared) {
    // Catch up from persisted deadlines, including after a process restart.
    // At most 28 player actions exist in a seven-round battle.
    let steps = 0;
    while (room.battle.status === 'active' && steps++ < 160) {
      if (room.battle.currentActor === 'boss') {
        room.battle = shared.engine.performBossAction(room.battle, Number(room.battle.turnStartedAt) || now);
      } else {
        const actor = room.battle.cards[room.battle.currentActorIndex];
        const owner = room.participants.find((player) => player.instanceId === actor?.id)?.accountId;
        const auto = room.autoAccountIds?.includes(owner);
        // A toggle cannot retroactively advance turns before it was enabled.
        const autoDue = Math.max(Number(room.battle.turnStartedAt) || now, Number(room.autoEnabledAt?.[owner]) || 0) + AUTO_ACTION_DELAY_MS;
        const timeoutDue = Number(room.battle.turnDeadlineAt) || now;
        if (auto && autoDue <= now && autoDue <= timeoutDue) {
          room.battle = shared.engine.performPlayerAction(room.battle, { ...shared.autoBattle.chooseRaidAutoAction(room.battle), automatic: true }, autoDue);
        } else if (timeoutDue <= now) {
          room.battle = shared.engine.performPlayerAction(room.battle, { type: 'basic', automatic: true }, timeoutDue);
        } else break;
      }
      room.revision += 1;
    }
    finishRoom(room, now, shared);
  }
  function requeueAccepted(data, match, now, excluded = '') {
    for (const player of match.players) if (player.accountId !== excluded && match.acceptedAccountIds.includes(player.accountId)) {
      data.queue.push({ ...player, lastSeenAt: now });
    }
    data.matches = data.matches.filter((entry) => entry.id !== match.id);
  }
  function formMatches(data, now, shared) {
    if (data.rooms.length + data.matches.length >= MAX_ROOMS) return;
    data.queue.sort((a, b) => a.queuedAt - b.queuedAt);
    // Search bounded combinations, not just the first four. Four players each
    // offering the same three people must not block a compatible fifth user.
    let budget = 3000;
    while (data.queue.length >= 4 && data.rooms.length + data.matches.length < MAX_ROOMS && budget > 0) {
      let found = null;
      const search = (offset, group) => {
        if (found || budget <= 0) return;
        if (group.length === 4) {
          budget -= 1;
          const selection = shared.rules.selectCooperativeParty(group, random);
          if (selection) found = { group, selection };
          return;
        }
        for (let i = offset; i <= data.queue.length - (4 - group.length) && !found && budget > 0; i += 1) search(i + 1, [...group, data.queue[i]]);
      };
      search(0, []);
      if (!found) break;
      const selected = found.selection.participants || found.selection;
      const participants = selected.map((entry, index) => {
        const player = found.group.find((p) => p.accountId === entry.accountId) || found.group[index];
        const card = entry.card || player.cards.find((c) => c.cardId === entry.cardId) || entry;
        return publicParticipant(player, card);
      });
      const stageSum = participants.reduce((sum, player) => sum + player.stage, 0);
      data.matches.push({ id: randomUUID(), players: found.group, participants, stageSum, acceptedAccountIds: [], createdAt: now, expiresAt: now + READY_MS });
      const ids = new Set(found.group.map((player) => player.accountId));
      data.queue = data.queue.filter((player) => !ids.has(player.accountId));
    }
  }
  async function advance(data, now, shared, heartbeatAccountId) {
    const day = getKstDayWindow(now).dayKey;
    if (data.entryDay < day) { data.entryDay = day; data.entries = {}; }
    // mutate() durably archived all rooms that were already finished in its
    // snapshot. Rooms finishing during this pass remain until the next CAS.
    data.rooms = data.rooms.filter((room) => room.battle.status !== 'finished');
    for (const match of [...data.matches]) if (match.expiresAt <= now) requeueAccepted(data, match, now);
    data.queue = data.queue.filter((player) => now - player.lastSeenAt < QUEUE_TTL_MS && Number(data.entries[player.accountId] || 0) < 2);
    const current = data.queue.find((player) => player.accountId === heartbeatAccountId);
    if (current && now - current.lastSeenAt >= 15_000) current.lastSeenAt = now;
    for (const room of data.rooms) stepRoom(room, now, shared);
    formMatches(data, now, shared);
  }
  async function pendingArchive(accountId) {
    const saved = plain(await lean(TcgPlayerState.findOne({ accountId })));
    const excluded = (saved?.cooperativeRewardClaims || []).map((id) => `archive:${id}`);
    const archive = plain(await lean(TcgCooperativeRaid.findOne({ 'data.participants.accountId': accountId, _id: { $nin: excluded } })));
    return archive?.data || null;
  }
  async function response(data, id, now, extra = {}) {
    const cooperative = serializeCooperative(data, id, now);
    if (cooperative.phase === 'idle') {
      const archived = await pendingArchive(id);
      if (archived) {
        cooperative.phase = 'finished'; cooperative.room = publicRoom(archived, id);
        cooperative.reward = cooperative.room.reward; cooperative.rewardClaimed = false;
      }
    }
    return { cooperative, ...extra };
  }
  async function state({ account, now = Date.now() }) {
    const id = accountKey(account);
    const { data } = await mutate(now, () => null, id);
    return response(data, id, now);
  }
  async function requireSession(account, request, now) { return assertActivePlaySession({ TcgPlayerState, accountId: accountKey(account), request, now }); }
  async function queue({ account, request = {}, now = Date.now() }) {
    const player = await requireSession(account, request, now); const id = accountKey(account);
    if (await pendingArchive(id)) throw new CooperativeRaidError('COOP_REWARD_PENDING', '지난 협동 레이드 보상을 먼저 받아주세요.', 409);
    const shared = await modules();
    const cards = validateRepresentatives(player.state, request.cards, shared, id, now);
    const personal = await getPersonalRaidState({ TcgPersonalRaidDaily, account, now });
    const stage = Math.max(1, Math.min(10, Number(personal.state.stage) || 1));
    const { data } = await mutate(now, async (current) => {
      if (currentRoom(current, id) || currentMatch(current, id)) throw new CooperativeRaidError('COOP_ALREADY_PARTICIPATING', '진행 중인 협동 레이드를 먼저 완료해주세요.', 409);
      if (await pendingArchive(id)) throw new CooperativeRaidError('COOP_REWARD_PENDING', '지난 협동 레이드 보상을 먼저 받아주세요.', 409);
      if (Number(current.entries[id] || 0) >= 2) throw new CooperativeRaidError('COOP_DAILY_LIMIT', '협동 레이드는 하루 2회 입장할 수 있습니다.', 429);
      const existing = current.queue.find((entry) => entry.accountId === id);
      if (current.queue.length >= MAX_QUEUE && !existing) throw new CooperativeRaidError('COOP_QUEUE_FULL', '대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.', 503);
      current.queue = current.queue.filter((entry) => entry.accountId !== id);
      current.queue.push({ accountId: id, nickname: String(account.nickname || ''), cards, stage, queuedAt: existing?.queuedAt || now, lastSeenAt: now });
      formMatches(current, now, shared);
    });
    return response(data, id, now);
  }
  async function leave({ account, request = {}, now = Date.now() }) {
    await requireSession(account, request, now); const id = accountKey(account);
    const { data } = await mutate(now, (current) => {
      if (currentRoom(current, id)) throw new CooperativeRaidError('COOP_BATTLE_ACTIVE', '이미 입장한 전투는 재접속하여 계속할 수 있습니다.', 409);
      current.queue = current.queue.filter((player) => player.accountId !== id);
      const match = currentMatch(current, id); if (match) requeueAccepted(current, match, now, id);
    });
    return response(data, id, now);
  }
  async function accept({ account, request = {}, now = Date.now() }) {
    await requireSession(account, request, now); const id = accountKey(account);
    const { data } = await mutate(now, async (current, shared) => {
      const already = current.rooms.find((room) => room.matchId === request.matchId && ownsRoom(room, id));
      if (already) return;
      const match = currentMatch(current, id);
      if (!match || match.id !== request.matchId || match.expiresAt <= now) throw new CooperativeRaidError('COOP_MATCH_EXPIRED', '입장 확인 시간이 지났습니다. 다시 대기열에 등록해주세요.', 409);
      if (!match.acceptedAccountIds.includes(id)) match.acceptedAccountIds.push(id);
      if (match.acceptedAccountIds.length < 4) return;
      for (const participant of match.participants) {
        if (Number(current.entries[participant.accountId] || 0) >= 2) throw new CooperativeRaidError('COOP_DAILY_LIMIT', '참가자의 입장 횟수가 소진되었습니다.', 409);
        const saved = plain(await lean(TcgPlayerState.findOne({ accountId: participant.accountId })));
        const original = match.players.find((p) => p.accountId === participant.accountId);
        const personal = await getPersonalRaidState({ TcgPersonalRaidDaily, account: { _id: participant.accountId, nickname: participant.nickname }, now });
        participant.stage = Math.max(1, Math.min(10, Number(personal.state.stage) || 1));
        // Validate the full registered set again; never trust the queued power.
        try {
          const verified = validateRepresentatives(saved?.state, original.cards, shared, participant.accountId, now);
          participant.card = verified.find((card) => card.cardId === participant.cardId);
        } catch (error) {
          if (!(error instanceof CooperativeRaidError)) throw error;
          requeueAccepted(current, match, now, participant.accountId);
          return;
        }
      }
      const participants = [...match.participants];
      match.stageSum = participants.reduce((sum, participant) => sum + participant.stage, 0);
      for (let i = participants.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [participants[i], participants[j]] = [participants[j], participants[i]]; }
      const boss = shared.rules.createCooperativeBoss(match.stageSum);
      const battle = shared.engine.startRaidBattle(shared.engine.createRaidBattle({ cards: participants.map((p) => p.card), boss, seed: Math.floor(random() * 0x100000000) || 1, now }), now);
      current.rooms.push({ id: randomUUID(), matchId: match.id, revision: 0, stageSum: match.stageSum, participants, battle, startedAt: now, entryDay: current.entryDay, actionReceipts: [], autoAccountIds: [], autoEnabledAt: {}, claimedAccountIds: [], rewards: null });
      for (const participant of participants) current.entries[participant.accountId] = Number(current.entries[participant.accountId] || 0) + 1;
      current.matches = current.matches.filter((entry) => entry.id !== match.id);
    });
    return response(data, id, now);
  }
  async function action({ account, request = {}, now = Date.now() }) {
    await requireSession(account, request, now); const id = accountKey(account);
    if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(String(request.actionId || '')) || !['basic', 'skill'].includes(request.action)) throw new CooperativeRaidError('COOP_INVALID_ACTION', '행동 요청이 올바르지 않습니다.');
    const { data } = await mutate(now, async (current, shared) => {
      const room = current.rooms.find((entry) => entry.id === request.roomId)
        || plain(await lean(TcgCooperativeRaid.findOne({ _id: `archive:${String(request.roomId || '')}` })))?.data;
      if (!ownsRoom(room, id)) throw new CooperativeRaidError('COOP_ROOM_NOT_FOUND', '참가 중인 협동 전투를 찾을 수 없습니다.', 404);
      const receiptId = `${id}:${request.actionId}`;
      if (room.actionReceipts.includes(receiptId)) return;
      if (Number(request.expectedRevision) !== room.revision) throw new CooperativeRaidError('COOP_STALE_TURN', '전투가 갱신되었습니다. 현재 차례를 다시 확인해주세요.', 409);
      const active = publicRoom(room, id).activeAccountId;
      if (active !== id) throw new CooperativeRaidError('COOP_NOT_YOUR_TURN', '지금은 다른 플레이어의 차례입니다.', 409);
      if (request.targetId && !room.battle.cards.some((card) => card.id === request.targetId && card.hp > 0)) throw new CooperativeRaidError('COOP_INVALID_TARGET', '대상 카드를 다시 선택해주세요.');
      try { room.battle = shared.engine.performPlayerAction(room.battle, { type: request.action, targetId: request.targetId, choice: request.choice, galaxyChoice: request.galaxyChoice }, now); }
      catch (error) { throw new CooperativeRaidError('COOP_ACTION_UNAVAILABLE', error.message, 409); }
      room.revision += 1; room.actionReceipts.push(receiptId);
      stepRoom(room, now, shared);
    });
    return response(data, id, now);
  }
  async function auto({ account, request = {}, now = Date.now() }) {
    await requireSession(account, request, now); const id = accountKey(account);
    if (typeof request.enabled !== 'boolean') throw new CooperativeRaidError('COOP_INVALID_AUTO', '자동전투 설정이 올바르지 않습니다.');
    const { data } = await mutate(now, (current) => {
      const room = current.rooms.find((entry) => entry.id === request.roomId);
      if (!ownsRoom(room, id)) throw new CooperativeRaidError('COOP_ROOM_NOT_FOUND', '참가 중인 협동 전투를 찾을 수 없습니다.', 404);
      if (room.battle.status !== 'active') throw new CooperativeRaidError('COOP_BATTLE_FINISHED', '이미 종료된 협동 전투입니다.', 409);
      room.autoAccountIds ||= []; room.autoEnabledAt ||= {};
      if (room.autoAccountIds.includes(id) === request.enabled) return;
      if (request.enabled) { room.autoAccountIds.push(id); room.autoEnabledAt[id] = now; }
      else { room.autoAccountIds = room.autoAccountIds.filter((accountId) => accountId !== id); delete room.autoEnabledAt[id]; }
      room.revision += 1;
    });
    return response(data, id, now);
  }
  async function claim({ account, request = {}, now = Date.now() }) {
    await requireSession(account, request, now); const id = accountKey(account);
    // First read the immutable, server-rolled loot. Never modify coordinator
    // claims before the player inventory and receipt are atomically committed.
    const { data: before } = await mutate(now, () => null);
    const room = before.rooms.find((entry) => entry.id === request.roomId)
      || plain(await lean(TcgCooperativeRaid.findOne({ _id: `archive:${String(request.roomId || '')}` })))?.data;
    let saved = plain(await lean(TcgPlayerState.findOne({ accountId: id })));
    if (!room && saved?.cooperativeRewardClaims?.includes(request.roomId)) return response(before, id, now, { snapshot: serializePlayerState(saved, now), alreadyClaimed: true });
    if (!ownsRoom(room, id) || room.battle.status !== 'finished' || !room.rewards?.[id]) throw new CooperativeRaidError('COOP_REWARD_NOT_READY', '아직 받을 협동 레이드 보상이 없습니다.', 409);
    let alreadyClaimed = saved?.cooperativeRewardClaims?.includes(room.id);
    if (!alreadyClaimed) {
      if (!Number.isSafeInteger(Number(request.baseRevision)) || Number(request.baseRevision) !== Number(saved.revision)) throw new PlayerStateError('SAVE_CONFLICT', '최신 저장 기록을 불러온 후 보상을 다시 받아주세요.', 409, serializePlayerState(saved, now));
      const shared = await modules();
      const updated = await TcgPlayerState.findOneAndUpdate({
        accountId: id, initialized: true, revision: Number(request.baseRevision), cooperativeRewardClaims: { $ne: room.id },
        'activeLease.leaseId': request.leaseId, 'activeLease.deviceId': request.deviceId,
        'activeLease.generation': Number(request.generation), 'activeLease.expiresAt': { $gt: new Date(now) }
      }, { $set: { state: applyCooperativeReward(saved.state, room.rewards[id], shared.progression), 'activeLease.heartbeatAt': new Date(now), 'activeLease.expiresAt': new Date(now + PLAYER_LEASE_DURATION_MS) }, $inc: { revision: 1 }, $push: { cooperativeRewardClaims: room.id } }, { returnDocument: 'after', runValidators: true });
      if (!updated) {
        await requireSession(account, request, now);
        saved = plain(await lean(TcgPlayerState.findOne({ accountId: id })));
        if (!saved?.cooperativeRewardClaims?.includes(room.id)) throw new PlayerStateError('SAVE_CONFLICT', '저장 기록이 갱신되었습니다. 보상을 다시 받아주세요.', 409, serializePlayerState(saved, now));
        alreadyClaimed = true;
      } else saved = plain(updated);
    }
    const { data } = await mutate(now, (current) => {
      const stored = current.rooms.find((entry) => entry.id === room.id);
      if (stored && !stored.claimedAccountIds.includes(id)) stored.claimedAccountIds.push(id);
    });
    return response(data, id, now, { snapshot: serializePlayerState(saved, now), reward: room.rewards[id], alreadyClaimed: Boolean(alreadyClaimed) });
  }
  return { state, queue, leave, accept, action, auto, claim };
}

module.exports = { COORDINATOR_ID, MAX_QUEUE, MAX_ROOMS, QUEUE_TTL_MS, READY_MS, AUTO_ACTION_DELAY_MS, CooperativeRaidError, applyCooperativeReward, createCooperativeRaidService, loadCooperativeModules, serializeCooperative, validateRepresentatives };
