'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {COORDINATOR_ID,createPvpService,loadPvpModules,validatePvpDeck}=require('../../src/tcg/services/pvpService');
const clone=value=>JSON.parse(JSON.stringify(value));
const at=(row,key)=>key.split('.').reduce((value,part)=>Array.isArray(value)?value.map(entry=>entry?.[part]):value?.[part],row);
function put(row,key,value){const parts=key.split('.'),last=parts.pop();for(const part of parts){row[part]||={};row=row[part];}row[last]=clone(value);}
function matches(row,query){return Object.entries(query).every(([key,expected])=>{const value=at(row,key);
  if(expected&&typeof expected==='object'&&!Array.isArray(expected)){
    if('$gt'in expected)return new Date(value).getTime()>new Date(expected.$gt).getTime();
    if('$ne'in expected)return Array.isArray(value)?!value.includes(expected.$ne):value!==expected.$ne;
    if('$nin'in expected)return !expected.$nin.includes(value);
  }return Array.isArray(value)?value.includes(expected):String(value)===String(expected);
});}
function model(seed=[]){return {records:clone(seed),
  async findOne(query){return clone(this.records.find(row=>matches(row,query))||null);},
  async find(query){return clone(this.records.filter(row=>matches(row,query)));},
  async updateOne(query,update,options={}){if(!this.records.some(row=>matches(row,query))&&options.upsert)this.records.push({...clone(query),...clone(update.$setOnInsert||{})});return {modifiedCount:1};},
  async findOneAndUpdate(query,update){const row=this.records.find(row=>matches(row,query));if(!row)return null;
    for(const [key,value]of Object.entries(update.$set||{}))put(row,key,value);
    for(const [key,value]of Object.entries(update.$inc||{}))put(row,key,(Number(at(row,key))||0)+value);
    for(const [key,value]of Object.entries(update.$push||{}))put(row,key,[...(at(row,key)||[]),value]);
    return clone(row);
  }};}
async function harness({count=2,now=Date.parse('2026-10-23T01:00:00Z')}={}){
  const modules=await loadPvpModules(),cardIds=['winter-c','hoi-c','morae-c','pie-c','winter-u'];
  const accounts=Array.from({length:count},(_,i)=>({_id:`account-${i}`,nickname:`대전자${i}`}));
  const TcgPlayerState=model(accounts.map(account=>({accountId:account._id,initialized:true,revision:0,pvpRewardClaims:[],
    activeLease:{leaseId:`lease-${account._id}`,deviceId:`device-${account._id}`,generation:1,expiresAt:new Date(now+86400000).toISOString(),platform:'web'},
    state:{wallet:{coins:0},packs:{standard:0},collection:Object.fromEntries(cardIds.map(id=>[id,1])),cardEnhancements:{},cardProgression:{}}
  })));
  const TcgPvp=model(),deps={TcgPvp,TcgPlayerState,modules,random:()=>.25};let service=createPvpService(deps);
  const cards=(ids=cardIds.slice(0,4))=>ids.map(cardId=>({cardId,enhancement:0}));
  const call=(operation,index,extra={},time=now)=>service[operation]({account:accounts[index],request:{leaseId:`lease-account-${index}`,deviceId:`device-account-${index}`,generation:1,...extra},now:time});
  const data=()=>TcgPvp.records.find(row=>row._id===COORDINATOR_ID)?.data;
  const saved=i=>TcgPlayerState.records[i];
  async function ready(){await call('queue',0,{cards:cards()});await call('queue',1,{cards:cards()});return data().matches[0];}
  async function enter(){const match=await ready();await Promise.all([0,1,1].map(i=>call('accept',i,{matchId:match.id})));return data().rooms[0];}
  async function end(){await enter();return (await call('state',0,{},now+2*3600000)).pvp.room;}
  return {deps,modules,accounts,cards,call,data,saved,ready,enter,end,now,restart(){service=createPvpService(deps);}};
}

test('PvP validates four distinct owned character copies and active expedition slots',async()=>{
  const h=await harness();
  await assert.rejects(h.call('queue',0,{cards:h.cards().slice(0,3)}),{code:'PVP_FOUR_CARDS_REQUIRED'});
  await assert.rejects(h.call('queue',0,{cards:h.cards(['winter-c','winter-u','morae-c','pie-c'])}),{code:'PVP_INVALID_DECK'});
  await assert.rejects(h.call('queue',0,{cards:[{cardId:'winter-c',enhancement:5},...h.cards().slice(1)]}),{code:'PVP_CARD_UNAVAILABLE'});
  h.saved(0).state.expedition={endsAt:h.now+10000,squad:['winter-c'],enhancementStages:{'winter-c':0}};
  assert.throws(()=>validatePvpDeck(h.saved(0).state,h.cards(),h.modules,'account-0',h.now),{code:'PVP_CARD_UNAVAILABLE'});
  h.saved(0).state.collection['winter-c']=2;
  assert.equal(validatePvpDeck(h.saved(0).state,h.cards(),h.modules,'account-0',h.now).length,4);
});

test('repeated self queue never creates a match and parallel accepts create exactly one durable battle',async()=>{
  const h=await harness();
  await Promise.all([1,2,3].map(()=>h.call('queue',0,{cards:h.cards()})));
  assert.equal(h.data().queue.length,1);assert.equal(h.data().matches.length,0);
  await h.call('queue',1,{cards:h.cards()});const match=h.data().matches[0];
  await Promise.all([0,1,0,1].map(i=>h.call('accept',i,{matchId:match.id})));
  assert.equal(h.data().rooms.length,1);assert.equal(h.data().matches.length,0);
  assert.equal(new Set(h.data().rooms[0].participants.map(p=>p.accountId)).size,2);
  h.restart();const restored=await h.call('state',0);
  assert.equal(restored.pvp.phase,'battle');assert.equal(restored.pvp.room.battle.teams.length,2);
  await assert.rejects(h.call('queue',0,{cards:h.cards()}),{code:'PVP_ALREADY_PARTICIPATING'});
});

test('ready expiry requeues only accepted players and a changed cloud lease cancels admission',async()=>{
  let h=await harness();let match=await h.ready();await h.call('accept',0,{matchId:match.id});
  const response=await h.call('state',0,{},h.now+30001);
  assert.equal(response.pvp.phase,'queued');assert.equal((await h.call('state',1,{},h.now+30001)).pvp.phase,'idle');
  h=await harness();match=await h.ready();await h.call('accept',0,{matchId:match.id});
  h.saved(0).activeLease.generation=2;
  await h.call('accept',1,{matchId:match.id});
  assert.equal(h.data().rooms.length,0);assert.deepEqual(h.data().queue.map(p=>p.accountId),['account-1']);
});

test('only the active cloud session and team acts; duplicate or stale actions never deal damage twice',async()=>{
  const h=await harness({count:3});const room=await h.enter();
  const request={roomId:room.id,expectedRevision:0,actionId:'first-action-0001',action:'basic',damage:999999999};
  await assert.rejects(h.call('action',1,request),{code:'PVP_NOT_YOUR_TURN'});
  await assert.rejects(h.call('action',2,request),{code:'PVP_ROOM_NOT_FOUND'});
  await assert.rejects(h.call('action',0,{...request,leaseId:'wrong'}));
  const [a,b]=await Promise.all([h.call('action',0,request),h.call('action',0,request)]);
  assert.equal(a.pvp.room.battle.actionCount,1);assert.equal(b.pvp.room.battle.actionCount,1);
  assert.equal(h.data().rooms[0].revision,1);
  assert.ok(h.data().rooms[0].battle.teams[1].cards[0].hp>0);
  await assert.rejects(h.call('action',0,{...request,actionId:'first-action-0002'}),{code:'PVP_STALE_TURN'});
});

test('durable deadlines advance after disconnect, terminate, and rating settles once across process restart',async()=>{
  const h=await harness();const initial=await h.enter();h.restart();
  const after=(await h.call('state',0,{},h.now+40001)).pvp.room;
  assert.equal(after.battle.actionCount,2);assert.equal(after.revision,2);
  assert.equal(after.turnExpiresAt,h.now+60000);
  const finished=(await h.call('state',0,{},h.now+2*3600000)).pvp.room;
  assert.equal(finished.battle.status,'finished');assert.ok(finished.battle.actionCount<=240);
  assert.equal(finished.id,initial.id);
  const ratings=()=>h.deps.TcgPvp.records.filter(row=>row.data.kind==='rating').map(row=>({rating:row.data.rating,receipts:row.data.settledMatches}));
  const settled=clone(ratings());assert.ok(settled.every(p=>p.receipts.length===1));
  h.restart();await h.call('state',0,{},h.now+2*3600000+1);await h.call('state',1,{},h.now+2*3600000+2);
  assert.deepEqual(ratings(),settled);
});

test('coin rewards require the committed result and claim atomically once even on concurrent retries',async()=>{
  const h=await harness({count:3}),room=await h.end();
  await assert.rejects(h.call('claim',2,{roomId:room.id,baseRevision:0}),{code:'PVP_REWARD_NOT_READY'});
  await assert.rejects(h.call('queue',0,{cards:h.cards()}),{code:'PVP_REWARD_PENDING'});
  const request={roomId:room.id,baseRevision:0,coins:999999999};
  const outcomes=await Promise.all([h.call('claim',0,request),h.call('claim',0,request)]);
  assert.equal(h.saved(0).state.wallet.coins,room.outcome.coins);assert.equal(h.saved(0).revision,1);
  assert.deepEqual(h.saved(0).pvpRewardClaims,[room.id]);assert.ok(outcomes.some(o=>o.alreadyClaimed));
  assert.ok(outcomes.every(o=>o.pvp.phase==='idle'));
  h.restart();await h.call('claim',0,request);assert.equal(h.saved(0).state.wallet.coins,room.outcome.coins);
  assert.equal((await h.call('state',1)).pvp.phase,'finished');
  await h.call('queue',0,{cards:h.cards()});assert.equal(h.data().queue.length,1);
});

test('save revision conflicts do not lose or duplicate pending rewards',async()=>{
  const h=await harness(),room=await h.end();h.saved(0).revision=2;h.saved(0).state.wallet.coins=17;
  await assert.rejects(h.call('claim',0,{roomId:room.id,baseRevision:0}),{code:'SAVE_CONFLICT'});
  assert.equal(h.saved(0).state.wallet.coins,17);assert.equal(h.saved(0).pvpRewardClaims.length,0);
  await h.call('claim',0,{roomId:room.id,baseRevision:2});assert.equal(h.saved(0).state.wallet.coins,17+room.outcome.coins);
});

test('new KST season resets rating independently without issuing unconfigured season rewards',async()=>{
  const now=Date.parse('2026-11-01T23:59:00+09:00'),h=await harness({now});
  const previous=await h.call('state',0);const profile=h.deps.TcgPvp.records.find(row=>row.data.kind==='rating');profile.data.rating=1400;
  const next=await h.call('state',0,{},Date.parse('2026-11-02T00:00:00+09:00'));
  assert.notEqual(previous.pvp.season.key,next.pvp.season.key);assert.equal(next.pvp.rating,1000);
  assert.equal(next.pvp.season.rewardPolicy.enabled,false);assert.equal(h.saved(0).state.wallet.coins,0);
  assert.equal(h.deps.TcgPvp.records.filter(row=>row.data.kind==='rating').length,2);
});

test('device takeover while a request waits for the coordinator prevents its later CAS write',async()=>{
  const h=await harness(),room=await h.enter();
  const original=h.deps.TcgPvp.findOne.bind(h.deps.TcgPvp);
  let switched=false;
  h.deps.TcgPvp.findOne=async query=>{
    const value=await original(query);
    if(query._id===COORDINATOR_ID&&!switched){switched=true;h.saved(0).activeLease.generation=2;}
    return value;
  };
  await assert.rejects(h.call('action',0,{roomId:room.id,expectedRevision:0,actionId:'takeover-action-0001',action:'basic'}),{code:'PLAY_SESSION_LOST'});
  assert.equal(h.data().rooms[0].battle.actionCount,0);
  assert.equal(h.data().rooms[0].actionReceipts.length,0);
});

test('different simultaneous action ids cannot spend the same turn twice',async()=>{
  const h=await harness(),room=await h.enter();
  const results=await Promise.allSettled(['left-action-0001','right-action-0001'].map(actionId=>
    h.call('action',0,{roomId:room.id,expectedRevision:0,actionId,action:'basic'})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'PVP_STALE_TURN');
  assert.equal(h.data().rooms[0].battle.actionCount,1);
  assert.equal(h.data().rooms[0].actionReceipts.length,1);
});

test('parallel matchmaking pairs eight players once and never leaves duplicate admission records',async()=>{
  const h=await harness({count:8});
  await Promise.all(h.accounts.map((_,i)=>h.call('queue',i,{cards:h.cards()})));
  assert.equal(h.data().queue.length,0);assert.equal(h.data().matches.length,4);
  const ids=h.data().matches.flatMap(match=>match.players.map(player=>player.accountId));
  assert.equal(ids.length,8);assert.equal(new Set(ids).size,8);
});

test('in-flight battles settle into their original season after the boundary, while current rating stays fresh',async()=>{
  const now=Date.parse('2026-11-01T23:59:00+09:00'),h=await harness({now});
  const room=await h.enter(),before=room.seasonKey;
  const response=await h.call('state',0,{},now+2*3600000);
  assert.equal(response.pvp.phase,'finished');assert.notEqual(response.pvp.season.key,before);
  assert.equal(response.pvp.room.seasonKey,before);assert.equal(response.pvp.rating,1000);
  const ratings=h.deps.TcgPvp.records.filter(row=>row.data.kind==='rating');
  assert.ok(ratings.filter(row=>row.data.seasonKey===before).every(row=>row.data.settledMatches.length===1));
  assert.ok(ratings.filter(row=>row.data.seasonKey!==before).every(row=>row.data.settledMatches.length===0));
  h.restart();await h.call('claim',0,{roomId:room.id,baseRevision:0},now+2*3600000+1);
  assert.equal(h.saved(0).state.wallet.coins,response.pvp.room.outcome.coins);
});

test('battle choices cannot persist oversized strings or objects; offline logs and receipts stay bounded',async()=>{
  const h=await harness(),room=await h.enter();
  const request={roomId:room.id,expectedRevision:0,actionId:'size-audit-0001',action:'skill'};
  for(const choice of ['x'.repeat(100000),{value:'charge',data:'x'.repeat(100000)},['charge']])
    await assert.rejects(h.call('action',0,{...request,choice}),{code:'PVP_INVALID_ACTION'});
  await assert.rejects(h.call('action',0,{...request,galaxyChoice:{value:'attack'}}),{code:'PVP_INVALID_ACTION'});
  assert.equal(h.data().rooms[0].battle.actionCount,0);
  const finished=(await h.call('state',0,{},h.now+2*3600000)).pvp.room;
  assert.ok(finished.battle.log.length<=160);
  assert.ok(h.deps.TcgPvp.records.find(row=>row._id===`archive:${room.id}`).data.actionReceipts.length<=240);
  assert.ok(Buffer.byteLength(JSON.stringify(finished))<256*1024);
});

test('an uninitialized cloud state cannot enter matchmaking even with a matching lease',async()=>{
  const h=await harness();h.saved(0).initialized=false;
  await assert.rejects(h.call('queue',0,{cards:h.cards()}));
  assert.equal(h.data(),undefined);
});
