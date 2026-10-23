import { REMAINING_SKILL_RULES } from '../data/remainingRosterSkills.js';

export function createRemainingRosterMechanics(api) {
  const {alive,magnitude,log,addStatus,activeStatuses,statusIsActive,heal,shield,addCardStatus,addBossStatus,cleanse,
    reduceCooldown,damageBoss,applyBreak,targetsFor,queueFollowUp}=api;
  const living=state=>state.cards.filter(alive);
  const sourceOf=(state,effect)=>effect.sourceSnapshot||state.cards.find(c=>c.id===effect.sourceId);
  const snapshot=actor=>({id:actor.id,cardId:actor.cardId,name:actor.name,attack:actor.attack,enhancement:actor.enhancement,skillScale:actor.skillScale??1,maxHp:actor.maxHp,hp:actor.hp,statuses:structuredClone(actor.statuses)});
  const team=(state,id)=>state.teamStatuses.filter(s=>s.id===id&&statusIsActive(s));
  const pending=(state,actor,id,name,values)=>addStatus({statuses:state.teamStatuses},{id,name,kind:'buff',sourceId:actor.id,
    sourceSnapshot:snapshot(actor),startsAfterPlayerAction:state.playerActionCount+1,...values});
  const bank=(actor,id,name,cap)=>{
    let entry=actor.statuses.find(s=>s.id===id);
    const icon=({'pause-fragments':'pause','moon-observation':'moon','sun-seeds':'sun','sword-droplets':'droplets',
      'future-report':'file-clock','ink-edit':'pen-tool','season-leaves':'leaf'})[id]||'package-open';
    if(!entry){entry={id,name,kind:'buff',sourceId:actor.id,stacks:0,cap,icon,description:`${name}: 저장 ${0}/${cap}. 준비 행동으로 모으고 방출 선택으로 소비합니다.`};actor.statuses.push(entry);}
    return entry;
  };
  const updateBank=(entry,next)=>{entry.stacks=Math.max(0,Math.min(entry.cap,next));entry.description=`${entry.name}: 저장 ${entry.stacks}/${entry.cap}. 방출 선택으로 전부 소비합니다.`;};

  function cast(state,actor,targetId,scale,choice) {
    const rule=REMAINING_SKILL_RULES[actor.cardId];if(!rule)return false;
    const all=living(state),ally=targetsFor(state,actor,'ally',targetId),low=targetsFor(state,actor,'lowest');
    for(const effect of rule.effects){
      // A combined heal/shield skill keeps its original lowest-HP recipient,
      // even when healing changes which card would now be the lowest.
      const targets=effect.target==='lowest'?low:targetsFor(state,actor,effect.target||'all',targetId);
      if(effect.type==='hit')damageBoss(state,actor,effect.power,effect.hits,effect.br,scale,{skill:true});
      if(effect.type==='heal')heal(state,targets,effect.power,actor,scale);
      if(effect.type==='shield')shield(state,targets,effect.power,actor,scale);
      if(effect.type==='buff')addCardStatus(targets,actor,effect.id,effect.name,effect.power,effect.duration,'buff',effect.charges);
      if(effect.type==='debuff')addBossStatus(state,actor,effect.id,effect.name,effect.power,effect.duration);
      if(effect.type==='cleanse')cleanse(targets,effect.count);
      if(effect.type==='cooldown')reduceCooldown(targets,effect.count);
    }
    switch(rule.mechanic){
      case 'dream-comeback':if(actor.hp/actor.maxHp<=.5)heal(state,[actor],25,actor,scale);break;
      case 'pause-bank':{
        const entry=bank(actor,'pause-fragments','정지 조각',3);
        if(choice==='release'&&entry.stacks){shield(state,all,entry.stacks*magnitude(9,actor,scale),actor,1,{scaleMagnitude:false});addBossStatus(state,actor,'freeze','일시정지',0,null,1);updateBank(entry,0);}
        else {shield(state,[actor],8,actor,scale);updateBank(entry,entry.stacks+1);}break;
      }
      case 'checkpoint':
        heal(state,all,20,actor,scale);
        for(const target of all)addStatus(target,{id:'ghost-checkpoint',name:'엔딩 체크포인트',kind:'buff',sourceId:actor.id,
          duration:3,charges:1,recordedHp:target.hp,value:magnitude(60,actor,scale),icon:'rotate-ccw',description:'치명적인 직접 공격을 한 번 막고 기록 HP의 일부로 살아남습니다.'});
        break;
      case 'moon-phase':{
        const entry=bank(actor,'moon-observation','달의 관측',1);
        if(!entry.stacks){damageBoss(state,actor,130,1,20,scale,{skill:true});updateBank(entry,1);entry.name='다음 관측 · 보름';}
        else {damageBoss(state,actor,200,1,0,scale,{skill:true});addBossStatus(state,actor,'damage-taken-up','보름의 약점',15,1);updateBank(entry,0);entry.name='다음 관측 · 초승';}
        entry.description=entry.stacks
          ? `다음 스킬은 보름 관측: 공격력 ${magnitude(200,actor,scale)}% 피해를 주고 적이 받는 피해를 1턴간 ${magnitude(15,actor,scale)}% 높입니다.`
          : `다음 스킬은 초승 관측: 공격력 ${magnitude(130,actor,scale)}% 피해와 브레이크 피해 ${magnitude(20,actor,scale)}를 줍니다.`;
        break;
      }
      case 'dawn-calendar':shield(state,all,28,actor,scale);pending(state,actor,'dawn-calendar','새벽 봉인 역법',{charges:3,value:magnitude(12,actor,scale),break:magnitude(35,actor,scale),icon:'clock',description:'적 직접 공격 뒤 가장 약한 아군을 보호합니다. 세 번째에 동결과 브레이크가 발동합니다.'});break;
      case 'sun-seeds':{
        const entry=bank(actor,'sun-seeds','햇살 씨앗',4);
        if(choice==='release'&&entry.stacks){heal(state,all,entry.stacks*magnitude(8,actor,scale),actor,1,{scaleMagnitude:false});if(entry.stacks>=3)reduceCooldown(all,1);updateBank(entry,0);}
        else{heal(state,low,6,actor,scale);updateBank(entry,entry.stacks+1);}break;
      }
      case 'sun-orchard':damageBoss(state,actor,180,1,0,scale,{skill:true});pending(state,actor,'sun-orchard','태양 열매',{charges:3,value:magnitude(95,actor,scale),heal:magnitude(8,actor,scale),icon:'sparkles',description:'아군 기본 공격 뒤 열매 한 개로 추가 공격하고 가장 약한 아군을 회복합니다.'});break;
      case 'safe-coordinates':{
        const mark=actor.statuses.find(s=>s.id==='safe-coordinates');const changed=mark?.targetId&&mark.targetId!==ally[0].id;
        shield(state,ally,changed?24:14,actor,scale);if(changed)cleanse(ally,1);
        addStatus(actor,{id:'safe-coordinates',name:'직전 안전 좌표',kind:'buff',sourceId:actor.id,targetId:ally[0].id,icon:'map-pin',description:`직전 대상: ${ally[0].name}. 다른 아군을 선택하면 보호막과 정화가 강화됩니다.`});break;
      }
      case 'explorer-passport':shield(state,all,20,actor,scale);pending(state,actor,'explorer-passport','빈칸 탐험 지도',{charges:3,contributors:[],value:magnitude(220,actor,scale),heal:magnitude(25,actor,scale),icon:'map',description:'서로 다른 아군 3명이 스킬을 쓰면 추가 공격·전체 회복·쿨다운 감소가 발동합니다.'});break;
      case 'sword-droplets':{
        const entry=bank(actor,'sword-droplets','검의 물방울',3);
        if(choice==='release'&&entry.stacks){damageBoss(state,actor,magnitude(100,actor,scale)+entry.stacks*magnitude(95,actor,scale),1,entry.stacks*magnitude(12,actor,scale),1,{skill:true,scaleMagnitude:false});updateBank(entry,0);}
        else{shield(state,[actor],6,actor,scale);updateBank(entry,entry.stacks+1);}break;
      }
      case 'returning-tide':{
        const old=team(state,'returning-tide').find(s=>s.sourceId===actor.id);
        if(old?.storedDamage>0){const amount=Math.floor(old.storedDamage/Math.max(1,all.length));for(const target of all)target.shield+=amount;log(state,'shield','저장한 해류가 아군 보호막으로 돌아왔습니다.',{sourceId:actor.id,amount});}
        shield(state,all,24,actor,scale);pending(state,actor,'returning-tide','돌아오는 해류',{collectUntilRound:state.round+3,storedDamage:0,value:magnitude(45,actor,scale),cap:actor.maxHp*magnitude(120,actor,scale)/100,icon:'refresh-cw',description:`3턴간 직접 공격을 보호막으로 막은 피해의 ${magnitude(45,actor,scale)}%를 저장합니다(최대 ${actor.maxHp*magnitude(120,actor,scale)/100}). 저장량은 다음 스킬 사용까지 유지되고 생존 아군에게 균등 분배됩니다.`});break;
      }
      case 'future-report':{
        const entry=bank(actor,'future-report','미래 보고서',3);const spent=choice==='release'?entry.stacks:0;
        damageBoss(state,actor,(1+spent)*magnitude(90,actor,scale),1,spent*magnitude(12,actor,scale),1,{skill:true,scaleMagnitude:false});updateBank(entry,spent?0:entry.stacks+1);break;
      }
      case 'emergency-approval':shield(state,all,22,actor,scale);for(const target of all)addStatus(target,{id:'emergency-approval',name:'비상 결재',kind:'buff',sourceId:actor.id,duration:3,charges:1,value:magnitude(50,actor,scale),icon:'stamp',description:'한 직접 공격에서 최대 HP 25% 이상 잃고 살아남으면 잃은 HP의 일부를 회복하고 약화를 1개 정화합니다.'});break;
      case 'ink-edit':{
        const entry=bank(actor,'ink-edit','교정 먹물',4);
        if(choice==='release'&&entry.stacks){shield(state,all,entry.stacks*magnitude(8,actor,scale),actor,1,{scaleMagnitude:false});updateBank(entry,0);}
        else{const before=ally[0].statuses.filter(s=>s.kind==='debuff').length;cleanse(ally,1);if(before)updateBank(entry,entry.stacks+1);else heal(state,ally,6,actor,scale);}break;
      }
      case 'first-stroke':{
        const targets=api.enemyTargets?api.enemyTargets(state,actor):[state.boss];
        let extended=0;for(const target of targets)for(const status of target.statuses.filter(s=>s.kind==='debuff'&&s.duration>0&&s.duration<4&&!['freeze','stun','break-stun'].includes(s.id))){status.duration+=1;extended+=1;}
        damageBoss(state,actor,magnitude(260,actor,scale)+Math.min(4,extended)*magnitude(25,actor,scale),1,magnitude(35,actor,scale),1,{skill:true,scaleMagnitude:false});break;
      }
      case 'season-leaves':{
        const entry=bank(actor,'season-leaves','접어 둔 계절 잎',4);
        if(choice==='release'&&entry.stacks){damageBoss(state,actor,entry.stacks*magnitude(90,actor,scale),1,entry.stacks*magnitude(10,actor,scale),1,{skill:true,scaleMagnitude:false});updateBank(entry,0);}
        else{damageBoss(state,actor,75,1,0,scale,{skill:true});updateBank(entry,entry.stacks+1);}break;
      }
      case 'spring-hearts':heal(state,all,22,actor,scale);pending(state,actor,'spring-hearts','봄의 심장',{charges:4,value:magnitude(18,actor,scale),shield:magnitude(12,actor,scale),icon:'heart-pulse',description:'스킬을 사용한 아군의 HP가 최대치보다 낮으면 그 아군을 회복하고 보호막을 부여합니다. 시전 행동과 HP가 가득 찬 아군은 소비하지 않습니다.'});break;
      case 'picnic-crossroads':{
        const selected=choice==='bridge'?'bridge':'rest';const previous=actor.statuses.find(s=>s.id==='picnic-crossroads')?.path;
        const changed=previous&&previous!==selected;
        if(selected==='bridge'){shield(state,ally,14,actor,scale);if(changed)reduceCooldown(ally,1);}
        else{heal(state,ally,14,actor,scale);if(changed)cleanse(ally,1);}
        addStatus(actor,{id:'picnic-crossroads',name:`직전 길 · ${selected==='bridge'?'다리':'쉼터'}`,path:selected,sourceId:actor.id,kind:'buff',icon:'signpost',description:'직전과 다른 길을 고르면 추가 효과가 발동합니다.'});break;
      }
      case 'tomorrow-picnic':damageBoss(state,actor,220,1,0,scale,{skill:true});pending(state,actor,'tomorrow-picnic','내일의 출발 도장',{charges:4,value:magnitude(70,actor,scale),growth:magnitude(35,actor,scale),used:0,icon:'map',description:'기본 공격 뒤 도장을 소비해 추가 공격합니다. 소비할 때마다 다음 위력이 증가합니다.'});break;
      case 'star-transfer':shield(state,all,18,actor,scale);pending(state,actor,'star-transfer','별빛 환승표',{charges:3,value:magnitude(8,actor,scale),icon:'zap',description:'기본 공격을 한 아군의 쿨다운을 줄이고 가장 HP가 낮은 아군을 회복합니다.'});break;
    }
    return true;
  }

  function afterPlayer(state,actor,actionType){
    const eligible=effect=>state.playerActionCount>=effect.startsAfterPlayerAction;
    if(actionType==='basic'){
      for(const effect of team(state,'sun-orchard').filter(eligible)){
        effect.charges-=1;queueFollowUp(state,{type:'remaining-reward',source:sourceOf(state,effect),name:effect.name,multiplier:effect.value,heal:effect.heal,healTarget:'lowest'});
      }
      for(const effect of team(state,'tomorrow-picnic').filter(eligible)){
        effect.charges-=1;queueFollowUp(state,{source:sourceOf(state,effect),name:effect.name,multiplier:effect.value+effect.used*effect.growth});effect.used+=1;
      }
      for(const effect of team(state,'star-transfer').filter(eligible)){
        effect.charges-=1;reduceCooldown([actor],1);heal(state,targetsFor(state,actor,'lowest'),effect.value,sourceOf(state,effect),1,{scaleMagnitude:false});
      }
    }
    if(actionType==='skill'){
      for(const effect of team(state,'explorer-passport').filter(eligible)){
        if(effect.contributors.includes(actor.id))continue;effect.contributors.push(actor.id);effect.charges-=1;
        if(!effect.charges)queueFollowUp(state,{type:'remaining-reward',source:sourceOf(state,effect),name:effect.name,multiplier:effect.value,heal:effect.heal,healTarget:'all',cooldown:1});
      }
      for(const effect of team(state,'spring-hearts').filter(eligible)){
        if(actor.hp>=actor.maxHp||!alive(actor))continue;
        effect.charges-=1;heal(state,[actor],effect.value,sourceOf(state,effect),1,{scaleMagnitude:false});shield(state,[actor],effect.shield,sourceOf(state,effect),1,{scaleMagnitude:false});
      }
    }
    state.teamStatuses=state.teamStatuses.filter(statusIsActive);
  }

  function afterBossHit(state,target,hpDamage,absorbed){
    const checkpoint=activeStatuses(target,'ghost-checkpoint')[0];
    if(target.hp<=0&&checkpoint){checkpoint.charges-=1;target.hp=Math.max(1,Math.min(target.maxHp,Math.round(checkpoint.recordedHp*checkpoint.value/100)));target.defeated=false;log(state,'checkpoint',`${target.name}이(가) 체크포인트에서 버텼습니다.`,{targetId:target.id,amount:target.hp});}
    const approval=activeStatuses(target,'emergency-approval')[0];
    if(approval&&target.hp>0&&hpDamage>=target.maxHp*.25){approval.charges-=1;const restored=Math.min(target.maxHp-target.hp,Math.round(hpDamage*approval.value/100));target.hp+=restored;cleanse([target],1);log(state,'emergency-approval','비상 결재로 피해 일부를 회복했습니다.',{targetId:target.id,amount:restored});}
    for(const tide of team(state,'returning-tide').filter(effect=>state.round<effect.collectUntilRound))tide.storedDamage=Math.min(tide.cap,tide.storedDamage+absorbed*tide.value/100);
  }
  function afterBoss(state){
    if(!state.bossActionEffects?.expansionAttacked)return;
    for(const effect of team(state,'dawn-calendar')){
      const source=sourceOf(state,effect);shield(state,targetsFor(state,source,'lowest'),effect.value,source,1,{scaleMagnitude:false});effect.charges-=1;
      if(!effect.charges){addBossStatus(state,source,'freeze','새벽 봉인',0,null,1);applyBreak(state,{...source,enhancement:0},effect.break,1);}
    }
  }
  function followUp(state,effect){
    if(effect.type!=='remaining-reward')return false;
    damageBoss(state,effect.source,effect.multiplier,1,0,1,{skill:true,secondary:true,followUp:true,scaleMagnitude:false});
    if(effect.heal)heal(state,targetsFor(state,effect.source,effect.healTarget),effect.heal,effect.source,1,{scaleMagnitude:false});
    if(effect.cooldown)reduceCooldown(living(state),effect.cooldown);
    return true;
  }
  return {cast,afterPlayer,afterBossHit,afterBoss,followUp};
}
