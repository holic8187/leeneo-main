import {sha256Hex} from '../core/sha256.js';

const MAX_ART_BYTES=12*1024*1024;
export const CARD_ART_CACHE_LIMIT=200*1024*1024;
export const CARD_ART_NOT_VISIBLE='CARD_ART_NOT_VISIBLE';
const timeout=(promise,ms,message)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(message)),ms);
  promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
});

/** Artwork is public and account-independent. It never shares the game save DB. */
export function createIndexedCardArtStorage({indexedDB=globalThis.indexedDB,maxBytes=CARD_ART_CACHE_LIMIT}={}) {
  let database;
  const open=()=>database ||= new Promise((resolve,reject)=>{
    if(!indexedDB){reject(new Error('Image storage unavailable'));return;}
    const request=indexedDB.open('hoi-card-art-v1',1);
    request.onupgradeneeded=()=>{
      request.result.createObjectStore('art',{keyPath:'url'});
      request.result.createObjectStore('metadata',{keyPath:'url'});
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Image storage is busy'));
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
  return {
    async get(url){
      const db=await timeout(open(),2000,'Image storage timeout');
      return timeout(new Promise((resolve,reject)=>{
        const tx=db.transaction(['art','metadata'],'readwrite');
        const request=tx.objectStore('art').get(url);
        let found=null;
        request.onsuccess=()=>{found=request.result;const meta=tx.objectStore('metadata').get(url);meta.onsuccess=()=>{if(meta.result)tx.objectStore('metadata').put({...meta.result,lastUsed:Date.now()});};};
        tx.oncomplete=()=>resolve(found);
        tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Image read failed'));
      }),2000,'Image read timeout');
    },
    async put(entry){
      if(entry.bytes>maxBytes)return;
      const db=await timeout(open(),2000,'Image storage timeout');
      return timeout(new Promise((resolve,reject)=>{
        const tx=db.transaction(['art','metadata'],'readwrite');
        const art=tx.objectStore('art'),meta=tx.objectStore('metadata');
        const all=meta.getAll();
        all.onsuccess=()=>{
          const rows=all.result.filter(row=>row.url!==entry.url);
          const retained=[];
          for(const row of rows){if(row.cardId===entry.cardId){art.delete(row.url);meta.delete(row.url);}else retained.push(row);}
          let bytes=retained.reduce((sum,row)=>sum+row.bytes,0)+entry.bytes;
          for(const row of retained.sort((a,b)=>a.lastUsed-b.lastUsed)){if(bytes<=maxBytes)break;art.delete(row.url);meta.delete(row.url);bytes-=row.bytes;}
          art.put({url:entry.url,blob:entry.blob,sha256:entry.sha256,bytes:entry.bytes,requestedSha256:entry.requestedSha256});
          const {blob,...metadata}=entry;meta.put({...metadata,lastUsed:Date.now()});
        };
        tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Image cache full'));
      }),3000,'Image write timeout');
    },
  };
}

export function createCardArtCache({storage=createIndexedCardArtStorage(),fetchImpl=globalThis.fetch,
  crypto=globalThis.crypto,urlApi=globalThis.URL,now=Date.now,concurrency=3,maxMemory=32,requestTimeoutMs=15000}={}) {
  const pending=new Map(),memory=new Map(),failed=new Map(),pins=new Map(),queue=[];
  let active=0,disposed=false;
  const schedule=task=>new Promise((resolve,reject)=>{queue.push({task,resolve,reject});pump();});
  const pump=()=>{while(active<concurrency&&queue.length){const job=queue.shift();active+=1;Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{active-=1;pump();});}};
  const evictIdle=()=>{
    const idle=[...memory.keys()].filter(key=>!pins.has(key));
    while(idle.length>maxMemory){const first=idle.shift();urlApi.revokeObjectURL(memory.get(first));memory.delete(first);}
  };
  const remember=(key,blob)=>{
    if(disposed)throw new Error('Image cache disposed');
    const objectUrl=urlApi.createObjectURL(blob);memory.set(key,objectUrl);
    evictIdle();
    return objectUrl;
  };
  const validImage=(blob,bytes)=>blob&&['image/png','image/webp'].includes(blob.type)&&Number.isSafeInteger(bytes)&&bytes>0&&blob.size===bytes&&bytes<=MAX_ART_BYTES;
  const digest=async blob=>sha256Hex(await blob.arrayBuffer(),crypto);
  const serverRevision=(response,url)=>{
    const sha256=response.headers?.get('X-Card-Art-SHA256');
    const bytes=response.headers?.get('X-Card-Art-Bytes');
    const revision=response.headers?.get('X-Card-Art-Revision');
    if(!sha256&&!bytes&&!revision)return null;
    // Only the same HTTPS origin can announce a replacement; the actual
    // downloaded pixels still have to match both its hash and byte count.
    const origin=new URL(url).origin;
    if(!url.startsWith('https://')||(response.url&&new URL(response.url).origin!==origin)
      ||!/^[a-f0-9]{64}$/.test(sha256||'')||revision!==sha256||!/^\d+$/.test(bytes||''))throw new Error('Invalid image revision metadata');
    return {sha256,bytes:Number(bytes)};
  };
  async function load(url,art,policy){
    let saved=null;
    try{saved=await storage.get(url);}catch{/* Storage failure never blocks the picture or game. */}
    const original=saved?.sha256===art.sha256&&validImage(saved?.blob,art.bytes);
    const replacement=saved?.requestedSha256===art.sha256&&/^[a-f0-9]{64}$/.test(saved?.sha256||'')&&validImage(saved?.blob,saved?.bytes);
    if((original||replacement)&&await digest(saved.blob)===saved.sha256)return remember(url,saved.blob);
    return schedule(async()=>{
      // A scroll can leave hundreds of unseen originals behind the three active
      // transfers. Drop only managed requests whose last visible IMG has left.
      // Once a transfer starts, it is allowed to finish and populate the cache.
      if(policy.managed&&!pins.has(url))throw Object.assign(new Error('Artwork is outside the viewport'),{code:CARD_ART_NOT_VISIBLE});
      const controller=new AbortController();let timer;
      const expiry=new Promise((resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Image request timeout'));},requestTimeoutMs);});
      try{
        // IndexedDB owns the disk budget. Avoid a second, unbounded HTTP-cache
        // copy of every original beside the size-limited artwork cache.
        const response=await Promise.race([fetchImpl(url,{signal:controller.signal,credentials:'omit',cache:'no-store'}),expiry]);
        if(!response.ok)throw new Error('Card image unavailable');
        const expected=serverRevision(response,url)||art;
        const blob=await Promise.race([response.blob(),expiry]);
        if(!validImage(blob,expected.bytes))throw new Error('Invalid card image');
        const hash=await digest(blob);
        if(hash!==expected.sha256)throw new Error('Card image revision mismatch');
        const result=remember(url,blob);
        void storage.put({url,cardId:art.cardId,requestedSha256:art.sha256,sha256:hash,bytes:blob.size,blob}).catch(()=>{});
        return result;
      }finally{clearTimeout(timer);}
    });
  }
  return {
    // Retain before requesting, so simultaneous cache hits cannot invalidate a
    // live IMG before its promise settles. The limit applies to idle URLs only.
    retain(url){
      pins.set(url,(pins.get(url)||0)+1);let released=false;
      return ()=>{if(released)return;released=true;const count=(pins.get(url)||0)-1;if(count>0)pins.set(url,count);else pins.delete(url);evictIdle();};
    },
    get(url,art){
      if(disposed)return Promise.reject(new Error('Image cache disposed'));
      if(memory.has(url)){const value=memory.get(url);memory.delete(url);memory.set(url,value);return Promise.resolve(value);}
      if(pending.has(url)){
        const existing=pending.get(url);
        if(!pins.has(url))existing.policy.managed=false;
        return existing.promise;
      }
      if((failed.get(url)||0)>now())return Promise.reject(new Error('Image retry scheduled'));
      const policy={managed:pins.has(url)};
      const request=load(url,art,policy).catch(error=>{if(error?.code!==CARD_ART_NOT_VISIBLE)failed.set(url,now()+30000);throw error;}).finally(()=>pending.delete(url));
      pending.set(url,{promise:request,policy});return request;
    },
    retry(){failed.clear();},
    dispose(){disposed=true;for(const value of memory.values())urlApi.revokeObjectURL(value);memory.clear();pins.clear();},
  };
}
