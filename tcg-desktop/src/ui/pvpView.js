import { cardById } from '../data/cardCatalog.js';
import { skillForCard } from '../core/turnRaidEngine.js';
import { normalizeRaidBattle } from '../core/raidBattleView.js';
import { renderRaidEffects, renderBreakIce } from './raidArena.js';
import { renderSecretRaidCard } from './raidControls.js';
import { renderCardEmblems } from '../core/cardEmblems.js';
import { PVP_RULES } from '../core/pvpRules.js';
import { pvpSkillDescription, targetingDescription } from '../data/skillTargeting.js';
import { battleActionChoices } from '../core/battleActionChoices.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = value => Math.max(0, Number(value) || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const disabled = value => value ? 'disabled' : '';
const picture = (card, secret) => secret ? renderSecretRaidCard(card?.name || '카드', card?.rarity) : `<img src="${esc(card?.image || '')}" alt="${esc(card?.name || '')}" loading="lazy" />`;

function renderTeam(team, teamIndex, battle, { mine, secret, targetId, allyTargetId, pending, feedback }) {
  const members = normalizeRaidBattle({ cards: team.cards, teamStatuses: team.teamStatuses }).squad;
  const broken = team.skipTurns > 0 || feedback?.recentLogs?.some(entry => entry.type === 'pvp-break' && entry.teamIndex === teamIndex);
  return `<section class="pvp-team ${mine ? 'is-mine' : 'is-enemy'}"><header><strong>${esc(team.nickname)}</strong><span>${num(team.rating)}점</span><span class="pvp-break-label">BREAK ${num(team.breakGauge)} / 100${team.skipTurns ? ' · 다음 차례 스킵' : ''}</span></header><div class="pvp-break-track"><span style="width:${team.breakGauge}%"></span></div><div class="pvp-team-field">${renderBreakIce(broken, 'BREAK · 팀 차례 건너뛰기')}<div class="pvp-team-cards">${members.map((member, index) => {
    const card = cardById(member.cardId), active = battle.activeTeam === teamIndex && battle.activeCardIndex === index;
    const selected = mine ? member.id === allyTargetId : member.id === targetId;
    return `<article class="pvp-unit ${active ? 'is-active' : ''} ${member.hp <= 0 ? 'is-ko' : ''} ${selected ? 'is-selected' : ''} ${feedback?.hitIds?.includes(member.id) ? 'is-hit' : ''}">
      <button class="pvp-card-art card-emblem-host" type="button" data-action="${mine ? 'pvp-ally-target' : 'pvp-target'}" data-target-id="${esc(member.id)}" aria-pressed="${selected}" ${disabled(member.hp <= 0 || pending)}>${picture(card, secret)}${renderCardEmblems(card || member.cardId, member.enhancement, { size: 'micro' })}<span class="pvp-unit-order">${index + 1}</span></button>
      <button class="pvp-card-name" type="button" data-action="pvp-inspect-card" data-card-id="${esc(member.cardId)}" data-team-index="${teamIndex}" data-card-index="${index}">${esc(card?.name || member.name)}</button>
      ${renderRaidEffects(member.effects, `${teamIndex}:${index}`, 'pvp-inspect-effect')}
      <div class="pvp-hp-label"><strong>${num(member.hp)} / ${num(member.maxHp)}</strong>${member.shield ? `<small>보호막 ${num(member.shield)}</small>` : ''}</div><div class="pvp-hp-track"><span style="width:${Math.max(0, member.hp / member.maxHp * 100)}%"></span></div>
      <small>공격력 ${num(member.attack)}</small></article>`;
  }).join('')}</div></div></section>`;
}

export function renderPvpInspector(room, inspector) {
  if (!room?.battle || !inspector) return '';
  const [teamIndex, cardIndex] = inspector.type === 'effect' ? String(inspector.owner || '').split(':').map(Number) : [Number(inspector.teamIndex), Number(inspector.cardIndex)];
  const team = room.battle.teams[teamIndex];
  if (!team) return '';
  const member = normalizeRaidBattle({cards:team.cards,teamStatuses:team.teamStatuses}).squad[cardIndex];
  if (!member) return '';
  const info = inspector.type === 'effect' ? member.effects[inspector.index] : skillForCard(member.cardId,member.enhancement);
  if (!info) return '';
  const description = inspector.type === 'effect' ? info.description : pvpSkillDescription(info.description, member.cardId);
  return `<aside class="raid-skill-tooltip pvp-inspector" role="dialog" aria-label="대전 카드 정보"><button type="button" data-action="pvp-close-inspector" aria-label="닫기"><i data-lucide="x"></i></button><h3>${esc(info.label || info.name)}</h3><p>${esc(description)}</p><p>공격력 ${num(member.attack)} · HP ${num(member.hp)} / ${num(member.maxHp)}</p></aside>`;
}

function actionChoices(actor, options, team) {
  const choices = battleActionChoices(actor.cardId, team.lastCopyableSkill);
  const selected = choices.some(item=>item.value===options.choice) ? options.choice : choices[0]?.value;
  return `<div class="pvp-action-options">${choices.length ? `<label>스킬 방식<select data-pvp-choice ${disabled(options.pending)}>${choices.map(({value,label})=>`<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>` : ''}${['hoi-ur','hoi-ssr'].includes(actor.cardId) ? `<label>은하수 동률 우선<select data-pvp-galaxy-choice ${disabled(options.pending)}>${[['attack','공격'],['heal','회복'],['support','지원']].map(([value,label])=>`<option value="${value}" ${options.galaxyChoice===value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}</div>`;
}

function battleView(data, options) {
  const { room } = data, battle = room.battle;
  const ownIndex = battle.teams.findIndex(team => team.accountId === options.accountId);
  if (ownIndex < 0) return '<p>참가 중인 대전을 확인하고 있습니다.</p>';
  const mine = battle.teams[ownIndex], enemyIndex = 1 - ownIndex;
  const actor = battle.teams[battle.activeTeam]?.cards[battle.activeCardIndex];
  const myTurn = battle.status === 'active' && room.activeAccountId === options.accountId;
  const skill = actor ? skillForCard(actor.cardId, actor.enhancement) : null;
  const sealed = actor?.statuses?.some(status => status.id === 'seal' && (status.duration == null || status.duration > 0) && (status.charges == null || status.charges > 0));
  const skillBlocked = !myTurn || actor?.cooldown > 0 || sealed || skill?.oncePerBattle && actor?.skillUses > 0;
  const expiry = Number(room.turnExpiresAt) - options.now;
  return `<div class="pvp-battle">${renderTeam(battle.teams[enemyIndex], enemyIndex, battle, { ...options, mine: false })}
    <div class="pvp-turn-bar"><strong>${battle.status === 'finished' ? '대전 종료' : myTurn ? '내 차례' : '상대 차례'}</strong>${battle.status === 'active' ? `<b data-pvp-turn-deadline="${room.turnExpiresAt}" class="${expiry <= 5000 ? 'is-urgent' : ''}">${num(Math.ceil(Math.max(0, expiry) / 1000))}</b>` : ''}<span>${esc(actor?.name || '')}</span></div>
    ${renderTeam(mine, ownIndex, battle, { ...options, mine: true })}
    ${myTurn ? actionChoices(actor, options, mine) : ''}
    ${battle.status === 'active' ? `<div class="pvp-action-bar"><button class="secondary-button" type="button" data-action="pvp-basic" ${disabled(!myTurn || options.pending)}>기본공격</button><button class="primary-button" type="button" data-action="pvp-skill" ${disabled(skillBlocked || options.pending)}>${esc(skill?.name || '스킬')}${actor?.cooldown > 0 ? ` · ${num(actor.cooldown)}턴` : sealed ? ' · 봉인' : ''}</button><small>공격할 상대를 선택하세요. 시간이 지나면 기본공격합니다.</small></div>` : `<section class="pvp-result"><h3>${room.outcome?.result === 'victory' ? '승리!' : room.outcome?.result === 'defeat' ? '다음 대전에서 다시 만나요' : '무승부'}</h3><p>${num(room.outcome?.coins)}코인 · 점수 ${Number(room.outcome?.ratingDelta) >= 0 ? '+' : ''}${room.outcome?.ratingDelta || 0}</p><button class="primary-button" type="button" data-action="pvp-claim" ${disabled(options.pending)}>보상 받고 돌아가기</button></section>`}
    ${myTurn && actor ? `<p class="pvp-targeting-guide">${esc(targetingDescription(actor.cardId))} 아군 대상은 내 카드 일러스트를 눌러 지정하세요.</p>` : ''}
    <details class="pvp-log"><summary>전투 기록</summary><ol>${battle.log.slice(-14).map(entry => `<li>${esc(entry.message)}</li>`).join('')}</ol></details></div>`;
}

export function renderPvpView({ client, selected = [], cards = [], accountId = '', now = Date.now(), secret = false, targetId = '', allyTargetId = '', choice = 'charge', galaxyChoice = 'attack', blocked = false, presetMarkup = '' } = {}) {
  const { data, pending, error, feedback } = client || {};
  const intro = `<header class="pvp-header"><div><span class="eyebrow">LIVE ARENA</span><h2>실시간 대전</h2><p>네 카드의 호흡으로 상대의 차례를 끊으세요.</p></div><strong>${num(data?.rating ?? PVP_RULES.startingRating)}<small>시즌 점수</small></strong></header>`;
  const warning = error ? `<p class="pvp-error">${esc(error)} <button type="button" data-action="pvp-refresh">다시 연결</button></p>` : '';
  if (data?.room) return `<section class="pvp-page">${intro}${warning}${battleView(data, { accountId, now, secret, targetId, allyTargetId, choice, galaxyChoice, pending, feedback: feedback && now - (client.clockOffset || 0) - feedback.at < 1400 ? feedback : null })}</section>`;
  const locked = ['queued', 'ready'].includes(data?.phase);
  const phase = data?.phase === 'ready' ? `<div class="pvp-match-ready" role="alert"><h3>대전 상대를 찾았어요</h3>${data.match.players.map(player => `<p>${esc(player.nickname)} · ${num(player.rating)}점</p>`).join('')}<p>입장 확인 <b data-pvp-ready-deadline="${data.match.expiresAt}">${num(Math.ceil((data.match.expiresAt - now) / 1000))}</b>초</p><button class="primary-button" type="button" data-action="pvp-accept" ${disabled(pending || data.match.acceptedAccountIds.includes(accountId))}>${data.match.acceptedAccountIds.includes(accountId) ? '상대 확인 대기 중' : '대전 입장'}</button><button type="button" data-action="pvp-leave" ${disabled(pending)}>취소</button></div>`
    : data?.phase === 'queued' ? `<div class="pvp-match-search"><strong>비슷한 점수의 상대를 찾고 있어요</strong><p>현재 점수 차이 ±${num(data.queue.ratingGap)} 범위</p><button type="button" data-action="pvp-leave" ${disabled(pending)}>매칭 취소</button></div>` : '';
  const selectedCards = selected.map(value => typeof value === 'string' ? value : value.cardId);
  return `<section class="pvp-page">${intro}${warning}${phase}<div class="pvp-deck-panel"><h3>대전 덱 · ${selectedCards.length} / 4</h3>${presetMarkup}<div class="pvp-deck-slots">${Array.from({ length: 4 }, (_, index) => { const card = cardById(selectedCards[index]); return `<div>${card ? picture(card, secret) + `<span>${index + 1}. ${esc(card.name)}</span>` : `<b>${index + 1}</b><small>카드 선택</small>`}</div>`; }).join('')}</div><button class="primary-button" type="button" data-action="pvp-queue" ${disabled(selectedCards.length !== 4 || locked || pending || blocked || !data)}>${blocked ? '진행 중인 다른 전투를 마쳐 주세요' : !data ? '대전 서버 연결 중' : '대전 상대 찾기'}</button><p>대전에서는 HP ×50 · 공격력 ÷10. 점수가 낮은 쪽이 먼저 행동하며, 팀 브레이크가 100이 되면 그 팀의 차례를 한 번 건너뜁니다. 총 240번 행동하면 무승부로 종료합니다.</p>
    <div class="pvp-deck-list" data-scroll-key="pvp:deck">${cards.map(entry => { const card = entry.card || cardById(entry.cardId || entry.id); if (!card) return ''; const chosen = selectedCards.includes(card.id); return `<button type="button" class="pvp-deck-choice ${chosen ? 'is-selected' : ''}" data-action="pvp-select-card" data-card-id="${esc(card.id)}" aria-pressed="${chosen}" ${disabled(locked || pending || entry.available === false)}>${picture(card, secret)}<span>${esc(card.name)}<small>${card.rarity.toUpperCase()} · ${chosen ? `${selectedCards.indexOf(card.id) + 1}번` : '편성'}</small></span></button>`; }).join('')}</div></div>
    <section class="pvp-season"><h3>2주 시즌 랭킹 <button type="button" data-action="pvp-rankings">새로고침</button></h3><p>시즌 순위 보상은 준비 중이며, 현재는 지급되지 않습니다. 대전 보상: 승리 ${num(data?.rewards?.victory ?? PVP_RULES.rewards.victory)} · 패배 ${num(data?.rewards?.defeat ?? PVP_RULES.rewards.defeat)}코인.</p><ol>${(client?.rankings || []).map(row => `<li><b>${row.rank}</b><span>${esc(row.nickname)}</span><strong>${num(row.rating)}점</strong></li>`).join('') || '<li>랭킹을 새로고침해 확인하세요.</li>'}</ol></section></section>`;
}
