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
  combatAttackCount: 0
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
  $('departmentBadge').textContent = job.departmentId === 'unassigned'
    ? '부서 미정'
    : job.departmentId;
  $('unspentStats').textContent = `${formatNumber(progression.unspentStatPoints)} P`;
  $('unspentSkills').textContent = `${formatNumber(progression.unspentSkillPoints)} SP`;
  $('advancementTier').textContent = `${formatNumber(job.advancementTier)}차`;
  $('migrationStatus').textContent = migration.status === 'prepared' ? '준비 완료' : (migration.status || '확인 중');
  $('combatMotionLabel').textContent = `전투 모션 · ${character.combatPresentation?.label || '연습용 베기'}`;

  setResource('hp', resources.currentHp, resources.maxHp);
  setResource('mp', resources.currentMp, resources.maxMp);
  setResource('ap', actionPoints.current, actionPoints.max, '-');

  const prepared = Boolean(state.character);
  $('migrationStateLabel').textContent = prepared ? 'V2 자동 이관 완료' : '자동 이관 확인 중';
  $('prepareStatus').textContent = prepared
    ? `원본 스냅샷 연결 완료 · 변환 상태 ${migration.status || 'prepared'}`
    : '서버가 누락된 이관 데이터를 자동으로 준비하고 있습니다.';

  const quest = character.advancementQuest;
  $('questButton').classList.toggle('hidden', !quest);
  if (quest) {
    $('questButtonTitle').textContent = `${quest.targetTier}차 전직 가능`;
    $('questButtonMeta').textContent = `Lv.${quest.requiredLevel} · ${quest.nextJobName}`;
  }
}

async function loadMeta() {
  state.meta = await request('/api/v2/meta');
}

async function loadUserWorkspace() {
  const [data, world] = await Promise.all([
    request('/api/v2/migration/preview'),
    request('/api/v2/world/maps')
  ]);
  state.maps = world.maps || [];
  state.startMapId = world.startMapId || 'main_lobby';
  renderGame(data);
  startWorldSimulation();
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
    await loadAdminSummary();
  } else {
    $('userWorkspace').classList.remove('hidden');
    await loadUserWorkspace();
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
const CHARACTER_MOTION_CLASSES = [
  'is-walking',
  'is-jump',
  'is-climb',
  'is-hit',
  'is-slash',
  'is-shoot',
  'is-throw',
  'is-staff-swing'
];
const PORTAL_POSITIONS = [
  { left: '4%', side: 'left', characterX: 8 },
  { left: '82%', side: 'right', characterX: 78 },
  { left: '61%', side: 'upper', characterX: 61 },
  { left: '22%', side: 'upper', characterX: 25 }
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

function setCharacterMotion(motion) {
  const character = $('fieldCharacter');
  CHARACTER_MOTION_CLASSES.forEach((className) => character.classList.remove(className));
  if (motion) character.classList.add(`is-${motion}`);
}

function updateFieldControls() {
  const button = $('autoCombatButton');
  button.textContent = state.autoCombat ? '자동 전투 ON' : '자동 전투 OFF';
  button.setAttribute('aria-pressed', String(state.autoCombat));
  button.classList.toggle('is-on', state.autoCombat);
  $('moveMapButton').disabled = state.moving;
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

function renderWorldMap(mapId) {
  const map = getMap(mapId) || getMap(state.startMapId) || state.maps[0];
  if (!map) return;
  state.currentMapId = map.id;
  localStorage.setItem('v2CurrentMapId', map.id);

  $('mapRegion').textContent = `MAP / ${map.region}`;
  $('mapName').textContent = map.name;
  $('mapLevelRange').textContent = `Lv.${map.minLevel}~${map.maxLevel}`;
  $('currentLocation').textContent = map.name;
  $('worldStage').dataset.theme = map.theme;
  $('fieldMonster').querySelector('.monster-level').textContent = `Lv.${map.minLevel}`;
  const needsUpperRoute = map.connections.length > 2;
  $('worldRope').classList.toggle('is-ladder', map.features.includes('ladder') || needsUpperRoute);
  $('worldRope').classList.toggle(
    'hidden',
    !needsUpperRoute && !map.features.some((feature) => feature === 'rope' || feature === 'ladder')
  );
  renderPortals(map);

  const character = $('fieldCharacter');
  character.style.transitionDuration = '0ms';
  character.style.left = '38%';
  character.style.bottom = '42px';
  character.classList.remove('facing-left');
  setCharacterMotion(null);
  void character.offsetWidth;
  character.style.transitionDuration = '';
  setWorldActivity(state.autoCombat ? '자동 전투 준비 중' : '명령 대기 중');
  updateFieldControls();
}

function isRunActive(kind, runId) {
  return kind === 'move'
    ? runId === state.moveRunId
    : runId === state.combatRunId && state.autoCombat && !state.moving;
}

async function moveCharacter(left, duration, runId) {
  if (!isRunActive('move', runId)) return false;
  const character = $('fieldCharacter');
  setCharacterMotion('walking');
  character.style.transitionDuration = `${duration}ms`;
  character.style.left = `${left}%`;
  await sleep(duration);
  setCharacterMotion(null);
  return isRunActive('move', runId);
}

async function playWorldMotion(motion, kind, runId) {
  if (!isRunActive(kind, runId)) return;
  const character = $('fieldCharacter');
  const monster = $('fieldMonster');
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

  if (['slash', 'shoot', 'throw', 'staff-swing'].includes(motion)) {
    monster.classList.add('is-hit');
  }
  if (motion === 'shoot' || motion === 'throw') {
    projectile.className = `attack-projectile is-${motion}`;
  }
  if (motion === 'hit') character.classList.add('damage-flash');
  if (motion === 'climb') {
    character.style.transitionDuration = '850ms';
    character.style.bottom = '145px';
  }

  await sleep(motion === 'climb' ? 1050 : 720);
  monster.classList.remove('is-hit');
  projectile.className = 'attack-projectile';
  character.classList.remove('damage-flash');
  if (motion === 'climb') {
    character.style.transitionDuration = '500ms';
    character.style.bottom = '42px';
    await sleep(520);
  }
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
  const target = getMap(connection.targetId);
  setWorldActivity(`${connection.portalName} 진입 · ${target?.name || connection.targetId} 이동 중`);
  $('worldStage').classList.add('changing-map');
  await sleep(520);
  if (!isRunActive('move', runId)) return false;
  renderWorldMap(connection.targetId);
  $('worldStage').classList.remove('changing-map');
  await sleep(500);
  return true;
}

async function commandMove(targetMapId) {
  if (state.moving) return;
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
  character.classList.toggle('facing-left', portal.characterX < 38);

  if (map.features.includes('hazard')) {
    await playWorldMotion('jump', 'move', runId);
  }
  if (portal.side === 'upper') {
    character.style.left = `${portal.characterX}%`;
    await playWorldMotion('climb', 'move', runId);
  } else {
    await moveCharacter(portal.characterX, 1700, runId);
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

async function runAutoCombat(runId) {
  while (isRunActive('combat', runId) && state.token && !state.isAdmin) {
    const motion = getCombatPresentation().motion;
    await playWorldMotion(motion, 'combat', runId);
    if (!isRunActive('combat', runId)) return;
    state.combatAttackCount += 1;
    if (state.combatAttackCount % 3 === 0) {
      await sleep(450);
      await playWorldMotion('hit', 'combat', runId);
    }
    await sleep(900);
  }
}

function startAutoCombat() {
  if (!state.autoCombat || state.moving) return;
  const runId = ++state.combatRunId;
  runAutoCombat(runId).catch((err) => {
    console.error('V2 auto combat error:', err);
    setWorldActivity('자동 전투를 다시 준비하고 있습니다.');
  });
}

function toggleAutoCombat() {
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

function startWorldSimulation() {
  if (!state.maps.length) return;
  const savedMap = getMap(state.currentMapId);
  const accessibleSavedMap = savedMap && savedMap.minLevel <= getCharacterLevel() + 5
    ? savedMap
    : null;
  const startMap = accessibleSavedMap || getMap(state.startMapId) || state.maps[0];
  state.moveRunId += 1;
  state.combatRunId += 1;
  state.moving = false;
  renderWorldMap(startMap.id);
  if (state.autoCombat) startAutoCombat();
}

const featureMeta = {
  stats: { code: '01 / STATUS', title: '스탯' },
  inventory: { code: '02 / INVENTORY', title: '인벤토리' },
  skills: { code: '03 / SKILLS', title: '스킬' },
  shop: { code: '04 / SUPPLY', title: '상점' },
  cash: { code: '05 / CASH SHOP', title: '캐쉬상점' },
  company: { code: '06 / COMPANY', title: '회사 운영' },
  boss: { code: '07 / RAID', title: '보스' },
  stock: { code: '08 / MARKET', title: '주식' },
  quest: { code: 'QUEST / HR', title: '전직 퀘스트' },
  move: { code: 'MAP / MOVE', title: '이동 목적지' }
};

function questBody() {
  const quest = state.character?.advancementQuest;
  if (!quest) {
    return '<div class="empty-ledger"><b>현재 진행 가능한 전직이 없습니다.</b><p>다음 전직 레벨에 도달하면 화면 옆에 퀘스트가 다시 나타납니다.</p></div>';
  }
  const departmentNames = ['인사팀', '회계팀', '경영지원팀', '영업직', '마케팅', '개발직', '현장직', '시설관리팀', '품질관리', '연구직'];
  const departmentGuide = quest.departmentSelectionRequired
    ? `<div class="department-options">${departmentNames.map((name) => `<span>${name}</span>`).join('')}</div>`
    : `<p class="quest-department">${escapeHtml(quest.departmentName)} · 다음 직급 <b>${escapeHtml(quest.nextJobName)}</b></p>`;
  return `
    <div class="quest-sheet">
      <div class="quest-rank"><span>TARGET</span><strong>${quest.targetTier}차 전직</strong><small>요구 레벨 ${quest.requiredLevel}</small></div>
      <div>
        <h3>인사 발령 심사</h3>
        <p>전직 퀘스트를 완료하면 새로운 직급과 스킬 포인트 1을 획득합니다.</p>
        ${departmentGuide}
        <p class="notice-line">전직 퀘스트의 실제 수행 조건과 완료 버튼은 다음 작업에서 연결됩니다.</p>
      </div>
    </div>`;
}

function statBody() {
  const character = state.character || {};
  const stats = character.stats || {};
  const progression = character.progression || {};
  return `
    <div class="stat-sheet">
      <div class="point-summary">
        <div class="stat-total"><span>사용 가능한 스탯 포인트</span><strong>${formatNumber(progression.unspentStatPoints)} P</strong></div>
        <div class="skill-total"><span>사용 가능한 스킬 포인트</span><strong>${formatNumber(progression.unspentSkillPoints)} SP</strong></div>
      </div>
      <div class="stat-grid">
        <article><span>맷집 / STR</span><strong>${formatNumber(stats.grit)}</strong><small>물리 계열 주스탯 후보</small></article>
        <article><span>처리속도 / DEX</span><strong>${formatNumber(stats.processingSpeed)}</strong><small>명중·회피 및 원거리 계열</small></article>
        <article><span>업무지식 / INT</span><strong>${formatNumber(stats.workKnowledge)}</strong><small>마법 피해와 정신력 계열</small></article>
        <article><span>눈치 / LUK</span><strong>${formatNumber(stats.awareness)}</strong><small>도적 계열 및 회피 보조</small></article>
      </div>
      <p class="notice-line">스탯 투자와 초기화 규칙은 부서 및 전직 시스템 확정 후 활성화됩니다.</p>
    </div>`;
}

function featureBody(feature) {
  if (feature === 'stats') return statBody();
  if (feature === 'quest') return questBody();
  if (feature === 'move') return movementSelectionBody();
  if (feature === 'inventory') {
    return `<div class="empty-ledger"><b>보존된 원본 재화</b><p>일반 카드 ${formatNumber(state.preview?.preserved.cardCount)}장 · 강화 카드 ${formatNumber(state.preview?.preserved.enhancedCardCount)}장 · 기존 장비 ${formatNumber(state.preview?.preserved.equipmentCount)}개</p><span>V2 장비와 아이템 변환 규칙 확정 후 이곳에 인벤토리가 열립니다.</span></div>`;
  }
  const messages = {
    skills: '부서와 전직별 스킬 트리가 이곳에 배치됩니다.',
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
  clearLoginState();
  window.location.reload();
}

$('loginForm').addEventListener('submit', login);
$('snapshotAllButton').addEventListener('click', snapshotAllUsers);
$('logoutButton').addEventListener('click', logout);
$('questButton').addEventListener('click', () => openFeature('quest'));
$('moveMapButton').addEventListener('click', () => openFeature('move'));
$('autoCombatButton').addEventListener('click', toggleAutoCombat);
document.querySelectorAll('.desk-action').forEach((button) => {
  button.addEventListener('click', () => openFeature(button.dataset.feature));
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', closeFeature);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeFeature();
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