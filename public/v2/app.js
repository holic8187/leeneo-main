'use strict';

const state = {
  token: sessionStorage.getItem('v2Token') || '',
  meta: null,
  isAdmin: false,
  displayName: ''
};

const $ = (id) => document.getElementById(id);
const formatNumber = (value) => Number(value || 0).toLocaleString('ko-KR');

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

function renderFeatureList(id, values) {
  $(id).innerHTML = (values || []).map((value) => `<li>${value}</li>`).join('');
}

function renderPreview(data) {
  const preview = data.preview;
  state.displayName = data.displayName || state.displayName;
  $('displayName').textContent = state.displayName || '사원';
  $('sourceLevel').textContent = formatNumber(preview.sourceLevel);
  $('mappedLevel').textContent = formatNumber(preview.mappedLevel);
  $('statPoints').textContent = `${formatNumber(preview.statPoints)} P`;
  $('nextExp').textContent = formatNumber(preview.expToNextLevel);
  $('legacyCounts').innerHTML = [
    `일반 카드 ${formatNumber(preview.preserved.cardCount)}장`,
    `강화 카드 ${formatNumber(preview.preserved.enhancedCardCount)}장`,
    `장비 ${formatNumber(preview.preserved.equipmentCount)}개`,
    `인벤토리 ${formatNumber(preview.preserved.inventoryQuantity)}개`,
    `회사 데이터 ${preview.preserved.companyData ? '보존 대상' : '없음'}`,
    `돈 ${formatNumber(preview.reset.moneyBefore)}원 → 0원`,
    `주식 종목 ${formatNumber(preview.reset.stockHoldingCountBefore)}개 → 0개`
  ].map((text) => `<span>${text}</span>`).join('');

  if (data.character) {
    $('prepareButton').textContent = 'V2 데이터 준비 완료';
    $('prepareButton').disabled = true;
    $('prepareStatus').textContent = `원본 스냅샷 연결 완료 / 변환 상태: ${data.character.migration.status}`;
  }
}

async function loadMeta() {
  state.meta = await request('/api/v2/meta');
  renderFeatureList('retainedFeatures', state.meta.retainedFeatures);
  renderFeatureList('removedFeatures', state.meta.removedFeatures);
  renderFeatureList('plannedFeatures', state.meta.plannedFeatures);
}

async function loadUserWorkspace() {
  const data = await request('/api/v2/migration/preview');
  renderPreview(data);
}

async function loadAdminSummary() {
  const data = await request('/api/v2/admin/migration-summary');
  $('adminSummary').innerHTML = [
    `전체 유저 ${formatNumber(data.totalUsers)}명`,
    `V2 계정 ${formatNumber(data.accountCount)}명`,
    `스냅샷 ${formatNumber(data.snapshotCount)}명`,
    `V2 캐릭터 ${formatNumber(data.characterCount)}명`,
    `레벨 범위 ${formatNumber(data.sourceLevelStats.min)}~${formatNumber(data.sourceLevelStats.max)}`,
    `중앙 레벨 ${formatNumber(data.sourceLevelStats.median)}`
  ].map((text) => `<span>${text}</span>`).join('');
}

async function login(event) {
  event.preventDefault();
  $('loginStatus').textContent = '계정을 확인하는 중입니다.';
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
    $('displayName').textContent = state.displayName || '사원';

    if (state.isAdmin) {
      $('userWorkspace').classList.add('hidden');
      $('adminWorkspace').classList.remove('hidden');
      await loadAdminSummary();
    } else {
      await loadUserWorkspace();
    }
  } catch (err) {
    $('loginStatus').textContent = err.message;
  }
}

async function prepareMigration() {
  const button = $('prepareButton');
  button.disabled = true;
  $('prepareStatus').textContent = '원본 스냅샷을 생성하고 있습니다.';
  try {
    const data = await request('/api/v2/migration/prepare', {
      method: 'POST',
      body: '{}'
    });
    renderPreview({
      displayName: state.displayName,
      preview: data.preview,
      character: data.character
    });
    $('prepareStatus').textContent = data.message;
  } catch (err) {
    button.disabled = false;
    $('prepareStatus').textContent = err.message;
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
      $('adminStatus').textContent = `${formatNumber(processed)}명 처리 완료`;
      if (data.complete) break;
    } while (afterId);
    $('adminStatus').textContent = `전체 ${formatNumber(processed)}명의 V2 스냅샷 준비가 완료되었습니다.`;
    await loadAdminSummary();
  } catch (err) {
    $('adminStatus').textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

$('loginForm').addEventListener('submit', login);
$('prepareButton').addEventListener('click', prepareMigration);
$('snapshotAllButton').addEventListener('click', snapshotAllUsers);

loadMeta().catch((err) => {
  $('loginStatus').textContent = `V2 메타데이터 로드 실패: ${err.message}`;
});
