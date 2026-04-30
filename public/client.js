const API_URL = window.location.origin;

const ITEM_DATA = {
  pen_monami: {
    name: '모나미 볼펜',
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.05% 증가합니다.'
  },
  coffee_mix: {
    name: '맥심 커피믹스',
    desc: '스트레스 증가량 2% 감소',
    hoverDesc: '보유량마다 현재 스트레스 증가량의 98%만 받습니다.'
  },
  bacchus: {
    name: '박카스',
    desc: '행동력 +1',
    hoverDesc: '가방에서 사용하면 행동력을 1 회복합니다.'
  },
  hot6: {
    name: '핫식스',
    desc: '스트레스 -10, 10분 버프',
    hoverDesc: '사용 즉시 스트레스를 10 낮추고, 10분 동안 서류작업 클릭마다 스트레스를 0.1 낮춥니다.'
  }
};

const BUFF_DATA = {
  lupin_stress_buff: { name: '월급루팡' },
  lupin_exp_buff: { name: '월급루팡 집중' },
  field_work_buff: {
    name: '외근 버프',
    desc: '12시간 동안 자동 획득 경험치가 5배가 되고, 서류작업 클릭 경험치는 절반이 됩니다.'
  },
  hot6_buff: {
    name: '핫식스 버프',
    desc: '서류작업 클릭 시 스트레스를 0.1 낮춥니다.',
    className: 'buff-item title-buff'
  }
};

const animations = [
  [
    '   O\n  /|\\\\   [PC]\n  / \\\\',
    '  \\O\n   |\\\\   [PC]\n  / \\\\',
    '   O/\n  /|    [PC]\n  / \\\\'
  ],
  [
    '   O\n  /|\\\\   [서류]\n  / \\\\',
    '   O\n  /|\\\\   [도장]\n  / \\\\',
    '   O\n  /|\\\\   [검토]\n  / \\\\'
  ],
  [
    '   O\n  /|\\\\   (회의)\n  / \\\\',
    '   O\n  /|\\\\   (전화)\n  / \\\\',
    '   O\n  /|\\\\   (메모)\n  / \\\\'
  ]
];

let updateInterval;
let rankingInterval;
let syncInterval;
let animationInterval;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupEventListeners();
  tryAutoLogin();
}

function setupEventListeners() {
  bindClick('loginBtn', handleLoginClick);
  bindClick('logoutBtn', handleLogoutClick);
  bindClick('setNicknameBtn', handleSetNicknameClick);
  bindClick('clickWorkBtn', handleClickWork);
  bindClick('lupinBtn', handleLupinClick);
  bindClick('napBtn', handleNapClick);
  bindClick('fieldWorkBtn', handleFieldWorkClick);
  bindClick('stockInvestBtn', handleStockInvest);
  bindClick('adminLogoutBtn', handleLogoutClick);
  bindClick('adminGiftBtn', handleAdminGift);
  bindClick('adminDeleteUserBtn', handleAdminDeleteUser);

  const giftType = document.getElementById('giftTypeSelect');
  if (giftType) {
    giftType.removeEventListener('change', renderAdminGiftOptions);
    giftType.addEventListener('change', renderAdminGiftOptions);
  }
}

function bindClick(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.removeEventListener('click', handler);
  element.addEventListener('click', handler);
}

function getStoredUser() {
  const value = localStorage.getItem('user');
  return value ? JSON.parse(value) : null;
}

function saveStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function getStoredAdmin() {
  const value = localStorage.getItem('adminSession');
  return value ? JSON.parse(value) : null;
}

function saveStoredAdmin(adminSession) {
  localStorage.setItem('adminSession', JSON.stringify(adminSession));
}

function clearIntervals() {
  if (animationInterval) clearInterval(animationInterval);
  if (updateInterval) clearInterval(updateInterval);
  if (rankingInterval) clearInterval(rankingInterval);
  if (syncInterval) clearInterval(syncInterval);
}

function clearSessions() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('adminSession');
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function getUserToken() {
  return localStorage.getItem('token');
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

function showNotifications(notifications = []) {
  notifications.forEach((notification) => {
    if (notification?.text) alert(notification.text);
  });
}

function hideAllScreens() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('admin-screen').classList.add('hidden');
}

async function handleLoginClick(event) {
  event?.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/login`, { username, password });
    processLoginSuccess(data);
  } catch (err) {
    alert(`로그인 실패: ${err.message}`);
  }
}

function processLoginSuccess(data) {
  clearSessions();
  localStorage.setItem('token', data.token);

  if (data.isAdmin) {
    saveStoredAdmin({
      token: data.token,
      admin: data.admin,
      giftCatalog: data.giftCatalog
    });
    showAdminScreen();
    return;
  }

  saveStoredUser(data.user);

  if (data.isNewUser || !data.user.nickname) {
    hideAllScreens();
    document.getElementById('nickname-screen').classList.remove('hidden');
    alert('환영합니다. 게임에서 사용할 닉네임을 설정해주세요.');
    return;
  }

  showGameScreen(data.user);
  showNotifications(data.notifications);
}

async function handleSetNicknameClick() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const user = getStoredUser();

  if (!nickname) {
    alert('닉네임을 입력해주세요.');
    return;
  }

  if (!user?._id) {
    handleLogoutClick();
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/set-nickname`, {
      userId: user._id,
      nickname
    });

    user.nickname = data.nickname;
    user.displayName = data.nickname;
    saveStoredUser(user);
    showGameScreen(user);
    alert('닉네임이 설정되었습니다.');
  } catch (err) {
    alert(err.message);
  }
}

function tryAutoLogin() {
  const adminSession = getStoredAdmin();
  if (adminSession?.token) {
    showAdminScreen();
    return;
  }

  const user = getStoredUser();
  const token = getUserToken();
  if (!user || !token) return;

  try {
    if (!user.nickname) throw new Error('nickname missing');
    showGameScreen(user);
  } catch {
    clearSessions();
  }
}

function handleLogoutClick() {
  clearIntervals();
  clearSessions();
  hideAllScreens();

  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function getEquippedTitleDetail(user) {
  return (user.titleDetails || []).find((title) => title.equipped) || null;
}

function getMainName(user) {
  const equippedTitle = getEquippedTitleDetail(user);
  const titlePrefix = equippedTitle ? `<${equippedTitle.name}>` : '';
  return `${titlePrefix}${user.nickname || user.username || '사원'}`;
}

async function handleClickWork() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('clickWorkBtn');
  btn.disabled = true;
  btn.textContent = '서류 작업 중...';

  try {
    const data = await postJson(`${API_URL}/api/action/work`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '서류 작업하기 (클릭 경험치 획득)';
  }
}

async function handleLupinClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('lupinBtn');
  btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/lupin`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleNapClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('napBtn');
  btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/nap`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleFieldWorkClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('fieldWorkBtn');
  btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/field-work`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleStockInvest() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  if (user.pendingStockInvestment?.amount > 0) {
    alert('이미 오늘 주식 투자를 완료했습니다. 결과 확인 후 다시 투자할 수 있습니다.');
    return;
  }

  const input = document.getElementById('stockAmount');
  const rawValue = input.value.replaceAll(',', '').trim();
  const amount = Math.floor(Number(rawValue));

  if (!Number.isFinite(amount) || amount <= 0) {
    alert('투자 금액을 숫자로 입력해주세요.');
    return;
  }

  if (!confirm('정말 투자하시겠습니까?')) return;

  const btn = document.getElementById('stockInvestBtn');
  btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/stock`, {
      userId: user._id,
      amount
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
}

async function handleBuyClick(itemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const price = user.shopPrices?.[itemId] ?? 0;
  const itemName = ITEM_DATA[itemId]?.name || '아이템';
  if (!confirm(`${itemName}을(를) ${formatNumber(price)}원에 구매하시겠습니까?`)) return;

  try {
    const data = await postJson(`${API_URL}/api/shop/buy`, {
      userId: user._id,
      itemId
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleUseItem(itemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/inventory/use`, {
      userId: user._id,
      itemId
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleTitle(titleId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/title/toggle`, {
      userId: user._id,
      titleId
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

function updateLocalUserState(data) {
  if (!data?.user) return;
  saveStoredUser(data.user);
  updateGameUI(data.user);
  showNotifications(data.notifications);
}

function showGameScreen(user) {
  clearIntervals();
  hideAllScreens();
  document.getElementById('game-screen').classList.remove('hidden');
  updateGameUI(user);
  startAnimation();
  startPeriodicUpdates();
}

function updateGameUI(user) {
  updateStatusUI(user);
  updateBuffUI(user);
  updateInventoryUI(user);
  updateShopUI(user);
  updateStatsTab(user);
  updateStockStatus(user);
  updateStressEffect(user.gameState?.stress || 0);
}

function updateStatusUI(user) {
  const state = user.gameState;
  const itemStats = user.itemStats || {};
  if (!state) return;

  setText('userNickname', getMainName(user));
  setText('money', formatNumber(Math.floor(state.money)));
  setText('salaryRate', formatNumber(state.salaryPerMinute ?? 0, 2));
  setText('level', state.level);
  setText('stamina', `${state.stamina}/${state.maxStamina}`);

  const stressEl = document.getElementById('stress');
  stressEl.textContent = formatNumber(state.stress ?? 0, 2);
  stressEl.style.color = state.stress >= 100 ? 'red' : '';
  stressEl.style.fontWeight = state.stress >= 100 ? 'bold' : 'normal';

  const maxExp = state.nextLevelExp || 1000;
  setText('expText', `${formatNumber(state.exp)}/${formatNumber(maxExp)}`);
  const expBar = document.getElementById('expBar');
  if (expBar) {
    expBar.max = maxExp;
    expBar.value = state.exp;
  }

  const equippedTitle = getEquippedTitleDetail(user);
  setText('currentTitleText', equippedTitle ? equippedTitle.name : '없음');
  setText('passiveExpPreview', formatNumber(state.passiveDailyExp ?? 0, 2));
  setText('clickExpPreview', formatNumber(state.clickExp ?? 0));
  setText('stressReductionPreview', `${formatNumber(itemStats.stressReduction ?? 0, 2)}%`);
}

function updateBuffUI(user) {
  const buffListEl = document.getElementById('buff-list');
  if (!buffListEl) return;

  buffListEl.innerHTML = '';
  let hasAnyBuff = false;
  const now = new Date();

  const equippedTitle = getEquippedTitleDetail(user);
  if (equippedTitle) {
    hasAnyBuff = true;
    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="buff-item title-buff">
          칭호 버프: ${escapeHtml(equippedTitle.name)}
          <span class="buff-tooltip">
            <strong>${escapeHtml(equippedTitle.name)}</strong><br>
            ${escapeHtml(equippedTitle.desc)}
          </span>
        </div>
      `
    );
  }

  (user.buffs || []).forEach((buff) => {
    const info = BUFF_DATA[buff.buffId];
    if (!info) return;

    const expiresAt = new Date(buff.expiresAt);
    if (expiresAt <= now) return;

    hasAnyBuff = true;
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.floor((remainingMs % 60000) / 1000);
    const className = info.className || 'buff-item';

    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="${className}">
          ${escapeHtml(info.name)}
          <span class="buff-tooltip">
            <strong>${escapeHtml(info.name)}</strong><br>
            ${escapeHtml(info.desc || '')}${info.desc ? '<br><br>' : ''}
            (${remainingMin}분 ${remainingSec}초 남음)
          </span>
        </div>
      `
    );
  });

  if ((user.gameState?.stress || 0) >= 100) {
    hasAnyBuff = true;
    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="debuff-item">
          스트레스 과다
          <span class="buff-tooltip">
            <strong>스트레스 과다</strong><br>
            자동 경험치는 절반만 획득하고<br>
            서류 작업 클릭 경험치는 획득할 수 없습니다.
          </span>
        </div>
      `
    );
  }

  if (!hasAnyBuff) {
    buffListEl.textContent = '(없음)';
  }
}

function updateInventoryUI(user) {
  const inventoryList = document.getElementById('inventory-list');
  const titleList = document.getElementById('title-list');
  if (!inventoryList || !titleList) return;

  inventoryList.innerHTML = '';
  const inventory = user.inventory || [];

  if (inventory.length === 0) {
    inventoryList.innerHTML = '<tr><td colspan="4">가방이 비어 있습니다.</td></tr>';
  } else {
    inventory.forEach((item) => {
      const tooltipSource = ITEM_DATA[item.itemId];
      const title = tooltipSource?.name || item.itemId;
      const desc = tooltipSource?.hoverDesc || '';
      const shortDesc = tooltipSource?.desc || '';
      const actionButton = tooltipSource && ['bacchus', 'hot6'].includes(item.itemId)
        ? `<button class="mini-btn" onclick="handleUseItem('${item.itemId}')">사용</button>`
        : '<span class="muted-text">상시 적용</span>';

      inventoryList.insertAdjacentHTML(
        'beforeend',
        `
          <tr>
            <td title="${escapeHtml(desc)}">${escapeHtml(title)}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td title="${escapeHtml(desc)}">${escapeHtml(shortDesc)}</td>
            <td>${actionButton}</td>
          </tr>
        `
      );
    });
  }

  titleList.innerHTML = '';
  const titleDetails = user.titleDetails || [];

  if (titleDetails.length === 0) {
    titleList.innerHTML = '<tr><td colspan="3">아직 해금한 칭호가 없습니다.</td></tr>';
    return;
  }

  titleDetails.forEach((title) => {
    titleList.insertAdjacentHTML(
      'beforeend',
      `
        <tr class="${title.equipped ? 'equipped-title-row' : ''}">
          <td title="${escapeHtml(title.unlockDesc || '')}">${escapeHtml(title.name)}</td>
          <td title="${escapeHtml(title.unlockDesc || '')}">${escapeHtml(title.desc)}</td>
          <td><button class="mini-btn" onclick="handleToggleTitle('${title.id}')">${title.equipped ? '해제' : '장착'}</button></td>
        </tr>
      `
    );
  });
}

function updateShopUI(user) {
  const shopList = document.getElementById('shop-list');
  if (!shopList) return;

  shopList.innerHTML = '';
  Object.entries(ITEM_DATA).forEach(([itemId, itemInfo]) => {
    const price = user.shopPrices?.[itemId] ?? 0;

    shopList.insertAdjacentHTML(
      'beforeend',
      `
        <tr>
          <td>${escapeHtml(itemInfo.name)}</td>
          <td>${formatNumber(price)}원</td>
          <td>${escapeHtml(itemInfo.desc || '')}</td>
          <td><button class="mini-btn" onclick="handleBuyClick('${itemId}')">구매</button></td>
        </tr>
      `
    );
  });
}

function updateStatsTab(user) {
  const statsList = document.getElementById('stats-list');
  if (!statsList) return;

  const state = user.gameState || {};
  const itemStats = user.itemStats || {};
  const equippedTitle = getEquippedTitleDetail(user);
  const pendingStock = user.pendingStockInvestment?.amount > 0
    ? `${formatNumber(user.pendingStockInvestment.amount)}원 투자 완료`
    : '없음';

  statsList.innerHTML = `
    <tr><td>레벨</td><td>${formatNumber(state.level)}</td></tr>
    <tr><td>보유 자산</td><td>${formatNumber(Math.floor(state.money || 0))}원</td></tr>
    <tr><td>현재 분당 월급</td><td>${formatNumber(state.salaryPerMinute || 0, 2)}원</td></tr>
    <tr><td>하루 자동 경험치</td><td>${formatNumber(state.passiveDailyExp || 0, 2)}</td></tr>
    <tr><td>서류 작업 클릭 경험치</td><td>${formatNumber(state.clickExp || 0)}</td></tr>
    <tr><td>스트레스</td><td>${formatNumber(state.stress || 0, 2)} / 100</td></tr>
    <tr><td>스트레스 적용률</td><td>${formatNumber((itemStats.stressMultiplier || 1) * 100, 2)}%</td></tr>
    <tr><td>스트레스 감소율</td><td>${formatNumber(itemStats.stressReduction || 0, 2)}%</td></tr>
    <tr><td>월급 보너스</td><td>+${formatNumber(itemStats.moneyBonus || 0, 2)}%</td></tr>
    <tr><td>시간당 스트레스 회복</td><td>${formatNumber(itemStats.hourlyStressRelief || 0, 2)}</td></tr>
    <tr><td>행동력</td><td>${formatNumber(state.stamina || 0)} / ${formatNumber(state.maxStamina || 0)}</td></tr>
    <tr><td>장착 칭호</td><td>${escapeHtml(equippedTitle?.name || '없음')}</td></tr>
    <tr><td>주식 투자 현황</td><td>${escapeHtml(pendingStock)}</td></tr>
    <tr><td>오늘 쇼핑 누적</td><td>${formatNumber(user.shopState?.dailySpend || 0)}원</td></tr>
  `;
}

function updateStockStatus(user) {
  const stockStatus = document.getElementById('stock-status');
  const stockInput = document.getElementById('stockAmount');
  const stockButton = document.getElementById('stockInvestBtn');
  if (!stockStatus || !stockInput || !stockButton) return;

  const pendingAmount = user.pendingStockInvestment?.amount || 0;
  const isLocked = pendingAmount > 0;

  stockInput.disabled = isLocked;
  stockButton.disabled = isLocked;

  if (isLocked) {
    stockInput.value = '';
    stockInput.placeholder = `${formatNumber(pendingAmount)}원을 투자했습니다.`;
    stockStatus.textContent = `현재 ${formatNumber(pendingAmount)}원이 투자 중이며, 다음 로그인 때 결과를 확인합니다.`;
  } else {
    stockInput.placeholder = '투자 금액';
    stockStatus.textContent = '하루 1회 투자할 수 있으며, 다음 로그인 시 결과를 확인합니다.';
  }
}

function updateStressEffect(stress) {
  const gameScreen = document.getElementById('game-screen');
  if (!gameScreen) return;

  if (stress >= 90) gameScreen.classList.add('stress-warning');
  else gameScreen.classList.remove('stress-warning');
}

async function syncUserState() {
  const user = getStoredUser();
  if (!user?._id) return;

  try {
    const data = await postJson(`${API_URL}/api/sync`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    console.error('State sync failed:', err);
  }
}

async function updateRankingUI() {
  const rankingListBody = document.getElementById('ranking-list-body');
  if (!rankingListBody) return;

  try {
    const rankingData = await getJson(`${API_URL}/api/ranking`);
    rankingListBody.innerHTML = '';

    if (rankingData.length === 0) {
      rankingListBody.innerHTML = '<tr><td colspan="3" class="center-text">랭킹 정보가 없습니다.</td></tr>';
      return;
    }

    rankingData.forEach((entry, index) => {
      let rankClass = '';
      if (index === 0) rankClass = 'rank-1';
      if (index === 1) rankClass = 'rank-2';
      if (index === 2) rankClass = 'rank-3';

      rankingListBody.insertAdjacentHTML(
        'beforeend',
        `
          <tr class="${rankClass}" title="현재 경험치 ${formatNumber(entry.gameState.exp)}">
            <td class="center-text">${index + 1}</td>
            <td>${escapeHtml(entry.displayName || entry.nickname)}</td>
            <td class="center-text">${formatNumber(entry.gameState.level)}</td>
          </tr>
        `
      );
    });
  } catch {
    rankingListBody.innerHTML = '<tr><td colspan="3" class="center-text error-text">랭킹 로딩 실패</td></tr>';
  }
}

function startPeriodicUpdates() {
  clearIntervals();

  updateInterval = setInterval(() => {
    const user = getStoredUser();
    if (user) updateBuffUI(user);
  }, 1000);

  updateRankingUI();
  rankingInterval = setInterval(updateRankingUI, 5000);

  syncUserState();
  syncInterval = setInterval(syncUserState, 10000);
}

function startAnimation() {
  const animEl = document.getElementById('anim-display');
  if (!animEl) return;

  if (animationInterval) clearInterval(animationInterval);
  const currentAnimation = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

  animEl.textContent = currentAnimation[0];
  animationInterval = setInterval(() => {
    animEl.textContent = currentAnimation[frame];
    frame = (frame + 1) % currentAnimation.length;
  }, 450);
}

function showAdminScreen() {
  clearIntervals();
  hideAllScreens();
  document.getElementById('admin-screen').classList.remove('hidden');
  loadAdminUsers();
}

function getAdminAuthHeaders() {
  const session = getStoredAdmin();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function loadAdminUsers() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  try {
    const data = await getJson(`${API_URL}/api/admin/users`, getAdminAuthHeaders());
    saveStoredAdmin({
      ...session,
      giftCatalog: data.giftCatalog
    });
    renderAdminUsers(data.users);
    renderAdminGiftOptions();
    setText('adminStatus', `대상 유저 ${data.users.length}명을 불러왔습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

function renderAdminUsers(users) {
  const giftSelect = document.getElementById('giftTargetSelect');
  const deleteSelect = document.getElementById('deleteTargetSelect');
  if (!giftSelect || !deleteSelect) return;

  giftSelect.innerHTML = '<option value="ALL_USERS">전체 유저</option>';
  deleteSelect.innerHTML = '<option value="">삭제할 유저 선택</option>';
  users.forEach((user) => {
    giftSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    deleteSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
  });
}

function renderAdminGiftOptions() {
  const session = getStoredAdmin();
  const giftType = document.getElementById('giftTypeSelect');
  const giftSelect = document.getElementById('giftIdSelect');
  const quantityInput = document.getElementById('giftQuantity');
  if (!session?.giftCatalog || !giftType || !giftSelect || !quantityInput) return;

  const selectedType = giftType.value;
  const entries = selectedType === 'buff' ? session.giftCatalog.buffs : session.giftCatalog.items;

  giftSelect.innerHTML = '';
  entries.forEach((entry) => {
    giftSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`
    );
  });

  quantityInput.disabled = selectedType === 'buff';
  if (selectedType === 'buff') quantityInput.value = '1';
}

async function handleAdminGift() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const targetValue = document.getElementById('giftTargetSelect').value;
  const giftType = document.getElementById('giftTypeSelect').value;
  const giftId = document.getElementById('giftIdSelect').value;
  const quantity = Math.max(1, Math.floor(Number(document.getElementById('giftQuantity').value) || 1));

  if (!giftId) {
    alert('선물할 아이템 또는 버프를 선택해주세요.');
    return;
  }

  const targetMode = targetValue === 'ALL_USERS' ? 'all' : 'single';

  try {
    const data = await postJson(
      `${API_URL}/api/admin/gift`,
      {
        targetMode,
        targetUserId: targetMode === 'single' ? targetValue : null,
        giftType,
        giftId,
        quantity
      },
      getAdminAuthHeaders()
    );

    setText('adminStatus', `선물을 ${data.deliveredCount}명에게 발송했습니다.`);
    alert(`운영자 선물이 ${data.deliveredCount}명에게 발송되었습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

async function handleAdminDeleteUser() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const select = document.getElementById('deleteTargetSelect');
  if (!select?.value) {
    alert('삭제할 유저를 선택해주세요.');
    return;
  }

  const selectedLabel = select.options[select.selectedIndex]?.textContent || '선택한 유저';
  if (!confirm(`정말 ${selectedLabel} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/delete-user`,
      { targetUserId: select.value },
      getAdminAuthHeaders()
    );

    await loadAdminUsers();
    setText('adminStatus', `${data.deletedLabel} 계정을 삭제했습니다.`);
    alert(`${data.deletedLabel} 계정을 삭제했습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

window.showTab = function showTab(tabName) {
  document.querySelectorAll('.menu-content').forEach((element) => {
    element.classList.add('hidden');
  });

  document.querySelectorAll('.menu-tabs button').forEach((button) => {
    button.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');

  const activeButton = document.querySelector(`.menu-tabs button[data-tab="${tabName}"]`);
  if (activeButton) activeButton.classList.add('active');
};

window.handleBuyClick = handleBuyClick;
window.handleUseItem = handleUseItem;
window.handleToggleTitle = handleToggleTitle;
