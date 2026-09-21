import {
  ArrowRight,
  Bell,
  Ban,
  Briefcase,
  Check,
  ChevronRight,
  ChevronLeft,
  CircleAlert,
  Clock,
  Coins,
  createIcons,
  Download,
  EyeOff,
  Flame,
  Gift,
  HeartPulse,
  Library,
  Lock,
  Mail,
  Map,
  Megaphone,
  Orbit,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldMinus,
  Snowflake,
  Sparkles,
  Swords,
  Trophy,
  Target,
  Users,
  Unlock,
  Wifi,
  Wind,
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
import { addCardsToCollection, openPacks } from './core/packEngine.js';
import { newCardIndices, registerDiscoveredCards } from './core/cardDiscovery.js';
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
import {
  createRaidBattle,
  performBossAction,
  performPlayerAction,
  skillForCard,
  startRaidBattle,
} from './core/turnRaidEngine.js';
import {
  activeRaidCardIndex,
  effectPresentation,
  isPlayerRaidTurn,
  normalizeRaidBattle,
  raidBattleFinished,
  raidTurnSecondsRemaining,
} from './core/raidBattleView.js';
import { reconcileRaidRewards } from './core/raidRewards.js';
import { appendActivity, createGameStore, hasStoredGameState } from './core/gameState.js';
import {
  ENHANCEMENT_SUCCESS_RATES,
  MAX_ENHANCEMENT,
  SYNTHESIS_MATERIAL_COUNT,
  attemptCardEnhancement,
  attemptBatchCardSynthesis,
  attemptCardSynthesis,
  autoSelectSynthesisMaterials,
  availableSynthesisMaterialCountForRarity,
  bestAvailableEnhancementForCard,
  bestEnhancementForCard,
  cardEnhancementAvailability,
  enhancementCountsForCard,
  enhancedCardPower,
  expeditionCardLocks,
  lockedEnhancementCounts,
  synthesisSuccessRateForRarity,
} from './core/cardManagement.js';
import {
  cardsForPendingPack,
  createPendingPackOpening,
  revealPendingPackCard,
  unrevealedPackCardCount,
} from './core/packOpeningSession.js';
import { createAuthSessionStore } from './core/authSession.js';
import { createCloudPlaySession } from './core/cloudPlaySession.js';
import { mobileNotificationPermissionPrompt } from './core/mobileNotificationPermission.js';
import {
  cardCombatPowerAtLevel,
  cardExperienceForNextLevel,
  cardLevelUpCoinCost,
  cardMaxHpAtLevel,
  grantCardExperience,
  progressionForCard,
  purchaseCardLevel,
  raidExperienceReward,
  roleForCard,
} from './core/cardProgression.js';
import {
  MAX_DECK_PRESETS,
  deckPresetCards,
  saveDeckPreset,
} from './core/deckPresets.js';
import {
  EQUIPMENT_TYPES,
  equipmentById,
  equipmentPartyAttackMultiplier,
  equipmentPartyHpMultiplier,
} from './core/equipment.js';
import { withDeadline } from './core/promiseDeadline.js';
import { shouldFlushCloudBeforeUpdate, waitForOptionalUpdateRestore } from './core/androidUpdatePreparation.js';
import {
  getOrCreateDeviceId,
  platformLabel,
  shouldBootstrapCloudState,
} from './core/deviceIdentity.js';
import { MAX_SQUAD_SIZE, availableRaidSquad, toggleSquadSelection } from './core/squadSelection.js';
import { desktopBridge } from './services/desktopBridge.js';
import {
  checkAccountAvailability,
  isAuthGatewayConfigured,
  loadCurrentTcgAccount,
  loginTcgAccount,
  registerTcgAccount,
} from './services/authGateway.js';
import {
  finishPersonalRaid,
  isRaidGatewayConfigured,
  loadPersonalRaid,
  loadPersonalRaidRanking,
  startPersonalRaid,
} from './services/raidGateway.js';
import {
  heartbeatPlaySession,
  openPlaySession,
  releasePlaySession,
  saveCloudGameState,
  takeoverPlaySession,
} from './services/playSessionGateway.js';
import {
  claimAllMailboxItems,
  claimMailboxItem,
  createMailboxRequestGuard,
  loadMailbox,
  loadTcgAdminGrantCatalog,
  loadTcgAdminUsers,
  loginTcgAdmin,
  markMailRead,
  sendTcgAdminMail,
} from './services/mailboxGateway.js';

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
let appVersionPromise = null;
let authenticationRestorePromise = null;
let pendingGameNotificationOpen = null;
const mailboxRequestGuard = createMailboxRequestGuard();

const iconSet = {
  ArrowRight,
  Ban,
  Bell,
  Briefcase,
  Check,
  ChevronRight,
  ChevronLeft,
  CircleAlert,
  Clock,
  Coins,
  Download,
  EyeOff,
  Flame,
  Gift,
  HeartPulse,
  Library,
  Lock,
  Mail,
  Map,
  Megaphone,
  Orbit,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldMinus,
  Snowflake,
  Sparkles,
  Swords,
  Trophy,
  Target,
  Users,
  Unlock,
  Wifi,
  Wind,
  X,
  Zap,
};

const availableLucideIconNames = new Set(Object.keys(iconSet).map((name) => (
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
)));

const views = {
  dashboard: { label: '업무판', icon: 'briefcase' },
  collection: { label: '카드 도감', icon: 'library' },
  management: { label: '카드 관리', icon: 'sparkles' },
  mailbox: { label: '우편함', icon: 'mail' },
  adventure: { label: '자동 모험', icon: 'map' },
  raid: { label: '레이드', icon: 'shield' },
};

const DONATION_PACKAGES = Object.freeze([
  { name: '테스터 패키지', packs: 6, coins: 0, price: 5_000 },
  { name: '테스터 패키지2', packs: 15, coins: 1_500, price: 10_000 },
  { name: '테스터 패키지3', packs: 50, coins: 7_000, price: 30_000 },
]);

function createRaidUiState() {
  return {
    loading: false,
    dispatching: false,
    error: '',
    ranking: null,
    lastLoadedAt: 0,
    requestEpoch: 0,
    battle: null,
    serverBattle: null,
    battlePending: false,
    finishing: false,
    animation: null,
    inspector: null,
    bossActionTimer: null,
    timeoutActionPending: false,
  };
}

const ui = {
  view: 'dashboard',
  renderedView: null,
  modal: null,
  selectedMissionId: EXPEDITIONS[0].id,
  rarityFilter: 'all',
  collectionOwnedOnly: false,
  collectionSort: 'rarity-asc',
  collectionQuery: '',
  deckPresetContext: 'adventure',
  deckPresetSlot: 0,
  deckPresetName: '',
  managementPanel: 'enhance',
  enhanceCardId: '',
  enhanceTargetStage: null,
  enhanceMaterialStage: null,
  synthesisRarity: 'c',
  synthesisMaterials: [],
  notice: null,
  updateStatus: null,
  notificationPermission: 'unknown',
  notificationPermissionPromptShown: false,
  mailbox: {
    loading: false,
    claimingId: '',
    items: [],
    error: '',
    lastLoadedAt: 0,
  },
  admin: {
    token: '',
    loading: false,
    sending: false,
    users: [],
    packages: [],
    error: '',
    draft: {
      target: 'all',
      presetId: 'custom',
      title: '',
      message: '',
      coins: '0',
      standardPacks: '0',
      expiresInHours: '168',
    },
    pendingMailRequest: null,
  },
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
  raid: createRaidUiState(),
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

const scrollPositions = new globalThis.Map();

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

function expeditionNotificationId(expedition) {
  if (!expedition?.missionId || !Number(expedition?.endsAt)) return '';
  return `expedition:${expedition.missionId}:${Number(expedition.endsAt)}`;
}

function incidentNotificationId(incident) {
  const at = Number(incident?.scheduledAt ?? incident?.arrivedAt);
  if (!incident?.id || !at) return '';
  return `incident:${incident.id}:${at}`;
}

async function scheduleExpeditionNotification(expedition, mission = expeditionById(expedition?.missionId)) {
  if (clientPlatform !== 'android' || !expedition || !mission) return false;
  const id = expeditionNotificationId(expedition);
  if (!id) return false;
  try {
    await desktopBridge.scheduleGameNotification({
      id,
      type: 'expedition',
      title: '모험 완료',
      body: `${mission.name} 모험이 완료되었습니다.`,
      at: Number(expedition.endsAt),
      quietBehavior: 'delay',
      payload: { type: 'expedition', missionId: mission.id },
    });
    return true;
  } catch (error) {
    console.warn('Could not schedule the expedition notification:', error);
    return false;
  }
}

async function scheduleIncidentNotification(pending, incident = incidentById(pending?.id)) {
  if (clientPlatform !== 'android' || !pending || !incident) return false;
  const id = incidentNotificationId(pending);
  if (!id) return false;
  const scheduledAt = Number(pending.scheduledAt);
  try {
    await desktopBridge.scheduleGameNotification({
      id,
      type: 'incident',
      title: '돌발 임무 도착',
      body: incident.title,
      at: scheduledAt,
      expiresAt: incidentExpiresAt(scheduledAt),
      quietBehavior: 'skip',
      payload: { type: 'incident', incidentId: incident.id },
    });
    return true;
  } catch (error) {
    console.warn('Could not schedule the incident notification:', error);
    return false;
  }
}

async function syncMobileGameNotifications() {
  if (clientPlatform !== 'android' || !store) return false;
  const state = store.getState();
  const enabled = state.settings.incidentNotifications === true;
  try {
    let permission = await desktopBridge.getGameNotificationPermission();
    ui.notificationPermission = String(permission?.display || 'unknown');
    await desktopBridge.configureGameNotifications({
      enabled,
      quietHoursEnabled: state.settings.quietHoursNotifications === true,
    });
    await Promise.allSettled([
      desktopBridge.cancelGameNotificationType('expedition'),
      desktopBridge.cancelGameNotificationType('incident'),
    ]);
    if (!enabled) return false;
    const scheduled = [];
    if (state.expedition) scheduled.push(scheduleExpeditionNotification(state.expedition));
    if (state.pendingIncident && Number(state.pendingIncident.scheduledAt) > Date.now()) {
      scheduled.push(scheduleIncidentNotification(state.pendingIncident));
    }
    await Promise.allSettled(scheduled);
    return permission?.granted === true;
  } catch (error) {
    ui.notificationPermission = 'unavailable';
    console.warn('Could not sync Android game notifications:', error);
    return false;
  }
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

function formatDateTime(timestamp) {
  const value = timestamp ? new Date(timestamp) : null;
  if (!value || Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(value);
}

function rarityEmblem(rarity, { hidden = false, compact = false } = {}) {
  if (hidden) return '<span class="rarity-emblem-fallback">???</span>';
  const label = rarityLabel(rarity);
  if (!RARITY_META[rarity]) {
    return `<span class="rarity-emblem-fallback ${compact ? 'is-compact' : ''}">${escapeHtml(label)}</span>`;
  }
  return `<img class="rarity-emblem ${compact ? 'rarity-emblem--compact' : ''}" src="./assets/ui/rarity-${rarity}.svg" alt="${escapeHtml(label)} 등급" />`;
}

const PACK_FLIP_THRESHOLD = RARITY_ORDER.indexOf('sr');
const LEGACY_RARITY_ALIASES = Object.freeze({
  common: 'c',
  rare: 'r',
  epic: 'sr',
  legendary: 'ssr',
});

function rarityRank(rarity) {
  const rank = RARITY_ORDER.indexOf(LEGACY_RARITY_ALIASES[rarity] || rarity);
  return rank < 0 ? 0 : rank;
}

function highestRarity(cards = []) {
  return cards.reduce((highest, card) => (
    rarityRank(card?.rarity) > rarityRank(highest) ? card.rarity : highest
  ), RARITY_ORDER[0]);
}

function cardEnhancement(card, state) {
  if (!card || !state) return 0;
  return bestEnhancementForCard(state.collection, state.cardEnhancements, card.id);
}

function cardPower(card, state = null, enhancement = null) {
  const stage = Number.isInteger(enhancement) ? enhancement : cardEnhancement(card, state);
  const enhancedPower = enhancedCardPower(cardExpeditionPower(card), stage);
  return cardCombatPowerAtLevel(enhancedPower, card, state?.cardProgression || {});
}

function enhancementLabel(stage) {
  return `+${Math.max(0, Math.min(MAX_ENHANCEMENT, Number(stage) || 0))}`;
}

function requiresPackReveal(card) {
  return rarityRank(card?.rarity) >= PACK_FLIP_THRESHOLD;
}

function cardDisplayName(card) {
  return card?.name || '';
}

function cardCharacterIdentity(cardId) {
  const card = cardById(cardId);
  return card?.characterId || card?.id || String(cardId || '');
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
    app.querySelector('.app-notice')?.remove();
  }, 3200);
}

function ownedUniqueCount(state) {
  const discovered = new Set(state.discoveredCardIds || []);
  return CARD_CATALOG.filter((card) => discovered.has(card.id)).length;
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
        <div class="auth-brand"><span>HC</span><div><strong>호이 카드 데스크</strong><small>독립 카드 게임</small></div></div>
        <div class="auth-intro-copy">
          <span class="eyebrow">PERSONNEL ARCHIVE</span>
          <h1>당신만의 인물 파일을<br />새 책상에서 이어가세요.</h1>
          <p>카드, 동전, 모험 기록을 클라우드에 안전하게 보관하고 PC와 모바일에서 이어서 플레이합니다.</p>
        </div>
        <div class="auth-security-note"><i data-lucide="lock"></i><span><strong>카드 데스크 전용 계정</strong><small>PC와 모바일의 진행 기록을 안전하게 동기화합니다.</small></span></div>
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
  const pendingMailCount = ui.mailbox.items.filter((mail) => (
    mail.status === 'pending'
    && (!mail.readAt || mail.rewards.coins || mail.rewards.standardPacks)
  )).length;
  const nav = Object.entries(views).map(([id, view]) => `
    <button class="nav-button ${ui.view === id ? 'is-active' : ''}" type="button" data-action="navigate" data-view="${id}" aria-label="${view.label}" title="${view.label}">
      <i data-lucide="${view.icon}"></i>
      <span>${view.label}</span>
      ${id === 'dashboard' && state.activeIncident ? '<span class="nav-alert" aria-label="새 돌발 업무"></span>' : ''}
      ${id === 'mailbox' && pendingMailCount ? `<span class="nav-count" aria-label="수령 가능한 우편 ${pendingMailCount}개">${Math.min(99, pendingMailCount)}</span>` : ''}
    </button>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">HC</div>
        <div class="brand-copy">
          <strong>호이 카드 데스크</strong>
          <span>독립 카드 게임</span>
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
        <button class="quiet-button donation-button" type="button" data-action="open-donation" title="도네이션" aria-label="도네이션">
          <i data-lucide="gift"></i>
          <span>도네이션</span>
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

function renderDeckPresetPanel(state) {
  return `
    <section class="deck-preset-panel" aria-labelledby="deck-preset-title">
      <div class="section-heading section-heading--compact">
        <div><span class="eyebrow">DECK PRESETS</span><h2 id="deck-preset-title">덱 프리셋</h2></div>
        <span>최대 ${MAX_DECK_PRESETS}개</span>
      </div>
      <div class="deck-preset-list">
        ${Array.from({ length: MAX_DECK_PRESETS }, (_, slot) => {
          const preset = state.deckPresets?.[slot] || null;
          const cards = preset?.cardIds?.map(cardById).filter(Boolean) || [];
          const equipment = equipmentById(state.equipmentInventory, preset?.equipmentCardId);
          return `<article class="deck-preset-card ${preset ? '' : 'is-empty'}">
            <div class="deck-preset-heading"><span>${slot + 1}</span><strong>${escapeHtml(preset?.name || `프리셋 ${slot + 1}`)}</strong></div>
            <div class="deck-preset-members">
              ${Array.from({ length: MAX_SQUAD_SIZE }, (_, index) => {
                const card = cards[index];
                return card ? `<img src="${card.image}" alt="${escapeHtml(cardDisplayName(card))}" title="${escapeHtml(cardDisplayName(card))}" />` : '<span aria-label="빈 카드 슬롯">+</span>';
              }).join('')}
            </div>
            <small>${equipment ? escapeHtml(equipmentEffectText(equipment)) : '장비 없음'} · 유물 출시 예정</small>
            <div class="deck-preset-actions">
              ${preset ? `<button type="button" data-action="load-deck-preset" data-slot="${slot}" data-context="adventure">모험 불러오기</button><button type="button" data-action="load-deck-preset" data-slot="${slot}" data-context="raid">레이드 불러오기</button>` : ''}
              <button type="button" data-action="save-deck-preset" data-slot="${slot}" data-context="adventure">모험 덱 ${preset ? '덮어쓰기' : '저장'}</button>
              <button type="button" data-action="save-deck-preset" data-slot="${slot}" data-context="raid">레이드 덱 ${preset ? '덮어쓰기' : '저장'}</button>
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>`;
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
            ${pendingPackOpening ? `
              <button class="primary-button" type="button" data-action="resume-pack-opening">
                <i data-lucide="sparkles"></i>미확인 카드 이어보기
              </button>
            ` : `
              <div class="pack-open-buttons">
                <button class="primary-button" type="button" data-action="open-pack" data-pack-count="1" ${state.packs.standard <= 0 ? 'disabled' : ''}>
                  <i data-lucide="package-open"></i>1팩 개봉 · 5장
                </button>
                ${state.packs.standard >= 10 ? `
                  <button class="primary-button pack-open-ten" type="button" data-action="open-pack" data-pack-count="10">
                    <i data-lucide="sparkles"></i>10팩 한 번에 개봉 · 50장
                  </button>
                ` : ''}
              </div>
            `}
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
          <div><dt>클라우드 동기화</dt><dd>${ui.cloud.phase === 'active' ? '연결됨' : '확인 중'}</dd></div>
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
            <span>주기적으로 도착하며 특별한 업무도 기다리고 있어요.</span>
          </div>
        `}
      </section>

      ${renderDeckPresetPanel(state)}

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
  const state = options.state || null;
  const discovered = Boolean(count) || new Set(state?.discoveredCardIds || []).has(card.id);
  const hidden = !discovered;
  const owned = Number(count) > 0;
  const selectable = options.selectable && count;
  const selected = options.selected;
  const enhancement = hidden ? 0 : cardEnhancement(card, state);
  const progression = hidden ? { level: 1 } : progressionForCard(state?.cardProgression, card.id);
  const locked = new Set(state?.lockedCardIds || []).has(card.id);
  return `
    <article class="collection-card rarity-${card.rarity} ${hidden ? 'is-hidden' : ''} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}">
      <button class="card-hitbox" type="button" data-action="${selectable ? 'toggle-squad' : 'open-card'}" data-card-id="${card.id}" ${hidden ? 'disabled' : ''}>
        <div class="card-art">
          <img class="card-illustration" src="${card.image}" alt="${hidden ? '미발견 카드' : escapeHtml(cardDisplayName(card))}" loading="lazy" />
          <span class="rarity-stamp">${rarityEmblem(card.rarity, { hidden })}</span>
          ${hidden ? '' : `<span class="card-power">전투력 ${formatNumber(cardPower(card, state))}</span><span class="enhancement-badge">${enhancementLabel(enhancement)}</span>`}
          ${locked ? '<span class="card-lock-badge" title="잠금됨"><i data-lucide="lock"></i></span>' : ''}
          ${selected ? '<span class="selection-check"><i data-lucide="check"></i></span>' : ''}
        </div>
        <div class="card-copy">
          <span>${hidden ? '미발견' : escapeHtml(card.department)}</span>
          <strong>${hidden ? '기록 없음' : escapeHtml(cardDisplayName(card))}</strong>
          <small>${hidden ? '카드팩에서 발견할 수 있습니다.' : `${escapeHtml(card.category)} · Lv.${formatNumber(progression.level)} · ${formatNumber(count)}장 보유${owned ? ` · 최고 ${enhancementLabel(enhancement)}` : ' · 획득 기록 보존'}`}</small>
        </div>
        <div class="card-stats card-stats--combat" aria-label="카드 전투 능력치">
          <span><b>공격력</b>${hidden ? '-' : formatNumber(cardPower(card, state))}</span>
        </div>
      </button>
    </article>
  `;
}

function collectionCardsForView(state) {
  const query = ui.collectionQuery.trim().toLowerCase();
  return CARD_CATALOG.filter((card) => {
    if (ui.rarityFilter !== 'all' && card.rarity !== ui.rarityFilter) return false;
    if (ui.collectionOwnedOnly && Math.max(0, Number(state.collection[card.id]) || 0) <= 0) return false;
    if (!query) return true;
    return `${card.name} ${card.department} ${card.category}`.toLowerCase().includes(query);
  }).sort((left, right) => {
    const direction = ui.collectionSort === 'rarity-desc' ? -1 : 1;
    const rarityDelta = (rarityRank(left.rarity) - rarityRank(right.rarity)) * direction;
    if (rarityDelta) return rarityDelta;
    return CARD_CATALOG.indexOf(left) - CARD_CATALOG.indexOf(right);
  });
}

function selectedEquipment(state, context) {
  const equipmentId = context === 'raid'
    ? state.selectedRaidEquipmentId
    : state.selectedExpeditionEquipmentId;
  return equipmentById(state.equipmentInventory, equipmentId);
}

function equipmentEffectText(item) {
  if (!item) return '장착 없음';
  const effect = item.type === EQUIPMENT_TYPES.armor.id ? '파티 HP' : '파티 공격력';
  return `${rarityLabel(item.rarity)} ${EQUIPMENT_TYPES[item.type]?.label || '장비'} · ${effect} +${Number(item.bonusPercent).toFixed(1)}%`;
}

function renderLoadoutSlots(state, context) {
  const equipmentId = context === 'raid'
    ? state.selectedRaidEquipmentId
    : state.selectedExpeditionEquipmentId;
  const inventory = Array.isArray(state.equipmentInventory) ? state.equipmentInventory : [];
  return `
    <div class="loadout-slots" aria-label="추가 장착 카드">
      <label class="loadout-slot">
        <span><i data-lucide="shield"></i><b>장비 카드</b></span>
        <select data-action="select-equipment" data-context="${context}">
          <option value="">장착 없음</option>
          ${inventory.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === equipmentId ? 'selected' : ''}>${escapeHtml(equipmentEffectText(item))}</option>`).join('')}
        </select>
      </label>
      <label class="loadout-slot is-coming-soon">
        <span><i data-lucide="sparkles"></i><b>유물 카드</b></span>
        <select disabled><option>출시 예정</option></select>
      </label>
    </div>`;
}

function renderCollection(state) {
  const cards = collectionCardsForView(state);

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
      <div class="collection-view-controls">
        <button type="button" class="collection-owned-toggle ${ui.collectionOwnedOnly ? 'is-active' : ''}" data-action="toggle-owned-cards" aria-pressed="${ui.collectionOwnedOnly ? 'true' : 'false'}">
          <i data-lucide="${ui.collectionOwnedOnly ? 'check' : 'library'}"></i>
          보유중 카드만 보기
        </button>
        <div class="segmented-control collection-sort-control" role="group" aria-label="카드 정렬">
          <button type="button" class="${ui.collectionSort === 'rarity-asc' ? 'is-active' : ''}" data-action="sort-collection" data-sort="rarity-asc">등급 낮은순</button>
          <button type="button" class="${ui.collectionSort === 'rarity-desc' ? 'is-active' : ''}" data-action="sort-collection" data-sort="rarity-desc">등급 높은순</button>
        </div>
      </div>
    </div>
    <div class="collection-grid">
      ${cards.length
        ? cards.map((card) => renderCard(card, state.collection[card.id] || 0, { state })).join('')
        : '<div class="empty-results"><i data-lucide="search"></i><strong>조건에 맞는 기록이 없습니다.</strong></div>'}
    </div>
  `;
}

function activeExpeditionCardLocks(state) {
  return expeditionCardLocks(state.expedition);
}

function availableEnhancementCounts(state, cardId) {
  return enhancementAvailability(state, cardId).available;
}

function enhancementAvailability(state, cardId) {
  return cardEnhancementAvailability({
    collection: state.collection,
    cardEnhancements: state.cardEnhancements,
    cardId,
    lockedCards: activeExpeditionCardLocks(state),
    protectedCardIds: state.lockedCardIds,
  });
}

function syncEnhancementSelection(state) {
  const cards = ALL_CARDS.filter((card) => (
    Number(state.collection[card.id]) > 0
    && enhancementAvailability(state, card.id).canEnhance
  ));
  if (!cards.some((card) => card.id === ui.enhanceCardId)) {
    ui.enhanceCardId = cards[0]?.id || '';
  }
  const card = cardById(ui.enhanceCardId);
  if (!card) {
    ui.enhanceTargetStage = null;
    ui.enhanceMaterialStage = null;
    return null;
  }

  const available = availableEnhancementCounts(state, card.id);
  const targetStages = available
    .map((count, stage) => ({ count, stage }))
    .filter(({ count, stage }) => count > 0 && stage < MAX_ENHANCEMENT)
    .map(({ stage }) => stage);
  if (!targetStages.includes(Number(ui.enhanceTargetStage))) {
    ui.enhanceTargetStage = targetStages.at(-1) ?? null;
  }
  const materialStages = available
    .map((count, stage) => ({
      stage,
      count: count - (stage === ui.enhanceTargetStage ? 1 : 0),
    }))
    .filter(({ count }) => count > 0)
    .map(({ stage }) => stage);
  if (!materialStages.includes(Number(ui.enhanceMaterialStage))) {
    ui.enhanceMaterialStage = materialStages[0] ?? null;
  }
  return card;
}

function renderEnhancementPanel(state) {
  const selectedCard = syncEnhancementSelection(state);
  const ownedCards = ALL_CARDS.filter((card) => Number(state.collection[card.id]) > 0);
  if (!selectedCard) {
    return '<div class="management-empty"><i data-lucide="library"></i><strong>지금 강화할 수 있는 카드가 없습니다.</strong><span>잠금되지 않았고 모험 중이 아닌 동일 카드가 최소 2장 필요합니다.</span></div>';
  }

  const counts = enhancementCountsForCard(state.collection, state.cardEnhancements, selectedCard.id);
  const available = availableEnhancementCounts(state, selectedCard.id);
  const locked = counts.map((count, stage) => Math.max(0, count - available[stage]));
  const targetStage = Number(ui.enhanceTargetStage);
  const materialStage = Number(ui.enhanceMaterialStage);
  const hasTarget = Number.isInteger(targetStage) && targetStage >= 0 && targetStage < MAX_ENHANCEMENT;
  const availableMaterials = hasTarget
    ? available.map((count, stage) => Math.max(0, count - (stage === targetStage ? 1 : 0)))
    : Array(MAX_ENHANCEMENT + 1).fill(0);
  const hasMaterial = Number.isInteger(materialStage) && availableMaterials[materialStage] > 0;
  const successRate = hasTarget ? ENHANCEMENT_SUCCESS_RATES[targetStage] : 0;
  const currentPower = hasTarget ? cardPower(selectedCard, state, targetStage) : cardPower(selectedCard, state);
  const nextPower = hasTarget ? cardPower(selectedCard, state, targetStage + 1) : currentPower;

  return `
    <div class="management-workspace enhancement-workspace">
      <aside class="management-inventory" aria-label="강화 카드 목록">
        <div class="management-list-heading"><strong>보유 카드</strong><span>${formatNumber(ownedCards.length)}종</span></div>
        <div class="management-card-list">
          ${ownedCards.map((card) => {
            const best = cardEnhancement(card, state);
            const availability = enhancementAvailability(state, card.id);
            const lockedCount = availability.locked.reduce((sum, value) => sum + value, 0);
            const availableCount = availability.available.reduce((sum, value) => sum + value, 0);
            const onlyMaxedCopies = availability.counts[MAX_ENHANCEMENT] > 0
              && availability.counts.slice(0, MAX_ENHANCEMENT).every((count) => count === 0);
            const unavailableLabel = availability.protectedCard
              ? '잠금됨'
              : onlyMaxedCopies
                ? '최대 강화'
                : lockedCount > 0
                  ? `모험 ${formatNumber(lockedCount)}장 · 재료 부족`
                  : availableCount < 2
                    ? '동일 카드 부족'
                    : '강화 조합 없음';
            return `
              <button type="button" class="management-card-choice rarity-${card.rarity} ${card.id === selectedCard.id ? 'is-selected' : ''}" data-action="select-enhance-card" data-card-id="${card.id}" aria-pressed="${card.id === selectedCard.id}" ${availability.canEnhance ? '' : 'disabled'}>
                <img src="${card.image}" alt="" loading="lazy" />
                <span><strong>${escapeHtml(cardDisplayName(card))}</strong><small>${rarityLabel(card.rarity)} · ${formatNumber(state.collection[card.id])}장</small></span>
                <b>${availability.canEnhance ? enhancementLabel(best) : unavailableLabel}</b>
              </button>`;
          }).join('')}
        </div>
      </aside>

      <section class="management-console" aria-labelledby="enhancement-card-title">
        <div class="enhancement-focus rarity-${selectedCard.rarity}">
          <div class="enhancement-focus__art">
            <img class="card-illustration" src="${selectedCard.image}" alt="${escapeHtml(cardDisplayName(selectedCard))}" />
            <span class="rarity-stamp">${rarityEmblem(selectedCard.rarity)}</span>
            <span class="enhancement-badge">${enhancementLabel(hasTarget ? targetStage : cardEnhancement(selectedCard, state))}</span>
          </div>
          <div class="enhancement-focus__copy">
            <span class="eyebrow">${escapeHtml(selectedCard.department)} / ${rarityLabel(selectedCard.rarity)}</span>
            <h3 id="enhancement-card-title">${escapeHtml(cardDisplayName(selectedCard))}</h3>
            <p>동일한 카드를 재료로 사용해 전투력과 향후 고유 스킬의 강화 단계를 올립니다.</p>
            <div class="enhancement-power-preview">
              <span><small>현재 전투력</small><strong>${formatNumber(currentPower)}</strong></span>
              <i data-lucide="arrow-right"></i>
              <span><small>성공 시 전투력</small><strong>${formatNumber(nextPower)}</strong></span>
            </div>
          </div>
        </div>

        <div class="enhancement-step-section">
          <div class="subheading"><h3>강화 대상 단계</h3><span>보유 복사본 선택</span></div>
          <div class="enhancement-stage-grid">
            ${counts.map((count, stage) => `
              <button type="button" class="enhancement-stage ${stage === targetStage ? 'is-selected' : ''}" data-action="select-enhance-target" data-enhancement="${stage}" ${stage >= MAX_ENHANCEMENT || available[stage] <= 0 ? 'disabled' : ''}>
                <strong>${enhancementLabel(stage)}</strong><span>${formatNumber(count)}장${locked[stage] ? ` · 모험 ${formatNumber(locked[stage])}` : ''}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="enhancement-step-section">
          <div class="subheading"><h3>소모할 동일 카드</h3><span>강화 단계와 무관하게 1장 소모</span></div>
          <div class="enhancement-stage-grid is-material">
            ${counts.map((count, stage) => `
              <button type="button" class="enhancement-stage ${stage === materialStage ? 'is-selected' : ''}" data-action="select-enhance-material" data-enhancement="${stage}" ${availableMaterials[stage] <= 0 ? 'disabled' : ''}>
                <strong>${enhancementLabel(stage)}</strong><span>사용 가능 ${formatNumber(availableMaterials[stage])}장</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="management-action-bar">
          <div><span>성공 확률</span><strong>${Math.round(successRate * 100)}%</strong><small>실패해도 대상 단계는 유지되며 재료는 소모됩니다.</small></div>
          <button class="primary-button" type="button" data-action="enhance-card" ${hasTarget && hasMaterial ? '' : 'disabled'}><i data-lucide="sparkles"></i>${hasTarget ? `${enhancementLabel(targetStage + 1)} 강화 시도` : '강화 가능한 카드 없음'}</button>
        </div>
      </section>
    </div>
  `;
}

function synthesisSelectionCount(cardId, enhancement) {
  return ui.synthesisMaterials.filter((material) => (
    material.cardId === cardId && Number(material.enhancement) === Number(enhancement)
  )).length;
}

function sanitizeSynthesisSelection(state) {
  const locks = lockedEnhancementCounts(
    state.collection,
    state.cardEnhancements,
    activeExpeditionCardLocks(state),
  );
  const selected = [];
  const used = {};
  let rarity = '';
  for (const raw of Array.isArray(ui.synthesisMaterials) ? ui.synthesisMaterials : []) {
    const card = cardById(raw.cardId);
    const stage = Math.floor(Number(raw.enhancement));
    if (!card || !RARITY_META[card.rarity] || stage < 0 || stage > MAX_ENHANCEMENT) continue;
    if (new Set(state.lockedCardIds || []).has(card.id)) continue;
    if (!rarity) rarity = card.rarity;
    if (card.rarity !== rarity) continue;
    const key = `${card.id}:${stage}`;
    const counts = enhancementCountsForCard(state.collection, state.cardEnhancements, card.id);
    const available = Math.max(0, counts[stage] - (locks[card.id]?.[stage] || 0));
    if ((used[key] || 0) >= available) continue;
    used[key] = (used[key] || 0) + 1;
    selected.push({ cardId: card.id, enhancement: stage });
    if (selected.length === SYNTHESIS_MATERIAL_COUNT) break;
  }
  ui.synthesisMaterials = selected;
  if (rarity && selected.length) ui.synthesisRarity = rarity;
  if (!RARITY_ORDER.slice(0, -1).includes(ui.synthesisRarity)) ui.synthesisRarity = RARITY_ORDER[0];
  return locks;
}

function renderSynthesisPanel(state) {
  const locks = sanitizeSynthesisSelection(state);
  const selectedRarity = ui.synthesisMaterials.length
    ? cardById(ui.synthesisMaterials[0].cardId)?.rarity
    : ui.synthesisRarity;
  const resultRarity = RARITY_ORDER[RARITY_ORDER.indexOf(selectedRarity) + 1];
  const synthesisSuccessRate = synthesisSuccessRateForRarity(selectedRarity);
  const selectedCards = ui.synthesisMaterials.map((material) => ({
    ...material,
    card: cardById(material.cardId),
  }));
  const candidates = CARD_CATALOG.filter((card) => (
    card.rarity === selectedRarity
      && Number(state.collection[card.id]) > 0
      && !new Set(state.lockedCardIds || []).has(card.id)
  ));
  const containsEnhancedCard = selectedCards.some(({ enhancement }) => Number(enhancement) > 0);
  const batchMaterialCount = availableSynthesisMaterialCountForRarity({
    collection: state.collection,
    cardEnhancements: state.cardEnhancements,
    catalog: CARD_CATALOG,
    rarityOrder: RARITY_ORDER,
    rarity: selectedRarity,
    lockedCardIds: activeExpeditionCardLocks(state),
    protectedCardIds: state.lockedCardIds,
  });

  return `
    <div class="synthesis-workspace">
      <section class="synthesis-machine" aria-labelledby="synthesis-title">
        <div class="section-heading section-heading--compact">
          <div><span class="eyebrow">FIVE INTO ONE</span><h3 id="synthesis-title">합성 재료 5장</h3></div>
          <button class="secondary-button compact-button" type="button" data-action="clear-synthesis-materials" ${selectedCards.length ? '' : 'disabled'}>선택 초기화</button>
        </div>
        <div class="synthesis-slots">
          ${Array.from({ length: SYNTHESIS_MATERIAL_COUNT }, (_, index) => {
            const material = selectedCards[index];
            if (!material?.card) return '<div class="synthesis-slot is-empty"><span>+</span><small>재료 카드</small></div>';
            return `
              <button type="button" class="synthesis-slot rarity-${material.card.rarity}" data-action="remove-synthesis-material" data-material-index="${index}" title="선택 해제">
                <img src="${material.card.image}" alt="" />
                <span>${enhancementLabel(material.enhancement)}</span>
                <strong>${escapeHtml(material.card.characterName || material.card.name)}</strong>
              </button>`;
          }).join('')}
        </div>
        <div class="synthesis-outcome">
          <div class="synthesis-orbit" aria-hidden="true"><i data-lucide="sparkles"></i></div>
          <span class="rarity-preview rarity-${resultRarity}">${rarityEmblem(resultRarity)}</span>
          <div><small>성공 시 다음 등급 랜덤 카드</small><strong>${rarityLabel(selectedRarity)} → ${rarityLabel(resultRarity)}</strong><span>실패 시 ${rarityLabel(selectedRarity)} 랜덤 카드 1장 반환</span></div>
        </div>
        ${containsEnhancedCard ? '<p class="material-warning"><i data-lucide="circle-alert"></i>강화된 카드가 포함되어 있습니다. 합성하면 강화 단계도 함께 사라집니다.</p>' : ''}
        <div class="management-action-bar synthesis-action-bar">
          <div><span>${rarityLabel(selectedRarity)} 합성 성공 확률</span><strong>${Math.round(synthesisSuccessRate * 100)}%</strong><small>성공과 실패 모두 선택한 5장을 소모합니다.</small></div>
          <button class="primary-button" type="button" data-action="synthesize-cards" ${selectedCards.length === SYNTHESIS_MATERIAL_COUNT ? '' : 'disabled'}><i data-lucide="sparkles"></i>카드 합성</button>
        </div>
      </section>

      <aside class="synthesis-inventory">
        <div class="synthesis-toolbar">
          <div class="segmented-control synthesis-rarity-tabs" role="tablist" aria-label="합성 등급">
            ${RARITY_ORDER.slice(0, -1).map((rarity) => `
              <button type="button" class="${selectedRarity === rarity ? 'is-active' : ''}" data-action="select-synthesis-rarity" data-rarity="${rarity}" ${ui.synthesisMaterials.length && selectedRarity !== rarity ? 'disabled' : ''}>${rarityLabel(rarity)}</button>
            `).join('')}
          </div>
          <div class="synthesis-quick-actions">
            <button class="secondary-button" type="button" data-action="auto-fill-synthesis"><i data-lucide="refresh-cw"></i>+0 낮은 등급 자동 넣기</button>
            <button class="primary-button synthesis-batch-button" type="button" data-action="batch-synthesize-cards" ${batchMaterialCount >= SYNTHESIS_MATERIAL_COUNT ? '' : 'disabled'}><i data-lucide="sparkles"></i>${rarityLabel(selectedRarity)} 일괄 합성</button>
          </div>
          <small class="synthesis-batch-count">일괄 합성 가능 +0 카드 ${formatNumber(batchMaterialCount)}장</small>
        </div>
        <p class="synthesis-rule">같은 등급 카드만 함께 넣을 수 있습니다. 일괄 합성은 선택한 등급의 +0 카드만 사용하며, 모험 참여 카드·강화 카드·잠금 카드는 자동으로 보호됩니다.</p>
        <div class="synthesis-card-list">
          ${candidates.length ? candidates.map((card) => {
            const counts = enhancementCountsForCard(state.collection, state.cardEnhancements, card.id);
            return `
              <article class="synthesis-card-row rarity-${card.rarity}">
                <img src="${card.image}" alt="" loading="lazy" />
                <div class="synthesis-card-copy"><strong>${escapeHtml(cardDisplayName(card))}</strong><small>${formatNumber(state.collection[card.id])}장 보유</small></div>
                <div class="synthesis-stage-actions">
                  ${counts.map((count, stage) => {
                    if (!count) return '';
                    const selectedCount = synthesisSelectionCount(card.id, stage);
                    const available = Math.max(0, count - (locks[card.id]?.[stage] || 0));
                    return `<span class="synthesis-stage-control"><b>${enhancementLabel(stage)}</b><small>${selectedCount}/${available}</small><button type="button" data-action="add-synthesis-material" data-card-id="${card.id}" data-enhancement="${stage}" ${selectedCards.length >= SYNTHESIS_MATERIAL_COUNT || selectedCount >= available ? 'disabled' : ''} aria-label="${escapeHtml(cardDisplayName(card))} ${enhancementLabel(stage)} 합성 재료 추가">+</button></span>`;
                  }).join('')}
                </div>
              </article>`;
          }).join('') : '<div class="management-empty compact"><i data-lucide="library"></i><strong>이 등급의 보유 카드가 없습니다.</strong></div>'}
        </div>
      </aside>
    </div>
  `;
}

function renderManagement(state) {
  return `
    <section class="management-page">
      <div class="management-tabs" role="tablist" aria-label="카드 관리 메뉴">
        <button type="button" role="tab" aria-selected="${ui.managementPanel === 'enhance'}" class="${ui.managementPanel === 'enhance' ? 'is-active' : ''}" data-action="switch-management-panel" data-management-panel="enhance"><i data-lucide="zap"></i><span><strong>카드 강화</strong><small>동일 카드로 +5까지 성장</small></span></button>
        <button type="button" role="tab" aria-selected="${ui.managementPanel === 'synthesis'}" class="${ui.managementPanel === 'synthesis' ? 'is-active' : ''}" data-action="switch-management-panel" data-management-panel="synthesis"><i data-lucide="sparkles"></i><span><strong>카드 합성</strong><small>같은 등급 5장을 1장으로</small></span></button>
      </div>
      <div class="management-intro">
        <div><span class="eyebrow">CARD LABORATORY</span><h2>${ui.managementPanel === 'enhance' ? '같은 카드를 모아 전력을 높이세요.' : '남는 카드를 새로운 한 장으로 바꾸세요.'}</h2></div>
        <p>${ui.managementPanel === 'enhance' ? '동일한 카드 한 장을 재료로 사용하며, 성공할수록 다음 강화의 성공 확률이 낮아집니다.' : '합성 성공률은 등급에 따라 60%부터 10%까지 낮아지며, 실패해도 같은 등급 카드 1장을 돌려받습니다.'}</p>
      </div>
      ${ui.managementPanel === 'synthesis' ? renderSynthesisPanel(state) : renderEnhancementPanel(state)}
    </section>
  `;
}

function renderSquadPicker(state, context) {
  const ownedCards = ALL_CARDS
    .filter((card) => state.collection[card.id])
    .sort((left, right) => (
      rarityRank(right.rarity) - rarityRank(left.rarity)
      || cardPower(right, state) - cardPower(left, state)
      || ALL_CARDS.indexOf(left) - ALL_CARDS.indexOf(right)
    ));
  const selectedIds = context === 'raid'
    ? (state.selectedRaidSquad || [])
    : (state.selectedExpeditionSquad || state.selectedSquad || []);
  const expeditionLocks = context === 'raid' ? activeExpeditionCardLocks(state) : [];
  return `
    <div class="squad-picker" data-context="${context}">
      ${ownedCards.map((card) => {
        const selected = selectedIds.includes(card.id);
        const availableStage = context === 'raid'
          ? bestAvailableEnhancementForCard(
            state.collection,
            state.cardEnhancements,
            card.id,
            expeditionLocks,
          )
          : cardEnhancement(card, state);
        const unavailable = availableStage < 0 || (context === 'raid' && !skillForCard(card.id, Math.max(0, availableStage)));
        const selectionOrder = selected ? selectedIds.indexOf(card.id) + 1 : 0;
        return `
          <div class="squad-card-shell">
          <button class="squad-card rarity-${card.rarity} ${selected ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}" type="button" data-action="toggle-squad" data-context="${context}" data-card-id="${card.id}" ${unavailable ? 'disabled' : ''} aria-pressed="${selected ? 'true' : 'false'}">
            <img class="squad-card__art" src="${card.image}" alt="" />
            <span><strong>${escapeHtml(cardDisplayName(card))}</strong><small><b>${rarityLabel(card.rarity)} · Lv.${formatNumber(progressionForCard(state.cardProgression, card.id).level)} · ${enhancementLabel(Math.max(0, availableStage))}</b><span class="squad-detail-copy">${unavailable ? (availableStage < 0 ? ' · 모든 복사본이 모험 참여 중 · 레이드 사용 불가' : ' · 고유 스킬 준비 중 · 레이드 사용 불가') : ` · 전투력 ${formatNumber(cardPower(card, state, availableStage))}`}</span></small></span>
            ${selectionOrder ? `<b class="squad-order-badge" aria-label="행동 순서 ${selectionOrder}번">${selectionOrder}</b>` : `<i data-lucide="${unavailable ? 'lock' : 'users'}"></i>`}
          </button>
          <button class="squad-card-info" type="button" data-action="open-card" data-card-id="${card.id}" aria-label="${escapeHtml(cardDisplayName(card))} 상세 정보"><i data-lucide="search"></i></button>
          </div>
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
  const expeditionEquipment = selectedEquipment(state, 'adventure');
  const score = calculateSquadScore(expeditionSquad, state.collection, ALL_CARDS, state.cardEnhancements, [], state.cardProgression, expeditionEquipment);
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
              const stage = Number(active.enhancementStages?.[id] ?? cardEnhancement(card, state)) || 0;
              return `<div class="rarity-${card.rarity}"><img src="${card.image}" alt="" /><span>${escapeHtml(card.name)}</span><small>${rarityLabel(card.rarity)} · ${enhancementLabel(stage)}</small></div>`;
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
           ${renderLoadoutSlots(state, 'adventure')}
           <div class="subheading"><h3>파견 카드</h3><span>${expeditionSquad.length} / ${MAX_SQUAD_SIZE}</span></div>
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
        <div><span class="eyebrow">WEEKLY TOTAL DAMAGE</span><h2 id="contribution-title">이번 주 개인 레이드 랭킹</h2></div>
        <button class="icon-button" type="button" data-action="refresh-raid-ranking" title="랭킹 새로고침" aria-label="랭킹 새로고침" ${ui.raid.loading ? 'disabled' : ''}><i data-lucide="refresh-cw"></i></button>
      </div>
      <div class="ranking-reset-line">
        <span>매주 월요일 00:00 대한민국 시간 초기화</span>
        ${resetsAt ? `<strong>초기화까지 <span data-countdown="${resetsAt}">${formatDuration(resetsAt - Date.now())}</span></strong>` : ''}
      </div>
      <div class="table-row table-head"><span>순위</span><span>사원</span><span>현재 단계</span><span>총 피해 점수</span></div>
      ${entries.length ? entries.map((entry) => `
        <div class="table-row ${entry.isMe ? 'is-me' : ''}">
          <span>${formatNumber(entry.rank)}</span>
          <span>${escapeHtml(entry.nickname)}</span>
          <span>${formatNumber(entry.stage || 1)}단계</span>
          <strong>${formatNumber(entry.contribution)}</strong>
        </div>
      `).join('') : `
        <div class="ranking-empty"><i data-lucide="trophy"></i><strong>이번 주 기록된 피해 점수가 없습니다.</strong><span>개인 레이드 전투를 마치면 즉시 순위에 반영됩니다.</span></div>
      `}
      ${ranking.myRank ? `<div class="my-ranking-summary"><span>내 현재 순위</span><strong>${formatNumber(ranking.myRank)}위</strong></div>` : ''}
      ${ui.raid.error ? `<p class="raid-sync-error"><i data-lucide="circle-alert"></i>${escapeHtml(ui.raid.error)}</p>` : ''}
    </section>
  `;
}

function renderRaidEffectIcon(rawEffect, owner, index) {
  const effect = effectPresentation(rawEffect);
  const icon = availableLucideIconNames.has(effect.icon) ? effect.icon : 'circle-alert';
  const shared = rawEffect?.shared === true || rawEffect?.scope === 'team';
  const count = effect.count ? `<b aria-label="${formatNumber(effect.count)}회 남음">${formatNumber(effect.count)}</b>` : '';
  return `<button class="raid-effect-icon is-${effect.tone}${shared ? ' is-shared' : ''}" type="button" data-action="inspect-raid-effect" data-effect-owner="${owner}" data-effect-index="${index}" title="${escapeHtml(effect.label)}" aria-label="${escapeHtml(`${effect.label}${effect.count ? ` ${formatNumber(effect.count)}회 남음` : ''} 정보 보기`)}"><i data-lucide="${escapeHtml(icon)}"></i>${shared ? '<em aria-hidden="true">파티</em>' : ''}${count}</button>`;
}

function renderRaidEffectList(effects, owner, label = '적용 중인 상태 효과') {
  const visibleEffects = Array.isArray(effects) ? effects : [];
  if (!visibleEffects.length) return '';
  return `<div class="raid-effect-list" aria-label="${escapeHtml(label)}">${visibleEffects.map((effect, index) => renderRaidEffectIcon(effect, owner, index)).join('')}</div>`;
}

function renderRaidBattleInspector(battle) {
  const inspector = ui.raid.inspector;
  if (!inspector) return '';
  if (inspector.type === 'skill-choice') {
    return `<aside class="raid-skill-tooltip raid-skill-choice" role="dialog" aria-label="구미신탁 효과 선택"><button type="button" data-action="close-raid-inspector" aria-label="닫기"><i data-lucide="x"></i></button><span class="eyebrow">구미신탁 · 길흉역전</span><h3>사용할 신탁을 선택하세요</h3><p>선택하는 즉시 이번 행동이 진행됩니다.</p><div class="raid-skill-choice-list"><button type="button" data-action="raid-skill-choice" data-choice="fortune"><strong>길</strong><small>전체 회복 · 약화 제거</small></button><button type="button" data-action="raid-skill-choice" data-choice="misfortune"><strong>흉</strong><small>강한 피해 · 브레이크</small></button><button type="button" data-action="raid-skill-choice" data-choice="reversal"><strong>역전</strong><small>전체 보호막 · 쿨다운 감소</small></button></div></aside>`;
  }
  if (inspector.type === 'effect') {
    const source = inspector.owner === 'boss'
      ? battle.boss.effects
      : battle.squad[Number(inspector.owner)]?.effects;
    const effect = source?.[inspector.index];
    if (!effect) return '';
    return `<aside class="raid-effect-tooltip is-${effect.tone}" role="dialog" aria-label="상태 효과 설명"><button type="button" data-action="close-raid-inspector" aria-label="닫기"><i data-lucide="x"></i></button><h3>${escapeHtml(effect.label)}${effect.count ? ` · ${formatNumber(effect.count)}` : ''}${effect.scope === 'team' ? '<span class="raid-effect-scope">파티 전체</span>' : ''}</h3><p>${escapeHtml(effect.description)}</p></aside>`;
  }
  const member = battle.squad[inspector.cardIndex];
  const card = cardById(member?.cardId);
  const skill = member ? skillForCard(member.cardId, member.enhancement) : null;
  if (!member || !card) return '';
  return `<aside class="raid-skill-tooltip" role="dialog" aria-label="카드 스킬 설명"><button type="button" data-action="close-raid-inspector" aria-label="닫기"><i data-lucide="x"></i></button><span class="eyebrow">${rarityLabel(card.rarity)} · ${enhancementLabel(member.enhancement)}</span><h3>${escapeHtml(skill?.name || '고유 스킬 준비 중')}</h3><p>${escapeHtml(skill?.description || '이 카드의 고유 스킬은 준비 중입니다.')}</p><dl><dt>공격력</dt><dd>${formatNumber(member.attack || cardPower(card, store?.getState(), member.enhancement))}</dd><dt>쿨타임</dt><dd>${skill?.oncePerBattle ? '전투당 1회' : `${formatNumber(skill?.cooldown || 0)}턴`}</dd><dt>현재 상태</dt><dd>${member.hp <= 0 ? '행동 불능' : member.cooldown > 0 ? `스킬 ${formatNumber(member.cooldown)}턴 남음` : '행동 가능'}</dd></dl></aside>`;
}

function renderPersonalRaidBattlefield(state) {
  const battle = normalizeRaidBattle(ui.raid.battle);
  const activeIndex = activeRaidCardIndex(battle);
  const playerTurn = isPlayerRaidTurn(battle);
  const remaining = raidTurnSecondsRemaining(battle);
  const bossHpRatio = Math.round((battle.boss.hp / battle.boss.maxHp) * 100);
  const animation = ui.raid.animation || {};
  const latestLog = battle.battleLog.at(-1)?.message || (battle.status === 'ready' ? '전투 시작을 기다리고 있습니다.' : '행동을 선택하세요.');
  const bossCard = cardById('deadline-dragon');
  const finished = raidBattleFinished(battle);
  const victory = battle.result === 'victory' || battle.boss.hp <= 0;
  const allDefeated = battle.terminationReason === 'party-defeated' || battle.squad.every((member) => member.hp <= 0);
  const turnLimited = battle.terminationReason === 'round-limit' || battle.result === 'turn-limit';
  const endTitle = victory ? '단계 클리어!' : allDefeated ? '아군 전원 행동불능' : turnLimited ? '7턴 전투 종료' : '도전 종료';
  const animationTargets = Array.isArray(animation.targets)
    ? animation.targets
    : animation.target == null ? [] : [animation.target];
  return `
    <section class="raid-battle-screen" aria-label="개인 레이드 전투 화면">
      <header class="raid-battle-topbar">
        <button class="raid-battle-exit" type="button" data-action="leave-raid-battle" ${ui.raid.finishing ? 'disabled' : ''}><i data-lucide="chevron-left"></i><span>편성으로 돌아가기</span></button>
        <div class="raid-boss-hud">
          <div class="raid-boss-title"><span>STAGE ${formatNumber(battle.stage)}</span><strong>${escapeHtml(battle.boss.name)}</strong></div>
          <div class="raid-boss-health-label"><span>HP${battle.boss.shield ? ` +${formatNumber(battle.boss.shield)}` : ''}</span><strong>${formatNumber(battle.boss.hp)} / ${formatNumber(battle.boss.maxHp)}</strong></div>
          <div class="raid-boss-health-track" role="progressbar" aria-valuenow="${battle.boss.hp}" aria-valuemax="${battle.boss.maxHp}"><span style="width:${bossHpRatio}%"></span></div>
          <div class="raid-break-label"><span>BREAK</span><strong>${formatNumber(battle.boss.breakGauge)} / 100</strong></div>
          <div class="raid-break-track" role="progressbar" aria-valuenow="${battle.boss.breakGauge}" aria-valuemax="100"><span style="width:${battle.boss.breakGauge}%"></span></div>
          <div class="raid-boss-effects">${renderRaidEffectList(battle.boss.effects, 'boss', '보스에게 적용 중인 상태 효과')}</div>
        </div>
        <div class="raid-turn-counter"><small>전투 턴</small><strong>${formatNumber(battle.turn || 1)}</strong></div>
      </header>
      <div class="raid-battle-arena">
        ${playerTurn ? `<div class="raid-battle-countdown ${remaining <= 5 ? 'is-urgent' : ''}" data-raid-turn-deadline="${battle.turnDeadlineAt}" aria-label="행동 제한 시간">${formatNumber(remaining)}</div>` : ''}
        <div class="raid-boss-zone">
          <div class="raid-boss-card ${battle.boss.stunned ? 'is-stunned' : ''} ${animation.attacker === 'boss' ? 'is-attacking' : ''} ${animationTargets.includes('boss') ? 'is-raid-hit' : ''}">
            <img src="${battle.boss.image || bossCard?.image || './assets/cards/deadline-dragon.webp'}" alt="${escapeHtml(battle.boss.name)}" />
            ${battle.boss.stunned ? '<span class="raid-stun-orbit" aria-label="브레이크 스턴"></span>' : ''}
          </div>
          ${animation.damageAmount ? `<strong class="raid-floating-number is-damage">${formatNumber(animation.damageAmount)}</strong>` : ''}
          ${animation.breakAmount ? `<strong class="raid-floating-number is-break">BREAK ${formatNumber(animation.breakAmount)}</strong>` : ''}
        </div>
        <div class="raid-squad-zone">
          ${battle.squad.map((member, index) => {
            const card = cardById(member.cardId);
            const skill = skillForCard(member.cardId, member.enhancement);
            const onTurn = index === activeIndex && playerTurn;
            const sealed = (member.statuses || []).some((status) => status.id === 'seal' && (status.charges == null || status.charges > 0));
            const skillUnavailable = sealed || member.skillCooldown > 0 || (skill?.oncePerBattle && member.skillUses > 0);
            return `<article class="raid-unit-slot rarity-${card?.rarity || 'c'} ${onTurn ? 'is-active' : ''} ${animation.attacker === index ? 'is-attacking' : ''}">
              ${onTurn ? `<div class="raid-card-actions"><button type="button" data-action="raid-basic-attack" ${ui.raid.battlePending ? 'disabled' : ''}>기본공격</button><button type="button" data-action="raid-skill-attack" ${ui.raid.battlePending || skillUnavailable ? 'disabled' : ''}>스킬${skillUnavailable ? `<small>${sealed ? '봉인됨' : skill?.oncePerBattle && member.skillUses > 0 ? '사용 완료' : `${formatNumber(member.skillCooldown)}턴 남음`}</small>` : ''}</button></div>` : ''}
              <button class="raid-unit-card ${member.hp <= 0 ? 'is-ko' : ''} ${animationTargets.includes(index) ? 'is-raid-hit' : ''}" type="button" data-action="inspect-raid-card" data-card-index="${index}" data-payroll-label="${escapeHtml(`${rarityLabel(card?.rarity)} · ${cardDisplayName(card)}`)}">
                <span class="raid-unit-number">${index + 1}</span>
                <img src="${card?.image || member.image}" alt="${escapeHtml(cardDisplayName(card))}" />
                <span class="raid-unit-name">${escapeHtml(cardDisplayName(card))} ${enhancementLabel(member.enhancement)}</span>
              </button>
              <div class="raid-unit-effects">${renderRaidEffectList(member.effects, String(index), `${cardDisplayName(card)}에게 적용 중인 상태 효과`)}</div>
              <div class="raid-unit-hp"><div class="raid-unit-hp-label"><span>HP${member.shield ? ` +${formatNumber(member.shield)}` : ''}</span><strong>${formatNumber(member.hp)} / ${formatNumber(member.maxHp)}</strong></div><div class="raid-unit-hp-track"><span style="width:${Math.round(member.hp / member.maxHp * 100)}%"></span></div></div>
            </article>`;
          }).join('')}
        </div>
        <div class="raid-battle-message" aria-live="polite">${escapeHtml(animation.message || latestLog)}</div>
      </div>
      ${battle.status === 'ready' ? `<div class="raid-battle-start-panel"><div class="raid-battle-start-card"><span class="eyebrow">PERSONAL RAID · STAGE ${formatNumber(battle.stage)}</span><h2>전투 준비 완료</h2><p>편성 순서대로 카드가 행동합니다. 내 차례에는 20초 안에 기본공격이나 스킬을 선택하세요. 전투는 최대 7턴 진행됩니다.</p><button class="alert-button" type="button" data-action="begin-raid-battle" ${ui.raid.battlePending ? 'disabled' : ''}><i data-lucide="swords"></i>${ui.raid.battlePending ? '전투 준비 중' : '전투 시작'}</button></div></div>` : ''}
      ${finished ? `<div class="raid-battle-result-panel"><div class="raid-battle-result-card"><span class="eyebrow">${victory ? 'RAID CLEAR' : 'BATTLE ENDED'}</span><h2>${endTitle}</h2><p>이번 도전 획득 점수</p><strong class="raid-earned-score">${formatNumber(battle.totalDamage || 0)}</strong><small>보스에게 실제로 입힌 총 피해량입니다.</small><button class="primary-button" type="button" data-action="finish-raid-battle" ${ui.raid.finishing ? 'disabled' : ''}>${ui.raid.finishing ? '점수 저장 중' : '점수 반영하기'}</button></div></div>` : ''}
      ${animation.skillCutIn ? `<div class="raid-skill-cut-in"><img src="${escapeHtml(animation.skillCutIn.image)}" alt="" /><strong>${escapeHtml(animation.skillCutIn.name)}</strong></div>` : ''}
      ${renderRaidBattleInspector(battle)}
    </section>`;
}

function renderPersonalRaidBattle(state) {
  if (ui.raid.battle) return renderPersonalRaidBattlefield(state);
  const raid = state.raid || createRaidState(RAID_DEFINITION);
  const expeditionLocks = activeExpeditionCardLocks(state);
  const selectedRaidSquad = availableRaidSquad(
    state.selectedRaidSquad,
    state.expedition,
    state.collection,
    { identityForId: cardCharacterIdentity },
  );
  const score = calculateSquadScore(
    selectedRaidSquad,
    state.collection,
    ALL_CARDS,
    state.cardEnhancements,
    expeditionLocks,
    state.cardProgression,
    selectedEquipment(state, 'raid'),
  );
  const maxHp = Math.max(1, Number(raid.maxHp) || RAID_DEFINITION.maxHp);
  const hp = Math.min(maxHp, Math.max(0, Number(raid.hp) || 0));
  const hpRatio = Math.max(0, hp / maxHp);
  const clears = Math.max(0, Number(raid.clears) || 0);
  const maxEntries = Math.max(1, Number(raid.maxDailyEntries ?? raid.maxClears) || 5);
  const entriesToday = Math.max(0, Number(raid.entriesToday) || 0);
  const remainingEntries = Math.max(0, Number(raid.remainingEntries ?? (maxEntries - entriesToday)) || 0);
  const stage = Math.max(1, Number(raid.stage) || 1);
  const maxStage = Math.max(stage, Number(raid.maxStage) || 10);
  const dailyLocked = remainingEntries <= 0;
  const weeklyCompleted = Boolean(raid.weeklyCompleted);
  const canEnter = raid.canEnter == null ? !dailyLocked && !weeklyCompleted : Boolean(raid.canEnter);
  const online = !ui.auth.offline && isRaidGatewayConfigured();
  const dispatchDisabled = !online || selectedRaidSquad.length !== MAX_SQUAD_SIZE || !canEnter || ui.raid.dispatching;
  const boss = cardById('deadline-dragon');
  const weeklyResetsAt = Number(raid.resetsAt) || 0;
  const dailyResetsAt = Number(raid.dailyResetsAt) || 0;

  return `
    <div class="raid-layout">
      <section class="raid-stage" aria-labelledby="raid-title">
        <div class="raid-art">
          <img src="${boss.image}" alt="${escapeHtml(RAID_DEFINITION.name)}" />
          <div class="raid-vignette"></div>
          <div class="raid-heading">
            <span>개인 도전 · STAGE ${formatNumber(stage)} / ${formatNumber(maxStage)}</span>
            <h2 id="raid-title">${RAID_DEFINITION.name}</h2>
          </div>
        </div>
        <div class="raid-dispatch-bar">
          <div class="raid-power"><span>선택 카드 합산 전투력</span><strong>${formatNumber(score)}</strong></div>
          <button class="alert-button raid-dispatch" type="button" data-action="enter-raid-battle" ${dispatchDisabled ? 'disabled' : ''}>
            <i data-lucide="zap"></i>
            ${ui.raid.dispatching
              ? '파견 처리 중'
              : weeklyCompleted
                ? `이번 주 ${formatNumber(maxStage)}단계 공략 완료`
                : dailyLocked
                  ? '오늘의 입장 횟수 소진'
                  : raid.activeSession
                    ? '진행 중인 전투가 있습니다'
                   : selectedRaidSquad.length !== MAX_SQUAD_SIZE
                    ? `카드 ${MAX_SQUAD_SIZE}장 편성 필요`
                    : '레이드 입장'}
          </button>
        </div>
        <div class="boss-health">
          <div><span>잔여 업무량</span><strong>${formatNumber(hp)} / ${formatNumber(maxHp)}</strong></div>
          <div class="boss-health-track"><span style="width:${Math.round(hpRatio * 100)}%"></span></div>
        </div>
        <div class="raid-stats">
          <div><span>이번 주 총 피해 점수</span><strong>${formatNumber(raid.totalContribution ?? raid.contribution)}</strong></div>
          <div><span>오늘 남은 입장</span><strong>${formatNumber(remainingEntries)} / ${formatNumber(maxEntries)}</strong></div>
          <div><span>현재 단계 클리어</span><strong>${formatNumber(clears)}회</strong></div>
          <div><span>일일 입장 초기화</span><strong>${dailyResetsAt ? `<span data-countdown="${dailyResetsAt}">${formatDuration(dailyResetsAt - Date.now())}</span>` : '매일 00:00'}</strong></div>
           <div><span>주간 단계 초기화</span><strong>${weeklyResetsAt ? `<span data-countdown="${weeklyResetsAt}">${formatDuration(weeklyResetsAt - Date.now())}</span>` : '월요일 00:00'}</strong></div>
        </div>
        ${!online ? '<p class="raid-sync-error"><i data-lucide="wifi"></i>개인 레이드와 실시간 랭킹은 온라인 연결이 필요합니다.</p>' : ''}
        ${ui.raid.error ? `<p class="raid-sync-error"><i data-lucide="circle-alert"></i>${escapeHtml(ui.raid.error)}</p>` : ''}
      </section>

      <aside class="raid-command">
        <div class="section-heading section-heading--compact">
          <div><span class="eyebrow">STRIKE TEAM</span><h2>파견 카드 선택</h2></div>
           <span>${selectedRaidSquad.length} / ${MAX_SQUAD_SIZE}</span>
        </div>
        ${state.expedition ? `<p class="local-operation-note"><i data-lucide="lock"></i>모험에 참여 중인 ${state.expedition.squad.length}장의 카드는 레이드에 편성할 수 없습니다.</p>` : ''}
         ${renderLoadoutSlots(state, 'raid')}
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
          <button type="button" role="tab" aria-selected="${ui.raidPanel === 'ranking'}" class="${ui.raidPanel === 'ranking' ? 'is-active' : ''}" data-action="switch-raid-panel" data-raid-panel="ranking">주간 랭킹</button>
        </div>
        ${ui.raidPanel === 'ranking' ? renderPersonalRaidRanking(state) : renderPersonalRaidBattle(state)}
      `}
    </section>
  `;
}

function renderMailbox() {
  const pending = ui.mailbox.items.filter((mail) => mail.status === 'pending');
  const pendingRewards = pending.filter((mail) => mail.rewards.coins || mail.rewards.standardPacks);
  const attentionCount = pending.filter((mail) => (
    !mail.readAt || mail.rewards.coins || mail.rewards.standardPacks
  )).length;
  const hasClaimableRewards = pendingRewards.length > 0;
  return `
    <section class="mailbox-page">
      <div class="mailbox-header">
        <div><span class="eyebrow">COMPANY POST</span><h2>우편함</h2><p>운영팀에서 보낸 안내와 보상을 확인할 수 있습니다.</p></div>
        <div class="mailbox-header-actions">
          <button class="secondary-button" type="button" data-action="refresh-mailbox" ${ui.mailbox.loading ? 'disabled' : ''}><i data-lucide="refresh-cw"></i>${ui.mailbox.loading ? '불러오는 중' : '새로고침'}</button>
          <button class="primary-button" type="button" data-action="claim-all-mail" ${ui.mailbox.claimingId || !hasClaimableRewards ? 'disabled' : ''}><i data-lucide="gift"></i>보상 모두 받기</button>
        </div>
      </div>
      ${ui.mailbox.error ? `<div class="mailbox-error"><i data-lucide="circle-alert"></i>${escapeHtml(ui.mailbox.error)}</div>` : ''}
      <div class="mailbox-summary"><span>전체 <strong>${formatNumber(ui.mailbox.items.length)}</strong></span><span>확인·수령 대기 <strong>${formatNumber(attentionCount)}</strong></span></div>
      <div class="mailbox-list">
        ${ui.mailbox.loading && !ui.mailbox.items.length ? '<div class="mailbox-empty"><div class="cloud-session-loader"><span></span></div><strong>우편을 불러오고 있습니다.</strong></div>' : ''}
        ${!ui.mailbox.loading && !ui.mailbox.items.length ? '<div class="mailbox-empty"><i data-lucide="mail"></i><strong>도착한 우편이 없습니다.</strong><span>새 소식이 오면 이곳에 표시됩니다.</span></div>' : ''}
        ${ui.mailbox.items.map((mail) => {
          const rewardParts = [];
          if (mail.rewards.coins) rewardParts.push(`<span><i data-lucide="coins"></i>${formatNumber(mail.rewards.coins)} 동전</span>`);
          if (mail.rewards.standardPacks) rewardParts.push(`<span><i data-lucide="package-open"></i>${formatNumber(mail.rewards.standardPacks)} 카드팩</span>`);
          const expired = mail.status === 'expired';
          const claimable = mail.status === 'pending' && rewardParts.length;
          return `
            <article class="mail-card ${mail.readAt || expired ? '' : 'is-unread'} ${mail.claimedAt ? 'is-claimed' : ''} ${expired ? 'is-expired' : ''}">
              <div class="mail-card-icon"><i data-lucide="${mail.claimedAt ? 'check' : expired ? 'clock' : 'mail'}"></i></div>
              <div class="mail-card-copy">
                <div class="mail-card-title"><span>${mail.readAt ? '운영팀 우편' : '새 우편'}</span><time>${escapeHtml(formatDateTime(mail.createdAt))}</time></div>
                <h3>${escapeHtml(mail.title)}</h3>
                <p>${escapeHtml(mail.message)}</p>
                ${rewardParts.length ? `<div class="mail-rewards">${rewardParts.join('')}</div>` : '<div class="mail-rewards is-empty">안내 우편</div>'}
                ${mail.expiresAt ? `<small>${escapeHtml(formatDateTime(mail.expiresAt))}까지 보관</small>` : ''}
              </div>
              <div class="mail-card-actions">
                ${!mail.readAt && !expired ? `<button class="text-button" type="button" data-action="read-mail" data-mail-id="${escapeHtml(mail.id)}">읽음 표시</button>` : ''}
                ${claimable ? `<button class="primary-button" type="button" data-action="claim-mail" data-mail-id="${escapeHtml(mail.id)}" ${ui.mailbox.claimingId ? 'disabled' : ''}>${ui.mailbox.claimingId === mail.id ? '수령 중…' : '보상 받기'}</button>` : `<span class="mail-status">${mail.claimedAt ? '수령 완료' : expired ? '기간 만료' : mail.readAt ? '확인 완료' : '확인 필요'}</span>`}
              </div>
            </article>`;
        }).join('')}
      </div>
    </section>
  `;
}

function renderCurrentView(state) {
  if (ui.view === 'collection') return renderCollection(state);
  if (ui.view === 'management') return renderManagement(state);
  if (ui.view === 'mailbox') return renderMailbox(state);
  if (ui.view === 'adventure') return renderAdventure(state);
  if (ui.view === 'raid') return renderRaid(state);
  return renderDashboard(state);
}

function renderPackResultCard(card, index, premiumPack, revealedCards, modal) {
  const gated = premiumPack && requiresPackReveal(card);
  const faceDown = gated && !revealedCards.has(index);
  const isNew = !faceDown && new Set(modal.newCardIndices || []).has(index);
  const revealClass = gated ? (faceDown ? 'is-face-down' : 'is-revealed') : '';
  const rarityClass = faceDown ? 'rarity-concealed' : `rarity-${card.rarity}`;
  return `
    <article class="result-card ${rarityClass} ${revealClass} ${isNew ? 'is-new-card' : ''}" data-pack-card-index="${index}" style="--reveal-delay:${Math.min(index, 10) * 70}ms">
      ${isNew ? '<span class="new-card-badge" aria-label="처음 획득한 카드">NEW!!</span>' : ''}
      <div class="result-card__art ${revealClass}">
        ${faceDown ? `
          <button class="result-card__reveal" type="button" data-action="reveal-pack-card" data-opening-id="${escapeHtml(modal.openingId || '')}" data-card-index="${index}" aria-label="${index + 1}번째 봉인 카드 뒤집기">
            <span class="card-back-mark">HC</span><strong>카드 봉인</strong><small>눌러서 공개</small>
          </button>
        ` : `
          <img class="card-illustration" src="${card.image}" alt="${escapeHtml(cardDisplayName(card))}" />
          <span class="rarity-stamp">${rarityEmblem(card.rarity)}</span>
          <b class="card-power">전투력 ${formatNumber(cardPower(card))}</b>
          <span class="enhancement-badge">+0</span>
        `}
      </div>
      <div class="result-card__copy">${faceDown
        ? '<small>특수 공개 대기</small><strong>잠긴 카드</strong><span>카드를 눌러 내용을 확인하세요.</span>'
        : `<small>${escapeHtml(card.department)}</small><strong>${escapeHtml(cardDisplayName(card))}</strong><span>${escapeHtml(card.trait)}</span>`}</div>
    </article>`;
}

function renderPackModalActions(state, unrevealedCount) {
  const pack = PACK_DEFINITION.standard;
  const hasPack = state.packs.standard > 0;
  const canBuy = state.wallet.coins >= pack.coinPrice;
  return `
    <button class="secondary-button" type="button" data-action="navigate-from-modal" data-view="collection">도감 보기</button>
    ${unrevealedCount > 0 ? `
      <button class="primary-button" type="button" disabled>봉인 카드 ${formatNumber(unrevealedCount)}장 먼저 공개</button>
    ` : hasPack ? `
      <button class="primary-button" type="button" data-action="open-another-pack" data-pack-count="1">1팩 더 개봉 · ${formatNumber(state.packs.standard)}팩 보유</button>
      ${state.packs.standard >= 10 ? '<button class="primary-button pack-open-ten" type="button" data-action="open-another-pack" data-pack-count="10">10팩 한 번에 개봉</button>' : ''}
    ` : `
      <button class="secondary-button" type="button" disabled>미개봉 카드팩 없음</button>
      <button class="primary-button" type="button" data-action="buy-and-open-pack" ${canBuy ? '' : 'disabled'}>
        ${canBuy ? `${formatNumber(pack.coinPrice)} 동전으로 구매 후 개봉` : `동전 부족 · ${formatNumber(pack.coinPrice)} 필요`}
      </button>
    `}`;
}

function renderPackModal(cards, pityTriggered, state, modal) {
  const highest = modal.highestRarity || highestRarity(cards);
  const premiumPack = rarityRank(highest) >= PACK_FLIP_THRESHOLD;
  const revealedCards = new Set(modal.revealedCards || []);
  const unrevealedCount = cards.reduce((count, card, index) => (
    count + (premiumPack && requiresPackReveal(card) && !revealedCards.has(index) ? 1 : 0)
  ), 0);
  return `
    <div class="modal-backdrop pack-backdrop rarity-${highest} ${unrevealedCount ? 'has-sealed-cards' : 'is-reveal-complete'}" data-action="close-modal">
      <section class="modal-sheet pack-opening-modal" role="dialog" aria-modal="true" aria-labelledby="pack-result-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <div class="modal-heading"><span class="eyebrow">PERSONNEL DISCOVERED</span><h2 id="pack-result-title">${modal.packCount > 1 ? `${formatNumber(modal.packCount)}팩 · ${formatNumber(cards.length)}장` : '인물 파일 개봉 결과'}</h2><p>${premiumPack ? '봉인된 카드는 직접 눌러 확인하세요.' : '새 카드가 인사기록에 등록되었습니다.'}</p></div>
        ${premiumPack ? `<div class="pack-reveal-hint" data-pack-reveal-hint><i data-lucide="sparkles"></i><span>${unrevealedCount ? `빛나는 봉인 카드를 눌러 한 장씩 확인하세요 · ${formatNumber(unrevealedCount)}장 남음` : '모든 봉인 카드를 확인했습니다.'}</span></div>` : ''}
        <div class="pack-result-grid ${modal.packCount > 1 ? 'is-batch' : ''}">
          ${cards.map((card, index) => renderPackResultCard(card, index, premiumPack, revealedCards, modal)).join('')}
        </div>
        <div class="modal-actions" data-pack-modal-actions>${renderPackModalActions(state, unrevealedCount)}</div>
      </section>
    </div>
  `;
}

function renderCardModal(card, state) {
  if (!card) return '';
  const enhancement = cardEnhancement(card, state);
  const counts = enhancementCountsForCard(state.collection, state.cardEnhancements, card.id);
  const owned = Number(state.collection[card.id]) > 0;
  const locked = new Set(state.lockedCardIds || []).has(card.id);
  const skill = skillForCard(card.id, enhancement);
  const progression = progressionForCard(state.cardProgression, card.id);
  const role = roleForCard(card);
  const maxHp = cardMaxHpAtLevel(card, state.cardProgression);
  const requiredExperience = cardExperienceForNextLevel(progression.level);
  const levelCost = cardLevelUpCoinCost(state.cardProgression, card.id);
  let visibleCards = collectionCardsForView(state).filter((entry) => (
    Number(state.collection[entry.id]) > 0 || new Set(state.discoveredCardIds || []).has(entry.id)
  ));
  if (!visibleCards.some((entry) => entry.id === card.id)) {
    visibleCards = CARD_CATALOG.filter((entry) => (
      Number(state.collection[entry.id]) > 0 || new Set(state.discoveredCardIds || []).has(entry.id)
    ));
  }
  const cardIndex = visibleCards.findIndex((entry) => entry.id === card.id);
  const previousCard = cardIndex > 0 ? visibleCards[cardIndex - 1] : null;
  const nextCard = cardIndex >= 0 && cardIndex < visibleCards.length - 1 ? visibleCards[cardIndex + 1] : null;
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet card-detail-modal rarity-${card.rarity}" role="dialog" aria-modal="true" aria-labelledby="card-detail-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <button class="detail-card-nav detail-card-nav--previous" type="button" data-action="navigate-card-detail" data-card-id="${previousCard?.id || ''}" aria-label="이전 카드" ${previousCard ? '' : 'disabled'}><i data-lucide="chevron-left"></i></button>
        <button class="detail-card-nav detail-card-nav--next" type="button" data-action="navigate-card-detail" data-card-id="${nextCard?.id || ''}" aria-label="다음 카드" ${nextCard ? '' : 'disabled'}><i data-lucide="chevron-right"></i></button>
        <div class="detail-card-art"><img class="card-illustration" src="${card.image}" alt="${escapeHtml(cardDisplayName(card))}" /><span class="rarity-stamp">${rarityEmblem(card.rarity)}</span><b class="card-power">전투력 ${formatNumber(cardPower(card, state))}</b><span class="enhancement-badge">${enhancementLabel(enhancement)}</span></div>
        <div class="detail-card-copy">
          <span class="eyebrow">${escapeHtml(card.department)} / ${escapeHtml(card.category)}</span>
          <h2 id="card-detail-title">${escapeHtml(cardDisplayName(card))}</h2>
          <p>${escapeHtml(card.flavor)}</p>
          <div class="detail-stats detail-stats--combat">
            <div><span>공격력 · 전투력</span><strong>${formatNumber(cardPower(card, state))}</strong></div>
            <div><span>최대 HP</span><strong>${formatNumber(maxHp)}</strong></div>
            <div><span>역할</span><strong>${escapeHtml(role.label)}</strong></div>
            <div><span>카드 레벨</span><strong>Lv.${formatNumber(progression.level)}</strong></div>
          </div>
          <div class="card-level-panel">
            <div><span>${progression.level >= 100 ? '최대 레벨 달성' : `다음 레벨까지 ${formatNumber(requiredExperience - progression.experience)} EXP`}</span><strong>${progression.level >= 100 ? 'MAX' : `${formatNumber(progression.experience)} / ${formatNumber(requiredExperience)}`}</strong></div>
            <div class="card-level-track"><span style="width:${progression.level >= 100 ? 100 : Math.round((progression.experience / Math.max(1, requiredExperience)) * 100)}%"></span></div>
            ${owned ? `<button class="secondary-button" type="button" data-action="level-up-card" data-card-id="${card.id}" ${progression.level >= 100 || state.wallet.coins < levelCost ? 'disabled' : ''}><i data-lucide="sparkles"></i>${progression.level >= 100 ? '최대 레벨' : `${formatNumber(levelCost)} 동전으로 레벨업`}</button>` : ''}
          </div>
          <div class="trait-box card-skill-box"><i data-lucide="sparkles"></i><span><strong>${escapeHtml(skill?.name || '고유 스킬 준비 중')}</strong><small>${escapeHtml(skill?.description || '이 카드는 추후 전투 스킬이 추가됩니다.')}</small>${skill ? `<em>${skill.oncePerBattle ? '전투당 1회' : `쿨타임 ${formatNumber(skill.cooldown)}턴`} · ${enhancementLabel(enhancement)} 효과 수치 적용</em>` : ''}</span></div>
          <div class="owned-line">보유 수량 <strong>${formatNumber(state.collection[card.id])}장</strong></div>
          <div class="owned-enhancement-line" aria-label="강화 단계별 보유 수량">${counts.map((count, stage) => `<span class="${stage === enhancement ? 'is-best' : ''}"><b>${enhancementLabel(stage)}</b>${formatNumber(count)}장</span>`).join('')}</div>
          <div class="detail-card-actions">
            ${owned ? `<button class="secondary-button detail-lock-button ${locked ? 'is-locked' : ''}" type="button" data-action="toggle-card-lock" data-card-id="${card.id}"><i data-lucide="${locked ? 'unlock' : 'lock'}"></i>${locked ? '카드 잠금 해제' : '카드 잠금'}</button>` : ''}
            ${owned && RARITY_META[card.rarity] ? `<button class="secondary-button detail-manage-button" type="button" data-action="manage-card" data-card-id="${card.id}">이 카드 강화하기</button>` : ''}
          </div>
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
  const resultCard = result.cardId ? cardById(result.cardId) : null;
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet compact-modal" role="dialog" aria-modal="true" aria-labelledby="result-title" data-modal-panel>
        <div class="result-symbol"><i data-lucide="check"></i></div>
        <span class="eyebrow">${escapeHtml(result.eyebrow || 'TASK COMPLETE')}</span>
        <h2 id="result-title">${escapeHtml(result.title || '처리 완료')}</h2>
        <p>${escapeHtml(result.message)}</p>
        ${resultCard ? `
          <div class="management-result-card rarity-${resultCard.rarity} ${result.isNew ? 'is-new-card' : ''}">
            ${result.isNew ? '<span class="new-card-badge" aria-label="처음 획득한 카드">NEW!!</span>' : ''}
            <img class="card-illustration" src="${resultCard.image}" alt="${escapeHtml(cardDisplayName(resultCard))}" />
            <span class="rarity-stamp">${rarityEmblem(resultCard.rarity)}</span>
            <strong>${escapeHtml(cardDisplayName(resultCard))}</strong>
            <small>${enhancementLabel(result.enhancement || 0)} · 전투력 ${formatNumber(cardPower(resultCard, null, result.enhancement || 0))}</small>
          </div>
        ` : ''}
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

function renderBatchSynthesisResultModal(result) {
  const results = Array.isArray(result.results) ? result.results : [];
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet batch-synthesis-result-modal" role="dialog" aria-modal="true" aria-labelledby="batch-synthesis-result-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <div class="result-symbol"><i data-lucide="sparkles"></i></div>
        <span class="eyebrow">BATCH SYNTHESIS COMPLETE</span>
        <h2 id="batch-synthesis-result-title">${rarityLabel(result.sourceRarity)} 일괄 합성 완료</h2>
        <p>${formatNumber(results.length)}회 합성하여 ${formatNumber(result.successCount)}회 성공하고 ${formatNumber(result.failureCount)}회 실패했습니다.</p>
        <div class="batch-synthesis-summary" aria-label="일괄 합성 요약">
          <span><small>총 시도</small><strong>${formatNumber(results.length)}</strong></span>
          <span class="is-success"><small>성공</small><strong>${formatNumber(result.successCount)}</strong></span>
          <span class="is-failure"><small>실패</small><strong>${formatNumber(result.failureCount)}</strong></span>
        </div>
        <ol class="batch-synthesis-result-list">
          ${results.map((entry, index) => {
            const card = cardById(entry.outputCardId);
            if (!card) return '';
            return `
              <li class="rarity-${card.rarity} ${entry.isNew ? 'is-new-card' : ''}">
                <b>${formatNumber(index + 1)}</b>
                <img class="card-illustration" src="${card.image}" alt="" loading="lazy" />
                <span><strong>${escapeHtml(cardDisplayName(card))}</strong><small>${entry.success ? `${rarityLabel(entry.sourceRarity)} → ${rarityLabel(entry.resultRarity)} 성공` : `${rarityLabel(entry.sourceRarity)} 카드 반환`}</small></span>
                <em class="${entry.success ? 'is-success' : 'is-failure'}">${entry.success ? '성공' : '실패'}</em>
                ${entry.isNew ? '<mark class="batch-new-card-badge">NEW!!</mark>' : ''}
              </li>`;
          }).join('')}
        </ol>
        <button class="primary-button" type="button" data-action="close-modal">확인</button>
      </section>
    </div>
  `;
}

function renderAdminModal() {
  const authenticated = Boolean(ui.admin.token);
  const draft = ui.admin.draft || {};
  const draftValue = (field, fallback = '') => escapeHtml(String(draft[field] ?? fallback));
  const selected = (field, value, fallback = '') => String(draft[field] ?? fallback) === String(value) ? ' selected' : '';
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <span class="eyebrow">OPERATIONS CONSOLE</span>
        <h2 id="admin-title">관리자 모드</h2>
        <p>${authenticated ? '사용자에게 안내와 보상을 우편으로 발송합니다.' : '관리자 계정으로 로그인해 운영 도구를 엽니다.'}</p>
        ${authenticated ? `
          <form class="admin-mail-form" data-form="admin-mail">
            <label><span>발송 대상</span><select name="target" required><option value="all"${selected('target', 'all', 'all')}>전체 사용자</option>${ui.admin.users.map((user) => `<option value="${escapeHtml(user.id)}"${selected('target', user.id, 'all')}>${escapeHtml(user.label || `${user.nickname} (${user.username})`)}</option>`).join('')}</select></label>
            <label><span>지급 구성</span><select name="presetId"><option value="custom"${selected('presetId', 'custom', 'custom')}>직접 수량 지정</option>${ui.admin.packages.map((preset) => `<option value="${escapeHtml(preset.id)}"${selected('presetId', preset.id, 'custom')}>${escapeHtml(preset.name)} · ${formatNumber(preset.rewards.standardPacks)}팩${preset.rewards.coins ? ` + ${formatNumber(preset.rewards.coins)}코인` : ''}</option>`).join('')}</select></label>
            <label><span>우편 제목</span><input name="title" maxlength="80" placeholder="업데이트 기념 선물" value="${draftValue('title')}" required /></label>
            <label><span>내용</span><textarea name="message" maxlength="1000" rows="4" placeholder="사용자에게 전달할 내용을 입력하세요.">${draftValue('message')}</textarea></label>
            <div class="admin-reward-grid">
              <label><span>사내 동전</span><input name="coins" type="number" min="0" max="100000000" step="1" value="${draftValue('coins', '0')}" ${String(draft.presetId || 'custom') !== 'custom' ? 'disabled' : ''} /></label>
              <label><span>표준 카드팩</span><input name="standardPacks" type="number" min="0" max="10000" step="1" value="${draftValue('standardPacks', '0')}" ${String(draft.presetId || 'custom') !== 'custom' ? 'disabled' : ''} /></label>
              <label><span>보관 기간</span><select name="expiresInHours"><option value="168"${selected('expiresInHours', '168', '168')}>7일</option><option value="720"${selected('expiresInHours', '720', '168')}>30일</option><option value="2160"${selected('expiresInHours', '2160', '168')}>90일</option></select></label>
            </div>
            <p class="auth-form-error" role="alert">${escapeHtml(ui.admin.error)}</p>
            <div class="admin-modal-actions">
              <button class="text-button" type="button" data-action="admin-logout">관리자 로그아웃</button>
              <button class="primary-button" type="submit" ${ui.admin.sending ? 'disabled' : ''}><i data-lucide="mail"></i>${ui.admin.sending ? '발송 중…' : '우편 발송'}</button>
            </div>
          </form>
        ` : `
          <form class="admin-login-form" data-form="admin-login">
            <label><span>관리자 아이디</span><input name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" required /></label>
            <label><span>관리자 비밀번호</span><input name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="72" required /></label>
            <p class="auth-form-error" role="alert">${escapeHtml(ui.admin.error)}</p>
            <button class="primary-button" type="submit" ${ui.admin.loading ? 'disabled' : ''}><i data-lucide="shield"></i>${ui.admin.loading ? '확인 중…' : '관리자 로그인'}</button>
          </form>
        `}
      </section>
    </div>
  `;
}

function renderSettingsModal(state) {
  const account = ui.auth.account;
  const notificationLabel = desktopBridge.isDesktop ? '데스크톱 팝업 알림' : '모바일 알림';
  const mobileNotificationSettings = clientPlatform === 'android' ? `
    <label class="toggle-row"><span><strong>야간 알림 끄기 (22:00~06:00)</strong><small>야간에는 돌발 임무 알림을 보내지 않고, 모험 완료 알림은 오전 6시 이후에 알려드립니다.</small></span><input type="checkbox" data-action="toggle-quiet-hours" ${state.settings.quietHoursNotifications ? 'checked' : ''} ${state.settings.incidentNotifications ? '' : 'disabled'} /><i></i></label>
    ${ui.notificationPermission === 'denied' ? '<button class="secondary-button settings-notification-button" type="button" data-action="open-notification-settings">휴대폰 알림 권한 열기</button>' : ''}
  ` : '';
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
        ${mobileNotificationSettings}
        ${desktopOnlySettings}
        <label class="toggle-row"><span><strong>월급루팡 모드</strong><small>모든 카드 일러스트를 가리고 카드 이름과 등급만 표시합니다.</small></span><input type="checkbox" data-action="toggle-payroll-mode" ${state.settings.payrollMode ? 'checked' : ''} /><i></i></label>
        ${ui.updateStatus?.downloadUrl ? '<button class="primary-button settings-update-button" type="button" data-action="download-update">새 Android 버전 받기</button>' : ''}
        <button class="secondary-button settings-admin-button" type="button" data-action="open-admin"><i data-lucide="shield"></i>관리자 모드</button>
        <div class="settings-footer"><span>버전 ${escapeHtml(ui.appVersion)}</span><button class="danger-text-button" type="button" data-action="reset-progress">클라우드 진행 기록 초기화</button></div>
      </section>
    </div>
  `;
}

function renderDonationModal() {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet donation-modal" role="dialog" aria-modal="true" aria-labelledby="donation-title" data-modal-panel>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="닫기"><i data-lucide="x"></i></button>
        <span class="eyebrow">TESTER SUPPORT</span>
        <h2 id="donation-title">도네이션</h2>
        <div class="donation-bank"><small>토스뱅크</small><strong>1000-4112-0011 ㅊㅅㅇ</strong></div>
        <p>입금 후 운영자에게 알려주시면 해당 패키지를 우편으로 지급합니다.</p>
        <div class="donation-package-list">
          ${DONATION_PACKAGES.map((entry, index) => `
            <article>
              <b>${index + 1}</b>
              <span><strong>${escapeHtml(entry.name)}</strong><small>카드팩 ${formatNumber(entry.packs)}개${entry.coins ? ` · ${formatNumber(entry.coins)}코인` : ''}</small></span>
              <em>${formatNumber(entry.price)}원</em>
            </article>
          `).join('')}
        </div>
        <button class="primary-button" type="button" data-action="close-modal">확인</button>
      </section>
    </div>
  `;
}

function renderNotificationPermissionModal() {
  const needsSettings = ui.modal?.action === 'settings';
  return `
    <div class="modal-backdrop notification-permission-backdrop">
      <section class="modal-sheet compact-modal notification-permission-modal" role="dialog" aria-modal="true" aria-labelledby="notification-permission-title" data-modal-panel>
        <div class="notification-permission-symbol" aria-hidden="true"><i data-lucide="bell"></i></div>
        <span class="eyebrow">ANDROID NOTIFICATION</span>
        <h2 id="notification-permission-title">${needsSettings ? '휴대폰 설정에서 알림을 켜주세요.' : '게임 알림을 받아볼까요?'}</h2>
        <p>${needsSettings
          ? '알림 권한이 꺼져 있습니다. 권한을 켜면 앱을 닫아도 모험 완료와 돌발 임무를 놓치지 않습니다.'
          : 'Android 알림 권한을 허용하면 앱을 닫아도 모험 완료와 돌발 임무를 알려드립니다. 야간 알림은 설정에서 따로 끌 수 있습니다.'}</p>
        <div class="modal-actions notification-permission-actions">
          <button class="secondary-button" type="button" data-action="dismiss-notification-permission">나중에</button>
          <button class="primary-button" type="button" data-action="${needsSettings ? 'open-notification-settings-from-prompt' : 'request-notification-permission'}">
            <i data-lucide="bell"></i>${needsSettings ? '알림 설정 열기' : '알림 권한 허용하기'}
          </button>
        </div>
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
  if (ui.modal.type === 'batch-synthesis-result') return renderBatchSynthesisResultModal(ui.modal);
  if (ui.modal.type === 'settings') return renderSettingsModal(state);
  if (ui.modal.type === 'donation') return renderDonationModal();
  if (ui.modal.type === 'admin') return renderAdminModal();
  if (ui.modal.type === 'notification-permission') return renderNotificationPermissionModal();
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

function updateBlocksGameplay() {
  return new Set(['available', 'downloading', 'saving', 'permission-required', 'installing'])
    .has(ui.updateStatus?.status);
}

function renderUpdateGate() {
  if (!updateBlocksGameplay()) return '';
  const status = ui.updateStatus?.status;
  const reinstall = ui.updateStatus?.updateMode === 'reinstall';
  const version = ui.updateStatus?.latestVersion || ui.updateStatus?.detail || '';
  let eyebrow = reinstall ? 'NEW APP REQUIRED' : 'REQUIRED UPDATE';
  let title = reinstall ? '새 버전 앱을 다시 받아주세요.' : '새 버전으로 업데이트해 주세요.';
  let description = reinstall
    ? '이 버전은 설치 서명이 달라 앱 안에서 바로 교체할 수 없습니다. APK를 받은 뒤 기존 앱을 삭제하고 새 버전을 설치하면 클라우드 기록을 그대로 이어갈 수 있습니다.'
    : `현재 버전보다 새로운 ${version ? String(version).replace(/^v/, 'v') : '버전'}이 있습니다. 업데이트를 마칠 때까지 게임 플레이가 잠깁니다.`;
  let action = '';

  if (clientPlatform === 'android' && (status === 'available' || status === 'permission-required' || status === 'installing')) {
    action = `<button class="primary-button" type="button" data-action="download-update">${reinstall ? '새 버전 APK 받기' : status === 'permission-required' ? '설치 권한 확인 후 다시 진행' : status === 'installing' ? '설치 화면 다시 열기' : '지금 업데이트'}</button>`;
  } else if (status === 'available') {
    title = '새 버전을 자동으로 받고 있어요.';
    description = '다운로드가 끝나면 진행 기록을 저장한 뒤 업데이트가 자동으로 적용됩니다.';
  } else if (status === 'downloading') {
    const progress = Math.max(0, Math.min(100, Number(ui.updateStatus?.detail) || 0));
    title = `업데이트를 받고 있어요. ${progress}%`;
    description = '다운로드가 끝나면 설치 확인 화면이 자동으로 열립니다.';
  } else if (status === 'saving') {
    title = '진행 기록을 안전하게 저장하고 있어요.';
    description = '저장이 끝나면 업데이트 설치를 이어서 진행합니다.';
  } else if (status === 'installing') {
    title = '업데이트를 적용하고 있어요.';
    description = '잠시 후 최신 버전으로 게임이 다시 시작됩니다.';
  }

  return `
    <section class="cloud-session-gate update-session-gate" role="dialog" aria-modal="true" aria-live="assertive">
      <div class="cloud-session-card">
        <div class="cloud-session-mark" aria-hidden="true"><i data-lucide="download"></i></div>
        <span class="eyebrow">${eyebrow}</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
        ${ui.updateStatus?.message ? `<small>${escapeHtml(ui.updateStatus.message)}</small>` : ''}
        ${action || '<div class="cloud-session-loader" aria-hidden="true"><span></span></div>'}
        <button class="cloud-session-logout" type="button" data-action="logout">로그아웃</button>
      </div>
    </section>
  `;
}

function assignScrollKeys() {
  const groups = [
    ['.sidebar', 'global:sidebar'],
    ['.auth-shell', 'auth:shell'],
    ['.auth-panel', 'auth:panel'],
    ['.auth-form-panel', 'auth:form'],
    ['.view-host', `view:${ui.view}:main`],
    ['.management-card-list', 'view:management:enhancement-list'],
    ['.synthesis-card-list', 'view:management:synthesis-list'],
    ['.synthesis-rarity-tabs', 'view:management:synthesis-rarities'],
    ['.synthesis-stage-actions', 'view:management:synthesis-stages'],
    ['.batch-synthesis-result-list', 'modal:batch-synthesis:results'],
    ['.segmented-control', `view:${ui.view}:segmented`],
    ['.raid-mode-tabs', 'view:raid:mode-tabs'],
    ['.raid-tab-list', 'view:raid:panel-tabs'],
    ['.contribution-table', 'view:raid:ranking-table'],
    ['.raid-stats', 'view:raid:stats'],
    ['.requirement-row', 'view:adventure:requirements'],
    ['.detail-stats', `modal:${ui.modal?.type || 'card'}:stats`],
    ['.modal-backdrop', `modal:${ui.modal?.type || 'generic'}:backdrop`],
    ['.modal-sheet', `modal:${ui.modal?.type || 'generic'}:sheet`],
  ];

  for (const [selector, prefix] of groups) {
    app.querySelectorAll(selector).forEach((element, index) => {
      if (!element.dataset.scrollKey) element.dataset.scrollKey = `${prefix}:${index}`;
    });
  }
}

function captureScrollPositions() {
  app.querySelectorAll('[data-scroll-key]').forEach((element) => {
    scrollPositions.set(element.dataset.scrollKey, {
      top: element.scrollTop,
      left: element.scrollLeft,
    });
  });
}

function restoreScrollPositions() {
  const apply = () => {
    app.querySelectorAll('[data-scroll-key]').forEach((element) => {
      const saved = scrollPositions.get(element.dataset.scrollKey);
      if (!saved) return;
      element.scrollTop = saved.top;
      element.scrollLeft = saved.left;
    });
  };

  apply();
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(apply));
  }
}

function render() {
  captureScrollPositions();
  if (ui.auth.phase !== 'authenticated' || !store) {
    ui.renderedView = null;
    app.innerHTML = renderAuthScreen();
    refreshIcons();
    syncAuthFormControls();
    assignScrollKeys();
    restoreScrollPositions();
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
      ${renderUpdateGate()}
    </div>
  `;
  ui.renderedView = ui.view;
  refreshIcons();
  assignScrollKeys();
  restoreScrollPositions();
}

function rewardText(reward = {}) {
  const parts = [];
  if (reward.coins) parts.push(`<span><i data-lucide="coins"></i>${formatNumber(reward.coins)} 동전</span>`);
  if (reward.packs) parts.push(`<span><i data-lucide="package-open"></i>${formatNumber(reward.packs)} 카드팩</span>`);
  return parts.join('') || '<span>기록 갱신</span>';
}

function showPackOpeningModal(opening, cards, { renderNow = true } = {}) {
  ui.modal = {
    type: 'pack',
    cards,
    pityTriggered: opening.pityTriggered,
    highestRarity: highestRarity(cards),
    newCardIndices: opening.newCardIndices || [],
    packCount: opening.packCount || 1,
    revealedCards: opening.revealedIndices,
    openingId: opening.id,
    pendingOpening: true,
  };
  if (renderNow) render();
}

function addPendingPackToCollection(draft, opening, cards) {
  if (draft.pendingPackOpening?.id !== opening.id) return false;
  draft.collection = addCardsToCollection(draft.collection, cards);
  draft.discoveredCardIds = registerDiscoveredCards(draft.discoveredCardIds, cards);
  draft.pendingPackOpening = null;
  appendActivity(draft, `공개를 마친 카드 ${cards.length}장을 인사기록에 등록했습니다.`, 'pack');
  return true;
}

function patchPackReveal(cardIndex, opening) {
  if (ui.modal?.type !== 'pack') return false;
  const cards = ui.modal.cards || [];
  const card = cards[cardIndex];
  const cardNode = app.querySelector(`[data-pack-card-index="${cardIndex}"]`);
  if (!card || !cardNode) return false;

  const highest = ui.modal.highestRarity || highestRarity(cards);
  const premiumPack = rarityRank(highest) >= PACK_FLIP_THRESHOLD;
  const revealedCards = new Set(opening.revealedIndices || []);
  const template = document.createElement('template');
  template.innerHTML = renderPackResultCard(card, cardIndex, premiumPack, revealedCards, ui.modal).trim();
  cardNode.replaceWith(template.content.firstElementChild);

  const unrevealedCount = cards.reduce((count, candidate, index) => (
    count + (premiumPack && requiresPackReveal(candidate) && !revealedCards.has(index) ? 1 : 0)
  ), 0);
  const hint = app.querySelector('[data-pack-reveal-hint] span');
  if (hint) {
    hint.textContent = unrevealedCount
      ? `빛나는 봉인 카드를 눌러 한 장씩 확인하세요 · ${formatNumber(unrevealedCount)}장 남음`
      : '모든 봉인 카드를 확인했습니다.';
  }
  const actions = app.querySelector('[data-pack-modal-actions]');
  if (actions) actions.innerHTML = renderPackModalActions(store.getState(), unrevealedCount);
  const backdrop = app.querySelector('.pack-backdrop');
  if (backdrop && unrevealedCount === 0) {
    backdrop.classList.remove('has-sealed-cards');
    backdrop.classList.add('is-reveal-complete');
  }
  refreshIcons();
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
      newCardIndices: opening.newCardIndices || [], packCount: opening.packCount || 1,
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
  if (!patchPackReveal(cardIndex, nextOpening)) render();
  return true;
}

function openStandardPacks(packCount = 1) {
  if (resumePendingPackOpening()) return;
  const state = store.getState();
  const requestedCount = Number(packCount) === 10 ? 10 : 1;
  if (state.packs.standard < requestedCount) {
    showNotice(requestedCount === 10 ? '10팩 개봉에는 카드팩 10개가 필요합니다.' : '미개봉 카드팩이 없습니다.', 'warning');
    return;
  }
  const result = openPacks({
    catalog: CARD_CATALOG,
    definition: PACK_DEFINITION.standard,
    pity: state.pity.standard,
    packCount: requestedCount,
  });
  const highest = highestRarity(result.cards);
  const freshIndices = newCardIndices(result.cards, state.discoveredCardIds);
  const premiumPack = rarityRank(highest) >= PACK_FLIP_THRESHOLD;
  const opening = premiumPack ? createPendingPackOpening({
    cards: result.cards,
    pityTriggered: result.pityTriggered,
    highestRarity: highest,
    newCardIndices: freshIndices,
    packCount: result.packCount,
  }) : null;
  store.update((draft) => {
    draft.packs.standard -= result.packCount;
    draft.pity.standard = result.nextPity;
    if (opening) {
      draft.pendingPackOpening = opening;
      appendActivity(draft, '인물 파일에서 특별 카드 봉인을 발견했습니다.', 'pack');
    } else {
      draft.collection = addCardsToCollection(draft.collection, result.cards);
      draft.discoveredCardIds = registerDiscoveredCards(draft.discoveredCardIds, result.cards);
      appendActivity(draft, `인물 파일에서 카드 ${result.cards.length}장을 발견했습니다.`, 'pack');
    }
  });
  ui.modal = {
    type: 'pack', cards: result.cards, pityTriggered: result.pityTriggered,
    highestRarity: highest, newCardIndices: freshIndices, packCount: result.packCount, revealedCards: [],
    openingId: opening?.id || '', pendingOpening: Boolean(opening),
  };
  render();
}

function buyStandardPack({ notify = true } = {}) {
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
  if (notify) showNotice('카드팩 1개를 구매했습니다.', 'success');
  return true;
}

function enhanceSelectedCard() {
  const state = store.getState();
  const card = cardById(ui.enhanceCardId);
  const targetStage = Number(ui.enhanceTargetStage);
  const materialStage = Number(ui.enhanceMaterialStage);
  if (!card) return;

  const available = availableEnhancementCounts(state, card.id);
  if (available[targetStage] < 1
    || available[materialStage] - (targetStage === materialStage ? 1 : 0) < 1) {
    showNotice('모험에 참여하지 않는 동일 카드 재료가 더 필요합니다.', 'warning');
    return;
  }

  let outcome = null;
  try {
    store.update((draft) => {
      outcome = attemptCardEnhancement({
        collection: draft.collection,
        cardEnhancements: draft.cardEnhancements,
        cardId: card.id,
        targetStage,
        materialStage,
        lockedCards: activeExpeditionCardLocks(draft),
        protectedCardIds: draft.lockedCardIds,
      });
      draft.collection = outcome.collection;
      draft.cardEnhancements = outcome.cardEnhancements;
      appendActivity(
        draft,
        outcome.success
          ? `${cardDisplayName(card)} ${enhancementLabel(targetStage + 1)} 강화에 성공했습니다.`
          : `${cardDisplayName(card)} ${enhancementLabel(targetStage + 1)} 강화에 실패했습니다.`,
        'card',
      );
    });
  } catch (error) {
    showNotice(error.message, 'warning');
    return;
  }

  ui.enhanceTargetStage = outcome.resultStage;
  ui.enhanceMaterialStage = null;
  ui.modal = {
    type: 'result',
    title: outcome.success ? '강화 성공' : '강화 실패',
    eyebrow: outcome.success ? 'ENHANCEMENT COMPLETE' : 'ENHANCEMENT FAILED',
    message: outcome.success
      ? `${cardDisplayName(card)} 카드가 ${enhancementLabel(outcome.resultStage)} 단계가 되었습니다.`
      : `${cardDisplayName(card)} 카드는 ${enhancementLabel(outcome.resultStage)} 단계를 유지합니다. 재료 카드는 소모되었습니다.`,
    rewardText: `<span><i data-lucide="zap"></i>전투력 ${formatNumber(cardPower(card, null, outcome.resultStage))}</span>`,
  };
  render();
}

function addSynthesisMaterial(cardId, enhancement) {
  const state = store.getState();
  const card = cardById(cardId);
  const stage = Math.floor(Number(enhancement));
  if (!card || !RARITY_META[card.rarity] || stage < 0 || stage > MAX_ENHANCEMENT) return;
  if (new Set(state.lockedCardIds || []).has(card.id)) {
    showNotice('잠금된 카드는 합성 재료로 사용할 수 없습니다.', 'warning');
    return;
  }
  sanitizeSynthesisSelection(state);
  if (ui.synthesisMaterials.length >= SYNTHESIS_MATERIAL_COUNT) return;
  const selectedRarity = ui.synthesisMaterials.length
    ? cardById(ui.synthesisMaterials[0].cardId)?.rarity
    : card.rarity;
  if (card.rarity !== selectedRarity) {
    showNotice('같은 등급의 카드만 합성 재료로 넣을 수 있습니다.', 'warning');
    return;
  }
  const locks = lockedEnhancementCounts(
    state.collection,
    state.cardEnhancements,
    activeExpeditionCardLocks(state),
  );
  const counts = enhancementCountsForCard(state.collection, state.cardEnhancements, card.id);
  const available = Math.max(0, counts[stage] - (locks[card.id]?.[stage] || 0));
  if (synthesisSelectionCount(card.id, stage) >= available) {
    showNotice('이 단계에서 더 사용할 수 있는 복사본이 없습니다.', 'warning');
    return;
  }
  ui.synthesisRarity = card.rarity;
  ui.synthesisMaterials.push({ cardId: card.id, enhancement: stage });
  render({ preserveViewScroll: true });
}

function autoFillSynthesisMaterials() {
  const state = store.getState();
  const materials = autoSelectSynthesisMaterials({
    collection: state.collection,
    cardEnhancements: state.cardEnhancements,
    catalog: CARD_CATALOG,
    rarityOrder: RARITY_ORDER,
    lockedCardIds: activeExpeditionCardLocks(state),
    protectedCardIds: state.lockedCardIds,
  });
  if (materials.length !== SYNTHESIS_MATERIAL_COUNT) {
    showNotice('자동으로 넣을 수 있는 같은 등급 +0 카드가 5장 미만입니다.', 'warning');
    return;
  }
  ui.synthesisMaterials = materials;
  ui.synthesisRarity = cardById(materials[0].cardId)?.rarity || RARITY_ORDER[0];
  render({ preserveViewScroll: true });
}

function synthesizeSelectedCards() {
  const state = store.getState();
  sanitizeSynthesisSelection(state);
  if (ui.synthesisMaterials.length !== SYNTHESIS_MATERIAL_COUNT) {
    showNotice('같은 등급의 카드 5장을 선택해 주세요.', 'warning');
    return;
  }

  let outcome = null;
  let isNew = false;
  try {
    store.update((draft) => {
      outcome = attemptCardSynthesis({
        collection: draft.collection,
        cardEnhancements: draft.cardEnhancements,
        materials: ui.synthesisMaterials,
        catalog: CARD_CATALOG,
        rarityOrder: RARITY_ORDER,
        lockedCardIds: activeExpeditionCardLocks(draft),
        protectedCardIds: draft.lockedCardIds,
      });
      draft.collection = outcome.collection;
      draft.cardEnhancements = outcome.cardEnhancements;
      isNew = !(draft.discoveredCardIds || []).includes(outcome.outputCard.id);
      draft.discoveredCardIds = registerDiscoveredCards(draft.discoveredCardIds, [outcome.outputCard]);
      appendActivity(
        draft,
        outcome.success
          ? `${rarityLabel(outcome.sourceRarity)} 카드 5장을 합성해 ${rarityLabel(outcome.resultRarity)} ${cardDisplayName(outcome.outputCard)} 카드를 발견했습니다.`
          : `카드 합성에 실패해 ${rarityLabel(outcome.resultRarity)} ${cardDisplayName(outcome.outputCard)} 카드 1장을 돌려받았습니다.`,
        'card',
      );
    });
  } catch (error) {
    showNotice(error.message, 'warning');
    return;
  }

  ui.synthesisMaterials = [];
  ui.synthesisRarity = outcome.sourceRarity;
  ui.modal = {
    type: 'result',
    title: outcome.success ? '합성 성공' : '합성 실패',
    eyebrow: outcome.success ? 'SYNTHESIS COMPLETE' : 'SYNTHESIS RETURN',
    message: outcome.success
      ? `다음 등급의 ${cardDisplayName(outcome.outputCard)} 카드를 획득했습니다.`
      : `같은 등급의 ${cardDisplayName(outcome.outputCard)} 카드 1장을 돌려받았습니다.`,
    cardId: outcome.outputCard.id,
    isNew,
    enhancement: 0,
    rewardText: `<span><i data-lucide="sparkles"></i>${rarityLabel(outcome.resultRarity)} · ${escapeHtml(cardDisplayName(outcome.outputCard))}</span>`,
  };
  render();
}

function synthesizeCardsByRarity() {
  const rarity = RARITY_ORDER.slice(0, -1).includes(ui.synthesisRarity)
    ? ui.synthesisRarity
    : RARITY_ORDER[0];
  let outcome = null;
  let resultEntries = [];

  try {
    store.update((draft) => {
      outcome = attemptBatchCardSynthesis({
        collection: draft.collection,
        cardEnhancements: draft.cardEnhancements,
        catalog: CARD_CATALOG,
        rarityOrder: RARITY_ORDER,
        rarity,
        lockedCardIds: activeExpeditionCardLocks(draft),
        protectedCardIds: draft.lockedCardIds,
      });
      draft.collection = outcome.collection;
      draft.cardEnhancements = outcome.cardEnhancements;
      const knownCards = new Set(draft.discoveredCardIds || []);
      resultEntries = outcome.results.map((result) => {
        const isNew = !knownCards.has(result.outputCard.id);
        knownCards.add(result.outputCard.id);
        return {
          success: result.success,
          sourceRarity: result.sourceRarity,
          resultRarity: result.resultRarity,
          outputCardId: result.outputCard.id,
          isNew,
        };
      });
      draft.discoveredCardIds = [...knownCards];
      appendActivity(
        draft,
        `${rarityLabel(outcome.sourceRarity)} 카드 일괄 합성 ${formatNumber(outcome.attemptCount)}회를 완료했습니다. 성공 ${formatNumber(outcome.successCount)}회 · 실패 ${formatNumber(outcome.failureCount)}회`,
        'card',
      );
    });
  } catch (error) {
    showNotice(error.message, 'warning');
    return;
  }

  ui.synthesisMaterials = [];
  ui.synthesisRarity = outcome.sourceRarity;
  ui.modal = {
    type: 'batch-synthesis-result',
    sourceRarity: outcome.sourceRarity,
    successCount: outcome.successCount,
    failureCount: outcome.failureCount,
    results: resultEntries,
  };
  render();
}

function toggleSquadCard(cardId, context = 'adventure') {
  const state = store.getState();
  if (!state.collection[cardId]) return;
  const unavailable = context === 'raid' && bestAvailableEnhancementForCard(
    state.collection,
    state.cardEnhancements,
    cardId,
    activeExpeditionCardLocks(state),
  ) < 0;
  if (unavailable) {
    showNotice('이 카드의 모든 복사본이 모험에 참여 중입니다.', 'warning');
    return;
  }
  store.update((draft) => {
    const field = context === 'raid' ? 'selectedRaidSquad' : 'selectedExpeditionSquad';
    draft[field] = toggleSquadSelection(draft[field], cardId, { identityForId: cardCharacterIdentity });
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
      cardEnhancements: state.cardEnhancements,
      cardProgression: state.cardProgression,
      equipment: selectedEquipment(state, 'adventure'),
    });
    store.update((draft) => {
      draft.expedition = expedition;
      appendActivity(draft, `${mission.name} 모험을 시작했습니다.`, 'adventure');
    });
    void scheduleExpeditionNotification(expedition, mission);
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
  const notificationId = expeditionNotificationId(state.expedition);
  if (notificationId) void desktopBridge.cancelGameNotification(notificationId).catch(() => {});
  appendActivity(
    completion.state,
    `${mission.name} 완료: ${formatNumber(completion.result.coins)} 동전${completion.result.equipment ? ` · ${completion.result.equipment.name}` : ''} 획득`,
    'adventure',
    completion.completedAt,
  );
  store.replace(completion.state);
  ui.modal = {
    type: 'result',
    message: `${mission.name} 임무를 무사히 마쳤습니다.`,
    rewardText: `${rewardText({ coins: completion.result.coins, packs: completion.result.packs })} · 카드당 경험치 ${formatNumber(completion.result.experiencePerCard)}${completion.result.equipment ? ` · ${equipmentEffectText(completion.result.equipment)} 획득` : ''}`,
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

function selectedRaidBattleCards(state = store.getState()) {
  const expeditionLocks = activeExpeditionCardLocks(state);
  const equipment = selectedEquipment(state, 'raid');
  const attackMultiplier = equipmentPartyAttackMultiplier(equipment);
  const hpMultiplier = equipmentPartyHpMultiplier(equipment);
  return availableRaidSquad(
    state.selectedRaidSquad,
    state.expedition,
    state.collection,
    { identityForId: cardCharacterIdentity },
  ).map((cardId) => {
    const card = cardById(cardId);
    const enhancement = bestAvailableEnhancementForCard(
      state.collection,
      state.cardEnhancements,
      cardId,
      expeditionLocks,
    );
    return {
      cardId,
      enhancement,
      name: cardDisplayName(card),
      image: card?.image || '',
      combatPower: Math.round(cardPower(card, state, enhancement) * attackMultiplier),
      maxHp: Math.round(cardMaxHpAtLevel(card, state.cardProgression) * hpMultiplier * 2) / 2,
    };
  });
}

function enterRaidBattle() {
  const state = store.getState();
  const cards = selectedRaidBattleCards(state);
  if (cards.length !== MAX_SQUAD_SIZE) {
    showNotice(`개인 레이드에는 카드 ${MAX_SQUAD_SIZE}장을 편성해야 합니다.`, 'warning');
    return;
  }
  try {
    ui.raid.battle = createRaidBattle({
      cards,
      boss: {
        id: RAID_DEFINITION.id,
        name: RAID_DEFINITION.name,
        image: cardById('deadline-dragon')?.image,
        stage: Math.max(1, Number(state.raid?.stage) || 1),
        maxHp: Math.max(1, Number(state.raid?.maxHp) || RAID_DEFINITION.maxHp),
        hp: Math.max(0, Number(state.raid?.hp ?? state.raid?.currentHp ?? state.raid?.maxHp ?? RAID_DEFINITION.maxHp)),
      },
      seed: Date.now(),
    });
    ui.raid.serverBattle = null;
    ui.raid.error = '';
    ui.raid.inspector = null;
    ui.raid.animation = null;
    render();
  } catch (error) {
    showNotice(error.message || '레이드 전투를 준비하지 못했습니다.', 'warning');
  }
}

function maybeShowMobileNotificationPermissionPrompt() {
  if (!store) return false;
  const prompt = mobileNotificationPermissionPrompt({
    platform: clientPlatform,
    authenticated: ui.auth.phase === 'authenticated',
    cloudActive: ui.cloud.phase === 'active',
    notificationsEnabled: store.getState().settings.incidentNotifications === true,
    permissionDisplay: ui.notificationPermission,
    alreadyShown: ui.notificationPermissionPromptShown,
  });
  if (!prompt) return false;
  ui.notificationPermissionPromptShown = true;
  ui.modal = { type: 'notification-permission', action: prompt.action };
  return true;
}

async function prepareMobileNotificationPermissionPrompt() {
  if (clientPlatform !== 'android' || !store) return false;
  try {
    const permission = await desktopBridge.getGameNotificationPermission();
    ui.notificationPermission = String(permission?.display || 'unknown');
    const opened = maybeShowMobileNotificationPermissionPrompt();
    if (opened) render();
    return opened;
  } catch (error) {
    ui.notificationPermission = 'unavailable';
    console.warn('Could not read Android notification permission:', error);
    return false;
  }
}

async function beginRaidBattle() {
  if (ui.raid.battlePending || !ui.raid.battle || ui.raid.battle.status !== 'ready') return;
  if (ui.auth.offline || !isRaidGatewayConfigured()) {
    showNotice('개인 레이드는 온라인 연결이 필요합니다.', 'warning');
    return;
  }
  ui.raid.battlePending = true;
  ui.raid.error = '';
  render();
  try {
    await flushCloudStateOrThrow();
    const state = store.getState();
    const cards = selectedRaidBattleCards(state);
    const lease = cloudPlay?.getSnapshot().lease;
    if (!lease?.leaseId) throw new Error('플레이 연결을 다시 확인해 주세요.');
    const squadScore = cards.reduce((total, member) => total + member.combatPower, 0);
    const payload = await startPersonalRaid(currentRaidToken(), {
      bossId: RAID_DEFINITION.id,
      squad: cards.map(({ cardId, enhancement }) => ({ cardId, enhancement })),
      squadScore,
      leaseId: lease.leaseId,
      deviceId,
      generation: lease.generation,
    });
    const serverBattle = payload.battle || {};
    const serverMembers = Array.isArray(serverBattle.squad) ? serverBattle.squad : [];
    const battleCards = cards.map((card) => ({
      ...card,
      ...(serverMembers.find((member) => member.cardId === card.cardId) || {}),
      combatPower: card.combatPower,
    }));
    const stageConfig = {
      ...(serverBattle.stageConfig || {}),
      id: serverBattle.bossId || RAID_DEFINITION.id,
      name: serverBattle.bossName || RAID_DEFINITION.name,
      image: cardById('deadline-dragon')?.image,
      stage: serverBattle.stage || state.raid?.stage || 1,
      maxHp: serverBattle.bossMaxHp || state.raid?.maxHp || RAID_DEFINITION.maxHp,
      hp: Math.max(0, Number(serverBattle.bossHp ?? state.raid?.hp ?? state.raid?.currentHp ?? serverBattle.bossMaxHp ?? RAID_DEFINITION.maxHp)),
    };
    ui.raid.serverBattle = serverBattle;
    ui.raid.battle = startRaidBattle(createRaidBattle({
      cards: battleCards,
      boss: stageConfig,
      stageConfig,
      seed: serverBattle.seed || Date.now(),
      now: serverBattle.startedAt || Date.now(),
    }), Date.now());
    if (payload.state) applyRaidPayload(payload);
    render();
    scheduleBossRaidAction();
  } catch (error) {
    if (error?.code === 'PLAY_SESSION_LOST' || error?.code === 'PLAYING_ELSEWHERE') void retryCloudConnection();
    ui.raid.error = error.message || '레이드 전투를 시작하지 못했습니다.';
    showNotice(ui.raid.error, 'warning');
  } finally {
    ui.raid.battlePending = false;
    render();
  }
}

function clearRaidAnimation(delay = 680) {
  window.setTimeout(() => {
    if (!ui.raid.animation) return;
    ui.raid.animation = null;
    render();
    scheduleBossRaidAction();
  }, delay);
}

function performRaidPlayerTurn(type = 'basic', { automatic = false, choice = null } = {}) {
  const before = ui.raid.battle;
  if (!before || before.status !== 'active' || before.currentActor !== 'card' || ui.raid.battlePending) return;
  const actorIndex = Number(before.currentActorIndex);
  const actor = before.cards?.[actorIndex];
  if (!actor) return;
  try {
    const next = performPlayerAction(before, { type, choice }, Date.now());
    const dealtDamage = Math.max(0, Number(before.boss?.hp) - Number(next.boss?.hp));
    const newLogs = (next.log || []).slice((before.log || []).length);
    const damageAmount = newLogs
      .filter((entry) => ['damage', 'counter'].includes(entry.type) && entry.targetId === next.boss.id)
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.amount) || 0), 0) || dealtDamage;
    const breakAmount = newLogs
      .filter((entry) => entry.type === 'break')
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.amount) || 0), 0);
    const skill = type === 'skill' ? skillForCard(actor.cardId, actor.enhancement) : null;
    ui.raid.battle = next;
    ui.raid.inspector = null;
    ui.raid.animation = {
      attacker: dealtDamage > 0 ? actorIndex : null,
      targets: dealtDamage > 0 ? ['boss'] : [],
      message: automatic ? `${actor.name}이(가) 시간 초과로 기본공격을 사용했습니다.` : `${actor.name}의 ${skill?.name || '기본공격'}!`,
      skillCutIn: skill ? { image: actor.image || cardById(actor.cardId)?.image, name: skill.name } : null,
      damageAmount,
      breakAmount,
    };
    render();
    clearRaidAnimation(skill ? 1260 : 680);
  } catch (error) {
    showNotice(error.message || '행동을 처리하지 못했습니다.', 'warning');
  }
}

function scheduleBossRaidAction() {
  window.clearTimeout(ui.raid.bossActionTimer);
  ui.raid.bossActionTimer = null;
  const battle = ui.raid.battle;
  if (!battle || battle.status !== 'active' || battle.currentActor !== 'boss' || ui.raid.animation || ui.raid.battlePending) return;
  ui.raid.bossActionTimer = window.setTimeout(() => {
    ui.raid.bossActionTimer = null;
    performRaidBossTurn();
  }, 1000);
}

function performRaidBossTurn() {
  const before = ui.raid.battle;
  if (!before || before.status !== 'active' || before.currentActor !== 'boss') return;
  try {
    const next = performBossAction(before, Date.now());
    const targetIndexes = before.cards
      .map((card, index) => (Number(next.cards[index]?.hp) < Number(card.hp) ? index : -1))
      .filter((index) => index >= 0);
    const skipped = before.boss.stunned || next.log.at(-1)?.type === 'boss-skip';
    ui.raid.battle = next;
    ui.raid.animation = {
      attacker: skipped ? null : 'boss',
      targets: targetIndexes,
      message: next.log.at(-1)?.message || (skipped ? '보스가 행동할 수 없습니다.' : '보스의 공격!'),
    };
    render();
    clearRaidAnimation(680);
  } catch (error) {
    showNotice(error.message || '보스 행동을 처리하지 못했습니다.', 'warning');
  }
}

async function completeRaidBattle({ leave = false } = {}) {
  const battle = ui.raid.battle;
  if (!battle || ui.raid.finishing) return;
  if (battle.status === 'ready') {
    ui.raid.battle = null;
    ui.raid.serverBattle = null;
    render();
    return;
  }
  if (battle.status === 'active' && !leave) return;
  ui.raid.finishing = true;
  render();
  try {
    const lease = cloudPlay?.getSnapshot().lease;
    const payload = await finishPersonalRaid(currentRaidToken(), {
      sessionId: ui.raid.serverBattle?.sessionId || battle.sessionId,
      bossHpRemaining: battle.boss.hp,
      damageDealt: battle.totalDamage,
      turns: battle.round,
      battleLog: battle.log,
      leaseId: lease?.leaseId,
      deviceId,
      generation: lease?.generation,
    });
    const result = payload.result || {};
    const reward = applyRaidPayload(payload, {
      activityMessage: `개인 레이드 ${formatNumber(battle.stage)}단계에서 ${formatNumber(battle.totalDamage)} 피해를 기록했습니다.`,
    });
    const experiencePerCard = raidExperienceReward({
      damageDealt: battle.totalDamage,
      stage: battle.stage,
      cleared: Boolean(result.cleared),
    });
    store.update((draft) => {
      const experience = grantCardExperience(
        draft.cardProgression,
        battle.cards.map((card) => card.cardId),
        experiencePerCard,
        draft.collection,
      );
      draft.cardProgression = experience.cardProgression;
      appendActivity(draft, `레이드 참가 카드가 각각 경험치 ${formatNumber(experiencePerCard)}을 획득했습니다.`, 'card');
    });
    ui.raid.battle = null;
    ui.raid.serverBattle = null;
    ui.raid.inspector = null;
    if (!leave) {
      ui.modal = {
        type: 'result',
        message: result.cleared
          ? `${formatNumber(battle.stage)}단계를 클리어했습니다. 이번 도전 점수 ${formatNumber(battle.totalDamage)}점`
          : `이번 도전에서 ${formatNumber(battle.totalDamage)}점을 획득했습니다.`,
        rewardText: `주간 누적 ${formatNumber(payload.state?.totalContribution ?? payload.state?.contribution ?? battle.totalDamage)}점 · 카드당 경험치 ${formatNumber(experiencePerCard)}${reward.coins || reward.packs ? ` · ${rewardText(reward)}` : ''}`,
      };
    }
  } catch (error) {
    ui.raid.error = error.message || '레이드 결과를 저장하지 못했습니다.';
    showNotice(ui.raid.error, 'warning');
    return;
  } finally {
    ui.raid.finishing = false;
  }
  render();
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
  return parts.join(' · ') || '기록 갱신';
}

function saveCurrentDeckPreset(slot, context) {
  const state = store.getState();
  const raid = context === 'raid';
  const existing = state.deckPresets?.[slot];
  const cardIds = raid ? state.selectedRaidSquad : state.selectedExpeditionSquad;
  const equipmentCardId = raid ? state.selectedRaidEquipmentId : state.selectedExpeditionEquipmentId;
  store.update((draft) => {
    draft.deckPresets = saveDeckPreset(draft.deckPresets, slot, {
      name: existing?.name || `프리셋 ${Number(slot) + 1}`,
      cardIds,
      equipmentCardId,
      artifactCardId: '',
      identityForId: cardCharacterIdentity,
    });
    appendActivity(draft, `${raid ? '레이드' : '모험'} 덱을 프리셋 ${Number(slot) + 1}에 저장했습니다.`, 'card');
  });
  showNotice(`프리셋 ${Number(slot) + 1}에 저장했습니다.`, 'success');
}

function loadSavedDeckPreset(slot, context) {
  const state = store.getState();
  const preset = state.deckPresets?.[slot];
  if (!preset) {
    showNotice('저장된 덱 프리셋이 없습니다.', 'warning');
    return;
  }
  const raid = context === 'raid';
  let cards = deckPresetCards(preset, {
    collection: state.collection,
    identityForId: cardCharacterIdentity,
  });
  if (raid) cards = availableRaidSquad(cards, state.expedition, state.collection, { identityForId: cardCharacterIdentity });
  const equipment = equipmentById(state.equipmentInventory, preset.equipmentCardId);
  store.update((draft) => {
    if (raid) {
      draft.selectedRaidSquad = cards;
      draft.selectedRaidEquipmentId = equipment?.id || '';
    } else {
      draft.selectedExpeditionSquad = cards;
      draft.selectedExpeditionEquipmentId = equipment?.id || '';
    }
    appendActivity(draft, `${preset.name}을(를) ${raid ? '레이드' : '모험'} 덱에 불러왔습니다.`, 'card');
  });
  ui.view = raid ? 'raid' : 'adventure';
  showNotice(`${preset.name}을(를) 불러왔습니다.`, 'success');
  render();
  if (raid) void refreshPersonalRaid({ silent: true });
}

async function resolveActiveIncident({ choiceId, instanceId = null, incidentId = null, fromToast = false }) {
  if (ui.cloud.phase !== 'active') throw new Error('클라우드 연결을 확인한 뒤 다시 선택해 주세요.');
  const state = store.getState();
  const active = state.activeIncident;
  const nativeNotificationId = incidentNotificationId(active);
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
    if (nativeNotificationId) await desktopBridge.cancelGameNotification(nativeNotificationId);
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
    } else {
      await scheduleIncidentNotification({ id: incident.id, scheduledAt }, incident);
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
      const nativeNotificationId = incidentNotificationId(active);
      if (nativeNotificationId) await desktopBridge.cancelGameNotification(nativeNotificationId);
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

function handleGameNotificationOpened(notification) {
  if (!notification) return;
  if (!store || ui.auth.phase !== 'authenticated' || ui.cloud.phase !== 'active') {
    pendingGameNotificationOpen = notification;
    return;
  }
  const type = String(notification.type || notification.payload?.type || '');
  if (type === 'incident') {
    restorePendingIncidentIfDue();
    if (store.getState().activeIncident) openActiveIncident();
    else {
      ui.view = 'dashboard';
      render();
    }
    return;
  }
  if (type === 'expedition') {
    ui.view = 'adventure';
    if (!completeExpeditionIfReady()) render();
  }
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
    void desktopBridge.cancelAllGameNotifications().catch(() => {});
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

function currentAuthToken() {
  return String(authSession.get()?.token || '');
}

function currentMailboxIdentity() {
  return {
    accountId: ui.auth.account?.id || ui.auth.account?._id || '',
    token: currentAuthToken(),
  };
}

function invalidateMailboxRequests() {
  mailboxRequestGuard.invalidate();
}

function isCurrentMailboxRequest(request) {
  return mailboxRequestGuard.isCurrent(request, currentMailboxIdentity());
}

function isAuthorizedMailboxRequest(request) {
  const identity = currentMailboxIdentity();
  return Boolean(request)
    && request.accountId === identity.accountId
    && request.token === identity.token;
}

async function refreshMailbox({ silent = false } = {}) {
  if (ui.auth.phase !== 'authenticated') return false;
  const request = mailboxRequestGuard.begin(currentMailboxIdentity());
  if (!silent) {
    ui.mailbox.loading = true;
    ui.mailbox.error = '';
    render();
  }
  try {
    const result = await loadMailbox(request.token);
    if (!isCurrentMailboxRequest(request)) return false;
    ui.mailbox.items = result.mailbox;
    ui.mailbox.lastLoadedAt = Date.now();
    ui.mailbox.error = '';
    return true;
  } catch (error) {
    if (!isCurrentMailboxRequest(request)) return false;
    ui.mailbox.error = error.message || '우편함을 불러오지 못했습니다.';
    return false;
  } finally {
    if (isCurrentMailboxRequest(request)) {
      ui.mailbox.loading = false;
      render();
    }
  }
}

async function readMailboxItem(mailId) {
  const request = mailboxRequestGuard.capture(currentMailboxIdentity());
  try {
    const result = await markMailRead(request.token, mailId);
    if (!isCurrentMailboxRequest(request)) return false;
    ui.mailbox.items = result.mailbox;
    ui.mailbox.error = '';
  } catch (error) {
    if (!isCurrentMailboxRequest(request)) return false;
    ui.mailbox.error = error.message || '우편을 읽음 처리하지 못했습니다.';
  }
  render();
  return true;
}

async function claimMailboxRewards(mailId = '') {
  const activeCloudPlay = cloudPlay;
  if (!activeCloudPlay || ui.cloud.phase !== 'active' || ui.mailbox.claimingId) return false;
  const mailboxRequest = mailboxRequestGuard.capture(currentMailboxIdentity());
  ui.mailbox.claimingId = mailId || '*';
  ui.mailbox.error = '';
  render();
  let authoritativeMutationStarted = false;
  try {
    await flushCloudStateOrThrow();
    if (!isAuthorizedMailboxRequest(mailboxRequest)) return false;
    // Reserve the current cloud revision while the mailbox endpoint performs
    // its atomic reward write.  Any game activity that happens during the
    // request stays in the durable outbox and is rebased on the authoritative
    // reward snapshot before it can be sent back to the server.
    const mutation = activeCloudPlay.beginAuthoritativeMutation(store.getState());
    authoritativeMutationStarted = true;
    const snapshot = activeCloudPlay.getSnapshot();
    const request = {
      leaseId: snapshot.lease?.leaseId || '',
      deviceId,
      generation: snapshot.lease?.generation || 0,
      baseRevision: mutation.baseRevision,
    };
    const result = mailId
      ? await claimMailboxItem(mailboxRequest.token, { ...request, mailId })
      : await claimAllMailboxItems(mailboxRequest.token, request);
    // A refresh can supersede this request's mailbox list epoch.  The cloud
    // claim still belongs to the same authenticated account, so commit its
    // authoritative state even when the UI will be refreshed by that newer
    // request.
    if (!isAuthorizedMailboxRequest(mailboxRequest)) return false;
    activeCloudPlay.commitAuthoritativeMutation(result.snapshot);
    authoritativeMutationStarted = false;
    // If a local action occurred while the request was in flight, the commit
    // rebased it onto the reward snapshot and queued it at the new revision.
    // Flush that rebased state before reporting success so the next request
    // cannot observe a stale local copy.
    await flushCloudStateOrThrow();
    if (!isAuthorizedMailboxRequest(mailboxRequest)) return false;
    ui.mailbox.items = result.mailbox;
    ui.mailbox.lastLoadedAt = Date.now();
    const coins = Number(result.rewards?.coins) || 0;
    const packs = Number(result.rewards?.standardPacks) || 0;
    const rewardParts = [coins ? `${formatNumber(coins)} 동전` : '', packs ? `${formatNumber(packs)} 카드팩` : ''].filter(Boolean);
    showNotice(rewardParts.length ? `${rewardParts.join(' · ')}을 받았습니다.` : '우편을 확인했습니다.', 'success');
    return true;
  } catch (error) {
    if (authoritativeMutationStarted) activeCloudPlay.cancelAuthoritativeMutation();
    if (!isAuthorizedMailboxRequest(mailboxRequest)) return false;
    ui.mailbox.error = error.message || '우편 보상을 수령하지 못했습니다.';
    if (['PLAY_SESSION_LOST', 'PLAYING_ELSEWHERE'].includes(error.code)) {
      await retryCloudConnection();
    }
    return false;
  } finally {
    // A mailbox refresh, logout, or account switch can invalidate this
    // request before its response arrives. Release the cloud reservation even
    // on that early-return path so future saves are never left paused.
    if (authoritativeMutationStarted) activeCloudPlay.cancelAuthoritativeMutation();
    if (isAuthorizedMailboxRequest(mailboxRequest)) {
      ui.mailbox.claimingId = '';
      render();
    } else if (ui.auth.phase === 'authenticated'
      && currentMailboxIdentity().accountId === mailboxRequest.accountId
      && currentMailboxIdentity().token === mailboxRequest.token
      && ui.mailbox.claimingId === (mailId || '*')) {
      // A newer list request superseded this claim while the account stayed
      // the same. Clear only this request's spinner; never touch a new
      // account's mailbox state.
      ui.mailbox.claimingId = '';
      render();
    }
  }
}

async function loadAdminUsers() {
  if (!ui.admin.token) return false;
  ui.admin.loading = true;
  ui.admin.error = '';
  render();
  try {
    const [result, catalog] = await Promise.all([
      loadTcgAdminUsers(ui.admin.token),
      loadTcgAdminGrantCatalog(ui.admin.token),
    ]);
    ui.admin.users = Array.isArray(result.users) ? result.users : [];
    ui.admin.packages = Array.isArray(catalog.packages) ? catalog.packages : [];
    return true;
  } catch (error) {
    ui.admin.error = error.message || '사용자 목록을 불러오지 못했습니다.';
    if ([401, 403].includes(Number(error.status))) ui.admin.token = '';
    return false;
  } finally {
    ui.admin.loading = false;
    render();
  }
}

async function submitAdminLogin(form) {
  const data = new FormData(form);
  ui.admin.loading = true;
  ui.admin.error = '';
  render();
  try {
    const result = await loginTcgAdmin(
      String(data.get('username') || '').normalize('NFKC').trim(),
      String(data.get('password') || '').normalize('NFC').trim(),
    );
    if (!result?.token) throw new Error('관리자 로그인 응답이 올바르지 않습니다.');
    ui.admin.token = result.token;
    await loadAdminUsers();
  } catch (error) {
    ui.admin.token = '';
    ui.admin.error = error.message || '관리자 로그인에 실패했습니다.';
  } finally {
    ui.admin.loading = false;
    render();
  }
}

async function submitAdminMail(form) {
  if (!ui.admin.token || ui.admin.sending) return;
  const data = new FormData(form);
  const target = String(data.get('target') || 'all');
  const presetId = String(data.get('presetId') || 'custom');
  const preset = ui.admin.packages.find((entry) => entry.id === presetId);
  const coins = preset
    ? Math.max(0, Math.floor(Number(preset.rewards?.coins) || 0))
    : Math.max(0, Math.floor(Number(data.get('coins')) || 0));
  const standardPacks = preset
    ? Math.max(0, Math.floor(Number(preset.rewards?.standardPacks) || 0))
    : Math.max(0, Math.floor(Number(data.get('standardPacks')) || 0));
  const payload = {
    targetMode: target === 'all' ? 'all' : 'single',
    ...(target === 'all' ? {} : { targetAccountId: target }),
    title: String(data.get('title') || '').trim(),
    message: String(data.get('message') || '').trim(),
    ...(preset ? { presetId } : {}),
    rewards: { coins, standardPacks },
    expiresInHours: Math.max(1, Math.floor(Number(data.get('expiresInHours')) || 168)),
  };
  ui.admin.draft = {
    target,
    presetId,
    title: String(data.get('title') || ''),
    message: String(data.get('message') || ''),
    coins: String(coins),
    standardPacks: String(standardPacks),
    expiresInHours: String(data.get('expiresInHours') || '168'),
  };
  const payloadFingerprint = JSON.stringify(payload);
  const previousRequest = ui.admin.pendingMailRequest;
  const requestId = previousRequest?.fingerprint === payloadFingerprint
    ? previousRequest.requestId
    : (globalThis.crypto?.randomUUID?.() || `mail-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  // Keep the id while a send is in flight or failed. If the same form is
  // retried after a timeout, the server can safely return the first result
  // instead of creating a second copy of the mail.
  ui.admin.pendingMailRequest = { fingerprint: payloadFingerprint, requestId };
  ui.admin.sending = true;
  ui.admin.error = '';
  render();
  try {
    const result = await sendTcgAdminMail(ui.admin.token, { ...payload, requestId });
    ui.admin.pendingMailRequest = null;
    showNotice(`${formatNumber(result.newlyDeliveredCount)}명에게 우편을 발송했습니다.`, 'success');
  } catch (error) {
    ui.admin.error = error.message || '우편을 발송하지 못했습니다.';
    if ([401, 403].includes(Number(error.status))) ui.admin.token = '';
  } finally {
    ui.admin.sending = false;
    render();
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
  await syncMobileGameNotifications();
  maybeShowMobileNotificationPermissionPrompt();
  const openedNotification = pendingGameNotificationOpen
    || await desktopBridge.consumeLastOpenedGameNotification().catch(() => null);
  pendingGameNotificationOpen = null;
  if (openedNotification) handleGameNotificationOpened(openedNotification);
  await refreshPersonalRaid({ silent: true });
  render();
  void refreshMailbox({ silent: true });
  void checkForAppUpdates();
}

async function activateAuthenticatedSession(session, { newAccount = false } = {}) {
  const account = session.account;
  invalidateMailboxRequests();
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
  ui.raid = createRaidUiState();
  ui.mailbox = { loading: false, claimingId: '', items: [], error: '', lastLoadedAt: 0 };
  ui.admin = {
    token: '', loading: false, sending: false, users: [], packages: [], error: '',
    draft: { target: 'all', presetId: 'custom', title: '', message: '', coins: '0', standardPacks: '0', expiresInHours: '168' },
    pendingMailRequest: null,
  };
  ui.view = 'dashboard';
  ui.modal = null;
  ui.cloud = { phase: 'connecting', message: '', code: '', activePlatform: '', generation: 0 };
  render();

  if (ui.appVersion === '...') {
    ui.appVersion = await desktopBridge.getVersion().catch(() => '0.0.0');
  }
  // Notification permission is local to Android and must not depend on winning
  // the single-device cloud lease. This also lets a phone prompt correctly
  // while the same account is still open on PC.
  await prepareMobileNotificationPermissionPrompt();
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
  invalidateMailboxRequests();
  ui.mailbox.loading = false;
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
  await desktopBridge.cancelAllGameNotifications().catch((error) => {
    console.warn('Could not cancel Android game notifications during logout:', error);
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
  ui.raid = createRaidUiState();
  ui.mailbox = { loading: false, claimingId: '', items: [], error: '', lastLoadedAt: 0 };
  ui.admin = {
    token: '', loading: false, sending: false, users: [], packages: [], error: '',
    draft: { target: 'all', presetId: 'custom', title: '', message: '', coins: '0', standardPacks: '0', expiresInHours: '168' },
    pendingMailRequest: null,
  };
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

async function checkForAppUpdates() {
  if (updateCheckPromise) return updateCheckPromise;
  updateCheckPromise = (async () => {
    ui.updateStatus = { status: 'checking' };
    render();
    try {
      const result = await desktopBridge.checkForUpdates();
      if (result?.status && !['denied'].includes(result.status)) {
        ui.updateStatus = result;
        render();
      }
      return result;
    } catch (error) {
      ui.updateStatus = {
        status: 'error',
        message: error.message || '업데이트 확인에 실패했습니다.',
      };
      render();
      return ui.updateStatus;
    }
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
      ui.updateStatus = {
        ...ui.updateStatus,
        status: 'saving',
        message: '기기와 클라우드에 진행 기록을 저장하고 있습니다.',
        downloadUrl,
      };
      render();
      // An in-place APK update preserves local storage. Save it first, then
      // give login restoration a short best-effort window on slow networks.
      flushLocalGameCache();
      const restoreStatus = await waitForOptionalUpdateRestore(authenticationRestorePromise, { timeoutMs: 4_000 });
      if (restoreStatus === 'restored') flushLocalGameCache();
      const activeCloudSession = Boolean(cloudPlay?.getSnapshot().lease);
      if (shouldFlushCloudBeforeUpdate({ cloudPhase: ui.cloud.phase, hasCloudSession: activeCloudSession })) {
        await withDeadline(() => flushCloudStateOrThrow(), {
          timeoutMs: 20_000,
          timeoutError: () => Object.assign(new Error('진행 기록 저장 시간이 초과되었습니다. 기기 기록은 보관되어 있으니 연결을 확인한 뒤 다시 시도해 주세요.'), { code: 'UPDATE_SAVE_TIMEOUT' }),
        });
      }
      if (cloudPlay?.getSnapshot().lease) {
        try {
          await withDeadline(() => cloudPlay.release({ flushPending: false }), {
            timeoutMs: 15_000,
            timeoutError: () => Object.assign(new Error('플레이 연결 반납 응답이 늦습니다.'), { code: 'UPDATE_RELEASE_TIMEOUT' }),
          });
        } catch (error) {
          // The game state was already saved. A release response can be lost
          // without risking progress; the server lease expires automatically.
          console.warn('Could not confirm cloud release before Android update:', error);
        }
        releasedCloudSession = !cloudPlay?.getSnapshot().lease;
      }
      await desktopBridge.cancelIncident();

      if (clientPlatform === 'android') {
        if (ui.updateStatus.updateMode === 'reinstall') {
          const opened = await desktopBridge.openExternal(downloadUrl);
          if (!opened) throw new Error('새 버전 APK 주소를 열지 못했습니다.');
          ui.updateStatus = {
            ...ui.updateStatus,
            status: 'available',
            updateMode: 'reinstall',
            message: 'APK 다운로드가 시작되었습니다. 설치 후 다시 실행해 주세요.',
          };
          render();
          return true;
        }
        ui.updateStatus = {
          ...ui.updateStatus,
          status: 'downloading',
          detail: 0,
          message: '안드로이드가 업데이트 파일을 받고 있습니다.',
          downloadUrl,
        };
        render();
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
      if (clientPlatform === 'android' && error.code === 'UPDATE_SIGNATURE_MISMATCH') {
        ui.updateStatus = {
          ...ui.updateStatus,
          status: 'available',
          updateMode: 'reinstall',
          message: '현재 앱과 새 앱의 설치 서명이 달라 APK를 새로 설치해야 합니다.',
          downloadUrl,
        };
        await desktopBridge.openExternal(downloadUrl).catch(() => false);
        render();
        if ((releasedCloudSession || ui.cloud.phase !== 'active') && ui.auth.phase === 'authenticated') await retryCloudConnection();
        return true;
      }
      const hasSaveConflict = error.code === 'CLOUD_SAVE_CONFLICT' || cloudPlay?.getSnapshot().hasSaveConflict;
      if (!hasSaveConflict) {
        ui.updateStatus = {
          ...ui.updateStatus,
          status: 'available',
          message: error.message || '업데이트를 열지 못했습니다. 다시 시도해 주세요.',
          downloadUrl,
        };
        render();
      }
      if ((releasedCloudSession || ui.cloud.phase !== 'active') && ui.auth.phase === 'authenticated') await retryCloudConnection();
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
    && ((ui.cloud.phase !== 'active' && !actionsAllowedWhileCloudBlocked.has(action))
      || (updateBlocksGameplay() && !actionsAllowedWhileCloudBlocked.has(action)))) return;

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
    if (ui.view === 'mailbox' && Date.now() - ui.mailbox.lastLoadedAt > 10000) void refreshMailbox({ silent: true });
  } else if (action === 'navigate-from-modal') {
    ui.view = button.dataset.view;
    ui.modal = null;
    render();
    if (ui.view === 'raid' && ui.raidMode === 'personal') void refreshPersonalRaid({ silent: true });
  } else if (action === 'manage-card') {
    ui.enhanceCardId = button.dataset.cardId;
    ui.enhanceTargetStage = null;
    ui.enhanceMaterialStage = null;
    ui.managementPanel = 'enhance';
    ui.view = 'management';
    ui.modal = null;
    render();
  } else if (action === 'switch-management-panel') {
    ui.managementPanel = button.dataset.managementPanel === 'synthesis' ? 'synthesis' : 'enhance';
    render({ preserveViewScroll: false });
  } else if (action === 'select-enhance-card') {
    ui.enhanceCardId = button.dataset.cardId;
    ui.enhanceTargetStage = null;
    ui.enhanceMaterialStage = null;
    render({ preserveViewScroll: true });
  } else if (action === 'select-enhance-target') {
    ui.enhanceTargetStage = Number(button.dataset.enhancement);
    ui.enhanceMaterialStage = null;
    render({ preserveViewScroll: true });
  } else if (action === 'select-enhance-material') {
    ui.enhanceMaterialStage = Number(button.dataset.enhancement);
    render({ preserveViewScroll: true });
  } else if (action === 'enhance-card') {
    enhanceSelectedCard();
  } else if (action === 'select-synthesis-rarity') {
    if (ui.synthesisMaterials.length) return;
    ui.synthesisRarity = button.dataset.rarity;
    render({ preserveViewScroll: true });
  } else if (action === 'add-synthesis-material') {
    addSynthesisMaterial(button.dataset.cardId, button.dataset.enhancement);
  } else if (action === 'remove-synthesis-material') {
    const index = Number(button.dataset.materialIndex);
    if (Number.isInteger(index) && index >= 0 && index < ui.synthesisMaterials.length) {
      ui.synthesisMaterials.splice(index, 1);
      render({ preserveViewScroll: true });
    }
  } else if (action === 'clear-synthesis-materials') {
    ui.synthesisMaterials = [];
    render({ preserveViewScroll: true });
  } else if (action === 'auto-fill-synthesis') {
    autoFillSynthesisMaterials();
  } else if (action === 'synthesize-cards') {
    synthesizeSelectedCards();
  } else if (action === 'batch-synthesize-cards') {
    synthesizeCardsByRarity();
  } else if (action === 'resume-pack-opening') {
    resumePendingPackOpening();
  } else if (action === 'open-pack' || action === 'open-another-pack') {
    openStandardPacks(Number(button.dataset.packCount) || 1);
  } else if (action === 'buy-pack') {
    buyStandardPack();
  } else if (action === 'buy-and-open-pack') {
    if (buyStandardPack({ notify: false })) openStandardPacks(1);
  } else if (action === 'reveal-pack-card') {
    if (ui.modal?.type !== 'pack') return;
    const index = Number(button.dataset.cardIndex);
    if (!Number.isInteger(index) || index < 0 || index >= ui.modal.cards.length) return;
    revealPackCardAtIndex(index, button.dataset.openingId);
  } else if (action === 'open-card') {
    ui.modal = { type: 'card', cardId: button.dataset.cardId };
    render();
  } else if (action === 'navigate-card-detail') {
    const cardId = String(button.dataset.cardId || '');
    if (!cardById(cardId)) return;
    ui.modal = { type: 'card', cardId };
    render();
  } else if (action === 'level-up-card') {
    const cardId = String(button.dataset.cardId || '');
    const card = cardById(cardId);
    if (!card) return;
    try {
      const state = store.getState();
      const outcome = purchaseCardLevel({
        cardProgression: state.cardProgression,
        collection: state.collection,
        wallet: state.wallet,
        cardId,
      });
      store.update((draft) => {
        draft.wallet = outcome.wallet;
        draft.cardProgression = outcome.cardProgression;
        appendActivity(draft, `${cardDisplayName(card)} 카드가 Lv.${formatNumber(outcome.after.level)}에 도달했습니다.`, 'card');
      });
      showNotice(`${cardDisplayName(card)} Lv.${formatNumber(outcome.after.level)} · ${formatNumber(outcome.cost)} 동전 사용`, 'success');
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  } else if (action === 'refresh-mailbox') {
    await refreshMailbox();
  } else if (action === 'read-mail') {
    await readMailboxItem(button.dataset.mailId);
  } else if (action === 'claim-mail') {
    await claimMailboxRewards(button.dataset.mailId);
  } else if (action === 'claim-all-mail') {
    await claimMailboxRewards();
  } else if (action === 'toggle-card-lock') {
    const cardId = String(button.dataset.cardId || '');
    const card = cardById(cardId);
    if (!card || Number(store.getState().collection[cardId]) <= 0) return;
    store.update((draft) => {
      const locked = new Set(draft.lockedCardIds || []);
      if (locked.has(cardId)) locked.delete(cardId);
      else locked.add(cardId);
      draft.lockedCardIds = [...locked];
      appendActivity(draft, `${cardDisplayName(card)} 카드 잠금을 ${locked.has(cardId) ? '설정' : '해제'}했습니다.`, 'card');
    });
    ui.synthesisMaterials = ui.synthesisMaterials.filter((material) => material.cardId !== cardId);
    render();
  } else if (action === 'close-modal') {
    if (button.classList.contains('modal-backdrop') && event.target.closest('[data-modal-panel]')) return;
    ui.modal = null;
    render();
  } else if (action === 'filter-rarity') {
    ui.rarityFilter = button.dataset.rarity;
    render();
  } else if (action === 'toggle-owned-cards') {
    ui.collectionOwnedOnly = !ui.collectionOwnedOnly;
    render();
  } else if (action === 'sort-collection') {
    ui.collectionSort = button.dataset.sort === 'rarity-desc' ? 'rarity-desc' : 'rarity-asc';
    render();
  } else if (action === 'toggle-squad') {
    toggleSquadCard(button.dataset.cardId, button.dataset.context);
  } else if (action === 'save-deck-preset') {
    saveCurrentDeckPreset(Number(button.dataset.slot), button.dataset.context === 'raid' ? 'raid' : 'adventure');
  } else if (action === 'load-deck-preset') {
    loadSavedDeckPreset(Number(button.dataset.slot), button.dataset.context === 'raid' ? 'raid' : 'adventure');
  } else if (action === 'select-mission') {
    ui.selectedMissionId = button.dataset.missionId;
    render();
  } else if (action === 'start-expedition') {
    beginExpedition();
  } else if (action === 'cancel-expedition') {
    const notificationId = expeditionNotificationId(store.getState().expedition);
    store.update((draft) => {
      const mission = expeditionById(draft.expedition?.missionId);
      draft.expedition = null;
      appendActivity(draft, `${mission?.name || '모험'}을 중단했습니다.`, 'adventure');
    });
    if (notificationId) void desktopBridge.cancelGameNotification(notificationId).catch(() => {});
    showNotice('모험을 중단했습니다.', 'warning');
  } else if (action === 'enter-raid-battle') {
    enterRaidBattle();
  } else if (action === 'begin-raid-battle') {
    await beginRaidBattle();
  } else if (action === 'raid-basic-attack') {
    performRaidPlayerTurn('basic');
  } else if (action === 'raid-skill-attack') {
    const battle = ui.raid.battle;
    const activeCard = battle?.cards?.[battle.currentActorIndex];
    if (activeCard?.cardId === 'guma-hr') {
      ui.raid.inspector = { type: 'skill-choice' };
      render();
    } else {
      performRaidPlayerTurn('skill');
    }
  } else if (action === 'raid-skill-choice') {
    const choice = String(button.dataset.choice || 'fortune');
    ui.raid.inspector = null;
    performRaidPlayerTurn('skill', { choice });
  } else if (action === 'finish-raid-battle') {
    await completeRaidBattle();
  } else if (action === 'leave-raid-battle') {
    await completeRaidBattle({ leave: true });
  } else if (action === 'inspect-raid-card') {
    ui.raid.inspector = { type: 'skill', cardIndex: Number(button.dataset.cardIndex) };
    render();
  } else if (action === 'inspect-raid-effect') {
    ui.raid.inspector = {
      type: 'effect',
      owner: button.dataset.effectOwner,
      index: Number(button.dataset.effectIndex),
    };
    render();
  } else if (action === 'close-raid-inspector') {
    ui.raid.inspector = null;
    render();
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
  } else if (action === 'open-donation') {
    ui.modal = { type: 'donation' };
    render();
  } else if (action === 'open-admin') {
    ui.admin.error = '';
    ui.modal = { type: 'admin' };
    render();
    if (ui.admin.token && !ui.admin.users.length) void loadAdminUsers();
  } else if (action === 'admin-logout') {
    ui.admin = {
      token: '', loading: false, sending: false, users: [], packages: [], error: '',
      draft: { target: 'all', presetId: 'custom', title: '', message: '', coins: '0', standardPacks: '0', expiresInHours: '168' },
      pendingMailRequest: null,
    };
    render();
  } else if (action === 'toggle-notifications') {
    const notificationKind = desktopBridge.isDesktop ? '데스크톱 팝업' : '모바일';
    let enabled = button.checked;
    if (clientPlatform === 'android' && enabled) {
      const permission = await desktopBridge.requestGameNotificationPermission().catch(() => ({ display: 'unavailable', granted: false }));
      ui.notificationPermission = String(permission?.display || 'unavailable');
      enabled = permission?.granted === true;
    }
    store.update((draft) => {
      draft.settings.incidentNotifications = enabled;
    });
    if (clientPlatform === 'android') await syncMobileGameNotifications();
    else await desktopBridge.setIncidentNotifications(enabled);
    showNotice(
      enabled
        ? `${notificationKind} 알림을 켰습니다.`
        : (button.checked && clientPlatform === 'android'
          ? '휴대폰 알림 권한이 필요합니다. 설정에서 권한을 허용해 주세요.'
          : `${notificationKind} 알림만 껐습니다. 돌발 업무는 업무판에 계속 표시됩니다.`),
      enabled || !button.checked ? 'success' : 'warning',
    );
  } else if (action === 'toggle-quiet-hours') {
    store.update((draft) => {
      draft.settings.quietHoursNotifications = button.checked;
    });
    await syncMobileGameNotifications();
    showNotice(button.checked ? '야간 알림을 끕니다.' : '야간에도 알림을 보냅니다.', 'success');
  } else if (action === 'open-notification-settings') {
    const permission = await desktopBridge.openGameNotificationSettings().catch(() => ({ display: 'denied', granted: false }));
    ui.notificationPermission = String(permission?.display || 'denied');
    if (permission?.granted) {
      store.update((draft) => { draft.settings.incidentNotifications = true; });
      await syncMobileGameNotifications();
      showNotice('휴대폰 알림 권한을 확인했습니다.', 'success');
    } else {
      render();
    }
  } else if (action === 'request-notification-permission') {
    const permission = await desktopBridge.requestGameNotificationPermission()
      .catch(() => ({ display: 'unavailable', granted: false }));
    ui.notificationPermission = String(permission?.display || 'unavailable');
    if (permission?.granted) {
      store.update((draft) => { draft.settings.incidentNotifications = true; });
      ui.modal = null;
      await syncMobileGameNotifications();
      showNotice('휴대폰 알림을 켰습니다.', 'success');
    } else if (ui.notificationPermission === 'denied') {
      ui.modal = { type: 'notification-permission', action: 'settings' };
      showNotice('알림 권한이 꺼져 있습니다. 휴대폰 설정에서 허용해 주세요.', 'warning');
      render();
    } else {
      ui.modal = null;
      showNotice('알림 권한 요청을 열지 못했습니다. 설정에서 다시 시도해 주세요.', 'warning');
      render();
    }
  } else if (action === 'open-notification-settings-from-prompt') {
    const permission = await desktopBridge.openGameNotificationSettings()
      .catch(() => ({ display: 'denied', granted: false }));
    ui.notificationPermission = String(permission?.display || 'denied');
    if (permission?.granted) {
      store.update((draft) => { draft.settings.incidentNotifications = true; });
      ui.modal = null;
      await syncMobileGameNotifications();
      showNotice('휴대폰 알림을 켰습니다.', 'success');
    } else {
      ui.modal = { type: 'notification-permission', action: 'settings' };
      render();
    }
  } else if (action === 'dismiss-notification-permission') {
    ui.modal = null;
    render();
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
  } else if (form.dataset.form === 'admin-login') {
    void submitAdminLogin(form);
  } else if (form.dataset.form === 'admin-mail') {
    void submitAdminMail(form);
  }
});

app.addEventListener('input', (event) => {
  const adminInput = event.target.closest('.admin-mail-form [name]');
  if (adminInput) {
    ui.admin.draft = { ...(ui.admin.draft || {}), [adminInput.name]: adminInput.value };
    return;
  }
  const input = event.target.closest('.auth-form input[name]');
  if (!input || !Object.prototype.hasOwnProperty.call(ui.auth.form, input.name)) return;
  ui.auth.form[input.name] = input.value;
  ui.auth.error = '';
  if (input.name === 'username' || input.name === 'nickname') resetAuthAvailability(input.name);
  syncAuthFormControls();
});

app.addEventListener('change', (event) => {
  const equipmentSelect = event.target.closest('[data-action="select-equipment"]');
  if (equipmentSelect) {
    const context = equipmentSelect.dataset.context === 'raid' ? 'raid' : 'adventure';
    const equipmentId = String(equipmentSelect.value || '');
    const state = store.getState();
    if (equipmentId && !equipmentById(state.equipmentInventory, equipmentId)) return;
    store.update((draft) => {
      if (context === 'raid') draft.selectedRaidEquipmentId = equipmentId;
      else draft.selectedExpeditionEquipmentId = equipmentId;
    });
    render({ preserveViewScroll: true });
    return;
  }
  const adminInput = event.target.closest('.admin-mail-form [name]');
  if (!adminInput) return;
  ui.admin.draft = { ...(ui.admin.draft || {}), [adminInput.name]: adminInput.value };
  if (adminInput.name === 'presetId') {
    const preset = ui.admin.packages.find((entry) => entry.id === adminInput.value);
    ui.admin.draft.coins = String(Math.max(0, Number(preset?.rewards?.coins) || 0));
    ui.admin.draft.standardPacks = String(Math.max(0, Number(preset?.rewards?.standardPacks) || 0));
    if (preset && !String(ui.admin.draft.title || '').trim()) ui.admin.draft.title = preset.name;
    render({ preserveViewScroll: true });
  }
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
  const raidTurnNode = document.querySelector('[data-raid-turn-deadline]');
  if (raidTurnNode && ui.raid.battle?.status === 'active' && ui.raid.battle?.currentActor === 'card') {
    const remainingSeconds = Math.max(0, Math.ceil((Number(raidTurnNode.dataset.raidTurnDeadline) - Date.now()) / 1000));
    raidTurnNode.textContent = String(remainingSeconds);
    raidTurnNode.classList.toggle('is-urgent', remainingSeconds <= 5);
    if (remainingSeconds <= 0 && !ui.raid.timeoutActionPending) {
      ui.raid.timeoutActionPending = true;
      try {
        performRaidPlayerTurn('basic', { automatic: true });
      } finally {
        ui.raid.timeoutActionPending = false;
      }
    }
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
  if (status?.status === 'error' && ui.cloud.phase === 'released' && ui.auth.phase === 'authenticated') {
    void retryCloudConnection();
  }
});

desktopBridge.onGameNotificationOpened((notification) => {
  void desktopBridge.consumeLastOpenedGameNotification().catch(() => null);
  handleGameNotificationOpened(notification);
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
