'use strict';

const state = {
  token: sessionStorage.getItem('v2Token') || '',
  meta: null,
  isAdmin: false,
  displayName: '',
  preview: null,
  character: null
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
  $('advancementTier').textContent = `${formatNumber(job.advancementTier)}차`;
  $('migrationStatus').textContent = migration.status === 'prepared' ? '준비 완료' : (migration.status || '확인 중');

  setResource('hp', resources.currentHp, resources.maxHp);
  setResource('mp', resources.currentMp, resources.maxMp);
  setResource('ap', actionPoints.current, actionPoints.max, '-');

  const prepared = Boolean(state.character);
  $('migrationStateLabel').textContent = prepared ? 'V2 자동 이관 완료' : '자동 이관 확인 중';
  $('prepareStatus').textContent = prepared
    ? `원본 스냅샷 연결 완료 · 변환 상태 ${migration.status || 'prepared'}`
    : '서버가 누락된 이관 데이터를 자동으로 준비하고 있습니다.';
}

async function loadMeta() {
  state.meta = await request('/api/v2/meta');
}

async function loadUserWorkspace() {
  const data = await request('/api/v2/migration/preview');
  renderGame(data);
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
    sessionStorage.setItem('v2Token', state.token);

    $('loginPanel').classList.add('hidden');
    $('workspace').classList.remove('hidden');
    $('logoutButton').classList.remove('hidden');

    if (state.isAdmin) {
      $('adminWorkspace').classList.remove('hidden');
      await loadAdminSummary();
    } else {
      $('userWorkspace').classList.remove('hidden');
      await loadUserWorkspace();
    }
  } catch (err) {
    $('loginStatus').textContent = err.message;
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

const featureMeta = {
  stats: { code: '01 / STATUS', title: '스탯' },
  inventory: { code: '02 / INVENTORY', title: '인벤토리' },
  skills: { code: '03 / SKILLS', title: '스킬' },
  shop: { code: '04 / SUPPLY', title: '상점' },
  cash: { code: '05 / CASH SHOP', title: '캐쉬상점' },
  company: { code: '06 / COMPANY', title: '회사 운영' },
  boss: { code: '07 / RAID', title: '보스' },
  stock: { code: '08 / MARKET', title: '주식' }
};

function statBody() {
  const character = state.character || {};
  const stats = character.stats || {};
  const progression = character.progression || {};
  return `
    <div class="stat-sheet">
      <div class="stat-total"><span>사용 가능한 스탯 포인트</span><strong>${formatNumber(progression.unspentStatPoints)} P</strong></div>
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
  $('featureModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  document.querySelector('.modal-close')?.focus();
}

function closeFeature() {
  $('featureModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function logout() {
  sessionStorage.removeItem('v2Token');
  window.location.reload();
}

$('loginForm').addEventListener('submit', login);
$('snapshotAllButton').addEventListener('click', snapshotAllUsers);
$('logoutButton').addEventListener('click', logout);
document.querySelectorAll('.desk-action').forEach((button) => {
  button.addEventListener('click', () => openFeature(button.dataset.feature));
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', closeFeature);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeFeature();
});

loadMeta().catch((err) => {
  $('loginStatus').textContent = `V2 메타데이터 로드 실패: ${err.message}`;
});
