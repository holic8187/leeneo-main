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
  moving: false,
  moveRunId: 0,
  combatRunId: 0,
  combatAttackCount: 0,
  equipmentTab: 'weapon',
  selectedDepartmentId: '',
  signupCodeConfigured: false,
  signupCodeValid: false,
  signupValidationRequest: 0,
  signupCodeTimer: null,
  worldPresenceRunId: 0,
  worldHeartbeatBusy: false,
  worldStateEpoch: 0,
  reviving: false,
  selfUserId: '',
  worldMonsters: [],
  combatTargetId: '',
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
    limits: { defaultCapacity: 20, maximumCapacity: 64, expansionSize: 4 }
  },
  inventoryTab: 'consumable',
  inventoryPage: 0,
  inventoryExpansionPrompt: false,
  mailbox: [],
  pendingMailCount: 0,
  mailPollTimer: null,
  adminGrantItems: []
};

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
  if (Number.isFinite(Number(character.pendingMailCount))) {
    updateMailButton(Number(character.pendingMailCount));
  }

  const quest = character.advancementQuest;
  $('questButton').classList.toggle('hidden', !quest);
  $('mailButton').classList.toggle('quest-visible', Boolean(quest));
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
  startWorldSimulation();
  startMailPolling();
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
const CHARACTER_MOTION_CLASSES = [
  'is-walking',
  'is-jump',
  'is-climb',
  'is-hit',
  'is-slash',
  'is-shoot',
  'is-throw',
  'is-staff-swing',
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
  return Math.max(0, Math.min(94, Number.parseFloat($('fieldCharacter').style.left) || 0));
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
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return;

  const stageRect = stage.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const element = document.createElement('span');
  element.className = `floating-damage is-${kind}`;
  element.textContent = formatNumber(value);
  element.style.left = `${targetRect.left - stageRect.left + targetRect.width / 2}px`;
  element.style.top = `${Math.max(18, targetRect.top - stageRect.top + 4)}px`;
  stage.appendChild(element);
  element.addEventListener('animationend', () => element.remove(), { once: true });
  setTimeout(() => element.remove(), 650);
}

function updateFieldControls() {
  const button = $('autoCombatButton');
  button.textContent = state.autoCombat ? '자동 전투 ON' : '자동 전투 OFF';
  button.setAttribute('aria-pressed', String(state.autoCombat));
  button.classList.toggle('is-on', state.autoCombat);
  $('moveMapButton').disabled = state.moving || state.dead;
  button.disabled = state.dead;
  $('hpPotionButton').disabled = state.dead;
  $('mpPotionButton').disabled = state.dead;
  $('potionConfigButton').disabled = state.dead;
  document.querySelectorAll('.desk-action, #questButton, #mailButton').forEach((control) => {
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

function renderWorldMap(mapId, arrivalPortalIndex = 0) {
  const map = getMap(mapId) || getMap(state.startMapId) || state.maps[0];
  if (!map) return;
  state.currentMapId = map.id;
  localStorage.setItem('v2CurrentMapId', map.id);

  $('mapRegion').textContent = `MAP / ${map.region}`;
  $('mapName').textContent = map.name;
  $('mapLevelRange').textContent = map.safeZone
    ? 'SAFE ZONE'
    : `Lv.${map.minLevel}~${map.maxLevel}`;
  $('currentLocation').textContent = map.name;
  $('worldStage').dataset.theme = map.theme;
  const needsUpperRoute = map.connections.length > 2;
  $('worldRope').classList.toggle('is-ladder', map.features.includes('ladder') || needsUpperRoute);
  $('worldRope').classList.toggle(
    'hidden',
    !needsUpperRoute && !map.features.some((feature) => feature === 'rope' || feature === 'ladder')
  );
  renderPortals(map);

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
  setWorldActivity(state.autoCombat ? '자동 전투 준비 중' : '명령 대기 중');
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
  setWorldActivity('목적지로 걷는 중');
  setCharacterMotion('walking');
  character.style.transitionDuration = `${resolvedDuration}ms`;
  character.style.left = `${left}%`;
  await sleep(resolvedDuration);
  setCharacterMotion(null);
  return isRunActive('move', runId);
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

function getCombatTarget() {
  const characterX = getCharacterX();
  const floor = getCharacterFloor();
  const candidates = state.worldMonsters.filter((monster) => monster.floor === floor && monster.hp > 0);
  if (!candidates.length) return null;
  const selected = candidates.find((monster) => monster.id === state.combatTargetId)
    || candidates.sort((a, b) => Math.abs(a.x - characterX) - Math.abs(b.x - characterX))[0];
  state.combatTargetId = selected.id;
  return selected;
}

function getCombatTargetElement() {
  return Array.from($('monsterLayer').children).find(
    (element) => element.dataset.monsterId === state.combatTargetId
  ) || null;
}

async function playWorldMotion(motion, kind, runId) {
  if (!isRunActive(kind, runId)) return;
  const character = $('fieldCharacter');
  const monster = getCombatTargetElement();
  const projectile = $('attackProjectile');
  setCharacterMotion(motion);

  const labels = {
    slash: '근접 공격 · 베기',
    shoot: '원거리 공격 · 쏘기',
    throw: '원거리 공격 · 날리기',
    'staff-swing': '마법 공격 · 완드/스태프 휘두르기',
    hit: '몬스터의 공격에 피격',
    jump: '장애물 점프',
    climb: '밧줄·사다리 이동'
  };
  setWorldActivity(labels[motion] || '행동 중');

  if (monster && ['slash', 'shoot', 'throw', 'staff-swing'].includes(motion)) {
    monster.classList.add('is-hit');
  }
  if (motion === 'shoot' || motion === 'throw') {
    projectile.style.left = character.style.left;
    projectile.style.bottom = `${(Number.parseFloat(character.style.bottom) || 42) + 40}px`;
    projectile.className = `attack-projectile is-${motion}`;
  }
  if (motion === 'hit') character.classList.add('damage-flash');

  await sleep(720);
  monster?.classList.remove('is-hit');
  projectile.className = 'attack-projectile';
  character.classList.remove('damage-flash');
  setCharacterMotion(null);
}

function canEnterMap(target) {
  return target && target.minLevel <= getCharacterLevel() + 5;
}

function movementSelectionBody() {
  const map = getMap(state.currentMapId);
  if (!map) return '<div class="empty-ledger"><b>현재 맵 정보를 찾을 수 없습니다.</b></div>';
  const destinations = map.connections.map((connection, index) => {
    const target = getMap(connection.targetId);
    const accessible = canEnterMap(target);
    return `<button class="move-destination" type="button" data-target-map="${escapeHtml(connection.targetId)}" ${accessible ? '' : 'disabled'}>
      <b>${String(index + 1).padStart(2, '0')}</b>
      <span><strong>${escapeHtml(target?.name || connection.targetId)}</strong><small>${escapeHtml(connection.portalName)} · Lv.${target?.minLevel || '?'}~${target?.maxLevel || '?'}</small></span>
      <i>${accessible ? '이동' : '레벨 부족'}</i>
    </button>`;
  }).join('');
  return `<div class="movement-sheet">
    <p>현재 위치 <b>${escapeHtml(map.name)}</b>에서 연결된 포탈입니다. 목적지를 선택하면 캐릭터가 직접 포탈까지 이동합니다.</p>
    <div class="movement-list">${destinations}</div>
  </div>`;
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

async function commandMove(targetMapId) {
  if (state.moving || state.dead) return;
  const map = getMap(state.currentMapId);
  const connection = map?.connections.find((entry) => entry.targetId === targetMapId);
  const target = getMap(targetMapId);
  if (!connection || !canEnterMap(target)) return;

  closeFeature();
  state.moving = true;
  state.combatRunId += 1;
  const runId = ++state.moveRunId;
  updateFieldControls();

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
    if (!await moveCharacter(ladderX, 1050, runId)) return;
    if (!await climbToUpperPlatform(runId)) return;
    character.classList.toggle('facing-left', portal.characterX < ladderX);
    if (!await moveCharacter(portal.characterX, 650, runId)) return;
  } else {
    const currentX = Number.parseFloat(character.style.left) || 38;
    character.classList.toggle('facing-left', portal.characterX < currentX);
    if (!await moveCharacter(portal.characterX, 1700, runId)) return;
  }
  await enterWorldPortal(connection, runId);

  if (runId !== state.moveRunId) return;
  state.moving = false;
  setCharacterMotion(null);
  updateFieldControls();
  if (state.autoCombat) {
    startAutoCombat();
  } else {
    setWorldActivity('명령 대기 중');
  }
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

async function runAutoCombat(runId) {
  while (isRunActive('combat', runId) && state.token && !state.isAdmin && !state.dead) {
    const target = getCombatTarget();
    if (!target) {
      setWorldActivity('몬스터 출현 대기 중');
      await sleep(650);
      continue;
    }
    if (!await approachMonsterForCombat(runId)) {
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
          mapId: state.currentMapId,
          monsterId: state.combatTargetId
        })
      });
      showFloatingDamage(
        getCombatTargetElement(),
        result.damage,
        result.critical ? 'critical' : 'outgoing'
      );
      applyAttackResult(result);
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
    await sleep(900);
  }
}

function startAutoCombat() {
  if (!state.autoCombat || state.moving || state.dead) return;
  const runId = ++state.combatRunId;
  runAutoCombat(runId).catch((err) => {
    console.error('V2 auto combat error:', err);
    setWorldActivity('자동 전투를 다시 준비하고 있습니다.');
  });
}

function toggleAutoCombat() {
  if (state.dead) return;
  state.autoCombat = !state.autoCombat;
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
    element.querySelector('small').textContent = activityLabel(player.activity);
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
  element.className = 'field-monster';
  element.dataset.monsterId = monster.id;
  element.innerHTML = `
    <span class="monster-name"></span><span class="monster-level"></span>
    <pre>(╬ಠ益ಠ)</pre>
    <div class="monster-hp"><i></i></div>`;
  $('monsterLayer').appendChild(element);
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
    element.querySelector('.monster-hp i').style.width = `${ratio(monster.hp, monster.maxHp)}%`;
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
  targetElement?.classList.toggle('is-chasing', result.monster.state === 'chase');
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

async function revivePlayer() {
  const button = $('reviveButton');
  button.disabled = true;
  state.reviving = true;
  state.worldStateEpoch += 1;
  try {
    const data = await request('/api/v2/world/revive', {
      method: 'POST',
      body: '{}'
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
  state.worldServerTime = Number(data.serverTime) || Date.now();
  if (data.self?.userId) state.selfUserId = data.self.userId;
  renderRemotePlayers(data.players || []);
  renderMonsters(data.monsters || []);
  if (data.self && state.character?.resources) {
    state.character.resources.currentHp = data.self.currentHp;
    state.character.resources.maxHp = data.self.maxHp;
    setResource('hp', data.self.currentHp, data.self.maxHp);
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
    character.style.transitionDuration = '180ms';
    character.style.left = `${ownContact.x}%`;
    character.classList.add('damage-flash');
    setTimeout(() => character.classList.remove('damage-flash'), 260);
    const damageKey = `${ownContact.monsterId}:${ownContact.invulnerableUntil}:${ownContact.damage}`;
    if (state.lastContactDamageKey !== damageKey) {
      state.lastContactDamageKey = damageKey;
      showFloatingDamage(character, ownContact.damage, 'incoming');
    }
    syncInvulnerabilityVisual(ownContact.invulnerableUntil, state.worldServerTime);
    if (Number(ownContact.currentHp) > 0) {
      setWorldActivity(`몸박 피해 -${formatNumber(ownContact.damage)} · 1.5초 무적`);
    }
  }
}

async function sendWorldHeartbeat() {
  if (
    state.worldHeartbeatBusy
    || state.dead
    || state.reviving
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
  const accessibleSavedMap = savedMap && savedMap.minLevel <= getCharacterLevel() + 5
    ? savedMap
    : null;
  const startMap = accessibleSavedMap || getMap(state.startMapId) || state.maps[0];
  state.moveRunId += 1;
  state.combatRunId += 1;
  state.moving = false;
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

async function useQuickPotion(slot) {
  if (state.dead) return;
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
    setWorldActivity(err.message);
  }
}

const INVENTORY_TAB_ORDER = Object.freeze(['equipment', 'consumable', 'misc', 'cash']);
const INVENTORY_PAGE_SIZE = 16;

function inventorySlotBody(item, slotNumber, locked = false) {
  if (locked) {
    return `<div class="inventory-slot is-locked"><span>${slotNumber}</span><b>🔒</b></div>`;
  }
  if (!item) {
    return `<div class="inventory-slot is-empty"><span>${slotNumber}</span></div>`;
  }
  const usable = item.itemType === 'inventory-expansion'
    ? '<button class="inventory-item-use" type="button" data-use-expansion-ticket>사용</button>'
    : '';
  return `<article class="inventory-slot has-item" tabindex="0">
    <span class="inventory-slot-number">${slotNumber}</span>
    <div class="inventory-item-icon" aria-hidden="true">${escapeHtml(item.icon || '📦')}</div>
    <b class="inventory-item-quantity">${formatNumber(item.quantity)}</b>
    ${usable}
    <div class="inventory-item-tooltip" role="tooltip">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.description)}</span>
      <small>${formatNumber(item.quantity)}개 보유</small>
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
    <div class="inventory-tabs" role="tablist">
      ${INVENTORY_TAB_ORDER.map((key) => {
        const tab = state.inventory.categories[key] || { label: key, icon: '📦', capacity: 20, usedSlots: 0 };
        return `<button class="${key === state.inventoryTab ? 'is-active' : ''}" type="button" data-inventory-tab="${key}">
          <span>${escapeHtml(tab.icon)}</span><strong>${escapeHtml(tab.label)}</strong><small>${formatNumber(tab.usedSlots)}/${formatNumber(tab.capacity)}</small>
        </button>`;
      }).join('')}
    </div>
    ${inventoryExpansionPanel()}
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
  document.querySelectorAll('[data-expand-inventory]').forEach((button) => {
    button.addEventListener('click', () => expandInventory(button.dataset.expandInventory));
  });
  document.querySelector('[data-cancel-expansion]')?.addEventListener('click', () => {
    state.inventoryExpansionPrompt = false;
    rerenderInventory();
  });
}

function potionConfigurationBody() {
  const potions = state.inventory.potions;
  return `<div class="potion-config-sheet">
    <p class="notice-line">왼쪽에는 체력 포션, 오른쪽에는 정신력 포션만 설정할 수 있습니다.</p>
    <div class="potion-config-list">
      ${potions.length ? potions.map((item) => `<article>
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)} · ${formatNumber(item.quantity)}개 보유</small></div>
        <button type="button" data-assign-potion="${escapeHtml(item.id)}" data-potion-slot="${item.resource}">${item.resource === 'hp' ? 'HP' : 'MP'} 슬롯 설정</button>
      </article>`).join('') : '<div class="empty-ledger"><b>설정할 포션이 없습니다.</b></div>'}
    </div>
  </div>`;
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
  document.querySelector('[data-open-potion-config]')?.addEventListener('click', () => openFeature('potion-config'));
}

function bindMailControls() {
  document.querySelectorAll('[data-claim-mail]').forEach((button) => {
    button.addEventListener('click', () => claimMailItem(button.dataset.claimMail));
  });
  document.querySelector('[data-claim-all-mail]')?.addEventListener('click', claimAllMailItems);
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
  quest: { code: 'QUEST / HR', title: '전직 퀘스트' },
  move: { code: 'MAP / MOVE', title: '이동 목적지' },
  mail: { code: 'ADMIN / MAIL', title: '우편함' },
  'potion-config': { code: 'QUICK / POTION', title: '포션 설정' }
};

const EQUIPMENT_TABS = Object.freeze({
  weapon: {
    label: '무기',
    slots: [{ key: 'weapon', label: '무기', code: 'WEAPON' }]
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
      { key: 'earrings', label: '귀걸이', code: 'EARRINGS' }
    ]
  }
});

function equipmentStatText(item) {
  const stats = item?.stats && typeof item.stats === 'object'
    ? Object.entries(item.stats).filter(([, value]) => Number(value))
    : [];
  return stats.length
    ? stats.map(([key, value]) => `${escapeHtml(key)} +${formatNumber(value)}`).join(' · ')
    : '장비 능력치 정보 없음';
}

function equipmentBody() {
  const activeTab = EQUIPMENT_TABS[state.equipmentTab] || EQUIPMENT_TABS.weapon;
  const loadout = state.character?.equipmentLoadout || {};
  const tabs = Object.entries(EQUIPMENT_TABS).map(([key, tab]) => (
    `<button class="equipment-tab ${key === state.equipmentTab ? 'is-active' : ''}" type="button" data-equipment-tab="${key}">${tab.label}</button>`
  )).join('');
  const slots = activeTab.slots.map((slot) => {
    const item = loadout[slot.key];
    return `<article class="equipment-slot ${item ? 'is-equipped' : 'is-empty'}">
      <div class="equipment-slot-code"><span>${slot.code}</span><b>${slot.label}</b></div>
      <div class="equipment-slot-item">
        <strong>${escapeHtml(item?.name || '미장착')}</strong>
        <small>${item ? equipmentStatText(item) : '현재 장착한 장비가 없습니다.'}</small>
      </div>
      <i>${item ? 'EQUIPPED' : 'EMPTY'}</i>
    </article>`;
  }).join('');
  return `<div class="equipment-sheet">
    <div class="equipment-tabs" role="tablist">${tabs}</div>
    <div class="equipment-slots">${slots}</div>
    <p class="notice-line">현재 장착 상태를 확인하는 화면입니다. 장비 장착과 해제는 인벤토리 구현 단계에서 연결됩니다.</p>
  </div>`;
}

function bindEquipmentTabs() {
  document.querySelectorAll('[data-equipment-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.equipmentTab = button.dataset.equipmentTab;
      $('featureBody').innerHTML = equipmentBody();
      bindEquipmentTabs();
    });
  });
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
          <article><span>맷집 / STR</span><strong>${formatNumber(stats.grit)}</strong><small>물리 계열 주스탯 후보</small>${statInvestmentControl('grit', progression.unspentStatPoints)}</article>
          <article><span>처리속도 / DEX</span><strong>${formatNumber(stats.processingSpeed)}</strong><small>명중·회피 및 원거리 계열</small>${statInvestmentControl('processingSpeed', progression.unspentStatPoints)}</article>
          <article><span>업무지식 / INT</span><strong>${formatNumber(stats.workKnowledge)}</strong><small>마법 피해와 정신력 계열</small>${statInvestmentControl('workKnowledge', progression.unspentStatPoints)}</article>
          <article><span>눈치 / LUK</span><strong>${formatNumber(stats.awareness)}</strong><small>도적 계열 및 회피 보조</small>${statInvestmentControl('awareness', progression.unspentStatPoints)}</article>
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
  const access = state.character?.skillAccess || {};
  return `<div class="skill-access-sheet">
    <span>UNLOCKED TIER ${formatNumber(access.unlockedTier)}</span>
    <h3>${escapeHtml(access.name || '신입사원 공용 스킬')}</h3>
    <p>${escapeHtml(access.jobName || '미전직')} · 적용 레벨 Lv.${formatNumber(access.minLevel || 1)}~${formatNumber(access.maxLevel || 9)}</p>
    <strong>보유 스킬 포인트 ${formatNumber(state.character?.progression?.unspentSkillPoints)} SP</strong>
    <small>직업별 실제 스킬 목록과 투자 기능은 스킬 데이터가 확정되는 순서대로 이 화면에 연결됩니다.</small>
  </div>`;
}

function featureBody(feature) {
  if (feature === 'stats') return statBody();
  if (feature === 'quest') return questBody();
  if (feature === 'move') return movementSelectionBody();
  if (feature === 'equipment') return equipmentBody();
  if (feature === 'inventory') return inventoryBody();
  if (feature === 'skills') return skillBody();
  if (feature === 'potion-config') return potionConfigurationBody();
  if (feature === 'mail') return mailBody();
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
  if (feature === 'quest') bindQuestControls();
  if (feature === 'stats') bindStatControls();
  if (feature === 'inventory') bindInventoryControls();
  if (feature === 'potion-config') bindPotionControls();
  if (feature === 'mail') bindMailControls();
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
$('mailButton').addEventListener('click', () => refreshMailbox(true));
$('reviveButton').addEventListener('click', revivePlayer);
document.querySelectorAll('.desk-action').forEach((button) => {
  button.addEventListener('click', () => openFeature(button.dataset.feature));
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', closeFeature);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !state.dead) closeFeature();
});

async function boot() {
  try {
    await loadMeta();
    await restoreLogin();
  } catch (err) {
    $('loginStatus').textContent = `V2 초기화 실패: ${err.message}`;
  }
}

boot();
