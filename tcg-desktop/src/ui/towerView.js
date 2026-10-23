import { TOWER_AUGMENT_BY_ID, towerAugmentCounts } from '../data/towerAugments.js';
import { TOWER_MONTHLY_REWARD_TIERS } from '../core/towerRules.js';
import { normalizeRaidBattle, activeRaidCardIndex } from '../core/raidBattleView.js';
import { renderRaidArena, renderRaidBossHud, renderCooperativeInspector } from './raidArena.js';
import { renderSecretRaidCard } from './raidControls.js';
import { renderCardEmblems } from '../core/cardEmblems.js';
import { cardById } from '../data/cardCatalog.js';
import { skillChoices } from '../data/remainingRosterSkills.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = value => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
const disabled = value => value ? 'disabled' : '';
const rewardLabel = rewards => Object.entries(rewards).filter(([, count]) => count > 0).map(([id, count]) => `${({ coins: '코인', standardPacks: '표준 팩', premiumPacks: '고급 팩', srPremiumPacks: 'SR 이상 팩', ssrTickets: 'SSR 확정권' })[id] || id} ${num(count)}${id === 'coins' ? '' : '개'}`).join(' · ');
const portrait = (card, secret) => secret ? renderSecretRaidCard(card.name, card.rarity) : `<img src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy">`;

export function renderTowerOffer(offer, pending = false) {
  if (!offer) return '';
  return `<section class="tower-offer" aria-label="탑 증강 선택"><h3>${offer.checkpoint ? `${num(offer.checkpoint)}층 돌파` : '첫 도전'} · 증강 하나를 선택하세요</h3><p>선택한 효과는 이번 달 탑에서 계속 누적됩니다. 각 후보는 한 번 무료로 다시 뽑을 수 있습니다.</p><div class="tower-offer-grid">${offer.options.map((id, slot) => {
    const augment = TOWER_AUGMENT_BY_ID[id];
    return `<article class="tower-augment is-${esc(augment?.tier || 'silver')}"><span>${({ silver: '실버', gold: '골드', prism: '프리즘' })[augment?.tier] || ''}</span><h4>${esc(augment?.name || id)}</h4><p>${esc(augment?.description || '')}</p><button class="primary-button" data-action="tower-choose" data-augment-id="${esc(id)}" ${disabled(pending)}>선택하기</button><button class="secondary-button" data-action="tower-reroll" data-slot="${slot}" ${disabled(pending || offer.rerolledSlots.includes(slot))}>${offer.rerolledSlots.includes(slot) ? '재추첨 완료' : '무료 재추첨'}</button></article>`;
  }).join('')}</div></section>`;
}

function battleView({ data, pending, feedback, secret, inspector, now, targetId, choice, galaxyChoice }) {
  if (!data.battle) return '';
  const battle = normalizeRaidBattle(data.battle), active = activeRaidCardIndex(battle);
  const ready = data.battle.status === 'ready', finished = data.battle.status === 'finished', actor = data.battle.cards[data.battle.currentActorIndex];
  const canAct = data.battle.status === 'active' && data.battle.currentActor === 'card';
  const copiedId = actor?.cardId === 'hoi-ssr' ? data.battle.lastCopyableSkill?.cardId || actor.cardId : actor?.cardId;
  const choices = copiedId === 'guma-hr' ? [{ value: 'fortune', label: '길 · 회복' }, { value: 'misfortune', label: '흉 · 공격' }, { value: 'reversal', label: '역전 · 보호막' }] : skillChoices(copiedId);
  const mappedArena = renderRaidArena({ battle, animation: feedback || {}, secret, activeIndex: active, canAct, pending, countdown: canAct ? data.battle.turnDeadlineAt : 0, now })
    .replaceAll('data-action="raid-basic-attack"', 'data-action="tower-basic"').replaceAll('data-action="raid-skill-attack"', 'data-action="tower-skill"')
    .replaceAll('data-action="inspect-raid-card"', 'data-action="tower-inspect-card"').replaceAll('data-action="inspect-raid-effect"', 'data-action="tower-inspect-effect"')
    .replaceAll('data-raid-turn-deadline', 'data-tower-deadline');
  return `<section class="raid-battle-screen tower-battle ${finished ? 'is-complete' : ''}" aria-label="무한의 탑 전투"><header class="raid-battle-topbar">${renderRaidBossHud(battle, { effectAction: 'tower-inspect-effect' })}<div class="raid-turn-counter"><small>전투 턴</small><strong>${num(data.battle.round)} / 7</strong></div></header>
    ${ready ? '<button class="primary-button" data-action="tower-start" ' + disabled(pending) + '>전투 시작</button>' : ''}
    ${canAct ? `<div class="tower-action-options"><label>스킬 대상<select data-tower-target ${disabled(pending)}><option value="">자동 선택</option>${data.battle.cards.filter(card => card.hp > 0).map(card => `<option value="${esc(card.id)}" ${targetId === card.id ? 'selected' : ''}>${esc(card.name)}</option>`).join('')}</select></label>${choices.length ? `<label>스킬 선택<select data-tower-choice ${disabled(pending)}>${choices.map(({value,label}) => `<option value="${esc(value)}" ${choice === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>` : ''}${actor?.cardId === 'hoi-ur' || actor?.cardId === 'hoi-ssr' ? `<label>은하수 동률 우선<select data-tower-galaxy-choice>${[['attack','공격'],['heal','회복'],['support','지원']].map(([value,label]) => `<option value="${value}" ${galaxyChoice === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}</div>` : ''}
    ${mappedArena}
    ${finished ? `<div class="tower-result" role="status"><h3>${data.battle.result === 'victory' ? '층 돌파 성공!' : '이번 도전 종료'}</h3><p>이번 전투 피해 ${num(data.battle.totalDamage)} · 최고 ${num(data.clearedFloor)}층 클리어</p><p>다음 도전은 HP가 회복된 새 전투로 시작합니다.</p></div>` : `<button class="secondary-button" data-action="tower-abandon" ${disabled(pending)}>이번 도전 포기</button>`}
    ${renderCooperativeInspector(battle, inspector).replaceAll('data-action="coop-close-inspector"', 'data-action="tower-close-inspector"')}
  </section>`;
}

export function renderTowerPanel({ client = {}, selected = [], cards = [], secret = false, now = Date.now(), inspector = null, targetId = '', choice = 'fortune', galaxyChoice = 'attack', blocked = false } = {}) {
  const { data, loading, pending, error, ranking, feedback } = client;
  const engaged = data?.battle && data.battle.status !== 'finished';
  const counts = towerAugmentCounts(data?.augments || []);
  const rewardTiers = data?.rewardTiers || TOWER_MONTHLY_REWARD_TIERS;
  return `<section class="tower-page"><header class="tower-heading"><div><span class="eyebrow">INFINITE TOWER</span><h2>무한의 탑</h2><p>한 달 동안 쌓아 올리는 나만의 증강과 도전</p></div><strong>${data ? `${num(data.clearedFloor)}층 클리어` : '연결 중'}</strong></header>
    <div class="tower-season"><span>${esc(data?.seasonKey || '')} 시즌 · 매월 1일 00:00 KST 초기화</span><button class="secondary-button" data-action="tower-ranking">월간 순위 보기</button><button class="secondary-button" data-action="tower-secret" aria-pressed="${secret}">시크릿 ${secret ? 'ON' : 'OFF'}</button></div>
    ${error ? `<p class="tower-error" role="alert">${esc(error)} <button data-action="tower-refresh">다시 연결</button></p>` : ''}
    ${!data ? `<p role="status">${loading ? '탑의 기록을 불러오고 있습니다.' : '탑에 연결해 주세요.'}</p>` : ''}
    ${data ? battleView({ data, pending, feedback: feedback && now - feedback.at < 1600 ? feedback : null, secret, inspector, now, targetId, choice, galaxyChoice }) : ''}
    ${renderTowerOffer(data?.offer, pending)}
    ${data && !engaged && !data.offer ? `<section class="tower-deck"><h3>${num(data.floor)}층 도전 · 원정대 ${selected.length} / 4</h3><p>보스 HP ${num(data.nextBoss?.maxHp)} · 서로 다른 인물 4장 · 최대 7턴</p><button class="primary-button" data-action="tower-enter" ${disabled(pending || selected.length !== 4 || blocked)}>${blocked ? '진행 중인 다른 전투를 먼저 마쳐 주세요' : `${num(data.floor)}층 입장`}</button><div class="tower-card-grid" data-scroll-key="tower:cards">${cards.map(({ card, enhancement = 0, power = 0 }) => `<button class="tower-card ${selected.includes(card.id) ? 'is-selected' : ''}" data-action="tower-select-card" data-card-id="${esc(card.id)}" aria-pressed="${selected.includes(card.id)}" ${disabled(pending)}><span class="card-emblem-host">${portrait(card, secret)}${renderCardEmblems(card, enhancement, { size: 'micro' })}</span><strong>${esc(card.name)}</strong><small>${esc(card.rarity.toUpperCase())} · ATK ${num(power)}</small>${selected.includes(card.id) ? `<b>${selected.indexOf(card.id) + 1}</b>` : ''}</button>`).join('') || '<p>모험 중이 아닌 카드를 준비해 주세요.</p>'}</div></section>` : ''}
    <details class="tower-owned-augments"><summary>이번 달 누적 증강 ${num(data?.augments?.length)}개</summary><div>${Object.entries(counts).map(([id, count]) => `<article><strong>${esc(TOWER_AUGMENT_BY_ID[id].name)}${count > 1 ? ` ×${count}` : ''}</strong><p>${esc(TOWER_AUGMENT_BY_ID[id].description)}</p></article>`).join('') || '<p>증강을 선택하고 첫 계단을 올라가세요.</p>'}</div></details>
    ${ranking ? `<section class="tower-ranking"><h3>${esc(ranking.seasonKey)} 월간 순위${ranking.ownRank ? ` · 내 순위 ${ranking.ownRank}위` : ''}</h3><ol>${ranking.entries.map(entry => `<li class="${entry.own ? 'is-mine' : ''}"><b>${num(entry.rank)}위</b><span>${esc(entry.nickname)}</span><strong>${num(entry.clearedFloor)}층</strong><small>다음 층 ${(entry.bestProgress / 10000).toFixed(2)}%</small></li>`).join('') || '<li>아직 도전 기록이 없습니다.</li>'}</ol></section>` : ''}
    <details class="tower-rewards"><summary>월간 보상과 도전 규칙</summary><p>최고 클리어 층, 다음 층의 최고 피해 비율 순으로 순위를 매깁니다. 같은 기록은 공동 순위입니다. 입장 제한 없이 재도전할 수 있으며 보스와 아군 HP는 매번 초기화됩니다. 시작할 때와 5층을 클리어할 때마다 증강을 선택합니다. 월초에는 진행 중 전투도 종료되며 이전 달 결과를 확정해 우편으로 보냅니다.</p><ul>${rewardTiers.map((band, index) => `<li>${band.maxRank == null ? `${rewardTiers[index - 1].maxRank + 1}위 이하` : `${index ? rewardTiers[index - 1].maxRank + 1 + '–' : ''}${band.maxRank}위`}: ${esc(rewardLabel(band.rewards))}</li>`).join('')}</ul><p>보스에게 실제 피해를 입힌 도전자부터 순위에 등록됩니다. 우편함이 가득 차면 공간이 생긴 후 보상을 재지급합니다.</p></details>
  </section>`;
}
