import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG, RARITY_ORDER } from '../src/data/cardCatalog.js';
import { createRaidBattle, startRaidBattle, performPlayerAction, performBossAction } from '../src/core/turnRaidEngine.js';
import { roleForCard } from '../src/core/cardProgression.js';

const member=(id,attack=1000,enhancement=0)=>({id,attack,enhancement});
const moraeIds=['morae-rr','morae-rrr','morae-sr','morae-hr','morae-ur','morae-ssr'];
function battle(first='morae-ssr',boss={},enhancement=0){
  return startRaidBattle(createRaidBattle({
    cards:[member(first,1000,enhancement),member(first==='nanche-c'?'hoi-c':'nanche-c',2000),member('hoi-ssr',3000),member('winter-c',500)],
    boss:{maxHp:1_000_000,baseDamage:1,...boss},seed:123,
  }),0);
}
function atCard(state,index){state.currentActor='card';state.currentActorIndex=index;state.sequenceIndex=index;return state;}
function atBoss(state){state.currentActor='boss';state.currentActorIndex=null;return state;}

test('Morae has all nine rarities, appended powers and SSR defense role',()=>{
  assert.deepEqual(CARD_CATALOG.filter(card=>card.characterId==='morae').map(card=>card.rarity),RARITY_ORDER);
  assert.deepEqual(CARD_CATALOG.slice(83,89).map(card=>[card.id,card.combatPower]),[
    ['morae-rr',7804],['morae-rrr',8230],['morae-sr',10856],['morae-hr',11882],['morae-ur',14308],['morae-ssr',17924],
  ]);
  assert.equal(roleForCard('morae-ssr').id,'defense');
});

test('RR shelter reduces damage over time and RRR drill erodes shields with enhancement once',()=>{
  let state=performPlayerAction(battle('morae-rr'),{type:'skill'},1);
  assert.ok(state.cards.every(card=>card.shield===16));
  state.cards[1].statuses.push({id:'burn',kind:'debuff',dotDamage:20,duration:2});
  state=performPlayerAction(atCard(state,1),{type:'basic'},2);
  assert.equal(state.cards[1].hp,87);
  state=performPlayerAction(battle('morae-rrr',{shield:10000},5),{type:'skill'},1);
  assert.equal(state.boss.shield,6220);
  assert.equal(state.boss.breakGauge,42);
  assert.equal(state.boss.hp,1_000_000);
});

test('SR heals and cleanses living allies and applies the boss attack reduction',()=>{
  let state=battle('morae-sr');
  state.cards.forEach(card=>{card.hp=40;card.statuses.push({id:'seal',kind:'debuff',duration:2});});
  state.cards[0].statuses=[];
  state=performPlayerAction(state,{type:'skill'},1);
  assert.ok(state.cards.every(card=>card.hp===60));
  assert.ok(state.cards.every(card=>!card.statuses.some(status=>status.id==='seal')));
  assert.equal(state.boss.statuses.find(status=>status.id==='attack-down').value,15);
});

test('HR reactive cleanse protects the two strongest allies after new boss debuffs apply',()=>{
  let state=battle('morae-hr',{skills:[{id:'seal-all',target:'all',damage:1,statusEffects:[{id:'seal',name:'봉인',duration:2}]}]});
  state=performPlayerAction(state,{type:'skill'},1);
  assert.deepEqual(state.cards.map(card=>card.shield),[0,20,20,0]);
  state=performBossAction(state,2);
  assert.deepEqual(state.cards.map(card=>card.statuses.some(status=>status.id==='seal')),[true,false,false,true]);
  assert.equal(state.cards[1].statuses.find(status=>status.id==='after-hit-cleanse').charges,1);
  state.boss.skills=[];
  state.cards[1].statuses.push({id:'taunt',charges:1,kind:'buff'});
  state=performBossAction(atBoss(state),3);
  assert.equal(state.cards[1].statuses.find(status=>status.id==='after-hit-cleanse').charges,1);
});

test('UR shield-break recovery triggers once and never revives a defeated ally',()=>{
  let state=performPlayerAction(battle('morae-ur',{skills:[{id:'wave',target:'all',damage:40}]}),{type:'skill'},1);
  state.cards[1].hp=5;
  state=performBossAction(state,2);
  assert.equal(state.cards[0].hp,100);
  assert.equal(state.cards[1].hp,0);
  assert.equal(state.cards[1].defeated,true);
  assert.equal(state.cards[0].statuses.some(status=>status.id==='dune-recovery'),false);
  state.cards[0].shield=1;
  state.boss.cooldowns.wave=0;
  state=performBossAction(atBoss(state),3);
  assert.equal(state.cards[0].hp,61);
});

test('SSR citadel reduces exactly three party hits and counters from stored mitigation and shield absorption',()=>{
  let state=performPlayerAction(battle('morae-ssr',{skills:[{id:'wave',target:'all',damage:40}]}),{type:'skill'},1);
  state=performBossAction(state,2);
  assert.deepEqual(state.cards.map(card=>card.hp).sort((a,b)=>a-b),[84,94,94,94]);
  assert.equal(state.totalDamage,1302);
  assert.equal(state.boss.breakGauge,15);
  assert.equal(state.teamStatuses.some(status=>status.id==='sand-citadel'),false);
});

test('simultaneous copied citadels multiply mitigation and do not double count shield absorption',()=>{
  let state=performPlayerAction(battle('morae-ssr',{baseDamage:40}),{type:'skill'},1);
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  state.cards[0].shield=100;
  state.cards[0].statuses.push({id:'taunt',kind:'buff',charges:1});
  state=performBossAction(state,3);
  assert.equal(state.cards[0].shield,76); // 40 × .75 × .7875 rounds to 24.
  const saved=state.teamStatuses.filter(status=>status.id==='sand-citadel').reduce((sum,status)=>sum+status.storedDamage,0);
  assert.ok(Math.abs(saved-40.375)<0.00001); // Mitigation16.375 + one shield absorption24.
});

test('a lethal citadel counter stops the remainder of a cooperative area attack',()=>{
  let state=performPlayerAction(battle('morae-ssr',{maxHp:1000,skills:[{id:'pulse',cooperativePattern:'linked-pulse',totalDamage:160}]}),{type:'skill'},1);
  state.teamStatuses[0].charges=1;
  state=performBossAction(state,2);
  assert.equal(state.result,'victory');
  assert.deepEqual(state.cards.map(card=>card.hp),[94,100,100,100]);
});

test('every new Morae skill can be copied at 85 percent after its original caster is defeated',()=>{
  for(const cardId of moraeIds){
    let state=battle(cardId,{shield:10000});
    state.cards.forEach(card=>{card.hp=50;});
    state=performPlayerAction(state,{type:'skill'},1);
    state.cards[0].hp=0;state.cards[0].defeated=true;
    const before=JSON.stringify({cards:state.cards,boss:state.boss,team:state.teamStatuses});
    state=performPlayerAction(atCard(state,2),{type:'skill'},2);
    assert.notEqual(JSON.stringify({cards:state.cards,boss:state.boss,team:state.teamStatuses}),before,cardId);
    if(cardId==='morae-ssr'){
      const copied=state.teamStatuses.find(status=>status.id==='sand-citadel'&&status.sourceId===state.cards[2].id);
      assert.equal(copied.value,21.25);
      assert.equal(copied.counter,102);
      assert.equal(copied.sourceAttack,3000);
    }
  }
});

test('Hoi retains its own share of copied party shields and party healing',()=>{
  let state=performPlayerAction(battle('morae-rr'),{type:'skill'},1);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  assert.equal(state.cards[2].shield,30);
  state=performPlayerAction(battle('morae-sr'),{type:'skill'},1);
  state.cards[0].hp=0;state.cards[2].hp=50;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  assert.equal(state.cards[2].hp,67);
});

test('copied SSR citadel resolves after both original and copier are defeated and scales only once',()=>{
  let state=performPlayerAction(battle('morae-ssr',{},5),{type:'skill'},1);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  const copied=state.teamStatuses.find(status=>status.id==='sand-citadel'&&status.sourceId===state.cards[2].id);
  assert.ok(Math.abs(copied.counter-142.8)<0.00001);
  state.teamStatuses=[copied];
  state.cards[2].hp=0;
  state.cards.forEach(card=>{card.shield=0;});
  state.boss.skills=[{id:'tiny-wave',target:'all',damage:1,cooldown:1,statusEffects:[]}];
  state=performBossAction(atBoss(state),3);
  state.boss.cooldowns['tiny-wave']=0;
  state=performBossAction(atBoss(state),4);
  assert.equal(state.log.filter(entry=>entry.type==='citadel-counter').length,1);
  assert.equal(state.log.find(entry=>entry.type==='citadel-counter').sourceId,state.cards[2].id);
  assert.equal(state.totalDamage,4285);
});

const patternBattle=(cooperativePattern,fields={})=>battle('nanche-c',{skills:[{id:'test-pattern',name:'테스트 패턴',cooperativePattern,cooldown:3,...fields}]});

test('linked pulse shares fixed damage across living players and increases risk as allies fall',()=>{
  let state=performBossAction(atBoss(patternBattle('linked-pulse',{totalDamage:60})),1);
  assert.deepEqual(state.cards.map(card=>card.hp),[85,85,85,85]);
  state=patternBattle('linked-pulse',{totalDamage:60});state.cards[3].hp=0;
  state=performBossAction(atBoss(state),1);
  assert.deepEqual(state.cards.map(card=>card.hp),[80,80,80,0]);
});

test('resonance is telegraphed before the next boss action and real break cancels it',()=>{
  let state=performBossAction(atBoss(patternBattle('resonance-mark',{markDamage:40})),1);
  assert.ok(state.cards.every(card=>card.hp===100));
  assert.equal(state.boss.pendingResonance.targetId,state.cards[2].id);
  state=performPlayerAction(atCard(state,0),{type:'basic'},2);
  state=performBossAction(state,3);
  assert.equal(state.cards[2].hp,60);
  assert.equal(state.boss.pendingResonance,undefined);
  state=performBossAction(atBoss(patternBattle('resonance-mark',{markDamage:40})),1);
  state.boss.breakGauge=90;
  state=performPlayerAction(atCard(state,0),{type:'skill'},2);
  assert.equal(state.boss.pendingResonance,undefined);
  assert.ok(state.cards.every(card=>!card.statuses.some(status=>status.id==='resonance-target')));
  state=performBossAction(state,3);
  assert.equal(state.cards[2].hp,100);
});

test('resonance does not retarget when the telegraphed card has been defeated',()=>{
  let state=performBossAction(atBoss(patternBattle('resonance-mark',{markDamage:40})),1);
  state.cards[2].hp=0;
  state=performBossAction(atBoss(state),2);
  assert.deepEqual(state.cards.map(card=>card.hp),[100,100,0,100]);
});

test('prism armor requires distinct primary attackers, not repeats, and a break also cancels it',()=>{
  let state=performBossAction(atBoss(patternBattle('prism-shift',{value:40,requiredAttackers:3})),1);
  state=performPlayerAction(atCard(state,0),{type:'basic'},2);
  assert.equal(state.totalDamage,600);
  state=performPlayerAction(atCard(state,0),{type:'basic'},3);
  assert.equal(state.boss.statuses.find(status=>status.id==='prism-carapace').attackers.length,1);
  state=performPlayerAction(atCard(state,1),{type:'basic'},4);
  state=performPlayerAction(atCard(state,2),{type:'basic'},5);
  assert.equal(state.boss.statuses.some(status=>status.id==='prism-carapace'),false);
  const before=state.totalDamage;
  state=performPlayerAction(atCard(state,3),{type:'basic'},6);
  assert.equal(state.totalDamage-before,500);
  state=performBossAction(atBoss(patternBattle('prism-shift')),1);
  state.boss.breakGauge=90;
  state=performPlayerAction(atCard(state,0),{type:'skill'},2);
  assert.equal(state.boss.statuses.some(status=>status.id==='prism-carapace'),false);
});

test('echo strike responds to the preceding action and shield siphon uses real owned shields',()=>{
  for(const [type,damage] of [['basic',18],['skill',30]]){
    let state=patternBattle('echo-strike',{damage:18,skillBonusDamage:12});
    state=performPlayerAction(state,{type},1);
    state=performBossAction(state,2);
    assert.equal(400-state.cards.reduce((sum,card)=>sum+card.hp,0),damage);
  }
  let state=patternBattle('shield-siphon',{damage:18,drainPercent:30});
  state.cards.forEach(card=>{card.shield=20;});
  state=performBossAction(atBoss(state),1);
  assert.equal(state.boss.shield,2400);
  assert.ok(state.cards.every(card=>card.hp===96&&card.shield===0));
});

test('cross current hits distinct allies and healing reduction affects received healing',()=>{
  let state=performBossAction(atBoss(patternBattle('cross-current',{damage:20,targetCount:2,debuffPercent:20,duration:2})),1);
  const affected=state.cards.filter(card=>card.hp===80);
  assert.equal(affected.length,2);
  assert.ok(affected.some(card=>card.statuses.some(status=>status.id==='damage-down')));
  const suppressed=affected.find(card=>card.statuses.some(status=>status.id==='healing-down'));
  state=performPlayerAction(atCard(state,3),{type:'skill',targetId:suppressed.id},2);
  assert.equal(state.cards.find(card=>card.id===suppressed.id).hp,90);
});

test('cooperative battle patterns remain deterministic across JSON save and restore',()=>{
  let state=patternBattle('cross-current',{damage:20,targetCount:2});
  state=performPlayerAction(state,{type:'basic'},1);
  assert.deepEqual(performBossAction(state,2),performBossAction(JSON.parse(JSON.stringify(state)),2));
});
