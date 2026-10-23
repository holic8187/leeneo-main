import { skillTargeting } from '../data/skillTargeting.js';

const living = card => card.hp > 0;
const active = status => (status.duration == null || status.duration > 0) && (status.charges == null || status.charges > 0);
const value = (entity, id) => (entity?.statuses || []).filter(s => s.id === id && active(s)).reduce((n,s) => n + Number(s.value || 0), 0);
const copy = value => structuredClone(value);

/** Adapt enemy card teams to the established skill engine without inventing
 * a second implementation of healing, copy, counters or conditional skills. */
export function createPvpSkillBridge(api) {
  const primary = state => {
    const ctx = state.pvpContext;
    if (ctx.forcedPrimaryId) return ctx.enemies.find(card => card.id === ctx.forcedPrimaryId) || ctx.enemies[0];
    if (ctx.actionActor) return targets(state, ctx.actionActor, { basic: ctx.actionType === 'basic', consume: false })[0]
      || ctx.enemies.find(living) || ctx.enemies[0];
    return ctx.enemies.find(card => card.id === ctx.targetId && living(card)) || ctx.enemies.find(living) || ctx.enemies[0];
  };

  function attach(state) {
    if (!state?.pvpContext) return state;
    const boss = { skills: [], cooldowns: {}, skillUses: {}, stage: 1, breakMax: 100, stunned: false, breakGauge: 0 };
    // Getters are restored after every structuredClone. Mutable shield/status
    // operations in older skills therefore affect the real selected opponent.
    for (const key of ['id','name','shield','statuses']) Object.defineProperty(boss,key, {
      configurable: true, enumerable: true,
      get: () => primary(state)?.[key] ?? (key === 'statuses' ? [] : key === 'shield' ? 0 : ''),
      set: next => { const card = primary(state); if (card) card[key] = next; },
    });
    for (const key of ['hp','maxHp']) Object.defineProperty(boss,key, { configurable:true,enumerable:true,
      get: () => state.pvpContext.enemies.reduce((n,c) => n + Math.max(0,Number(c[key]) || 0),0),
    });
    boss.stunned = Boolean(state.pvpContext.enemyStunned);
    boss.breakGauge = Number(state.pvpContext.enemyBreakGauge) || 0;
    state.boss = boss;
    return state;
  }

  function beginAction(state, actor, { basic = false, reaction = false, targetId = null } = {}) {
    if (!state.pvpContext) return;
    state.pvpContext.actionActor = { id: actor.id, cardId: actor.cardId };
    state.pvpContext.actionType = basic ? 'basic' : 'skill';
    state.pvpContext.defaultReaction = reaction;
    state.pvpContext.actionTargetId = targetId;
    state.pvpContext.targetLocks = {};
  }

  function targets(state, actor, { basic = false, reaction = false, consume = true } = {}) {
    const ctx = state.pvpContext;
    reaction ||= Boolean(ctx.defaultReaction || ctx.forcedPrimaryId);
    const key = `${actor.id}:${actor.cardId}:${basic}:${reaction}`;
    ctx.targetLocks ||= {};
    let lock = ctx.targetLocks[key];
    if (!lock) {
      const pool = ctx.enemies.filter(living);
      const count = basic || reaction ? 1 : skillTargeting(actor.cardId).enemyCount;
      const boundTargetId = ctx.forcedPrimaryId || ctx.actionTargetId;
      const requested = pool.find(c => c.id === (boundTargetId || ctx.targetId)) || (!boundTargetId && pool[0]);
      const taunt = !boundTargetId && count === 1 && !reaction && pool.find(c => c.statuses?.some(s => s.id === 'taunt' && active(s)));
      const first = taunt || requested;
      // Target-bound seeds, seals and counters must never jump off a defeated
      // recipient onto an unrelated opponent.
      if (boundTargetId && !first) return [];
      lock = ctx.targetLocks[key] = { ids: [first, ...pool.filter(c => c !== first)].filter(Boolean).slice(0, count).map(card => card.id),
        taunterId: taunt?.id, consumed: false };
    }
    if (consume && lock.taunterId && !lock.consumed) {
      const taunt = ctx.enemies.find(card => card.id === lock.taunterId);
      const effect = taunt?.statuses.find(s => s.id === 'taunt' && active(s));
      if (effect && effect.charges != null) effect.charges -= 1;
      lock.consumed = true;
    }
    return lock.ids.map(id => ctx.enemies.find(card => card.id === id)).filter(Boolean);
  }

  function mirror(state, attacker) {
    const ctx = state.pvpContext;
    const runtime = ctx.enemyRuntime ||= {};
    const other = attach({
      ...runtime, runtime, status:'active', round: runtime.round || 1, cards:ctx.enemies,
      teamStatuses:ctx.enemyTeamStatuses, pendingFollowUps:runtime.pendingFollowUps ||= [],
      currentActor:'boss', playerActionCount:runtime.playerActionCount || 0,
      seed:state.seed, totalDamage:0, log:state.log, lastCopyableSkill:ctx.enemyLastCopyableSkill,
      pvpContext:{ enemies:state.cards, enemyTeamStatuses:state.teamStatuses, enemyRuntime:state.runtime,
        enemyLastCopyableSkill:state.lastCopyableSkill, targetId:attacker.id, forcedPrimaryId:attacker.id, breakDamage:0, selfBreakDamage:0,
        depth:(ctx.depth || 0)+1, defenseEffects:ctx.mirrorDefenseEffects || null },
    });
    other.bossActionEffects = ctx.defenseEffects ||= api.createIncomingEffects(other);
    return other;
  }

  function commitMirror(state, other) {
    const ctx = state.pvpContext;
    ctx.enemies = other.cards; ctx.enemyTeamStatuses = other.teamStatuses;
    ctx.enemyRuntime = { ...other.runtime, pendingFollowUps:other.pendingFollowUps };
    ctx.enemyLastCopyableSkill = other.lastCopyableSkill;
    state.cards = other.pvpContext.enemies; state.teamStatuses = other.pvpContext.enemyTeamStatuses;
    state.seed = other.seed;
    ctx.selfBreakDamage = (ctx.selfBreakDamage || 0) + (other.pvpContext.breakDamage || 0);
    ctx.breakDamage = (ctx.breakDamage || 0) + (other.pvpContext.selfBreakDamage || 0);
  }

  function hit(state, actor, multiplier, hits, scale, options) {
    const ctx = state.pvpContext;
    if (options.counter && ctx.depth >= 2) return 0; // Counters do not counter counters.
    const reaction = Boolean(options.counter || options.secondary || options.followUp);
    const basic = !options.skill && !reaction && ctx.actionType === 'basic';
    const profile = basic ? {damageScale:1} : skillTargeting(actor.cardId);
    let applied = 0;
    const struckIds = [];
    for (const target of targets(state,actor,{basic,reaction:Boolean(options.counter||options.seed||options.seal)})) {
      if (!living(actor) && !reaction) break;
      if (!living(target)) continue;
      let conditional = 1;
      if (options.selfHpAbove && actor.hp/actor.maxHp >= options.selfHpAbove) conditional *= options.bonus || 1;
      if (options.bossHpAbove && target.hp/target.maxHp >= options.bossHpAbove) conditional *= options.bonus || 1;
      if (options.bossDebuffed && target.statuses.some(s => s.kind === 'debuff' && active(s))) conditional *= options.bonus || 1;
      if (options.bossShielded && target.shield > 0) conditional *= options.bonus || 1;
      if (options.bossStunned && ctx.enemyStunned) conditional *= options.bonus || 1;
      if (options.breakAtMost != null && (ctx.enemyBreakGauge || 0) <= options.breakAtMost) conditional *= options.bonus || 1;
      const outgoing = Math.max(0, 1 + (value(actor,'attack-up')+value(actor,'damage-up')-value(actor,'attack-down')-value(actor,'damage-down')
        +(options.skill ? value(actor,'skill-damage-up')+value(actor,'effect-up') : 0))/100);
      const coefficient = options.scaleMagnitude === false ? Math.max(0,Number(multiplier)||0)*scale : api.magnitude(multiplier,actor,scale);
      const incoming = Math.max(0,1+value(target,'damage-taken-up')/100);
      const amount = Math.max(0,Math.round((actor.attack*coefficient/100*hits*conditional*outgoing*incoming+(Number(options.flatBonus)||0))*profile.damageScale));
      const defender = mirror(state,actor);
      struckIds.push(target.id);
      const dealt = api.hurtCard(defender,target,amount,actor.id);
      if (options.counter) api.reactiveCleanse(defender,target);
      else { ctx.hitTargetIds ||= []; if (!ctx.hitTargetIds.includes(target.id)) ctx.hitTargetIds.push(target.id); }
      commitMirror(state,defender);
      applied += dealt;
      api.log(state,options.counter?'counter':'damage',`${actor.name} → ${target.name}: ${dealt} 피해`,{sourceId:actor.id,targetId:target.id,amount:dealt,hits});
    }
    ctx.lastHitTargetIds = struckIds;
    state.totalDamage += applied;
    return applied;
  }

  function debuff(state,actor,effect) {
    const profile = skillTargeting(actor.cardId);
    for (const target of targets(state,actor)) {
      const defender = mirror(state,actor);
      api.applyBossStatusToCard(defender,target,{ ...copy(effect), sourceId:actor.id,
        value:Math.round((Number(effect.value)||0)*profile.debuffScale) });
      commitMirror(state,defender);
    }
  }

  function finishIncoming(state,actor,performed) {
    const defender = mirror(state,actor);
    for (const id of state.pvpContext.hitTargetIds || []) {
      const target = defender.cards.find(card => card.id === id);
      if (target) api.reactiveCleanse(defender,target);
    }
    defender.bossActionEffects.performed = performed || Boolean(defender.bossActionEffects.expansionAttacked);
    api.finishIncomingEffects(defender);
    commitMirror(state,defender);
  }

  function resolve(input,action,now) {
    const snapshot = copy(input);
    const runtime = snapshot.runtime || {};
    let state = attach({ ...runtime, runtime, status:'active', cards:snapshot.cards,
      teamStatuses:snapshot.teamStatuses || [], pendingFollowUps:runtime.pendingFollowUps || [],
      round:Math.max(1,snapshot.round || 1), maxRounds:Number.MAX_SAFE_INTEGER, sequenceIndex:snapshot.actorIndex,
      currentActor:'card',currentActorIndex:snapshot.actorIndex,playerActionCount:snapshot.playerActionCount || 0,
      seed:snapshot.seed || 1,totalDamage:0,log:[],lastCopyableSkill:snapshot.lastCopyableSkill || null,
      pvpContext:{ enemies:snapshot.enemies, enemyTeamStatuses:snapshot.enemyTeamStatuses || [],
        enemyRuntime:snapshot.enemyRuntime || {}, enemyLastCopyableSkill:snapshot.enemyLastCopyableSkill || null,
        targetId:action.targetId,actionType:action.type,depth:0,breakDamage:0,selfBreakDamage:0,
        enemyStunned:Boolean(input.enemyStunned),enemyBreakGauge:Number(input.enemyBreakGauge)||0 },
    });
    if (!state.cards[state.currentActorIndex]) throw new Error('행동할 카드를 찾을 수 없습니다.');
    // A next-action freeze is owed even when a new team round expires its
    // displayed duration before this particular card gets to act.
    const frozenAtEntry = state.cards[state.currentActorIndex].statuses.find(s => ['freeze','stun'].includes(s.id) && active(s));
    // Only this team's full card cycle ticks its own cooldowns and durations.
    const rounds = Math.max(0,state.round-(Number(runtime.lastRound)||1));
    for (let i=0;i<rounds;i+=1) api.tickOwnRound(state);
    runtime.lastRound = state.round;
    // Previously primed counters resolve before the next normal action.
    let budget = 64;
    while(state.pendingFollowUps.length && state.boss.hp>0 && budget-- > 0) {
      state.currentActor='follow-up'; state=api.performFollowUpAction(state,now);
    }
    state.currentActor='card';state.currentActorIndex=snapshot.actorIndex;
    const actor=state.cards[snapshot.actorIndex];
    const frozen=actor.statuses.find(s=>['freeze','stun'].includes(s.id)&&active(s)) || frozenAtEntry;
    let performed = false;
    if(frozen) {
      if(frozen.charges!=null)frozen.charges-=1;else frozen.duration=0;
      actor.statuses = actor.statuses.filter(active);
      api.log(state,'skip',`${actor.name}은(는) 동결되어 행동할 수 없습니다.`,{actorId:actor.id});
      state.playerActionCount+=1;
    } else if(living(actor)&&state.boss.hp>0) {
      const before = state.log.length;
      state=api.performPlayerAction(state,{...action,targetId:action.allyTargetId},now);
      performed = state.log.slice(before).some(event => ['basic','skill'].includes(event.type) && event.actorId === actor.id);
    }
    while(state.pendingFollowUps.length && state.boss.hp>0 && budget-- > 0) {
      state.status='active';state.currentActor='follow-up';state=api.performFollowUpAction(state,now);
    }
    finishIncoming(state,actor,performed);
    if(budget<=0)throw new Error('스킬 연계 횟수 제한을 초과했습니다.');
    const ctx=state.pvpContext;
    return { ...input,cards:state.cards,enemies:ctx.enemies,teamStatuses:state.teamStatuses,enemyTeamStatuses:ctx.enemyTeamStatuses,
      seed:state.seed,playerActionCount:state.playerActionCount,lastCopyableSkill:state.lastCopyableSkill,
      enemyLastCopyableSkill:ctx.enemyLastCopyableSkill,breakDamage:ctx.breakDamage,selfBreakDamage:ctx.selfBreakDamage,
      runtime:{...runtime,lastRound:state.round,round:state.round,playerActionCount:state.playerActionCount,pendingFollowUps:state.pendingFollowUps,lastPlayerAction:state.lastPlayerAction},
      enemyRuntime:ctx.enemyRuntime,log:state.log };
  }
  return {attach,hit,debuff,resolve,targets,beginAction};
}
