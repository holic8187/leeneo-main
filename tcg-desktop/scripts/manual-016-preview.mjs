// Disposable localhost-only 0.16 UI fixture. All API requests are redirected to
// this process; combat uses the production engines. No production writes/network.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createDefaultState } from '../src/core/gameState.js';
import { ALL_CARDS, RAID_DEFINITION, cardById } from '../src/data/cardCatalog.js';
import { cardCombatPowerAtLevel, cardMaxHpAtLevel } from '../src/core/cardProgression.js';
import { enhancedCardPower } from '../src/core/cardManagement.js';
import { skillForCard } from '../src/core/turnRaidEngine.js';
import { createTowerBattle, stepTowerBattle } from '../src/core/towerBattle.js';
import { createTowerOffer, rerollTowerOffer } from '../src/data/towerAugments.js';
import { towerMonthWindow, towerBossForFloor, towerRankingScore, TOWER_MONTHLY_REWARD_TIERS } from '../src/core/towerRules.js';
import { createPvpBattle, performPvpAction, advancePvpTimeouts } from '../src/core/pvpBattleEngine.js';
import { pvpSeasonAt, PVP_RULES, pvpResultFor, pvpRatingDelta } from '../src/core/pvpRules.js';
import { resolveBattleChoice } from '../src/core/battleActionChoices.js';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicRoot = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.env.QA_PORT || 1432);
const sourceMode = process.argv.includes('--source');
let vite;
if (sourceMode) {
  const {createServer: createViteServer} = await import('vite');
  const metadata=JSON.parse(await readFile(resolve(sourceRoot,'package.json'),'utf8'));
  // Deliberately bypass the production config's generated-manifest/build hooks.
  // Use a non-existent HTTPS origin so configured auth/cache code is exercised,
  // while the injected fetch + CSP keep all transport on this local server.
  vite=await createViteServer({configFile:false,root:sourceRoot,mode:'production',appType:'custom',
    define:{'import.meta.env.VITE_TCG_API_BASE':JSON.stringify('https://local-fixture.invalid'),
      __APP_VERSION__:JSON.stringify(metadata.version),__REMOTE_CARD_ART_BASE__:JSON.stringify('https://local-fixture.invalid')},
    server:{middlewareMode:true,hmr:false,watch:{ignored:['**/release/**','**/android/**','**/ios/**']}},
  });
}
const account = {id:'local-manual-016',username:'local_qa_016',nickname:'로컬 대전자'};
const cpu = {id:'local-cpu-016',username:'local_cpu',nickname:'연습 상대'};
const initialDeck = ['winter-ur','hoi-ssr','coca-ssr','simsim-ur'];
const clone = value => structuredClone(value);
const error = (code,message,status=409) => Object.assign(new Error(message),{code,status});
let seed = 16001;
const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function initialState() {
  const state = createDefaultState();state.profile.displayName=account.nickname;
  state.collection=Object.fromEntries(ALL_CARDS.map(card=>[card.id,12]));
  state.discoveredCardIds=ALL_CARDS.map(card=>card.id);
  state.cardEnhancements=Object.fromEntries(ALL_CARDS.map(card=>[card.id,[11,0,0,0,0,1]]));
  state.wallet.coins=100_000_000;state.packs={standard:100,premium:100,srPremium:100,ssrTicket:30};
  state.selectedRaidSquad=[...initialDeck];state.selectedExpeditionSquad=[...initialDeck];
  state.deckPresets=[{id:'preset-1',name:'원화 · 스킬 QA',cardIds:[...initialDeck],equipmentCardId:'',artifactCardId:''},
    {id:'preset-2',name:'브레이크 QA',cardIds:['winter-r','morae-sr','coca-rr','shanghai-r'],equipmentCardId:'',artifactCardId:''},null,null,null];
  return state;
}
let saved=initialState(),revision=1,rating=1000;
let tower, pvp={match:null,room:null,receipts:[],claims:[]};
const resetTower=(floor=1)=>tower={...towerMonthWindow(),revision:0,clearedFloor:Math.max(0,floor-1),bestProgress:0,rankingScore:0,
  augments:[],offer:createTowerOffer(0,random),attempts:0,battleId:'',battle:null};
resetTower();
const snapshot=()=>({leaseId:'local-016-lease',generation:1,revision,state:clone(saved),initialized:true,expiresAt:Date.now()+60000,serverNow:Date.now()});
function cardDescriptors(input,owner=account.id) {
  if(!Array.isArray(input)||input.length!==4)throw error('QA_INVALID_DECK','서로 다른 인물의 카드 4장을 선택하세요.');
  const seen=new Set();
  return input.map((entry,index)=>{
    const card=cardById(entry.cardId),enhancement=Math.max(0,Math.min(5,Number(entry.enhancement)||0));
    if(!card||seen.has(card.characterId)||!saved.collection[card.id])throw error('QA_INVALID_DECK','편성 카드를 다시 확인하세요.');
    seen.add(card.characterId);
    return {cardId:card.id,characterId:card.characterId,name:card.name,image:card.image,rarity:card.rarity,enhancement,
      instanceId:`qa:${owner}:${index}`,attack:cardCombatPowerAtLevel(enhancedCardPower(card,enhancement),card.id,saved.cardProgression),maxHp:cardMaxHpAtLevel(card.id,saved.cardProgression)};
  });
}
function finishTower() {
  const battle=tower.battle;if(battle?.status!=='finished'||battle.tower.recorded)return;
  battle.tower.recorded=true;
  if(battle.result==='victory'){tower.clearedFloor++;tower.bestProgress=0;if(tower.clearedFloor%5===0)tower.offer=createTowerOffer(tower.clearedFloor,random);}
  else tower.bestProgress=Math.max(tower.bestProgress,Math.min(999999,Math.floor((1-battle.boss.hp/battle.boss.maxHp)*1000000)));
  tower.rankingScore=towerRankingScore(tower.clearedFloor,tower.bestProgress);
}
function advanceTower(now=Date.now()) {
  const battle=tower.battle;if(battle?.status!=='active')return;
  const type=['boss','follow-up'].includes(battle.currentActor)&&now>=battle.turnStartedAt+1000?'advance'
    :battle.currentActor==='card'&&now>=battle.turnDeadlineAt?'timeout':'';
  if(type){tower.battle=stepTowerBattle(battle,{type},now);tower.revision++;finishTower();}
}
function publicTower() {
  return {tower:{...clone(tower),...towerMonthWindow(),serverNow:Date.now(),floor:tower.clearedFloor+1,
    phase:tower.battle&&tower.battle.status!=='finished'?'battle':tower.offer?'augment':'ready',
    nextBoss:towerBossForFloor(tower.clearedFloor+1),rewardTiers:TOWER_MONTHLY_REWARD_TIERS}};
}
function towerRequest(command,body) {
  const now=Date.now();
  if(command==='state'){advanceTower(now);return publicTower();}
  if(command==='ranking')return {ranking:{...towerMonthWindow(),entries:tower.rankingScore?[{rank:1,nickname:account.nickname,clearedFloor:tower.clearedFloor,bestProgress:tower.bestProgress,score:tower.rankingScore,own:true}]:[],ownRank:tower.rankingScore?1:null,rewardTiers:TOWER_MONTHLY_REWARD_TIERS}};
  if(body.expectedRevision!==tower.revision)throw error('TOWER_CONFLICT','최신 탑 상태를 확인해 주세요.');
  if(command==='choose'){
    if(!tower.offer?.options.includes(body.augmentId))throw error('TOWER_INVALID_AUGMENT','제시된 증강을 선택하세요.');
    tower.augments.push(body.augmentId);tower.offer=null;
  }else if(command==='reroll')tower.offer=rerollTowerOffer(tower.offer,body.slot,random);
  else if(command==='enter'){
    if(tower.offer||tower.battle&&tower.battle.status!=='finished')throw error('TOWER_NOT_READY','증강 선택 또는 진행 중인 전투를 먼저 완료하세요.');
    const cards=cardDescriptors(body.squad);tower.battle=createTowerBattle({cards,boss:towerBossForFloor(tower.clearedFloor+1),augments:tower.augments,seed:Math.floor(random()*4294967296),now});
    tower.battleId=randomUUID();tower.attempts++;
  }else if(command==='action'){
    if(body.battleId!==tower.battleId||!['start','basic','skill'].includes(body.action?.type))throw error('TOWER_INVALID_ACTION','현재 전투 행동을 확인하세요.');
    if(body.action.type!=='start'&&(tower.battle.currentActor!=='card'||now>=tower.battle.turnDeadlineAt))throw error('TOWER_TURN_EXPIRED','현재 행동 차례가 변경되었습니다.');
    tower.battle=stepTowerBattle(tower.battle,body.action,now);finishTower();
  }else if(command==='abandon'){
    Object.assign(tower.battle,{status:'finished',result:'abandoned',terminationReason:'abandoned',currentActor:null,currentActorIndex:null,turnDeadlineAt:null,finishedAt:now});finishTower();
  }else throw error('QA_UNSUPPORTED','지원하지 않는 탑 요청입니다.',400);
  tower.revision++;return publicTower();
}
function finishPvp() {
  const room=pvp.room;if(room?.battle.status!=='finished'||room.outcome)return;
  const result=pvpResultFor(room.battle,account.id);
  room.outcome={result,coins:PVP_RULES.rewards[result],ratingDelta:pvpRatingDelta(rating,1100,result)};
  rating=Math.max(0,rating+room.outcome.ratingDelta);
}
function advancePvp(now=Date.now()) {
  const room=pvp.room;if(room?.battle.status!=='active')return;
  const before=room.battle.actionCount;
  room.battle=advancePvpTimeouts(room.battle,now);
  let battle=room.battle;
  if(battle.status==='active'&&battle.teams[battle.activeTeam].accountId===cpu.id&&now>=battle.turnStartedAt+1000){
    const team=battle.teams[battle.activeTeam],actor=team.cards[battle.activeCardIndex],skill=skillForCard(actor.cardId,actor.enhancement);
    const canSkill=actor.cooldown<=0&&(!skill.oncePerBattle||!actor.skillUses)&&!actor.statuses.some(s=>s.id==='seal'&&(s.duration==null||s.duration>0)&&(s.charges==null||s.charges>0));
    room.battle=performPvpAction(battle,{type:canSkill?'skill':'basic',choice:resolveBattleChoice(actor.cardId,team.lastCopyableSkill,'release')},now);
  }
  room.revision+=room.battle.actionCount-before;finishPvp();
}
function publicPvp(extra={}) {
  const now=Date.now(),data={phase:'idle',accountId:account.id,serverNow:now,rating,season:{...pvpSeasonAt(now),rewardPolicy:PVP_RULES.seasonRewardPolicy},rewards:PVP_RULES.rewards};
  if(pvp.room){const room=pvp.room,battle=room.battle;data.phase=battle.status==='finished'?'finished':'battle';
    data.room={...clone(room),activeAccountId:battle.status==='active'?battle.teams[battle.activeTeam].accountId:'',turnExpiresAt:battle.turnDeadlineAt};}
  else if(pvp.match){data.phase='ready';data.match=clone(pvp.match);}
  return {pvp:data,...extra};
}
function pvpRequest(command,body) {
  const now=Date.now();advancePvp(now);
  if(command==='queue'){
    if(pvp.room||pvp.match)throw error('PVP_ALREADY_PARTICIPATING','진행 중인 대전을 먼저 완료하세요.');
    const cards=cardDescriptors(body.cards);
    const cpuCards=cardDescriptors(['simsim-ssr','rayeon-ssr','somfist-ur','hoi-ssr'].map(cardId=>({cardId,enhancement:0})),cpu.id);
    pvp.match={id:randomUUID(),expiresAt:now+30000,acceptedAccountIds:[cpu.id],players:[{accountId:account.id,nickname:account.nickname,rating,cards},{accountId:cpu.id,nickname:cpu.nickname,rating:1100,cards:cpuCards}]};
  }else if(command==='accept'){
    if(!pvp.match||pvp.match.id!==body.matchId||pvp.match.expiresAt<=now){pvp.match=null;throw error('PVP_MATCH_EXPIRED','입장 확인 시간이 지났습니다.');}
    const match=pvp.match;
    pvp.room={id:randomUUID(),revision:0,seasonKey:pvpSeasonAt(now).key,participants:match.players.map(({accountId,nickname,rating})=>({accountId,nickname,rating})),battle:createPvpBattle({players:match.players,seed:16016,now}),outcome:null};pvp.match=null;
  }else if(command==='leave'){if(pvp.room)throw error('PVP_BATTLE_ACTIVE','진행 중인 대전을 마쳐 주세요.');pvp.match=null;}
  else if(command==='action'){
    if(pvp.receipts.includes(body.actionId))return publicPvp();
    const room=pvp.room;if(!room||room.id!==body.roomId)throw error('PVP_ROOM_NOT_FOUND','전투를 확인할 수 없습니다.');
    if(room.revision!==body.expectedRevision)throw error('PVP_STALE_TURN','현재 행동 차례가 변경되었습니다.');
    if(room.battle.status!=='active'||room.battle.teams[room.battle.activeTeam].accountId!==account.id)throw error('PVP_NOT_YOUR_TURN','상대의 차례입니다.');
    room.battle=performPvpAction(room.battle,{...body,type:body.action},now);room.revision++;pvp.receipts.push(body.actionId);finishPvp();
  }else if(command==='claim'){
    if(pvp.claims.includes(body.roomId))return publicPvp({snapshot:snapshot(),alreadyClaimed:true});
    if(!pvp.room?.outcome||pvp.room.id!==body.roomId)throw error('PVP_REWARD_NOT_READY','보상을 받을 수 없습니다.');
    if(body.baseRevision!==revision)throw Object.assign(error('SAVE_CONFLICT','저장 기록을 다시 확인해 주세요.'),{details:snapshot()});
    saved.wallet.coins+=pvp.room.outcome.coins;revision++;pvp.claims.push(body.roomId);const outcome=pvp.room.outcome;pvp.room=null;
    return publicPvp({snapshot:snapshot(),outcome,alreadyClaimed:false});
  }else if(command==='rankings')return publicPvp({rankings:[{rank:1,accountId:cpu.id,nickname:cpu.nickname,rating:1100,wins:0,losses:0,draws:0},{rank:2,accountId:account.id,nickname:account.nickname,rating,wins:0,losses:0,draws:0}].sort((a,b)=>b.rating-a.rating).map((row,index)=>({...row,rank:index+1}))});
  else if(command!=='state')throw error('QA_UNSUPPORTED','지원하지 않는 대전 요청입니다.',400);
  if(pvp.match?.expiresAt<=now)pvp.match=null;
  return publicPvp();
}
const raid=()=>({id:RAID_DEFINITION.id,stage:1,maxStage:10,hp:100000,maxHp:100000,entriesToday:0,remainingEntries:5,activeSession:null,earnedRewards:{coins:0,packs:0,bonuses:[]}});
function api(path,body){
  if(path.includes('/tower/'))return towerRequest(path.split('/').at(-1),body);
  if(path.includes('/pvp/'))return pvpRequest(path.split('/').at(-1),body);
  if(path.endsWith('/auth/me'))return {account};
  if(path.endsWith('/auth/login'))return {account,token:'local-only-016'};
  if(path.endsWith('/play-session/open')||path.endsWith('/play-session/takeover'))return snapshot();
  if(path.endsWith('/game-state')){if(body.baseRevision!==revision)throw Object.assign(error('SAVE_CONFLICT','최신 기록을 다시 확인해 주세요.'),{details:snapshot()});saved=clone(body.state);revision++;return snapshot();}
  if(path.includes('/play-session/'))return {revision,expiresAt:Date.now()+60000,serverNow:Date.now()};
  if(path.includes('/personal/'))return {state:raid(),ranking:{entries:[]}};
  if(path.endsWith('/cooperative/state'))return {cooperative:{phase:'idle',serverNow:Date.now(),entriesRemaining:2}};
  if(path.endsWith('/admin/auth/login'))return {token:'local-only-admin',admin:{username:'local-admin'}};
  if(path.endsWith('/admin/users'))return {users:[account]};
  if(path.endsWith('/admin/grants/catalog'))return {packages:[{id:'tester-1',name:'테스터 패키지',rewards:{standardPacks:6,coins:0}}]};
  if(path.endsWith('/admin/mail/send'))return {recipients:1,message:'로컬 시험 발송'};
  if(path.endsWith('/mail'))return {mailbox:[]};
  throw error('LOCAL_QA_UNSUPPORTED','로컬 미리보기에서 지원하지 않는 요청입니다.',503);
}
const fixture = `<script>
(() => {
  const account=${JSON.stringify(account)},initial=${JSON.stringify(initialState())};
  const authKey='hoi-card-desk-auth-v1',stateKey='hoi-card-desk-state-v2:'+account.id,navKey='hoi-card-desk-navigation-v1:'+account.id;
  localStorage.setItem(authKey,JSON.stringify({token:'local-only-016',account}));
  if(!localStorage.getItem(stateKey))localStorage.setItem(stateKey,JSON.stringify(initial));
  const params=new URLSearchParams(location.search),view=params.get('view');
  const nav=JSON.parse(localStorage.getItem(navKey)||'null')||{view:'dashboard'};
  nav.pvp ||= {selected:${JSON.stringify(initialDeck)}};nav.tower ||= {selected:${JSON.stringify(initialDeck)}};
  if(['pvp','tower','collection','management','dashboard'].includes(view))nav.view=view;
  localStorage.setItem(navKey,JSON.stringify(nav));
  let mode=localStorage.getItem('manual-016-mode')||'ok';
  let artOffline=localStorage.getItem('manual-016-art-offline')==='1',artRequests=0;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(url,options={})=>{
    const parsed=new URL(typeof url==='string'?url:url.url,location.href),path=parsed.pathname;
    if(path.startsWith('/api/tcg/art/')){artRequests++;if(artOffline)throw new TypeError('Local artwork offline scenario');return nativeFetch('/fixture'+path+parsed.search,options);}
    if(path.startsWith('/api/')||path==='/health'){
      if(mode!=='ok')return new Response(JSON.stringify({code:mode==='expired'?'AUTH_EXPIRED':'DATABASE_UNAVAILABLE',message:'로컬 연결 시험 중입니다.'}),{status:mode==='expired'?401:503,headers:{'Content-Type':'application/json'}});
      return nativeFetch('/fixture'+path+parsed.search,{...options,headers:{'Content-Type':'application/json'}});
    }
    if(parsed.origin===location.origin)return nativeFetch(url,options);
    return new Response(JSON.stringify({code:'EXTERNAL_NETWORK_BLOCKED',message:'외부 요청은 로컬 QA에서 차단됩니다.'}),{status:503});
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(params.get('qa')==='hide')return;
    const box=document.createElement('aside');box.id='manual-016-controls';
    box.style.cssText='position:fixed;right:8px;top:8px;z-index:9000;background:#fff;color:#111;border:1px solid #777;border-radius:8px;padding:6px;display:flex;gap:4px;font:12px sans-serif;max-width:96vw;flex-wrap:wrap';
    box.innerHTML='<b>0.16 로컬 QA</b><button data-mode="ok">연결 복구</button><button data-mode="down">연결 끊기</button><button data-mode="expired">로그인 만료</button><button data-art-toggle>원화 연결 전환</button><button data-art-check>원화 캐시 확인</button><output data-art-stats></output><button data-reload>재접속</button><button data-tower>탑 16층 시나리오</button><button data-reset>처음부터</button>';
    box.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-reload'))return location.reload();
      if(button.hasAttribute('data-art-toggle')){artOffline=!artOffline;localStorage.setItem('manual-016-art-offline',artOffline?'1':'0');button.textContent=artOffline?'원화 연결 끊김':'원화 연결됨';if(!artOffline)window.dispatchEvent(new Event('online'));return;}
      if(button.hasAttribute('data-art-check')){
        const rows=await new Promise((resolve,reject)=>{const request=indexedDB.open('hoi-card-art-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('metadata')){db.close();resolve([]);return;}const tx=db.transaction('metadata'),all=tx.objectStore('metadata').getAll();all.onsuccess=()=>resolve(all.result);tx.oncomplete=()=>db.close();};});
        box.querySelector('[data-art-stats]').textContent='저장 '+rows.length+'장 · '+(rows.reduce((s,r)=>s+r.bytes,0)/1048576).toFixed(1)+'MB · 요청 '+artRequests+'회 · '+(artOffline?'원화 OFF':'원화 ON');return;
      }
      if(button.hasAttribute('data-reset')){await nativeFetch('/fixture/reset',{method:'POST'});localStorage.clear();return location.reload();}
      if(button.hasAttribute('data-tower')){await nativeFetch('/fixture/tower-scenario',{method:'POST'});const nav=JSON.parse(localStorage.getItem(navKey)||'{}');nav.view='tower';localStorage.setItem(navKey,JSON.stringify(nav));return location.assign('/?view=tower');}
      mode=button.dataset.mode;localStorage.setItem('manual-016-mode',mode);window.dispatchEvent(new Event(mode==='ok'?'online':'offline'));
    });document.body.append(box);
  });
})();
</script>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json'};
function json(response,status,payload){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(payload));}
const server=createServer(async(request,response)=>{
  try{
    const path=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(path==='/fixture/status')return json(response,200,{fixture:'0.16',sourceMode,cards:ALL_CARDS.length,revision,tower:publicTower().tower.phase,pvp:publicPvp().pvp.phase,root});
    if(path==='/fixture/reset'&&request.method==='POST'){saved=initialState();revision=1;rating=1000;resetTower();pvp={match:null,room:null,receipts:[],claims:[]};return json(response,200,{ok:true});}
    if(path==='/fixture/tower-scenario'&&request.method==='POST'){resetTower(16);return json(response,200,{ok:true});}
    if(path.startsWith('/fixture/api/tcg/art/')){
      const filename=path.split('/').at(-1);
      if(!/^[a-z][a-z-]+\.(webp|png)$/.test(filename))return response.writeHead(404).end();
      const folder=filename==='coop-tetra.webp'?'bosses':filename==='luxury-bag.webp'?'relics':'cards';
      const file=resolve(publicRoot,'assets',folder,filename);
      const content=await readFile(file);response.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store'}).end(content);return;
    }
    if(path.startsWith('/fixture/api/')){
      let input='';for await(const part of request){input+=part;if(input.length>3000000)throw error('BODY_TOO_LARGE','요청이 너무 큽니다.',413);}
      try{return json(response,200,api(path.slice('/fixture'.length),input?JSON.parse(input):{}));}
      catch(e){e.code ||= 'QA_ACTION_REJECTED';throw e;}
    }
    if(sourceMode){
      response.setHeader('Content-Security-Policy',"connect-src 'self'; img-src 'self' data: blob:; object-src 'none'");
      if(path==='/'||path==='/index.html'){
        const html=await readFile(resolve(sourceRoot,'index.html'),'utf8');
        const transformed=await vite.transformIndexHtml(request.url,html.replace('<head>','<head>'+fixture));
        response.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'}).end(transformed);return;
      }
      return vite.middlewares(request,response,()=>{response.writeHead(404).end('Local source fixture resource not found.');});
    }
    let file=resolve(root,`.${path==='/'?'/index.html':path}`);
    if(!file.startsWith(root+sep))return response.writeHead(403).end();
    let content;
    try{content=await readFile(file);}catch(e){if(!path.startsWith('/assets/'))throw e;file=resolve(publicRoot,`.${path}`);if(!file.startsWith(publicRoot+sep))throw e;content=await readFile(file);}
    if(file.endsWith('index.html'))content=Buffer.from(content.toString().replace('<head>','<head>'+fixture));
    response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store',
      'Content-Security-Policy':"connect-src 'self'; img-src 'self' data: blob:; object-src 'none'"});response.end(content);
  }catch(e){if(e.code&&e.code!=='ENOENT')return json(response,e.status||409,{code:e.code,message:e.message,...e.details});response.writeHead(404).end('Local 0.16 fixture resource not found.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Manual 0.16 QA: http://127.0.0.1:${port}/ (${sourceMode?'Vite source':'dist'}; mock only; ${ALL_CARDS.length} cards; no production traffic)`));
