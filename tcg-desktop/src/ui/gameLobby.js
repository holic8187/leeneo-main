const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');

export function renderGameLobby({ state, hero, heroName, heroPower, heroLevel, heroEnhancement, heroEmblems, heroRarity, discovered, total, catalogCount, expedition, mission, countdown, progress, presets, recent, clock, raidRank, raidEntries }) {
  const waiting = Boolean(state.pendingPackOpening);
  const packs = Object.values(state.packs || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return `<div class="game-lobby">
    <section class="command-home" aria-labelledby="home-title">
      <div class="command-home__sky" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="home-welcome"><span>HOI · CARD CHRONICLES</span><h2 id="home-title">오늘도, 새로운 이야기</h2><p>${esc(state.profile.displayName)}님, 동료들이 기다리고 있어요.</p></div>
      <button class="home-character rarity-${hero.rarity} card-emblem-host" type="button" data-action="open-card" data-card-id="${esc(hero.id)}" aria-label="${esc(heroName)} 카드 정보 보기">
        <img class="home-character__art" src="${esc(hero.image)}" alt="${esc(heroName)}" /><span class="home-character__rarity">${heroRarity}</span>${heroEmblems}
        <span class="home-character__caption"><small>나의 대표 카드 · Lv.${num(heroLevel)} · +${num(heroEnhancement)}</small><strong>${esc(heroName)}</strong><b>전투력 ${num(heroPower)} <i data-lucide="chevron-right"></i></b></span>
      </button>
      <div class="home-destinations" aria-label="출전 메뉴">
        <button class="destination destination--adventure" type="button" data-action="navigate" data-view="adventure"><span class="destination__icon"><i data-lucide="map"></i></span><span class="destination__copy"><small>${expedition ? '동료들이 모험 중이에요' : '동료와 함께 떠나는 여정'}</small><strong>모험</strong><span>${expedition ? esc(mission?.name || '진행 중인 모험') : '덱을 편성하고 보상을 찾아 출발'}</span></span><i data-lucide="chevron-right"></i>${expedition ? `<time data-countdown="${expedition.endsAt}">${esc(countdown)}</time><span class="destination__progress"><b data-expedition-progress style="width:${Math.round(progress * 100)}%"></b></span>` : ''}</button>
        <button class="destination destination--raid" type="button" data-action="navigate" data-view="raid"><span class="destination__icon"><i data-lucide="swords"></i></span><span class="destination__copy"><small>강대한 보스에게 도전하세요</small><strong>레이드</strong><span>개인 도전 · 실시간 협동 전투</span></span><i data-lucide="chevron-right"></i><b class="destination__tag">${Number.isFinite(raidEntries) ? `오늘 ${num(raidEntries)}회 남음` : '주간 랭킹 보상'}</b></button>
        <button class="home-summon" type="button" data-action="${waiting ? 'resume-pack-opening' : 'navigate'}" data-view="shop"><i data-lucide="sparkles"></i><span><strong>${waiting ? '미공개 카드 이어보기' : '새로운 동료 소환'}</strong><small>${waiting ? '아직 확인하지 않은 카드가 있어요' : `보유 카드팩·뽑기권 ${num(packs)}개`}</small></span><i data-lucide="chevron-right"></i></button>
      </div>
    </section>
    <section class="home-status-strip" aria-label="나의 활동 현황">
      <button type="button" data-action="navigate" data-view="collection"><i data-lucide="library"></i><span>수집 도감<strong>${num(discovered)}<small> / ${num(catalogCount)}</small></strong></span><i data-lucide="chevron-right"></i></button>
      <button type="button" data-action="navigate" data-view="management"><i data-lucide="sparkles"></i><span>카드 성장<strong>${num(total)}<small>장 보유</small></strong></span><i data-lucide="chevron-right"></i></button>
      <button type="button" data-action="open-weekly-ranking"><i data-lucide="trophy"></i><span>주간 레이드<strong>${raidRank ? `${num(raidRank)}위` : '도전하기'}</strong></span><i data-lucide="chevron-right"></i></button>
    </section>
    <div class="home-lower-grid"><section class="home-decks">${presets}</section><aside class="home-weekly"><span class="eyebrow">WEEKLY RAID</span><h2>이번 주의 영광</h2><div class="home-weekly__emblem" aria-hidden="true"><i data-lucide="trophy"></i></div><strong>TOP 10 · SR 이상 확정 카드팩</strong><p>매주 월요일 00시, 최종 순위에 따라<br />우편함으로 보상을 보내드려요.</p><button class="secondary-button" type="button" data-action="open-weekly-ranking">순위와 보상 보기 <i data-lucide="arrow-right"></i></button></aside></div>
    <details class="home-journal"><summary><i data-lucide="clock"></i> 모험의 발자취 <span>최근 기록 ${recent.length}건</span></summary><div class="lobby-log__list">${recent.map(entry=>`<div class="lobby-log__row"><span aria-hidden="true"></span><p>${esc(entry.message)}</p><time>${esc(clock(entry.at))}</time></div>`).join('') || '<p>첫 모험을 시작해 보세요.</p>'}</div></details>
  </div>`;
}
