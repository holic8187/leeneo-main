const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function renderRaidControls({ automatic = false, secret = false, cooperative = false, pending = false, finished = false } = {}) {
  return `<div class="raid-preferences" aria-label="전투 표시와 자동전투 설정"><button type="button" data-action="${cooperative ? 'coop-auto' : 'toggle-raid-auto'}" aria-pressed="${automatic}" class="${automatic ? 'is-enabled' : ''}" ${pending || finished ? 'disabled' : ''}>자동전투 <b>${automatic ? 'ON' : 'OFF'}</b></button><button type="button" data-action="toggle-raid-secret" aria-pressed="${secret}" class="${secret ? 'is-enabled' : ''}">시크릿 <b>${secret ? 'ON' : 'OFF'}</b></button><small>${automatic ? '사용 가능한 스킬 우선 · 없으면 기본공격' : '직접 행동 선택'}${secret ? ' · 일러스트 숨김' : ''}</small></div>`;
}

// Do not put the original image URL in the DOM while secret mode is enabled.
export function renderSecretRaidCard(label = 'SECRET', rarity = '') {
  return `<span class="raid-secret-art" role="img" aria-label="일러스트 숨김"><span aria-hidden="true">HC</span><strong>${escape(label)}</strong>${rarity ? `<small>${escape(rarity.toUpperCase())}</small>` : ''}</span>`;
}
