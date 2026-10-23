import test from 'node:test';
import assert from 'node:assert/strict';
import { createPvpBattle, performPvpAction, advancePvpTimeouts } from '../src/core/pvpBattleEngine.js';
import { PVP_RULES, findPvpPair, pvpSeasonAt, pvpRatingDelta } from '../src/core/pvpRules.js';
import { createPvpClient, togglePvpCard } from '../src/core/pvpClient.js';
import { createPvpGateway } from '../src/services/pvpGateway.js';
import { renderPvpView, renderPvpInspector } from '../src/ui/pvpView.js';
import { battleActionChoices, resolveBattleChoice } from '../src/core/battleActionChoices.js';
import { sanitizeNavigationSnapshot } from '../src/core/navigationSnapshot.js';

const ids = ['winter-ur', 'hoi-ssr', 'morae-c', 'pie-c'];
const player = (accountId, rating = 1000, cardIds = ids) => ({ accountId, nickname: accountId, rating,
  cards: cardIds.map(cardId => ({ cardId, attack: 1000, maxHp: 110, enhancement: 0 })) });
const battle = (ratings = [1000, 1000]) => createPvpBattle({ players: ratings.map((rating, index) => player(`p${index}`, rating)), seed: 91, now: 1000 });
const unchanged = input => ({ ...input, log: [] });
const clone = value => JSON.parse(JSON.stringify(value));

test('PvP has four unique people, scales only combat snapshots and lower score goes first', () => {
  const players = [player('a', 1200), player('b', 0)], original = clone(players);
  const result = createPvpBattle({ players, now: 1000 });
  assert.deepEqual(players, original);
  assert.equal(result.activeTeam, 1); assert.equal(result.teams[1].rating, 0);
  assert.equal(result.teams[0].cards[0].maxHp, 5500); assert.equal(result.teams[0].cards[0].attack, 100);
  assert.equal(new Set(result.teams.flatMap(team => team.cards.map(card => card.id))).size, 8);
  assert.throws(() => createPvpBattle({ players: [players[0], players[0]] }));
  assert.throws(() => createPvpBattle({ players: [player('a', 1, ['winter-c','winter-u','hoi-c','pie-c']), player('b')] }));
  assert.throws(() => togglePvpCard(['winter-c'], 'winter-u'), /같은 인물/);
});

test('teams alternate in deck order, skip knocked-out cards and tick each own wrap once', () => {
  let state = battle(); const seen = [];
  state.teams[0].cards[1].hp = 0; state.teams[1].cards[2].hp = 0;
  for (let i = 0; i < 8; i += 1) {
    seen.push([state.activeTeam, state.activeCardIndex, state.teams[state.activeTeam].round]);
    state = performPvpAction(state, { type: 'basic' }, 1100 + i, unchanged);
  }
  assert.deepEqual(seen, [[0,0,1],[1,0,1],[0,2,1],[1,1,1],[0,3,1],[1,3,1],[0,0,2],[1,0,2]]);
  // The last unplayed card is knocked out during an enemy action.
  state = battle(); state.teams[0].cards[1].hp = 0; state.teams[0].cards[2].hp = 0;
  state = performPvpAction(state, { type: 'basic' }, 1100, unchanged);
  state = performPvpAction(state, { type: 'basic' }, 1200, input => ({ ...input, enemies: input.enemies.map((card,i) => i===3 ? {...card,hp:0} : card) }));
  assert.equal(state.activeCardIndex, 0); assert.equal(state.teams[0].round, 2);
});

test('both break directions are authoritative and consume exactly one team turn', () => {
  let state = battle(); state.teams[1].breakGauge = 75;
  state = performPvpAction(state, { type: 'skill' }, 1100, input => {
    assert.equal(input.enemyBreakGauge, 75); return { ...input, breakDamage: 25 };
  });
  assert.equal(state.activeTeam, 0); assert.equal(state.activeCardIndex, 1);
  assert.equal(state.teams[1].breakGauge, 0); assert.equal(state.teams[1].skipTurns, 0);
  state = performPvpAction(state, { type: 'basic' }, 1200, input => ({...input, selfBreakDamage:100}));
  assert.equal(state.activeTeam, 1);
  state = performPvpAction(state, { type: 'basic' }, 1300, unchanged);
  assert.equal(state.activeTeam, 1); assert.equal(state.activeCardIndex, 1);
});

test('deadlines replay deterministic defaults after reconnect and terminate bounded games', () => {
  const initial = battle();
  let captured = [];
  const resolver = (input, action, now) => { captured.push([action.type,action.automatic,now]); return unchanged(input); };
  const state = advancePvpTimeouts(clone(initial), 61_000, resolver);
  assert.deepEqual(captured, [['basic',true,21000],['basic',true,41000],['basic',true,61000]]);
  assert.equal(state.actionCount,3); assert.equal(state.turnDeadlineAt,81000);
  assert.equal(initial.actionCount,0);
  const end = advancePvpTimeouts(state, 100_000_000, unchanged);
  assert.equal(end.status,'finished'); assert.equal(end.actionCount,PVP_RULES.maxActions);
  assert.equal(end.winnerAccountId,''); assert.equal(end.terminationReason,'action-limit');
});

test('real copied pillars, reactive break and shield remain on the correct team across saves', () => {
  let state = battle();
  state = performPvpAction(state,{type:'skill'},1100);
  state = performPvpAction(state,{type:'basic',targetId:state.teams[0].cards[0].id},1200);
  assert.equal(state.teams[0].teamStatuses.find(s=>s.id==='ice-spire').charges,2);
  assert.ok(state.teams[1].breakGauge>0);
  state = performPvpAction(clone(state),{type:'skill'},1300);
  assert.equal(state.teams[0].teamStatuses.filter(s=>s.id==='ice-spire').length,2);
  const continuous=performPvpAction(state,{type:'basic'},1400);
  const restored=performPvpAction(clone(state),{type:'basic'},1400);
  assert.deepEqual(restored,continuous);
  assert.equal(restored.teams[0].teamStatuses.filter(s=>s.id==='ice-spire').length,2);
});

test('matchmaking seeks nearest scores, rejects self match, expands gradually and KST seasons last two weeks', () => {
  const queue = [1000,1300,1100,1020].map((rating,i)=>({accountId:`p${i}`,rating,queuedAt:1000}));
  assert.deepEqual(findPvpPair(queue,1000).map(p=>p.accountId),['p0','p3']);
  assert.equal(findPvpPair([queue[0],{...queue[0]}],1000),null);
  assert.equal(findPvpPair(queue.slice(0,2),1000),null);
  assert.ok(findPvpPair(queue.slice(0,2),91000));
  const boundary=Date.parse('2026-11-02T00:00:00+09:00');
  assert.equal(pvpSeasonAt(boundary-1).key,'pvp-2026-10-19');
  assert.equal(pvpSeasonAt(boundary).key,'pvp-2026-11-02');
  assert.equal(pvpSeasonAt(boundary).endsAt-boundary,14*86400000);
  assert.equal(pvpRatingDelta(1000,1000,'victory'),12);
  assert.equal(pvpRatingDelta(1000,1000,'defeat'),-12);
  assert.equal(PVP_RULES.seasonRewardPolicy.enabled,false);
});

const payload = (phase='idle', serverNow=1000) => ({pvp:{phase,serverNow,rating:1000}});
const deferred = () => { let resolve; const promise=new Promise(done=>resolve=done);return {promise,resolve}; };
test('polling unchanged data does not reset UI and late replies cannot cross an account reset', async () => {
  let identity={accountId:'a',token:'a'}, count=0, response=payload();
  const client=createPvpClient({gateway:{state:async()=>response},getIdentity:()=>identity,onChange:()=>count++,now:()=>1000});
  await client.refresh(); const before=count;
  response=payload('idle',1100);await client.refresh();assert.equal(count,before);
  const wait=deferred();response=wait.promise;const pending=client.refresh();
  identity={accountId:'b',token:'b'};client.reset(); wait.resolve(payload('battle'));await pending;
  assert.equal(client.getState().data,null);
});

test('client commits cloud rewards before rendering and preserves action request identity', async () => {
  const sequence=[], calls=[];
  const client=createPvpClient({getIdentity:()=>({accountId:'a',token:'t'}),now:()=>1000,
    gateway:{state:async()=>({...payload(),pvp:{...payload().pvp,room:{id:'room',revision:7}}}),action:async(token,body)=>{calls.push(body);return payload();},claim:async()=>({...payload(),snapshot:{revision:3}})},onChange:s=>{if(s.data)sequence.push('render');}});
  await client.refresh(); await client.mutate('action',()=>({action:'basic',leaseId:'l'}));
  assert.equal(calls[0].expectedRevision,7);assert.equal(calls[0].roomId,'room');assert.ok(calls[0].actionId.length>=8);
  sequence.length=0;await client.mutate('claim',()=>({}),async p=>{assert.equal(p.snapshot.revision,3);sequence.push('commit');});
  assert.ok(sequence.indexOf('commit')<sequence.lastIndexOf('render'));
});

test('gateway retries transient action transport with the exact receipt but never stale state rejection',async()=>{
  const bodies=[];let count=0;
  const gateway=createPvpGateway({apiBase:'https://example.test/',fetchImpl:async(url,request)=>{bodies.push(request.body);count++;if(count===1)throw new Error('offline');return {ok:true,json:async()=>payload()};}});
  await gateway.action('token',{actionId:'same-action-123',action:'basic'});
  assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
  let rejected=0;const stale=createPvpGateway({apiBase:'https://example.test',fetchImpl:async()=>{rejected++;return {ok:false,status:409,json:async()=>({code:'PVP_STALE_TURN',message:'갱신'})};}});
  await assert.rejects(stale.action('token',{}),{code:'PVP_STALE_TURN'});assert.equal(rejected,1);
});

test('duel view exposes eight HP bars, disabled cooldowns, effects and no character art in secret mode',()=>{
  const b=battle(); b.teams[0].cards[0].cooldown=2; b.teams[0].teamStatuses=[{id:'ice-spire',kind:'buff',charges:3}];
  const data={...payload().pvp,phase:'battle',room:{battle:b,id:'r',revision:0,activeAccountId:'p0',turnExpiresAt:21000}};
  const html=renderPvpView({client:{data},accountId:'p0',now:1000,secret:true});
  assert.equal((html.match(/class="pvp-hp-track"/g)||[]).length,8);
  assert.ok(!html.includes('assets/cards/'));
  assert.match(html,/data-action="pvp-skill" disabled/);
  assert.match(html,/data-action="pvp-inspect-effect"/);
  assert.match(html,/data-pvp-turn-deadline="21000"/);
});

test('copy resolves source skill choices and invalid previous choices fall back to a usable option',()=>{
  assert.deepEqual(battleActionChoices('hoi-ssr',{cardId:'simsim-ur'}).map(choice=>choice.value),['charge','release']);
  assert.equal(resolveBattleChoice('hoi-ssr',{cardId:'guma-hr'},'charge'),'fortune');
  assert.equal(resolveBattleChoice('choonsik-ur',null,'release'),'rest');
  assert.equal(resolveBattleChoice('choonsik-ur',null,'bridge'),'bridge');
  const b=battle(); b.teams[0].cards[0].cardId='hoi-ssr';b.teams[0].lastCopyableSkill={cardId:'mango-ur'};
  const data={...payload().pvp,phase:'battle',room:{battle:b,id:'r',revision:0,activeAccountId:'p0',turnExpiresAt:21000}};
  const html=renderPvpView({client:{data},accountId:'p0',now:1000,choice:'release'});
  assert.match(html,/data-pvp-choice/);assert.match(html,/value="release" selected/);
  const info=renderPvpInspector(data.room,{type:'card',teamIndex:0,cardIndex:0});
  assert.match(info,/HP 5,500/);assert.match(info,/적 대상 효과/);
});

test('PvP navigation preserves only deck and scrolling, never battle or account data',()=>{
  const result=sanitizeNavigationSnapshot({view:'pvp',pvp:{selected:ids,battle:{winner:'forged'},token:'private'},scroll:{'pvp:deck':{top:500,left:0},'view:pvp:main':{top:100,left:0},'untrusted':{top:1}}});
  assert.equal(result.view,'pvp');assert.deepEqual(result.pvp.selected,ids);
  assert.equal(result.pvp.battle,undefined);assert.equal(result.pvp.token,undefined);
  assert.equal(result.scroll['pvp:deck'].top,500);assert.equal(result.scroll.untrusted,undefined);
});
