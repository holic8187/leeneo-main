import { renderRaidArena, renderRaidBossHud, renderCooperativeInspector } from './raidArena.js';
import { renderRaidControls, renderSecretRaidCard } from './raidControls.js';
import { cardById } from '../data/cardCatalog.js';
import { renderCardEmblems } from '../core/cardEmblems.js';
import { skillForCard } from '../core/turnRaidEngine.js';
import { relicById } from '../core/relics.js';
import { normalizeRaidBattle, activeRaidCardIndex } from '../core/raidBattleView.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
const seconds = (deadline, now) => Math.max(0, Math.ceil((Number(deadline) - now) / 1000));
const disabled = (condition) => condition ? 'disabled' : '';

function cardPicture(cardId, enhancement = 0, secret = false) {
  const card = cardById(cardId);
  return `<span class="coop-card-art card-emblem-host">${secret ? renderSecretRaidCard(card?.name || cardId, card?.rarity) : `<img src="${esc(card?.image || '')}" alt="${esc(card?.name || cardId)}" loading="lazy" />`}${renderCardEmblems(card || cardId, enhancement, { size: 'micro', captioned: true })}</span>`;
}

function participantsList(participants = [], accepted = null, accountId = '', secret = false) {
  return `<div class="coop-party-list">${participants.map((player, index) => `<article>
    ${cardPicture(player.cardId || player.card?.cardId, player.card?.enhancement || 0, secret)}
    <div><strong>${esc(player.nickname || '사원')}${player.accountId === accountId ? ' · 나' : ''}</strong><span>${esc(cardById(player.cardId || player.card?.cardId)?.name || '')}</span><small>개인 ${num(player.stage)}단계${accepted ? '' : ` · 행동 순서 ${index + 1}`}</small></div>
    ${accepted ? `<b class="${accepted.includes(player.accountId) ? 'is-accepted' : ''}">${accepted.includes(player.accountId) ? '입장 확인' : '확인 대기'}</b>` : ''}
  </article>`).join('')}</div>`;
}

export function renderCooperativeReady({ data, pending, error = '', accountId, now = Date.now(), secret = false }) {
  if (data?.phase !== 'ready' || !data.match) return '';
  const match = data.match;
  const accepted = match.acceptedAccountIds || [];
  const mineAccepted = accepted.includes(accountId);
  return `<div class="coop-ready-backdrop" role="presentation"><section class="coop-ready-dialog" role="dialog" aria-modal="true" aria-labelledby="coop-ready-title">
    <span class="eyebrow">협동 레이드 · 파티 발견</span><h2 id="coop-ready-title">네 명의 준비가 끝나면 출발합니다</h2>
    <p>자동 편성이 대표 카드 중 인물이 겹치지 않는 1장씩을 골랐습니다.</p>
    ${error ? `<p class="coop-error" role="alert">${esc(error)}</p>` : ''}
    ${participantsList(match.participants, accepted, accountId, secret)}
    <div class="coop-ready-footer"><span>입장 확인 <strong data-coop-deadline="${Number(match.expiresAt)}">${seconds(match.expiresAt, now)}</strong>초</span><strong>${accepted.length} / 4명</strong></div>
    <button class="primary-button" type="button" data-action="coop-accept" ${disabled(pending || mineAccepted || seconds(match.expiresAt, now) <= 0)}>${mineAccepted ? '입장 확인 완료 · 동료 기다리는 중' : pending === 'accept' ? '입장 확인 중…' : '입장하기'}</button>
    <button class="secondary-button" type="button" data-action="coop-leave" ${disabled(pending)}>대기열에서 나가기</button>
    <small>시간 안에 입장하지 않으면 대기열에서 나갑니다. 다른 동료를 기다리다 매칭이 취소되면 확인한 사원은 다시 대기하며 입장 횟수는 차감되지 않습니다.</small>
  </section></div>`;
}

function rewardSummary(reward) {
  if (!reward) return '<p>보상을 확인하고 있습니다.</p>';
  const parts = [`${num(reward.coins)} 동전`];
  if (reward.standardPacks || reward.packs) parts.push(`카드팩 ${num(reward.standardPacks || reward.packs)}개`);
  if (reward.ssrTickets) parts.push(`SSR 확정 랜덤 뽑기권 ${num(reward.ssrTickets)}장`);
  if (reward.experience?.amount) parts.push(`${cardById(reward.experience.cardId)?.name || '참가 카드'} 경험치 +${num(reward.experience.amount)}`);
  for (const item of reward.cards || []) parts.push(`${cardById(item.cardId)?.name || item.cardId} ×${item.quantity || 1}`);
  for (const item of reward.relics || []) parts.push(`유물 ${relicById(item.relicId)?.name || item.name || item.relicId} ×${item.quantity || 1}`);
  for (const item of reward.equipment || []) parts.push(item.name || `${String(item.rarity || '').toUpperCase()} 장비`);
  return `<ul class="coop-rewards">${parts.map((part) => `<li>${esc(part)}</li>`).join('')}</ul>`;
}

function renderBattle({ data, pending, accountId, now, targetId, choice, galaxyChoice, secret, feedback, inspector }) {
  const room = data.room;
  if (!room?.battle) return '<p>전투 기록을 불러오고 있습니다.</p>';
  const battle = normalizeRaidBattle(room.battle);
  const index = activeRaidCardIndex(battle);
  const myTurn = data.phase === 'battle' && room.activeAccountId === accountId && index >= 0;
  const actor = battle.squad[index];
  const automatic = (room.autoAccountIds || []).includes(accountId);
  const galaxySelector = actor && (actor.cardId === 'hoi-ur' || (actor.cardId === 'hoi-ssr' && room.battle.lastCopyableSkill?.cardId === 'hoi-ur'));
  const owner = room.participants.find(player => player.accountId === room.activeAccountId);
  const victory = battle.boss.hp <= 0 || battle.result === 'victory';
  const finished = data.phase === 'finished';
  const owners = battle.squad.map(member => {
    const player = room.participants.find(p => p.instanceId === member.id || p.cardId === member.cardId);
    return (player?.nickname || '사원') + (player?.accountId === accountId ? ' · 나' : '');
  });
  return `<section class="raid-battle-screen coop-shared-battle ${secret ? 'is-secret' : ''} ${finished ? 'is-complete' : ''}" aria-label="협동 레이드 전투 화면">
    <header class="raid-battle-topbar">${renderRaidBossHud(battle,{cooperative:true,effectAction:'coop-inspect-effect'})}<div class="raid-turn-counter"><small>전투 턴</small><strong>${num(battle.turn || 1)}</strong></div></header>
    ${renderRaidControls({ automatic, secret, cooperative:true, pending, finished })}
    <div class="coop-turn-label"><strong>${finished ? '협동 전투 종료' : room.battle.currentActor === 'follow-up' ? '아군 추가 효과 발동 중' : myTurn ? '내 차례입니다' : (esc(owner?.nickname || '보스') + '의 차례')}</strong><span>단계 합 ${num(room.stageSum)} · 최대 7턴</span></div>
    ${myTurn ? `<div class="coop-action-options"><label>스킬 대상<select data-coop-target ${disabled(pending)}><option value="">자동 선택</option>${battle.squad.filter(member=>member.hp>0).map(member=>`<option value="${esc(member.id)}" ${targetId === member.id ? 'selected' : ''}>${esc(cardById(member.cardId)?.name || member.name)}</option>`).join('')}</select></label>${galaxySelector ? `<label>은하수 동률 우선<select data-coop-galaxy-choice ${disabled(pending)}>${[['attack','공격'],['heal','회복'],['support','지원']].map(([value,label])=>`<option value="${value}" ${galaxyChoice === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}${actor.cardId === 'guma-hr' ? `<label>구미신탁<select data-coop-choice ${disabled(pending)}>${[['fortune','길 · 회복'],['misfortune','흉 · 공격'],['reversal','역전 · 보호막']].map(([value,label])=>`<option value="${value}" ${choice === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}</div>` : ''}
    ${renderRaidArena({battle,animation:feedback || {},secret,activeIndex:index,canAct:myTurn,pending:Boolean(pending),cooperative:true,owners,countdown:index>=0 && !finished ? Number(room.turnExpiresAt) : 0,now})}
    ${finished ? `<section class="coop-result" aria-live="polite"><h3>${victory ? '네 명의 힘으로 클리어!' : '협동 도전 종료'}</h3><p>함께 입힌 피해 ${num(battle.totalDamage)}</p>${rewardSummary(data.reward || room.reward)}<button class="primary-button" type="button" data-action="coop-claim" ${disabled(pending)}>${pending === 'claim' ? '보상 저장 중…' : '보상 받고 돌아가기'}</button></section>` : ''}
    <details class="coop-boss-patterns"><summary>보스 패턴 · 공략 확인</summary>${(battle.boss.skills || []).map(item=>`<p><strong>${esc(item.name)}</strong> ${esc(item.description || item.text || '')}</p>`).join('') || '<p>동료와 힘을 모아 공명에 대응하세요.</p>'}</details>
    <details class="coop-battle-log"><summary>최근 전투 기록</summary><ol>${battle.battleLog.slice(-12).map(entry=>`<li>${esc(entry.message || entry.text || '')}</li>`).join('')}</ol></details>
    ${renderCooperativeInspector(battle,inspector)}
  </section>`;
}

export function renderCooperativePanel({ client, selected = [], cards = [], accountId = '', now = Date.now(), targetId = '', choice = 'fortune', galaxyChoice = 'attack', secret = false, personalBattle = false, inspector = null }) {
  const { data, pending, loading, error } = client;
  const phase = data?.phase || 'idle';
  const engaged = ['queued', 'ready', 'battle'].includes(phase);
  const shell = `<header class="coop-header"><div><span class="eyebrow">4인 실시간 협동</span><h2>공명 균열</h2></div><div class="coop-entry-count"><strong>${data ? num(data.entriesRemaining) : '—'} / 2</strong><small>오늘 남은 입장 · 매일 00:00 KST</small></div></header>${error ? `<p class="coop-error" role="alert">${esc(error)} <button type="button" data-action="coop-refresh">다시 연결</button></p>` : ''}`;
  if (['battle', 'finished'].includes(phase)) return `<div class="coop-raid-page">${shell}${renderBattle({ data, pending, accountId, now, targetId, choice, galaxyChoice, secret, inspector, feedback: client.feedback && now - client.clockOffset - client.feedback.at < 1600 ? client.feedback : null })}</div>`;
  return `<section class="coop-raid-page">${shell}
    <div class="coop-intro"><img src="./assets/bosses/coop-tetra.webp" alt="협동 전용 보스 사중공명체 테트라" /><div><h3>사중공명체 테트라</h3><p>네 사원, 네 인물. 서로 다른 힘으로 균열을 닫으세요.</p><small>개인 도달 단계의 합에 따라 보스의 체력·패턴과 보상이 높아집니다.</small></div></div>
    ${engaged ? `<div class="coop-queue-status" role="status"><strong>${phase === 'ready' ? '파티를 찾았습니다 · 입장 확인 중' : '함께할 사원을 찾고 있습니다'}</strong><p>${phase === 'queued' ? `대기 중 ${num(data.queue?.queuedCount || 1)}명 · ${esc(data.queue?.reason || '인물이 겹치지 않는 네 명을 모으고 있습니다.')}` : '화면의 입장 팝업을 확인해 주세요.'}</p><button class="secondary-button" type="button" data-action="coop-leave" ${disabled(pending)}>대기 취소</button></div>` : ''}
    <div class="coop-selection-heading"><h3>내 대표 카드 <span>${data?.queue?.cards?.length || selected.length} / 3</span></h3><p>서로 다른 인물 3장을 고르면 자동 편성이 그중 1장을 선택합니다.</p></div>
    <div class="coop-selected-slots">${[0, 1, 2].map((index) => {
      const id = selected[index] || data?.queue?.cards?.[index]?.cardId;
      const entry = cards.find((item) => item.card.id === id);
      return `<button type="button" data-action="coop-select-card" data-card-id="${esc(id || '')}" ${disabled(engaged || pending || !id)} aria-label="${id ? `${esc(cardById(id)?.name)} 선택 해제` : `대표 카드 ${index + 1} 빈칸`}">${id ? `${cardPicture(id, entry?.enhancement || 0)}<span>${esc(cardById(id)?.name)}</span>` : `<b>0${index + 1}</b><span>대표 카드</span>`}</button>`;
    }).join('')}</div>
    ${!engaged ? `<div class="coop-card-grid" data-scroll-key="cooperative:cards">${cards.map(({ card, enhancement, power }) => `<button class="coop-card-choice ${selected.includes(card.id) ? 'is-selected' : ''}" type="button" data-action="coop-select-card" data-card-id="${esc(card.id)}" aria-pressed="${selected.includes(card.id)}" ${disabled(pending)}>${cardPicture(card.id, enhancement)}<strong>${esc(card.name)}</strong><small>${card.rarity.toUpperCase()} · ATK ${num(power)}</small></button>`).join('') || '<p>모험에 출발하지 않은 카드를 보유해야 합니다.</p>'}</div><button class="primary-button coop-queue-button" type="button" data-action="coop-queue" ${disabled(pending || (loading && !data) || !data || !data.entriesRemaining || selected.length !== 3 || personalBattle)}>${pending === 'queue' ? '대표 카드 확인 중…' : loading && !data ? '서버 연결 중…' : personalBattle ? '개인 레이드를 먼저 마쳐 주세요' : '대표 카드로 대기열 등록'}</button>` : ''}
    <details class="coop-rules"><summary>입장과 보상 안내</summary><ul><li>4명 모두 30초 안에 입장을 확인해야 출발합니다. 전투 시작 시에만 하루 2회의 입장 횟수가 차감됩니다.</li><li>3장씩 비교해 인물이 겹치지 않는 조합을 찾고, 방어·공격·지원 구성을 고려해 자동 편성합니다. 불가능한 조합은 다음 동료를 기다립니다.</li><li>행동 순서는 무작위입니다. 최대 7턴 동안 개인 레이드와 같이 아군과 보스가 번갈아 행동합니다.</li><li>클리어 시 동전·카드팩, 장비(15~50%), 유물(0.1~1%)을 획득할 수 있습니다. 단계 합 24 이상은 SR 이상 카드 1장도 확정 지급합니다. 모든 단계에서 클리어 시 개인별 0.5% 확률로 SSR 확정 랜덤 뽑기권 1장을 추가 획득합니다.</li><li>대기·입장 확인·전투 중에는 강화·합성·모험 출발·개인 레이드 시작을 잠시 멈춥니다. 장비·유물은 협동 편성에 적용하지 않습니다.</li></ul></details>
  </section>`;
}
