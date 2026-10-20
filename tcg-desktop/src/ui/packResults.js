import { PACK_DEFINITION } from '../data/cardCatalog.js';
import { packPresentation, packShowcaseFocus } from '../core/packPresentation.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');

export function renderPackResults({ cards, modal, state, renderCard }) {
  const presentation = packPresentation(cards, modal.newCardIndices, modal.revealedCards);
  const { showcaseIndices, hiddenIndices, duplicateGroups } = presentation;
  const focus = packShowcaseFocus(presentation, modal.focusIndex);
  modal.focusIndex = focus;
  const position = showcaseIndices.indexOf(focus);
  const packId = PACK_DEFINITION[modal.packId] ? modal.packId : 'standard';
  const pack = PACK_DEFINITION[packId];
  const owned = Number(state.packs[packId]) || 0;
  const revealed = new Set(modal.revealedCards || []);
  const flashRarity = ['rrr','sr','hr','ur','ssr'].includes(modal.flashRarity) ? modal.flashRarity : '';
  delete modal.flashRarity;
  return `<div class="modal-backdrop pack-backdrop pack-carousel-backdrop ${flashRarity ? `rarity-${flashRarity}` : ''}" data-action="close-modal">
    <section class="modal-sheet pack-opening-modal pack-carousel-modal" role="dialog" aria-modal="true" aria-labelledby="pack-result-title" data-modal-panel>
      <header class="pack-focus-heading"><div><span class="eyebrow">${esc(pack.name)} · ${num(cards.length)}장 획득</span><h2 id="pack-result-title">카드 획득 결과</h2></div><button class="modal-close" type="button" data-action="close-modal" aria-label="닫기 · 미공개 카드는 저장됩니다"><i data-lucide="x"></i></button></header>
      <section class="pack-duplicate-summary" aria-label="중복 카드 획득 목록" data-scroll-key="pack:duplicates:${esc(modal.openingId || 'result')}">
        <strong>중복 카드</strong>${duplicateGroups.length ? `<ul>${duplicateGroups.map(({card, count}) => `<li><b>${esc(card.rarity.toUpperCase())}</b>등급 ${esc(card.name)} <strong>${num(count)}장 획득</strong></li>`).join('')}</ul>` : `<p>${hiddenIndices.length ? '미공개 카드의 중복 결과는 뒤집은 뒤 표시됩니다.' : '중복 카드가 없습니다.'}</p>`}
      </section>
      <div class="pack-focus-status" aria-live="polite"><span>${hiddenIndices.length ? `공개 대기 ${num(hiddenIndices.length)}장 · 좌우로 넘겨 확인하세요` : showcaseIndices.length ? '모든 카드를 확인했습니다.' : '중복 카드를 모두 획득했습니다.'}</span>${hiddenIndices.length ? '<button type="button" data-action="reveal-all-pack-cards">한 번에 모두 뒤집기</button>' : ''}</div>
      ${showcaseIndices.length ? `<div class="pack-carousel-wrap">
        <button class="pack-focus-arrow" type="button" data-action="focus-pack-card" data-card-index="${showcaseIndices[position-1] ?? -1}" aria-label="이전 카드" ${position <= 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i></button>
        <div class="pack-carousel" tabindex="0" role="region" aria-label="신규 및 SR 이상 카드 · 좌우 넘기기" data-scroll-key="pack:carousel:${esc(modal.openingId || 'result')}">${showcaseIndices.map((index) => `<div class="pack-carousel-item" data-showcase-index="${index}">${renderCard(cards[index], index, true, revealed, modal)}</div>`).join('')}</div>
        <button class="pack-focus-arrow" type="button" data-action="focus-pack-card" data-card-index="${showcaseIndices[position+1] ?? -1}" aria-label="다음 카드" ${position >= showcaseIndices.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-right"></i></button>
      </div>` : '<div class="pack-summary-complete"><i data-lucide="check"></i><strong>획득 완료</strong><p>위 목록에서 이번에 얻은 카드를 확인하세요.</p></div>'}
      <footer class="pack-focus-footer"><div class="pack-focus-primary"><button class="secondary-button" type="button" data-action="close-modal">${hiddenIndices.length ? '저장 후 닫기' : '닫기'}</button>${hiddenIndices.length ? '<button class="primary-button" type="button" data-action="reveal-all-pack-cards">모두 뒤집기</button>' : '<button class="primary-button" type="button" data-action="navigate-from-modal" data-view="collection">도감에서 확인</button>'}</div>
        <div class="pack-focus-secondary">${hiddenIndices.length ? '<small>미공개 카드는 종료하거나 다른 창을 열어도 저장됩니다.</small>' : owned ? `<button class="text-button" type="button" data-action="open-another-pack" data-pack-id="${packId}" data-pack-count="1">${packId === 'ssrTicket' ? '뽑기권 1장 더 사용' : '1팩 더 개봉'} · ${num(owned)}개 보유</button>${owned >= 10 && packId !== 'ssrTicket' ? `<button class="text-button" type="button" data-action="open-another-pack" data-pack-id="${packId}" data-pack-count="10">10팩 개봉</button>` : ''}` : !pack.adminOnly && pack.coinPrice > 0 ? `<button class="text-button" type="button" data-action="buy-and-open-pack" data-pack-id="${packId}" ${state.wallet.coins < pack.coinPrice ? 'disabled' : ''}>${num(pack.coinPrice)}코인으로 구매 후 개봉</button>` : '<small>보유한 보상 카드팩·뽑기권을 모두 사용했습니다.</small>'}</div>
      </footer>
    </section></div>`;
}
