import {
  ArrowRight,
  Bell,
  Briefcase,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Coins,
  createIcons,
  Download,
  EyeOff,
  Gift,
  Library,
  Link2,
  Lock,
  Map,
  PackageOpen,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide';
import './styles.css';
import {
  CARD_CATALOG,
  ALL_CARDS,
  EXPEDITIONS,
  PACK_DEFINITION,
  RAID_DEFINITION,
  RARITY_META,
  RARITY_ORDER,
  cardById,
  expeditionById,
} from './data/cardCatalog.js';
import { incidentById } from './data/incidentCatalog.js';
import { addCardsToCollection, openPack } from './core/packEngine.js';
import {
  chooseIncident,
  incidentExpiresAt,
  isIncidentExpired,
  nextIncidentDelay,
  pendingIncidentWindow,
  resolveIncidentChoice,
} from './core/incidentEngine.js';
import {
  calculateSquadScore,
  cardExpeditionPower,
  completeDueExpedition,
  expeditionEffectivePower,
  expeditionProgress,
  startExpedition,
} from './core/expeditionEngine.js';
import { createRaidState } from './core/raidEngine.js';
import { reconcileRaidRewards } from './core/raidRewards.js';
import { appendActivity, createGameStore, hasStoredGameState } from './core/gameState.js';
import {
  cardsForPendingPack,
  createPendingPackOpening,
  revealPendingPackCard,
  unrevealedPackCardCount,
} from './core/packOpeningSession.js';
import { createAuthSessionStore } from './core/authSession.js';
import { createCloudPlaySession } from './core/cloudPlaySession.js';
import {
  getOrCreateDeviceId,
  platformLabel,
  shouldBootstrapCloudState,
} from './core/deviceIdentity.js';
import { availableRaidSquad, toggleSquadSelection } from './core/squadSelection.js';
import { desktopBridge } from './services/desktopBridge.js';
import {
  checkAccountAvailability,
  isAuthGatewayConfigured,
  loadCurrentTcgAccount,
  loginTcgAccount,
  registerTcgAccount,
} from './services/authGateway.js';
import {
  dispatchPersonalRaid,
  isRaidGatewayConfigured,
  loadPersonalRaid,
  loadPersonalRaidRanking,
} from './services/raidGateway.js';
import {
  heartbeatPlaySession,
  openPlaySession,
  releasePlaySession,
  saveCloudGameState,
  takeoverPlaySession,
} from './services/playSessionGateway.js';

const app = document.querySelector('#app');
const authSession = createAuthSessionStore();
const deviceId = getOrCreateDeviceId();
const clientPlatform = desktopBridge.platform;
let store = null;
let cloudPlay = null;
let unsubscribeCloudStore = null;
let applyingRemoteState = false;
let cloudBootstrapAllowed = false;
let updateCheckPromise = null;
let updateInstallPromise = null;
let autoUpdateAttemptedVersion = '';
let appVersionPromise = null;
let authenticationRestorePromise = null;

const iconSet = {
  ArrowRight,
  Bell,
  Briefcase,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Coins,
  Download,
  EyeOff,
  Gift,
  Library,
  Link2,
  Lock,
  Map,
  PackageOpen,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wifi,
  X,
  Zap,
};

const views = {
  dashboard: { label: '업무판', icon: 'briefcase' },
  collection: { label: '카드 도감', icon: 'library' },
  adventure: { label: '자동 모험', icon: 'map' },
  raid: { label: '레이드', icon: 'shield' },
  link: { label: '호이상사 연동', icon: 'link-2' },
};

const ui = {
  view: 'dashboard',
  renderedView: null,
  modal: null,
  selectedMissionId: EXPEDITIONS[0].id,
  rarityFilter: 'all',
  collectionQuery: '',
  notice: null,
  updateStatus: null,
  appVersion: '...',
  cloud: {
    phase: 'idle',
    message: '',
    code: '',
    activePlatform: '',
    generation: 0,
  },
  incidentScheduling: false,
  incidentExpiring: false,
  raidMode: 'personal',
  raidPanel: 'battle',
  raid: {
    loading: false,
    dispatching: false,
    error: '',
    ranking: null,
    lastLoadedAt: 0,
    requestEpoch: 0,
  },
  auth: {
    phase: 'restoring',
    mode: 'login',
    pending: false,
    error: '',
    offline: false,
    account: null,
    form: {
      username: '',
      nickname: '',
      password: '',
      passwordConfirm: '',
    },
    availability: {
      username: { checkedValue: '', available: false, pending: false, message: '아이디 중복 확인이 필요합니다.' },
      nickname: { checkedValue: '', available: false, pending: false, message: '닉네임 중복 확인이 필요합니다.' },
    },
  },
};

const cloudGateway = {
  open: openPlaySession,
  takeover: takeoverPlaySession,
  heartbeat: heartbeatPlaySession,
  release: releasePlaySession,
  saveState: saveCloudGameState,
};

function activeCloudLeaseKey() {
  if (ui.cloud.phase !== 'active') return '';
  const lease = cloudPlay?.getSnapshot().lease;
  return lease?.leaseId ? `${lease.leaseId}:${lease.generation}` : '';
}

function hasPersistedAccountState() {
  const accountId = ui.auth.account?.id;
  if (!accountId) return false;
  return hasStoredGameState(globalThis.localStorage, accountId);
}

function flushLocalGameCache() {
  if (!store) return null;
  if (!cloudBootstrapAllowed && ui.cloud.phase !== 'active' && !hasPersistedAccountState()) return null;
  return store.flush();
}

async function flushCloudStateOrThrow() {
  if (!cloudPlay) return { revision: 0, pending: false, conflict: false };
  const result = await cloudPlay.flush();
  const snapshot = cloudPlay.getSnapshot();
  if (result?.conflict || snapshot.hasSaveConflict) {
    const error = new Error('서로 다른 진행 기록을 먼저 확인해 주세요.');
    error.code = 'CLOUD_SAVE_CONFLICT';
    throw error;
  }
  if (result?.pending || snapshot.hasPendingState) {
    const error = new Error('아직 서버에 저장되지 않은 진행 기록이 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
    error.code = 'PENDING_SAVE';
    throw error;
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.max(0, Number(value) || 0));
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 ${minutes % 60}분`;
}

function formatClock(timestamp) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function rarityLabel(rarity) {
  return RARITY_META[rarity]?.label || rarity;
}

const PACK_FLIP_THRESHOLD = RARITY_ORDER.indexOf('sr');

function rarityRank(rarity) {
  const rank = RARITY_ORDER.indexOf(rarity);
  return rank < 0 ? 0 : rank;
}

function highestRarity(cards = []) {
  return cards.reduce((highest, card) => (
    rarityRank(card?.rarity) > rarityRank(highest) ? card.rarity : highest
  ), RARITY_ORDER[0]);
}

function cardPower(card) {
  return cardExpeditionPower(card);
}

function requiresPackReveal(card) {
  return rarityRank(card?.rarity) >= PACK_FLIP_THRESHOLD;
}

function cardDisplayName(card) {
  return card?.name || '';
}

function refreshIcons() {
  createIcons({ icons: iconSet, attrs: { 'aria-hidden': 'true' } });
}

function showNotice(message, tone = 'neutral') {
  ui.notice = { message, tone };
  render();
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    ui.notice = null;
    render();
  }, 3200);
}

function ownedUniqueCount(state) {
  return CARD_CATALOG.filter((card) => Number(state.collection[card.id]) > 0).length;
}

function totalOwnedCount(state) {
  return Object.values(state.collection).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

function normalizedAuthValue(field) {
  const value = String(ui.auth.form[field] || '');
  return field === 'password' || field === 'passwordConfirm' ? value.normalize('NFC') : value.trim();
}

function authFieldIssue(field) {
  const value = normalizedAuthValue(field);
  if (field === 'username' && !/^[A-Za-z0-9_]{3,24}$/.test(value)) {
    return '영문, 숫자, 밑줄을 사용해 3~24자로 입력해 주세요.';
  }
  if (field === 'nickname' && !/^[가-힣A-Za-z0-9_]{2,12}$/u.test(value)) {
    return '한글, 영문, 숫자, 밑줄을 사용해 2~12자로 입력해 주세요.';
  }
  if (field === 'password' && (value.length < 6 || new TextEncoder().encode(value).byteLength > 72)) {
    return '비밀번호는 6자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.';
  }
  if (field === 'passwordConfirm' && value !== normalizedAuthValue('password')) {
    return '비밀번호 확인이 일치하지 않습니다.';
  }
  return '';
}

function isAvailabilityConfirmed(field) {
  const status = ui.auth.availability[field];
  return Boolean(status?.available && status.checkedValue === normalizedAuthValue(field));
}

function canSubmitSignup() {
  return !ui.auth.pending
    && !authFieldIssue('username')
    && !authFieldIssue('nickname')
    && !authFieldIssue('password')
    && !authFieldIssue('passwordConfirm')
    && isAvailabilityConfirmed('username')
    && isAvailabilityConfirmed('nickname');
}

function renderAuthScreen() {
  const configured = isAuthGatewayConfigured();
  if (ui.auth.phase === 'restoring') {
    return `
      <main class="auth-shell auth-shell--loading">
        <div class="auth-loading-mark">HC</div>
        <span class="eyebrow">PERSONNEL CHECK</span>
        <h1>저장된 사원증을 확인하고 있습니다.</h1>
        <div class="auth-loading-bar" aria-hidden="true"><span></span></div>
      </main>
    `;
  }

  const signup = ui.auth.mode === 'signup';
  const usernameStatus = ui.auth.availability.username;
  const nicknameStatus = ui.auth.availability.nickname;
  return `
    <main class="auth-shell">
      <section class="auth-intro" aria-label="게임 소개">
        <div class="auth-brand"><span>HC</span><div><strong>호이상사 외전</strong><small>월급루팡 카드부</small></div></div>
        <div class="auth-intro-copy">
          <span class="eyebrow">PERSONNEL ARCHIVE</span>
          <h1>당신만의 인물 파일을<br />새 책상에서 이어가세요.</h1>
          <p>카드, 동전, 모험 기록을 클라우드에 안전하게 보관하고 PC와 모바일에서 이어서 플레이합니다.</p>
        </div>
        <div class="auth-security-note"><i data-lucide="lock"></i><span><strong>독립 카드부 계정</strong><small>호이상사 본편 계정 연동은 추후 제공됩니다.</small></span></div>
      </section>

      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-panel-heading">
          <span class="eyebrow">${signup ? 'NEW PERSONNEL' : 'WELCOME BACK'}</span>
          <h2 id="auth-title">${signup ? '카드부 회원가입' : '카드부 로그인'}</h2>
          <p>${signup ? '사용할 사원증 정보를 등록해 주세요.' : '저장된 카드부 기록을 불러옵니다.'}</p>
        </div>
        <div class="auth-server-state ${configured ? 'is-ready' : 'is-error'}">
          <span class="status-dot"></span>
          ${configured ? '로그인 서버 연결 준비 완료' : '로그인 서버 주소가 설정되지 않았습니다.'}
        </div>
        ${signup ? `
          <form class="auth-form" data-form="signup" novalidate>
            <div class="auth-field">
              <label for="signup-username">아이디</label>
              <div class="auth-check-row">
                <input id="signup-username" name="username" value="${escapeHtml(ui.auth.form.username)}" autocomplete="username" maxlength="24" placeholder="영문·숫자·밑줄 3~24자" required />
                <button class="secondary-button" type="button" data-action="check-auth-availability" data-field="username">중복 확인</button>
              </div>
              <small class="auth-field-status ${usernameStatus.available ? 'is-valid' : ''}" data-auth-status="username">${escapeHtml(usernameStatus.message)}</small>
            </div>
            <div class="auth-field">
              <label for="signup-nickname">닉네임</label>
              <div class="auth-check-row">
                <input id="signup-nickname" name="nickname" value="${escapeHtml(ui.auth.form.nickname)}" autocomplete="nickname" maxlength="12" placeholder="게임에 표시할 이름 2~12자" required />
                <button class="secondary-button" type="button" data-action="check-auth-availability" data-field="nickname">중복 확인</button>
              </div>
              <small class="auth-field-status ${nicknameStatus.available ? 'is-valid' : ''}" data-auth-status="nickname">${escapeHtml(nicknameStatus.message)}</small>
            </div>
            <div class="auth-password-grid">
              <div class="auth-field"><label for="signup-password">비밀번호</label><input id="signup-password" name="password" type="password" value="${escapeHtml(ui.auth.form.password)}" autocomplete="new-password" maxlength="72" placeholder="6자 이상" required /></div>
              <div class="auth-field"><label for="signup-password-confirm">비밀번호 확인</label><input id="signup-password-confirm" name="passwordConfirm" type="password" value="${escapeHtml(ui.auth.form.passwordConfirm)}" autocomplete="new-password" maxlength="72" placeholder="한 번 더 입력" required /></div>
            </div>
            <small class="auth-field-status" data-auth-status="password">${escapeHtml(authFieldIssue('password') || authFieldIssue('passwordConfirm'))}</small>
            <p class="auth-form-error" role="alert">${escapeHtml(ui.auth.error)}</p>
            <button class="primary-button auth-submit" type="submit" ${configured && canSubmitSignup() ? '' : 'disabled'}>${ui.auth.pending ? '사원증 발급 중…' : '회원가입하고 시작'}</button>
          </form>
        ` : `
          <form class="auth-form" data-form="login">
            <div class="auth-field"><label for="login-username">아이디</label><input id="login-username" name="username" value="${escapeHtml(ui.auth.form.username)}" autocomplete="username" maxlength="24" required /></div>
            <div class="auth-field"><label for="login-password">비밀번호</label><input id="login-password" name="password" type="password" value="${escapeHtml(ui.auth.form.password)}" autocomplete="current-password" maxlength="72" required /></div>
            <p class="auth-form-error" role="alert">${escapeHtml(ui.auth.error)}</p>
            <button class="primary-button auth-submit" type="submit" ${configured && !ui.auth.pending ? '' : 'disabled'}>${ui.auth.pending ? '사원증 확인 중…' : '로그인'}</button>
          </form>
        `}
        <div class="auth-switch">
          <span>${signup ? '이미 카드부 계정이 있나요?' : '처음 카드부에 오셨나요?'}</span>
          <button type="button" data-action="switch-auth-mode" data-mode="${signup ? 'login' : 'signup'}">${signup ? '로그인으로 돌아가기' : '회원가입'}</button>
        </div>
      </section>
      ${ui.notice ? `<div class="app-notice app-notice--${ui.notice.tone}">${escapeHtml(ui.notice.message)}</div>` : ''}
    </main>
  `;
}

function syncAuthFormControls() {
  if (ui.auth.phase !== 'signedOut') return;
  for (const field of ['username', 'nickname']) {
    const status = ui.auth.availability[field];
    const issue = normalizedAuthValue(field) ? authFieldIssue(field) : '';
    const node = app.querySelector(`[data-auth-status="${field}"]`);
    const button = app.querySelector(`[data-action="check-auth-availability"][data-field="${field}"]`);
    if (node) {
      node.textContent = issue || (status.pending ? '중복 여부를 확인하고 있습니다.' : status.message);
      node.classList.toggle('is-valid', !issue && isAvailabilityConfirmed(field));
      node.classList.toggle('is-error', Boolean(issue || status.message) && !isAvailabilityConfirmed(field));
    }
    if (button) button.disabled = ui.auth.pending || status.pending || Boolean(issue || authFieldIssue(field)) || !isAuthGatewayConfigured();
  }
  const passwordStatus = app.querySelector('[data-auth-status="password"]');
  if (passwordStatus) {
    const issue = authFieldIssue('password') || authFieldIssue('passwordConfirm');
    passwordStatus.textContent = issue;
    passwordStatus.classList.toggle('is-error', Boolean(issue));
  }
  const formError = app.querySelector('.auth-form-error');
  if (formError) formError.textContent = ui.auth.error;
  const signupSubmit = app.querySelector('[data-form="signup"] button[type="submit"]');
  if (signupSubmit) signupSubmit.disabled = !isAuthGatewayConfigured() || !canSubmitSignup();
}

function renderSidebar(state) {
  const nav = Object.entries(views).map(([id, view]) => `
    <button class="nav-button ${ui.view === id ? 'is-active' : ''}" type="button" data-action="navigate" data-view="${id}" aria-label="${view.label}" title="${view.label}">
      <i data-lucide="${view.icon}"></i>
      <span>${view.label}</span>
      ${id === 'dashboard' && state.activeIncident ? '<span class="nav-alert" aria-label="새 돌발 업무"></span>' : ''}
    </button>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">HC</div>
        <div class="brand-copy">
          <strong>호이상사 외전</strong>
          <span>월급루팡 카드부</span>
        </div>
      </div>
      <nav class="primary-nav" aria-label="주 메뉴">${nav}</nav>
      <div class="sidebar-status">
        <span class="status-dot ${ui.cloud.phase === 'active' ? '' : 'is-offline'}"></span>
        <div>
          <strong>${escapeHtml(ui.auth.account?.nickname || state.profile.displayName)}</strong>
          <span>${ui.cloud.phase === 'active' ? `클라우드 연결 · v${escapeHtml(ui.appVersion)}` : '클라우드 연결 확인 중'}</span>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar(state) {
  const current = views[ui.view];
  const updateText = {
    checking: '확인 중',
    available: '새 버전 발견',
    downloading: `받는 중 ${ui.updateStatus?.detail || 0}%`,
    saving: '진행 기록 저장 중',
    'permission-required': '설치 권한 필요',
    installing: '업데이트 적용 중',
    current: '최신 버전',
    development: '개발 버전',
    error: '확인 실패',
  }[ui.updateStatus?.status] || '';

  return `
    <header class="topbar">
      <div class="page-heading">
        <span class="page-kicker">CARD DEPARTMENT</span>
        <h1>${current.label}</h1>
      </div>
      <div class="resource-strip" aria-label="보유 재화">
        <div class="resource-item">
          <i data-lucide="coins"></i>
          <span>사내 동전</span>
          <strong>${formatNumber(state.wallet.coins)}</strong>
        </div>
        <div class="resource-item">
          <i data-lucide="package-open"></i>
          <span>카드팩</span>
          <strong>${formatNumber(state.packs.standard)}</strong>
        </div>
      </div>
      <div class="top-actions">
        <button class="account-button" type="button" data-action="open-settings" title="계정 및 설정">
          <i data-lucide="users"></i>
          <span>${escapeHtml(ui.auth.account?.nickname || state.profile.displayName)}</span>
        </button>
        <button class="icon-button" type="button" data-action="check-update" title="업데이트 확인" aria-label="업데이트 확인">
          <i data-lucide="${ui.updateStatus?.status === 'checking' ? 'refresh-cw' : 'download'}"></i>
        </button>
        <button class="icon-button" type="button" data-action="open-settings" title="설정" aria-label="설정">
          <i data-lucide="settings"></i>
        </button>
        <button class="quiet-button ${state.settings.payrollMode ? 'is-active' : ''}" type="button" data-action="toggle-payroll-mode" aria-pressed="${state.settings.payrollMode ? 'true' : 'false'}">
          <i data-lucide="eye-off"></i>
          <span>월급루팡 모드</span>
        </button>
        ${desktopBridge.isDesktop ? `<button class="quiet-button" type="button" data-action="hide-window">
          <i data-lucide="eye-off"></i>
          <span>자리 비우기</span>
        </button>` : ''}
      </div>
      ${updateText ? `<div class="update-chip" title="${escapeHtml(ui.updateStatus?.message || '')}">${escapeHtml(updateText)}${ui.updateStatus?.downloadUrl && ['available', 'permission-required', 'error'].includes(ui.updateStatus?.status) ? `<button type="button" data-action="download-update">업데이트 받기</button>` : ''}</div>` : ''}
    </header>
  `;
}

function renderDashboard(state) {
  const pack = PACK_DEFINITION.standard;
  const pendingPackOpening = state.pendingPackOpening;
  const featured = [CARD_CATALOG.at(-1), CARD_CATALOG.at(-3), CARD_CATALOG.find((card) => card.rarity === 'sr')];
  const expedition = state.expedition;
  const mission = expedition ? expeditionById(expedition.missionId) : null;
  const progress = expedition ? expeditionProgress(expedition) : 0;
  const recent = state.activity.slice(0, 5);

  return `
    <div class="dashboard-grid">
      <section class="pack-desk" aria-labelledby="pack-title">
        <div class="section-heading">
          <div>
            <span class="eyebrow">TODAY'S FILE</span>
            <h2 id="pack-title">${pack.name}</h2>
          </div>
          <span class="pity-label">${pendingPackOpening ? '미확인 특별 카드가 있습니다' : `SR 이상 확정까지 ${Math.max(1, pack.pityPacks - state.pity.standard)}팩`}</span>
        </div>
        <div class="pack-stage">
          <div class="pack-stack" aria-hidden="true">
            ${featured.map((card, index) => `
              <div class="pack-preview pack-preview--${index + 1}">
                <img src="${card.image}" alt="" />
              </div>
            `).join('')}
            <div class="pack-sleeve">
              <span>HOI COMPANY</span>
              <strong>인물 파일</strong>
              <small>VOL. 2 / 9 RARITIES</small>
            </div>
          </div>
          <div class="pack-actions">
            <div class="pack-count">
              <span>미개봉</span>
              <strong>${formatNumber(state.packs.standard)}<small>팩</small></strong>
            </div>
            <button class="primary-button" type="button" data-action="${pendingPackOpening ? 'resume-pack-opening' : 'open-pack'}" ${!pendingPackOpening && state.packs.standard <= 0 ? 'disabled' : ''}>
              <i data-lucide="${pendingPackOpening ? 'sparkles' : 'package-open'}"></i>
              ${pendingPackOpening ? '미확인 카드 이어보기' : '5장 개봉'}
            </button>
            <button class="secondary-button" type="button" data-action="buy-pack" ${state.wallet.coins < pack.coinPrice ? 'disabled' : ''}>
              <i data-lucide="coins"></i>
              ${formatNumber(pack.coinPrice)} 동전으로 구매
            </button>
          </div>
        </div>
      </section>

      <aside class="daily-ledger" aria-labelledby="ledger-title">
        <div class="section-heading section-heading--compact">
          <div>
            <span class="eyebrow">PERSONNEL FILE</span>
            <h2 id="ledger-title">${escapeHtml(state.profile.displayName)}</h2>
          </div>
          <i data-lucide="briefcase"></i>
        </div>
        <dl class="ledger-list">
          <div><dt>발견 카드</dt><dd>${ownedUniqueCount(state)} / ${CARD_CATALOG.length}</dd></div>
          <div><dt>보유 카드</dt><dd>${totalOwnedCount(state)}장</dd></div>
          <div><dt>해결한 돌발 업무</dt><dd>${formatNumber(state.resolvedIncidents)}건</dd></div>
          <div><dt>호이 연동</dt><dd>추후 제공</dd></div>
        </dl>
        <button class="text-button" type="button" data-action="navigate" data-view="collection">
          인사기록 전체 보기 <i data-lucide="arrow-right"></i>
        </button>
      </aside>
    </div>

    <div class="lower-grid">
      <section class="operation-panel" aria-labelledby="operation-title">
        <div class="section-heading section-heading--compact">
          <div>
            <span class="eyebrow">AUTO EXPEDITION</span>
            <h2 id="operation-title">진행 중인 모험</h2>
          </div>
          <i data-lucide="map"></i>
        </div>
        ${expedition ? `
          <div class="active-operation">
            <div class="operation-copy">
              <strong>${mission.name}</strong>
              <span>${mission.location} · 편성 ${expedition.squad.length}명</span>
            </div>
            <div class="operation-timer" data-countdown="${expedition.endsAt}">${formatDuration(expedition.endsAt - Date.now())}</div>
          </div>
          <div class="progress-track"><span data-expedition-progress style="width:${Math.round(progress * 100)}%"></span></div>
          <button class="text-button" type="button" data-action="navigate" data-view="adventure">
            작전 기록 열기 <i data-lucide="chevron-right"></i>
          </button>
        ` : `
          <div class="empty-operation">
            <i data-lucide="clock"></i>
            <strong>대기 중</strong>
            <span>편성된 카드가 휴게실에서 기다리고 있습니다.</span>
          </div>
          <button class="primary-button primary-button--small" type="button" data-action="navigate" data-view="adventure">
            모험 선택
          </button>
        `}
      </section>

      <section class="incident-panel ${state.activeIncident ? 'has-incident' : ''}" aria-labelledby="incident-title">
        <div class="section-heading section-heading--compact">
          <div>
            <span class="eyebrow">INCOMING</span>
            <h2 id="incident-title">돌발 업무</h2>
          </div>
          <i data-lucide="bell"></i>
        </div>
        ${state.activeIncident ? (() => {
          const incident = incidentById(state.activeIncident.id) || state.activeIncident;
          return `
            <div class="incident-copy">
              <span class="incident-pulse"></span>
              <div>
                <strong>${escapeHtml(incident.title)}</strong>
                <span>${escapeHtml(incident.summary)}</span>
                <span class="incident-expiry" data-incident-countdown="${state.activeIncident.expiresAt}">남은 시간 ${formatDuration(state.activeIncident.expiresAt - Date.now())}</span>
              </div>
            </div>
            <button class="alert-button" type="button" data-action="open-incident">즉시 확인</button>
          `;
        })() : `
          <div class="empty-operation">
            <i data-lucide="wifi"></i>
            <strong>사내망 확인 중</strong>
            <span>12~24분 간격 · 특별한 업무도 기다리고 있어요.</span>
          </div>
        `}
      </section>

      <section class="activity-panel" aria-labelledby="activity-title">
        <div class="section-heading section-heading--compact">
          <div>
            <span class="eyebrow">RECENT LOG</span>
            <h2 id="activity-title">최근 기록</h2>
          </div>
        </div>
        <div class="activity-list">
          ${recent.map((entry) => `
            <div class="activity-row">
              <span class="activity-icon activity-icon--${entry.type}"></span>
              <p>${escapeHtml(entry.message)}</p>
              <time>${formatClock(entry.at)}</time>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderCard(card, count, options = {}) {
  const hidden = !count;
  const selectable = options.selectable && count;
  const selected = options.selected;
  return `
    <article class="collection-card rarity-${card.rarity} ${hidden ? 'is-hidden' : ''} ${selected ? 'is-selected' : ''}">
      <button class="card-hitbox" type="button" data-action="${selectable ? 'toggle-squad' : 'open-card'}" data-card-id="${card.id}" ${hidden ? 'disabled' : ''}>
        <div class="card-art">
          <img src="${card.image}" alt="${hidden ? '미발견 카드' : escapeHtml(cardDisplayName(card))}" loading="lazy" />
          <span class="rarity-stamp">${hidden ? '???' : rarityLabel(card.rarity)}</span>
          ${hidden ? '' : `<span class="card-power">전투력 ${formatNumber(cardPower(card))}</span>`}
          ${selected ? '<span class="selection-check"><i data-lucide="check"></i></span>' : ''}
        </div>
        <div class="card-copy">
          <span>${hidden ? '미발견' : escapeHtml(card.department)}</span>
          <strong>${hidden ? '기록 없음' : escapeHtml(cardDisplayName(card))}</strong>
          <small>${hidden ? '카드팩에서 발견할 수 있습니다.' : `${escapeHtml(card.category)} · ${formatNumber(count)}장 보유`}</small>
        </div>
        <div class="card-stats" aria-label="카드 능력치">
          <span><b>업무</b>${hidden ? '-' : card.stats.work}</span>
          <span><b>눈치</b>${hidden ? '-' : card.stats.sense}</span>
          <span><b>멘탈</b>${hidden ? '-' : card.stats.grit}</span>
          <span><b>행운</b>${hidden ? '-' : card.stats.luck}</span>
        </div>
      </button>
    </article>
  `;
}

function renderCollection(state) {
  const query = ui.collectionQuery.trim().toLowerCase();
  const cards = CARD_CATALOG.filter((card) => {
    if (ui.rarityFilter !== 'all' && card.rarity !== ui.rarityFilter) return false;
    if (!query) return true;
    return `${card.name} ${card.department} ${card.category}`.toLowerCase().includes(query);
  });

  return `
    <section class="collection-header">
      <div>
        <span class="eyebrow">ARCHIVE ${ownedUniqueCount(state).toString().padStart(2, '0')} / ${CARD_CATALOG.length.toString().padStart(2, '0')}</span>
        <h2>사내 인물 도감</h2>
        <p>발견한 카드의 기록과 능력치를 열람합니다.</p>
      </div>
      <div class="collection-progress" aria-label="도감 완성도">
        <strong>${Math.round((ownedUniqueCount(state) / CARD_CATALOG.length) * 100)}%</strong>
        <span>수집률</span>
      </div>
    </section>
    <div class="filter-bar">
      <form class="search-field" data-form="collection-search">
        <i data-lucide="search"></i>
        <input name="query" value="${escapeHtml(ui.collectionQuery)}" placeholder="이름 또는 부서 검색" autocomplete="off" />
      </form>
      <div class="segmented-control" role="group" aria-label="등급 필터">
        ${[['all', '전체'], ...RARITY_ORDER.map((rarity) => [rarity, RARITY_META[rarity].label])].map(([value, label]) => `
          <button type="button" class="${ui.rarityFilter === value ? 'is-active' : ''}" data-action="filter-rarity" data-rarity="${value}">${label}</button>
        `).join('')}
      </div>
    </div>
    <div class="collection-grid">
      ${cards.length
        ? cards.map((card) => renderCard(card, state.collection[card.id] || 0)).join('')
        : '<div class="empty-results"><i data-lucide="search"></i><strong>조건에 맞는 기록이 없습니다.</strong></div>'}
    </div>
  `;
}

function renderSquadPicker(state, context) {
  const ownedCards = ALL_CARDS.filter((card) => state.collection[card.id]);
  const selectedIds = context === 'raid'
    ? (state.selectedRaidSquad || [])
    : (state.selectedExpeditionSquad || state.selectedSquad || []);
  const unavailableIds = context === 'raid' ? new Set(state.expedition?.squad || []) : new Set();
  return `
    <div class="squad-picker" data-context="${context}">
      ${ownedCards.map((card) => {
        const selected = selectedIds.includes(card.id);
        const unavailable = unavailableIds.has(card.id);
        return `
          <button class="squad-card ${selected ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}" type="button" data-action="toggle-squad" data-context="${context}" data-card-id="${card.id}" ${unavailable ? 'disabled' : ''} aria-pressed="${selected ? 'true' : 'false'}">
            <img src="${card.image}" alt="" />
            <span><strong>${escapeHtml(cardDisplayName(card))}</strong><small><b>${rarityLabel(card.rarity)}</b><span class="squad-detail-copy">${unavailable ? ' · 모험 참여 중 · 레이드 사용 불가' : ` · 전투력 ${formatNumber(cardPower(card))}`}</span></small></span>
            <i data-lucide="${unavailable ? 'lock' : (selected ? 'check' : 'users')}"></i>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function missionMinimumPower(mission) {
  return Math.max(0, Number(mission?.minimumPower ?? mission?.recommendedScore) || 0);
}

function renderAdventure(state) {
  const active = state.expedition;
  const activeMission = active ? expeditionById(active.missionId) : null;
  const selectedMission = expeditionById(ui.selectedMissionId) || EXPEDITIONS[0];
  const expeditionSquad = state.selectedExpeditionSquad || state.selectedSquad || [];
  const score = calculateSquadScore(expeditionSquad, state.collection, ALL_CARDS);
  const minimumPower = missionMinimumPower(selectedMission);
  const canStart = expeditionSquad.length >= selectedMission.requiredCards && score >= minimumPower;
  const actionMission = active ? activeMission : selectedMission;
  const actionScore = active ? expeditionEffectivePower(active) : score;
  const actionMinimumPower = missionMinimumPower(actionMission);

  return `
    <div class="adventure-layout">
      <section class="mission-board" aria-labelledby="mission-title">
        <div class="section-heading">
          <div><span class="eyebrow">FIELD ASSIGNMENT</span><h2 id="mission-title">모험 목록</h2></div>
          <div class="board-rules">
            <span class="board-rule">현재 진행중인 모험 ${active ? 1 : 0}개</span>
            <span class="board-rule">현재 동시 진행 가능 모험 1회</span>
          </div>
        </div>
        <div class="adventure-start-bar">
          <div class="adventure-start-summary">
            <span>${active ? '현재 진행 중' : '선택한 모험'}</span>
            <strong>${escapeHtml(actionMission.name)}</strong>
            <small>합산 전투력 ${formatNumber(actionScore)} / 최소 ${formatNumber(actionMinimumPower)}</small>
          </div>
          <button class="primary-button assignment-submit" type="button" data-action="start-expedition" ${active || !canStart ? 'disabled' : ''}>
            <i data-lucide="map"></i>
            ${active ? '모험 진행 중' : '자동 모험 시작'}
          </button>
        </div>
        <div class="mission-list">
          ${EXPEDITIONS.map((mission) => `
            <button type="button" class="mission-row ${ui.selectedMissionId === mission.id ? 'is-selected' : ''}" data-action="select-mission" data-mission-id="${mission.id}" ${active ? 'disabled' : ''}>
              <span class="mission-index">${String(EXPEDITIONS.indexOf(mission) + 1).padStart(2, '0')}</span>
              <span class="mission-copy"><strong>${mission.name}</strong><small>${mission.location}</small></span>
              <span class="mission-meta"><b>${formatDuration(mission.durationMs)}</b><small>최소 합산 ${formatNumber(missionMinimumPower(mission))}</small></span>
              <i data-lucide="chevron-right"></i>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="assignment-sheet" aria-labelledby="assignment-title">
        ${active ? `
          <div class="operation-banner">
            <div><span class="eyebrow">IN PROGRESS</span><h2>${activeMission.name}</h2></div>
            <div class="large-countdown" data-countdown="${active.endsAt}">${formatDuration(active.endsAt - Date.now())}</div>
          </div>
          <p class="assignment-description">${activeMission.description}</p>
          <div class="progress-track progress-track--large"><span data-expedition-progress style="width:${Math.round(expeditionProgress(active) * 100)}%"></span></div>
          <div class="deployed-squad">
            ${active.squad.map((id) => {
              const card = cardById(id);
              return `<div><img src="${card.image}" alt="" /><span>${escapeHtml(card.name)}</span><small>${rarityLabel(card.rarity)}</small></div>`;
            }).join('')}
          </div>
          <button class="danger-text-button" type="button" data-action="cancel-expedition">작전 중단</button>
        ` : `
          <div class="operation-banner">
            <div><span class="eyebrow">ASSIGNMENT</span><h2 id="assignment-title">${selectedMission.name}</h2></div>
            <div class="mission-duration"><i data-lucide="clock"></i>${formatDuration(selectedMission.durationMs)}</div>
          </div>
          <p class="assignment-description">${selectedMission.description}</p>
          <div class="requirement-row">
            <span>합산 전투력 <strong class="${score >= minimumPower ? 'positive' : 'negative'}">${formatNumber(score)}</strong></span>
            <span>최소 합산 전투력 <strong>${formatNumber(minimumPower)}</strong></span>
            <span>최소 카드 <strong>${selectedMission.requiredCards}장</strong></span>
          </div>
          <div class="mission-reward-preview">
            <span><i data-lucide="coins"></i><small>기본 동전 범위</small><strong>${formatNumber(selectedMission.reward.coins[0])}~${formatNumber(selectedMission.reward.coins[1])}</strong></span>
            <span><i data-lucide="package-open"></i><small>카드팩 발견 확률</small><strong>${Math.round(selectedMission.reward.packChance * 1000) / 10}%</strong></span>
            <p>모험은 항상 완료되며 최소 ${formatNumber(selectedMission.reward.coins[0])} 동전을 보장합니다. 실제 보상은 매번 변동하고, 최소 전투력을 넘긴 정도에 따라 최대 ${Math.round((selectedMission.reward.powerBonusCap || 0.35) * 100)}% 증가합니다.</p>
          </div>
          ${score < minimumPower ? `<p class="requirement-warning"><i data-lucide="circle-alert"></i>최소 합산 전투력까지 ${formatNumber(minimumPower - score)}이 더 필요합니다.</p>` : ''}
          <div class="subheading"><h3>파견 카드</h3><span>${expeditionSquad.length} / 3</span></div>
          ${renderSquadPicker(state, 'adventure')}
        `}
      </section>
    </div>
  `;
}

function renderRaidModeTabs() {
  return `
    <div class="raid-mode-tabs" role="tablist" aria-label="레이드 종류">
      <button type="button" role="tab" aria-selected="${ui.raidMode === 'personal'}" class="${ui.raidMode === 'personal' ? 'is-active' : ''}" data-action="switch-raid-mode" data-raid-mode="personal">
        <i data-lucide="swords"></i><span><strong>개인 레이드</strong><small>내 카드로 매일 도전</small></span>
      </button>
      <button type="button" role="tab" aria-selected="${ui.raidMode === 'cooperative'}" class="${ui.raidMode === 'cooperative' ? 'is-active' : ''}" data-action="switch-raid-mode" data-raid-mode="cooperative">
        <i data-lucide="users"></i><span><strong>협동 레이드</strong><small>실시간 파티 · 추후 구현</small></span>
      </button>
    </div>
  `;
}

function renderCooperativeRaid() {
  return `
    <section class="coop-raid-placeholder" aria-labelledby="coop-raid-title">
      <div class="coop-raid-symbol"><i data-lucide="users"></i></div>
      <span class="eyebrow">REAL-TIME PARTY RAID</span>
      <h2 id="coop-raid-title">협동 레이드 준비 중</h2>
      <p>다른 사원들과 실시간 파티를 만들고 함께 보스를 공략하는 모드입니다. 파티 매칭과 동기화 서버를 갖춘 뒤 제공됩니다.</p>
      <div class="coop-feature-list">
        <span><i data-lucide="wifi"></i>실시간 파티 입장</span>
        <span><i data-lucide="users"></i>공동 기여도 집계</span>
        <span><i data-lucide="trophy"></i>파티 보상</span>
      </div>
      <button class="secondary-button" type="button" disabled>추후 업데이트 예정</button>
    </section>
  `;
}

function renderPersonalRaidRanking(state) {
  const ranking = ui.raid.ranking || { entries: [], myRank: null, resetsAt: state.raid?.resetsAt || 0 };
  const entries = ranking.entries || [];
  const resetsAt = Number(ranking.resetsAt || state.raid?.resetsAt) || 0;
  return `
    <section class="contribution-table raid-ranking-panel" aria-labelledby="contribution-title">
      <div class="section-heading section-heading--compact">
        <div><span class="eyebrow">DAILY CONTRIBUTION</span><h2 id="contribution-title">오늘의 개인 합산 기여도</h2></div>
        <button class="icon-button" type="button" data-action="refresh-raid-ranking" title="랭킹 새로고침" aria-label="랭킹 새로고침" ${ui.raid.loading ? 'disabled' : ''}><i data-lucide="refresh-cw"></i></button>
      </div>
      <div class="ranking-reset-line">
        <span>매일 대한민국 시간 00:00 초기화</span>
        ${resetsAt ? `<strong>초기화까지 <span data-countdown="${resetsAt}">${formatDuration(resetsAt - Date.now())}</span></strong>` : ''}
      </div>
      <div class="table-row table-head"><span>순위</span><span>사원</span><span>클리어</span><span>합산 기여도</span></div>
      ${entries.length ? entries.map((entry) => `
        <div class="table-row ${entry.isMe ? 'is-me' : ''}">
          <span>${formatNumber(entry.rank)}</span>
          <span>${escapeHtml(entry.nickname)}</span>
          <span>${formatNumber(entry.clears)}회</span>
          <strong>${formatNumber(entry.contribution)}</strong>
        </div>
      `).join('') : `
        <div class="ranking-empty"><i data-lucide="trophy"></i><strong>오늘 기록된 기여도가 없습니다.</strong><span>개인 레이드에 파견하면 즉시 순위에 반영됩니다.</span></div>
      `}
      ${ranking.myRank ? `<div class="my-ranking-summary"><span>내 현재 순위</span><strong>${formatNumber(ranking.myRank)}위</strong></div>` : ''}
      ${ui.raid.error ? `<p class="raid-sync-error"><i data-lucide="circle-alert"></i>${escapeHtml(ui.raid.error)}</p>` : ''}
    </section>
  `;
}

function renderPersonalRaidBattle(state) {
  const raid = state.raid || createRaidState(RAID_DEFINITION);
  const selectedRaidSquad = availableRaidSquad(state.selectedRaidSquad, state.expedition);
  const score = calculateSquadScore(selectedRaidSquad, state.collection, ALL_CARDS);
  const maxHp = Math.max(1, Number(raid.maxHp) || RAID_DEFINITION.maxHp);
  const hp = Math.min(maxHp, Math.max(0, Number(raid.hp) || 0));
  const hpRatio = Math.max(0, hp / maxHp);
  const cooldownMs = Math.max(0, Number(raid.cooldownMs) || RAID_DEFINITION.dispatchCooldownMs);
  const cooldownEndsAt = Math.max(0, Number(raid.lastDispatchAt) || 0) + cooldownMs;
  const cooldown = Math.max(0, cooldownEndsAt - Date.now());
  const clears = Math.max(0, Number(raid.clears) || 0);
  const maxClears = Math.max(1, Number(raid.maxClears) || RAID_DEFINITION.maxDailyClears || 2);
  const dailyLocked = clears >= maxClears;
  const online = !ui.auth.offline && isRaidGatewayConfigured();
  const dispatchDisabled = !online || !selectedRaidSquad.length || cooldown > 0 || dailyLocked || ui.raid.dispatching;
  const boss = cardById('deadline-dragon');
  const resetsAt = Number(raid.resetsAt) || 0;

  return `
    <div class="raid-layout">
      <section class="raid-stage" aria-labelledby="raid-title">
        <div class="raid-art">
          <img src="${boss.image}" alt="${escapeHtml(RAID_DEFINITION.name)}" />
          <div class="raid-vignette"></div>
          <div class="raid-heading">
            <span>개인 도전 · 일일 최대 ${maxClears}회 클리어</span>
            <h2 id="raid-title">${RAID_DEFINITION.name}</h2>
          </div>
        </div>
        <div class="raid-dispatch-bar">
          <div class="raid-power"><span>선택 카드 합산 전투력</span><strong>${formatNumber(score)}</strong></div>
          <button class="alert-button raid-dispatch" type="button" data-action="dispatch-raid" ${dispatchDisabled ? 'disabled' : ''}>
            <i data-lucide="zap"></i>
            ${ui.raid.dispatching
              ? '파견 처리 중'
              : dailyLocked
                ? '오늘의 클리어 제한 도달'
                : cooldown > 0
                  ? `<span data-raid-cooldown="${cooldownEndsAt}">재정비 ${Math.ceil(cooldown / 1000)}초</span>`
                  : '개인 레이드 파견'}
          </button>
        </div>
        <div class="boss-health">
          <div><span>잔여 업무량</span><strong>${formatNumber(hp)} / ${formatNumber(maxHp)}</strong></div>
          <div class="boss-health-track"><span style="width:${Math.round(hpRatio * 100)}%"></span></div>
        </div>
        <div class="raid-stats">
          <div><span>오늘의 합산 기여</span><strong>${formatNumber(raid.totalContribution ?? raid.contribution)}</strong></div>
          <div><span>오늘의 클리어</span><strong>${formatNumber(clears)} / ${formatNumber(maxClears)}</strong></div>
          <div><span>일일 초기화</span><strong>${resetsAt ? `<span data-countdown="${resetsAt}">${formatDuration(resetsAt - Date.now())}</span>` : '매일 00:00'}</strong></div>
        </div>
        ${!online ? '<p class="raid-sync-error"><i data-lucide="wifi"></i>개인 레이드와 실시간 랭킹은 온라인 연결이 필요합니다.</p>' : ''}
        ${ui.raid.error ? `<p class="raid-sync-error"><i data-lucide="circle-alert"></i>${escapeHtml(ui.raid.error)}</p>` : ''}
      </section>

      <aside class="raid-command">
        <div class="section-heading section-heading--compact">
          <div><span class="eyebrow">STRIKE TEAM</span><h2>파견 카드 선택</h2></div>
          <span>${selectedRaidSquad.length} / 3</span>
        </div>
        ${state.expedition ? `<p class="local-operation-note"><i data-lucide="lock"></i>모험에 참여 중인 ${state.expedition.squad.length}장의 카드는 레이드에 편성할 수 없습니다.</p>` : ''}
        ${renderSquadPicker(state, 'raid')}
        <p class="local-operation-note"><i data-lucide="wifi"></i>기여도와 순위는 서버에 실시간으로 저장됩니다.</p>
      </aside>
    </div>
  `;
}

function renderRaid(state) {
  return `
    <section class="raid-page">
      ${renderRaidModeTabs()}
      ${ui.raidMode === 'cooperative' ? renderCooperativeRaid() : `
        <div class="raid-tab-list" role="tablist" aria-label="개인 레이드 메뉴">
          <button type="button" role="tab" aria-selected="${ui.raidPanel === 'battle'}" class="${ui.raidPanel === 'battle' ? 'is-active' : ''}" data-action="switch-raid-panel" data-raid-panel="battle">레이드 진행</button>
          <button type="button" role="tab" aria-selected="${ui.raidPanel === 'ranking'}" class="${ui.raidPanel === 'ranking' ? 'is-active' : ''}" data-action="switch-raid-panel" data-raid-panel="ranking">오늘의 랭킹</button>
        </div>
        ${ui.raidPanel === 'ranking' ? renderPersonalRaidRanking(state) : renderPersonalRaidBattle(state)}
      `}
    </section>
  `;
}

function renderLink(state) {
  const account = ui.auth.account;
  return `
    <div class="link-layout">
      <section class="link-sheet" aria-labelledby="link-title">
        <div class="link-symbol"><span>HC</span><i data-lucide="link-2"></i><span>CD</span></div>
        <span class="eyebrow">COMING LATER</span>
        <h2 id="link-title">호이상사 계정 연동</h2>
        <p>호이상사 본편 캐릭터와 카드부 계정을 연결하는 기능은 추후 업데이트에서 제공됩니다.</p>
        <div class="link-coming-soon">
          <i data-lucide="lock"></i>
          <span><small>현재 상태</small><strong>연동 준비 중</strong><em>지금은 카드부 계정만으로 모든 콘텐츠를 이용할 수 있습니다.</em></span>
        </div>
      </section>
      <aside class="benefit-ledger">
        <div class="section-heading section-heading--compact"><div><span class="eyebrow">CARD DESK ACCOUNT</span><h2>현재 카드부 계정</h2></div></div>
        <div class="account-summary-card"><i data-lucide="users"></i><span><strong>${escapeHtml(account?.nickname || state.profile.displayName)}</strong><small>@${escapeHtml(account?.username || '')}</small></span><b>${ui.auth.offline ? '오프라인' : '온라인'}</b></div>
        <div class="benefit-row"><i data-lucide="trophy"></i><span><strong>컬렉션 진행</strong><small>이 계정 전용 로컬 기록</small></span><b>${ownedUniqueCount(state)} / ${CARD_CATALOG.length}</b></div>
        <div class="sync-boundary"><i data-lucide="lock"></i><span><strong>계정별 분리 저장</strong><small>다른 카드부 계정으로 로그인하면 해당 계정의 기록을 따로 불러옵니다.</small></span></div>
        <button class="secondary-button account-logout-button" type="button" data-action="logout">로그아웃</button>
      </aside>
    </div>
  `;
}

function renderCurrentView(state) {
  if (ui.view === 'collection') return renderCollection(state);
  if (ui.view === 'adventure') return renderAdventure(state);
  if (ui.view === 'raid') return renderRaid(state);
  if (ui.view === 'link') return renderLink(state);
  return renderDashboard(state);
}

function renderPackModal(cards, pityTriggered, state, modal) {
  const pack = PACK_DEFINITION.standard;
  const hasPack = state.packs.standard > 0;
  const canBuy = state.wallet.coins >= pack.coinPrice;
  const highest = modal.highestRarity || highestRarity(cards);
  const premiumPack = rarityRank(highest) >= PACK_FLIP_THRESHOLD;
  const revealedCards = new Set(modal.revealedCards || []);
  const unrevealedCount = cards.reduce((count, card, index) => (
    count + (premiumPack && requiresPackReveal(card) && !revealedCards.has(index) ? 1 : 0)
  ), 0);
  return `
    <div class="modal-backdrop pack-backdrop rarity-${highest}" data-action="close-modal">
      <section class="modal-sheet pack-opening-modal" role="dialog" aria-modal="true" aria-labelledby="pack-result-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <div class="modal-heading"><span class="eyebrow">PERSONNEL DISCOVERED</span><h2 id="pack-result-title">인물 파일 개봉 결과</h2><p>${premiumPack ? `${rarityLabel(highest)} 카드가 포함되어 특수 공개 연출을 시작합니다.` : (pityTriggered ? '누적 보장으로 SR 등급 이상을 발견했습니다.' : '새 카드가 인사기록에 등록되었습니다.')}</p></div>
        ${premiumPack ? `<div class="pack-reveal-hint"><i data-lucide="sparkles"></i><span>빛나는 카드만 눌러 뒤집어 확인하세요 · 이번 팩 최고 등급 ${rarityLabel(highest)}</span></div>` : ''}
        <div class="pack-result-grid">
          ${cards.map((card, index) => {
            const gated = premiumPack && rarityRank(card.rarity) >= PACK_FLIP_THRESHOLD;
            const faceDown = gated && !revealedCards.has(index);
            const revealClass = gated ? (faceDown ? 'is-face-down' : 'is-revealed') : '';
            return `
            <article class="result-card rarity-${card.rarity} ${revealClass}" style="--reveal-delay:${index * 90}ms">
              <div class="result-card__art ${revealClass}">
                ${faceDown ? `<button class="result-card__reveal" type="button" data-action="reveal-pack-card" data-opening-id="${escapeHtml(modal.openingId || '')}" data-card-index="${index}" aria-label="${rarityLabel(card.rarity)} 카드 뒤집기"><span class="card-back-mark">HC</span><strong>카드 봉인</strong><small>눌러서 공개</small></button>` : `<img src="${card.image}" alt="${escapeHtml(cardDisplayName(card))}" /><span>${rarityLabel(card.rarity)}</span><b class="card-power">전투력 ${formatNumber(cardPower(card))}</b>`}
              </div>
              <div class="result-card__copy">${faceDown ? '<small>특수 공개 대기</small><strong>잠긴 카드</strong><span>카드를 눌러 내용을 확인하세요.</span>' : `<small>${escapeHtml(card.department)}</small><strong>${escapeHtml(cardDisplayName(card))}</strong><span>${escapeHtml(card.trait)}</span>`}</div>
            </article>
          `; }).join('')}
        </div>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-action="navigate-from-modal" data-view="collection">도감 보기</button>
          ${unrevealedCount > 0 ? `
            <button class="primary-button" type="button" disabled>봉인 카드 ${formatNumber(unrevealedCount)}장 먼저 공개</button>
          ` : hasPack ? `
            <button class="primary-button" type="button" data-action="open-another-pack">한 팩 더 개봉 · ${formatNumber(state.packs.standard)}팩 보유</button>
          ` : `
            <button class="secondary-button" type="button" disabled>미개봉 카드팩 없음</button>
            <button class="primary-button" type="button" data-action="buy-and-open-pack" ${canBuy ? '' : 'disabled'}>
              ${canBuy ? `${formatNumber(pack.coinPrice)} 동전으로 구매 후 개봉` : `동전 부족 · ${formatNumber(pack.coinPrice)} 필요`}
            </button>
          `}
        </div>
      </section>
    </div>
  `;
}

function renderCardModal(card, state) {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet card-detail-modal rarity-${card.rarity}" role="dialog" aria-modal="true" aria-labelledby="card-detail-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <div class="detail-card-art"><img src="${card.image}" alt="${escapeHtml(cardDisplayName(card))}" /><span>${rarityLabel(card.rarity)}</span><b class="card-power">전투력 ${formatNumber(cardPower(card))}</b></div>
        <div class="detail-card-copy">
          <span class="eyebrow">${escapeHtml(card.department)} / ${escapeHtml(card.category)}</span>
          <h2 id="card-detail-title">${escapeHtml(cardDisplayName(card))}</h2>
          <p>${escapeHtml(card.flavor)}</p>
          <div class="detail-stats">
            <div><span>업무력</span><strong>${card.stats.work}</strong></div>
            <div><span>눈치</span><strong>${card.stats.sense}</strong></div>
            <div><span>멘탈</span><strong>${card.stats.grit}</strong></div>
            <div><span>행운</span><strong>${card.stats.luck}</strong></div>
          </div>
          <div class="trait-box"><i data-lucide="sparkles"></i><span><strong>${escapeHtml(card.trait)}</strong><small>${escapeHtml(card.traitText)}</small></span></div>
          <div class="owned-line">보유 수량 <strong>${formatNumber(state.collection[card.id])}장</strong></div>
        </div>
      </section>
    </div>
  `;
}

function renderIncidentModal(incident) {
  const tierLabel = incident.tier === 'mythic' ? 'MYTHIC INCIDENT' : incident.tier === 'special' ? 'SPECIAL INCIDENT' : 'RANDOM INCIDENT';
  return `
    <div class="modal-backdrop modal-backdrop--incident">
      <section class="modal-sheet incident-modal" role="dialog" aria-modal="true" aria-labelledby="incident-modal-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="나중에 확인"><i data-lucide="x"></i></button>
        <div class="incident-symbol"><i data-lucide="bell"></i></div>
        <span class="eyebrow">${tierLabel}</span>
        <h2 id="incident-modal-title">${escapeHtml(incident.title)}</h2>
        <p>${escapeHtml(incident.summary)}</p>
        <div class="incident-choices">
          ${incident.choices.map((choice) => `
            <button type="button" data-action="resolve-incident" data-choice-id="${choice.id}">
              <span>${escapeHtml(choice.label)}</span><i data-lucide="arrow-right"></i>
            </button>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderResultModal(result, state) {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet compact-modal" role="dialog" aria-modal="true" aria-labelledby="result-title" data-modal-panel>
        <div class="result-symbol"><i data-lucide="check"></i></div>
        <span class="eyebrow">TASK COMPLETE</span>
        <h2 id="result-title">처리 완료</h2>
        <p>${escapeHtml(result.message)}</p>
        <div class="reward-line">${result.rewardText}</div>
        ${state.pendingPackOpening ? `
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-action="close-modal">나중에 확인</button>
            <button class="primary-button" type="button" data-action="resume-pack-opening">미확인 카드 계속 보기</button>
          </div>
        ` : '<button class="primary-button" type="button" data-action="close-modal">확인</button>'}
      </section>
    </div>
  `;
}

function renderSettingsModal(state) {
  const account = ui.auth.account;
  const notificationLabel = desktopBridge.isDesktop ? '데스크톱 팝업 알림' : '모바일 알림';
  const desktopOnlySettings = desktopBridge.isDesktop
    ? `<label class="toggle-row"><span><strong>은밀 근무 모드</strong><small>창 닫기 시 앱을 종료하지 않고 숨깁니다.</small></span><input type="checkbox" data-action="toggle-discreet" ${state.settings.discreetMode ? 'checked' : ''} /><i></i></label>`
    : '';
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <span class="eyebrow">PREFERENCES</span><h2 id="settings-title">설정</h2>
        <div class="settings-account">
          <i data-lucide="users"></i>
          <span><strong>${escapeHtml(account?.nickname || state.profile.displayName)}</strong><small>@${escapeHtml(account?.username || '')} · ${ui.cloud.phase === 'active' ? '클라우드 연결됨' : '연결 확인 중'}</small></span>
          <button class="secondary-button" type="button" data-action="logout">로그아웃</button>
        </div>
        <label class="toggle-row"><span><strong>${notificationLabel}</strong><small>꺼도 돌발 업무는 계속 발생하며 업무판에서 10분간 유지됩니다.</small></span><input type="checkbox" data-action="toggle-notifications" ${state.settings.incidentNotifications ? 'checked' : ''} /><i></i></label>
        ${desktopOnlySettings}
        <label class="toggle-row"><span><strong>월급루팡 모드</strong><small>모든 카드 일러스트를 가리고 카드 이름과 등급만 표시합니다.</small></span><input type="checkbox" data-action="toggle-payroll-mode" ${state.settings.payrollMode ? 'checked' : ''} /><i></i></label>
        ${ui.updateStatus?.downloadUrl ? '<button class="primary-button settings-update-button" type="button" data-action="download-update">새 Android 버전 받기</button>' : ''}
        <div class="settings-footer"><span>버전 ${escapeHtml(ui.appVersion)}</span><button class="danger-text-button" type="button" data-action="reset-progress">클라우드 진행 기록 초기화</button></div>
      </section>
    </div>
  `;
}

function renderModal(state) {
  if (!ui.modal) return '';
  if (ui.modal.type === 'pack') return renderPackModal(ui.modal.cards, ui.modal.pityTriggered, state, ui.modal);
  if (ui.modal.type === 'card') return renderCardModal(cardById(ui.modal.cardId), state);
  if (ui.modal.type === 'incident') return renderIncidentModal(ui.modal.incident);
  if (ui.modal.type === 'result') return renderResultModal(ui.modal, state);
  if (ui.modal.type === 'settings') return renderSettingsModal(state);
  return '';
}

function renderCloudGate() {
  const phase = ui.cloud.phase;
  if (phase === 'active' || phase === 'idle' || phase === 'released') return '';

  let eyebrow = 'CLOUD ARCHIVE';
  let title = '클라우드 기록을 불러오는 중이에요.';
  let description = 'PC와 모바일에서 같은 진행 상황을 이어가기 위해 서버 기록을 확인하고 있습니다.';
  let action = '';

  if (phase === 'playing-elsewhere') {
    const otherPlatform = platformLabel(ui.cloud.activePlatform);
    eyebrow = 'PLAY SESSION MOVED';
    title = `${otherPlatform}로 플레이 중이에요!`;
    description = '게임 진행은 한 기기에서만 가능합니다. 이 기기에서 계속하면 다른 기기의 게임 화면이 잠깁니다.';
    action = '<button class="primary-button" type="button" data-action="cloud-takeover">다시 여기서 플레이하기</button>';
  } else if (phase === 'migration-required') {
    eyebrow = 'CLOUD SAVE MIGRATION';
    title = '기존 PC 기록을 먼저 옮겨주세요.';
    description = '최신 PC 버전으로 한 번 로그인하면 현재 카드와 재화가 클라우드에 저장됩니다. 그다음 모바일에서 그대로 이어갈 수 있습니다.';
    action = '<button class="secondary-button" type="button" data-action="cloud-retry">다시 확인</button>';
  } else if (phase === 'save-conflict') {
    eyebrow = 'SAVE RECORD CHECK';
    title = '서로 다른 진행 기록 두 개를 발견했어요.';
    description = '앱이 종료되기 전에 남은 이 기기의 기록과 서버 기록이 모두 보존되어 있습니다. 이어서 사용할 기록을 골라 주세요.';
    action = `
      <div class="cloud-conflict-actions">
        <button class="primary-button" type="button" data-action="cloud-conflict-local">이 기기 기록 이어쓰기</button>
        <button class="secondary-button" type="button" data-action="cloud-conflict-server">서버 기록 불러오기</button>
      </div>`;
  } else if (phase === 'connection-error') {
    eyebrow = 'CONNECTION PAUSED';
    title = '게임 서버와 연결이 끊어졌어요.';
    description = '기록 충돌을 막기 위해 연결이 복구될 때까지 게임 화면을 잠시 가렸습니다.';
    action = '<button class="primary-button" type="button" data-action="cloud-retry">다시 연결</button>';
  } else if (phase === 'taking-over') {
    eyebrow = 'MOVING PLAY SESSION';
    title = '이 기기로 플레이를 옮기고 있어요.';
    description = '최신 진행 기록을 불러오면 바로 이어서 플레이할 수 있습니다.';
  } else if (phase === 'releasing' || phase === 'updating') {
    eyebrow = 'SAVING TO CLOUD';
    title = phase === 'updating' ? '업데이트 파일을 여는 중이에요.' : '클라우드 기록을 저장하고 있어요.';
    description = '저장이 끝날 때까지 잠시만 기다려 주세요.';
  }

  return `
    <section class="cloud-session-gate" role="dialog" aria-modal="true" aria-live="assertive">
      <div class="cloud-session-card">
        <div class="cloud-session-mark" aria-hidden="true"><i data-lucide="wifi"></i></div>
        <span class="eyebrow">${eyebrow}</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
        ${ui.cloud.message && phase === 'connection-error' ? `<small>${escapeHtml(ui.cloud.message)}</small>` : ''}
        ${action || '<div class="cloud-session-loader" aria-hidden="true"><span></span></div>'}
        <button class="cloud-session-logout" type="button" data-action="logout">로그아웃</button>
      </div>
    </section>
  `;
}

function render({ preserveViewScroll = ui.renderedView === ui.view } = {}) {
  const currentViewHost = preserveViewScroll ? app.querySelector('.view-host') : null;
  const savedViewScroll = currentViewHost
    ? { top: currentViewHost.scrollTop, left: currentViewHost.scrollLeft }
    : null;
  if (ui.auth.phase !== 'authenticated' || !store) {
    ui.renderedView = null;
    app.innerHTML = renderAuthScreen();
    refreshIcons();
    syncAuthFormControls();
    return;
  }
  const state = store.getState();
  app.innerHTML = `
    <div class="app-shell ${state.settings.payrollMode ? 'payroll-mode' : ''}" data-payroll-mode="${state.settings.payrollMode ? 'true' : 'false'}">
      ${renderSidebar(state)}
      <main class="main-shell">
        ${renderTopbar(state)}
        <div class="view-host">${renderCurrentView(state)}</div>
      </main>
      ${ui.notice ? `<div class="app-notice app-notice--${ui.notice.tone}">${escapeHtml(ui.notice.message)}</div>` : ''}
      ${renderModal(state)}
      ${renderCloudGate()}
    </div>
  `;
  ui.renderedView = ui.view;
  refreshIcons();
  if (savedViewScroll) {
    const nextViewHost = app.querySelector('.view-host');
    if (nextViewHost) {
      nextViewHost.scrollTop = savedViewScroll.top;
      nextViewHost.scrollLeft = savedViewScroll.left;
    }
  }
}

function rewardText(reward = {}) {
  const parts = [];
  if (reward.coins) parts.push(`<span><i data-lucide="coins"></i>${formatNumber(reward.coins)} 동전</span>`);
  if (reward.packs) parts.push(`<span><i data-lucide="package-open"></i>${formatNumber(reward.packs)} 카드팩</span>`);
  if (reward.linkPoints) parts.push(`<span><i data-lucide="link-2"></i>${formatNumber(reward.linkPoints)} 연동 포인트</span>`);
  return parts.join('') || '<span>기록 갱신</span>';
}

function showPackOpeningModal(opening, cards, { renderNow = true } = {}) {
  ui.modal = {
    type: 'pack',
    cards,
    pityTriggered: opening.pityTriggered,
    highestRarity: highestRarity(cards),
    revealedCards: opening.revealedIndices,
    openingId: opening.id,
    pendingOpening: true,
  };
  if (renderNow) render();
}

function addPendingPackToCollection(draft, opening, cards) {
  if (draft.pendingPackOpening?.id !== opening.id) return false;
  draft.collection = addCardsToCollection(draft.collection, cards);
  draft.pendingPackOpening = null;
  appendActivity(draft, `공개를 마친 카드 ${cards.length}장을 인사기록에 등록했습니다.`, 'pack');
  return true;
}

function resumePendingPackOpening() {
  const opening = store.getState().pendingPackOpening;
  if (!opening) return false;
  const cards = cardsForPendingPack(opening, cardById);
  if (!cards) {
    showNotice('저장된 카드팩 결과를 아직 복원하지 못했습니다. 기록은 안전하게 보존됩니다.', 'warning');
    return true;
  }
  const remaining = unrevealedPackCardCount(opening, cards, requiresPackReveal);
  if (remaining === 0) {
    store.update((draft) => { addPendingPackToCollection(draft, opening, cards); });
    ui.modal = {
      type: 'pack', cards, pityTriggered: opening.pityTriggered,
      highestRarity: highestRarity(cards),
      revealedCards: opening.revealedIndices, openingId: opening.id, pendingOpening: false,
    };
    render();
    return true;
  }
  showPackOpeningModal(opening, cards);
  return true;
}

function revealPackCardAtIndex(cardIndex, openingId) {
  const current = store.getState().pendingPackOpening;
  if (!current || current.id !== openingId || ui.modal?.openingId !== openingId) return false;
  const cards = cardsForPendingPack(current, cardById);
  if (!cards) return false;
  let nextOpening = current;
  let finalized = false;
  store.update((draft) => {
    const opening = draft.pendingPackOpening;
    if (!opening || opening.id !== openingId) return;
    const result = revealPendingPackCard(opening, cardIndex, cards, requiresPackReveal);
    if (!result.changed) return;
    nextOpening = result.opening;
    if (result.completed) finalized = addPendingPackToCollection(draft, result.opening, cards);
    else draft.pendingPackOpening = result.opening;
  });
  if (nextOpening === current) return false;
  ui.modal.revealedCards = nextOpening.revealedIndices;
  ui.modal.pendingOpening = !finalized;
  render();
  return true;
}

function openStandardPack() {
  if (resumePendingPackOpening()) return;
  const state = store.getState();
  if (state.packs.standard <= 0) {
    showNotice('미개봉 카드팩이 없습니다.', 'warning');
    return;
  }
  const result = openPack({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: state.pity.standard,
  });
  const highest = highestRarity(result.cards);
  const premiumPack = rarityRank(highest) >= PACK_FLIP_THRESHOLD;
  const opening = premiumPack ? createPendingPackOpening({
    cards: result.cards,
    pityTriggered: result.pityTriggered,
    highestRarity: highest,
  }) : null;
  store.update((draft) => {
    draft.packs.standard -= 1;
    draft.pity.standard = result.nextPity;
    if (opening) {
      draft.pendingPackOpening = opening;
      appendActivity(draft, '인물 파일에서 특별 카드 봉인을 발견했습니다.', 'pack');
    } else {
      draft.collection = addCardsToCollection(draft.collection, result.cards);
      appendActivity(draft, `인물 파일에서 카드 ${result.cards.length}장을 발견했습니다.`, 'pack');
    }
  });
  ui.modal = {
    type: 'pack', cards: result.cards, pityTriggered: result.pityTriggered,
    highestRarity: highest, revealedCards: [],
    openingId: opening?.id || '', pendingOpening: Boolean(opening),
  };
  render();
}

function buyStandardPack() {
  const price = PACK_DEFINITION.standard.coinPrice;
  const state = store.getState();
  if (state.wallet.coins < price) {
    showNotice('사내 동전이 부족합니다.', 'warning');
    return false;
  }
  store.update((draft) => {
    draft.wallet.coins -= price;
    draft.packs.standard += 1;
    appendActivity(draft, '사내 인물 파일 한 팩을 구매했습니다.', 'pack');
  });
  showNotice('카드팩 1개를 구매했습니다.', 'success');
  return true;
}

function toggleSquadCard(cardId, context = 'adventure') {
  const state = store.getState();
  if (!state.collection[cardId]) return;
  const unavailableIds = context === 'raid' ? (state.expedition?.squad || []) : [];
  if (context === 'raid' && unavailableIds.includes(cardId)) {
    showNotice('모험에 참여 중인 카드는 레이드에 편성할 수 없습니다.', 'warning');
    return;
  }
  store.update((draft) => {
    const field = context === 'raid' ? 'selectedRaidSquad' : 'selectedExpeditionSquad';
    draft[field] = toggleSquadSelection(draft[field], cardId, { unavailableIds });
  });
  render({ preserveViewScroll: true });
}

function beginExpedition() {
  const state = store.getState();
  if (state.expedition) return;
  const mission = expeditionById(ui.selectedMissionId);
  try {
    const expedition = startExpedition({
      mission,
      cardIds: state.selectedExpeditionSquad,
      collection: state.collection,
      catalog: ALL_CARDS,
    });
    store.update((draft) => {
      draft.expedition = expedition;
      appendActivity(draft, `${mission.name} 모험을 시작했습니다.`, 'adventure');
    });
    showNotice('자동 모험을 시작했습니다.', 'success');
  } catch (error) {
    showNotice(error.message, 'warning');
  }
}

function completeExpeditionIfReady() {
  if (!store || ui.cloud.phase !== 'active') return false;
  const state = store.getState();
  const mission = expeditionById(state.expedition?.missionId);
  const completion = completeDueExpedition({ state, mission });
  if (!completion) return false;
  appendActivity(
    completion.state,
    `${mission.name} 완료: ${formatNumber(completion.result.coins)} 동전 획득`,
    'adventure',
    completion.completedAt,
  );
  store.replace(completion.state);
  ui.modal = {
    type: 'result',
    message: `${mission.name} 임무를 무사히 마쳤습니다.`,
    rewardText: rewardText({ coins: completion.result.coins, packs: completion.result.packs }),
  };
  render();
  return true;
}

function currentRaidToken() {
  return authSession.get()?.token || '';
}

function applyRaidPayload(payload, { activityMessage = '' } = {}) {
  if (ui.cloud.phase !== 'active' || !payload?.state) return;
  let reward = { coins: 0, packs: 0 };
  store.update((draft) => {
    draft.raid = payload.state;
    reward = reconcileRaidRewards(draft, payload.state);
    if (activityMessage) appendActivity(draft, activityMessage, 'raid');
    else if (reward.coins || reward.packs) {
      appendActivity(draft, `개인 레이드 미수령 보상을 동기화했습니다. (${plainRewardText(reward)})`, 'raid');
    }
  });
  if (payload.ranking) ui.raid.ranking = payload.ranking;
  ui.raid.lastLoadedAt = Date.now();
  return reward;
}

async function refreshPersonalRaid({ rankingOnly = false, silent = false } = {}) {
  if (!store || ui.auth.phase !== 'authenticated' || ui.auth.offline || !isRaidGatewayConfigured() || ui.raid.loading || ui.raid.dispatching) return false;
  const requestEpoch = ui.raid.requestEpoch;
  const leaseKey = activeCloudLeaseKey();
  if (!leaseKey) return false;
  ui.raid.loading = true;
  if (!silent) {
    ui.raid.error = '';
    render();
  }
  try {
    if (rankingOnly) {
      const ranking = await loadPersonalRaidRanking(currentRaidToken());
      if (requestEpoch !== ui.raid.requestEpoch || activeCloudLeaseKey() !== leaseKey) return false;
      ui.raid.ranking = ranking;
      ui.raid.lastLoadedAt = Date.now();
    } else {
      const payload = await loadPersonalRaid(currentRaidToken());
      if (requestEpoch !== ui.raid.requestEpoch || activeCloudLeaseKey() !== leaseKey) return false;
      applyRaidPayload(payload);
    }
    ui.raid.error = '';
    return true;
  } catch (error) {
    ui.raid.error = error.message || '레이드 정보를 불러오지 못했습니다.';
    return false;
  } finally {
    ui.raid.loading = false;
    if (ui.view === 'raid' && ui.raidMode === 'personal') render();
  }
}

async function sendRaidSquad() {
  const state = store.getState();
  const raidSquad = availableRaidSquad(state.selectedRaidSquad, state.expedition);
  const score = calculateSquadScore(raidSquad, state.collection, ALL_CARDS);
  if (!score) {
    showNotice('레이드에 보낼 카드를 편성해 주세요.', 'warning');
    return;
  }
  if (ui.auth.offline || !isRaidGatewayConfigured()) {
    showNotice('개인 레이드는 온라인 연결이 필요합니다.', 'warning');
    return;
  }
  if (ui.raid.dispatching) return;
  ui.raid.requestEpoch += 1;
  const requestEpoch = ui.raid.requestEpoch;
  const leaseKey = activeCloudLeaseKey();
  if (!leaseKey) return;
  ui.raid.dispatching = true;
  ui.raid.error = '';
  render();
  let followUpNotice = null;
  try {
    const lease = cloudPlay?.getSnapshot().lease;
    if (!lease?.leaseId) return;
    const payload = await dispatchPersonalRaid(currentRaidToken(), {
      bossId: RAID_DEFINITION.id,
      squadScore: score,
      leaseId: lease.leaseId,
      deviceId,
      generation: lease.generation,
    });
    if (requestEpoch !== ui.raid.requestEpoch || activeCloudLeaseKey() !== leaseKey) return;
    const result = payload.result || {};
    const damage = Math.max(0, Number(result.damage) || 0);
    const cleared = Boolean(result.cleared);
    const reward = applyRaidPayload(payload, {
      activityMessage: `개인 레이드 파견으로 ${formatNumber(damage)} 기여도를 기록했습니다.`,
    });
    if (cleared) {
      ui.modal = {
        type: 'result',
        message: `마감기한 드래곤을 오늘 ${formatNumber(payload.state.clears)}번째로 클리어했습니다.`,
        rewardText: rewardText(reward),
      };
    } else {
      followUpNotice = { message: `${formatNumber(damage)} 기여도를 기록했습니다.`, tone: 'success' };
    }
  } catch (error) {
    if (requestEpoch !== ui.raid.requestEpoch || activeCloudLeaseKey() !== leaseKey) return;
    if (error?.code === 'PLAY_SESSION_LOST' || error?.code === 'PLAYING_ELSEWHERE') {
      void retryCloudConnection();
    }
    ui.raid.error = error.message || '레이드 파견을 처리하지 못했습니다.';
    followUpNotice = { message: ui.raid.error, tone: 'warning' };
  } finally {
    ui.raid.dispatching = false;
    if (followUpNotice) showNotice(followUpNotice.message, followUpNotice.tone);
    else render();
  }
}

function openActiveIncident(incident = null) {
  const state = store.getState();
  const target = incident || state.activeIncident;
  if (!target) return;
  const full = incidentById(target.id) || target;
  ui.modal = { type: 'incident', incident: full };
  render();
}

function plainRewardText(reward = {}) {
  const parts = [];
  if (reward.coins) parts.push(`${formatNumber(reward.coins)} 동전`);
  if (reward.packs) parts.push(`카드팩 ${formatNumber(reward.packs)}개`);
  if (reward.linkPoints) parts.push(`연동 포인트 ${formatNumber(reward.linkPoints)}`);
  return parts.join(' · ') || '기록 갱신';
}

async function resolveActiveIncident({ choiceId, instanceId = null, incidentId = null, fromToast = false }) {
  if (ui.cloud.phase !== 'active') throw new Error('클라우드 연결을 확인한 뒤 다시 선택해 주세요.');
  const state = store.getState();
  const active = state.activeIncident;
  const targetInstanceId = instanceId || active?.instanceId;
  if (incidentId && active?.id !== incidentId) throw new Error('이미 종료되었거나 이전 돌발 업무입니다.');
  const resolution = resolveIncidentChoice({
    activeIncident: active,
    instanceId: targetInstanceId,
    choiceId,
    completedInstanceIds: state.completedIncidentInstanceIds,
  });
  store.update((draft) => {
    if (draft.activeIncident?.instanceId !== targetInstanceId) throw new Error('이미 처리된 돌발 업무입니다.');
    draft.wallet.coins += Number(resolution.reward.coins) || 0;
    draft.wallet.linkPoints += Number(resolution.reward.linkPoints) || 0;
    draft.packs.standard += Number(resolution.reward.packs) || 0;
    draft.activeIncident = null;
    draft.resolvedIncidents += 1;
    draft.completedIncidentInstanceIds = resolution.completedInstanceIds;
    draft.pendingIncident = null;
    draft.nextIncidentAt = null;
    draft.incidentScheduled = false;
    appendActivity(draft, resolution.result, 'incident');
  });
  // The reward is already committed atomically. A transient desktop IPC failure
  // must not make the user lose the result or retry it for a second reward.
  try {
    await desktopBridge.clearActiveIncident(targetInstanceId, { keepToast: fromToast });
  } catch (error) {
    console.warn('Could not close the incident notification:', error);
  }
  if (!fromToast) {
    ui.modal = { type: 'result', message: resolution.result, rewardText: rewardText(resolution.reward) };
    render();
  }
  await scheduleNextIncident();
  return { ok: true, message: `${resolution.result} (${plainRewardText(resolution.reward)})` };
}

async function scheduleNextIncident() {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return false;
  const state = store.getState();
  if (ui.incidentScheduling || state.activeIncident) return false;
  ui.incidentScheduling = true;
  const leaseKey = activeCloudLeaseKey();
  let restartForCurrentSession = false;
  try {
    const now = Date.now();
    const savedIncident = state.pendingIncident ? incidentById(state.pendingIncident.id) : null;
    const incident = savedIncident || chooseIncident({ recentIds: state.recentIncidentIds });
    const persistedScheduledAt = Number(state.pendingIncident?.scheduledAt ?? state.nextIncidentAt);
    const scheduledAt = savedIncident && persistedScheduledAt > now
      ? persistedScheduledAt
      : now + nextIncidentDelay();
    const delayMs = Math.max(1000, scheduledAt - now);
    store.update((draft) => {
      draft.pendingIncident = { id: incident.id, scheduledAt };
      draft.nextIncidentAt = scheduledAt;
      draft.incidentScheduled = true;
    });
    const scheduled = await desktopBridge.scheduleIncident(incident, delayMs);
    if (activeCloudLeaseKey() !== leaseKey) {
      await desktopBridge.cancelIncident().catch(() => {});
      restartForCurrentSession = ui.cloud.phase === 'active';
      return false;
    }
    if (!scheduled?.scheduled) {
      store.update((draft) => {
        draft.pendingIncident = null;
        draft.nextIncidentAt = null;
        draft.incidentScheduled = false;
      });
    }
  } catch (error) {
    // Keep the pending incident so the next startup/retry can schedule it again.
    if (ui.cloud.phase === 'active' && activeCloudLeaseKey() === leaseKey) {
      try {
        store.update((draft) => { draft.incidentScheduled = false; });
      } catch (storeError) {
        console.warn('Could not persist incident retry state:', storeError);
      }
    }
    console.warn('Could not schedule the next incident:', error);
    return false;
  } finally {
    ui.incidentScheduling = false;
    if (restartForCurrentSession) void scheduleNextIncident();
  }
}

function restorePendingIncidentIfDue(now = Date.now()) {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return 'none';
  const state = store.getState();
  if (state.activeIncident) return 'none';
  const pending = state.pendingIncident;
  if (!pending) return 'none';
  const canonical = incidentById(pending.id);
  const window = pendingIncidentWindow(pending, now);
  if (window?.status === 'scheduled') return 'scheduled';

  if (!canonical || !window || window.status === 'expired') {
    store.update((draft) => {
      if (draft.pendingIncident?.id !== pending.id) return;
      draft.pendingIncident = null;
      draft.nextIncidentAt = null;
      draft.incidentScheduled = false;
      if (canonical && window) {
        appendActivity(draft, `돌발 업무 만료: ${canonical.title}`, 'incident', window.expiresAt);
      }
    });
    return 'expired';
  }

  const instanceId = typeof pending.instanceId === 'string' && pending.instanceId
    ? pending.instanceId
    : `scheduled-${pending.id}-${window.scheduledAt}`;
  store.update((draft) => {
    if (draft.activeIncident || draft.pendingIncident?.id !== pending.id) return;
    draft.activeIncident = {
      id: pending.id,
      instanceId,
      arrivedAt: window.scheduledAt,
      expiresAt: window.expiresAt,
    };
    draft.recentIncidentIds = [pending.id, ...(draft.recentIncidentIds || []).filter((id) => id !== pending.id)].slice(0, 5);
    draft.pendingIncident = null;
    draft.nextIncidentAt = null;
    draft.incidentScheduled = false;
    appendActivity(draft, `돌발 업무 도착: ${canonical.title}`, 'incident', window.scheduledAt);
  });
  showNotice('앱을 비운 사이 도착한 돌발 업무가 있습니다.', 'warning');
  return 'active';
}

function handleIncidentArrived(incident) {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return;
  if (!incident?.id || !incident?.instanceId) return;
  const canonical = incidentById(incident.id);
  if (!canonical) return;
  const state = store.getState();
  const current = state.activeIncident;
  if (current) return;
  const now = Date.now();
  const persistedWindow = state.pendingIncident?.id === incident.id
    ? pendingIncidentWindow(state.pendingIncident, now)
    : null;
  if (persistedWindow?.status === 'expired') {
    store.update((draft) => {
      if (draft.pendingIncident?.id !== incident.id) return;
      draft.pendingIncident = null;
      draft.nextIncidentAt = null;
      draft.incidentScheduled = false;
      appendActivity(draft, `돌발 업무 만료: ${canonical.title}`, 'incident', persistedWindow.expiresAt);
    });
    void scheduleNextIncident();
    return;
  }
  const arrivedAt = persistedWindow?.status === 'active' ? persistedWindow.scheduledAt : now;
  store.update((draft) => {
    draft.activeIncident = {
      id: incident.id,
      instanceId: incident.instanceId,
      arrivedAt,
      expiresAt: persistedWindow?.status === 'active'
        ? persistedWindow.expiresAt
        : incidentExpiresAt(arrivedAt),
    };
    draft.recentIncidentIds = [incident.id, ...(draft.recentIncidentIds || []).filter((id) => id !== incident.id)].slice(0, 5);
    draft.pendingIncident = null;
    draft.nextIncidentAt = null;
    draft.incidentScheduled = false;
    appendActivity(draft, `돌발 업무 도착: ${canonical.title}`, 'incident');
  });
  showNotice('새 돌발 업무가 도착했습니다.', 'warning');
}

async function expireActiveIncidentIfNeeded() {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active' || ui.incidentExpiring) return false;
  const active = store.getState().activeIncident;
  if (!isIncidentExpired(active)) return false;
  ui.incidentExpiring = true;
  const canonical = incidentById(active.id);
  try {
    store.update((draft) => {
      if (draft.activeIncident?.instanceId !== active.instanceId) return;
      draft.activeIncident = null;
      draft.pendingIncident = null;
      draft.nextIncidentAt = null;
      draft.incidentScheduled = false;
      appendActivity(draft, `돌발 업무 만료: ${canonical?.title || active.id}`, 'incident');
    });
    if (ui.modal?.type === 'incident'
      && ui.modal.incident?.id === active.id) ui.modal = null;
    showNotice('돌발 업무의 10분 제한 시간이 끝났습니다.', 'warning');
    try {
      await desktopBridge.clearActiveIncident(active.instanceId);
    } catch (error) {
      console.warn('Could not clear an expired incident notification:', error);
    }
  } finally {
    ui.incidentExpiring = false;
  }
  await scheduleNextIncident();
  return true;
}

async function startIncidentRuntime() {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return;
  try {
    await desktopBridge.setIncidentNotifications(store.getState().settings.incidentNotifications);
  } catch (error) {
    console.warn('Could not sync the desktop incident notification setting:', error);
  }
  if (await expireActiveIncidentIfNeeded()) return;
  if (restorePendingIncidentIfDue() === 'active') return;
  await scheduleNextIncident();
}

function resetAuthAvailability(field = null) {
  const fields = field ? [field] : ['username', 'nickname'];
  for (const target of fields) {
    ui.auth.availability[target] = {
      checkedValue: '',
      available: false,
      pending: false,
      message: `${target === 'username' ? '아이디' : '닉네임'} 중복 확인이 필요합니다.`,
    };
  }
}

function switchAuthMode(mode) {
  ui.auth.mode = mode === 'signup' ? 'signup' : 'login';
  ui.auth.error = '';
  ui.auth.pending = false;
  ui.auth.form.password = '';
  ui.auth.form.passwordConfirm = '';
  render();
}

async function checkAuthAvailability(field) {
  if (!['username', 'nickname'].includes(field)) return;
  const value = normalizedAuthValue(field);
  const issue = authFieldIssue(field);
  if (issue) {
    ui.auth.availability[field] = { checkedValue: '', available: false, pending: false, message: issue };
    syncAuthFormControls();
    return;
  }
  const status = ui.auth.availability[field];
  status.pending = true;
  status.available = false;
  status.checkedValue = '';
  status.message = '';
  syncAuthFormControls();
  try {
    const result = await checkAccountAvailability(field, value);
    if (normalizedAuthValue(field) !== value) return;
    status.checkedValue = value;
    status.available = result.available;
    status.message = result.message || (result.available ? '사용할 수 있습니다.' : '이미 사용 중입니다.');
  } catch (error) {
    if (normalizedAuthValue(field) !== value) return;
    status.checkedValue = '';
    status.available = false;
    status.message = error.message || '중복 여부를 확인하지 못했습니다.';
  } finally {
    if (normalizedAuthValue(field) === value) status.pending = false;
    syncAuthFormControls();
  }
}

function updateCloudUi(status = {}) {
  const previousPhase = ui.cloud.phase;
  ui.cloud = {
    ...ui.cloud,
    phase: status.phase || ui.cloud.phase,
    message: String(status.message || status.error?.message || ''),
    code: String(status.code || status.error?.code || ''),
    activePlatform: String(status.activePlatform || status.error?.activePlatform || ''),
    generation: Math.max(0, Number(status.generation ?? status.lease?.generation ?? ui.cloud.generation) || 0),
  };
  ui.auth.offline = ui.cloud.phase !== 'active';
  if (previousPhase === 'active' && ui.cloud.phase !== 'active') {
    void desktopBridge.cancelIncident().catch(() => {});
  }
  if (ui.auth.phase === 'authenticated' && store) {
    try {
      render();
    } catch (error) {
      console.error('Could not render the restored cloud state:', error);
      ui.cloud = {
        ...ui.cloud,
        phase: 'connection-error',
        code: 'CLIENT_RENDER_FAILED',
        message: '불러온 기록을 화면에 표시하지 못했습니다. 다시 연결해 주세요.',
      };
      app.innerHTML = `
        <section class="cloud-session-gate" role="dialog" aria-modal="true" aria-live="assertive">
          <div class="cloud-session-card">
            <div class="cloud-session-mark" aria-hidden="true"><i data-lucide="wifi"></i></div>
            <span class="eyebrow">CONNECTION PAUSED</span>
            <h2>게임 화면을 여는 중 문제가 생겼어요.</h2>
            <p>${escapeHtml(ui.cloud.message)}</p>
            <button class="primary-button" type="button" data-action="cloud-retry">다시 연결</button>
            <button class="cloud-session-logout" type="button" data-action="logout">로그아웃</button>
          </div>
        </section>`;
      try { refreshIcons(); } catch {}
    }
  }
}

function disposeCloudSession() {
  unsubscribeCloudStore?.();
  unsubscribeCloudStore = null;
  cloudPlay?.dispose();
  cloudPlay = null;
}

function applyRemoteGameState(nextState) {
  if (!store || !nextState) return;
  applyingRemoteState = true;
  try {
    store.replace(nextState);
  } finally {
    applyingRemoteState = false;
  }
}

async function finishCloudActivation() {
  if (ui.cloud.phase !== 'active' || !store) return;
  const current = store.getState();
  if (current.profile.displayName !== ui.auth.account?.nickname
    || !current.raid
    || current.raid.id !== RAID_DEFINITION.id) {
    store.update((draft) => {
      draft.profile.displayName = ui.auth.account?.nickname || draft.profile.displayName;
      if (!draft.raid || draft.raid.id !== RAID_DEFINITION.id) {
        draft.raid = createRaidState(RAID_DEFINITION);
      }
    });
  }
  // Expeditions use an absolute end timestamp, so an overdue run is settled
  // immediately after the authoritative cloud record is restored.
  if (!completeExpeditionIfReady()) render();
  await startIncidentRuntime();
  await refreshPersonalRaid({ silent: true });
  render();
}

async function activateAuthenticatedSession(session, { newAccount = false } = {}) {
  const account = session.account;
  disposeCloudSession();
  const hadPersistedState = hasStoredGameState(globalThis.localStorage, account.id);
  store = createGameStore(globalThis.localStorage, { userId: account.id });
  ui.auth.phase = 'authenticated';
  ui.auth.pending = false;
  ui.auth.error = '';
  ui.auth.offline = true;
  ui.auth.account = account;
  ui.auth.form.password = '';
  ui.auth.form.passwordConfirm = '';
  ui.raid = { loading: false, dispatching: false, error: '', ranking: null, lastLoadedAt: 0, requestEpoch: 0 };
  ui.view = 'dashboard';
  ui.modal = null;
  ui.cloud = { phase: 'connecting', message: '', code: '', activePlatform: '', generation: 0 };
  render();

  if (ui.appVersion === '...') {
    ui.appVersion = await desktopBridge.getVersion().catch(() => '0.0.0');
  }
  cloudBootstrapAllowed = shouldBootstrapCloudState({
    platform: clientPlatform,
    newAccount,
    hasPersistedState: hadPersistedState,
  });
  cloudPlay = createCloudPlaySession({
    gateway: cloudGateway,
    token: session.token,
    accountId: account.id,
    deviceId,
    platform: clientPlatform,
    appVersion: ui.appVersion,
    onPhase: updateCloudUi,
    onRemoteState: applyRemoteGameState,
  });
  unsubscribeCloudStore = store.subscribe((nextState) => {
    if (!applyingRemoteState) cloudPlay?.queueState(nextState);
  });

  try {
    await cloudPlay.open({
      bootstrapState: cloudBootstrapAllowed ? store.getState() : null,
      allowBootstrap: cloudBootstrapAllowed,
    });
    await finishCloudActivation();
  } catch (error) {
    console.warn('Could not activate cloud play session:', error);
    if (ui.cloud.phase === 'connecting' || ui.cloud.phase === 'taking-over') {
      updateCloudUi({
        phase: 'connection-error',
        message: error.message || '클라우드 기록을 불러오지 못했습니다.',
        code: error.code || 'CLOUD_ACTIVATION_FAILED',
      });
    }
  }
}

async function submitLogin(form) {
  const data = new FormData(form);
  ui.auth.form.username = String(data.get('username') || '');
  ui.auth.form.password = String(data.get('password') || '');
  if (!normalizedAuthValue('username') || !normalizedAuthValue('password')) {
    ui.auth.error = '아이디와 비밀번호를 입력해 주세요.';
    render();
    return;
  }
  ui.auth.pending = true;
  ui.auth.error = '';
  render();
  try {
    const session = await loginTcgAccount({
      username: normalizedAuthValue('username'),
      password: normalizedAuthValue('password'),
    });
    authSession.save(session);
    await activateAuthenticatedSession(session);
  } catch (error) {
    ui.auth.pending = false;
    ui.auth.error = error.message || '로그인하지 못했습니다.';
    render();
  }
}

async function submitSignup(form) {
  const data = new FormData(form);
  for (const field of ['username', 'nickname', 'password', 'passwordConfirm']) {
    ui.auth.form[field] = String(data.get(field) || '');
  }
  if (!canSubmitSignup()) {
    ui.auth.error = '입력값과 아이디·닉네임 중복 확인을 다시 확인해 주세요.';
    render();
    return;
  }
  ui.auth.pending = true;
  ui.auth.error = '';
  render();
  try {
    const session = await registerTcgAccount({
      username: normalizedAuthValue('username'),
      nickname: normalizedAuthValue('nickname'),
      password: normalizedAuthValue('password'),
      passwordConfirm: normalizedAuthValue('passwordConfirm'),
    });
    authSession.save(session);
    await activateAuthenticatedSession(session, { newAccount: true });
  } catch (error) {
    ui.auth.pending = false;
    ui.auth.error = error.message || '회원가입하지 못했습니다.';
    if (Number(error.status) === 409) resetAuthAvailability();
    render();
  }
}

async function logout() {
  try {
    flushLocalGameCache();
  } catch (error) {
    console.warn('Could not persist the local cache before logout:', error);
    showNotice(error.message || '진행 기록을 저장하지 못해 로그아웃을 중단했습니다.', 'warning');
    return false;
  }
  try {
    await flushCloudStateOrThrow();
  } catch (error) {
    console.warn('Could not flush cloud state before logout:', error);
    if (error.code !== 'CLOUD_SAVE_CONFLICT') {
      updateCloudUi({
        phase: 'connection-error',
        message: error.message || '저장되지 않은 진행 기록이 있어 로그아웃하지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
        code: error.code || 'PENDING_SAVE',
      });
    }
    return false;
  }
  try {
    await cloudPlay?.release({ flushPending: false });
  } catch (error) {
    console.warn('Could not release cloud session during logout:', error);
  }
  await desktopBridge.cancelIncident().catch((error) => {
    console.warn('Could not cancel the incident during logout:', error);
  });
  disposeCloudSession();
  authSession.clear();
  store = null;
  ui.auth.phase = 'signedOut';
  ui.auth.mode = 'login';
  ui.auth.pending = false;
  ui.auth.error = '';
  ui.auth.offline = false;
  ui.auth.account = null;
  ui.auth.form = { username: '', nickname: '', password: '', passwordConfirm: '' };
  ui.raid = { loading: false, dispatching: false, error: '', ranking: null, lastLoadedAt: 0, requestEpoch: 0 };
  resetAuthAvailability();
  ui.modal = null;
  ui.cloud = { phase: 'idle', message: '', code: '', activePlatform: '', generation: 0 };
  render();
  return true;
}

async function restoreAuthentication() {
  const saved = authSession.get();
  if (!saved) {
    ui.auth.phase = 'signedOut';
    render();
    return;
  }
  try {
    const restored = await loadCurrentTcgAccount(saved.token);
    const account = restored.account || restored;
    const refreshed = authSession.save({ token: restored.token || saved.token, account });
    await activateAuthenticatedSession(refreshed);
  } catch (error) {
    if ([401, 403, 410].includes(Number(error.status))) {
      authSession.clear();
      ui.auth.phase = 'signedOut';
      ui.auth.error = '로그인이 만료되었습니다. 다시 로그인해 주세요.';
      render();
      return;
    }
    await activateAuthenticatedSession(saved);
  }
}

async function retryCloudConnection() {
  if (!cloudPlay || !store) return;
  const connected = await cloudPlay.resume({
    bootstrapState: cloudBootstrapAllowed ? store.getState() : null,
    allowBootstrap: cloudBootstrapAllowed,
  });
  if (connected) await finishCloudActivation();
}

async function takeOverCloudSession() {
  if (!cloudPlay) return;
  try {
    await cloudPlay.takeover({ expectedGeneration: ui.cloud.generation || undefined });
    await finishCloudActivation();
  } catch (error) {
    console.warn('Could not take over cloud play session:', error);
  }
}

async function resolveCloudSaveConflict(strategy) {
  if (!cloudPlay) return false;
  try {
    const resolved = await cloudPlay.resolveConflict(strategy);
    if (resolved) await finishCloudActivation();
    return resolved;
  } catch (error) {
    updateCloudUi({
      phase: 'connection-error',
      message: error.message || '선택한 진행 기록을 저장하지 못했습니다.',
      code: error.code || 'CONFLICT_RESOLUTION_FAILED',
    });
    return false;
  }
}

async function checkForAppUpdates({ autoInstall = clientPlatform === 'android' } = {}) {
  if (updateCheckPromise) return updateCheckPromise;
  updateCheckPromise = (async () => {
    ui.updateStatus = { status: 'checking' };
    render();
    const result = await desktopBridge.checkForUpdates();
    if (result?.status && !['denied'].includes(result.status)) {
      ui.updateStatus = result;
      render();
    }
    if (
      autoInstall
      && result?.status === 'available'
      && result.latestVersion
      && result.latestVersion !== autoUpdateAttemptedVersion
    ) {
      autoUpdateAttemptedVersion = result.latestVersion;
      await downloadAndroidUpdate();
    }
    return result;
  })().finally(() => {
    updateCheckPromise = null;
  });
  return updateCheckPromise;
}

async function downloadAndroidUpdate() {
  if (updateInstallPromise) return updateInstallPromise;
  const downloadUrl = ui.updateStatus?.downloadUrl;
  if (!downloadUrl) return false;
  updateInstallPromise = (async () => {
    let releasedCloudSession = false;
    try {
      await authenticationRestorePromise?.catch(() => {});
      flushLocalGameCache();
      await flushCloudStateOrThrow();
      if (cloudPlay?.getSnapshot().lease) {
        await cloudPlay.release({ flushPending: false });
        releasedCloudSession = true;
      }
      await desktopBridge.cancelIncident();
      ui.cloud = { ...ui.cloud, phase: 'updating', message: '', code: '' };
      ui.updateStatus = { ...ui.updateStatus, status: 'saving', downloadUrl };
      render();

      if (clientPlatform === 'android') {
        const result = await desktopBridge.installAndroidUpdate(downloadUrl);
        ui.updateStatus = { ...ui.updateStatus, ...result, downloadUrl };
        render();
        return true;
      }

      const opened = await desktopBridge.openExternal(downloadUrl);
      if (!opened) throw new Error('업데이트 파일 주소를 열지 못했습니다.');
      return true;
    } catch (error) {
      console.warn('Could not prepare the Android update:', error);
      const hasSaveConflict = error.code === 'CLOUD_SAVE_CONFLICT' || cloudPlay?.getSnapshot().hasSaveConflict;
      if (!hasSaveConflict) {
        updateCloudUi({
          phase: 'connection-error',
          message: error.message || '클라우드 저장을 마치지 못해 업데이트를 열지 않았습니다.',
          code: error.code || 'UPDATE_PREPARE_FAILED',
        });
      }
      if (releasedCloudSession && ui.auth.phase === 'authenticated') await retryCloudConnection();
      return false;
    } finally {
      updateInstallPromise = null;
    }
  })();
  return updateInstallPromise;
}

app.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  const actionsAllowedWhileCloudBlocked = new Set([
    'cloud-takeover',
    'cloud-retry',
    'cloud-conflict-local',
    'cloud-conflict-server',
    'download-update',
    'logout',
  ]);
  if (ui.auth.phase === 'authenticated'
    && ui.cloud.phase !== 'active'
    && !actionsAllowedWhileCloudBlocked.has(action)) return;

  if (action === 'switch-auth-mode') {
    switchAuthMode(button.dataset.mode);
  } else if (action === 'check-auth-availability') {
    await checkAuthAvailability(button.dataset.field);
  } else if (action === 'logout') {
    await logout();
  } else if (action === 'cloud-takeover') {
    await takeOverCloudSession();
  } else if (action === 'cloud-retry') {
    await retryCloudConnection();
  } else if (action === 'cloud-conflict-local') {
    await resolveCloudSaveConflict('local');
  } else if (action === 'cloud-conflict-server') {
    await resolveCloudSaveConflict('server');
  } else if (action === 'download-update') {
    await downloadAndroidUpdate();
  } else if (action === 'navigate') {
    ui.view = button.dataset.view;
    ui.modal = null;
    render();
    if (ui.view === 'raid' && ui.raidMode === 'personal') void refreshPersonalRaid({ silent: true });
  } else if (action === 'navigate-from-modal') {
    ui.view = button.dataset.view;
    ui.modal = null;
    render();
    if (ui.view === 'raid' && ui.raidMode === 'personal') void refreshPersonalRaid({ silent: true });
  } else if (action === 'open-pack' || action === 'open-another-pack' || action === 'resume-pack-opening') {
    openStandardPack();
  } else if (action === 'buy-pack') {
    buyStandardPack();
  } else if (action === 'buy-and-open-pack') {
    if (buyStandardPack()) openStandardPack();
  } else if (action === 'reveal-pack-card') {
    if (ui.modal?.type !== 'pack') return;
    const index = Number(button.dataset.cardIndex);
    if (!Number.isInteger(index) || index < 0 || index >= ui.modal.cards.length) return;
    revealPackCardAtIndex(index, button.dataset.openingId);
  } else if (action === 'open-card') {
    ui.modal = { type: 'card', cardId: button.dataset.cardId };
    render();
  } else if (action === 'close-modal') {
    if (event.target.closest('[data-modal-panel]') && !event.target.closest('.modal-close') && !event.target.closest('.compact-modal .primary-button')) return;
    ui.modal = null;
    render();
  } else if (action === 'filter-rarity') {
    ui.rarityFilter = button.dataset.rarity;
    render();
  } else if (action === 'toggle-squad') {
    toggleSquadCard(button.dataset.cardId, button.dataset.context);
  } else if (action === 'select-mission') {
    ui.selectedMissionId = button.dataset.missionId;
    render();
  } else if (action === 'start-expedition') {
    beginExpedition();
  } else if (action === 'cancel-expedition') {
    store.update((draft) => {
      const mission = expeditionById(draft.expedition?.missionId);
      draft.expedition = null;
      appendActivity(draft, `${mission?.name || '모험'}을 중단했습니다.`, 'adventure');
    });
    showNotice('모험을 중단했습니다.', 'warning');
  } else if (action === 'dispatch-raid') {
    await sendRaidSquad();
  } else if (action === 'switch-raid-mode') {
    ui.raidMode = button.dataset.raidMode === 'cooperative' ? 'cooperative' : 'personal';
    render();
    if (ui.raidMode === 'personal') void refreshPersonalRaid({ silent: true });
  } else if (action === 'switch-raid-panel') {
    ui.raidPanel = button.dataset.raidPanel === 'ranking' ? 'ranking' : 'battle';
    render();
    if (ui.raidPanel === 'ranking') void refreshPersonalRaid({ rankingOnly: true, silent: true });
  } else if (action === 'refresh-raid-ranking') {
    await refreshPersonalRaid({ rankingOnly: true });
  } else if (action === 'open-incident') {
    openActiveIncident();
  } else if (action === 'resolve-incident') {
    try {
      await resolveActiveIncident({ choiceId: button.dataset.choiceId });
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  } else if (action === 'hide-window') {
    await desktopBridge.hideWindow();
  } else if (action === 'open-settings') {
    ui.modal = { type: 'settings' };
    render();
  } else if (action === 'toggle-notifications') {
    const notificationKind = desktopBridge.isDesktop ? '데스크톱 팝업' : '모바일';
    store.update((draft) => {
      draft.settings.incidentNotifications = button.checked;
    });
    await desktopBridge.setIncidentNotifications(button.checked);
    showNotice(
      button.checked
        ? `${notificationKind} 알림을 켰습니다.`
        : `${notificationKind} 알림만 껐습니다. 돌발 업무는 업무판에 계속 표시됩니다.`,
      'success',
    );
  } else if (action === 'toggle-discreet') {
    store.update((draft) => {
      draft.settings.discreetMode = button.checked;
    });
  } else if (action === 'toggle-payroll-mode') {
    const state = store.getState();
    const nextValue = button.matches('input[type="checkbox"]') ? button.checked : !state.settings.payrollMode;
    store.update((draft) => {
      draft.settings.payrollMode = nextValue;
    });
    render();
  } else if (action === 'check-update') {
    await checkForAppUpdates();
  } else if (action === 'reset-progress') {
    if (window.confirm('클라우드에 저장된 카드부 진행 기록을 초기화할까요?')) {
      store.reset();
      ui.modal = null;
      render();
    }
  }
});

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'login') {
    void submitLogin(form);
  } else if (form.dataset.form === 'signup') {
    void submitSignup(form);
  } else if (form.dataset.form === 'collection-search') {
    ui.collectionQuery = String(new FormData(form).get('query') || '');
    render();
  }
});

app.addEventListener('input', (event) => {
  const input = event.target.closest('.auth-form input[name]');
  if (!input || !Object.prototype.hasOwnProperty.call(ui.auth.form, input.name)) return;
  ui.auth.form[input.name] = input.value;
  ui.auth.error = '';
  if (input.name === 'username' || input.name === 'nickname') resetAuthAvailability(input.name);
  syncAuthFormControls();
});

function updateLiveTimers() {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return;
  if (isIncidentExpired(store.getState().activeIncident)) {
    void expireActiveIncidentIfNeeded();
    return;
  }
  if (completeExpeditionIfReady()) return;
  document.querySelectorAll('[data-countdown]').forEach((node) => {
    node.textContent = formatDuration(Number(node.dataset.countdown) - Date.now());
  });
  document.querySelectorAll('[data-incident-countdown]').forEach((node) => {
    node.textContent = `남은 시간 ${formatDuration(Number(node.dataset.incidentCountdown) - Date.now())}`;
  });
  const state = store.getState();
  if (state.expedition) {
    const progressNode = document.querySelector('[data-expedition-progress]');
    if (progressNode) progressNode.style.width = `${Math.round(expeditionProgress(state.expedition) * 100)}%`;
  }
  const cooldownNode = document.querySelector('[data-raid-cooldown]');
  if (cooldownNode) {
    const remaining = Number(cooldownNode.dataset.raidCooldown) - Date.now();
    if (remaining <= 0) render();
    else cooldownNode.textContent = `재정비 ${Math.ceil(remaining / 1000)}초`;
  }
}

desktopBridge.onIncident(handleIncidentArrived);
desktopBridge.onOpenIncident((incident) => {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return;
  const active = store.getState().activeIncident;
  if (active?.id === incident?.id && active?.instanceId === incident?.instanceId) openActiveIncident();
});
desktopBridge.onIncidentChoice(async ({ incidentId, instanceId, choiceId }) => {
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') {
    return { ok: false, message: '카드부에 로그인한 뒤 다시 선택해 주세요.' };
  }
  try {
    return await resolveActiveIncident({ incidentId, instanceId, choiceId, fromToast: true });
  } catch (error) {
    return { ok: false, message: error.message || '돌발 업무를 처리하지 못했습니다.' };
  }
});
desktopBridge.onBeforeUpdate(async () => {
  try {
    flushLocalGameCache();
    await flushCloudStateOrThrow();
    await cloudPlay?.release({ flushPending: false });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || '클라우드 저장을 마치지 못했습니다.' };
  }
});
desktopBridge.onUpdateStatus((status) => {
  ui.updateStatus = { ...ui.updateStatus, ...status };
  render();
  if (status?.status === 'error' && ui.cloud.phase === 'updating' && ui.auth.phase === 'authenticated') {
    void retryCloudConnection();
  }
});

desktopBridge.onAppStateChange((isActive) => {
  if (!isActive) {
    try {
      flushLocalGameCache();
    } catch (error) {
      console.warn('Could not persist local cache before backgrounding:', error);
    }
    void cloudPlay?.flush().catch(() => {});
    return;
  }
  if (ui.auth.phase === 'authenticated') void retryCloudConnection();
  if (clientPlatform === 'android') {
    if (['permission-required', 'installing'].includes(ui.updateStatus?.status) && ui.updateStatus?.downloadUrl) {
      ui.updateStatus = {
        ...ui.updateStatus,
        status: 'available',
        message: '업데이트가 아직 설치되지 않았다면 업데이트 받기를 다시 눌러 주세요.',
      };
      render();
    }
    window.setTimeout(() => { void checkForAppUpdates(); }, 750);
  }
});

render();
appVersionPromise = desktopBridge.getVersion()
  .then((version) => {
    ui.appVersion = version;
    render();
    return version;
  })
  .catch(() => {
    ui.appVersion = '0.0.0';
    render();
    return ui.appVersion;
  });
authenticationRestorePromise = restoreAuthentication();
if (clientPlatform === 'android') {
  void Promise.allSettled([appVersionPromise, authenticationRestorePromise])
    .then(() => checkForAppUpdates());
}
window.setInterval(updateLiveTimers, 1000);
window.setInterval(() => {
  if (ui.view !== 'raid' || ui.raidMode !== 'personal' || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') return;
  void refreshPersonalRaid({ rankingOnly: ui.raidPanel === 'ranking', silent: true });
}, 10000);
