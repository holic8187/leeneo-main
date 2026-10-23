import { createRaidBattle, startRaidBattle, performPlayerAction, performBossAction, performFollowUpAction } from './turnRaidEngine.js';
import { towerAugmentCounts, TOWER_AUGMENT_BY_ID } from '../data/towerAugments.js';
import { TOWER_MAX_ROUNDS } from './towerRules.js';

const clone = value => structuredClone(value);
const alive = card => card.hp > 0;
const amount = (card, percent) => Math.max(1, Math.round(card.maxHp * percent / 100));
const add = (card, id, value, source, extra = {}) => card.statuses.push({ id, name: TOWER_AUGMENT_BY_ID[source]?.name || source, kind: 'buff', value, duration: null, charges: null, sourceId: `tower:${source}`, ...extra });
const event = (battle, message, data = {}) => battle.log.push({ index: battle.log.length, type: 'tower-augment', message, ...data });

function refreshAuras(battle) {
  const counts = towerAugmentCounts(battle.tower.augments);
  const living = battle.cards.filter(alive).length;
  for (const card of battle.cards) {
    card.statuses = card.statuses.filter(status => !status.towerAura);
    const aura = (id, value, source) => { if (value > 0) add(card, id, value, source, { towerAura: true }); };
    aura('attack-up', 8 * (counts['keen-edge'] || 0), 'keen-edge');
    aura('break-up', 4 * (counts['crack-finder'] || 0), 'crack-finder');
    aura('healing-taken-up', 15 * (counts['warm-care'] || 0), 'warm-care');
    aura('evasion', 8 * (counts['light-step'] || 0), 'light-step');
    aura('damage-up', Math.min(30, 3 * (battle.tower.actions[card.id] || 0)) * (counts.momentum || 0), 'momentum');
    for (let i = 0; i < (counts['layered-guard'] || 0); i += 1) aura('damage-reduction', 10, 'layered-guard');
    aura('skill-damage-up', 20 * (counts['skill-manual'] || 0), 'skill-manual');
    aura('damage-up', card.hp <= card.maxHp / 2 ? 30 * (counts['desperate-edge'] || 0) : 0, 'desperate-edge');
    aura('damage-up', living === 4 ? 18 * (counts['full-company'] || 0) : 0, 'full-company');
    aura('attack-up', 30 * (counts['glass-engine'] || 0), 'glass-engine');
    aura('attack-up', Math.min(72, Math.max(0, battle.round - 1) * 12) * (counts['long-climb'] || 0), 'long-climb');
    aura('attack-up', 50 * (counts['danger-contract'] || 0), 'danger-contract');
    aura('damage-up', battle.round <= 2 ? 45 * (counts['opening-festival'] || 0) : 0, 'opening-festival');
    aura('damage-up', living === 1 ? 100 * (counts['last-light'] || 0) : 0, 'last-light');
  }
}

export function createTowerBattle({ cards, boss, augments = [], seed, now = Date.now() }) {
  const battle = createRaidBattle({ cards, boss, seed, now });
  const counts = towerAugmentCounts(augments);
  battle.maxRounds = TOWER_MAX_ROUNDS;
  battle.tower = { augments: augments.filter(id => TOWER_AUGMENT_BY_ID[id]), actions: {} };
  for (const card of battle.cards) {
    card.maxHp = Math.max(1, Math.round(card.maxHp * (1 + .15 * (counts['sturdy-heart'] || 0)) * .8 ** (counts['glass-engine'] || 0) * .75 ** (counts['crystal-shell'] || 0)));
    card.hp = card.maxHp;
    card.shield += Math.round(card.maxHp * (.12 * (counts['departure-shield'] || 0) + .45 * (counts['crystal-shell'] || 0)));
    if (counts['first-strike']) add(card, 'basic-bonus', 40 * counts['first-strike'], 'first-strike', { charges: 1 });
    if (counts['quick-start']) add(card, 'quick', 0, 'quick-start', { charges: counts['quick-start'] });
  }
  const risk = 1.2 ** (counts['danger-contract'] || 0);
  battle.boss.baseDamage = Math.round(battle.boss.baseDamage * risk);
  for (const skill of battle.boss.skills) if (skill.damage) skill.damage = Math.round(skill.damage * risk);
  refreshAuras(battle);
  return battle;
}

export function stepTowerBattle(input, action = {}, now = Date.now()) {
  let battle = clone(input);
  if (!battle.tower) throw new Error('탑 전투 기록이 없습니다.');
  if (battle.status === 'finished') return battle;
  const counts = towerAugmentCounts(battle.tower.augments);
  const previousRound = battle.round;
  const actorId = battle.currentActor === 'card' ? battle.cards[battle.currentActorIndex]?.id : null;
  const previousActions = battle.playerActionCount;
  refreshAuras(battle);
  if (action.type === 'start') battle = startRaidBattle(battle, now);
  else if (battle.currentActor === 'boss' && action.type === 'advance') battle = performBossAction(battle, now);
  else if (battle.currentActor === 'follow-up' && action.type === 'advance') battle = performFollowUpAction(battle, now);
  else if (battle.currentActor === 'card' && ['basic', 'skill', 'timeout'].includes(action.type)) battle = performPlayerAction(battle, { ...action, type: action.type === 'skill' ? 'skill' : 'basic' }, now);
  else throw new Error('현재 차례에 사용할 수 없는 행동입니다.');

  const actor = battle.cards.find(card => card.id === actorId);
  if (actor && alive(actor) && battle.playerActionCount > previousActions) {
    const used = (battle.tower.actions[actor.id] || 0) + 1;
    battle.tower.actions[actor.id] = used;
    const healing = 3 * (counts['small-breath'] || 0);
    if (healing && actor.hp < actor.maxHp) {
      const restored = Math.min(actor.maxHp - actor.hp, amount(actor, healing));
      actor.hp += restored; event(battle, `${actor.name}의 작은 숨 고르기: HP ${restored} 회복`, { targetId: actor.id, amount: restored });
    }
    if (counts['overflowing-spring']) {
      if (actor.hp >= actor.maxHp) {
        const value = amount(actor, 3 * counts['overflowing-spring']);
        actor.shield += value; event(battle, `${actor.name}의 넘치는 샘물: 보호막 ${value}`, { targetId: actor.id, amount: value });
      } else {
        const value = Math.min(actor.maxHp - actor.hp, amount(actor, 6 * counts['overflowing-spring']));
        actor.hp += value; event(battle, `${actor.name}의 넘치는 샘물: HP ${value} 회복`, { targetId: actor.id, amount: value });
      }
    }
    if (used % 3 === 0) {
      if (counts.clockwork) { actor.cooldown = Math.max(0, actor.cooldown - counts.clockwork); event(battle, `${actor.name}의 세 번째 태엽: 쿨타임 감소`, { targetId: actor.id }); }
      if (counts['purifying-cycle']) {
        let remaining = counts['purifying-cycle'];
        actor.statuses = actor.statuses.filter(status => !(status.kind === 'debuff' && remaining-- > 0));
        const value = amount(actor, 10 * counts['purifying-cycle']);
        actor.shield += value; event(battle, `${actor.name}의 정화의 순환: 약화 해제 · 보호막 ${value}`, { targetId: actor.id, amount: value });
      }
    }
  }
  if (battle.round > previousRound && battle.round > 1 && counts['round-bastion']) {
    for (const card of battle.cards.filter(alive)) card.shield += amount(card, 5 * counts['round-bastion']);
    event(battle, '차곡차곡 성벽: 생존 아군에게 보호막이 쌓입니다.');
  }
  refreshAuras(battle);
  return battle;
}
