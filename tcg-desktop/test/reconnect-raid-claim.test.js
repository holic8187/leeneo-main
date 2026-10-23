import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudPlaySession} from '../src/core/cloudPlaySession.js';
import {createReconnectController} from '../src/core/reconnectController.js';
import {createPvpClient} from '../src/core/pvpClient.js';
import {createCooperativeRaidClient} from '../src/core/cooperativeRaidClient.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const snapshot=(extra={})=>({leaseId:'lease-1',generation:1,expiresAt:10000,serverNow:1000,
  revision:3,state:{wallet:{coins:100}},initialized:true,...extra});
const modes=[['pvp',createPvpClient],['cooperative',createCooperativeRaidClient]];

for(const[field,createClient]of modes){
  test(`${field}: same-token reconnect verifies a room while its claim waits to commit`,{timeout:2000},async t=>{
    const connection=deferred(),commitWaiting=deferred(),claimResponse=deferred(),sent=deferred();
    const remote=[];let reads=0,claims=0,commits=0;
    const cloud=createCloudPlaySession({accountId:'account-a',deviceId:'device-pc',token:'unchanged-jwt',
      gateway:{open:async()=>snapshot(),heartbeat:async()=>snapshot({revision:4,state:null})},
      setIntervalImpl:()=>1,clearIntervalImpl:()=>{},onRemoteState:state=>remote.push(state)});
    t.after(()=>{connection.resolve(false);cloud.dispose();});
    await cloud.open();
    const client=createClient({getIdentity:()=>({accountId:'account-a',token:'unchanged-jwt'}),gateway:{
      state:async()=>{reads++;return {[field]:{phase:reads===1?'finished':'idle',serverNow:1000}};},
      claim:async()=>{claims++;sent.resolve();return claimResponse.promise;},
    }});
    await client.refresh();
    const mutation=client.mutate('claim',()=>cloud.beginAuthoritativeMutation({wallet:{coins:100}}),async payload=>{
      commitWaiting.resolve();if(!await connection.promise)return;
      assert.equal(cloud.getSnapshot().phase,'active');
      cloud.commitAuthoritativeMutation(payload.snapshot);commits++;
    });
    await sent.promise;cloud.suspend();
    claimResponse.resolve({[field]:{phase:'idle',serverNow:1000},snapshot:snapshot({revision:4,state:{wallet:{coins:700}}})});
    await commitWaiting.promise;
    assert.equal(client.getState().pending,'claim');assert.equal(await client.refresh(),null);
    const reconnect=createReconnectController({attempt:async()=>{
      assert.equal(await cloud.resume(),true);
      const verified=await client.refresh({forReconnect:true});assert.ok(verified);
      // A validation GET must never replace the pending reward response.
      assert.equal(client.getState().data.phase,'finished');assert.equal(commits,0);
      return true;
    },onChange:state=>{if(state.phase==='connected')connection.resolve(true);}});
    t.after(()=>reconnect.cancel());
    assert.equal(await reconnect.start(),true);await mutation;
    assert.equal(reads,2);assert.equal(claims,1);assert.equal(commits,1);
    assert.equal(client.getState().pending,'');assert.equal(client.getState().data.phase,'idle');
    assert.equal(cloud.getSnapshot().revision,4);assert.equal(remote.at(-1).wallet.coins,700);
  });

  test(`${field}: device takeover keeps a waiting reward behind the connection gate`,{timeout:2000},async t=>{
    const connection=deferred(),commitWaiting=deferred();let commits=0,reads=0;
    const cloud=createCloudPlaySession({accountId:'account-a',deviceId:'device-pc',token:'unchanged-jwt',
      gateway:{open:async()=>snapshot(),heartbeat:async()=>{throw Object.assign(new Error('playing on mobile'),{code:'PLAYING_ELSEWHERE',activePlatform:'android'});}},
      setIntervalImpl:()=>1,clearIntervalImpl:()=>{}});
    t.after(()=>{connection.resolve(false);cloud.dispose();});await cloud.open();
    const client=createClient({getIdentity:()=>({accountId:'account-a',token:'unchanged-jwt'}),gateway:{
      state:async()=>{reads++;return {[field]:{phase:'finished',serverNow:1000}};},
      claim:async()=>({[field]:{phase:'idle',serverNow:1000},snapshot:snapshot({revision:4,state:{wallet:{coins:700}}})}),
    }});
    await client.refresh();
    const mutation=client.mutate('claim',()=>cloud.beginAuthoritativeMutation({wallet:{coins:100}}),async payload=>{
      commitWaiting.resolve();if(await connection.promise){cloud.commitAuthoritativeMutation(payload.snapshot);commits++;}
    });
    await commitWaiting.promise;cloud.suspend();
    const reconnect=createReconnectController({attempt:async()=>{
      if(!await cloud.resume())return {blocked:true};
      await client.refresh({forReconnect:true});return true;
    },onChange:state=>{if(state.phase==='connected')connection.resolve(true);}});
    t.after(()=>reconnect.cancel());
    assert.equal(await reconnect.start(),false);assert.equal(reconnect.getSnapshot().phase,'blocked');
    assert.equal(cloud.getSnapshot().phase,'playing-elsewhere');assert.equal(reads,1);assert.equal(commits,0);
    client.reset();connection.resolve(false);await mutation;
    assert.equal(client.getState().data,null);assert.equal(cloud.getSnapshot().revision,3);
  });

  test(`${field}: old reconnect reads and pending claims cannot cross an account reset`,{timeout:2000},async()=>{
    let identity={accountId:'old',token:'old-token'},reads=0;
    const response=deferred(),commitWaiting=deferred(),finishCommit=deferred();
    const client=createClient({getIdentity:()=>identity,gateway:{
      state:async()=>++reads===1?{[field]:{phase:'finished',serverNow:1000}}:response.promise,
      claim:async()=>({[field]:{phase:'idle',serverNow:1000}}),
    }});
    await client.refresh();const claim=client.mutate('claim',()=>({}),async()=>{commitWaiting.resolve();await finishCommit.promise;});
    await commitWaiting.promise;const verification=client.refresh({forReconnect:true});
    identity={accountId:'new',token:'new-token'};client.reset();
    response.resolve({[field]:{phase:'finished',serverNow:1000}});assert.equal(await verification,null);
    finishCommit.resolve();await claim;assert.equal(client.getState().data,null);assert.equal(client.getState().pending,'');
  });
}
