import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_SKILLS } from '../src/data/cardSkills.js';
import { resolvePvpCardAction } from '../src/core/turnRaidEngine.js';

const card=(id,side='a',i=0)=>({id:`${side}-${i}`,cardId:id,name:id,attack:1000,maxHp:5000,hp:5000,shield:0,cooldown:0,statuses:[],enhancement:0,skillUses:0,defeated:false});
function input(id){return {cards:[card(id),card('hoi-ssr','a',1),card('morae-c','a',2),card('pie-c','a',3)],
  enemies:['winter-c','coca-c','guma-c','jandi-c'].map((id,i)=>card(id,'b',i)),teamStatuses:[],enemyTeamStatuses:[],actorIndex:0,round:1,seed:37,playerActionCount:0,runtime:{},enemyRuntime:{}};}

test('all card skills can resolve through real PvP card state',()=>{
  for(const skill of CARD_SKILLS){
    const result=resolvePvpCardAction(input(skill.id),{type:'skill',targetId:'b-1'},1000);
    assert.equal(result.cards.length,4,skill.id);
    assert.equal(result.enemies.length,4,skill.id);
    assert.ok(result.enemies.every(c=>Number.isFinite(c.hp)&&c.hp>=0),skill.id);
    assert.ok(result.cards.every(c=>Number.isFinite(c.hp)&&c.hp>=0),skill.id);
    assert.doesNotThrow(()=>JSON.stringify(result),skill.id);
  }
});
test('single target and balanced area profiles affect the selected real enemies',()=>{
  let result=resolvePvpCardAction(input('shanghai-r'),{type:'skill',targetId:'b-2'});
  assert.deepEqual(result.enemies.map(c=>c.hp),[5000,5000,3100,5000]);
  result=resolvePvpCardAction(input('coca-ssr'),{type:'skill',targetId:'b-2'});
  assert.deepEqual(result.enemies.map(c=>c.hp),[4160,4160,4160,4160]);
});
test('copy retains original UR Winter pillars and defensive reactions',()=>{
  let result=resolvePvpCardAction(input('winter-ur'),{type:'skill',targetId:'b-0'});
  result=resolvePvpCardAction({...result,actorIndex:1},{type:'skill',targetId:'b-0'});
  assert.equal(result.teamStatuses.filter(s=>s.id==='ice-spire').length,2);
  const defended=resolvePvpCardAction({cards:result.enemies,enemies:result.cards,teamStatuses:result.enemyTeamStatuses,enemyTeamStatuses:result.teamStatuses,
    actorIndex:0,round:1,seed:37,playerActionCount:0,runtime:result.enemyRuntime,enemyRuntime:result.runtime}, {type:'basic',targetId:'a-0'});
  assert.equal(defended.enemyTeamStatuses.filter(s=>s.id==='ice-spire').length,2);
  assert.deepEqual(defended.enemyTeamStatuses.filter(s=>s.id==='ice-spire').map(s=>s.charges),[2,2]);
  assert.ok(defended.selfBreakDamage>0);
});
test('party defenses and debuff blocking operate on the opponent side',()=>{
  const battle=input('simsim-c');
  battle.enemies[1].statuses.push({id:'debuff-block',kind:'buff',charges:1});
  const result=resolvePvpCardAction(battle,{type:'skill',targetId:'b-1'});
  assert.equal(result.enemies[1].statuses.some(s=>s.id==='attack-down'),false);
  assert.equal(result.enemies[1].statuses.some(s=>s.id==='break-taken-flat'),true);
});
test('own cooldowns tick only on an own full round and survive reconnect',()=>{
  let result=resolvePvpCardAction(input('winter-hr'),{type:'skill'});
  assert.equal(result.cards[0].cooldown,5);
  result=resolvePvpCardAction({...result,actorIndex:1},{type:'basic'});
  assert.equal(result.cards[0].cooldown,5);
  result=resolvePvpCardAction({...JSON.parse(JSON.stringify(result)),actorIndex:0,round:2},{type:'basic'});
  assert.equal(result.cards[0].cooldown,4);
});
