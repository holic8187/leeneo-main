import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {createCardArtCache,CARD_ART_NOT_VISIBLE} from '../src/services/cardArtCache.js';
import {cardArtLocation} from '../src/core/cardArtLocation.js';
const bytes=new Uint8Array([1,3,4,8]);
const blob=new Blob([bytes],{type:'image/webp'});
const art={cardId:'simsim-c',bytes:blob.size,sha256:createHash('sha256').update(bytes).digest('hex')};
function harness(overrides={}){
  const records=new Map();let fetched=0,created=0;const revoked=[],requests=[];
  const storage={get:async url=>records.get(url),put:async value=>records.set(value.url,value)};
  const cache=createCardArtCache({storage,crypto:webcrypto,fetchImpl:async(url,options)=>{fetched+=1;requests.push({url,options});return{ok:true,blob:async()=>blob};},
    urlApi:{createObjectURL:()=>`blob:test-${++created}`,revokeObjectURL:url=>revoked.push(url)},...overrides});
  return{cache,records,storage,revoked,requests,get fetched(){return fetched;}};
}
test('first download verifies bytes and persists only image data',async()=>{
  const h=harness();const value=await h.cache.get('https://game.test/art.webp',art);
  assert.match(value,/^blob:test/);assert.equal(h.fetched,1);
  assert.equal(h.requests[0].options.cache,'no-store');
  assert.equal(h.requests[0].options.credentials,'omit');
  const saved=h.records.get('https://game.test/art.webp');assert.equal(saved.sha256,art.sha256);assert.equal(saved.blob.size,4);
  assert.equal('token' in saved,false);
});
test('duplicates share one download and a memory URL',async()=>{
  const h=harness();const values=await Promise.all(Array.from({length:12},()=>h.cache.get('same',art)));
  assert.equal(h.fetched,1);assert.equal(new Set(values).size,1);
});
test('a subsequent app session reads saved art while offline',async()=>{
  const first=harness();await first.cache.get('image',art);
  let calls=0;const second=harness({storage:first.storage,fetchImpl:async()=>{calls++;throw new Error('offline');}});
  assert.match(await second.cache.get('image',art),/^blob:/);assert.equal(calls,0);
});
test('a changed image revision requires fresh verified bytes',async()=>{
  const h=harness();h.records.set('image',{blob,sha256:'old'});await h.cache.get('image',art);assert.equal(h.fetched,1);
});
test('storage being unavailable does not prevent displaying an image',async()=>{
  const h=harness({storage:{get:async()=>{throw new Error('blocked');},put:async()=>{throw new Error('quota');}}});
  assert.match(await h.cache.get('image',art),/^blob:/);
});
test('bad content and mismatching hashes are not persisted',async()=>{
  for(const bad of [{...art,sha256:'0'.repeat(64)},{...art,bytes:42}]){
    const h=harness();await assert.rejects(h.cache.get('image',bad));assert.equal(h.records.size,0);
  }
  const h=harness({fetchImpl:async()=>({ok:true,blob:async()=>new Blob(['<script/>'],{type:'text/html'})})});
  await assert.rejects(h.cache.get('image',art));assert.equal(h.records.size,0);
});
test('failures back off across frequent game rerenders and retry on reconnect',async()=>{
  let requests=0;const h=harness({fetchImpl:async()=>{requests++;throw new Error('offline');}});
  for(let i=0;i<5;i++)await assert.rejects(h.cache.get('image',art));
  assert.equal(requests,1);h.cache.retry();await assert.rejects(h.cache.get('image',art));assert.equal(requests,2);
});
test('memory eviction releases blob URLs and preserves local fallback in Node',async()=>{
  const h=harness({maxMemory:2});for(let i=0;i<3;i++)await h.cache.get(`image-${i}`,art);
  assert.equal(h.revoked.length,1);h.cache.dispose();assert.equal(h.revoked.length,3);
  assert.equal(cardArtLocation('simsim-c','./assets/cards/simsim-c.webp'),'./assets/cards/simsim-c.webp');
});

test('forty retained cache hits stay valid before display and evict only after their last IMG leaves',async()=>{
  const h=harness({storage:{get:async()=>({blob,sha256:art.sha256})}});
  const release=Array.from({length:40},(_,index)=>h.cache.retain(`visible-${index}`));
  const secondOwner=h.cache.retain('visible-0');
  const urls=await Promise.all(release.map((_,index)=>h.cache.get(`visible-${index}`,art).then(url=>{
    assert.equal(h.revoked.includes(url),false,'URL must still exist when IMG receives it');return url;
  })));
  assert.equal(h.revoked.length,0);
  for(const free of release)free();
  assert.equal(h.revoked.length,7);assert.equal(h.revoked.includes(urls[0]),false);
  secondOwner();assert.equal(h.revoked.length,8);secondOwner();assert.equal(h.revoked.length,8);
});

const replacementBytes=new Uint8Array([2,4,6,8,10]);
const replacementBlob=new Blob([replacementBytes],{type:'image/webp'});
const replacementHash=createHash('sha256').update(replacementBytes).digest('hex');
function replacementResponse({hash=replacementHash,size=replacementBlob.size,body=replacementBlob,url='https://game.test/api/tcg/art/simsim-c.webp',revision=hash}={}){
  return {ok:true,url,headers:new Headers({'X-Card-Art-SHA256':hash,'X-Card-Art-Revision':revision,'X-Card-Art-Bytes':String(size)}),blob:async()=>body};
}

test('an old app verifies the announced replacement and reuses it offline under its requested revision',async()=>{
  const url=`https://game.test/api/tcg/art/simsim-c.webp?v=${art.sha256}`;
  const first=harness({fetchImpl:async()=>replacementResponse()});
  await first.cache.get(url,art);
  const saved=first.records.get(url);
  assert.equal(saved.requestedSha256,art.sha256);assert.equal(saved.sha256,replacementHash);assert.equal(saved.bytes,5);
  let requests=0;const next=harness({storage:first.storage,fetchImpl:async()=>{requests++;throw new Error('offline');}});
  assert.match(await next.cache.get(url,art),/^blob:/);assert.equal(requests,0);
});

test('replacement headers cannot excuse wrong bytes, hashes, redirects or an untrusted transport',async()=>{
  for(const response of [replacementResponse({hash:'0'.repeat(64)}),replacementResponse({size:99}),
    replacementResponse({revision:art.sha256}),replacementResponse({url:'https://elsewhere.test/fake.webp'})]){
    const h=harness({fetchImpl:async()=>response});
    await assert.rejects(h.cache.get('https://game.test/api/tcg/art/simsim-c.webp',art));assert.equal(h.records.size,0);
  }
  const h=harness({fetchImpl:async()=>replacementResponse()});
  await assert.rejects(h.cache.get('http://game.test/api/tcg/art/simsim-c.webp',art));assert.equal(h.records.size,0);
});

test('cached replacement pixels are checked again before display',async()=>{
  const h=harness();h.records.set('image',{blob,sha256:replacementHash,bytes:blob.size,requestedSha256:art.sha256});
  await h.cache.get('image',art);assert.equal(h.fetched,1);
});

test('a fetch ignoring abort cannot block the other queued artwork forever',async()=>{
  let calls=0;const h=harness({concurrency:1,requestTimeoutMs:20,fetchImpl:async()=>{
    if(++calls===1)return new Promise(()=>{});return {ok:true,blob:async()=>blob};
  }});
  const stalled=h.cache.get('stalled',art),next=h.cache.get('next',art);
  await assert.rejects(stalled,/timeout/);assert.match(await next,/^blob:/);assert.equal(calls,2);
});

test('WebViews without working SubtleCrypto still display verified images and reject altered pixels',async()=>{
  for(const crypto of [null,{}, {subtle:undefined}, {subtle:{digest:async()=>{throw new DOMException('unsupported','NotSupportedError');}}}]){
    const h=harness({crypto});await h.cache.get('valid',art);assert.equal(h.records.size,1);
    await assert.rejects(h.cache.get('invalid',{...art,sha256:'0'.repeat(64)}),/revision mismatch/);
    assert.equal(h.records.size,1);
    const offline=harness({crypto,storage:h.storage,fetchImpl:async()=>{throw new Error('offline');}});
    assert.match(await offline.cache.get('valid',art),/^blob:/);
  }
});

test('fast scrolling cancels 221 queued originals and reentry starts immediately without failure backoff',async()=>{
  const transfers=[];let calls=0;
  const h=harness({fetchImpl:async()=>{
    calls++;if(calls<=3)return new Promise(resolve=>transfers.push(resolve));return {ok:true,blob:async()=>blob};
  }});
  const release=Array.from({length:224},(_,i)=>h.cache.retain(`scroll-${i}`));
  const requests=release.map((_,i)=>h.cache.get(`scroll-${i}`,art).catch(error=>error));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);
  release.forEach(free=>free());transfers.forEach(resolve=>resolve({ok:true,blob:async()=>blob}));
  const results=await Promise.all(requests);
  assert.equal(calls,3);assert.equal(results.filter(value=>value?.code===CARD_ART_NOT_VISIBLE).length,221);
  const free=h.cache.retain('scroll-223');assert.match(await h.cache.get('scroll-223',art),/^blob:/);assert.equal(calls,4);free();
});

test('a remaining IMG pin and unmanaged cache consumers keep their queued downloads',async()=>{
  let completeFirst;const fetched=[];
  const h=harness({concurrency:1,fetchImpl:async url=>{
    fetched.push(url);if(url==='active')return new Promise(resolve=>{completeFirst=resolve;});return {ok:true,blob:async()=>blob};
  }});
  const active=h.cache.get('active',art);
  const first=h.cache.retain('shared'),second=h.cache.retain('shared');const shared=h.cache.get('shared',art);first();
  const unmanaged=h.cache.get('unmanaged',art);
  const releasePromoted=h.cache.retain('promoted');const managed=h.cache.get('promoted',art);releasePromoted();
  const adopted=h.cache.get('promoted',art);assert.equal(adopted,managed);
  await new Promise(resolve=>setImmediate(resolve));completeFirst({ok:true,blob:async()=>blob});
  const values=await Promise.all([active,shared,unmanaged,managed,adopted]);
  assert.ok(values.every(value=>value.startsWith('blob:')));assert.deepEqual(fetched,['active','shared','unmanaged','promoted']);second();
});
