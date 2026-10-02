'use strict';

// Opt-in integration smoke; deliberately cannot connect to a remote/database
// name outside this disposable test namespace. No production URI is loaded.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const TcgCooperativeRaid = require('../src/tcg/models/TcgCooperativeRaid');
const TcgPlayerState = require('../src/tcg/models/TcgPlayerState');
const TcgPersonalRaidDaily = require('../src/tcg/models/TcgPersonalRaidDaily');
const { createCooperativeRaidService, COORDINATOR_ID } = require('../src/tcg/services/cooperativeRaidService');
const { startPersonalRaid, finishPersonalRaid, getPersonalRaidState, getKstDayWindow } = require('../src/tcg/services/personalRaidService');
const CARD_COMBAT_POWER = require('../src/tcg/data/cardCombatPower.json');

async function main() {
  const uri = String(process.env.TCG_SMOKE_MONGO_URI || '');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hoi_coop_smoke_[a-z0-9_]+(?:\?directConnection=true)?$/.test(uri)) {
    throw new Error('Set TCG_SMOKE_MONGO_URI to mongodb://127.0.0.1:<port>/hoi_coop_smoke_<unique_name>; only a disposable local database is allowed.');
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false });
  const databaseName = mongoose.connection.name;
  if (!databaseName.startsWith('hoi_coop_smoke_')) throw new Error('Unsafe test database name.');
  let ownsTestDatabase = false;
  try {
    assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, 'Use a brand-new empty test database.');
    ownsTestDatabase = true;
    for (const Model of [TcgCooperativeRaid, TcgPlayerState, TcgPersonalRaidDaily]) {
      await Model.createCollection();
      await Model.createIndexes();
    }
    const now = Date.now();
    let logicalNow = now;
    const accounts = Array.from({ length: 4 }, (_, index) => ({ _id: new mongoose.Types.ObjectId(), nickname: `몽고검증${index}` }));
    const owned = ['winter-c', 'kkamdung-c', 'nanche-c', 'morae-c'];
    for (const account of accounts) await TcgPlayerState.create({
      accountId: account._id, initialized: true, revision: 0,
      activeLease: { leaseId: `lease-${account._id}`, deviceId: `device-${account._id}`, generation: 1, platform: 'web', expiresAt: new Date(now + 3600000) },
      state: { wallet: { coins: 0 }, packs: { standard: 0 }, collection: Object.fromEntries(owned.map((id) => [id, 1])), cardEnhancements: {}, cardProgression: {}, equipmentInventory: [], relicInventory: {} }
    });
    const dependencies = { TcgCooperativeRaid, TcgPlayerState, TcgPersonalRaidDaily, random: () => .25 };
    let service = createCooperativeRaidService(dependencies);
    const request = (index, extra = {}) => ({ leaseId: `lease-${accounts[index]._id}`, deviceId: `device-${accounts[index]._id}`, generation: 1, ...extra });
    const call = (method, index, extra = {}, clock = logicalNow) => service[method]({ account: accounts[index], request: request(index, extra), now: clock });
    await Promise.all(accounts.map((account, index) => call('queue', index, {
      cards: (index === 3 ? owned.slice(1, 4) : owned.slice(0, 3)).map((cardId) => ({ cardId, enhancement: 0 }))
    })));
    const match = (await call('state', 0)).cooperative.match;
    assert.equal(match.participants.length, 4);
    await Promise.all([0, 1, 2, 3, 3].map((index) => call('accept', index, { matchId: match.id })));
    let persisted = await TcgCooperativeRaid.findById(COORDINATOR_ID).lean();
    assert.equal(persisted.data.rooms.length, 1);
    assert.deepEqual(Object.values(persisted.data.entries).sort(), [1, 1, 1, 1]);
    let room = (await call('state', 0)).cooperative.room;
    const indexFor = (id) => accounts.findIndex((account) => String(account._id) === id);
    let owner = indexFor(room.activeAccountId);
    const action = { roomId: room.id, expectedRevision: room.revision, actionId: 'mongo-basic-action', action: 'basic' };
    await assert.rejects(call('action', (owner + 1) % 4, action), { code: 'COOP_NOT_YOUR_TURN' });
    await Promise.all([call('action', owner, action), call('action', owner, action)]);
    room = (await call('state', 0)).cooperative.room;
    assert.equal(room.battle.playerActionCount, 1);
    assert.ok(room.battle.totalDamage > 0);
    owner = indexFor(room.activeAccountId);
    await Promise.all([call('auto', owner, { roomId: room.id, enabled: true }), call('auto', owner, { roomId: room.id, enabled: true })]);
    room = (await call('state', 0)).cooperative.room;
    assert.deepEqual(room.autoAccountIds, [String(accounts[owner]._id)]);
    const race = await Promise.allSettled([
      call('action', owner, { roomId: room.id, expectedRevision: room.revision, actionId: 'manual-versus-auto', action: 'basic' }, now + 999),
      call('state', 0, {}, now + 1000),
      call('state', 1, {}, now + 1000)
    ]);
    for (const result of race) if (result.status === 'rejected') assert.equal(result.reason.code, 'COOP_STALE_TURN');
    logicalNow = now + 1000;
    room = (await call('state', 0)).cooperative.room;
    assert.equal(room.battle.playerActionCount, 2, 'manual and automatic requests cannot both consume the same turn');
    logicalNow = now + 1500;
    await Promise.all(accounts.map((_, index) => call('auto', index, { roomId: room.id, enabled: true })));
    room = (await call('state', 0)).cooperative.room;
    let expectedBattle = structuredClone(room.battle);
    const { loadCooperativeModules } = require('../src/tcg/services/cooperativeRaidService');
    const shared = await loadCooperativeModules();
    for (const timestamp of [now + 2500, now + 3500, now + 4500]) {
      expectedBattle = shared.engine.performPlayerAction(expectedBattle, { ...shared.autoBattle.chooseRaidAutoAction(expectedBattle), automatic: true }, timestamp);
      while (expectedBattle.status === 'active' && expectedBattle.currentActor === 'boss') expectedBattle = shared.engine.performBossAction(expectedBattle, Number(expectedBattle.turnStartedAt));
    }
    service = createCooperativeRaidService(dependencies);
    logicalNow = now + 4500;
    await Promise.all(accounts.map((_, index) => call('state', index)));
    room = (await call('state', 0)).cooperative.room;
    assert.equal(room.battle.playerActionCount, 5, 'concurrent catch-up persists exactly three new actions');
    // MongoDB encodes optional undefined Mixed properties as null. Both mean
    // "no choice" to the engine; compare the persisted and in-memory shapes
    // without that storage-only difference.
    const comparableCombat = battle => JSON.parse(JSON.stringify(battle, (_, value) => value == null ? undefined : value));
    assert.deepEqual(comparableCombat(room.battle), comparableCombat(expectedBattle), 'authoritative combat equals the shared client engine and policy');
    await Promise.all(accounts.map((_, index) => call('auto', index, { roomId: room.id, enabled: false })));
    room = (await call('state', 0)).cooperative.room;
    assert.deepEqual(room.autoAccountIds, []);
    // Isolated test fixture: put this local boss one hit from defeat so this
    // integration verifies result/claim paths without changing live rules.
    await TcgCooperativeRaid.updateOne({ _id: COORDINATOR_ID }, { $set: { 'data.rooms.0.battle.boss.hp': 1 }, $inc: { revision: 1 } });
    owner = indexFor(room.activeAccountId);
    logicalNow = now + 5000;
    await call('action', owner, { roomId: room.id, expectedRevision: room.revision, actionId: 'mongo-victory-action', action: 'basic' });
    const finished = await call('state', 0);
    assert.equal(finished.cooperative.phase, 'finished');
    assert.equal(finished.cooperative.room.battle.result, 'victory');
    persisted = await TcgCooperativeRaid.findById(COORDINATOR_ID).lean();
    assert.equal(persisted.data.rooms.length, 0);
    assert.ok(await TcgCooperativeRaid.exists({ _id: `archive:${room.id}` }));
    service = createCooperativeRaidService(dependencies);
    assert.equal((await call('state', 2)).cooperative.phase, 'finished');
    const claims = await Promise.all([call('claim', 0, { roomId: room.id, baseRevision: 0 }), call('claim', 0, { roomId: room.id, baseRevision: 0 })]);
    assert.equal(claims[0].snapshot.state.wallet.coins, 2000);
    assert.equal(claims[1].snapshot.state.wallet.coins, 2000);
    const saved = await TcgPlayerState.findOne({ accountId: accounts[0]._id }).lean();
    assert.equal(saved.revision, 1);
    assert.deepEqual(saved.cooperativeRewardClaims, [room.id]);
    assert.equal((await call('state', 0)).cooperative.phase, 'idle');
    assert.equal((await call('state', 1)).cooperative.phase, 'finished');
    await assert.rejects(call('queue', 1, { cards: owned.slice(0, 3).map((cardId) => ({ cardId, enhancement: 0 })) }), { code: 'COOP_REWARD_PENDING' });
    const duplicate = await call('claim', 0, { roomId: room.id, baseRevision: 0 });
    assert.equal(duplicate.alreadyClaimed, true); assert.equal(duplicate.snapshot.state.wallet.coins, 2000);
    const personalAccount = accounts[0];
    const verifiedSquad = { squad: owned.map((cardId, index) => ({ cardId, enhancement: 0, power: CARD_COMBAT_POWER[cardId], slot: index + 1 })), squadScore: owned.reduce((total, id) => total + CARD_COMBAT_POWER[id], 0) };
    const personalStart = clock => startPersonalRaid({ TcgPersonalRaidDaily, account: personalAccount, verifiedSquad, now: clock });
    const personalFinish = (session, clock, damage) => finishPersonalRaid({ TcgPersonalRaidDaily, account: personalAccount, sessionId: session.sessionId, now: clock, damageDealt: damage, bossHpRemaining: session.bossHpBefore - damage });
    for (let index = 0; index < 6; index += 1) {
      const started = await personalStart(now + index * 200);
      const damage = index >= 4 ? started.session.bossHpBefore : 0;
      await Promise.all([personalFinish(started.session, now + index * 200 + 100, damage), personalFinish(started.session, now + index * 200 + 100, damage)]);
    }
    let personal = (await getPersonalRaidState({ TcgPersonalRaidDaily, account: personalAccount, now: now + 1500 })).state;
    assert.equal(personal.entriesToday, 6); assert.equal(personal.bonusEntriesToday, 2); assert.equal(personal.remainingEntries, 1);
    const midnight = getKstDayWindow(now).resetsAt.getTime();
    // Only use same-week midnight here; weekly rollover intentionally uses a new raid record.
    if (new Date(midnight + 9 * 3600000).getUTCDay() !== 1) {
      const started = await personalStart(midnight - 1);
      await Promise.all([personalFinish(started.session, midnight + 1, started.session.bossHpBefore), personalFinish(started.session, midnight + 1, started.session.bossHpBefore)]);
      personal = (await getPersonalRaidState({ TcgPersonalRaidDaily, account: personalAccount, now: midnight + 2 })).state;
      assert.equal(personal.entriesToday, 0); assert.equal(personal.bonusEntriesToday, 1); assert.equal(personal.remainingEntries, 6);
      await assert.rejects(personalStart(midnight - 1), { code: 'RAID_DAY_CHANGED' });
    }
    console.log(JSON.stringify({ result: 'passed', database: databaseName, participants: 4, checks: ['real-Mongoose-CAS', 'parallel-accept-single-entry', 'owner-turn', 'duplicate-action', 'parallel-auto-toggle', 'manual-auto-race', 'restart-parallel-auto-catchup', 'shared-engine-equivalence', 'immutable-archive', 'parallel-idempotent-claim', 'pending-reward-gate', 'receipt-retry', 'personal-sixth-entry-validator', 'parallel-clear-single-bonus', 'KST-midnight-no-rollback'] }));
  } finally {
    // This is the exact database validated above, not an account or workspace.
    if (ownsTestDatabase) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
