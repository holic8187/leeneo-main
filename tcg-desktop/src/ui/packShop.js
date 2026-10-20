import { PACK_DEFINITION, RARITY_META } from '../data/cardCatalog.js';
const num = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
export function renderPackShop(state) {
  const pending = Boolean(state.pendingPackOpening);
  return `<section class="pack-shop" aria-labelledby="pack-shop-title"><header class="lobby-section-heading"><div><span>카드 소환</span><h2 id="pack-shop-title">카드팩 상점</h2></div><strong>${num(state.wallet.coins)}코인 보유</strong></header>
    <div class="pack-shop-products">${['standard','premium'].map((id) => {
      const pack = PACK_DEFINITION[id];
      const count = Number(state.packs[id]) || 0;
      return `<article class="pack-shop-product ${id === 'premium' ? 'is-premium' : ''}"><span class="pack-shop-seal"><i data-lucide="package-open"></i>${id === 'premium' ? 'RR+' : 'C–SSR'}</span><div><h3>${pack.name}</h3><p>${pack.description}</p><strong>보유 ${num(count)}팩 · 1팩 ${pack.cardCount}장</strong></div>
        <button class="primary-button" type="button" data-action="buy-pack" data-pack-id="${id}" ${state.wallet.coins < pack.coinPrice ? 'disabled' : ''}>${num(pack.coinPrice)}코인 · 1팩 구매</button>
        <div class="pack-shop-open">${pending ? '<button class="secondary-button" type="button" data-action="resume-pack-opening">미확인 카드 이어보기</button>' : `<button class="secondary-button" type="button" data-action="open-pack" data-pack-id="${id}" data-pack-count="1" ${count < 1 ? 'disabled' : ''}>1팩 개봉</button><button class="secondary-button" type="button" data-action="open-pack" data-pack-id="${id}" data-pack-count="10" ${count < 10 ? 'disabled' : ''}>10팩 개봉</button>`}</div>
        <details><summary>등급별 확률 보기</summary><p>${Object.entries(pack.weights).filter(([,weight]) => weight > 0).map(([rarity,weight]) => `${RARITY_META[rarity].label} ${Number((weight / Object.values(pack.weights).reduce((a,b)=>a+b,0) * 100).toFixed(3))}%`).join(' · ')}</p><small>${id === 'premium' ? '모든 카드가 RR 이상이며, 표준 팩의 등급 간 비율을 유지합니다.' : '기본 카드 1장 기준 확률입니다. U 이상 1장 보장과 50팩 SR 이상 확정 보상은 별도로 적용됩니다.'}</small></details></article>`;
    }).join('')}</div>
    <header class="lobby-section-heading reward-pack-heading"><div><span>승리의 선물</span><h2>보상 카드팩 · 뽑기권</h2></div></header>
    <aside class="ssr-ticket-inventory sr-reward-inventory"><span><strong>SR 이상 확정 카드팩</strong><small>주간 레이드 랭킹 보상 · SR 이상 카드 5장</small><small>SR 70% · HR 22% · UR 7% · SSR 1%</small></span><b>${num(state.packs.srPremium)}팩</b><div class="reward-pack-actions"><button class="secondary-button" type="button" data-action="${pending ? 'resume-pack-opening' : 'open-pack'}" data-pack-id="srPremium" data-pack-count="1" ${!pending && !state.packs.srPremium ? 'disabled' : ''}>${pending ? '미확인 카드 이어보기' : '1팩 개봉'}</button>${!pending && state.packs.srPremium >= 10 ? '<button class="secondary-button" type="button" data-action="open-pack" data-pack-id="srPremium" data-pack-count="10">10팩 개봉</button>' : ''}</div></aside>
    <aside class="ssr-ticket-inventory"><span><strong>확정 SSR 랜덤 뽑기권</strong><small>모든 SSR 카드가 동일 확률 · 협동 레이드 클리어 시 0.5% 또는 운영자 지급</small></span><b>${num(state.packs.ssrTicket)}장</b><button class="secondary-button" type="button" data-action="${pending ? 'resume-pack-opening' : 'open-pack'}" data-pack-id="ssrTicket" data-pack-count="1" ${!pending && !state.packs.ssrTicket ? 'disabled' : ''}>${pending ? '미확인 카드 이어보기' : '1장 사용'}</button></aside>
  </section>`;
}
