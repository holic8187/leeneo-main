// Disposable localhost-only fixture for manual CUA QA. No production requests.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultState } from '../src/core/gameState.js';
import { createPendingPackOpening } from '../src/core/packOpeningSession.js';
import { cardById, RAID_DEFINITION } from '../src/data/cardCatalog.js';
const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const account = { id: 'local-manual-qa', username: 'local_qa', nickname: '로컬 미리보기' };
const state = createDefaultState(); state.profile.displayName = account.nickname;
for (const id of ['winter-ur', 'hoi-ur', 'morae-ssr', 'coca-ssr']) state.collection[id] = 1;
state.selectedRaidSquad = ['winter-ur', 'hoi-ur', 'morae-ssr', 'coca-ssr'];
state.pendingPackOpening = createPendingPackOpening({ cards: ['winter-c', 'hoi-ssr', 'winter-ur', 'hoi-ssr', 'winter-r'].map(cardById), id: 'manual-pack', packCount: 1 });
const fixture = `<script>
(() => {
  const account = ${JSON.stringify(account)};
  const initial = ${JSON.stringify(state)};
  let mode = localStorage.getItem('manual-qa-mode') || 'down';
  let revision = 1;
  let serverState = JSON.parse(localStorage.getItem('manual-qa-server') || 'null') || initial;
  const seed = () => {
    localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({token:'local-only-fixture',account}));
    if (!localStorage.getItem('hoi-card-desk-state-v2:'+account.id)) {
      localStorage.setItem('hoi-card-desk-state-v2:'+account.id, JSON.stringify(initial));
      localStorage.setItem('hoi-card-desk-navigation-v1:'+account.id, JSON.stringify({view:'collection',rarityFilter:'ur',modal:{type:'card',cardId:'winter-ur'}}));
    }
  };
  seed();
  const snapshot = () => ({leaseId:'local-lease',generation:1,revision,state:serverState,initialized:true,expiresAt:Date.now()+60000});
  const raid = () => ({id:${JSON.stringify(RAID_DEFINITION.id)},stage:1,maxStage:10,hp:100000,maxHp:100000,entriesToday:0,remainingEntries:5,activeSession:null,earnedRewards:{coins:0,packs:0,bonuses:[]}});
  window.fetch = async (url, options={}) => {
    const path = new URL(String(url), location.href).pathname;
    let status = mode === 'down' ? 503 : mode === 'expired' ? 401 : 200;
    let payload = {code: status === 503 ? 'DATABASE_UNAVAILABLE' : 'AUTH_EXPIRED', message:'로컬 연결 시험 중입니다.'};
    if (status === 200) {
      if (path.endsWith('/auth/me')) payload={account};
      else if(path.endsWith('/play-session/open')) payload=snapshot();
      else if(path.endsWith('/game-state')) {serverState=JSON.parse(options.body).state;localStorage.setItem('manual-qa-server',JSON.stringify(serverState));payload={revision:++revision};}
      else if(path.includes('/play-session/')) payload={revision,expiresAt:Date.now()+60000};
      else if(path.includes('/personal/')) payload={state:raid(),ranking:{entries:[]}};
      else if(path.endsWith('/cooperative/state')) payload={cooperative:{phase:'idle',serverNow:Date.now(),entriesRemaining:2}};
      else if(path.endsWith('/mail')) payload={mailbox:[]};
      else {status=503;payload={code:'LOCAL_QA_UNSUPPORTED',message:'미리보기에서 지원하지 않는 요청입니다.'};}
    }
    return new Response(JSON.stringify(payload), {status,headers:{'Content-Type':'application/json'}});
  };
  document.addEventListener('DOMContentLoaded', () => {
    const controls = document.createElement('aside'); controls.id='manual-qa-controls';
    controls.style.cssText='position:fixed;right:8px;top:8px;z-index:9000;background:#fff;border:1px solid #777;border-radius:8px;padding:6px;display:flex;gap:4px;font:12px sans-serif;max-width:96vw;flex-wrap:wrap';
    controls.innerHTML='<strong>로컬 QA</strong><button data-mode="ok">연결 복구</button><button data-mode="down">연결 끊기</button><button data-mode="expired">로그인 만료</button><button data-reload>앱 다시 열기</button><button data-reset>처음부터</button>';
    controls.addEventListener('click', event => {
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-reload')){location.reload();return;}
      if(button.hasAttribute('data-reset')){localStorage.clear();location.reload();return;}
      mode=button.dataset.mode;localStorage.setItem('manual-qa-mode',mode);
      window.dispatchEvent(new Event(mode==='ok'?'online':'offline'));
    });
    document.body.append(controls);
  });
})();
</script>`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let content = await readFile(path);
    if (path.endsWith('index.html')) content = Buffer.from(content.toString().replace('<head>', '<head>' + fixture));
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "connect-src 'self'; object-src 'none'" });
    response.end(content);
  } catch { response.writeHead(404).end('Local fixture resource not found.'); }
});
server.listen(1430, '127.0.0.1', () => console.log('Manual reconnect QA: http://127.0.0.1:1430 (mock only; no production traffic)'));
