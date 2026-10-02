import { CARD_SKILL_BY_ID } from '../data/cardSkills.js';

const active = (status) => (status.duration == null || status.duration > 0) && (status.charges == null || status.charges > 0);
const ratio = (card) => Number(card.hp) / Math.max(1, Number(card.maxHp) || 100);
const forbiddenCopy = new Set(['hoi-ssr','hoi-rrr']);

/** Pure deterministic policy shared by the local battle and authoritative coop server. */
export function chooseRaidAutoAction(battle) {
  if(battle?.status!=='active'||battle.currentActor!=='card')return null;
  const actor=battle.cards?.[battle.currentActorIndex];
  if(!actor)return null;
  if(!(actor.hp>0))return {type:'basic'};
  const skill=CARD_SKILL_BY_ID[actor.cardId];
  const sealed=(actor.statuses||[]).some(status=>status.id==='seal'&&active(status));
  const copied=actor.cardId==='hoi-ssr'?battle.lastCopyableSkill:null;
  const copyUnavailable=actor.cardId==='hoi-ssr'&&(!copied||!CARD_SKILL_BY_ID[copied.cardId]||forbiddenCopy.has(copied.cardId));
  const available=skill&&!sealed&&!(actor.cooldown>0)&&!(skill.oncePerBattle&&actor.skillUses>0)&&!copyUnavailable;
  const living=battle.cards.filter(card=>card.hp>0);
  const lowest=living.toSorted((a,b)=>ratio(a)-ratio(b))[0];
  const cooldownTotal=living.reduce((sum,card)=>sum+Math.max(0,Number(card.cooldown)||0),0);
  const wounds=living.reduce((sum,card)=>sum+(1-ratio(card)),0)/Math.max(1,living.length);
  const debuffed=living.some(card=>(card.statuses||[]).some(status=>status.kind==='debuff'&&active(status)));
  const galaxyChoice=wounds>=.2||ratio(lowest)<.4?'heal':cooldownTotal>=4?'support':'attack';
  const action={type:available?'skill':'basic',galaxyChoice};
  if(!available)return action;
  const effectiveId=copied?.cardId||actor.cardId;
  let target=lowest;
  if(['hoi-rrr','mond-c'].includes(effectiveId))target=living.filter(card=>card.id!==actor.id).toSorted((a,b)=>b.cooldown-a.cooldown||b.attack-a.attack)[0]||lowest;
  else if(effectiveId==='rayeon-c')target=living.toSorted((a,b)=>b.attack-a.attack)[0];
  else if(effectiveId==='somfist-c')target=living.filter(card=>card.id!==actor.id).toSorted((a,b)=>ratio(a)-ratio(b))[0]||actor;
  action.targetId=target.id;
  if(effectiveId==='guma-hr')action.choice=wounds>=.15||debuffed?'fortune':cooldownTotal>=3?'reversal':'misfortune';
  return action;
}
