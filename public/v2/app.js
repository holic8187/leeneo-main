'use strict';

const state = {
  token: localStorage.getItem('v2Token') || '',
  meta: null,
  isAdmin: localStorage.getItem('v2IsAdmin') === 'true',
  displayName: localStorage.getItem('v2DisplayName') || '',
  preview: null,
  character: null,
  maps: [],
  startMapId: 'main_lobby',
  currentMapId: localStorage.getItem('v2CurrentMapId') || '',
  autoCombat: localStorage.getItem('v2AutoCombat') === 'true',
  huntingTime: { remainingSeconds: 0, maximumSeconds: 24000, enabled: false },
  huntingTickCounter: 0,
  huntingSyncBusy: false,
  moving: false,
  activeMoveTargetX: null,
  activeMoveDeadlineAt: 0,
  moveRunId: 0,
  combatRunId: 0,
  combatAttackCount: 0,
  equipmentTab: 'weapon',
  selectedDepartmentId: '',
  selectedJobChangeDepartmentId: '',
  signupCodeConfigured: false,
  signupCodeValid: false,
  signupValidationRequest: 0,
  signupCodeTimer: null,
  worldPresenceRunId: 0,
  worldHeartbeatBusy: false,
  worldClientId: sessionStorage.getItem('v2WorldClientId')
    || globalThis.crypto?.randomUUID?.()
    || `world-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  worldControlActive: false,
  worldStateEpoch: 0,
  reviving: false,
  selfUserId: '',
  worldMonsters: [],
  combatTargetId: '',
  rallyPoint: null,
  worldServerTime: 0,
  invulnerableUntil: 0,
  invulnerabilityTimer: null,
  lastContactDamageKey: '',
  dead: false,
  deathExpLost: 0,
  inventory: {
    items: [],
    categories: {},
    potions: [],
    quickSlots: { hp: null, mp: null },
    autoUsePercent: { hp: 0, mp: 0 },
    limits: { defaultCapacity: 20, maximumCapacity: 64, expansionSize: 4 }
  },
  inventoryTab: 'consumable',
  inventoryPage: 0,
  inventoryExpansionPrompt: false,
  jobChangePrompt: false,
  mailbox: [],
  pendingMailCount: 0,
  floatingButtonsMinimized: localStorage.getItem('v2FloatingButtonsMinimized') === 'true',
  mailPollTimer: null,
  adminGrantItems: [],
  autoPotionBusy: { hp: false, mp: false },
  skillUseBusy: false,
  autoSkillOwnerKey: '',
  autoSkillIds: new Set(),
  autoSkillRotationIndex: 0,
  shop: { money: 0, buyItems: [], tab: 'consumable', shopId: '' },
  partyState: { party: null, invitation: null, nearbyPlayers: [] },
  lastPartyInvitationId: '',
  tradeState: { request: null, session: null, nearbyPlayers: [] },
  lastTradeRequestId: '',
  ranking: { all: [], online: [], tab: 'all' },
  enhancementSlot: '',
  enhancementScrollStackId: '',
  eventState: null,
  marketplace: { listings: [], mine: [], rules: {}, search: '' },
  pendingPatchNotes: null,
  patchNotesHistory: [],
  offlineSummaryKey: '',
  offlineSummaryRetryTimer: null
};
sessionStorage.setItem('v2WorldClientId', state.worldClientId);

const $ = (id) => document.getElementById(id);
const formatNumber = (value) => Number(value || 0).toLocaleString('ko-KR');
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.msg || '요청 처리에 실패했습니다.');
    error.status = response.status;
    error.code = data.code || '';
    throw error;
  }
  if (!response.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

function ratio(current, maximum) {
  const max = Math.max(0, Number(maximum) || 0);
  if (!max) return 0;
  return Math.max(0, Math.min(100, (Number(current) || 0) / max * 100));
}

function setResource(prefix, current, maximum, pendingLabel = '준비 중') {
  const currentValue = Math.max(0, Number(current) || 0);
  const maximumValue = Math.max(0, Number(maximum) || 0);
  $(`${prefix}Text`).textContent = maximumValue
    ? `${formatNumber(currentValue)} / ${formatNumber(maximumValue)}`
    : pendingLabel;
  $(`${prefix}Bar`).style.width = `${ratio(currentValue, maximumValue)}%`;
}

function setExperience(progression = {}) {
  const level = Math.max(1, Number(progression.level) || 1);
  const current = Math.max(0, Number(progression.exp) || 0);
  const required = Math.max(0, Number(progression.expToNextLevel) || 0);
  if (level >= 200 || !required) {
    $('expText').textContent = 'MAX';
    $('expBar').style.width = '100%';
    return;
  }
  const percentage = ratio(current, required);
  $('expText').textContent = `${formatNumber(current)} / ${formatNumber(required)} · ${percentage.toFixed(2)}%`;
  $('expBar').style.width = `${percentage}%`;
}

function renderGame(data) {
  state.preview = data.preview;
  state.character = data.character;
  state.displayName = data.displayName || state.displayName;

  const character = state.character || {};
  const progression = character.progression || {};
  const resources = character.resources || {};
  const actionPoints = character.actionPoints || {};
  const job = character.job || {};
  const migration = character.migration || {};
  state.huntingTime = {
    remainingSeconds: Math.max(0, Number(character.huntingTime?.remainingSeconds) || 0),
    maximumSeconds: Math.max(1, Number(character.huntingTime?.maximumSeconds) || 24000),
    enabled: Boolean(character.huntingTime?.enabled),
    offlineSummary: character.huntingTime?.offlineSummary || null
  };
  state.autoCombat = state.huntingTime.enabled && state.huntingTime.remainingSeconds > 0;
  localStorage.setItem('v2AutoCombat', String(state.autoCombat));
  renderHuntingTime();

  $('displayName').textContent = state.displayName || '사원';
  $('characterLevel').textContent = formatNumber(progression.level || state.preview?.mappedLevel);
  $('departmentBadge').textContent = job.jobName || (
    job.departmentId === 'unassigned' ? '부서 미정' : job.departmentName
  );
  $('unspentStats').textContent = `${formatNumber(progression.unspentStatPoints)} P`;
  $('unspentSkills').textContent = `${formatNumber(progression.unspentSkillPoints)} SP`;
  $('advancementTier').textContent = `${formatNumber(job.advancementTier)}차`;
  $('migrationStatus').textContent = migration.status === 'prepared' ? '준비 완료' : (migration.status || '확인 중');
  $('combatMotionLabel').textContent = `전투 모션 · ${character.combatPresentation?.label || '연습용 베기'}`;

  setResource('hp', resources.currentHp, resources.maxHp);
  setResource('mp', resources.currentMp, resources.maxMp);
  setExperience(progression);
  setResource('ap', actionPoints.current, actionPoints.max, '-');

  const prepared = Boolean(state.character);
  $('migrationStateLabel').textContent = prepared ? 'V2 자동 이관 완료' : '자동 이관 확인 중';
  $('prepareStatus').textContent = prepared
    ? `원본 스냅샷 연결 완료 · 변환 상태 ${migration.status || 'prepared'}`
    : '서버가 누락된 이관 데이터를 자동으로 준비하고 있습니다.';

  if (character.inventory) setInventoryData(character.inventory);
  renderSkillQuickbar();
  renderCombatBuffTray();
  renderCompanion();
  if (Number.isFinite(Number(character.pendingMailCount))) {
    updateMailButton(Number(character.pendingMailCount));
  }

  const quest = character.advancementQuest;
  $('questButton').classList.toggle('hidden', !quest);
  $('mailButton').classList.toggle('quest-visible', Boolean(quest));
  maybeShowOfflineHuntingSummary(state.huntingTime.offlineSummary);
  if (quest) {
    $('questButtonTitle').textContent = `${quest.targetTier}차 전직 가능`;
    $('questButtonMeta').textContent = `Lv.${quest.requiredLevel} · ${quest.nextJobName}`;
  }
}

async function loadMeta() {
  state.meta = await request('/api/v2/meta');
}

async function loadUserWorkspace() {
  const [data, world, inventoryData, mailData] = await Promise.all([
    request('/api/v2/migration/preview'),
    request('/api/v2/world/maps'),
    request('/api/v2/inventory'),
    request('/api/v2/mail')
  ]);
  state.maps = world.maps || [];
  state.startMapId = world.startMapId || 'main_lobby';
  setInventoryData(inventoryData.inventory);
  setMailboxData(mailData);
  renderGame(data);
  await request('/api/v2/world/claim-control', {
    method: 'POST',
    body: JSON.stringify({ clientId: state.worldClientId })
  });
  state.worldControlActive = true;
  startWorldSimulation();
  startMailPolling();
  maybeShowPatchNotes();
}

function patchNotesBody(notes = {}) {
  const lines = Array.isArray(notes.lines) ? notes.lines : [];
  return `<div class="patch-note-sheet">
    <span>${escapeHtml(notes.publishedAt || '')} PATCH</span>
    <h3>${escapeHtml(notes.title || '패치노트')}</h3>
    <ul>
      ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
    </ul>
    <button type="button" data-patch-notes-seen>패치노트 확인</button>
  </div>`;
}

function patchNotesArchiveBody(notesList = []) {
  const notes = Array.isArray(notesList) ? [...notesList].reverse() : [];
  if (!notes.length) {
    return '<div class="empty-ledger"><b>아직 등록된 패치노트가 없습니다.</b><p>다음 패치부터 이곳에 기록됩니다.</p></div>';
  }
  return `<div class="patch-note-archive">
    <p class="notice-line">최근 패치부터 순서대로 표시됩니다. 자동 팝업에서 놓친 내용도 여기서 다시 확인할 수 있습니다.</p>
    ${notes.map((note) => {
      const lines = Array.isArray(note.lines) ? note.lines : [];
      return `<article class="patch-note-sheet is-archive">
        <span>${escapeHtml(note.publishedAt || '')} PATCH / ${escapeHtml(note.version || 'NOTES')}</span>
        <h3>${escapeHtml(note.title || '패치노트')}</h3>
        <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      </article>`;
    }).join('')}
  </div>`;
}

function openPatchNotes(notes = {}) {
  state.pendingPatchNotes = notes;
  $('featureCode').textContent = `PATCH / ${escapeHtml(notes.version || 'NOTES')}`;
  $('featureTitle').textContent = notes.title || '패치노트';
  $('featureBody').innerHTML = patchNotesBody(notes);
  document.querySelector('[data-patch-notes-seen]')?.addEventListener('click', async () => {
    try {
      await request('/api/v2/patch-notes/seen', { method: 'POST' });
    } catch (err) {
      setWorldActivity(err.message);
      return;
    }
    state.pendingPatchNotes = null;
    closeFeature();
  });
  $('featureModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function offlineSummaryKey(summary = {}) {
  const itemKey = (summary.items || [])
    .map((item) => `${item.itemId}:${item.quantity}`)
    .join(',');
  return [
    summary.startedAt || '',
    summary.updatedAt || '',
    Math.floor(Number(summary.elapsedSeconds) || 0),
    Math.floor(Number(summary.kills) || 0),
    Math.floor(Number(summary.exp) || 0),
    Math.floor(Number(summary.money) || 0),
    itemKey
  ].join('|');
}

function offlineSummaryBody(summary = {}) {
  const items = Array.isArray(summary.items) ? summary.items : [];
  const itemRows = items.length
    ? items.map((item) => `
      <li>${escapeHtml(item.icon || '□')} ${escapeHtml(item.name || item.itemId)} ×${formatNumber(item.quantity)}</li>
    `).join('')
    : '<li>획득한 아이템이 없습니다.</li>';
  return `<div class="offline-summary-sheet">
    <span>OFFLINE HUNTING</span>
    <h3>오프라인 사냥 정산</h3>
    <p>자리를 비운 동안 자동사냥이 처리한 결과입니다.</p>
    <div class="offline-summary-grid">
      <strong>사냥 시간</strong><b>${formatDuration(summary.elapsedSeconds)}</b>
      <strong>처치 수</strong><b>${formatNumber(summary.kills)}마리</b>
      <strong>스킬 사용</strong><b>${formatNumber(summary.skillUses)}회</b>
      <strong>경험치</strong><b>+${formatNumber(summary.exp)}</b>
      <strong>돈</strong><b>+${formatNumber(summary.money)}원</b>
    </div>
    <h4>획득 아이템</h4>
    <ul>${itemRows}</ul>
    <button type="button" data-offline-summary-seen>확인</button>
  </div>`;
}

function maybeShowOfflineHuntingSummary(summary) {
  if (!summary) return;
  const elapsedSeconds = Math.floor(Number(summary.elapsedSeconds) || 0);
  const hasResult = elapsedSeconds >= 30
    || Number(summary.kills) > 0
    || Number(summary.skillUses) > 0
    || Number(summary.exp) > 0
    || Number(summary.money) > 0
    || (Array.isArray(summary.items) && summary.items.length > 0);
  if (!hasResult) return;
  const key = offlineSummaryKey(summary);
  if (!key || state.offlineSummaryKey === key) return;
  if (!$('featureModal')?.classList.contains('hidden')) {
    if (state.offlineSummaryRetryTimer) clearTimeout(state.offlineSummaryRetryTimer);
    state.offlineSummaryRetryTimer = setTimeout(() => maybeShowOfflineHuntingSummary(summary), 600);
    return;
  }
  state.offlineSummaryKey = key;
  $('featureCode').textContent = 'AUTO HUNTING / OFFLINE';
  $('featureTitle').textContent = '오프라인 사냥 정산';
  $('featureBody').innerHTML = offlineSummaryBody(summary);
  document.querySelector('[data-offline-summary-seen]')?.addEventListener('click', async () => {
    try {
      const data = await request('/api/v2/hunting-time/offline-summary/seen', { method: 'POST' });
      state.huntingTime = data.huntingTime || { ...state.huntingTime, offlineSummary: null };
      if (state.character?.huntingTime) state.character.huntingTime.offlineSummary = null;
    } catch (err) {
      setWorldActivity(err.message);
      return;
    }
    closeFeature();
  });
  $('featureModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

async function maybeShowPatchNotes() {
  try {
    const data = await request('/api/v2/patch-notes');
    state.patchNotesHistory = data.patchNotesHistory || (data.patchNotes ? [data.patchNotes] : []);
    if (data.patchNotes && !data.seen) {
      if (!$('featureModal')?.classList.contains('hidden')) {
        setTimeout(maybeShowPatchNotes, 700);
        return;
      }
      openPatchNotes(data.patchNotes);
    }
  } catch (err) {
    console.warn('V2 patch note check failed:', err);
  }
}

async function refreshPatchNotes(openAfter = false) {
  try {
    const data = await request('/api/v2/patch-notes');
    state.patchNotesHistory = data.patchNotesHistory || (data.patchNotes ? [data.patchNotes] : []);
    if (openAfter) openFeature('patch-notes');
    else if (!$('featureModal')?.classList.contains('hidden') && $('featureTitle')?.textContent === '패치노트') {
      $('featureBody').innerHTML = patchNotesArchiveBody(state.patchNotesHistory);
    }
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function loadAdminSignupCode() {
  const data = await request('/api/v2/admin/signup-code');
  $('signupCodeStatus').textContent = data.configured
    ? `가입 코드 설정됨 · 마지막 변경 ${data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '-'}`
    : '아직 가입 코드가 설정되지 않았습니다.';
}

async function saveAdminSignupCode(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await request('/api/v2/admin/signup-code', {
      method: 'POST',
      body: JSON.stringify({ signupCode: $('adminSignupCode').value })
    });
    $('adminSignupCode').value = '';
    $('signupCodeStatus').textContent = `가입 코드를 변경했습니다 · ${new Date(data.updatedAt).toLocaleString('ko-KR')}`;
  } catch (err) {
    $('signupCodeStatus').textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function loadAdminGrantItems() {
  const data = await request('/api/v2/admin/grant-items');
  state.adminGrantItems = data.items || [];
  $('adminGiftItem').innerHTML = state.adminGrantItems.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.description)}</option>`
  )).join('');
}

async function sendAdminGift(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  $('adminGiftStatus').textContent = '선물을 우편함으로 보내는 중입니다.';
  try {
    const data = await request('/api/v2/admin/mail/send', {
      method: 'POST',
      body: JSON.stringify({
        target: $('adminGiftTarget').value.trim(),
        allRecipients: $('adminGiftAll').checked,
        itemId: $('adminGiftItem').value,
        quantity: Number($('adminGiftQuantity').value),
        message: $('adminGiftMessage').value.trim()
      })
    });
    $('adminGiftStatus').textContent = data.allRecipients
      ? `전체 V2 유저 ${formatNumber(data.recipientCount)}명에게 ${data.mail.attachments[0].name} ${formatNumber(data.mail.attachments[0].quantity)}개를 보냈습니다.`
      : `${data.recipient}님에게 ${data.mail.attachments[0].name} ${formatNumber(data.mail.attachments[0].quantity)}개를 보냈습니다.`;
    $('adminGiftMessage').value = '';
  } catch (err) {
    $('adminGiftStatus').textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function deleteAdminAccount(event) {
  event.preventDefault();
  const target = $('adminDeleteAccountTarget')?.value?.trim() || '';
  if (!target) return;
  if (!window.confirm(`${target} V2 계정과 캐릭터를 삭제할까요? V1 원본 계정은 유지됩니다.`)) return;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  $('adminDeleteAccountStatus').textContent = 'V2 계정 삭제 처리 중입니다.';
  try {
    const data = await request('/api/v2/admin/account/delete', {
      method: 'POST',
      body: JSON.stringify({ target })
    });
    $('adminDeleteAccountTarget').value = '';
    $('adminDeleteAccountStatus').textContent = `${data.deleted?.displayName || target} 계정을 삭제했습니다.`;
    await loadAdminSummary();
  } catch (err) {
    $('adminDeleteAccountStatus').textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function loadAdminSummary() {
  const data = await request('/api/v2/admin/migration-summary');
  $('adminSummary').innerHTML = [
    `전체 유저 ${formatNumber(data.totalUsers)}명`,
    `V2 계정 ${formatNumber(data.accountCount)}명`,
    `스냅샷 ${formatNumber(data.snapshotCount)}명`,
    `V2 캐릭터 ${formatNumber(data.characterCount)}명`,
    `기존 레벨 ${formatNumber(data.sourceLevelStats.min)}~${formatNumber(data.sourceLevelStats.max)}`,
    `중앙 레벨 ${formatNumber(data.sourceLevelStats.median)}`
  ].map((text) => `<span>${text}</span>`).join('');
}

function storeLoginState() {
  localStorage.setItem('v2Token', state.token);
  localStorage.setItem('v2IsAdmin', String(state.isAdmin));
  localStorage.setItem('v2DisplayName', state.displayName);
}

function clearLoginState() {
  state.token = '';
  state.isAdmin = false;
  state.displayName = '';
  localStorage.removeItem('v2Token');
  localStorage.removeItem('v2IsAdmin');
  localStorage.removeItem('v2DisplayName');
}

async function enterWorkspace() {
  $('loginPanel').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  $('logoutButton').classList.remove('hidden');
  $('adminWorkspace').classList.add('hidden');
  $('userWorkspace').classList.add('hidden');

  if (state.isAdmin) {
    $('adminWorkspace').classList.remove('hidden');
    await Promise.all([loadAdminSummary(), loadAdminSignupCode(), loadAdminGrantItems()]);
  } else {
    $('userWorkspace').classList.remove('hidden');
    await loadUserWorkspace();
  }
}

function updateSignupButtonState() {
  const password = $('signupPassword').value;
  const confirmation = $('signupPasswordConfirm').value;
  const passwordsMatch = password.length >= 6 && password === confirmation;
  $('passwordMatchState').textContent = passwordsMatch
    ? '비밀번호가 일치합니다.'
    : (confirmation ? '비밀번호가 일치하지 않습니다.' : '비밀번호 확인을 입력해주세요.');
  $('passwordMatchState').classList.toggle('is-valid', passwordsMatch);
  $('signupCodeState').classList.toggle('is-valid', state.signupCodeValid);

  const fieldsValid = /^[A-Za-z0-9_]{3,24}$/.test($('signupUsername').value.trim())
    && $('signupNickname').value.trim().length >= 2
    && $('signupNickname').value.trim().length <= 12;
  $('signupSubmitButton').disabled = !(fieldsValid && passwordsMatch && state.signupCodeValid);
}

async function validateSignupCode() {
  const code = $('signupCode').value.trim();
  const requestId = ++state.signupValidationRequest;
  state.signupCodeValid = false;
  updateSignupButtonState();
  if (!code || !state.signupCodeConfigured) return;
  $('signupCodeState').textContent = '가입 코드를 확인하는 중입니다.';
  try {
    const data = await request('/api/v2/signup/validate-code', {
      method: 'POST',
      body: JSON.stringify({ signupCode: code })
    });
    if (requestId !== state.signupValidationRequest || code !== $('signupCode').value.trim()) return;
    state.signupCodeValid = Boolean(data.valid);
    $('signupCodeState').textContent = data.valid
      ? '사용 가능한 가입 코드입니다.'
      : '가입 코드가 올바르지 않습니다.';
  } catch (err) {
    if (requestId !== state.signupValidationRequest) return;
    $('signupCodeState').textContent = err.message;
  }
  updateSignupButtonState();
}

async function openSignup() {
  $('signupForm').reset();
  state.signupCodeValid = false;
  state.signupValidationRequest += 1;
  $('signupStatus').textContent = '';
  $('passwordMatchState').textContent = '비밀번호를 입력해주세요.';
  $('signupCodeState').textContent = '가입 코드를 확인해야 합니다.';
  $('signupModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  updateSignupButtonState();
  try {
    const config = await request('/api/v2/signup/config');
    state.signupCodeConfigured = Boolean(config.codeConfigured);
    if (!state.signupCodeConfigured) {
      $('signupCodeState').textContent = '운영자가 아직 가입 코드를 설정하지 않았습니다.';
    }
  } catch (err) {
    $('signupCodeState').textContent = err.message;
  }
  $('signupUsername').focus();
}

function closeSignup() {
  $('signupModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (state.signupCodeTimer) clearTimeout(state.signupCodeTimer);
}

async function signup(event) {
  event.preventDefault();
  if ($('signupSubmitButton').disabled) return;
  const button = $('signupSubmitButton');
  button.disabled = true;
  $('signupStatus').textContent = '신규 사원 정보를 등록하는 중입니다.';
  try {
    const data = await request('/api/v2/signup', {
      method: 'POST',
      body: JSON.stringify({
        username: $('signupUsername').value.trim(),
        nickname: $('signupNickname').value.trim(),
        password: $('signupPassword').value,
        passwordConfirm: $('signupPasswordConfirm').value,
        signupCode: $('signupCode').value.trim()
      })
    });
    const username = $('signupUsername').value.trim();
    closeSignup();
    $('username').value = username;
    $('password').value = '';
    $('loginStatus').textContent = data.message;
    $('password').focus();
  } catch (err) {
    $('signupStatus').textContent = err.message;
    updateSignupButtonState();
  }
}

async function login(event) {
  event.preventDefault();
  $('loginStatus').textContent = '계정을 확인하고 자동 이관 상태를 점검하는 중입니다.';
  try {
    const data = await request('/api/v2/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('username').value.trim(),
        password: $('password').value
      })
    });
    state.token = data.token;
    state.isAdmin = Boolean(data.isAdmin);
    state.displayName = data.displayName || '';
    storeLoginState();
    await enterWorkspace();
  } catch (err) {
    $('loginStatus').textContent = err.message;
  }
}

async function restoreLogin() {
  if (!state.token) return;
  $('loginStatus').textContent = '저장된 사원증으로 접속하는 중입니다.';
  try {
    await enterWorkspace();
  } catch (err) {
    clearLoginState();
    state.moveRunId += 1;
    state.combatRunId += 1;
    $('workspace').classList.add('hidden');
    $('userWorkspace').classList.add('hidden');
    $('adminWorkspace').classList.add('hidden');
    $('logoutButton').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
    $('loginStatus').textContent = '로그인 유효기간이 끝났습니다. 다시 로그인해주세요.';
  }
}

async function snapshotAllUsers() {
  const button = $('snapshotAllButton');
  button.disabled = true;
  let afterId = '';
  let processed = 0;
  try {
    do {
      const data = await request('/api/v2/admin/snapshot-batch', {
        method: 'POST',
        body: JSON.stringify({ afterId, limit: 50 })
      });
      processed += data.processed;
      afterId = data.nextAfterId;
      $('adminStatus').textContent = `${formatNumber(processed)}명 재검사 완료`;
      if (data.complete) break;
    } while (afterId);
    $('adminStatus').textContent = `전체 ${formatNumber(processed)}명의 V2 이관 상태를 확인했습니다.`;
    await loadAdminSummary();
  } catch (err) {
    $('adminStatus').textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const CHARACTER_MOVEMENT_TIME_SCALE = 3;
const CHARACTER_BASE_MOVEMENT_PX_PER_SECOND = 115 / CHARACTER_MOVEMENT_TIME_SCALE;
const RALLY_POINT_STORAGE_KEY = 'v2RallyPoint';
const CHARACTER_MOTION_CLASSES = [
  'is-walking',
  'is-jump',
  'is-climb',
  'is-hit',
  'is-slash',
  'is-one-hand-swing',
  'is-two-hand-swing',
  'is-axe-swing',
  'is-blunt-swing',
  'is-spear-thrust',
  'is-polearm-thrust',
  'is-shoot',
  'is-throw',
  'is-staff-swing',
  'is-buff',
  'is-cast',
  'is-dead'
];
const PORTAL_POSITIONS = [
  { left: '4%', side: 'left', characterX: 8 },
  { left: '82%', side: 'right', characterX: 78 },
  { left: '61%', side: 'upper', characterX: 61 },
  { left: '32%', side: 'left', characterX: 34 }
];

function getMap(mapId) {
  return state.maps.find((map) => map.id === mapId) || null;
}

function getCharacterLevel() {
  return Math.max(1, Number(state.character?.progression?.level) || 1);
}

function getCombatPresentation() {
  return state.character?.combatPresentation || {
    motion: 'slash',
    label: '연습용 베기',
    source: 'trainee-preview'
  };
}

function setWorldActivity(message) {
  $('worldActivity').textContent = message;
}

function getCharacterFloor() {
  return (Number.parseFloat($('fieldCharacter').style.bottom) || 42) > 60 ? 1 : 0;
}

function getCharacterX() {
  const character = $('fieldCharacter');
  const stage = $('worldStage');
  const renderedLeftPx = Number.parseFloat(getComputedStyle(character).left);
  const renderedPercent = stage.clientWidth > 0 && Number.isFinite(renderedLeftPx)
    ? renderedLeftPx / stage.clientWidth * 100
    : Number.parseFloat(character.style.left);
  return Math.max(0, Math.min(94, Number(renderedPercent) || 0));
}

function getPortalFloor(portal) {
  return portal?.side === 'upper' ? 1 : 0;
}

function isCharacterTouchingPortal(portal) {
  if (!portal) return false;
  return getCharacterFloor() === getPortalFloor(portal)
    && Math.abs(getCharacterX() - Number(portal.characterX)) <= 1.6;
}

function loadStoredRallyPoint() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RALLY_POINT_STORAGE_KEY) || 'null');
    if (
      parsed
      && typeof parsed.mapId === 'string'
      && Number.isFinite(Number(parsed.x))
      && [0, 1].includes(Number(parsed.floor))
    ) {
      return {
        mapId: parsed.mapId,
        x: Math.max(2, Math.min(92, Number(parsed.x))),
        floor: Number(parsed.floor)
      };
    }
  } catch (_) {}
  return null;
}

function renderRallyPoint() {
  const marker = $('rallyPoint');
  const point = state.rallyPoint;
  if (!marker) return;
  const visible = Boolean(point && point.mapId === state.currentMapId);
  marker.classList.toggle('hidden', !visible);
  if (!visible) return;
  marker.style.left = `${point.x}%`;
  marker.style.bottom = point.floor === 1
    ? `${getUpperPlatformBottom()}px`
    : '42px';
}

function setRallyPoint(point) {
  state.rallyPoint = point;
  localStorage.setItem(RALLY_POINT_STORAGE_KEY, JSON.stringify(point));
  renderRallyPoint();
}

function clearRallyPoint(removeStored = true) {
  state.rallyPoint = null;
  if (removeStored) localStorage.removeItem(RALLY_POINT_STORAGE_KEY);
  renderRallyPoint();
}

function getNearestWalkablePoint(clientX, clientY) {
  const stage = $('worldStage');
  const stageRect = stage.getBoundingClientRect();
  const clickX = Math.max(0, Math.min(stageRect.width, clientX - stageRect.left));
  const clickY = Math.max(0, Math.min(stageRect.height, clientY - stageRect.top));
  const candidates = [{
    xPx: Math.max(stageRect.width * .02, Math.min(stageRect.width * .92, clickX)),
    yPx: stageRect.height - 42,
    floor: 0
  }];
  const ladder = $('worldRope');
  const upper = stage.querySelector('.platform-upper');
  if (upper && ladder && !ladder.classList.contains('hidden')) {
    const upperRect = upper.getBoundingClientRect();
    const upperLeft = upperRect.left - stageRect.left;
    const upperRight = upperRect.right - stageRect.left;
    candidates.push({
      xPx: Math.max(upperLeft, Math.min(upperRight, clickX)),
      yPx: upperRect.top - stageRect.top,
      floor: 1
    });
  }
  const selected = candidates.sort((left, right) => (
    Math.hypot(left.xPx - clickX, left.yPx - clickY)
      - Math.hypot(right.xPx - clickX, right.yPx - clickY)
  ))[0];
  return {
    mapId: state.currentMapId,
    x: Math.max(2, Math.min(92, selected.xPx / stageRect.width * 100)),
    floor: selected.floor
  };
}

function isAtRallyPoint(point = state.rallyPoint) {
  return Boolean(
    point
    && point.mapId === state.currentMapId
    && point.floor === getCharacterFloor()
    && Math.abs(point.x - getCharacterX()) <= 1.5
  );
}

function getCurrentCharacterMotion() {
  const character = $('fieldCharacter');
  return CHARACTER_MOTION_CLASSES.find((name) => character.classList.contains(name)) || '';
}

function getWorldActivityType() {
  if (state.dead) return 'dead';
  if (state.moving) return 'moving';
  if (state.autoCombat) return 'combat';
  return 'idle';
}

function setCharacterMotion(motion) {
  const character = $('fieldCharacter');
  CHARACTER_MOTION_CLASSES.forEach((className) => character.classList.remove(className));
  if (motion) character.classList.add(`is-${motion}`);
}

function getMovementSpeedPercent() {
  return Math.max(10, Number(state.character?.derivedStats?.movementSpeed) || 100);
}

function getScaledMovementDuration(baseDuration) {
  return Math.max(
    1,
    Math.round(Number(baseDuration || 0) * CHARACTER_MOVEMENT_TIME_SCALE * 100 / getMovementSpeedPercent())
  );
}

function showFloatingDamage(targetElement, amount, kind = 'outgoing') {
  const stage = $('worldStage');
  if (!stage || !targetElement || !targetElement.isConnected) return;
  const label = typeof amount === 'string' ? amount : '';
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value && !label) return;

  const stageRect = stage.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const element = document.createElement('span');
  element.className = `floating-damage is-${kind}`;
  element.textContent = label || formatNumber(value);
  element.style.left = `${targetRect.left - stageRect.left + targetRect.width / 2}px`;
  element.style.top = `${Math.max(18, targetRect.top - stageRect.top + 4)}px`;
  stage.appendChild(element);
  element.addEventListener('animationend', () => element.remove(), { once: true });
  setTimeout(() => element.remove(), 650);
}

function showSkillUseLabel(targetElement, skillName) {
  const stage = $('worldStage');
  if (!stage || !targetElement || !targetElement.isConnected || !skillName) return;
  const stageRect = stage.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const element = document.createElement('span');
  element.className = 'skill-use-label';
  element.textContent = skillName;
  element.style.left = `${targetRect.left - stageRect.left + targetRect.width / 2}px`;
  element.style.top = `${Math.max(10, targetRect.top - stageRect.top - 18)}px`;
  stage.appendChild(element);
  element.addEventListener('animationend', () => element.remove(), { once: true });
  setTimeout(() => element.remove(), 1_700);
}

function classifySkillVisual(skill = {}) {
  const id = String(skill.id || '').toLowerCase();
  const effect = String(skill.effect || '').toLowerCase();
  const element = String(skill.element || '').toLowerCase();
  const target = String(skill.target || '').toLowerCase();
  const text = `${id} ${effect} ${element} ${target} ${skill.name || ''} ${skill.description || ''}`.toLowerCase();
  if (effect.includes('heal') || id.includes('heal') || text.includes('복지 지원')) return 'heal';
  if (effect.includes('summon') || id.includes('companion') || id.includes('mascot')) return 'summon';
  if (effect.includes('teleport') || id.includes('teleport') || text.includes('텔레포트')) return 'teleport';
  if (effect.includes('element') || ['fire', 'ice', 'lightning', 'holy'].includes(element)) {
    return `element-${element || 'neutral'}`;
  }
  if (target === 'party' || target === 'self' || effect.includes('buff') || text.includes('동안')) return 'buff';
  if (target === 'enemies' || text.includes('전체') || text.includes('범위') || text.includes('광역')) return 'area';
  if (target === 'enemy' || effect.includes('damage')) return 'strike';
  return 'pulse';
}

function getSkillEffectAnchor(combat = {}) {
  const firstOutcome = (combat.outcomes || []).find((outcome) => outcome?.monsterId);
  const monsterId = firstOutcome?.monsterId || state.combatTargetId;
  if (monsterId) {
    const target = Array.from($('monsterLayer')?.children || []).find(
      (element) => element.dataset.monsterId === String(monsterId)
    );
    if (target) return target;
  }
  return $('fieldCharacter');
}

function playSkillVisualEffect(skill = {}, combat = {}) {
  const stage = $('worldStage');
  const caster = $('fieldCharacter');
  if (!stage || !caster || !skill) return;
  const kind = classifySkillVisual(skill);
  const anchor = ['heal', 'buff', 'summon', 'teleport'].includes(kind)
    ? caster
    : getSkillEffectAnchor(combat);
  if (!anchor || !anchor.isConnected) return;

  const stageRect = stage.getBoundingClientRect();
  const casterRect = caster.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const duration = Math.max(180, Math.round(820 / getAttackSpeedMultiplier()));
  const effect = document.createElement('span');
  effect.className = `skill-visual-effect is-${kind}`;
  effect.style.setProperty('--skill-effect-duration', `${duration}ms`);
  effect.style.left = `${anchorRect.left - stageRect.left + anchorRect.width / 2}px`;
  effect.style.top = `${anchorRect.top - stageRect.top + anchorRect.height / 2}px`;

  if (kind === 'heal') {
    const healDiameter = Math.min(stageRect.width * 1.08, stageRect.width * (800 / 760));
    effect.style.setProperty('--skill-effect-size', `${Math.max(180, healDiameter)}px`);
  } else if (kind === 'area') {
    const areaSize = Math.min(stageRect.width * .82, 460);
    effect.style.setProperty('--skill-effect-size', `${Math.max(180, areaSize)}px`);
  } else if (kind === 'strike' || kind === 'pulse') {
    effect.style.setProperty('--skill-effect-size', `${Math.max(70, anchorRect.width * 1.8)}px`);
  }

  if (kind === 'strike' || kind === 'pulse' || kind.startsWith('element-')) {
    const casterX = casterRect.left - stageRect.left + casterRect.width / 2;
    const casterY = casterRect.top - stageRect.top + casterRect.height / 2;
    const targetX = anchorRect.left - stageRect.left + anchorRect.width / 2;
    const targetY = anchorRect.top - stageRect.top + anchorRect.height / 2;
    effect.style.setProperty('--skill-travel-x', `${targetX - casterX}px`);
    effect.style.setProperty('--skill-travel-y', `${targetY - casterY}px`);
  }

  stage.appendChild(effect);
  effect.addEventListener('animationend', () => effect.remove(), { once: true });
  setTimeout(() => effect.remove(), duration + 420);
}

function getLootBottom(floor) {
  return Number(floor) === 1 ? `${getUpperPlatformBottom() + 3}px` : '44px';
}

function showGroundLoot(drops = []) {
  const layer = $('lootLayer');
  if (!layer) return;
  layer.querySelectorAll('[data-loot-id="undefined"], [data-loot-id=""]').forEach(
    (element) => element.remove()
  );
  drops.filter((drop) => (
    drop.stored !== false
    && drop.grounded !== false
    && drop.id
    && Number.isFinite(Number(drop.x))
  )).forEach((drop) => {
    if (layer.querySelector(`[data-loot-id="${CSS.escape(String(drop.id))}"]`)) return;
    const element = document.createElement('div');
    element.className = `field-loot is-${drop.kind}`;
    element.dataset.lootId = String(drop.id);
    element.style.left = `${drop.x}%`;
    element.style.bottom = getLootBottom(drop.floor);
    element.innerHTML = `<span>${escapeHtml(drop.icon || '📦')}</span><small>${escapeHtml(drop.name || '')}</small>`;
    layer.appendChild(element);
  });
}

function collectGroundLoot(collections = []) {
  const layer = $('lootLayer');
  const character = $('fieldCharacter');
  if (!layer || !character) return;
  layer.querySelectorAll('[data-loot-id="undefined"], [data-loot-id=""]').forEach(
    (element) => element.remove()
  );
  const stageRect = $('worldStage').getBoundingClientRect();
  const characterRect = character.getBoundingClientRect();
  const destinationX = characterRect.left - stageRect.left + characterRect.width / 2;
  const destinationY = stageRect.bottom - characterRect.top;
  collections.forEach((loot) => {
    let element = layer.querySelector(`[data-loot-id="${CSS.escape(String(loot.id))}"]`);
    if (!element) {
      element = document.createElement('div');
      element.className = `field-loot is-${loot.kind}`;
      element.dataset.lootId = String(loot.id);
      element.style.left = `${Math.max(5, Math.min(88, Number(loot.x) || 8))}%`;
      element.style.bottom = getLootBottom(loot.floor);
      element.innerHTML = `<span>${escapeHtml(loot.icon || '📦')}</span>`;
      layer.appendChild(element);
    }
    element.style.setProperty('--loot-target-x', `${destinationX - element.offsetLeft}px`);
    element.style.setProperty('--loot-target-y', `${-(destinationY - element.offsetHeight)}px`);
    element.classList.add('is-collecting');
    setTimeout(() => element.remove(), 520);
  });
  if (collections.length) {
    const money = collections
      .filter((loot) => loot.kind === 'money')
      .reduce((sum, loot) => sum + Number(loot.amount || 0), 0);
    const itemCount = collections
      .filter((loot) => loot.kind === 'item')
      .reduce((sum, loot) => sum + Number(loot.quantity || 0), 0);
    setWorldActivity(`자동 수거 · ${money ? `${formatNumber(money)}원` : ''}${money && itemCount ? ' · ' : ''}${itemCount ? `잡템 ${formatNumber(itemCount)}개` : ''}`);
  }
}

function updateFieldControls() {
  const button = $('autoCombatButton');
  const safeZone = Boolean(getMap(state.currentMapId)?.safeZone);
  button.textContent = state.autoCombat ? '자동 전투 ON' : '자동 전투 OFF';
  button.setAttribute('aria-pressed', String(state.autoCombat));
  button.classList.toggle('is-on', state.autoCombat);
  button.title = safeZone ? '안전지대에서는 자동전투를 사용할 수 없습니다.' : '';
  $('moveMapButton').disabled = state.moving || state.dead;
  button.disabled = state.dead || safeZone;
  $('hpPotionButton').disabled = state.dead;
  $('mpPotionButton').disabled = state.dead;
  $('potionConfigButton').disabled = state.dead;
  document.querySelectorAll('.desk-action, #questButton, #mailButton, #eventButton').forEach((control) => {
    control.disabled = state.dead;
  });
  $('combatMotionLabel').textContent = `전투 모션 · ${getCombatPresentation().label}`;
}

function renderPortals(map) {
  $('portalLayer').innerHTML = map.connections.slice(0, 4).map((connection, index) => {
    const target = getMap(connection.targetId);
    const position = PORTAL_POSITIONS[index] || PORTAL_POSITIONS[1];
    return `<div class="world-portal portal-${position.side}" style="left:${position.left}">
      <i></i><span>PORTAL</span><small>${escapeHtml(target?.name || connection.targetId)}</small>
    </div>`;
  }).join('');
}

function renderPartyPortals(portals = []) {
  const layer = $('portalLayer');
  if (!layer) return;
  layer.querySelectorAll('.party-return-portal').forEach((portal) => portal.remove());
  portals.forEach((portal) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'world-portal party-return-portal';
    button.dataset.partyPortalId = portal.id;
    button.style.left = `${Math.max(3, Math.min(88, Number(portal.x) || 8))}%`;
    button.style.bottom = Number(portal.floor) === 1 ? '176px' : '44px';
    button.innerHTML = `<i></i><span>PARTY</span><small>${escapeHtml(portal.label)}</small>`;
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      try {
        const data = await request('/api/v2/world/party-portal/use', {
          method: 'POST',
          body: JSON.stringify({
            clientId: state.worldClientId,
            portalId: portal.id,
            mapId: state.currentMapId
          })
        });
        state.worldStateEpoch += 1;
        state.moveRunId += 1;
        state.combatRunId += 1;
        state.autoCombat = false;
        renderWorldMap(data.destination.mapId, 0);
        const character = $('fieldCharacter');
        character.style.left = `${data.destination.x}%`;
        character.style.bottom = data.destination.floor === 1 ? `${getUpperPlatformBottom()}px` : '42px';
        setWorldActivity(`${data.map.name}(으)로 포탈 이동했습니다.`);
      } catch (err) {
        setWorldActivity(err.message);
      }
    });
    layer.appendChild(button);
  });
}

function renderWorldMap(mapId, arrivalPortalIndex = 0) {
  const map = getMap(mapId) || getMap(state.startMapId) || state.maps[0];
  if (!map) return;
  state.currentMapId = map.id;
  localStorage.setItem('v2CurrentMapId', map.id);
  if (map.safeZone && (state.autoCombat || state.huntingTime.enabled)) {
    state.autoCombat = false;
    state.huntingTime.enabled = false;
    state.combatRunId += 1;
    localStorage.setItem('v2AutoCombat', 'false');
    if (state.token && !state.isAdmin) {
      request('/api/v2/hunting-time/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: false })
      }).then((data) => {
        state.huntingTime = data.huntingTime;
        renderHuntingTime();
      }).catch((err) => console.error('V2 safe-zone auto combat stop error:', err));
    }
  }

  $('mapRegion').textContent = `MAP / ${map.region}`;
  $('mapName').textContent = map.name;
  $('mapLevelRange').textContent = map.safeZone ? 'SAFE ZONE' : 'FIELD';
  $('currentLocation').textContent = map.name;
  $('worldStage').dataset.theme = map.theme;
  $('shopNpc')?.classList.toggle('hidden', !map.safeZone || !map.shopId);
  $('scrollShopNpc')?.classList.toggle('hidden', !map.safeZone || !map.scrollShopId);
  const needsUpperRoute = map.connections.length > 2;
  $('worldRope').classList.toggle('is-ladder', map.features.includes('ladder') || needsUpperRoute);
  $('worldRope').classList.toggle(
    'hidden',
    !needsUpperRoute && !map.features.some((feature) => feature === 'rope' || feature === 'ladder')
  );
  renderPortals(map);
  renderRallyPoint();
  $('lootLayer').replaceChildren();

  const character = $('fieldCharacter');
  const arrival = PORTAL_POSITIONS[arrivalPortalIndex] || PORTAL_POSITIONS[0];
  character.style.transitionDuration = '0ms';
  character.style.left = `${arrival.characterX}%`;
  character.style.bottom = arrival.side === 'upper' ? `${getUpperPlatformBottom()}px` : '42px';
  character.classList.toggle('facing-left', arrival.characterX > 50);
  setCharacterMotion(null);
  character.classList.toggle('is-dead', state.dead);
  void character.offsetWidth;
  character.style.transitionDuration = '';
  setWorldActivity(map.safeZone ? '안전지대에서는 자동전투를 사용할 수 없습니다.' : (state.autoCombat ? '자동 전투 준비 중' : '명령 대기 중'));
  updateFieldControls();
}

function isRunActive(kind, runId) {
  if (state.dead) return false;
  return kind === 'move'
    ? runId === state.moveRunId
    : runId === state.combatRunId && state.autoCombat && !state.moving;
}

async function moveCharacter(left, duration, runId) {
  if (!isRunActive('move', runId)) return false;
  const character = $('fieldCharacter');
  const resolvedDuration = getScaledMovementDuration(duration);
  state.activeMoveDeadlineAt = Date.now() + resolvedDuration * 2 + 1_000;
  state.activeMoveTargetX = left;
  setWorldActivity('목적지로 걷는 중');
  setCharacterMotion('walking');
  while (isRunActive('move', runId) && Date.now() < state.activeMoveDeadlineAt) {
    if (Math.abs(left - getCharacterX()) <= 0.35) break;
    const remainingDuration = getScaledMovementDuration(getFieldMoveDuration(left));
    character.style.transitionDuration = `${remainingDuration}ms`;
    character.style.left = `${left}%`;
    await sleep(Math.min(160, remainingDuration));
  }
  if (isRunActive('move', runId) && Math.abs(left - getCharacterX()) <= 1.1) {
    character.style.transitionDuration = '0ms';
    character.style.left = `${left}%`;
  }
  if (state.activeMoveTargetX === left) {
    state.activeMoveTargetX = null;
    state.activeMoveDeadlineAt = 0;
  }
  setCharacterMotion(null);
  return isRunActive('move', runId);
}

function getFieldMoveDuration(targetX) {
  const stage = $('worldStage');
  const distance = Math.abs(targetX - getCharacterX()) / 100 * stage.clientWidth;
  return Math.max(
    220,
    Math.min(
      7200,
      distance / (CHARACTER_BASE_MOVEMENT_PX_PER_SECOND * getMovementSpeedPercent() / 100) * 1000
    )
  );
}

function getLadderCharacterX() {
  const stage = $('worldStage');
  const ladder = $('worldRope');
  const character = $('fieldCharacter');
  if (!stage.clientWidth) return 55;
  return ((ladder.offsetLeft + (ladder.offsetWidth / 2) - (character.offsetWidth / 2)) / stage.clientWidth) * 100;
}

function getUpperPlatformBottom() {
  const stage = $('worldStage');
  const platform = stage.querySelector('.platform-upper');
  if (!platform) return 176;
  return Math.max(42, stage.clientHeight - platform.offsetTop);
}

async function climbToUpperPlatform(runId) {
  if (!isRunActive('move', runId)) return false;
  const character = $('fieldCharacter');
  const duration = getScaledMovementDuration(1100);
  character.classList.remove('facing-left');
  setWorldActivity('사다리를 타고 위층으로 이동 중');
  setCharacterMotion('climb');
  character.style.transitionDuration = `${duration}ms`;
  character.style.bottom = `${getUpperPlatformBottom()}px`;
  await sleep(duration + 20);
  setCharacterMotion(null);
  return isRunActive('move', runId);
}

async function climbToLowerPlatform(runId) {
  if (!isRunActive('move', runId)) return false;
  const character = $('fieldCharacter');
  const duration = getScaledMovementDuration(1100);
  character.classList.remove('facing-left');
  setWorldActivity('사다리를 타고 아래층으로 이동 중');
  setCharacterMotion('climb');
  character.style.transitionDuration = `${duration}ms`;
  character.style.bottom = '42px';
  await sleep(duration + 20);
  setCharacterMotion(null);
  return isRunActive('move', runId);
}

async function walkToFieldPoint(point, runId) {
  if (!isRunActive('move', runId)) return false;
  const character = $('fieldCharacter');
  if (getCharacterFloor() !== point.floor) {
    const ladderX = getLadderCharacterX();
    character.classList.toggle('facing-left', ladderX < getCharacterX());
    if (!await moveCharacter(ladderX, getFieldMoveDuration(ladderX), runId)) return false;
    if (point.floor === 1) {
      if (!await climbToUpperPlatform(runId)) return false;
    } else if (!await climbToLowerPlatform(runId)) return false;
  }
  character.classList.toggle('facing-left', point.x < getCharacterX());
  return moveCharacter(point.x, getFieldMoveDuration(point.x), runId);
}

async function commandFieldPoint(point, returning = false) {
  if (!point || state.dead || point.mapId !== state.currentMapId) return;
  state.moving = true;
  state.combatTargetId = '';
  state.combatRunId += 1;
  const runId = ++state.moveRunId;
  updateFieldControls();
  if (!await walkToFieldPoint(point, runId)) return;
  if (runId !== state.moveRunId) return;
  state.moving = false;
  setCharacterMotion(null);
  updateFieldControls();
  setWorldActivity(returning ? '기준점 복귀 · 몬스터 대기 중' : '이동 기준점 도착');
  if (state.autoCombat) startAutoCombat();
}

function handleWorldStagePoint(event) {
  if (
    event.button !== 0
    || state.dead
    || event.target.closest('.field-shop-npc, .combat-buff-tray, .rally-point')
  ) return;
  const point = getNearestWalkablePoint(event.clientX, event.clientY);
  setRallyPoint(point);
  commandFieldPoint(point).catch((err) => {
    console.error('V2 field point movement error:', err);
    setWorldActivity('이동 기준점을 다시 선택해주세요.');
  });
}

function getCombatTarget() {
  const characterX = getCharacterX();
  const floor = getCharacterFloor();
  const candidates = state.worldMonsters.filter((monster) => monster.floor === floor && monster.hp > 0);
  if (!candidates.length) return null;
  const selected = candidates.sort(
    (a, b) => Math.abs(a.x - characterX) - Math.abs(b.x - characterX)
  )[0];
  state.combatTargetId = selected.id;
  return selected;
}

function getCombatTargetElement() {
  return Array.from($('monsterLayer').children).find(
    (element) => element.dataset.monsterId === state.combatTargetId
  ) || null;
}

async function playWorldMotion(motion, kind, runId, activityLabel = '') {
  if (!isRunActive(kind, runId)) return;
  const character = $('fieldCharacter');
  const monster = getCombatTargetElement();
  const projectile = $('attackProjectile');
  setCharacterMotion(motion);

  const labels = {
    slash: '근접 공격 · 베기',
    'one-hand-swing': '근접 공격 · 한손검 휘두르기',
    'two-hand-swing': '근접 공격 · 두손검 휘두르기',
    'axe-swing': '근접 공격 · 도끼 휘두르기',
    'blunt-swing': '근접 공격 · 둔기 휘두르기',
    'spear-thrust': '근접 공격 · 창 찌르기',
    'polearm-thrust': '근접 공격 · 폴암 찌르기',
    shoot: '원거리 공격 · 쏘기',
    throw: '원거리 공격 · 날리기',
    'staff-swing': '마법 공격 · 완드/스태프 휘두르기',
    buff: '버프 시전',
    hit: '몬스터의 공격에 피격',
    jump: '장애물 점프',
    climb: '밧줄·사다리 이동'
  };
  setWorldActivity(activityLabel || labels[motion] || '행동 중');

  const weaponAttackMotions = [
    'slash', 'one-hand-swing', 'two-hand-swing', 'axe-swing', 'blunt-swing',
    'spear-thrust', 'polearm-thrust', 'shoot', 'throw', 'staff-swing'
  ];
  if (monster && weaponAttackMotions.includes(motion)) {
    monster.classList.add('is-hit');
  }
  if (motion === 'shoot' || motion === 'throw') {
    const stage = $('worldStage');
    const stageRect = stage.getBoundingClientRect();
    const characterRect = character.getBoundingClientRect();
    const monsterRect = monster?.getBoundingClientRect();
    const startX = characterRect.left + characterRect.width * .55 - stageRect.left;
    const startY = characterRect.top + characterRect.height * .42 - stageRect.top;
    const targetX = monsterRect
      ? monsterRect.left + monsterRect.width * .5 - stageRect.left
      : startX + (character.classList.contains('facing-left') ? -260 : 260);
    // Aim at the lower torso so short ASCII monsters share a generous visual hit line.
    const targetY = monsterRect
      ? monsterRect.top + monsterRect.height * .72 - stageRect.top
      : startY;
    projectile.style.left = `${startX}px`;
    projectile.style.top = `${startY}px`;
    projectile.style.bottom = 'auto';
    projectile.style.setProperty('--projectile-x', `${targetX - startX}px`);
    projectile.style.setProperty('--projectile-y', `${targetY - startY}px`);
    projectile.className = `attack-projectile is-${motion}`;
  }
  if (motion === 'hit') character.classList.add('damage-flash');

  const isWeaponAttack = weaponAttackMotions.includes(motion);
  const motionDuration = motion === 'buff'
    ? 300
    : Math.max(180, Math.round(720 / (isWeaponAttack ? getAttackSpeedMultiplier() : 1)));
  character.style.setProperty('--combat-motion-duration', `${motionDuration}ms`);
  await sleep(motionDuration);
  monster?.classList.remove('is-hit');
  projectile.className = 'attack-projectile';
  character.classList.remove('damage-flash');
  setCharacterMotion(null);
}

function canEnterMap(target) {
  return Boolean(target);
}

function movementSelectionBody() {
  const map = getMap(state.currentMapId);
  if (!map) return '<div class="empty-ledger"><b>현재 맵 정보를 찾을 수 없습니다.</b></div>';
  const destinations = map.connections.map((connection, index) => {
    const target = getMap(connection.targetId);
    const accessible = canEnterMap(target);
    return `<button class="move-destination" type="button" data-target-map="${escapeHtml(connection.targetId)}" ${accessible ? '' : 'disabled'}>
      <b>${String(index + 1).padStart(2, '0')}</b>
      <span><strong>${escapeHtml(target?.name || connection.targetId)}</strong><small>${escapeHtml(connection.portalName)}</small></span>
      <i>${accessible ? '이동' : '레벨 부족'}</i>
    </button>`;
  }).join('');
  return `<div class="movement-sheet">
    <p>현재 위치 <b>${escapeHtml(map.name)}</b>에서 연결된 포탈입니다. 목적지를 선택하면 캐릭터가 직접 포탈까지 이동합니다.</p>
    <div class="movement-list">${destinations}</div>
  </div>`;
}

async function ensureCharacterTouchesPortal(portal, runId) {
  if (isCharacterTouchingPortal(portal)) return true;
  const point = {
    mapId: state.currentMapId,
    x: Number(portal.characterX),
    floor: getPortalFloor(portal)
  };
  if (!await walkToFieldPoint(point, runId)) return false;
  await sleep(80);
  return isCharacterTouchingPortal(portal);
}

function finishMoveCommand(runId, message = '') {
  if (runId !== state.moveRunId) return;
  state.moving = false;
  state.activeMoveTargetX = null;
  state.activeMoveDeadlineAt = 0;
  setCharacterMotion(null);
  if (message) setWorldActivity(message);
  updateFieldControls();
}

async function enterWorldPortal(connection, runId) {
  if (!connection || !isRunActive('move', runId)) return false;
  const sourceMapId = state.currentMapId;
  const target = getMap(connection.targetId);
  const arrivalPortalIndex = Math.max(0, target?.connections.slice(0, 4).findIndex(
    (entry) => entry.targetId === sourceMapId
  ) ?? 0);
  setWorldActivity(`${connection.portalName} 진입 · ${target?.name || connection.targetId} 이동 중`);
  $('worldStage').classList.add('changing-map');
  await sleep(520);
  if (!isRunActive('move', runId)) return false;
  renderWorldMap(connection.targetId, arrivalPortalIndex);
  $('worldStage').classList.remove('changing-map');
  await sleep(500);
  return true;
}

function findMapTravelRoute(startMapId, targetMapId) {
  if (startMapId === targetMapId) return [startMapId];
  const visibleMaps = (state.maps || []).filter((map) => !map.hidden);
  const visibleIds = new Set(visibleMaps.map((map) => map.id));
  if (!visibleIds.has(startMapId) || !visibleIds.has(targetMapId)) return [];
  const queue = [startMapId];
  const previous = new Map([[startMapId, null]]);
  while (queue.length) {
    const mapId = queue.shift();
    const map = getMap(mapId);
    for (const connection of map?.connections || []) {
      if (!visibleIds.has(connection.targetId) || previous.has(connection.targetId)) continue;
      previous.set(connection.targetId, mapId);
      if (connection.targetId === targetMapId) {
        const route = [targetMapId];
        let cursor = mapId;
        while (cursor) {
          route.unshift(cursor);
          cursor = previous.get(cursor);
        }
        return route;
      }
      queue.push(connection.targetId);
    }
  }
  return [];
}

async function performMapMoveStep(targetMapId, runId) {
  const map = getMap(state.currentMapId);
  const connection = map?.connections.find((entry) => entry.targetId === targetMapId);
  const target = getMap(targetMapId);
  if (!connection || !canEnterMap(target) || !isRunActive('move', runId)) return false;

  const portalIndex = Math.max(0, map.connections.slice(0, 4).findIndex(
    (entry) => entry.targetId === targetMapId
  ));
  const portal = PORTAL_POSITIONS[portalIndex] || PORTAL_POSITIONS[1];
  const character = $('fieldCharacter');

  if (map.features.includes('hazard')) {
    await playWorldMotion('jump', 'move', runId);
  }
  if (portal.side === 'upper') {
    const ladderX = getLadderCharacterX();
    const currentX = Number.parseFloat(character.style.left) || 38;
    character.classList.toggle('facing-left', ladderX < currentX);
    if (!await moveCharacter(ladderX, 1050, runId)) return false;
    if (!await climbToUpperPlatform(runId)) return false;
    character.classList.toggle('facing-left', portal.characterX < ladderX);
    if (!await moveCharacter(portal.characterX, 650, runId)) return false;
  } else {
    const currentX = Number.parseFloat(character.style.left) || 38;
    character.classList.toggle('facing-left', portal.characterX < currentX);
    if (!await moveCharacter(portal.characterX, 1700, runId)) return false;
  }
  if (!await ensureCharacterTouchesPortal(portal, runId)) {
    setWorldActivity('포탈에 도착하지 못해 이동을 중단했습니다.');
    return false;
  }
  return enterWorldPortal(connection, runId);
}

async function commandTravelTo(targetMapId) {
  if (state.moving || state.dead) return;
  const route = findMapTravelRoute(state.currentMapId, targetMapId);
  if (route.length <= 1) {
    if (route.length === 1) setWorldActivity('이미 해당 맵에 있습니다.');
    else setWorldActivity('현재 위치에서 이동할 수 없는 맵입니다.');
    return;
  }

  closeFeature();
  clearRallyPoint();
  state.moving = true;
  state.combatRunId += 1;
  const runId = ++state.moveRunId;
  updateFieldControls();

  for (const nextMapId of route.slice(1)) {
    if (!await performMapMoveStep(nextMapId, runId)) {
      finishMoveCommand(runId);
      return;
    }
  }

  if (runId !== state.moveRunId) return;
  finishMoveCommand(runId);
  if (state.autoCombat) {
    startAutoCombat();
  } else {
    setWorldActivity('명령 대기 중');
  }
}

async function commandMove(targetMapId) {
  return commandTravelTo(targetMapId);
}

async function approachMonsterForCombat(runId) {
  if (!isRunActive('combat', runId)) return false;
  const target = getCombatTarget();
  const monster = getCombatTargetElement();
  if (!target || !monster) return false;
  const character = $('fieldCharacter');
  const stage = $('worldStage');

  if ((Number.parseFloat(character.style.bottom) || 42) > 60) {
    const ladderX = getLadderCharacterX();
    const currentX = Number.parseFloat(character.style.left) || ladderX;
    const approachDuration = getScaledMovementDuration(650);
    const climbDuration = getScaledMovementDuration(1050);
    character.classList.toggle('facing-left', ladderX < currentX);
    setWorldActivity('전투 위치로 이동 · 사다리 내려가는 중');
    setCharacterMotion('walking');
    character.style.transitionDuration = `${approachDuration}ms`;
    character.style.left = `${ladderX}%`;
    await sleep(approachDuration + 20);
    if (!isRunActive('combat', runId)) return false;
    character.classList.remove('facing-left');
    setCharacterMotion('climb');
    character.style.transitionDuration = `${climbDuration}ms`;
    character.style.bottom = '42px';
    await sleep(climbDuration + 20);
    setCharacterMotion(null);
  }

  if (!isRunActive('combat', runId)) return false;
  const stageRect = stage.getBoundingClientRect();
  const characterRect = character.getBoundingClientRect();
  const monsterRect = monster.getBoundingClientRect();
  const rangePx = Math.max(30, Number(getCombatPresentation().rangePx
    || state.character?.derivedStats?.attackRange) || 55);
  const characterCenter = characterRect.left + characterRect.width / 2;
  const monsterCenter = monsterRect.left + monsterRect.width / 2;
  const characterIsLeft = characterCenter <= monsterCenter;
  const gap = characterIsLeft
    ? monsterRect.left - characterRect.right
    : characterRect.left - monsterRect.right;
  character.classList.toggle('facing-left', !characterIsLeft);
  if (gap <= rangePx) return true;

  const desiredLeftPx = characterIsLeft
    ? monsterRect.left - stageRect.left - rangePx - characterRect.width
    : monsterRect.right - stageRect.left + rangePx;
  const clampedLeftPx = Math.max(0, Math.min(stageRect.width - characterRect.width, desiredLeftPx));
  const targetPercent = clampedLeftPx / stageRect.width * 100;
  const travelDistance = Math.abs(clampedLeftPx - (characterRect.left - stageRect.left));
  const movementSpeed = getMovementSpeedPercent();
  const duration = Math.max(
    840,
    Math.min(
      7200,
      travelDistance / (CHARACTER_BASE_MOVEMENT_PX_PER_SECOND * movementSpeed / 100) * 1000
    )
  );
  setWorldActivity(`몬스터에게 접근 중 · 사거리 ${Math.round(rangePx)}`);
  setCharacterMotion('walking');
  character.style.transitionDuration = `${duration}ms`;
  character.style.left = `${targetPercent}%`;
  await sleep(duration);
  setCharacterMotion(null);
  return isRunActive('combat', runId);
}

function getAttackSpeedMultiplier() {
  const stage = Math.max(1, Number(state.character?.derivedStats?.attackSpeedStage)
    || Number(state.character?.skillEffects?.attackSpeedStage)
    || 1);
  const weaponMultiplier = Math.max(
    0.1,
    Number(state.character?.derivedStats?.attackSpeedMultiplier) || 1
  );
  return (1 + (stage - 1) * 0.2) * weaponMultiplier;
}

async function runAutoCombat(runId) {
  while (isRunActive('combat', runId) && state.token && !state.isAdmin && !state.dead) {
    const target = getCombatTarget();
    if (!target) {
      if (
        state.rallyPoint?.mapId === state.currentMapId
        && !isAtRallyPoint()
      ) {
        commandFieldPoint(state.rallyPoint, true).catch((err) => {
          console.error('V2 rally return error:', err);
        });
        return;
      }
      setWorldActivity('몬스터 출현 대기 중');
      await sleep(650);
      continue;
    }
    if (!await approachMonsterForCombat(runId)) {
      await sleep(350);
      continue;
    }
    const autoSkill = getNextAutoSkillForCombat();
    if (autoSkill) {
      const used = await useActiveSkill(autoSkill.id, { automatic: true });
      if (used) {
        state.combatAttackCount += 1;
        await sleep(300);
        continue;
      }
    }
    const basicAttackAllowed = typeof isBeginnerBasicAttackEligible === 'function'
      && isBeginnerBasicAttackEligible();
    const basicAttackEnabled = typeof isBasicAttackAutoEnabled === 'function'
      && isBasicAttackAutoEnabled();
    if (!basicAttackAllowed || !basicAttackEnabled) {
      setWorldActivity('스킬 대기 중 · 기본공격 사용 안 함');
      await sleep(350);
      continue;
    }
    const motion = getCombatPresentation().motion;
    await playWorldMotion(motion, 'combat', runId);
    if (!isRunActive('combat', runId)) return;
    try {
      const result = await request('/api/v2/world/attack', {
        method: 'POST',
        body: JSON.stringify({
          clientId: state.worldClientId,
          mapId: state.currentMapId,
          monsterId: state.combatTargetId
        })
      });
      if (result.targetId) state.combatTargetId = String(result.targetId);
      showFloatingDamage(
        getCombatTargetElement(),
        result.missed ? 'MISS' : result.damage,
        result.critical ? 'critical' : 'outgoing'
      );
      applyAttackResult(result);
      showGroundLoot(result.drops || []);
      if (result.fieldBossRewardResult) {
        handleFieldBossEvents({ fieldBossRewards: [result.fieldBossRewardResult] });
      }
      if (result.inventory) setInventoryData(result.inventory);
      if (state.character?.economy && Number.isFinite(Number(result.money))) {
        state.character.economy.money = Number(result.money);
      }
      if (result.character) {
        renderGame({
          preview: state.preview,
          character: result.character,
          displayName: state.displayName
        });
      }
      if (result.defeated) {
        state.combatTargetId = '';
        setWorldActivity(`몬스터 처치 · 경험치 +${formatNumber(result.expReward)}`);
      }
    } catch (err) {
      if (!String(err.message).includes('사거리')) console.error('V2 field attack error:', err);
    }
    state.combatAttackCount += 1;
    await sleep(Math.max(180, Math.round(900 / getAttackSpeedMultiplier())));
  }
}

function startAutoCombat() {
  if (!state.autoCombat || state.moving || state.dead || getMap(state.currentMapId)?.safeZone) return;
  const runId = ++state.combatRunId;
  runAutoCombat(runId).catch((err) => {
    console.error('V2 auto combat error:', err);
    setWorldActivity('자동 전투를 다시 준비하고 있습니다.');
  });
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return [Math.floor(safe / 3600), Math.floor(safe % 3600 / 60), safe % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function renderHuntingTime() {
  $('huntingTimeLabel').textContent = `남은 자동사냥시간 ${formatDuration(state.huntingTime.remainingSeconds)} / ${formatDuration(state.huntingTime.maximumSeconds)}`;
}

async function syncHuntingTime(active = state.autoCombat) {
  if (state.huntingSyncBusy) return;
  state.huntingSyncBusy = true;
  try {
    const previousRemaining = Math.max(0, Number(state.huntingTime.remainingSeconds) || 0);
    const data = await request('/api/v2/hunting-time/tick', {
      method: 'POST',
      body: JSON.stringify({ active })
    });
    state.huntingTime = {
      ...data.huntingTime,
      remainingSeconds: state.autoCombat
        ? Math.min(previousRemaining, Number(data.huntingTime?.remainingSeconds) || 0)
        : Number(data.huntingTime?.remainingSeconds) || 0
    };
    if (!state.huntingTime.enabled || state.huntingTime.remainingSeconds <= 0) {
      state.autoCombat = false;
      localStorage.setItem('v2AutoCombat', 'false');
      state.combatRunId += 1;
      updateFieldControls();
    }
    renderHuntingTime();
  } catch (err) {
    console.error('V2 hunting time sync error:', err);
  } finally {
    state.huntingSyncBusy = false;
  }
}

async function toggleAutoCombat() {
  if (state.dead) return;
  const requested = !state.autoCombat;
  if (requested && getMap(state.currentMapId)?.safeZone) {
    state.autoCombat = false;
    state.huntingTime.enabled = false;
    localStorage.setItem('v2AutoCombat', 'false');
    updateFieldControls();
    setWorldActivity('안전지대에서는 자동전투를 사용할 수 없습니다.');
    return;
  }
  if (requested && state.huntingTime.remainingSeconds <= 0) {
    setWorldActivity('남은 자동사냥 시간이 없습니다. 우편에서 사냥시간을 수령해주세요.');
    return;
  }
  try {
    const data = await request('/api/v2/hunting-time/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled: requested })
    });
    state.huntingTime = data.huntingTime;
    state.autoCombat = state.huntingTime.enabled;
  } catch (err) {
    setWorldActivity(err.message);
    return;
  }
  localStorage.setItem('v2AutoCombat', String(state.autoCombat));
  state.combatRunId += 1;
  setCharacterMotion(null);
  updateFieldControls();
  if (state.autoCombat && !state.moving) {
    setWorldActivity('자동 전투 시작');
    startAutoCombat();
  } else if (!state.moving) {
    setWorldActivity('명령 대기 중');
  }
  renderHuntingTime();
}

function activityLabel(activity) {
  if (activity === 'dead') return '사망';
  return activity === 'moving' ? '이동 중' : (activity === 'combat' ? '전투 중' : '대기 중');
}

function ensureRemotePlayerElement(player) {
  let element = Array.from($('remotePlayerLayer').children).find(
    (entry) => entry.dataset.userId === player.userId
  );
  if (element) return element;
  element = document.createElement('div');
  element.className = 'remote-player';
  element.dataset.userId = player.userId;
  element.innerHTML = `
    <span class="remote-player-tag"><b></b><small></small></span>
    <span class="remote-skill-use"></span>
    <i class="remote-head"></i><i class="remote-body"></i>
    <i class="remote-arm remote-arm-left"></i><i class="remote-arm remote-arm-right"></i>
    <i class="remote-leg remote-leg-left"></i><i class="remote-leg remote-leg-right"></i>`;
  $('remotePlayerLayer').appendChild(element);
  return element;
}

function renderRemotePlayers(players = []) {
  const visibleIds = new Set();
  players.filter((player) => player.userId !== state.selfUserId).forEach((player) => {
    visibleIds.add(player.userId);
    const element = ensureRemotePlayerElement(player);
    element.querySelector('b').textContent = player.nickname;
    element.querySelector('small').textContent = player.online === false
      ? `${activityLabel(player.activity)} · 오프라인`
      : activityLabel(player.activity);
    const skillLabel = element.querySelector('.remote-skill-use');
    if (skillLabel) {
      skillLabel.textContent = '';
      skillLabel.classList.remove('is-visible');
    }
    element.dataset.skillKey = '';
    element.style.left = `${player.x}%`;
    element.style.bottom = player.floor === 1 ? `${getUpperPlatformBottom()}px` : '42px';
    element.classList.toggle('facing-left', Boolean(player.facingLeft));
    element.classList.toggle('is-walking', player.activity === 'moving');
    element.classList.toggle('is-combat', player.activity === 'combat');
    element.classList.toggle('is-dead', Boolean(player.isDead));
    element.classList.toggle(
      'is-invulnerable',
      Number(player.invulnerableUntil) > state.worldServerTime
    );
  });
  Array.from($('remotePlayerLayer').children).forEach((element) => {
    if (!visibleIds.has(element.dataset.userId)) element.remove();
  });
}

function ensureMonsterElement(monster) {
  let element = Array.from($('monsterLayer').children).find(
    (entry) => entry.dataset.monsterId === monster.id
  );
  if (element) return element;
  element = document.createElement('div');
  const spawnAge = state.worldServerTime - Number(monster.spawnedAt);
  const shouldAnimateSpawn = Number.isFinite(spawnAge) && spawnAge >= 0 && spawnAge <= 2_000;
  element.className = `field-monster${shouldAnimateSpawn ? ' is-spawning' : ''}`;
  element.dataset.monsterId = monster.id;
  element.innerHTML = `
    <span class="monster-name"></span><span class="monster-level"></span>
    <pre>(╬ಠ益ಠ)</pre>
    <div class="monster-hp"><i></i></div>`;
  $('monsterLayer').appendChild(element);
  if (shouldAnimateSpawn) {
    setTimeout(() => element.classList.remove('is-spawning'), 850);
  }
  return element;
}

function renderMonsters(monsters = []) {
  state.worldMonsters = monsters;
  const visibleIds = new Set();
  monsters.forEach((monster) => {
    visibleIds.add(monster.id);
    const element = ensureMonsterElement(monster);
    element.dataset.floor = String(monster.floor);
    element.querySelector('.monster-name').textContent = monster.name;
    element.querySelector('.monster-level').textContent = `Lv.${monster.level}`;
    element.querySelector('pre').textContent = monster.icon || '(•̀ᴗ•́)';
    element.querySelector('.monster-hp i').style.width = `${ratio(monster.hp, monster.maxHp)}%`;
    element.classList.toggle('is-field-boss', Boolean(monster.fieldBoss));
    element.style.setProperty('--monster-scale', String(Math.max(0.5, 0.5 * (Number(monster.visualScale) || 1))));
    element.style.left = `${monster.x}%`;
    element.style.bottom = monster.floor === 1 ? `${getUpperPlatformBottom() + 1}px` : '43px';
    element.classList.toggle('facing-left', monster.direction < 0);
    element.classList.toggle('is-moving', ['walk-left', 'walk-right', 'chase'].includes(monster.state));
    element.classList.toggle('is-chasing', monster.state === 'chase');
    element.classList.toggle('is-falling', monster.state === 'fall');
  });
  Array.from($('monsterLayer').children).forEach((element) => {
    if (!visibleIds.has(element.dataset.monsterId)) element.remove();
  });
  renderFieldBossTopBar(monsters);
}

function renderFieldBossTopBar(monsters = state.worldMonsters || []) {
  const bar = $('fieldBossTopBar');
  if (!bar) return;
  const boss = (monsters || []).find((monster) => monster.fieldBoss && Number(monster.hp) > 0);
  bar.classList.toggle('hidden', !boss);
  if (!boss) return;
  $('fieldBossTopName').textContent = boss.name || 'FIELD BOSS';
  $('fieldBossTopText').textContent = `${formatNumber(boss.hp)} / ${formatNumber(boss.maxHp)}`;
  $('fieldBossTopFill').style.width = `${ratio(boss.hp, boss.maxHp)}%`;
}

function applyAttackResult(result = {}) {
  const targetId = String(state.combatTargetId || '');
  if (!targetId) return;
  const targetElement = Array.from($('monsterLayer').children).find(
    (element) => element.dataset.monsterId === targetId
  );

  if (result.defeated || !result.monster) {
    state.worldMonsters = state.worldMonsters.filter((monster) => monster.id !== targetId);
    targetElement?.remove();
    renderFieldBossTopBar();
    return;
  }

  // Heartbeats own movement coordinates. A delayed attack response may update
  // HP, but it must never rewind a newer x/floor snapshot.
  state.worldMonsters = state.worldMonsters.map((monster) => (
    monster.id === targetId
      ? {
        ...monster,
        hp: result.monster.hp,
        maxHp: result.monster.maxHp,
        state: result.monster.state
      }
      : monster
  ));
  const hpBar = targetElement?.querySelector('.monster-hp i');
  if (hpBar) hpBar.style.width = `${ratio(result.monster.hp, result.monster.maxHp)}%`;
  if (result.knockedBack) {
    targetElement?.classList.add('is-knockback');
    setTimeout(() => targetElement?.classList.remove('is-knockback'), 420);
  }
  targetElement?.classList.toggle('is-chasing', result.monster.state === 'chase');
  renderFieldBossTopBar();
}

function syncInvulnerabilityVisual(invulnerableUntil, serverTime) {
  const character = $('fieldCharacter');
  const until = Math.max(0, Number(invulnerableUntil) || 0);
  const remaining = until - serverTime;
  if (remaining <= 0) {
    character.classList.remove('is-invulnerable');
    state.invulnerableUntil = 0;
    if (state.invulnerabilityTimer) clearTimeout(state.invulnerabilityTimer);
    state.invulnerabilityTimer = null;
    return;
  }
  if (state.invulnerableUntil === until && character.classList.contains('is-invulnerable')) return;
  state.invulnerableUntil = until;
  if (state.invulnerabilityTimer) clearTimeout(state.invulnerabilityTimer);
  character.classList.add('is-invulnerable');
  state.invulnerabilityTimer = setTimeout(() => {
    if (state.invulnerableUntil !== until) return;
    character.classList.remove('is-invulnerable');
    state.invulnerableUntil = 0;
    state.invulnerabilityTimer = null;
  }, remaining);
}

function showDeathState(expLost = 0) {
  if (!state.dead) {
    state.dead = true;
    state.worldStateEpoch += 1;
    state.deathExpLost = Math.max(0, Number(expLost) || 0);
    state.autoCombat = false;
    localStorage.setItem('v2AutoCombat', 'false');
    state.moving = false;
    state.moveRunId += 1;
    state.combatRunId += 1;
    setCharacterMotion('dead');
    closeFeature();
    setWorldActivity('행동 불능 · 안전지대 부활 대기');
    updateFieldControls();
  } else {
    state.deathExpLost = Math.max(state.deathExpLost, Number(expLost) || 0);
  }
  $('deathExpLoss').textContent = state.deathExpLost > 0
    ? `사망 페널티로 경험치 ${formatNumber(state.deathExpLost)}을 잃었습니다.`
    : '현재 경험치가 부족하여 차감된 경험치는 없습니다.';
  $('deathModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function handleFieldBossEvents(data = {}) {
  const ownStatus = (data.fieldBossStatusEvents || []).find((event) => (
    event.targetUserId === state.selfUserId
  ));
  if (ownStatus?.type === 'silence') {
    setWorldActivity(`${ownStatus.bossName || '필드보스'}의 침묵에 걸렸습니다.`);
  } else if (ownStatus?.type === 'ranged') {
    setWorldActivity(`${ownStatus.bossName || '필드보스'}의 원거리 공격에 피격되었습니다.`);
  }

  const bossReward = (data.fieldBossRewards || []).find((event) => (
    (event.rewards || []).some((reward) => reward.userId === state.selfUserId)
  ));
  if (!bossReward) return;
  const ownReward = (bossReward.rewards || []).find((reward) => reward.userId === state.selfUserId);
  const itemText = (ownReward?.items || [])
    .filter((item) => item.stored)
    .map((item) => `${item.name || item.itemId} x${formatNumber(item.quantity || 1)}`)
    .join(' · ');
  setWorldActivity(`${bossReward.bossName || '필드보스'} 처치 보상 획득 · 경험치 ${formatNumber(ownReward?.exp)} · ${formatNumber(ownReward?.money)}원${itemText ? ` · ${itemText}` : ''}`);
  Promise.all([
    request('/api/v2/me'),
    request('/api/v2/inventory')
  ]).then(([me, inventory]) => {
    state.character = me.character;
    setInventoryData(inventory.inventory);
    renderGame({ preview: state.preview, character: me.character, displayName: state.displayName });
  }).catch(() => {});
}

async function revivePlayer() {
  const button = $('reviveButton');
  button.disabled = true;
  state.reviving = true;
  state.worldStateEpoch += 1;
  try {
    const data = await request('/api/v2/world/revive', {
      method: 'POST',
      body: JSON.stringify({ clientId: state.worldClientId })
    });
    state.dead = false;
    state.deathExpLost = 0;
    $('deathModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    state.character = data.character;
    renderGame({
      preview: state.preview,
      character: data.character,
      displayName: state.displayName
    });
    renderWorldMap(data.map.id, 0);
    setWorldActivity(`${data.map.name}에서 HP 1로 부활했습니다.`);
    updateFieldControls();
    await sendWorldHeartbeat();
  } catch (err) {
    $('deathExpLoss').textContent = err.message;
  } finally {
    state.reviving = false;
    button.disabled = false;
  }
}

function renderWorldEntities(data = {}) {
  if (data.partyState) {
    state.partyState = { ...state.partyState, ...data.partyState };
    const invitation = data.partyState.invitation;
    if (invitation?.id && invitation.id !== state.lastPartyInvitationId) {
      state.lastPartyInvitationId = invitation.id;
      openFeature('party-invite');
    }
  }
  if (data.tradeState) {
    const previousSessionId = state.tradeState.session?.id || '';
    state.tradeState = { ...state.tradeState, ...data.tradeState };
    if (
      data.tradeState.request?.id
      && data.tradeState.request.id !== state.lastTradeRequestId
    ) {
      state.lastTradeRequestId = data.tradeState.request.id;
      openFeature('trade-invite');
    } else if (data.tradeState.session?.id && data.tradeState.session.id !== previousSessionId) {
      openFeature('trade');
    } else if (previousSessionId && !data.tradeState.session) {
      Promise.all([
        request('/api/v2/me'),
        request('/api/v2/inventory')
      ]).then(([me, inventory]) => {
        state.character = me.character;
        setInventoryData(inventory.inventory);
        renderGame({ preview: state.preview, character: me.character, displayName: state.displayName });
        setWorldActivity('교환이 종료되었습니다. 자산과 인벤토리를 새로 불러왔습니다.');
      }).catch(() => {});
    }
  }
  state.worldServerTime = Number(data.serverTime) || Date.now();
  if (data.self?.userId) state.selfUserId = data.self.userId;
  renderRemotePlayers(data.players || []);
  renderMonsters(data.monsters || []);
  renderPartyPortals(data.partyPortals || []);
  if (data.self && state.character?.resources) {
    state.character.resources.currentHp = data.self.currentHp;
    state.character.resources.maxHp = data.self.maxHp;
    state.character.resources.currentMp = data.self.currentMp;
    state.character.resources.maxMp = data.self.maxMp;
    setResource('hp', data.self.currentHp, data.self.maxHp);
    setResource('mp', data.self.currentMp, data.self.maxMp);
    syncInvulnerabilityVisual(data.self.invulnerableUntil, state.worldServerTime);
    if (data.self.isDead || Number(data.self.currentHp) <= 0) {
      const ownDeath = (data.contactEvents || []).find(
        (event) => event.userId === state.selfUserId && Number(event.currentHp) <= 0
      );
      showDeathState(ownDeath?.expLost || 0);
    }
  }
  const ownContact = (data.contactEvents || []).find((event) => event.userId === state.selfUserId);
  if (ownContact) {
    const character = $('fieldCharacter');
    character.style.transitionDuration = '0ms';
    character.style.left = `${ownContact.x}%`;
    character.style.bottom = Number(ownContact.floor) === 1
      ? `${getUpperPlatformBottom()}px`
      : '42px';
    void character.offsetWidth;
    if (state.moving && state.activeMoveTargetX != null) {
      const recoveryDuration = getScaledMovementDuration(
        getFieldMoveDuration(state.activeMoveTargetX)
      );
      state.activeMoveDeadlineAt = Math.max(
        state.activeMoveDeadlineAt,
        Date.now() + recoveryDuration * 2 + 1_000
      );
    }
    character.classList.add('damage-flash');
    setTimeout(() => character.classList.remove('damage-flash'), 260);
    const damageKey = `${ownContact.monsterId}:${ownContact.invulnerableUntil}:${ownContact.damage}`;
    if (state.lastContactDamageKey !== damageKey) {
      state.lastContactDamageKey = damageKey;
      showFloatingDamage(
        character,
        ownContact.dodged ? 'MISS' : (ownContact.blocked ? 'BLOCK' : ownContact.damage),
        'incoming'
      );
    }
    syncInvulnerabilityVisual(ownContact.invulnerableUntil, state.worldServerTime);
    if (Number(ownContact.currentHp) > 0) {
      setWorldActivity(
        ownContact.dodged
          ? '패시브 회피 성공 · 1초 무적'
          : `몸박 피해 -${formatNumber(ownContact.damage)} · 2초 무적`
      );
    }
  }
  const ownRecovery = (data.recoveryEvents || []).find(
    (event) => event.userId === state.selfUserId
      && (Number(event.healed) > 0 || Number(event.restoredMp) > 0)
  );
  if (ownRecovery && !ownContact) {
    const recoveryLabels = [];
    if (Number(ownRecovery.healed) > 0) {
      recoveryLabels.push(`체력 +${formatNumber(ownRecovery.healed)}`);
    }
    if (Number(ownRecovery.restoredMp) > 0) {
      recoveryLabels.push(`정신력 +${formatNumber(ownRecovery.restoredMp)}`);
    }
    setWorldActivity(`패시브 회복 · ${recoveryLabels.join(' · ')}`);
  }
  handleFieldBossEvents(data);
  collectGroundLoot(data.lootCollections || []);
  maybeUseAutoPotions();
}

function disconnectSupersededWorld() {
  state.worldControlActive = false;
  state.autoCombat = false;
  state.moving = false;
  state.moveRunId += 1;
  state.combatRunId += 1;
  state.worldPresenceRunId += 1;
  localStorage.setItem('v2AutoCombat', 'false');
  clearLoginState();
  $('workspace').classList.add('hidden');
  $('userWorkspace').classList.add('hidden');
  $('logoutButton').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
  $('loginStatus').textContent = '다른 기기에서 같은 계정으로 접속해 이 기기의 연결이 종료되었습니다.';
}

async function sendWorldHeartbeat() {
  if (
    state.worldHeartbeatBusy
    || state.dead
    || state.reviving
    || !state.worldControlActive
    || !state.token
    || state.isAdmin
    || !state.currentMapId
  ) return;
  const requestEpoch = state.worldStateEpoch;
  state.worldHeartbeatBusy = true;
  try {
    const character = $('fieldCharacter');
    const data = await request('/api/v2/world/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        clientId: state.worldClientId,
        mapId: state.currentMapId,
        x: getCharacterX(),
        floor: getCharacterFloor(),
        activity: getWorldActivityType(),
        motion: getCurrentCharacterMotion(),
        facingLeft: character.classList.contains('facing-left')
      })
    });
    if (requestEpoch === state.worldStateEpoch && !state.dead && !state.reviving) {
      renderWorldEntities(data);
    }
  } catch (err) {
    if (err.code === 'WORLD_CONTROL_LOST') {
      disconnectSupersededWorld();
      return;
    }
    console.error('V2 world heartbeat error:', err);
  } finally {
    state.worldHeartbeatBusy = false;
  }
}

async function runWorldPresence(runId) {
  while (runId === state.worldPresenceRunId && state.token && !state.isAdmin) {
    await sendWorldHeartbeat();
    await sleep(1000);
  }
}

function startWorldPresence() {
  const runId = ++state.worldPresenceRunId;
  runWorldPresence(runId).catch((err) => console.error('V2 world presence error:', err));
}

function startWorldSimulation() {
  if (!state.maps.length) return;
  const persistedWorld = state.character?.worldState || {};
  const savedMap = getMap(persistedWorld.mapId || state.currentMapId);
  const accessibleSavedMap = savedMap || null;
  const startMap = accessibleSavedMap || getMap(state.startMapId) || state.maps[0];
  state.moveRunId += 1;
  state.combatRunId += 1;
  state.moving = false;
  state.rallyPoint = loadStoredRallyPoint();
  if (state.rallyPoint?.mapId !== startMap.id) clearRallyPoint();
  renderWorldMap(startMap.id, 0);
  if (startMap.id === persistedWorld.mapId) {
    const character = $('fieldCharacter');
    character.style.left = `${Math.max(0, Math.min(94, Number(persistedWorld.x) || 8))}%`;
    character.style.bottom = Number(persistedWorld.floor) === 1
      ? `${getUpperPlatformBottom()}px`
      : '42px';
  }
  if (Number(state.character?.resources?.currentHp) <= 0) showDeathState(0);
  startWorldPresence();
  if (state.autoCombat && !state.dead) startAutoCombat();
}

function setInventoryData(inventory = {}) {
  state.inventory = {
    items: Array.isArray(inventory.items) ? inventory.items : [],
    categories: inventory.categories && typeof inventory.categories === 'object'
      ? inventory.categories
      : {},
    potions: Array.isArray(inventory.potions) ? inventory.potions : [],
    quickSlots: {
      hp: inventory.quickSlots?.hp || null,
      mp: inventory.quickSlots?.mp || null
    },
    autoUsePercent: {
      hp: Math.max(0, Math.min(100, Number(inventory.autoUsePercent?.hp) || 0)),
      mp: Math.max(0, Math.min(100, Number(inventory.autoUsePercent?.mp) || 0))
    },
    limits: {
      defaultCapacity: Number(inventory.limits?.defaultCapacity) || 20,
      maximumCapacity: Number(inventory.limits?.maximumCapacity) || 64,
      expansionSize: Number(inventory.limits?.expansionSize) || 4
    }
  };
  renderPotionQuickbar();
}

function setMailboxData(data = {}) {
  state.mailbox = Array.isArray(data.mails) ? data.mails : [];
  updateMailButton(Number(data.pendingCount) || 0);
}

function updateMailButton(pendingCount) {
  state.pendingMailCount = Math.max(0, Number(pendingCount) || 0);
  $('mailPendingCount').textContent = formatNumber(state.pendingMailCount);
  $('mailButton').classList.toggle('hidden', state.pendingMailCount <= 0);
  $('mailButton').classList.toggle('has-alert', state.pendingMailCount > 0);
}

function setFloatingButtonsMinimized(minimized) {
  state.floatingButtonsMinimized = Boolean(minimized);
  localStorage.setItem('v2FloatingButtonsMinimized', String(state.floatingButtonsMinimized));
  document.body.classList.toggle('floating-actions-minimized', state.floatingButtonsMinimized);
  const button = $('floatMinimizeButton');
  if (button) {
    button.textContent = state.floatingButtonsMinimized ? '+' : '−';
    button.setAttribute(
      'aria-label',
      state.floatingButtonsMinimized ? '우편/이벤트 버튼 펼치기' : '우편/이벤트 버튼 최소화'
    );
  }
}

function getDisplayedMoney() {
  return Number(state.character?.economy?.money ?? state.shop.money ?? 0) || 0;
}

function renderPotionQuickbar() {
  if (!$('hpPotionButton') || !$('mpPotionButton')) return;
  for (const slot of ['hp', 'mp']) {
    const button = $(slot === 'hp' ? 'hpPotionButton' : 'mpPotionButton');
    const potion = state.inventory.quickSlots[slot];
    button.querySelector('strong').textContent = potion?.name || '미설정';
    button.querySelector('small').textContent = potion
      ? `${formatNumber(potion.quantity)}개 · +${formatNumber(potion.restoreAmount)}`
      : (slot === 'hp' ? '체력 포션' : '정신력 포션');
    button.disabled = !potion || potion.quantity <= 0;
  }
}

function animateResourceRestore(resource) {
  const track = $(resource === 'hp' ? 'hpBar' : 'mpBar')?.parentElement;
  if (!track) return;
  track.classList.remove('is-restored');
  void track.offsetWidth;
  track.classList.add('is-restored');
  setTimeout(() => track.classList.remove('is-restored'), 520);
}

async function useQuickPotion(slot, automatic = false) {
  if (state.dead || state.autoPotionBusy[slot]) return;
  state.autoPotionBusy[slot] = true;
  try {
    const data = await request('/api/v2/inventory/use-potion', {
      method: 'POST',
      body: JSON.stringify({ slot })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({
      preview: state.preview,
      character: data.character,
      displayName: state.displayName
    });
    animateResourceRestore(slot);
    setWorldActivity(`${data.used.item.name} 사용 · ${slot === 'hp' ? '체력' : '정신력'} +${formatNumber(data.used.restored)}`);
  } catch (err) {
    if (!automatic) setWorldActivity(err.message);
  } finally {
    state.autoPotionBusy[slot] = false;
  }
}

function maybeUseAutoPotions() {
  if (state.dead || !state.character?.resources) return;
  for (const slot of ['hp', 'mp']) {
    const threshold = Number(state.inventory.autoUsePercent?.[slot]) || 0;
    const potion = state.inventory.quickSlots?.[slot];
    if (!threshold || !potion || potion.quantity <= 0 || state.autoPotionBusy[slot]) continue;
    const current = Number(state.character.resources[slot === 'hp' ? 'currentHp' : 'currentMp']) || 0;
    const maximum = Math.max(1, Number(state.character.resources[slot === 'hp' ? 'maxHp' : 'maxMp']) || 1);
    if (current > 0 && current / maximum * 100 <= threshold && current < maximum) {
      useQuickPotion(slot, true);
    }
  }
}

const INVENTORY_TAB_ORDER = Object.freeze(['equipment', 'consumable', 'misc', 'cash']);
const INVENTORY_PAGE_SIZE = 16;
const ITEM_STAT_LABELS = Object.freeze({
  attack: '공격력',
  magic: '마력',
  defense: '방어력',
  magicDefense: '마법방어력',
  grit: '맷집',
  processingSpeed: '처리속도',
  workKnowledge: '업무지식',
  awareness: '눈치',
  maxHp: '최대 HP',
  maxMp: '최대 MP',
  accuracy: '명중률',
  evasion: '회피율',
  movementSpeed: '이동속도',
  jump: '점프력'
});
const ITEM_ARCHETYPE_LABELS = Object.freeze({
  warrior: '전사 계열',
  archer: '궁수 계열',
  thief: '도적 계열',
  mage: '마법사 계열'
});
const ITEM_SLOT_LABELS = Object.freeze({
  weapon: '무기',
  shield: '방패',
  helmet: '투구',
  gloves: '장갑',
  shoes: '신발',
  cape: '망토',
  top: '상의',
  bottom: '하의',
  necklace: '목걸이',
  ring: '반지',
  earrings: '귀걸이'
});

function equipmentTooltipHtml(item) {
  if (item.category !== 'equipment') return '';
  const enhancementLevel = Math.max(0, Number(item.enhancement?.level) || 0);
  const displayName = `${item.name}${enhancementLevel ? ` +${enhancementLevel}` : ''}`;
  const requirements = item.requirements || {};
  const requiredLevel = Number(requirements.level ?? item.requiredLevel) || 1;
  const allowed = (requirements.allowedArchetypes || [])
    .map((archetype) => ITEM_ARCHETYPE_LABELS[archetype] || archetype)
    .join('/');
  const availableJobs = (requirements.allowedArchetypes || []).length >= 4
    ? '전 직업'
    : (allowed || '전 직업');
  const requiredStats = Object.entries(requirements.stats || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${ITEM_STAT_LABELS[key] || key} ${formatNumber(value)}`)
    .join(' · ');
  const stats = Object.entries(item.stats || {})
    .filter(([, value]) => Number(value))
    .map(([key, value]) => `${ITEM_STAT_LABELS[key] || key} +${formatNumber(value)}`)
    .join(' · ');
  return `<div class="equipment-tooltip-spec">
    <span><b>장비명</b>${escapeHtml(displayName)}</span>
    <span><b>장착 부위</b>${escapeHtml(ITEM_SLOT_LABELS[item.equipmentSlot] || item.equipmentSlot || '미지정')}</span>
    <span><b>착용가능 직업</b>${escapeHtml(availableJobs)}</span>
    <span><b>착용에 필요한 스탯</b>${escapeHtml(`레벨 ${requiredLevel}${requiredStats ? ` · ${requiredStats}` : ' · 추가 요구 없음'}`)}</span>
    <span><b>장비 스탯</b>${escapeHtml(stats || '없음')}</span>
    <span><b>업그레이드</b>${formatNumber(item.enhancement?.remaining ?? item.upgradeSlots ?? 0)}회 남음 / 총 ${formatNumber(item.enhancement?.maximum ?? item.upgradeSlots ?? 0)}회</span>
  </div>`;
}

function inventorySlotBody(item, slotNumber, locked = false) {
  if (locked) {
    return `<div class="inventory-slot is-locked"><span>${slotNumber}</span><b>🔒</b></div>`;
  }
  if (!item) {
    return `<div class="inventory-slot is-empty"><span>${slotNumber}</span></div>`;
  }
  let usable = '';
  const directlyUsableItem = (
    ['return-scroll', 'experience-buff', 'hunting-time', 'level-up', 'skill-reset'].includes(item.itemType)
    || item.id === 'level_up_coupon'
  );
  if (item.itemType === 'inventory-expansion') {
    usable = '<button class="inventory-item-use" type="button" data-use-expansion-ticket>사용</button>';
  } else if (item.itemType === 'job-change') {
    usable = '<button class="inventory-item-use" type="button" data-use-job-change-ticket>사용</button>';
  } else if (item.itemType === 'stat-reset') {
    usable = `<button class="inventory-item-use" type="button" data-use-stat-reset-ticket="${escapeHtml(item.id)}">사용</button>`;
  } else if (directlyUsableItem) {
    usable = `<button class="inventory-item-use" type="button" data-use-inventory-item="${escapeHtml(item.id)}">사용</button>`;
  } else if (item.category === 'equipment') {
    usable = `<button class="inventory-item-use" type="button" data-equip-inventory-equipment="${escapeHtml(item.stackId)}">장착</button>`;
  }
  const directlyUsable = directlyUsableItem
    ? item.id
    : '';
  const equipmentTooltip = equipmentTooltipHtml(item);
  return `<article class="inventory-slot has-item" tabindex="0" data-inventory-usable="${escapeHtml(directlyUsable)}">
    <span class="inventory-slot-number">${slotNumber}</span>
    <div class="inventory-item-icon" aria-hidden="true">${escapeHtml(item.icon || '📦')}</div>
    <b class="inventory-item-quantity">${formatNumber(item.quantity)}</b>
    ${usable}
    <div class="inventory-item-tooltip" role="tooltip">
      ${equipmentTooltip || `<strong>${escapeHtml(item.name)}</strong>`}
      ${equipmentTooltip ? '' : `<span>${escapeHtml(item.description)}</span>`}
      ${item.tradeable === false ? '<span>교환 불가</span>' : ''}
      <small>${formatNumber(item.quantity)}개 보유${item.expiresAt ? ` · ${new Date(item.expiresAt).toLocaleString('ko-KR')} 만료` : ''}</small>
    </div>
  </article>`;
}

function inventoryExpansionPanel() {
  if (!state.inventoryExpansionPrompt) return '';
  const ticketQuantity = state.inventory.items
    .filter((item) => item.id === 'inventory_expansion_ticket')
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
  return `<section class="inventory-expansion-panel">
    <div><strong>확장할 인벤토리 선택</strong><small>확장권 ${formatNumber(ticketQuantity)}개 · 탭당 최대 64칸</small></div>
    <div>
      ${INVENTORY_TAB_ORDER.map((key) => {
        const category = state.inventory.categories[key];
        const full = Number(category?.capacity) >= state.inventory.limits.maximumCapacity;
        return `<button type="button" data-expand-inventory="${key}" ${full ? 'disabled' : ''}>
          ${escapeHtml(category?.icon || '📦')} ${escapeHtml(category?.label || key)}
          <small>${formatNumber(category?.capacity || 20)} → ${formatNumber(Math.min(64, Number(category?.capacity || 20) + 4))}칸</small>
        </button>`;
      }).join('')}
      <button class="secondary-action" type="button" data-cancel-expansion>취소</button>
    </div>
  </section>`;
}

function jobChangePanel() {
  if (!state.jobChangePrompt) return '';
  const currentDepartment = state.character?.job?.departmentId;
  const departments = (state.meta?.departments || []).filter(
    (department) => department.id !== 'unassigned'
  );
  return `<section class="job-change-panel">
    <header>
      <strong>이직할 부서 선택</strong>
      <small>스탯과 스킬 포인트는 모두 반환되며 현재 전직 차수는 유지됩니다.</small>
    </header>
    <div class="job-change-options">
      ${departments.map((department) => `<button type="button"
        class="${state.selectedJobChangeDepartmentId === department.id ? 'is-selected' : ''}"
        data-job-change-department="${escapeHtml(department.id)}"
        ${department.id === currentDepartment ? 'disabled' : ''}>
        <strong>${escapeHtml(department.name)}</strong>
        <small>${escapeHtml(department.jobs?.[Math.max(0, Number(state.character?.job?.advancementTier || 1) - 1)] || department.archetype)}</small>
      </button>`).join('')}
    </div>
    <div class="job-change-actions">
      <button type="button" data-confirm-job-change ${state.selectedJobChangeDepartmentId ? '' : 'disabled'}>이직 확정</button>
      <button class="secondary-action" type="button" data-cancel-job-change>취소</button>
    </div>
  </section>`;
}

function inventoryBody() {
  const fallback = {
    key: state.inventoryTab,
    label: state.inventoryTab,
    icon: '📦',
    capacity: 20,
    usedSlots: 0,
    items: []
  };
  const category = state.inventory.categories[state.inventoryTab] || fallback;
  const capacity = Math.max(20, Number(category.capacity) || 20);
  const pageCount = Math.max(1, Math.ceil(capacity / INVENTORY_PAGE_SIZE));
  state.inventoryPage = Math.max(0, Math.min(pageCount - 1, state.inventoryPage));
  const pageStart = state.inventoryPage * INVENTORY_PAGE_SIZE;
  const slots = Array.from({ length: INVENTORY_PAGE_SIZE }, (_, index) => {
    const absoluteIndex = pageStart + index;
    return inventorySlotBody(
      category.items?.[absoluteIndex] || null,
      absoluteIndex + 1,
      absoluteIndex >= capacity
    );
  }).join('');

  return `<div class="inventory-window">
    <div class="inventory-wallet">
      <div><span>보유 재화</span><strong>${formatNumber(getDisplayedMoney())}원</strong></div>
      <button type="button" data-sort-inventory>자동 정렬</button>
    </div>
    <div class="inventory-tabs" role="tablist">
      ${INVENTORY_TAB_ORDER.map((key) => {
        const tab = state.inventory.categories[key] || { label: key, icon: '📦', capacity: 20, usedSlots: 0 };
        return `<button class="${key === state.inventoryTab ? 'is-active' : ''}" type="button" data-inventory-tab="${key}">
          <span>${escapeHtml(tab.icon)}</span><strong>${escapeHtml(tab.label)}</strong><small>${formatNumber(tab.usedSlots)}/${formatNumber(tab.capacity)}</small>
        </button>`;
      }).join('')}
    </div>
    ${inventoryExpansionPanel()}
    ${jobChangePanel()}
    <div class="inventory-page-heading">
      <div><span>${escapeHtml(category.icon)}</span><strong>${escapeHtml(category.label)} 인벤토리</strong></div>
      <small>${formatNumber(category.usedSlots)}칸 사용 / ${formatNumber(capacity)}칸</small>
    </div>
    <div class="inventory-grid">${slots}</div>
    <div class="inventory-pagination">
      <button type="button" data-inventory-page="-1" ${state.inventoryPage <= 0 ? 'disabled' : ''}>이전</button>
      <span>${state.inventoryPage + 1} / ${pageCount}</span>
      <button type="button" data-inventory-page="1" ${state.inventoryPage >= pageCount - 1 ? 'disabled' : ''}>다음</button>
    </div>
    <p class="notice-line">아이템은 위쪽 슬롯부터 사용됩니다. 물약과 캐쉬 사용 아이템은 한 칸에 최대 100개, 장비는 한 칸에 1개가 보관됩니다.</p>
  </div>`;
}

function rerenderInventory() {
  $('featureBody').innerHTML = inventoryBody();
  bindInventoryControls();
}

async function sortInventory() {
  try {
    const data = await request('/api/v2/inventory/sort', {
      method: 'POST',
      body: JSON.stringify({})
    });
    setInventoryData(data.inventory);
    rerenderInventory();
    setWorldActivity('인벤토리를 자동 정렬했습니다.');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function openInventoryExpansionChoice() {
  state.inventoryExpansionPrompt = true;
  rerenderInventory();
}

async function expandInventory(category) {
  try {
    const data = await request('/api/v2/inventory/expand', {
      method: 'POST',
      body: JSON.stringify({ category })
    });
    setInventoryData(data.inventory);
    state.inventoryTab = category;
    state.inventoryExpansionPrompt = false;
    state.inventoryPage = Math.max(0, Math.ceil(data.expansion.previousCapacity / INVENTORY_PAGE_SIZE) - 1);
    rerenderInventory();
    setWorldActivity(`${data.expansion.category.label} 인벤토리가 ${formatNumber(data.expansion.capacity)}칸으로 확장되었습니다.`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindInventoryControls() {
  document.querySelectorAll('[data-inventory-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.inventoryTab = button.dataset.inventoryTab;
      state.inventoryPage = 0;
      state.inventoryExpansionPrompt = false;
      rerenderInventory();
    });
  });
  document.querySelectorAll('[data-inventory-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.inventoryPage += Number(button.dataset.inventoryPage) || 0;
      rerenderInventory();
    });
  });
  document.querySelector('[data-use-expansion-ticket]')?.addEventListener('click', openInventoryExpansionChoice);
  document.querySelector('[data-sort-inventory]')?.addEventListener('click', sortInventory);
  document.querySelector('[data-use-job-change-ticket]')?.addEventListener('click', () => {
    state.jobChangePrompt = true;
    state.selectedJobChangeDepartmentId = '';
    rerenderInventory();
  });
  document.querySelectorAll('[data-job-change-department]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedJobChangeDepartmentId = button.dataset.jobChangeDepartment;
      rerenderInventory();
    });
  });
  document.querySelector('[data-confirm-job-change]')?.addEventListener('click', useJobChangeTicket);
  document.querySelector('[data-cancel-job-change]')?.addEventListener('click', () => {
    state.jobChangePrompt = false;
    state.selectedJobChangeDepartmentId = '';
    rerenderInventory();
  });
  document.querySelectorAll('[data-equip-inventory-equipment]').forEach((button) => {
    button.addEventListener('click', () => equipInventoryWeapon(button.dataset.equipInventoryEquipment));
  });
  document.querySelectorAll('[data-use-stat-reset-ticket]').forEach((button) => {
    button.addEventListener('click', () => useStatResetTicket(button.dataset.useStatResetTicket));
  });
  document.querySelectorAll('[data-use-inventory-item]').forEach((button) => {
    button.addEventListener('click', () => useInventoryItem(button.dataset.useInventoryItem));
  });
  document.querySelectorAll('[data-inventory-usable]').forEach((slot) => {
    if (!slot.dataset.inventoryUsable) return;
    slot.addEventListener('dblclick', () => useInventoryItem(slot.dataset.inventoryUsable));
  });
  document.querySelectorAll('[data-expand-inventory]').forEach((button) => {
    button.addEventListener('click', () => expandInventory(button.dataset.expandInventory));
  });
  document.querySelector('[data-cancel-expansion]')?.addEventListener('click', () => {
    state.inventoryExpansionPrompt = false;
    rerenderInventory();
  });
}

async function useInventoryItem(itemId) {
  if (
    itemId === 'level_up_coupon'
    && !window.confirm('현재 경험치를 모두 버리고 정확히 1레벨 상승할까요?')
  ) return;
  try {
    const data = await request('/api/v2/inventory/use-item', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
    state.character = data.character;
    if (itemId === 'level_up_coupon') {
      renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    }
    if (data.character?.huntingTime) {
      state.huntingTime = data.character.huntingTime;
      renderHuntingTime();
    }
    setInventoryData(data.inventory);
    if (data.map) {
      state.worldStateEpoch += 1;
      state.moveRunId += 1;
      state.combatRunId += 1;
      state.autoCombat = false;
      localStorage.setItem('v2AutoCombat', 'false');
      renderWorldMap(data.map.id, 0);
    }
    rerenderInventory();
    setWorldActivity(data.message);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function useJobChangeTicket() {
  if (!state.selectedJobChangeDepartmentId) return;
  try {
    const data = await request('/api/v2/inventory/use-job-change', {
      method: 'POST',
      body: JSON.stringify({ departmentId: state.selectedJobChangeDepartmentId })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    state.jobChangePrompt = false;
    state.selectedJobChangeDepartmentId = '';
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    rerenderInventory();
    setWorldActivity(`${data.jobChange.departmentName}으로 이직했습니다. 스탯과 스킬 포인트가 반환되었습니다.`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function equipInventoryWeapon(stackId) {
  try {
    const data = await request('/api/v2/equipment/equip', {
      method: 'POST',
      body: JSON.stringify({ stackId })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    rerenderInventory();
    setWorldActivity(`${data.equipment.equipped.name}을(를) 장착했습니다.`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function useStatResetTicket(itemId = 'stat_reset_coupon') {
  if (!window.confirm('투자한 스탯을 모두 4로 초기화하고 포인트를 돌려받을까요?')) return;
  try {
    const data = await request('/api/v2/inventory/use-stat-reset', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    rerenderInventory();
    setWorldActivity('스탯이 초기화되고 투자 포인트가 반환되었습니다.');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function unequipCurrentWeapon(slot = 'weapon') {
  try {
    const data = await request('/api/v2/equipment/unequip', {
      method: 'POST',
      body: JSON.stringify({ slot })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = equipmentBody();
    bindEquipmentTabs();
    setWorldActivity(`${data.equipment.unequipped.name}을(를) 해제했습니다.`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function potionConfigurationBody() {
  const potions = state.inventory.potions;
  const autoControls = ['hp', 'mp'].map((slot) => {
    const value = Number(state.inventory.autoUsePercent?.[slot]) || 0;
    return `<label class="auto-potion-control">
      <span><b>${slot.toUpperCase()} 자동 사용</b><small>${value > 0 ? `${value}% 이하` : '사용 안 함'}</small></span>
      <input type="range" min="0" max="100" step="5" value="${value}" data-auto-potion="${slot}">
    </label>`;
  }).join('');
  return `<div class="potion-config-sheet">
    <section class="auto-potion-settings">
      <strong>자동 포션 기준</strong>
      <p>0%는 자동 사용 안 함입니다. 설정값 이하가 되면 지정한 포션을 1개 사용합니다.</p>
      ${autoControls}
    </section>
    <p class="notice-line">왼쪽에는 체력 포션, 오른쪽에는 정신력 포션만 설정할 수 있습니다.</p>
    <div class="potion-config-list">
      ${potions.length ? potions.map((item) => `<article>
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)} · ${formatNumber(item.quantity)}개 보유</small></div>
        <button type="button" data-assign-potion="${escapeHtml(item.id)}" data-potion-slot="${item.resource}">${item.resource === 'hp' ? 'HP' : 'MP'} 슬롯 설정</button>
      </article>`).join('') : '<div class="empty-ledger"><b>설정할 포션이 없습니다.</b></div>'}
    </div>
  </div>`;
}

async function saveAutoPotionThreshold(slot, percent) {
  try {
    const data = await request('/api/v2/inventory/auto-potion', {
      method: 'POST',
      body: JSON.stringify({ slot, percent })
    });
    setInventoryData(data.inventory);
    $('featureBody').innerHTML = potionConfigurationBody();
    bindPotionControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function assignQuickPotion(slot, itemId) {
  try {
    const data = await request('/api/v2/inventory/quick-slot', {
      method: 'POST',
      body: JSON.stringify({ slot, itemId })
    });
    setInventoryData(data.inventory);
    $('featureBody').innerHTML = potionConfigurationBody();
    bindPotionControls();
    setWorldActivity('포션 퀵슬롯을 변경했습니다.');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function mailBody() {
  if (!state.mailbox.length) {
    return '<div class="empty-ledger"><b>새 우편이 없습니다.</b><p>모든 선물을 수령했습니다.</p></div>';
  }
  return `<div class="mail-sheet">
    <div class="mail-toolbar"><span>미수령 ${formatNumber(state.mailbox.length)}건</span><button type="button" data-claim-all-mail>모두 수령</button></div>
    <div class="mail-list">
      ${state.mailbox.map((mail) => `<article class="mail-entry">
        <div class="mail-stamp">ADMIN<br>GIFT</div>
        <div>
          <span>${escapeHtml(mail.sender)} · ${mail.createdAt ? new Date(mail.createdAt).toLocaleString('ko-KR') : ''} · ${mail.expiresAt ? `${new Date(mail.expiresAt).toLocaleString('ko-KR')} 만료` : '24시간 내 수령'}</span>
          <strong>${escapeHtml(mail.title)}</strong>
          ${mail.message ? `<p>${escapeHtml(mail.message)}</p>` : ''}
          <div class="mail-attachments">${mail.attachments.map((item) => `<b>${escapeHtml(item.name)} × ${formatNumber(item.quantity)}</b>`).join('')}</div>
        </div>
        <button type="button" data-claim-mail="${escapeHtml(mail.id)}">수령</button>
      </article>`).join('')}
    </div>
  </div>`;
}

async function refreshMailbox(openAfter = false) {
  try {
    const data = await request('/api/v2/mail');
    setMailboxData(data);
    if (openAfter) openFeature('mail');
  } catch (err) {
    if (openAfter) setWorldActivity(err.message);
  }
}

async function refreshMailStatus() {
  try {
    const data = await request('/api/v2/mail/status');
    updateMailButton(data.pendingCount);
  } catch (_) {}
}

function startMailPolling() {
  if (state.mailPollTimer) clearInterval(state.mailPollTimer);
  state.mailPollTimer = setInterval(refreshMailStatus, 10_000);
}

async function claimMailItem(mailId) {
  try {
    const data = await request('/api/v2/mail/claim', {
      method: 'POST',
      body: JSON.stringify({ mailId })
    });
    setInventoryData(data.inventory);
    if (data.huntingTime) {
      state.huntingTime = data.huntingTime;
      renderHuntingTime();
    }
    setMailboxData(data);
    $('featureBody').innerHTML = mailBody();
    bindMailControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function claimAllMailItems() {
  try {
    const data = await request('/api/v2/mail/claim-all', {
      method: 'POST',
      body: '{}'
    });
    setInventoryData(data.inventory);
    if (data.huntingTime) {
      state.huntingTime = data.huntingTime;
      renderHuntingTime();
    }
    setMailboxData(data);
    $('featureBody').innerHTML = mailBody();
    bindMailControls();
    setWorldActivity(`우편 ${formatNumber(data.claimedCount)}건을 모두 수령했습니다.`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindPotionControls() {
  document.querySelectorAll('[data-assign-potion]').forEach((button) => {
    button.addEventListener('click', () => assignQuickPotion(
      button.dataset.potionSlot,
      button.dataset.assignPotion
    ));
  });
  document.querySelectorAll('[data-auto-potion]').forEach((input) => {
    input.addEventListener('input', () => {
      const label = input.closest('label')?.querySelector('small');
      if (label) label.textContent = Number(input.value) > 0 ? `${input.value}% 이하` : '사용 안 함';
    });
    input.addEventListener('change', () => saveAutoPotionThreshold(
      input.dataset.autoPotion,
      input.value
    ));
  });
  document.querySelector('[data-open-potion-config]')?.addEventListener('click', () => openFeature('potion-config'));
}

function bindMailControls() {
  document.querySelectorAll('[data-claim-mail]').forEach((button) => {
    button.addEventListener('click', () => claimMailItem(button.dataset.claimMail));
  });
  document.querySelector('[data-claim-all-mail]')?.addEventListener('click', claimAllMailItems);
}

function shopBody() {
  const category = state.inventory.categories[state.shop.tab] || { items: [] };
  const sellable = (category.items || []).filter((item) => (
    Number(item.sellPrice) > 0
    || (
      item.itemType === 'ammunition'
      && item.ammunitionType === 'throwing-star'
      && Number(item.quantity) < Number(item.maxStack)
    )
  ));
  return `<div class="field-shop">
    <header><div><span>HOI SUPPLY</span><strong>사내 보급 상점</strong></div><b>보유 ${formatNumber(state.shop.money)}원</b></header>
    <div class="field-shop-columns">
      <section>
        <h3>구매</h3>
        <div class="shop-item-list">
          ${(state.shop.buyItems || []).map((item) => `<article>
            <span>${escapeHtml(item.icon)}</span>
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><b>${formatNumber(item.buyPrice)}원</b></div>
            <input type="number" min="1" max="10000" value="1" inputmode="numeric" data-shop-buy-quantity="${escapeHtml(item.id)}">
            <button type="button" data-shop-buy="${escapeHtml(item.id)}">구매</button>
          </article>`).join('')}
        </div>
      </section>
      <section>
        <h3>판매</h3>
        <div class="shop-inventory-tabs">
          ${INVENTORY_TAB_ORDER.map((key) => `<button type="button" data-shop-tab="${key}" class="${key === state.shop.tab ? 'is-active' : ''}">${escapeHtml(state.inventory.categories[key]?.label || key)}</button>`).join('')}
        </div>
        <div class="shop-item-list">
          ${sellable.length ? sellable.map((item) => `<article>
            <span>${escapeHtml(item.icon)}</span>
            <div><strong>${escapeHtml(item.name)}</strong><small>${formatNumber(item.quantity)}개 보유</small><b>개당 ${formatNumber(item.sellPrice)}원</b></div>
            ${item.itemType === 'ammunition' && item.ammunitionType === 'throwing-star' && Number(item.quantity) < Number(item.maxStack)
              ? `<span class="shop-recharge-note">${formatNumber(item.quantity)} / ${formatNumber(item.maxStack)} · 4,000원</span>
                 <button type="button" data-shop-recharge-star="${escapeHtml(item.stackId)}">충전</button>`
              : `<input type="number" min="1" max="${Number(item.quantity) || 1}" value="1" inputmode="numeric" data-shop-sell-quantity="${escapeHtml(item.stackId)}">`}
            ${item.itemType === 'ammunition' && item.ammunitionType === 'throwing-star' && Number(item.quantity) < Number(item.maxStack)
              ? ''
              : `<button type="button" data-shop-sell="${escapeHtml(item.stackId)}">판매</button>`}
          </article>`).join('') : '<div class="empty-ledger"><b>판매할 수 있는 아이템이 없습니다.</b></div>'}
        </div>
      </section>
    </div>
  </div>`;
}

async function openFieldShop(shopId = '') {
  try {
    const query = shopId ? `?shopId=${encodeURIComponent(shopId)}` : '';
    const data = await request(`/api/v2/shop${query}`);
    state.shop.money = Number(data.shop?.money) || 0;
    state.shop.buyItems = data.shop?.buyItems || [];
    state.shop.shopId = data.shop?.shopId || shopId || '';
    setInventoryData(data.shop?.inventory);
    openFeature('shop');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function buyFieldShopItem(itemId) {
  const input = document.querySelector(`[data-shop-buy-quantity="${CSS.escape(itemId)}"]`);
  try {
    const data = await request('/api/v2/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ itemId, quantity: input?.value, shopId: state.shop.shopId })
    });
    state.shop.money = Number(data.money) || 0;
    setInventoryData(data.inventory);
    $('featureBody').innerHTML = shopBody();
    bindShopControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function sellFieldShopItem(stackId) {
  const input = document.querySelector(`[data-shop-sell-quantity="${CSS.escape(stackId)}"]`);
  try {
    const data = await request('/api/v2/shop/sell', {
      method: 'POST',
      body: JSON.stringify({ stackId, quantity: input?.value })
    });
    state.shop.money = Number(data.money) || 0;
    setInventoryData(data.inventory);
    $('featureBody').innerHTML = shopBody();
    bindShopControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function rechargeThrowingStar(stackId) {
  try {
    const data = await request('/api/v2/shop/recharge-throwing-star', {
      method: 'POST',
      body: JSON.stringify({ stackId })
    });
    state.shop.money = Number(data.money) || 0;
    setInventoryData(data.inventory);
    $('featureBody').innerHTML = shopBody();
    bindShopControls();
    setWorldActivity(`표창을 ${formatNumber(data.quantity)}개로 충전했습니다. (-4,000원)`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindShopControls() {
  document.querySelectorAll('[data-shop-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.shop.tab = button.dataset.shopTab;
      $('featureBody').innerHTML = shopBody();
      bindShopControls();
    });
  });
  document.querySelectorAll('[data-shop-buy]').forEach((button) => {
    button.addEventListener('click', () => buyFieldShopItem(button.dataset.shopBuy));
  });
  document.querySelectorAll('[data-shop-sell]').forEach((button) => {
    button.addEventListener('click', () => sellFieldShopItem(button.dataset.shopSell));
  });
  document.querySelectorAll('[data-shop-recharge-star]').forEach((button) => {
    button.addEventListener('click', () => rechargeThrowingStar(button.dataset.shopRechargeStar));
  });
}

function partyBody() {
  const party = state.partyState.party;
  const players = state.partyState.nearbyPlayers || [];
  if (party) {
    const memberIds = new Set(party.members.map((member) => String(member.userId)));
    const inviteTargets = players.filter((player) => !memberIds.has(String(player.userId)));
    const partyFull = party.members.length >= 6;
    return `<div class="party-sheet">
      <header><strong>현재 파티 ${party.members.length}/6</strong><small>같은 맵의 파티원과 함께 전투할 수 있습니다.</small></header>
      <button class="party-refresh-button" type="button" data-party-refresh>현재 맵 인원 새로고침</button>
      <div class="party-member-list">${party.members.map((member) => `<article>
        <div><b>${member.isLeader ? '👑 ' : ''}${escapeHtml(member.nickname)}</b><small>${member.isSelf ? '나' : '파티원'}</small></div>
        ${party.isLeader && !member.isSelf ? `<button type="button" data-party-kick="${escapeHtml(member.userId)}">추방</button>` : ''}
      </article>`).join('')}</div>
      ${party.isLeader ? `<section class="party-invite-panel">
        <strong>현재 맵 인원 초대</strong>
        ${partyFull ? '<p>파티 정원이 가득 찼습니다.</p>' : `<div class="party-member-list">${inviteTargets.length ? inviteTargets.map((player) => `<article>
          <div><b>${escapeHtml(player.nickname)}</b><small>${escapeHtml(player.activity || '대기 중')}</small></div>
          <button type="button" data-party-invite="${escapeHtml(player.userId)}">초대</button>
        </article>`).join('') : '<div class="empty-ledger"><b>추가로 초대할 사원이 없습니다.</b><p>같은 맵에 있는 미가입 사원만 표시됩니다.</p></div>'}</div>`}
      </section>` : ''}
      <button class="secondary-action" type="button" data-party-leave>파티 탈퇴</button>
    </div>`;
  }
  return `<div class="party-sheet">
    <header><strong>같은 맵의 사원</strong><small>상대가 수락하면 파티가 만들어집니다.</small></header>
    <button class="party-refresh-button" type="button" data-party-refresh>현재 맵 인원 새로고침</button>
    <div class="party-member-list">${players.length ? players.map((player) => `<article>
      <div><b>${escapeHtml(player.nickname)}</b><small>${escapeHtml(player.activity || '대기 중')}</small></div>
      <button type="button" data-party-invite="${escapeHtml(player.userId)}">초대</button>
    </article>`).join('') : '<div class="empty-ledger"><b>초대할 사원이 없습니다.</b><p>같은 맵에 있는 사원만 표시됩니다.</p></div>'}</div>
  </div>`;
}

function partyInviteBody() {
  const invitation = state.partyState.invitation;
  if (!invitation) return '<div class="empty-ledger"><b>파티 초대가 만료되었습니다.</b></div>';
  return `<div class="party-invite-card">
    <span>PARTY INVITATION</span>
    <strong>${escapeHtml(invitation.inviterNickname)}님의 파티 초대</strong>
    <p>30초 안에 수락하면 함께 전투할 수 있습니다.</p>
    <div><button type="button" data-party-accept="${escapeHtml(invitation.id)}">수락</button>
    <button class="secondary-action" type="button" data-party-decline="${escapeHtml(invitation.id)}">거절</button></div>
  </div>`;
}

function tradeBody() {
  const session = state.tradeState.session;
  if (!session) {
    const players = state.tradeState.nearbyPlayers || [];
    return `<div class="trade-sheet">
      <header><strong>같은 맵의 사원과 교환</strong><small>돈을 넘길 때 받는 쪽 금액에서 수수료 5%가 차감됩니다.</small></header>
      <div class="party-member-list">${players.length ? players.map((player) => `<article>
        <div><strong>${escapeHtml(player.nickname)}</strong><small>같은 맵 접속 중</small></div>
        <button type="button" data-trade-request="${escapeHtml(player.userId)}">교환 요청</button>
      </article>`).join('') : '<p>현재 같은 맵에 교환 가능한 사원이 없습니다.</p>'}</div>
    </div>`;
  }
  const offerableItems = (state.inventory.items || []).filter((item) => item.tradeable !== false);
  return `<div class="trade-sheet">
    <header><strong>${escapeHtml(session.partner?.nickname || '상대')}님과 교환</strong><small>양쪽 모두 교환 확정을 눌러야 완료됩니다.</small></header>
    <div class="trade-columns">
      <section>
        <h3>내 제안</h3>
        <label>교환할 돈<input type="number" min="0" step="1" value="${Number(session.myOffer?.money) || 0}" data-trade-money></label>
        <div class="trade-item-list">${offerableItems.length ? offerableItems.map((item) => `<label>
          <input type="checkbox" data-trade-item="${escapeHtml(item.stackId)}">
          <span>${escapeHtml(item.icon)} ${escapeHtml(item.name)} ×${formatNumber(item.quantity)}</span>
          <input type="number" min="1" max="${Number(item.quantity) || 1}" value="1" data-trade-quantity="${escapeHtml(item.stackId)}">
        </label>`).join('') : '<p>교환할 아이템이 없습니다.</p>'}</div>
        <button type="button" data-trade-save>제안 올리기</button>
      </section>
      <section>
        <h3>상대 제안</h3>
        <strong>${formatNumber(session.partnerOffer?.money)}원</strong>
        <div class="trade-partner-items">${session.partnerOffer?.items?.length
          ? session.partnerOffer.items.map((item) => `<span>${escapeHtml(item.name || item.itemId || item.stackId)} ×${formatNumber(item.quantity)}</span>`).join('')
          : '<span>등록된 아이템 없음</span>'}</div>
        <p>${session.partnerOffer?.confirmed ? '상대가 교환을 확정했습니다.' : '상대 확인 대기 중'}</p>
      </section>
    </div>
    <div class="trade-actions">
      <button type="button" data-trade-confirm>${session.myOffer?.confirmed ? '확정 완료' : '교환 확정'}</button>
      <button class="secondary-action" type="button" data-trade-cancel>교환 취소</button>
    </div>
  </div>`;
}

function tradeInviteBody() {
  const tradeRequest = state.tradeState.request;
  if (!tradeRequest) return '<div class="empty-ledger"><b>대기 중인 교환 요청이 없습니다.</b></div>';
  return `<div class="party-invite-card">
    <span>TRADE REQUEST</span>
    <strong>${escapeHtml(tradeRequest.inviterNickname)}님의 교환 요청</strong>
    <p>수락하면 두 플레이어가 교환 창으로 이동합니다. 돈 교환 수수료는 5%입니다.</p>
    <div><button type="button" data-trade-respond="true">수락</button>
    <button class="secondary-action" type="button" data-trade-respond="false">거절</button></div>
  </div>`;
}

async function refreshTrade(openAfter = false) {
  try {
    state.tradeState = await request('/api/v2/trade');
    if (openAfter) openFeature('trade');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function tradeRequest(path, body = {}) {
  try {
    const data = await request(`/api/v2/trade/${path}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (data.session !== undefined || data.request !== undefined) {
      state.tradeState = { ...state.tradeState, ...data };
    }
    if (data.character) state.character = data.character;
    if (data.inventory) setInventoryData(data.inventory);
    if (path === 'cancel' || data.completed) {
      closeFeature();
      setWorldActivity(data.completed ? '교환이 완료되었습니다.' : '교환을 취소했습니다.');
      return;
    }
    $('featureBody').innerHTML = tradeBody();
    bindTradeControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindTradeControls() {
  document.querySelectorAll('[data-trade-request]').forEach((button) => {
    button.addEventListener('click', () => tradeRequest('request', { targetId: button.dataset.tradeRequest }));
  });
  document.querySelectorAll('[data-trade-respond]').forEach((button) => {
    button.addEventListener('click', () => tradeRequest('respond', {
      requestId: state.tradeState.request?.id,
      accepted: button.dataset.tradeRespond === 'true'
    }));
  });
  document.querySelector('[data-trade-save]')?.addEventListener('click', () => {
    const items = [...document.querySelectorAll('[data-trade-item]:checked')].map((input) => ({
      stackId: input.dataset.tradeItem,
      quantity: document.querySelector(`[data-trade-quantity="${CSS.escape(input.dataset.tradeItem)}"]`)?.value || 1
    }));
    tradeRequest('offer', {
      money: document.querySelector('[data-trade-money]')?.value || 0,
      items
    });
  });
  document.querySelector('[data-trade-confirm]')?.addEventListener('click', () => tradeRequest('confirm'));
  document.querySelector('[data-trade-cancel]')?.addEventListener('click', () => tradeRequest('cancel'));
}

async function refreshParty(openAfter = false) {
  try {
    state.partyState = await request('/api/v2/party');
    if (openAfter) openFeature('party');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function partyRequest(path, body = {}) {
  try {
    const data = await request(`/api/v2/party/${path}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    state.partyState = { ...state.partyState, ...data };
    if (!data.invitation) state.lastPartyInvitationId = '';
    if (path === 'accept' || path === 'decline') closeFeature();
    else {
      $('featureBody').innerHTML = partyBody();
      bindPartyControls();
    }
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindPartyControls() {
  document.querySelectorAll('[data-party-invite]').forEach((button) => {
    button.addEventListener('click', () => partyRequest('invite', { targetId: button.dataset.partyInvite }));
  });
  document.querySelectorAll('[data-party-kick]').forEach((button) => {
    button.addEventListener('click', () => partyRequest('kick', { targetId: button.dataset.partyKick }));
  });
  document.querySelector('[data-party-leave]')?.addEventListener('click', () => partyRequest('leave'));
  document.querySelector('[data-party-refresh]')?.addEventListener('click', () => refreshParty(true));
  document.querySelector('[data-party-accept]')?.addEventListener('click', (event) => (
    partyRequest('accept', { invitationId: event.currentTarget.dataset.partyAccept })
  ));
  document.querySelector('[data-party-decline]')?.addEventListener('click', (event) => (
    partyRequest('decline', { invitationId: event.currentTarget.dataset.partyDecline })
  ));
}

const featureMeta = {
  stats: { code: '01 / STATUS', title: '스탯' },
  inventory: { code: '02 / INVENTORY', title: '인벤토리' },
  equipment: { code: '03 / EQUIPMENT', title: '장비' },
  skills: { code: '04 / SKILLS', title: '스킬' },
  shop: { code: '05 / SUPPLY', title: '상점' },
  cash: { code: '06 / CASH SHOP', title: '캐쉬상점' },
  company: { code: '07 / COMPANY', title: '회사 운영' },
  boss: { code: '08 / RAID', title: '보스' },
  stock: { code: '09 / MARKET', title: '주식' },
  party: { code: '10 / PARTY', title: '파티' },
  'party-invite': { code: 'PARTY / INVITE', title: '파티 초대' },
  trade: { code: '11 / TRADE', title: '사원 교환' },
  ranking: { code: '12 / RANKING', title: '사원 랭킹' },
  marketplace: { code: '13 / MARKETPLACE', title: '사내 거래소' },
  'world-map': { code: '14 / MAP', title: '사내 지도' },
  'patch-notes': { code: '15 / PATCH NOTES', title: '패치노트' },
  'trade-invite': { code: 'TRADE / INVITE', title: '교환 요청' },
  quest: { code: 'QUEST / HR', title: '전직 퀘스트' },
  move: { code: 'MAP / MOVE', title: '이동 목적지' },
  mail: { code: 'ADMIN / MAIL', title: '우편함' },
  event: { code: 'EVENT / SETTLEMENT', title: '정착 지원 이벤트' },
  enhancement: { code: 'EQUIPMENT / ENHANCE', title: '장비 강화' },
  'potion-config': { code: 'QUICK / POTION', title: '포션 설정' }
};

const EQUIPMENT_TABS = Object.freeze({
  weapon: {
    label: '무기',
    slots: [
      { key: 'weapon', label: '무기', code: 'WEAPON' },
      { key: 'shield', label: '방패', code: 'SHIELD' }
    ]
  },
  armor: {
    label: '방어구',
    slots: [
      { key: 'helmet', label: '투구', code: 'HELMET' },
      { key: 'gloves', label: '장갑', code: 'GLOVES' },
      { key: 'shoes', label: '신발', code: 'SHOES' },
      { key: 'cape', label: '망토', code: 'CAPE' },
      { key: 'top', label: '상의', code: 'TOP' },
      { key: 'bottom', label: '하의', code: 'BOTTOM' }
    ]
  },
  accessory: {
    label: '장신구',
    slots: [
      { key: 'necklace', label: '목걸이', code: 'NECKLACE' },
      { key: 'ring', label: '반지', code: 'RING' },
      { key: 'earrings', label: '귀걸이', code: 'EARRINGS' }
    ]
  }
});

const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  cape: ['cape', 'cloak', 'mantle']
});

function getEquippedItem(loadout = {}, slotKey = '') {
  const aliases = EQUIPMENT_SLOT_ALIASES[slotKey] || [slotKey];
  return aliases.map((key) => loadout[key]).find(Boolean) || null;
}

function equipmentStatText(item) {
  const stats = item?.stats && typeof item.stats === 'object'
    ? Object.entries(item.stats).filter(([, value]) => Number(value))
    : [];
  return stats.length
    ? stats.map(([key, value]) => `${escapeHtml(ITEM_STAT_LABELS[key] || key)} +${formatNumber(value)}`).join(' · ')
    : '장비 능력치 정보 없음';
}

function equipmentDisplayName(item) {
  const level = Math.max(0, Number(item?.enhancement?.level) || 0);
  return `${item?.name || '미장착'}${level ? ` +${level}` : ''}`;
}

function isClientScrollApplicable(scroll, equipment) {
  if (!scroll || scroll.itemType !== 'equipment-scroll' || !equipment) return false;
  if (scroll.specialEquipmentId) return scroll.specialEquipmentId === equipment.itemId;
  if (scroll.applicableSlot && scroll.applicableSlot !== equipment.equipmentSlot) return false;
  return !scroll.applicableWeaponType || scroll.applicableWeaponType === equipment.weaponType;
}

function equipmentBody() {
  const activeTab = EQUIPMENT_TABS[state.equipmentTab] || EQUIPMENT_TABS.weapon;
  const loadout = state.character?.equipmentLoadout || {};
  const tabs = Object.entries(EQUIPMENT_TABS).map(([key, tab]) => (
    `<button class="equipment-tab ${key === state.equipmentTab ? 'is-active' : ''}" type="button" data-equipment-tab="${key}">${tab.label}</button>`
  )).join('');
  const slots = activeTab.slots.map((slot) => {
    const item = getEquippedItem(loadout, slot.key);
    return `<article class="equipment-slot ${item ? 'is-equipped' : 'is-empty'}">
      <div class="equipment-slot-code"><span>${slot.code}</span><b>${slot.label}</b></div>
      <div class="equipment-slot-item">
        <strong>${escapeHtml(equipmentDisplayName(item))}</strong>
        <small>${item ? equipmentStatText(item) : '현재 장착한 장비가 없습니다.'}</small>
      </div>
      <i>${item ? 'EQUIPPED' : 'EMPTY'}</i>
      ${item ? `<button type="button" data-unequip-equipment="${slot.key}">해제</button>` : ''}
    </article>`;
  }).join('');
  return `<div class="equipment-sheet">
    <div class="equipment-tabs" role="tablist">${tabs}</div>
    <div class="equipment-slots">${slots}</div>
    <div class="equipment-actions">
      <button type="button" data-open-enhancement ${Object.values(loadout).some(Boolean) ? '' : 'disabled'}>장비 강화</button>
    </div>
    <p class="notice-line">장비는 인벤토리 장비 탭에서 장착합니다. 강화는 현재 장착 중인 장비에만 가능합니다.</p>
  </div>`;
}

function enhancementBody() {
  const loadout = state.character?.equipmentLoadout || {};
  const equipped = Object.entries(loadout).filter(([, item]) => item?.itemId);
  if (!equipped.length) {
    return '<div class="empty-ledger"><b>장착 중인 장비가 없습니다.</b><p>장비를 장착한 뒤 강화할 수 있습니다.</p></div>';
  }
  if (!equipped.some(([slot]) => slot === state.enhancementSlot)) {
    state.enhancementSlot = equipped[0][0];
  }
  const selected = loadout[state.enhancementSlot];
  const enhancement = selected.enhancement || {
    level: 0,
    remaining: selected.upgradeSlots || 0,
    maximum: selected.upgradeSlots || 0,
    bonusStats: {}
  };
  const scrolls = (state.inventory.items || []).filter(
    (item) => item.itemType === 'equipment-scroll' && isClientScrollApplicable(item, selected)
  );
  if (!scrolls.some((item) => item.stackId === state.enhancementScrollStackId)) {
    state.enhancementScrollStackId = '';
  }
  const bonusText = Object.entries(enhancement.bonusStats || {})
    .filter(([, value]) => Number(value))
    .map(([key, value]) => `${ITEM_STAT_LABELS[key] || key} +${formatNumber(value)}`)
    .join(' · ') || '아직 강화로 증가한 능력치가 없습니다.';
  return `<div class="enhancement-sheet">
    <section>
      <h3>장착 장비 선택</h3>
      <div class="enhancement-equipment-list">
        ${equipped.map(([slot, item]) => `<button type="button"
          class="${slot === state.enhancementSlot ? 'is-selected' : ''}"
          data-enhancement-slot="${escapeHtml(slot)}">
          <b>${escapeHtml(equipmentDisplayName(item))}</b>
          <small>${escapeHtml(ITEM_SLOT_LABELS[slot] || slot)} · 업그레이드 ${formatNumber(item.enhancement?.remaining ?? item.upgradeSlots ?? 0)}회 남음</small>
        </button>`).join('')}
      </div>
    </section>
    <section class="enhancement-focus">
      <span>ENHANCEMENT TARGET</span>
      <h3>${escapeHtml(equipmentDisplayName(selected))}</h3>
      <p>${escapeHtml(equipmentStatText(selected))}</p>
      <p><b>강화 능력치 합계</b> ${escapeHtml(bonusText)}</p>
      <strong>남은 업그레이드 ${formatNumber(enhancement.remaining)} / ${formatNumber(enhancement.maximum)}</strong>
    </section>
    <section>
      <h3>사용 가능한 주문서</h3>
      <div class="enhancement-scroll-list">
        ${scrolls.length ? scrolls.map((scroll) => `<button type="button"
          class="${scroll.stackId === state.enhancementScrollStackId ? 'is-selected' : ''}"
          data-enhancement-scroll="${escapeHtml(scroll.stackId)}">
          <b>${escapeHtml(scroll.name)}</b>
          <small>${escapeHtml(scroll.description)} · ${formatNumber(scroll.quantity)}장</small>
        </button>`).join('') : '<p class="notice-line">이 장비에 적용 가능한 주문서를 보유하고 있지 않습니다.</p>'}
      </div>
    </section>
    <button class="enhancement-submit" type="button" data-submit-enhancement
      ${state.enhancementScrollStackId && enhancement.remaining > 0 ? '' : 'disabled'}>강화하기</button>
    <p class="notice-line">주문서는 성공과 실패에 관계없이 1장과 업그레이드 가능 횟수 1회를 소모합니다.</p>
  </div>`;
}

async function submitEnhancement() {
  try {
    const data = await request('/api/v2/equipment/enhance', {
      method: 'POST',
      body: JSON.stringify({
        slot: state.enhancementSlot,
        scrollStackId: state.enhancementScrollStackId
      })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    state.enhancementScrollStackId = '';
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = enhancementBody();
    bindEnhancementControls();
    setWorldActivity(data.enhancement.message);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindEnhancementControls() {
  document.querySelectorAll('[data-enhancement-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      state.enhancementSlot = button.dataset.enhancementSlot;
      state.enhancementScrollStackId = '';
      $('featureBody').innerHTML = enhancementBody();
      bindEnhancementControls();
    });
  });
  document.querySelectorAll('[data-enhancement-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      state.enhancementScrollStackId = button.dataset.enhancementScroll;
      $('featureBody').innerHTML = enhancementBody();
      bindEnhancementControls();
    });
  });
  document.querySelector('[data-submit-enhancement]')?.addEventListener('click', submitEnhancement);
}

function bindEquipmentTabs() {
  document.querySelectorAll('[data-equipment-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.equipmentTab = button.dataset.equipmentTab;
      $('featureBody').innerHTML = equipmentBody();
      bindEquipmentTabs();
    });
  });
  document.querySelectorAll('[data-unequip-equipment]').forEach((button) => {
    button.addEventListener('click', () => unequipCurrentWeapon(button.dataset.unequipEquipment));
  });
  document.querySelector('[data-open-enhancement]')?.addEventListener('click', () => openFeature('enhancement'));
}

function questBody() {
  const quest = state.character?.advancementQuest;
  if (!quest) {
    return '<div class="empty-ledger"><b>현재 진행 가능한 전직이 없습니다.</b><p>다음 전직 레벨에 도달하면 화면 옆에 퀘스트가 다시 나타납니다.</p></div>';
  }
  const departments = state.meta?.departments || [];
  const departmentGuide = quest.departmentSelectionRequired
    ? `<div class="department-options">${departments.map((department) => (
      `<button class="${state.selectedDepartmentId === department.id ? 'is-selected' : ''}" type="button" data-department-id="${escapeHtml(department.id)}">
        <strong>${escapeHtml(department.name)}</strong>
        <small>${escapeHtml(department.jobs?.[0] || '1차 전직')} · ${escapeHtml(department.archetype)}</small>
      </button>`
    )).join('')}</div>`
    : `<p class="quest-department">${escapeHtml(quest.departmentName)} · 다음 직급 <b>${escapeHtml(quest.nextJobName)}</b></p>`;
  return `
    <div class="quest-sheet">
      <div class="quest-rank"><span>TARGET</span><strong>${quest.targetTier}차 전직</strong><small>요구 레벨 ${quest.requiredLevel}</small></div>
      <div>
        <h3>인사 발령 심사</h3>
        <p>전직 퀘스트를 완료하면 새로운 직급과 스킬 포인트 1을 획득합니다.</p>
        ${departmentGuide}
        <button class="advancement-submit" type="button" data-complete-advancement
          ${quest.departmentSelectionRequired && !state.selectedDepartmentId ? 'disabled' : ''}>
          ${quest.targetTier}차 전직 완료
        </button>
        <p class="notice-line">전직 즉시 스킬 포인트 1을 받고, 현재 레벨·보직 기준 평균 HP/MP가 적용됩니다.</p>
      </div>
    </div>`;
}

async function completeAdvancement() {
  try {
    const data = await request('/api/v2/advancement', {
      method: 'POST',
      body: JSON.stringify({ departmentId: state.selectedDepartmentId })
    });
    state.character = data.character;
    state.selectedDepartmentId = '';
    renderGame({
      preview: state.preview,
      character: data.character,
      displayName: state.displayName
    });
    $('featureBody').innerHTML = questBody();
    bindQuestControls();
    setWorldActivity(`${data.advancement.jobName} 전직 완료 · 스킬 포인트 +1`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindQuestControls() {
  document.querySelectorAll('[data-department-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDepartmentId = button.dataset.departmentId;
      $('featureBody').innerHTML = questBody();
      bindQuestControls();
    });
  });
  document.querySelector('[data-complete-advancement]')?.addEventListener('click', completeAdvancement);
}

function statInvestmentControl(stat, availablePoints) {
  const disabled = Number(availablePoints) > 0 ? '' : 'disabled';
  const maximum = Math.max(1, Math.floor(Number(availablePoints) || 0));
  return `<div class="stat-investment-control">
    <label>
      <span>투자량</span>
      <input type="number" min="1" max="${maximum}" value="1" inputmode="numeric"
        data-stat-amount="${stat}" ${disabled}>
    </label>
    <button type="button" data-allocate-stat="${stat}" ${disabled}>투자</button>
  </div>`;
}

function statBody() {
  const character = state.character || {};
  const stats = character.stats || {};
  const progression = character.progression || {};
  const derived = character.derivedStats || {};
  const effectiveStats = derived.effectiveStats || stats;
  const equipmentBonuses = derived.equipmentStatBonuses || {};
  const statValue = (key) => (
    `${formatNumber(effectiveStats[key])}${Number(equipmentBonuses[key]) > 0
      ? ` <small>(기본 ${formatNumber(stats[key])} + 장비 ${formatNumber(equipmentBonuses[key])})</small>`
      : ''}`
  );
  const abilities = [
    ['공격력', `${formatNumber(derived.attackMinimum)} ~ ${formatNumber(derived.attackMaximum)}`],
    ['방어력', formatNumber(derived.defense)],
    ['마력', formatNumber(derived.magic)],
    ['명중률', formatNumber(derived.accuracy)],
    ['회피율', formatNumber(derived.evasion)],
    ['이동속도', `${formatNumber(derived.movementSpeed || 100)}%`]
  ];
  return `
    <div class="stat-overview">
      <section class="stat-primary">
        <div class="point-summary">
          <div class="stat-total"><span>사용 가능한 스탯 포인트</span><strong>${formatNumber(progression.unspentStatPoints)} P</strong></div>
          <div class="skill-total"><span>사용 가능한 스킬 포인트</span><strong>${formatNumber(progression.unspentSkillPoints)} SP</strong></div>
        </div>
        <div class="stat-grid">
          <article><span>맷집 / STR</span><strong>${statValue('grit')}</strong><small>물리 계열 주스탯 후보</small>${statInvestmentControl('grit', progression.unspentStatPoints)}</article>
          <article><span>처리속도 / DEX</span><strong>${statValue('processingSpeed')}</strong><small>명중·회피 및 원거리 계열</small>${statInvestmentControl('processingSpeed', progression.unspentStatPoints)}</article>
          <article><span>업무지식 / INT</span><strong>${statValue('workKnowledge')}</strong><small>마법 피해와 정신력 계열</small>${statInvestmentControl('workKnowledge', progression.unspentStatPoints)}</article>
          <article><span>눈치 / LUK</span><strong>${statValue('awareness')}</strong><small>도적 계열 및 회피 보조</small>${statInvestmentControl('awareness', progression.unspentStatPoints)}</article>
        </div>
      </section>
      <aside class="ability-panel">
        <div class="ability-heading"><span>COMBAT ABILITY</span><strong>능력치</strong></div>
        <div class="ability-list">
          ${abilities.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}
        </div>
      </aside>
    </div>
    <p class="notice-line">공격력·명중률·회피율은 현재 스탯과 장비를 기준으로 계산됩니다. 이동속도 기본값은 100%입니다.</p>`;
}

async function allocateStat(stat, amount = 1) {
  const investment = Math.max(1, Math.floor(Number(amount) || 1));
  try {
    const data = await request('/api/v2/stats/allocate', {
      method: 'POST',
      body: JSON.stringify({ allocations: { [stat]: investment } })
    });
    state.character = data.character;
    renderGame({
      preview: state.preview,
      character: data.character,
      displayName: state.displayName
    });
    $('featureBody').innerHTML = statBody();
    bindStatControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindStatControls() {
  document.querySelectorAll('[data-allocate-stat]').forEach((button) => {
    button.addEventListener('click', () => {
      const stat = button.dataset.allocateStat;
      const input = document.querySelector(`[data-stat-amount="${stat}"]`);
      allocateStat(stat, input?.value);
    });
  });
  document.querySelectorAll('[data-stat-amount]').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const stat = input.dataset.statAmount;
      allocateStat(stat, input.value);
    });
  });
}

function skillBody() {
  return buildSkillBody();
}

function legacyRankingBody() {
  const entries = state.ranking.tab === 'online'
    ? state.ranking.online
    : state.ranking.all;
  return `<div class="ranking-sheet">
    <div class="ranking-tabs">
      <button type="button" data-ranking-tab="all" class="${state.ranking.tab === 'all' ? 'is-active' : ''}">전체 레벨 랭킹</button>
      <button type="button" data-ranking-tab="online" class="${state.ranking.tab === 'online' ? 'is-active' : ''}">현재 온라인 유저</button>
    </div>
    <div class="ranking-list">${entries.length ? entries.map((entry) => `<article>
      <b>${formatNumber(entry.rank)}</b>
      <div><strong>${escapeHtml(entry.displayName)}</strong><small>${entry.online ? '온라인' : (entry.autoHunting ? '오프라인 자동사냥 중' : '오프라인')}</small></div>
      <span>Lv.${formatNumber(entry.level)}</span>
    </article>`).join('') : '<p>표시할 유저가 없습니다.</p>'}</div>
  </div>`;
}

function rankingBody() {
  const entries = state.ranking.tab === 'online'
    ? state.ranking.online
    : state.ranking.all;
  const entryHtml = entries.map((entry) => {
    const presenceLabel = entry.online ? '온라인' : (entry.autoHunting ? '오프라인 자동사냥 중' : '오프라인');
    const jobLabel = entry.jobName || entry.departmentName || '미전직';
    return `<article>
      <b>${formatNumber(entry.rank)}</b>
      <div class="ranking-profile">
        <strong>${escapeHtml(entry.displayName)}</strong>
        <small>${escapeHtml(jobLabel)}</small>
        <small>${escapeHtml(presenceLabel)}</small>
      </div>
      <span>Lv.${formatNumber(entry.level)}</span>
    </article>`;
  }).join('');
  return `<div class="ranking-sheet">
    <div class="ranking-tabs">
      <button type="button" data-ranking-tab="all" class="${state.ranking.tab === 'all' ? 'is-active' : ''}">레벨 순위</button>
      <button type="button" data-ranking-tab="online" class="${state.ranking.tab === 'online' ? 'is-active' : ''}">현재 온라인 유저</button>
    </div>
    <div class="ranking-list">${entries.length ? entryHtml : '<p>표시할 유저가 없습니다.</p>'}</div>
  </div>`;
}

async function refreshRanking(openAfter = false) {
  try {
    const data = await request('/api/v2/ranking');
    state.ranking.all = data.ranking || [];
    state.ranking.online = data.online || [];
    if (openAfter) openFeature('ranking');
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindRankingControls() {
  document.querySelectorAll('[data-ranking-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.ranking.tab = button.dataset.rankingTab;
      $('featureBody').innerHTML = rankingBody();
      bindRankingControls();
    });
  });
}

async function refreshSettlementEvent(openAfter = false) {
  try {
    const data = await request('/api/v2/event/settlement-support');
    state.eventState = data.event;
    if (data.inventory) setInventoryData(data.inventory);
    if (openAfter) openFeature('event');
    else if (!$('featureModal').classList.contains('hidden') && $('featureTitle').textContent === '정착 지원 이벤트') {
      $('featureBody').innerHTML = eventBody();
      bindEventControls();
    }
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function eventBody() {
  const event = state.eventState;
  if (!event) return '<div class="empty-ledger"><b>이벤트 정보를 불러오는 중입니다.</b></div>';
  return `<div class="event-sheet">
    <header>
      <span>2026.07.06 - 2026.07.31</span>
      <h3>기간제 정착 지원 이벤트</h3>
      <p>79레벨까지는 자신의 레벨 기준 ±10 범위 몬스터, 80레벨부터는 70레벨 이상 몬스터를 처치하고 이벤트 코인을 모아 보상과 교환하세요.</p>
    </header>
    <div class="event-balance">
      <b>보유 코인 ${formatNumber(event.coins)}개</b>
      <span>오늘 획득 ${formatNumber(event.dailyCoins)} / ${formatNumber(event.dailyCoinLimit)}</span>
    </div>
    <div class="event-shop-list">
      ${event.shopItems.map((item) => `<article>
        <div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></div>
        <span>${item.coinPrice > 0 ? `🪙 ${formatNumber(item.coinPrice)}` : '무료'}</span>
        <button type="button" data-event-buy="${escapeHtml(item.key)}"
          ${item.remainingToday === 0 || item.remainingTotal === 0 || event.coins < item.coinPrice || !event.active ? 'disabled' : ''}>
          ${item.remainingTotal === 0 ? '수령 완료' : (item.remainingToday === 0 ? '오늘 구매 완료' : (item.coinPrice > 0 ? '교환' : '무료 수령'))}
        </button>
      </article>`).join('')}
    </div>
    <p class="notice-line">이벤트 코인과 이벤트 전용 보상은 교환할 수 없습니다. 이벤트 코인 드랍 확률은 게임 화면에 공개되지 않습니다.</p>
  </div>`;
}

async function buySettlementEventItem(key) {
  try {
    const data = await request('/api/v2/event/settlement-support/buy', {
      method: 'POST',
      body: JSON.stringify({ key })
    });
    state.eventState = data.event;
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = eventBody();
    bindEventControls();
    setWorldActivity(`${data.purchased.name} 교환 완료`);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindEventControls() {
  document.querySelectorAll('[data-event-buy]').forEach((button) => {
    button.addEventListener('click', () => buySettlementEventItem(button.dataset.eventBuy));
  });
}

async function refreshMarketplace(openAfter = false) {
  try {
    const query = state.marketplace.search
      ? `?search=${encodeURIComponent(state.marketplace.search)}`
      : '';
    const data = await request(`/api/v2/marketplace${query}`);
    state.marketplace = {
      ...state.marketplace,
      listings: data.listings || [],
      mine: data.mine || [],
      rules: data.rules || {}
    };
    if (openAfter) openFeature('marketplace');
    else {
      $('featureBody').innerHTML = marketplaceBody();
      bindMarketplaceControls();
    }
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function marketplaceListingName(listing) {
  const enhancement = listing.equipmentSpec?.enhancement || listing.instanceData?.enhancement || {};
  const level = Math.max(0, Number(enhancement.level) || 0);
  const maximum = Math.max(0, Number(enhancement.maximum) || 0);
  const remaining = Math.max(0, Number(enhancement.remaining ?? maximum) || 0);
  const attempted = level > 0 || (maximum > 0 && remaining < maximum);
  return `${listing.itemName}${attempted ? ` (+${level})` : ''}`;
}

function marketplaceEquipmentSpecHtml(listing) {
  const spec = listing.equipmentSpec;
  if (!spec) return '';
  const requirements = spec.requirements || {};
  const requiredLevel = Number(requirements.level ?? spec.requiredLevel) || 1;
  const allowed = (requirements.allowedArchetypes || [])
    .map((archetype) => ITEM_ARCHETYPE_LABELS[archetype] || archetype)
    .join('/');
  const requirementStats = Object.entries(requirements.stats || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${ITEM_STAT_LABELS[key] || key} ${formatNumber(value)}`)
    .join(' · ') || '없음';
  const stats = Object.entries(spec.stats || {})
    .filter(([, value]) => Number(value))
    .map(([key, value]) => `${ITEM_STAT_LABELS[key] || key} +${formatNumber(value)}`)
    .join(' · ') || '없음';
  const enhancement = spec.enhancement || {};
  const remaining = Number(enhancement.remaining ?? spec.upgradeSlots ?? 0) || 0;
  return `<div class="market-equipment-spec">
    <span>부위 ${escapeHtml(ITEM_SLOT_LABELS[spec.equipmentSlot] || spec.equipmentSlot || '-')}</span>
    <span>레벨 ${formatNumber(requiredLevel)}</span>
    <span>직업 ${escapeHtml(allowed || '전 직업')}</span>
    <span>요구 ${escapeHtml(requirementStats)}</span>
    <span>스탯 ${escapeHtml(stats)}</span>
    <span>업그레이드 ${formatNumber(remaining)}회 남음</span>
  </div>`;
}

function marketplaceBody() {
  const market = state.marketplace;
  const registerable = (state.inventory.items || []).filter(
    (item) => ['equipment', 'consumable', 'misc'].includes(item.category) && item.tradeable !== false
  );
  const statusLabel = {
    active: '판매 중',
    sold: '판매 완료 · 정산 대기',
    expired: '만료 · 회수 대기',
    cancelled: '판매 취소'
  };
  return `<div class="marketplace-sheet">
    <header class="marketplace-toolbar">
      <div><h3>사내 거래소</h3><p>등록 수수료 1% · 판매 정산 수수료 3% · 등록 후 48시간 유지</p></div>
      <button type="button" data-market-settle>판매 정산 / 만료 회수</button>
    </header>
    <section class="market-register">
      <h3>물품 등록</h3>
      <select data-market-stack>
        <option value="">등록할 아이템 선택</option>
        ${registerable.map((item) => `<option value="${escapeHtml(item.stackId)}">${escapeHtml(equipmentDisplayName(item))} ×${formatNumber(item.quantity)}</option>`).join('')}
      </select>
      <input data-market-quantity type="number" min="1" value="1" aria-label="등록 수량">
      <input data-market-price type="number" min="1" placeholder="개당 판매 가격" aria-label="개당 판매 가격">
      <button type="button" data-market-register>등록</button>
    </section>
    <section class="market-search">
      <input data-market-search type="search" value="${escapeHtml(market.search)}" placeholder="아이템 이름 검색">
      <button type="button" data-market-search-submit>검색</button>
      <button type="button" data-market-search-reset>초기화</button>
    </section>
    <section>
      <h3>최근 등록 물품</h3>
      <div class="market-list">
        ${market.listings.length ? market.listings.map((listing) => `<article>
          <span class="market-icon">${escapeHtml(listing.itemIcon)}</span>
          <div><strong>${escapeHtml(marketplaceListingName(listing))}</strong><small>${formatNumber(listing.quantity)}개 · ${new Date(listing.createdAt).toLocaleString('ko-KR')} 등록</small>${marketplaceEquipmentSpecHtml(listing)}</div>
          <b>${formatNumber(listing.totalPrice)}원</b>
          <button type="button" data-market-buy="${escapeHtml(listing.id)}">구매</button>
        </article>`).join('') : '<p class="notice-line">검색 조건에 맞는 판매 물품이 없습니다.</p>'}
      </div>
    </section>
    <section>
      <h3>내 등록 물품</h3>
      <div class="market-list is-mine">
        ${market.mine.length ? market.mine.map((listing) => `<article>
          <span class="market-icon">${escapeHtml(listing.itemIcon)}</span>
          <div><strong>${escapeHtml(marketplaceListingName(listing))}</strong><small>${escapeHtml(statusLabel[listing.status] || listing.status)} · ${new Date(listing.expiresAt).toLocaleString('ko-KR')}까지</small>${marketplaceEquipmentSpecHtml(listing)}</div>
          <b>${formatNumber(listing.status === 'sold' ? listing.sellerProceeds : listing.totalPrice)}원</b>
          ${listing.status === 'active' ? `<button type="button" data-market-cancel="${escapeHtml(listing.id)}">판매 취소</button>` : ''}
        </article>`).join('') : '<p class="notice-line">등록하거나 정산할 물품이 없습니다.</p>'}
      </div>
    </section>
  </div>`;
}

async function registerMarketplaceItem() {
  const stackId = document.querySelector('[data-market-stack]')?.value || '';
  const quantity = Number(document.querySelector('[data-market-quantity]')?.value || 1);
  const pricePerItem = Number(document.querySelector('[data-market-price]')?.value || 0);
  try {
    const data = await request('/api/v2/marketplace/list', {
      method: 'POST',
      body: JSON.stringify({ stackId, quantity, pricePerItem })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    setWorldActivity(`${data.listing.itemName} 거래소 등록 완료`);
    await refreshMarketplace();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function buyMarketplaceItem(listingId) {
  if (!window.confirm('이 물품을 구매할까요?')) return;
  try {
    const data = await request('/api/v2/marketplace/buy', {
      method: 'POST',
      body: JSON.stringify({ listingId })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    setWorldActivity(`${data.listing.itemName} 구매 완료`);
    await refreshMarketplace();
  } catch (err) {
    setWorldActivity(err.message);
    await refreshMarketplace();
  }
}

async function cancelMarketplaceItem(listingId) {
  if (!window.confirm('판매 등록을 취소하고 아이템을 회수할까요? 등록 수수료는 반환되지 않습니다.')) return;
  try {
    const data = await request('/api/v2/marketplace/cancel', {
      method: 'POST',
      body: JSON.stringify({ listingId })
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    setWorldActivity(`${data.listing.itemName} 판매 등록을 취소했습니다.`);
    await refreshMarketplace();
  } catch (err) {
    setWorldActivity(err.message);
    await refreshMarketplace();
  }
}

async function settleMarketplace() {
  try {
    const data = await request('/api/v2/marketplace/settle', {
      method: 'POST',
      body: JSON.stringify({})
    });
    state.character = data.character;
    setInventoryData(data.inventory);
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    setWorldActivity(`거래소 정산 ${formatNumber(data.proceeds)}원 · 만료 물품 ${formatNumber(data.returnedCount)}개 회수`);
    await refreshMarketplace();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindMarketplaceControls() {
  document.querySelector('[data-market-register]')?.addEventListener('click', registerMarketplaceItem);
  document.querySelectorAll('[data-market-buy]').forEach((button) => {
    button.addEventListener('click', () => buyMarketplaceItem(button.dataset.marketBuy));
  });
  document.querySelectorAll('[data-market-cancel]').forEach((button) => {
    button.addEventListener('click', () => cancelMarketplaceItem(button.dataset.marketCancel));
  });
  document.querySelector('[data-market-settle]')?.addEventListener('click', settleMarketplace);
  const search = document.querySelector('[data-market-search]');
  const runSearch = () => {
    state.marketplace.search = String(search?.value || '').trim();
    refreshMarketplace();
  };
  document.querySelector('[data-market-search-submit]')?.addEventListener('click', runSearch);
  search?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runSearch();
  });
  document.querySelector('[data-market-search-reset]')?.addEventListener('click', () => {
    state.marketplace.search = '';
    refreshMarketplace();
  });
}

function worldMapBody() {
  const maps = (state.maps || []).filter((map) => !map.hidden);
  if (!maps.length) {
    return '<div class="empty-ledger"><b>지도를 불러오지 못했습니다.</b><p>잠시 뒤 다시 시도해주세요.</p></div>';
  }
  const visibleIds = new Set(maps.map((map) => map.id));
  const groups = maps.reduce((acc, map) => {
    const region = map.region || '미분류 구역';
    if (!acc[region]) acc[region] = [];
    acc[region].push(map);
    return acc;
  }, {});
  return `<div class="world-map-sheet">
    <p class="notice-line">히든 스트리트와 필드보스 출현 맵은 지도에 표시되지 않습니다.</p>
    ${Object.entries(groups).map(([region, regionMaps]) => `<section class="world-map-region">
      <h3>${escapeHtml(region)}</h3>
      <div class="world-map-grid">
        ${regionMaps.map((map) => {
          const links = (map.connections || [])
            .filter((connection) => visibleIds.has(connection.targetId))
            .map((connection) => {
              const target = maps.find((entry) => entry.id === connection.targetId);
              return target ? target.name : connection.targetId;
            });
          return `<article class="world-map-card ${map.safeZone ? 'is-safe' : ''}">
            <span>${map.safeZone ? 'SAFE ZONE' : 'FIELD'}</span>
            <strong>${escapeHtml(map.name)}</strong>
            <small>${links.length ? escapeHtml(links.join(' · ')) : '연결된 일반 맵 없음'}</small>
          </article>`;
        }).join('')}
      </div>
    </section>`).join('')}
  </div>`;
}

function buildIllustratedWorldMapPositions(maps) {
  const anchors = [
    { x: 168, y: 315, rx: 104, ry: 78 },
    { x: 292, y: 190, rx: 104, ry: 72 },
    { x: 436, y: 300, rx: 112, ry: 82 },
    { x: 582, y: 188, rx: 104, ry: 72 },
    { x: 696, y: 328, rx: 94, ry: 72 },
    { x: 504, y: 420, rx: 118, ry: 60 }
  ];
  const regionNames = [...new Set(maps.map((map) => map.region || 'ETC'))];
  const grouped = maps.reduce((acc, map) => {
    const region = map.region || 'ETC';
    if (!acc[region]) acc[region] = [];
    acc[region].push(map);
    return acc;
  }, {});
  const positions = new Map();
  regionNames.forEach((region, regionIndex) => {
    const anchor = anchors[regionIndex % anchors.length];
    const regionMaps = grouped[region] || [];
    regionMaps.forEach((map, index) => {
      if (map.safeZone) {
        positions.set(map.id, { x: anchor.x, y: anchor.y, regionIndex, index });
        return;
      }
      const angle = (Math.PI * 2 * index / Math.max(1, regionMaps.length)) - Math.PI / 2;
      const radiusScale = regionMaps.length <= 4 ? .75 : 1;
      positions.set(map.id, {
        x: anchor.x + Math.cos(angle) * anchor.rx * radiusScale,
        y: anchor.y + Math.sin(angle) * anchor.ry * radiusScale,
        regionIndex,
        index
      });
    });
  });
  return { positions, grouped, regionNames };
}

function worldMapBodyIllustrated() {
  const maps = (state.maps || []).filter((map) => !map.hidden);
  if (!maps.length) return worldMapBody();
  const visibleIds = new Set(maps.map((map) => map.id));
  const byId = new Map(maps.map((map) => [map.id, map]));
  const { positions, grouped, regionNames } = buildIllustratedWorldMapPositions(maps);
  const paths = [];
  maps.forEach((map) => {
    const from = positions.get(map.id);
    if (!from) return;
    (map.connections || []).forEach((connection) => {
      if (!visibleIds.has(connection.targetId) || map.id > connection.targetId) return;
      const to = positions.get(connection.targetId);
      if (!to) return;
      paths.push(`<path class="world-map-route" d="M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y - 34}, ${(from.x + to.x) / 2} ${to.y + 34}, ${to.x} ${to.y}" />`);
    });
  });
  const nodes = maps.map((map) => {
    const position = positions.get(map.id);
    const isCurrent = map.id === state.currentMapId;
    const isSafe = Boolean(map.safeZone);
    const label = (isSafe || isCurrent)
      ? `<text x="${position.x}" y="${position.y - 18}" text-anchor="middle">${escapeHtml(map.name)}</text>`
      : '';
    return `<g class="world-map-node ${isSafe ? 'is-safe' : 'is-field'} ${isCurrent ? 'is-current' : ''}">
      <circle cx="${position.x}" cy="${position.y}" r="${isSafe ? 13 : 7}" />
      ${label}
      <title>${escapeHtml(map.name)}</title>
    </g>`;
  }).join('');
  const regionLabels = regionNames.map((region) => {
    const safeMap = (grouped[region] || []).find((map) => map.safeZone) || grouped[region]?.[0];
    const position = safeMap ? positions.get(safeMap.id) : null;
    if (!position) return '';
    return `<text class="world-map-region-label" x="${position.x}" y="${position.y + 34}" text-anchor="middle">${escapeHtml(region)}</text>`;
  }).join('');
  const regionCards = Object.entries(grouped).map(([region, regionMaps]) => `<section class="world-map-region">
    <h3>${escapeHtml(region)}</h3>
    <div class="world-map-grid">
      ${regionMaps.map((map) => {
        const links = (map.connections || [])
          .filter((connection) => visibleIds.has(connection.targetId))
          .map((connection) => byId.get(connection.targetId)?.name || connection.targetId);
        return `<article class="world-map-card ${map.safeZone ? 'is-safe' : ''} ${map.id === state.currentMapId ? 'is-current' : ''}">
          <span>${map.safeZone ? 'SAFE ZONE' : 'FIELD'}</span>
          <strong>${escapeHtml(map.name)}</strong>
          <small>${links.length ? escapeHtml(links.join(' · ')) : 'No public route'}</small>
        </article>`;
      }).join('')}
    </div>
  </section>`).join('');
  return `<div class="world-map-sheet">
    <div class="world-map-illustration" role="img" aria-label="World map">
      <svg viewBox="0 0 860 540" preserveAspectRatio="xMidYMid meet">
        <rect class="world-map-sea" width="860" height="540" rx="22" />
        <path class="world-map-cloud cloud-a" d="M0 70 C50 18 100 42 132 22 C178 -8 230 12 252 50 C312 36 350 58 370 94 L0 112 Z" />
        <path class="world-map-cloud cloud-b" d="M860 455 C812 510 762 482 724 512 C674 548 610 520 594 478 C546 488 502 466 488 430 L860 414 Z" />
        <path class="world-map-island island-shadow" d="M92 308 C62 212 138 116 246 96 C358 74 454 116 528 88 C646 44 780 122 796 244 C810 352 726 444 594 444 C494 444 424 488 312 456 C206 426 124 406 92 308 Z" />
        <path class="world-map-island" d="M82 296 C54 210 132 126 242 104 C356 80 454 124 532 96 C638 58 762 126 780 244 C798 346 712 428 592 426 C492 424 424 474 318 442 C216 412 112 390 82 296 Z" />
        <path class="world-map-river" d="M274 112 C298 180 274 236 322 294 C374 358 338 406 286 446" />
        <path class="world-map-river" d="M560 100 C532 160 578 216 548 282 C516 354 574 392 646 426" />
        ${paths.join('')}
        ${nodes}
        ${regionLabels}
      </svg>
      <div class="world-map-legend"><span><i class="safe"></i>Safe Zone</span><span><i class="field"></i>Field</span><span><i class="current"></i>Current</span></div>
    </div>
    <p class="notice-line">Hidden streets and field boss maps are not shown on the public map.</p>
    ${regionCards}
  </div>`;
}

function worldMapOfficeBody() {
  const maps = (state.maps || []).filter((map) => !map.hidden);
  if (!maps.length) return worldMapBody();
  const byId = new Map(maps.map((map) => [map.id, map]));
  const groups = maps.reduce((acc, map) => {
    const region = map.region || '기타 구역';
    if (!acc[region]) acc[region] = [];
    acc[region].push(map);
    return acc;
  }, {});
  const rooms = Object.entries(groups).map(([region, regionMaps], regionIndex) => {
    const mapButtons = regionMaps.map((map, mapIndex) => {
      const isCurrent = map.id === state.currentMapId;
      const route = findMapTravelRoute(state.currentMapId, map.id);
      const accessible = isCurrent || route.length > 1;
      const links = (map.connections || [])
        .filter((connection) => byId.has(connection.targetId))
        .map((connection) => byId.get(connection.targetId)?.name || connection.targetId);
      const tooltip = `${map.name}${links.length ? ` · 연결: ${links.join(', ')}` : ''}`;
      return `<button class="office-map-destination ${map.safeZone ? 'is-safe' : 'is-field'} ${isCurrent ? 'is-current' : ''}"
        type="button" data-map-travel="${escapeHtml(map.id)}" title="${escapeHtml(tooltip)}"
        ${accessible && !isCurrent ? '' : 'disabled'}>
        <span class="office-map-index">${String(regionIndex + 1).padStart(2, '0')}-${String(mapIndex + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(map.name)}</strong>
        <small>${isCurrent ? '현재 위치' : (map.safeZone ? '안전지대 · 자동 이동' : '사냥터 · 자동 이동')}</small>
        <span class="office-map-tooltip" role="tooltip">${escapeHtml(tooltip)}</span>
      </button>`;
    }).join('');
    return `<section class="office-map-room">
      <header><span>DEPARTMENT ${String(regionIndex + 1).padStart(2, '0')}</span><h3>${escapeHtml(region)}</h3></header>
      <div class="office-map-room-list">${mapButtons}</div>
    </section>`;
  }).join('');
  return `<div class="world-map-sheet office-world-map">
    <div class="office-map-heading">
      <div><span>HOI COMPANY / FLOOR DIRECTORY</span><h2>사내 이동 안내도</h2></div>
      <p>맵을 누르면 현재 위치에서 최단 경로의 포탈을 차례로 통과합니다.</p>
    </div>
    <div class="office-map-legend">
      <span><i class="safe"></i>안전지대</span><span><i class="field"></i>사냥터</span><span><i class="current"></i>현재 위치</span>
    </div>
    <div class="office-floorplan">${rooms}</div>
    <p class="notice-line">맵에 마우스를 올리면 전체 이름과 직접 연결된 맵을 확인할 수 있습니다. 히든 스트리트와 필드보스 출현 맵은 표시되지 않습니다.</p>
  </div>`;
}

function featureBody(feature) {
  if (feature === 'stats') return statBody();
  if (feature === 'quest') return questBody();
  if (feature === 'move') return movementSelectionBody();
  if (feature === 'equipment') return equipmentBody();
  if (feature === 'enhancement') return enhancementBody();
  if (feature === 'inventory') return inventoryBody();
  if (feature === 'skills') return skillBody();
  if (feature === 'potion-config') return potionConfigurationBody();
  if (feature === 'mail') return mailBody();
  if (feature === 'shop') return shopBody();
  if (feature === 'party') return partyBody();
  if (feature === 'party-invite') return partyInviteBody();
  if (feature === 'trade') return tradeBody();
  if (feature === 'ranking') return rankingBody();
  if (feature === 'event') return eventBody();
  if (feature === 'marketplace') return marketplaceBody();
  if (feature === 'world-map') return worldMapOfficeBody();
  if (feature === 'patch-notes') return patchNotesArchiveBody(state.patchNotesHistory);
  if (feature === 'trade-invite') return tradeInviteBody();
  const messages = {
    shop: '물약, 탄환, 장비 보급품을 구매하는 사내 보급소입니다.',
    cash: 'V2 전용 상품 구성 후 개장합니다.',
    company: state.preview?.preserved.companyData
      ? '기존 회사 데이터는 안전하게 보존되어 있습니다. V2 운영 규칙으로 변환될 예정입니다.'
      : '지사 설립과 회사 운영 기록이 이곳에 표시됩니다.',
    boss: '실시간 보스 전투와 스킬 프리셋 관리 화면이 이곳에 연결됩니다.',
    stock: '기존 보유 주식은 초기화되며, V2 주식 시장이 이곳에서 다시 개장합니다.'
  };
  return `<div class="empty-ledger"><b>${escapeHtml(featureMeta[feature].title)} 업무 문서</b><p>${escapeHtml(messages[feature])}</p><span>현재는 V2 기반 공사 중입니다.</span></div>`;
}

function openFeature(feature) {
  if (state.dead) {
    setWorldActivity('사망 상태에서는 다른 행동을 할 수 없습니다.');
    return;
  }
  const meta = featureMeta[feature];
  if (!meta) return;
  $('featureCode').textContent = meta.code;
  $('featureTitle').textContent = meta.title;
  $('featureBody').innerHTML = featureBody(feature);
  if (feature === 'move') {
    document.querySelectorAll('.move-destination').forEach((button) => {
      button.addEventListener('click', () => commandMove(button.dataset.targetMap));
    });
  }
  if (feature === 'equipment') bindEquipmentTabs();
  if (feature === 'enhancement') bindEnhancementControls();
  if (feature === 'quest') bindQuestControls();
  if (feature === 'stats') bindStatControls();
  if (feature === 'skills') bindSkillControls();
  if (feature === 'inventory') bindInventoryControls();
  if (feature === 'potion-config') bindPotionControls();
  if (feature === 'mail') bindMailControls();
  if (feature === 'shop') bindShopControls();
  if (feature === 'party' || feature === 'party-invite') bindPartyControls();
  if (feature === 'trade' || feature === 'trade-invite') bindTradeControls();
  if (feature === 'ranking') bindRankingControls();
  if (feature === 'event') bindEventControls();
  if (feature === 'marketplace') bindMarketplaceControls();
  if (feature === 'world-map') {
    document.querySelectorAll('[data-map-travel]').forEach((button) => {
      button.addEventListener('click', () => commandTravelTo(button.dataset.mapTravel));
    });
  }
  $('featureModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  document.querySelector('.modal-close')?.focus();
}

function closeFeature() {
  $('featureModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function logout() {
  state.moveRunId += 1;
  state.combatRunId += 1;
  state.worldPresenceRunId += 1;
  if (state.mailPollTimer) clearInterval(state.mailPollTimer);
  if (state.token && !state.isAdmin) {
    fetch('/api/v2/world/leave', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        clientId: state.worldClientId,
        mapId: state.currentMapId,
        x: getCharacterX(),
        floor: getCharacterFloor()
      })
    }).catch(() => {});
  }
  clearLoginState();
  window.location.reload();
}

$('loginForm').addEventListener('submit', login);
$('openSignupButton').addEventListener('click', openSignup);
$('signupForm').addEventListener('submit', signup);
$('signupCodeForm').addEventListener('submit', saveAdminSignupCode);
$('adminGiftForm').addEventListener('submit', sendAdminGift);
$('adminDeleteAccountForm')?.addEventListener('submit', deleteAdminAccount);
$('adminGiftAll').addEventListener('change', () => {
  const sendAll = $('adminGiftAll').checked;
  $('adminGiftTarget').disabled = sendAll;
  $('adminGiftTarget').placeholder = sendAll ? '전체 발송 선택됨' : '아이디 또는 닉네임';
});
['signupUsername', 'signupNickname', 'signupPassword', 'signupPasswordConfirm'].forEach((id) => {
  $(id).addEventListener('input', updateSignupButtonState);
});
$('signupCode').addEventListener('input', () => {
  state.signupCodeValid = false;
  state.signupValidationRequest += 1;
  $('signupCodeState').textContent = '가입 코드를 확인해야 합니다.';
  updateSignupButtonState();
  if (state.signupCodeTimer) clearTimeout(state.signupCodeTimer);
  state.signupCodeTimer = setTimeout(validateSignupCode, 350);
});
document.querySelectorAll('[data-close-signup]').forEach((button) => {
  button.addEventListener('click', closeSignup);
});
$('snapshotAllButton').addEventListener('click', snapshotAllUsers);
$('logoutButton').addEventListener('click', logout);
$('questButton').addEventListener('click', () => openFeature('quest'));
$('moveMapButton').addEventListener('click', () => openFeature('move'));
$('autoCombatButton').addEventListener('click', toggleAutoCombat);
$('hpPotionButton').addEventListener('click', () => useQuickPotion('hp'));
$('mpPotionButton').addEventListener('click', () => useQuickPotion('mp'));
$('potionConfigButton').addEventListener('click', () => openFeature('potion-config'));
$('shopNpc')?.addEventListener('click', () => openFieldShop());
$('scrollShopNpc')?.addEventListener('click', () => openFieldShop('scroll_vendor'));
$('worldStage')?.addEventListener('click', handleWorldStagePoint);
$('rallyPoint')?.addEventListener('click', (event) => {
  event.stopPropagation();
  clearRallyPoint();
  if (state.moving) {
    state.moveRunId += 1;
    state.moving = false;
    setCharacterMotion(null);
    updateFieldControls();
    if (state.autoCombat) startAutoCombat();
  }
  setWorldActivity('이동 기준점을 해제했습니다.');
});
$('mailButton').addEventListener('click', () => refreshMailbox(true));
$('eventButton').addEventListener('click', () => refreshSettlementEvent(true));
$('floatMinimizeButton')?.addEventListener('click', () => setFloatingButtonsMinimized(!state.floatingButtonsMinimized));
$('reviveButton').addEventListener('click', revivePlayer);
document.querySelectorAll('.desk-action').forEach((button) => {
  button.addEventListener('click', () => (
    button.dataset.feature === 'party'
        ? refreshParty(true)
      : button.dataset.feature === 'trade'
        ? refreshTrade(true)
      : button.dataset.feature === 'ranking'
        ? refreshRanking(true)
      : button.dataset.feature === 'marketplace'
        ? refreshMarketplace(true)
      : button.dataset.feature === 'patch-notes'
        ? refreshPatchNotes(true)
      : openFeature(button.dataset.feature)
  ));
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', closeFeature);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !state.dead) closeFeature();
});

async function boot() {
  try {
    setFloatingButtonsMinimized(state.floatingButtonsMinimized);
    await loadMeta();
    await restoreLogin();
  } catch (err) {
    $('loginStatus').textContent = `V2 초기화 실패: ${err.message}`;
  }
}

boot();

setInterval(() => {
  if (!state.token || state.isAdmin || !state.autoCombat) return;
  state.huntingTime.remainingSeconds = Math.max(0, state.huntingTime.remainingSeconds - 1);
  renderHuntingTime();
  state.huntingTickCounter += 1;
  if (state.huntingTickCounter >= 10 || state.huntingTime.remainingSeconds <= 0) {
    state.huntingTickCounter = 0;
    syncHuntingTime(true);
  }
}, 1000);
