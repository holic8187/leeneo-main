'use strict';

// Opt-in integration smoke; deliberately cannot connect to a remote/database
// name outside this disposable test namespace. No production URI is loaded.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const TcgCooperativeRaid = require('../src/tcg/models/TcgCooperativeRaid');
const TcgPlayerState = require('../src/tcg/models/TcgPlayerState');
const TcgPersonalRaidDaily = require('../src/tcg/models/TcgPersonalRaidDaily');
const { createCooperativeRaidService, COORDINATOR_ID } = require('../src/tcg/services/cooperativeRaidService');

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
    const call = (method, index, extra = {}, clock = now) => service[method]({ account: accounts[index], request: request(index, extra), now: clock });
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
    // Isolated test fixture: put this local boss one hit from defeat so this
    // integration verifies result/claim paths without changing live rules.
    await TcgCooperativeRaid.updateOne({ _id: COORDINATOR_ID }, { $set: { 'data.rooms.0.battle.boss.hp': 1 }, $inc: { revision: 1 } });
    owner = indexFor(room.activeAccountId);
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
    console.log(JSON.stringify({ result: 'passed', database: databaseName, participants: 4, checks: ['real-Mongoose-CAS', 'parallel-accept-single-entry', 'owner-turn', 'duplicate-action', 'immutable-archive', 'service-restart', 'parallel-idempotent-claim', 'pending-reward-gate', 'receipt-retry'] }));
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
