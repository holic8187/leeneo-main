import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ALL_CARDS, CARD_CATALOG, RARITY_ORDER } from '../src/data/cardCatalog.js';
import { skillDescriptionAtEnhancement } from '../src/data/cardSkills.js';
import { FOUR_CHARACTER_SKILLS } from '../src/data/fourCharacterSkills.js';
import { roleForCard } from '../src/core/cardProgression.js';
import { chooseRaidAutoAction } from '../src/core/raidAutoBattle.js';
import { effectPresentation } from '../src/core/raidBattleView.js';
import { createRaidBattle,startRaidBattle,performPlayerAction,performBossAction } from '../src/core/turnRaidEngine.js';

const member=(id,attack=1000,enhancement=0)=>({id,attack,enhancement});
function battle(first='winter-ur',boss={},enhancement=0){return startRaidBattle(createRaidBattle({cards:[member(first,1000,enhancement),member('winter-c',2000),member('hoi-ssr',3000),member('simsim-c',500)],boss:{maxHp:1_000_000,baseDamage:10,...boss},seed:123}),0);}
function atCard(state,index){state.currentActor='card';state.currentActorIndex=index;state.sequenceIndex=index;return state;}
function atBoss(state){state.currentActor='boss';state.currentActorIndex=null;return state;}
const effects=state=>JSON.stringify({cards:state.cards.map(({hp,shield,statuses})=>({hp,shield,statuses})),boss:state.boss,team:state.teamStatuses});

test('four expanded characters each have every rarity and authoritative server powers and roles match',()=>{
  const powers=JSON.parse(readFileSync(new URL('../../src/tcg/data/cardCombatPower.json',import.meta.url),'utf8'));
  const roles=JSON.parse(readFileSync(new URL('../../src/tcg/data/cardRoles.json',import.meta.url),'utf8'));
  assert.equal(FOUR_CHARACTER_SKILLS.length,29);
  for(const character of ['gyullak','eungga','pie','wollu']){
    assert.deepEqual(CARD_CATALOG.filter(card=>card.characterId===character).map(card=>card.rarity).sort((a,b)=>RARITY_ORDER.indexOf(a)-RARITY_ORDER.indexOf(b)),RARITY_ORDER);
  }
  for(const card of CARD_CATALOG){assert.equal(powers[card.id],card.combatPower,card.id);assert.equal(roles[card.id],roleForCard(card.id).id,card.id);}
  assert.deepEqual(['gyullak','eungga','pie','wollu'].map(id=>roleForCard(`${id}-ssr`).id),['attack','support','support','defense']);
});

test('all29 new skills create real effects and SSR Hoi copies them after the original caster is defeated',()=>{
  for(const skill of FOUR_CHARACTER_SKILLS){
    let state=battle(skill.id,{shield:10000});
    state.cards.forEach(card=>{card.hp=50;card.cooldown=2;card.statuses.push({id:'attack-down',kind:'debuff',value:10,duration:2});});
    state.cards[0].cooldown=0;
    const before=effects(state);
    state=performPlayerAction(state,{type:'skill'},1);
    assert.notEqual(effects(state),before,`${skill.id} immediate effect`);
    state.cards[0].hp=0;state.cards[0].defeated=true;
    state.cards[2].cooldown=0;
    const beforeCopy=effects(state);
    state=performPlayerAction(atCard(state,2),{type:'skill'},2);
    assert.notEqual(effects(state),beforeCopy,`${skill.id} copied effect`);
    assert.equal(state.cards[0].hp,0,`${skill.id} never resurrects source`);
  }
});

test('Winter UR consumes exactly one tower per area or multi-hit boss action and counters once',()=>{
  for(const [targets,hits] of [['all',1],['all',2],['random',3]]){
    let state=performPlayerAction(battle('winter-ur',{skills:[{id:'wave',target:targets,damage:10,hits}]}),{type:'skill'},1);
    state=performBossAction(state,2);
    assert.equal(state.teamStatuses.find(status=>status.id==='ice-spire').charges,2);
    assert.equal(state.log.filter(entry=>entry.type==='spire-counter').length,1);
    assert.equal(state.totalDamage,700);
    assert.equal(state.boss.breakGauge,10);
    const hitCards=state.cards.filter(card=>card.hp<100);
    assert.equal(hitCards.length,targets==='all'?4:1);
    assert.ok(hitCards.every(card=>card.hp===100-7*hits));
  }
});

test('Winter towers do not consume on a self buff or a skipped action; remaining towers heal on expiry',()=>{
  let state=performPlayerAction(battle('winter-ur',{skills:[{id:'guard',target:'self',selfShield:10,cooldown:1}]}),{type:'skill'},1);
  state.cards.forEach(card=>{card.hp=50;});
  state=performBossAction(state,2);
  assert.equal(state.teamStatuses.find(status=>status.id==='ice-spire').charges,3);
  state.boss.stunned=true;
  state=performBossAction(atBoss(state),3);
  assert.equal(state.teamStatuses.find(status=>status.id==='ice-spire').charges,3);
  state.boss.stunned=false;
  for(let round=0;round<3;round++){
    state.sequenceIndex=3;state.boss.cooldowns.guard=0;
    state=performBossAction(atBoss(state),4+round);
  }
  assert.equal(state.teamStatuses.some(status=>status.id==='ice-spire'),false);
  assert.ok(state.cards.every(card=>card.hp===74));
});

test('cooperative patterns share the same once-per-action tower rule and mark preparation does not consume',()=>{
  for(const pattern of ['linked-pulse','shield-siphon','cross-current','echo-strike']){
    let state=performPlayerAction(battle('winter-ur',{skills:[{id:'coop',cooperativePattern:pattern,totalDamage:40,damage:10,targetCount:2}]}),{type:'skill'},1);
    state=performBossAction(state,2);
    assert.equal(state.teamStatuses.find(status=>status.id==='ice-spire').charges,2,pattern);
    assert.equal(state.log.filter(entry=>entry.type==='spire-counter').length,1,pattern);
  }
  let marked=performPlayerAction(battle('winter-ur',{skills:[{id:'mark',cooperativePattern:'resonance-mark',markDamage:20}]}),{type:'skill'},1);
  marked=performBossAction(marked,2);
  assert.equal(marked.teamStatuses.find(status=>status.id==='ice-spire').charges,3);
  marked=performPlayerAction(atCard(marked,1),{type:'basic'},3);
  marked=performBossAction(marked,4);
  assert.equal(marked.teamStatuses.find(status=>status.id==='ice-spire').charges,2);
  assert.equal(marked.cards[2].hp,86);
});

test('copied enhanced towers stack multiplicatively, consume once each and keep caster snapshots after KO',()=>{
  let state=performPlayerAction(battle('winter-ur',{skills:[{id:'wave',target:'all',damage:40}]},5),{type:'skill'},1);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  state.cards[2].hp=0;
  state=performBossAction(atBoss(state),3);
  assert.equal(state.cards[1].hp,85); // 40 × .58 × .643 = 14.9176.
  assert.equal(state.cards[3].hp,85);
  assert.equal(state.totalDamage,3479); // 1000*.98 + 3000*.833, no double enhancement.
  assert.equal(state.teamStatuses.filter(status=>status.id==='ice-spire'&&status.charges===2).length,2);
  assert.equal(state.boss.breakGauge,26);
});

test('Hoi UR records exactly the next three actions and obeys stored tie preference after its caster is KO',()=>{
  let state=battle('hoi-ur');state.cards.forEach(card=>{card.hp=50;card.cooldown=3;});state.cards[0].cooldown=0;
  state=performPlayerAction(state,{type:'skill',galaxyChoice:'support'},1);
  assert.deepEqual(state.teamStatuses.find(status=>status.id==='new-galaxy').records,[]);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'basic'},2);
  state.cards[1].cooldown=0;
  state=performPlayerAction(atCard(state,1),{type:'skill'},3);
  state.cards[3].cooldown=0;
  state=performPlayerAction(atCard(state,3),{type:'skill'},4);
  assert.equal(state.teamStatuses.some(status=>status.id==='new-galaxy'),false);
  assert.equal(state.log.filter(entry=>entry.type==='galaxy-record').length,3);
  assert.equal(state.log.find(entry=>entry.type==='galaxy-resolve').outcome,'support');
  assert.equal(state.cards[1].cooldown,1);
  assert.ok(state.boss.statuses.some(status=>status.id==='attack-down'&&status.value===25));
  assert.equal(state.cards[0].hp,0);
});

test('galaxy classifies oracle choices and actual copied skills instead of their wrapper roles',()=>{
  let state=startRaidBattle(createRaidBattle({cards:[member('hoi-ur'),member('guma-hr'),member('hoi-ssr'),member('nanche-c')],boss:{maxHp:1_000_000}}),0);
  state=performPlayerAction(state,{type:'skill',galaxyChoice:'heal'},1);
  state=performPlayerAction(atCard(state,1),{type:'skill',choice:'fortune'},2);
  state=performPlayerAction(atCard(state,2),{type:'skill',choice:'misfortune'},3);
  state=performPlayerAction(atCard(state,3),{type:'basic'},4);
  assert.deepEqual(state.log.filter(entry=>entry.type==='galaxy-record').map(entry=>entry.role),['heal','attack','attack']);
  assert.equal(state.log.find(entry=>entry.type==='galaxy-resolve').outcome,'attack');
});

test('copied enhanced Hoi UR resolves at85percent even if the original and copier both fall',()=>{
  let state=performPlayerAction(battle('hoi-ur',{},5),{type:'skill'},1);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'skill',galaxyChoice:'attack'},2);
  const copied=state.teamStatuses.find(status=>status.id==='new-galaxy'&&status.sourceId===state.cards[2].id);
  assert.ok(copied);state.teamStatuses=[copied];state.cards[2].hp=0;
  const before=state.totalDamage;
  for(let index=0;index<3;index++)state=performPlayerAction(atCard(state,1),{type:'basic'},3+index);
  assert.equal(state.totalDamage-before,17424); // 3*2000 + 3000*4.48*.85.
  assert.equal(state.log.find(entry=>entry.type==='galaxy-resolve').sourceId,state.cards[2].id);
});

test('Gyullak deliveries do not recursively consume follow-ups and copy from Hoi attack at85percent after KO',()=>{
  let state=performPlayerAction(battle('gyullak-ssr'),{type:'skill'},1);
  state.cards[0].hp=0;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  const copied=state.teamStatuses.find(status=>status.id==='golden-delivery'&&status.sourceId===state.cards[2].id);
  assert.equal(copied.value,51);assert.equal(copied.erode,68);
  state.teamStatuses=[copied];state.cards[2].hp=0;state.boss.shield=10000;
  const beforeHp=state.boss.hp;
  state=performPlayerAction(atCard(state,1),{type:'basic'},3);
  assert.equal(state.boss.shield,4430); // 2000 direct +2040 erode +1530 delivery.
  assert.equal(state.boss.hp,beforeHp);
  assert.equal(state.teamStatuses[0].charges,2);
  assert.equal(state.log.filter(entry=>entry.type==='delivery').length,2); // Original triggered by Hoi copy attack, plus this hit.
});

test('royal reprieve heals and cleanses at the HP threshold once without reviving fallen cards',()=>{
  let state=performPlayerAction(battle('eungga-ssr',{skills:[{id:'wave',target:'all',damage:20,statusEffects:[{id:'seal',duration:2}]}]}),{type:'skill'},1);
  state.cards[1].hp=45;state.cards[2].hp=10;
  state=performBossAction(state,2);
  assert.equal(state.cards[1].hp,50);
  assert.equal(state.cards[1].statuses.some(status=>status.id==='seal'||status.id==='royal-reprieve'),false);
  assert.equal(state.cards[2].hp,0);
});

test('a lethal original delivery leaves later copied deliveries unconsumed and emits no phantom delivery',()=>{
  let state=performPlayerAction(battle('gyullak-ssr'),{type:'skill'},1);
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  state.cards[1].attack=100;state.boss.hp=200;
  const beforeLog=state.log.length;
  state=performPlayerAction(atCard(state,1),{type:'basic'},3);
  assert.equal(state.result,'victory');
  assert.equal(state.teamStatuses.find(status=>status.id==='golden-delivery'&&status.sourceId===state.cards[2].id).charges,3);
  assert.equal(state.log.slice(beforeLog).filter(entry=>entry.type==='delivery').length,1);
  assert.deepEqual(state.log.slice(beforeLog).filter(entry=>entry.type==='damage').map(entry=>entry.amount),[100,100]);
});

test('copied towers that already protected the same hit consume once but never counter an already defeated boss',()=>{
  let state=performPlayerAction(battle('winter-ur',{skills:[{id:'wave',target:'all',damage:10}]}),{type:'skill'},1);
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  state.boss.hp=100;
  const beforeLog=state.log.length;
  state=performBossAction(state,3);
  assert.equal(state.result,'victory');
  assert.equal(state.teamStatuses.filter(status=>status.id==='ice-spire'&&status.charges===2).length,2);
  assert.equal(state.log.slice(beforeLog).filter(entry=>entry.type==='spire-counter').length,1);
  assert.equal(state.log.slice(beforeLog).filter(entry=>entry.type==='counter').length,1);
  assert.equal(Object.hasOwn(state,'bossActionEffects'),false);
});

test('Pie SSR converts only actual overhealing and copied enhancement scales once',()=>{
  let state=battle('pie-ssr',{},5);state.cards[0].hp=20;state.cards[1].hp=80;
  state=performPlayerAction(state,{type:'skill'},1);
  assert.equal(state.cards[0].hp,62);assert.equal(state.cards[0].shield,0);
  assert.equal(state.cards[1].hp,100);assert.equal(state.cards[1].shield,22);
  state.cards[0].hp=0;state.cards[2].shield=0;
  state=performPlayerAction(atCard(state,2),{type:'skill'},2);
  assert.equal(state.cards[2].shield,36);
});

test('Wollu SSR limits every target for each of two boss actions, copies weaken caps, enhancement improves them',()=>{
  let state=performPlayerAction(battle('wollu-ssr',{skills:[{id:'wave',target:'all',damage:40,hits:3}]}),{type:'skill'},1);
  state.cards.forEach(card=>{card.shield=0;});
  for(let i=0;i<2;i++){state.boss.cooldowns.wave=0;state=performBossAction(atBoss(state),2+i);}
  assert.ok(state.cards.every(card=>card.hp===64));
  assert.equal(state.teamStatuses.some(status=>status.id==='rest-contract'),false);
  let copy=performPlayerAction(battle('wollu-ssr'),{type:'skill'},1);
  copy=performPlayerAction(atCard(copy,2),{type:'skill'},2);
  assert.ok(Math.abs(copy.teamStatuses.find(status=>status.id==='rest-contract'&&status.sourceId===copy.cards[2].id).value-18/.85)<1e-8);
  assert.match(skillDescriptionAtEnhancement('wollu-ssr',5),/12.9%/);
});

test('auto chooses usable skills, lowest-HP targets, safe fallback and meaningful oracle and galaxy decisions',()=>{
  let state=battle('pie-u');state.cards[1].hp=20;
  assert.deepEqual(chooseRaidAutoAction(state),{type:'skill',targetId:state.cards[1].id,galaxyChoice:'heal'});
  state.cards[0].cooldown=1;assert.equal(chooseRaidAutoAction(state).type,'basic');
  state.cards[0].cooldown=0;state.cards[0].statuses=[{id:'seal',duration:1}];assert.equal(chooseRaidAutoAction(state).type,'basic');
  state.cards[0].statuses=[{id:'seal',duration:0}];assert.equal(chooseRaidAutoAction(state).type,'skill');
  state=battle('hoi-ur');state.cards[0].skillUses=1;assert.equal(chooseRaidAutoAction(state).type,'basic');
  state=atCard(state,2);assert.equal(chooseRaidAutoAction(state).type,'basic'); // No copyable skill.
  state.lastCopyableSkill={cardId:'guma-hr',choice:'fortune',enhancement:0};assert.equal(chooseRaidAutoAction(state).choice,'misfortune');
  state.cards[1].hp=20;assert.equal(chooseRaidAutoAction(state).choice,'fortune');
  state.cards[1].hp=100;state.cards[1].cooldown=4;assert.equal(chooseRaidAutoAction(state).choice,'reversal');
  state.cards[2].hp=0;assert.deepEqual(chooseRaidAutoAction(state),{type:'basic'});
  assert.equal(chooseRaidAutoAction(atBoss(state)),null);
});

test('auto respects exhausted UR skills and active seals through actual engine execution and skips lethal DOT without a boss turn',()=>{
  let state=battle('winter-ur');state.cards[0].skillUses=1;
  state=performPlayerAction(state,chooseRaidAutoAction(state),1);
  assert.equal(state.cards[0].skillUses,1);
  assert.equal(state.teamStatuses.length,0);
  state=atCard(state,2);state.lastCopyableSkill={cardId:'winter-ur',enhancement:0};state.cards[2].statuses=[{id:'seal',kind:'debuff',duration:1}];
  state=performPlayerAction(state,chooseRaidAutoAction(state),2);
  assert.equal(state.cards[2].skillUses,0);
  state=atCard(state,2);state.cards[2].statuses[0].duration=0;
  state=performPlayerAction(state,chooseRaidAutoAction(state),3);
  assert.equal(state.cards[2].skillUses,1);
  assert.equal(state.teamStatuses.find(status=>status.id==='ice-spire').sourceId,state.cards[2].id);
  state=atCard(state,1);state.cards[1].hp=1;state.cards[1].statuses=[{id:'burn',kind:'debuff',duration:1,dotDamage:10}];
  state=performPlayerAction(state,chooseRaidAutoAction(state),4);
  assert.equal(state.cards[1].hp,0);
  assert.equal(state.currentActor,'card');assert.equal(state.currentActorIndex,2);
  assert.equal(state.log.some(entry=>entry.type==='boss-basic'||entry.type==='boss-skill'),false);
});

test('automatic policy completes real seven-round battles without invalid actions, including each of126 skills',()=>{
  for(const card of ALL_CARDS){
    // Distinct IDs required; swap the support slot when this card is Winter C.
    const fillers=['nanche-c','winter-c','hoi-ssr','simsim-c'].filter(id=>id!==card.id).slice(0,3);
    let state=startRaidBattle(createRaidBattle({cards:[member(card.id),...fillers.map(id=>member(id))],boss:{maxHp:10_000_000,baseDamage:1}}),0);
    for(let action=1;state.status==='active'&&action<100;action++){
      state=state.currentActor==='boss'?performBossAction(state,action):performPlayerAction(state,chooseRaidAutoAction(state),action);
    }
    assert.equal(state.status,'finished',card.id);
    assert.equal(state.result,'turn-limit',card.id);
  }
});

test('status presentation explains towers, galaxy progress and all new persistent effects',()=>{
  assert.match(effectPresentation({id:'ice-spire'}).description,/행동당 첨탑 1개/);
  assert.match(effectPresentation({id:'new-galaxy',records:['attack','heal'],preferred:'support'}).description,/기록 2\/3: 공격 · 회복.*지원/);
  for(const id of ['golden-delivery','royal-reprieve','rest-contract'])assert.notEqual(effectPresentation({id}).label,'상태 효과');
});
