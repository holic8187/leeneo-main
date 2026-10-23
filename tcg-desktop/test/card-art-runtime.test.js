import test from 'node:test';
import assert from 'node:assert/strict';
import {installCardArtCache} from '../src/services/cardArtCacheRuntime.js';
import {CARD_ART_MANIFEST} from '../src/data/cardArtManifest.js';
import {CARD_ART_NOT_VISIBLE} from '../src/services/cardArtCache.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const imageUrl=`https://game.test/api/tcg/art/${CARD_ART_MANIFEST['simsim-c'].path.split('/').at(-1)}?v=${CARD_ART_MANIFEST['simsim-c'].sha256}`;
function runtime({failures=0,count=1,intersect=false,getImage}={}){
  let time=100000,timerId=0,calls=0,activePins=0,disposed=false,mutation,intersection,rootMargin;
  const timers=new Map(),windowEvents=new Map(),documentEvents=new Map(),records=[],observed=new Set();
  const mutate=record=>{records.push(record);queueMicrotask(()=>{if(records.length&&mutation)mutation(records.splice(0));});};
  class Img{
    constructor(){this.nodeType=1;this.tagName='IMG';this.dataset={};this.isConnected=true;this._src=imageUrl;}
    getAttribute(name){return name==='src'?this._src:null;}
    set src(value){this._src=value;mutate({type:'attributes',target:this});}
    get src(){return this._src;}
    querySelectorAll(){return [];}
  }
  const images=Array.from({length:count},()=>new Img());
  const document={visibilityState:'visible',documentElement:{nodeType:1,tagName:'DIV',querySelectorAll:()=>images.filter(img=>img.isConnected)},
    addEventListener:(event,callback)=>documentEvents.set(event,callback),removeEventListener:event=>documentEvents.delete(event)};
  const window={MutationObserver:class{constructor(callback){mutation=callback;}observe(){}disconnect(){mutation=null;}},
    setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,at:time+delay});return id;},clearTimeout:id=>timers.delete(id),
    addEventListener:(event,callback)=>windowEvents.set(event,callback),removeEventListener:event=>windowEvents.delete(event)};
  if(intersect)window.IntersectionObserver=class{
    constructor(callback,options){intersection=callback;rootMargin=options.rootMargin;}
    observe(img){observed.add(img);}unobserve(img){observed.delete(img);}disconnect(){observed.clear();}
  };
  const cache={retain:()=>{activePins++;let released=false;return()=>{if(!released){released=true;activePins--;}};},
    get:async(source)=>{calls++;if(getImage)return getImage(source,calls);if(calls<=failures)throw new Error('503');return 'blob:verified';},retry(){},dispose(){disposed=true;}};
  const uninstall=installCardArtCache({document,window,cache,remoteBase:'https://game.test',now:()=>time});
  return {images,document,uninstall,get calls(){return calls;},get pins(){return activePins;},get disposed(){return disposed;},get timerCount(){return timers.size;},get observedCount(){return observed.size;},get rootMargin(){return rootMargin;},
    async advance(ms){time+=ms;for(const[id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.callback();}await settle();},
    async online(){windowEvents.get('online')?.();await settle();},
    async visibility(state){document.visibilityState=state;documentEvents.get('visibilitychange')?.();await settle();},
    async intersect(indices,isIntersecting){intersection(indices.map(index=>({target:images[index],isIntersecting})));await settle();},
    async remove(index){images[index].isConnected=false;mutate({type:'childList',addedNodes:[]});await settle();}};
}

test('an open image recovers after 30 seconds without rerendering the popup',async()=>{
  const h=runtime({failures:1});await settle();assert.equal(h.calls,1);assert.equal(h.images[0].dataset.cardArtState,'unavailable');
  await h.advance(29999);assert.equal(h.calls,1);
  await h.advance(1);assert.equal(h.calls,2);assert.equal(h.images[0].src,'blob:verified');assert.equal(h.images[0].dataset.cardArtState,'ready');
  assert.equal(h.timerCount,0);h.uninstall();assert.equal(h.pins,0);
});

test('online and foreground events recover failures and repeated events are throttled',async()=>{
  const h=runtime({failures:2});await settle();await h.online();assert.equal(h.calls,2);
  await h.online();assert.equal(h.calls,2);await h.visibility('hidden');await h.advance(30000);assert.equal(h.calls,2);
  await h.visibility('visible');assert.equal(h.calls,3);assert.equal(h.images[0].dataset.cardArtState,'ready');h.uninstall();
});

test('live image references are retained until their DOM node leaves, and cleanup cancels retries',async()=>{
  const h=runtime({count:40,failures:40});await settle();assert.equal(h.pins,40);
  await h.remove(0);assert.equal(h.pins,39);
  h.uninstall();assert.equal(h.pins,0);assert.equal(h.timerCount,0);assert.equal(h.disposed,true);
  await h.advance(30000);assert.equal(h.calls,40);
});

test('scrolling all 224 cards retains only the viewport margin while keeping observation active',async()=>{
  const h=runtime({count:224,intersect:true});await settle();
  assert.equal(h.calls,0);assert.equal(h.pins,0);assert.equal(h.rootMargin,'350px');assert.equal(h.observedCount,224);
  let previous=[];
  for(let start=0;start<224;start+=8){
    if(previous.length)await h.intersect(previous,false);
    const visible=Array.from({length:8},(_,i)=>start+i);await h.intersect(visible,true);
    assert.equal(h.pins,8);assert.equal(h.observedCount,224);
    for(const index of previous){assert.match(h.images[index].src,/^data:image\/svg/);assert.equal(h.images[index].dataset.cardArtState,'waiting');}
    previous=visible;
  }
  await h.intersect(previous,false);assert.equal(h.pins,0);
  await h.intersect([0],true);assert.equal(h.pins,1);assert.equal(h.images[0].src,'blob:verified');assert.equal(h.calls,225);
  h.uninstall();assert.equal(h.pins,0);assert.equal(h.observedCount,0);
});

test('a download completing after scroll-out cannot restore or repin the offscreen image',async()=>{
  let complete;const h=runtime({intersect:true,getImage:()=>new Promise(resolve=>{complete=resolve;})});
  await h.intersect([0],true);assert.equal(h.pins,1);await h.intersect([0],false);assert.equal(h.pins,0);
  complete('blob:late');await settle();assert.match(h.images[0].src,/^data:image\/svg/);assert.equal(h.images[0].dataset.cardArtState,'waiting');assert.equal(h.pins,0);
  h.uninstall();
});

test('scroll reentry and recycled IMG sources ignore completions from earlier request generations',async()=>{
  const requests=[];const h=runtime({intersect:true,getImage:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))});
  await h.intersect([0],true);await h.intersect([0],false);await h.intersect([0],true);
  requests[0].resolve('blob:first-visit');await settle();assert.notEqual(h.images[0].src,'blob:first-visit');assert.equal(h.images[0].dataset.cardArtState,'loading');assert.equal(h.pins,1);
  requests[1].resolve('blob:second-visit');await settle();assert.equal(h.images[0].src,'blob:second-visit');
  await h.intersect([0],false);await h.intersect([0],true);
  const other=CARD_ART_MANIFEST['winter-c'];h.images[0].src=`https://game.test/api/tcg/art/${other.path.split('/').at(-1)}?v=${other.sha256}`;await settle();
  assert.equal(h.pins,0);await h.intersect([0],true);assert.equal(h.pins,1);
  requests[2].reject(new Error('old card failed late'));await settle();assert.equal(h.images[0].dataset.cardArtState,'loading');assert.equal(h.timerCount,0);
  requests[3].resolve('blob:new-card');await settle();assert.equal(h.images[0].src,'blob:new-card');assert.equal(h.pins,1);
  h.uninstall();
});

test('offscreen failures do not retry in the background and resume on reentry',async()=>{
  const h=runtime({intersect:true,failures:1});await h.intersect([0],true);assert.equal(h.images[0].dataset.cardArtState,'unavailable');
  await h.intersect([0],false);assert.equal(h.pins,0);assert.equal(h.timerCount,0);
  await h.advance(30000);await h.online();assert.equal(h.calls,1);
  await h.intersect([0],true);assert.equal(h.calls,2);assert.equal(h.images[0].src,'blob:verified');h.uninstall();
});

test('a just-reentered IMG retries a stale queue cancellation without the network failure timer',async()=>{
  const h=runtime({intersect:true,getImage:async(source,calls)=>{
    if(calls===1)throw Object.assign(new Error('old viewport request cancelled'),{code:CARD_ART_NOT_VISIBLE});return 'blob:reentered';
  }});
  await h.intersect([0],true);assert.equal(h.calls,2);assert.equal(h.images[0].src,'blob:reentered');assert.equal(h.timerCount,0);assert.equal(h.pins,1);h.uninstall();
});
