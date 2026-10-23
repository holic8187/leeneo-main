import { cardById } from '../data/cardCatalog.js';
import { currentRaidSnapshotImage } from '../core/raidSnapshotImages.js';
import { renderCardEmblems } from '../core/cardEmblems.js';
import { effectPresentation, raidIceSpires } from '../core/raidBattleView.js';
import { skillForCard } from '../core/turnRaidEngine.js';
import { renderSecretRaidCard } from './raidControls.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
const pct = (current,max) => Math.max(0,Math.min(100,Math.round(Number(current)/Math.max(1,Number(max))*100)));
const supportedIcons = new Set(['sparkles','swords','shield','shield-alert','shield-minus','heart-pulse','target','clock','snowflake','flame','ban','orbit','eye-off','refresh-cw','rotate-ccw','map','package-open','zap','circle-alert','pause','sun','droplets','file-clock','pen-tool','leaf','map-pin','stamp','signpost','scroll-text','book-open','copy','moon','arrow-right-left','vault','audio-lines','rewind','flower-2','heart-handshake','crown','library']);

export function renderRaidEffects(effects = [], owner, action = 'inspect-raid-effect') {
  return effects.length ? `<div class="raid-effect-list" aria-label="적용 중인 상태 효과">${effects.map((raw,index) => {
    const item = effectPresentation(raw);
    const icon = supportedIcons.has(item.icon) ? item.icon : 'sparkles';
    return `<button class="raid-effect-icon is-${item.tone}${item.scope === 'team' ? ' is-shared' : ''}" type="button" data-action="${action}" data-effect-owner="${esc(owner)}" data-effect-index="${index}" title="${esc(item.label)}" aria-label="${esc(item.label)} 정보 보기"><i data-lucide="${icon}"></i>${item.scope === 'team' ? '<em aria-hidden="true">파티</em>' : ''}${item.count ? `<b>${num(item.count)}</b>` : ''}</button>`;
  }).join('')}</div>` : '';
}

export function renderRaidBossHud(battle, { cooperative = false, effectAction = 'inspect-raid-effect' } = {}) {
  return `<div class="raid-boss-hud"><div class="raid-boss-title"><span>${cooperative ? 'CO-OP' : `STAGE ${num(battle.stage)}`}</span><strong>${esc(battle.boss.name)}</strong></div>
    <div class="raid-boss-health-label"><span>HP${battle.boss.shield ? ` +${num(battle.boss.shield)}` : ''}</span><strong>${num(battle.boss.hp)} / ${num(battle.boss.maxHp)}</strong></div>
    <div class="raid-boss-health-track" role="progressbar" aria-label="보스 HP" aria-valuemin="0" aria-valuenow="${battle.boss.hp}" aria-valuemax="${battle.boss.maxHp}"><span style="width:${pct(battle.boss.hp,battle.boss.maxHp)}%"></span></div>
    <div class="raid-break-label"><span>BREAK</span><strong>${num(battle.boss.breakGauge)} / 100</strong></div><div class="raid-break-track" role="progressbar" aria-label="보스 브레이크" aria-valuemin="0" aria-valuenow="${battle.boss.breakGauge}" aria-valuemax="100"><span style="width:${battle.boss.breakGauge}%"></span></div>
    <div class="raid-boss-effects">${renderRaidEffects(battle.boss.effects,'boss',effectAction)}</div></div>`;
}

export function renderIceSpires(towers = []) {
  if (!towers.length) return '';
  const groupKey = tower => tower.id.slice(0,tower.id.lastIndexOf(':'));
  const groups = [...new Set(towers.map(groupKey))];
  return `<div class="raid-ice-spires" style="--spire-groups:${groups.length}" aria-label="얼음 기둥 ${towers.filter(tower=>['standing','summoning'].includes(tower.phase)).length}개">${towers.map(tower => `<div class="raid-ice-spire is-${tower.phase}" data-spire-id="${esc(tower.id)}" style="grid-column:${tower.index+1};grid-row:${groups.indexOf(groupKey(tower))+1}">
    <svg viewBox="0 0 80 200" aria-hidden="true"><path class="ice-core" d="M40 2 66 42 72 178 41 198 9 178 15 42Z"/><path class="ice-lit" d="M40 2 40 174 15 42Z"/><path class="ice-face" d="M40 2 66 42 40 174Z"/><path class="ice-base" d="M9 178 40 174 72 178 41 198Z"/><path class="ice-crack" d="m45 45-19 39 25 15-19 35 17 24"/></svg><i class="ice-shard ice-shard-a"></i><i class="ice-shard ice-shard-b"></i><i class="ice-shard ice-shard-c"></i><span class="ice-glow"></span>
  </div>`).join('')}</div>`;
}

export function renderBreakIce(active, label = 'BREAK · 행동 불가') {
  if (!active) return '';
  return `<div class="battle-break-ice" role="status" aria-label="브레이크로 얼어붙은 필드"><svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true"><path class="break-ice-mass" d="M15 56 70 6 146 29 222 4 298 24 369 2 445 26 527 7 585 52 598 218 553 271 469 249 399 279 308 257 231 278 143 256 55 274 4 225Z"/><path class="break-ice-facets" d="m70 6 28 127L15 56m83 77 48-104 69 98 7-123m-7 123 83-103 45 109 26-131m-26 131 102-107 30 106 52-125m-52 125 110-80M4 225l94-92-43 141m43-141 117-6-72 129m72-129 128 6-112 145m112-145 56 146m-56-146 132-1-6 117m6-117 78 139m-455-138 80 74 37-80m128 6 66 57 66-58"/><path class="break-ice-cracks" d="m286 37 18 48-29 36 43 33-30 48 21 44m-34-125-55 12-36-22m134 43 49-12 42 26"/></svg><div class="battle-break-snow" aria-hidden="true">❄ <span>✧</span> ❄</div><strong>${esc(label)}</strong></div>`;
}

export function renderRaidArena({ battle, animation = {}, secret = false, activeIndex = -1, canAct = false, pending = false, cooperative = false, owners = [], countdown = 0, now = Date.now() }) {
  const targets = animation.targets || [];
  const action = cooperative ? {basic:'coop-basic',skill:'coop-skill',inspect:'coop-inspect-card',effect:'coop-inspect-effect'} : {basic:'raid-basic-attack',skill:'raid-skill-attack',inspect:'inspect-raid-card',effect:'inspect-raid-effect'};
  const lastMessage = battle.battleLog?.at(-1)?.message || '행동을 기다리고 있습니다.';
  const targetIndex = targets.find(target=>Number.isInteger(target));
  const targetX = targetIndex == null ? 0 : (targetIndex - (battle.squad.length - 1)/2) * 70;
  return `<div class="raid-battle-arena${cooperative ? ' is-cooperative' : ''}" data-animation-sequence="${esc(animation.revision || animation.recentLogs?.at(-1)?.index || '')}" style="--boss-target-x:${targetX}px">
    ${countdown > 0 ? `<div class="raid-battle-countdown ${countdown - now <= 5000 ? 'is-urgent' : ''}" ${cooperative ? 'data-coop-deadline' : 'data-raid-turn-deadline'}="${countdown}" aria-label="행동 제한 시간">${num(Math.ceil((countdown-now)/1000))}</div>` : ''}
    <div class="raid-boss-zone"><div class="raid-boss-card ${battle.boss.stunned ? 'is-stunned' : ''} ${animation.attacker === 'boss' ? 'is-attacking' : ''} ${targets.includes('boss') ? 'is-raid-hit' : ''}">${secret ? renderSecretRaidCard(battle.boss.name) : `<img src="${esc(currentRaidSnapshotImage(battle.boss) || cardById('deadline-dragon')?.image)}" alt="${esc(battle.boss.name)}" />`}${battle.boss.stunned ? '<span class="raid-stun-orbit" aria-label="브레이크 스턴"></span>' : ''}</div>
      ${renderBreakIce(battle.boss.stunned)}${animation.damageAmount ? `<strong class="raid-floating-number is-damage">${num(animation.damageAmount)}</strong>` : ''}${animation.breakAmount ? `<strong class="raid-floating-number is-break">BREAK ${num(animation.breakAmount)}</strong>` : ''}</div>
    ${renderIceSpires(animation.iceSpires || raidIceSpires(battle))}
    <div class="raid-squad-zone">${battle.squad.map((member,index) => {
      const card = cardById(member.cardId);
      const skill = skillForCard(member.cardId, member.enhancement);
      const onTurn = index === activeIndex && member.hp > 0;
      const sealed = member.statuses?.some(status=>status.id === 'seal' && (status.charges == null || status.charges > 0));
      const used = skill?.oncePerBattle && member.skillUses > 0;
      const skillUnavailable = sealed || member.skillCooldown > 0 || used;
      return `<article class="raid-unit-slot rarity-${card?.rarity || 'c'} ${onTurn ? 'is-active' : ''} ${animation.attacker === index ? 'is-attacking' : ''}" style="--card-charge-x:${((battle.squad.length-1)/2-index)*70}px">
        ${owners[index] ? `<span class="raid-owner-label">${esc(owners[index])}</span>` : ''}
        ${onTurn && canAct ? `<div class="raid-card-actions"><button type="button" data-action="${action.basic}" ${pending ? 'disabled' : ''}>기본공격</button><button type="button" data-action="${action.skill}" ${pending || skillUnavailable ? 'disabled' : ''}>스킬${skillUnavailable ? `<small>${sealed ? '봉인됨' : used ? '사용 완료' : `${num(member.skillCooldown)}턴 남음`}</small>` : ''}</button></div>` : ''}
        <button class="raid-unit-card card-emblem-host ${member.hp <= 0 ? 'is-ko' : ''} ${targets.includes(index) ? 'is-raid-hit' : ''}" type="button" data-action="${action.inspect}" data-card-index="${index}" data-payroll-label="${esc(`${card?.rarity.toUpperCase()} · ${card?.name}`)}"><span class="raid-unit-number">${index+1}</span>${secret ? renderSecretRaidCard(card?.name,card?.rarity) : `<img src="${esc(card?.image || member.image)}" alt="${esc(card?.name)}" />`}${renderCardEmblems(card || member.cardId,member.enhancement,{size:'micro',captioned:true})}<span class="raid-unit-name">${esc(card?.name)} +${num(member.enhancement)}</span></button>
        <div class="raid-unit-effects">${renderRaidEffects(member.effects,String(index),action.effect)}</div><div class="raid-unit-hp"><div class="raid-unit-hp-label"><span>HP${member.shield ? ` +${num(member.shield)}` : ''}</span><strong>${num(member.hp)} / ${num(member.maxHp)}</strong></div><div class="raid-unit-hp-track"><span style="width:${pct(member.hp,member.maxHp)}%"></span></div></div>
      </article>`;
    }).join('')}</div><div class="raid-battle-message" aria-live="polite">${esc(animation.message || lastMessage)}</div>
  </div>${animation.skillCutIn ? `<div class="raid-skill-cut-in ${secret ? 'is-secret' : ''}">${secret ? '' : `<img src="${esc(currentRaidSnapshotImage(animation.skillCutIn))}" alt="" />`}<strong>${esc(animation.skillCutIn.name)}</strong></div>` : ''}`;
}

export function renderCooperativeInspector(battle, inspector) {
  if (!inspector) return '';
  const effects = inspector.owner === 'boss' ? battle.boss.effects : battle.squad[Number(inspector.owner)]?.effects;
  const member = battle.squad[inspector.cardIndex];
  const info = inspector.type === 'effect' ? effectPresentation(effects?.[inspector.index]) : member && skillForCard(member.cardId,member.enhancement);
  if (!info) return '';
  return `<aside class="raid-skill-tooltip" role="dialog" aria-label="전투 정보"><button type="button" data-action="coop-close-inspector" aria-label="닫기"><i data-lucide="x"></i></button><h3>${esc(info.label || info.name)}</h3><p>${esc(info.description)}</p>${info.targeting ? `<p>${esc(info.targeting)}</p>` : ''}${member ? `<p>공격력 <span data-raid-inspector-value="attack">${num(member.attack)}</span> · HP <span data-raid-inspector-value="hp">${num(member.hp)}</span> / <span data-raid-inspector-value="maxHp">${num(member.maxHp)}</span></p>` : ''}</aside>`;
}
