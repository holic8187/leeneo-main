import {CARD_ART_MANIFEST} from '../data/cardArtManifest.js';
import {createCardArtCache,CARD_ART_NOT_VISIBLE} from './cardArtCache.js';

const placeholder=(label)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><radialGradient id="g"><stop stop-color="#344c66"/><stop offset="1" stop-color="#101a2b"/></radialGradient></defs><path fill="url(#g)" d="M0 0h300v400H0z"/><path d="m150 100 60 90-60 90-60-90Z" fill="none" stroke="#8daed5" stroke-width="2"/><path d="m150 130 40 60-40 60-40-60Z" fill="#8daed522"/><text x="150" y="325" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#c2d8ef">${label}</text></svg>`)}`;
const pendingArt=placeholder('원화를 불러오고 있어요');
const missingArt=placeholder('연결 후 원화를 표시해요');

export function installCardArtCache({document=globalThis.document,window=globalThis.window,cache=createCardArtCache(),
  remoteBase=typeof __REMOTE_CARD_ART_BASE__==='string'?__REMOTE_CARD_ART_BASE__:'',now=Date.now,retryDelayMs=30000}={}){
  if(!document||!window||!remoteBase)return ()=>{};
  const base=new URL(remoteBase).origin;
  const watched=new Map();let retryTimer=null,disposed=false,lastForcedRetry=-Infinity;
  const descriptor=source=>{
    try{const url=new URL(source);if(url.origin!==base||!url.pathname.startsWith('/api/tcg/art/'))return null;
      const filename=decodeURIComponent(url.pathname.split('/').at(-1));
      const id=filename.replace(/\.(webp|png)$/,'');const art=CARD_ART_MANIFEST[id];
      return art&&filename===art.path.split('/').at(-1)?{...art,cardId:id}:null;
    }catch{return null;}
  };
  const release=img=>{
    const entry=watched.get(img);if(!entry)return;
    entry.generation++;entry.visible=false;
    intersection?.unobserve(img);entry.release?.();watched.delete(img);
  };
  const park=img=>{
    const entry=watched.get(img);if(!entry)return;
    entry.visible=false;entry.generation++;entry.loading=false;entry.retryAt=0;
    entry.objectUrl=null;img.src=pendingArt;img.dataset.cardArtState='waiting';
    entry.release?.();entry.release=null;
  };
  const scheduleRetry=()=>{
    if(retryTimer!==null)window.clearTimeout(retryTimer);
    retryTimer=null;
    if(disposed||document.visibilityState==='hidden')return;
    const pending=[...watched].filter(([img,entry])=>img.isConnected&&entry.visible&&entry.retryAt>0);
    if(!pending.length)return;
    const next=Math.min(...pending.map(([,entry])=>entry.retryAt));
    retryTimer=window.setTimeout(()=>{
      retryTimer=null;
      for(const[img,entry]of watched){if(!img.isConnected)release(img);else if(entry.visible&&entry.retryAt>0&&entry.retryAt<=now())load(img);}
      scheduleRetry();
    },Math.max(1,next-now()));
  };
  const load=img=>{
    const entry=watched.get(img);
    if(disposed||!entry||!entry.visible||!img.isConnected||entry.loading)return;
    entry.release ||= cache.retain(entry.source);
    const generation=++entry.generation;
    const current=()=>!disposed&&img.isConnected&&watched.get(img)===entry&&entry.visible&&entry.generation===generation;
    entry.loading=true;entry.retryAt=0;let cancelled=false;
    img.dataset.cardArtState='loading';
    cache.get(entry.source,entry.art).then(url=>{
      if(current()){
        entry.objectUrl=url;img.src=url;img.dataset.cardArtState='ready';
      }
    }).catch(error=>{
      if(error?.code===CARD_ART_NOT_VISIBLE){cancelled=true;return;}
      if(current()){
        img.src=missingArt;img.dataset.cardArtState='unavailable';entry.retryAt=now()+retryDelayMs;
      }
    }).finally(()=>{
      if(entry.generation===generation)entry.loading=false;
      // Reentry can race the queued cancellation settling. It is not a failed
      // network request and must not leave the newly visible IMG waiting 30 s.
      if(cancelled&&current())queueMicrotask(()=>load(img));
      scheduleRetry();
    });
  };
  const intersection=window.IntersectionObserver?new window.IntersectionObserver(entries=>{
    for(const observed of entries){
      const entry=watched.get(observed.target);if(!entry)continue;
      if(observed.isIntersecting){
        if(!entry.visible){entry.visible=true;load(observed.target);}
      }else park(observed.target);
    }
    scheduleRetry();
  },{rootMargin:'350px'}):null;
  const watch=img=>{
    const source=img.getAttribute('src'),art=descriptor(source),entry=watched.get(img);
    if(!art){
      if(entry&&![pendingArt,missingArt,entry.objectUrl].includes(source))release(img);
      return;
    }
    release(img);
    watched.set(img,{source,art,release:null,visible:!intersection,generation:0,loading:false,retryAt:0,objectUrl:null});
    img.dataset.cardArtSource=source;img.dataset.cardArtState='waiting';img.src=pendingArt;
    if(intersection)intersection.observe(img);else load(img);
  };
  const scan=node=>{if(node.nodeType!==1)return;if(node.tagName==='IMG')watch(node);for(const img of node.querySelectorAll('img'))watch(img);};
  const observer=new window.MutationObserver(records=>{
    for(const record of records){if(record.type==='attributes')watch(record.target);else for(const node of record.addedNodes)scan(node);}
    for(const img of watched.keys())if(!img.isConnected)release(img);
    scheduleRetry();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  scan(document.documentElement);
  const retry=()=>{
    if(disposed)return;
    if(document.visibilityState==='hidden'){scheduleRetry();return;}
    // Foreground/network events can recover immediately, but repeated events
    // must not bypass the retry interval on every animation/render frame.
    if(now()-lastForcedRetry>=5000){
      lastForcedRetry=now();cache.retry();
      for(const[img,entry]of watched)if(img.isConnected&&entry.visible&&entry.retryAt>0)load(img);
    }
    scheduleRetry();
  };
  window.addEventListener('online',retry);
  document.addEventListener('visibilitychange',retry);
  return ()=>{
    disposed=true;observer.disconnect();intersection?.disconnect();window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);
    if(retryTimer!==null)window.clearTimeout(retryTimer);
    for(const img of watched.keys())release(img);
    cache.dispose();
  };
}

if(typeof document!=='undefined')installCardArtCache();
