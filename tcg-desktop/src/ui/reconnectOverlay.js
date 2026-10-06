import { LOADING_CHARACTERS, loadingCharacterById, loadingFrameTransforms } from '../data/loadingCharacters.js';

export const RECONNECT_FALLBACK_DELAY_MS = 15000;
export const RECONNECT_OVERLAY_FOCUS_SELECTOR = '#reconnect-overlay';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const duration = (value) => Math.max(0, Number(value) || 0);

/**
 * Render outside the cached screen's inert subtree. The owner traps focus in
 * #reconnect-overlay while visible and restores its previous focus on recovery.
 * Session conflicts / invalid credentials use their existing explicit screens;
 * this transient loader never offers takeover or modifies a cloud save.
 */
export function renderReconnectOverlay({
  character,
  phase = 'loading',
  detail = '',
  elapsedMs = 0,
  nextRetryMs = null,
  canLogout = true,
  secretMode = false,
} = {}) {
  const selected = loadingCharacterById(typeof character === 'string' ? character : character?.id) || LOADING_CHARACTERS[0];
  const offline = phase === 'offline';
  const saving = phase === 'saving' || phase === 'releasing' || phase === 'updating';
  const showFallback = !saving && duration(elapsedMs) >= RECONNECT_FALLBACK_DELAY_MS;
  const title = showFallback ? (offline ? '인터넷 연결을 기다리고 있어요' : '연결을 다시 확인하고 있어요') : '로딩 중…';
  const description = showFallback
    ? (offline ? '인터넷이 연결되면 자동으로 다시 이어집니다.' : '자동으로 다시 연결하고 있습니다. 잠시만 기다려 주세요.')
    : (saving ? '진행 기록을 안전하게 저장하고 있어요.' : '잠시만 기다려 주세요.');
  const detailText = showFallback ? String(detail || '').trim() : '';
  const retrySeconds = nextRetryMs === null || nextRetryMs === undefined ? 0 : Math.ceil(duration(nextRetryMs) / 1000);
  const frames = loadingFrameTransforms(selected).map((frame, index) => `<span class="reconnect-walker-frame" data-walk-step="${index}" data-walk-source-frame="${frame.sourceFrame}" style="--walk-frame:${index};background-image:url('${selected.sprite}');background-position:${frame.sourceFrame % 2 ? '100%' : '0%'} ${frame.sourceFrame >= 2 ? '100%' : '0%'};transform:translate(${frame.x}px,${frame.y}px) scale(${frame.scale})"></span>`).join('');
  return `<section id="reconnect-overlay" class="reconnect-overlay${showFallback ? ' is-waiting' : ''}${secretMode ? ' is-secret' : ''}" role="dialog" aria-modal="true" aria-labelledby="reconnect-overlay-title" aria-describedby="reconnect-overlay-description" tabindex="-1" data-reconnect-phase="${escape(phase)}">
    <div class="reconnect-overlay-content">
      <div class="reconnect-walker" aria-hidden="true">
        <span class="reconnect-walker-shadow"></span>
        ${secretMode ? '<span class="reconnect-walker-neutral"></span>' : `<span class="reconnect-walker-sprite" data-loading-character="${selected.id}">${frames}</span>`}
      </div>
      <div class="reconnect-overlay-status" role="status" aria-live="polite" aria-atomic="true">
        <h2 id="reconnect-overlay-title">${escape(title)}</h2>
        <p id="reconnect-overlay-description">${escape(description)}</p>
      </div>
      ${detailText ? `<p class="reconnect-overlay-detail">${escape(detailText)}</p>` : ''}
      ${showFallback && retrySeconds ? `<span class="reconnect-overlay-countdown" aria-hidden="true">${retrySeconds}초 후 다시 확인</span>` : ''}
      ${showFallback ? `<div class="reconnect-overlay-actions"><button type="button" data-action="cloud-retry">지금 다시 연결</button>${canLogout ? '<button class="reconnect-overlay-logout" type="button" data-action="logout">로그아웃</button>' : ''}</div>` : ''}
    </div>
  </section>`;
}
