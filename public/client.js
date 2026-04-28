const API_URL = window.location.origin;

const ITEM_DATA = {
  pen_monami: {
    name: '모나미 볼펜',
    type: 'passive',
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.05% 증가합니다.'
  },
  coffee_mix: {
    name: '맥심 커피믹스',
    type: 'passive',
    desc: '스트레스 증가량 2% 감소',
    hoverDesc: '보유량마다 현재 스트레스 증가량의 98%만 받습니다.'
  },
  bacchus: {
    name: '박카스',
    type: 'consumable',
    desc: '행동력 +1',
    hoverDesc: '가방에서 사용하면 행동력을 1 회복합니다.'
  },
  hot6: {
    name: '핫식스',
    type: 'consumable',
    desc: '스트레스 -10, 10분 버프',
    hoverDesc: '사용 즉시 스트레스를 10 낮추고, 10분 동안 서류작업 클릭마다 스트레스를 0.1 낮춥니다.'
  }
};

const BUFF_DATA = {
  lupin_stress_buff: {
    name: '월급루팡',
    desc: '1시간 동안 스트레스를 받지 않습니다.'
  },
  lupin_exp_buff: {
    name: '월급루팡 집중',
    desc: '2시간 동안 자동 및 클릭 경험치 획득량이 1.5배가 됩니다.'
  },
  hot6_buff: {
    name: '핫식스 버프',
    desc: '서류작업 클릭 시 스트레스를 0.1 낮춥니다.',
    className: 'title-buff'
  }
};

const TITLE_DATA = {
  beast_heart: {
    name: '야수의 심장',
    desc: '월급 5% 증가',
    unlockDesc: '현재 잔고 50만원 이상일 때 잔고의 90% 이상을 주식 투자'
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
  initGame();
});

function initGame() {
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
  bindClick('stockInvestBtn', handleStockInvest);
}

function bindClick(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.removeEventListener('click', handler);
  element.addEventListener('click', handler);
}

function getStoredUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function saveStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function clearIntervals() {
  if (animationInterval) clearInterval(animationInterval);
  if (updateInterval) clearInterval(updateInterval);
  if (rankingInterval) clearInterval(rankingInterval);
  if (syncInterval) clearInterval(syncInterval);
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

function getDisplayName(user) {
  if (user.displayName) return user.displayName;
  const equipped = user.titles?.equipped;
  if (equipped && TITLE_DATA[equipped]) {
    return `<${TITLE_DATA[equipped].name}> ${user.nickname}`;
  }
  return user.nickname || user.username || '사원';
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

function showNotifications(notifications = []) {
  notifications.forEach((notification) => {
    if (notification?.text) alert(notification.text);
  });
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
  localStorage.setItem('token', data.token);
  saveStoredUser(data.user);

  if (data.isNewUser || !data.user.nickname) {
    document.getElementById('login-screen').classList.add('hidden');
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
    document.getElementById('nickname-screen').classList.add('hidden');
    showGameScreen(user);
    alert('닉네임이 설정되었습니다.');
  } catch (err) {
    alert(err.message);
  }
}

function tryAutoLogin() {
  const user = getStoredUser();
  const token = localStorage.getItem('token');
  if (!user || !token) return;

  try {
    if (!user.nickname) throw new Error('nickname missing');
    showGameScreen(user);
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }
}

function handleLogoutClick() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  clearIntervals();

  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
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

async function handleStockInvest() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const input = document.getElementById('stockAmount');
  const rawValue = input.value.replaceAll(',', '').trim();
  const amount = Math.floor(Number(rawValue));

  if (!Number.isFinite(amount) || amount <= 0) {
    alert('투자 금액을 숫자로 입력해주세요.');
    return;
  }

  const btn = document.getElementById('stockInvestBtn');
  btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/stock`, {
      userId: user._id,
      amount
    });
    input.value = '';
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
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
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  updateGameUI(user);
  startAnimation();
  startPeriodicUpdates();
}

function updateGameUI(user) {
  updateUI(user);
  updateBuffUI(user);
  updateInventoryUI(user);
  updateShopUI(user);
  updateStatsTab(user);
  updateStockStatus(user);
  updateStressEffect(user.gameState?.stress || 0);
}

function updateUI(user) {
  const state = user.gameState;
  const itemStats = user.itemStats || {};
  if (!state) return;

  setText('userNickname', getDisplayName(user));
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

  setText('currentTitleText', user.titles?.equipped ? TITLE_DATA[user.titles.equipped]?.name || '장착 중' : '없음');
  setText('passiveExpPreview', formatNumber(state.passiveDailyExp ?? 0, 2));
  setText('clickExpPreview', formatNumber(state.clickExp ?? 0));
  setText('stressReductionPreview', `${formatNumber(itemStats.stressReduction ?? 0, 2)}%`);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateBuffUI(user) {
  const buffListEl = document.getElementById('buff-list');
  if (!buffListEl) return;

  buffListEl.innerHTML = '';
  let hasAnyBuff = false;
  const now = new Date();

  if (user.titles?.equipped && TITLE_DATA[user.titles.equipped]) {
    const titleInfo = TITLE_DATA[user.titles.equipped];
    hasAnyBuff = true;
    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="buff-item title-buff">
          ${escapeHtml(titleInfo.name)}
          <span class="buff-tooltip">
            <strong>${escapeHtml(titleInfo.name)}</strong><br>
            ${escapeHtml(titleInfo.desc)}
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
            ${escapeHtml(info.desc)}<br><br>
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
      const itemInfo = ITEM_DATA[item.itemId];
      if (!itemInfo) return;
      const tooltip = escapeHtml(itemInfo.hoverDesc || itemInfo.desc);
      const actionButton = itemInfo.type === 'consumable'
        ? `<button class="mini-btn" onclick="handleUseItem('${item.itemId}')">사용</button>`
        : '<span class="muted-text">상시 적용</span>';

      inventoryList.insertAdjacentHTML(
        'beforeend',
        `
          <tr>
            <td title="${tooltip}">${escapeHtml(itemInfo.name)}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td title="${tooltip}">${escapeHtml(itemInfo.desc)}</td>
            <td>${actionButton}</td>
          </tr>
        `
      );
    });
  }

  titleList.innerHTML = '';
  const unlockedTitles = user.titles?.unlocked || [];
  if (unlockedTitles.length === 0) {
    titleList.innerHTML = '<tr><td colspan="3">아직 해금한 칭호가 없습니다.</td></tr>';
    return;
  }

  unlockedTitles.forEach((titleId) => {
    const titleInfo = TITLE_DATA[titleId];
    if (!titleInfo) return;

    const equipped = user.titles?.equipped === titleId;
    titleList.insertAdjacentHTML(
      'beforeend',
      `
        <tr class="${equipped ? 'equipped-title-row' : ''}">
          <td title="${escapeHtml(titleInfo.unlockDesc)}">${escapeHtml(titleInfo.name)}</td>
          <td title="${escapeHtml(titleInfo.desc)}">${escapeHtml(titleInfo.desc)}</td>
          <td>
            <button class="mini-btn" onclick="handleToggleTitle('${titleId}')">${equipped ? '해제' : '장착'}</button>
          </td>
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
    const tooltip = escapeHtml(itemInfo.hoverDesc || itemInfo.desc);
    const typeLabel = itemInfo.type === 'consumable' ? '소모품' : '상시효과';

    shopList.insertAdjacentHTML(
      'beforeend',
      `
        <tr>
          <td>${escapeHtml(itemInfo.name)}</td>
          <td>${formatNumber(price)}원</td>
          <td title="${tooltip}">
            <div>${escapeHtml(itemInfo.desc)}</div>
            <div class="muted-text">${typeLabel}</div>
          </td>
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
  const titleName = user.titles?.equipped ? TITLE_DATA[user.titles.equipped]?.name || user.titles.equipped : '없음';
  const pendingStock = user.pendingStockInvestment?.amount > 0
    ? `${formatNumber(user.pendingStockInvestment.amount)}원 투자 대기`
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
    <tr><td>행동력</td><td>${formatNumber(state.stamina || 0)} / ${formatNumber(state.maxStamina || 0)}</td></tr>
    <tr><td>서류 작업 스트레스 완화</td><td>${formatNumber(itemStats.clickStressRelief || 0, 2)}</td></tr>
    <tr><td>장착 칭호</td><td>${escapeHtml(titleName)}</td></tr>
    <tr><td>주식 투자 현황</td><td>${escapeHtml(pendingStock)}</td></tr>
  `;
}

function updateStockStatus(user) {
  const stockStatus = document.getElementById('stock-status');
  if (!stockStatus) return;

  const pendingAmount = user.pendingStockInvestment?.amount || 0;
  if (pendingAmount > 0) {
    stockStatus.textContent = `현재 ${formatNumber(pendingAmount)}원이 투자 중이며, 다음 접속 시 결과를 확인합니다.`;
  } else {
    stockStatus.textContent = '정산 대기 중인 주식 투자가 없습니다.';
  }
}

function updateStressEffect(stress) {
  const gameScreen = document.getElementById('game-screen');
  if (!gameScreen) return;

  if (stress >= 90) {
    gameScreen.classList.add('stress-warning');
  } else {
    gameScreen.classList.remove('stress-warning');
  }
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
    const res = await fetch(`${API_URL}/api/ranking`);
    const rankingData = await res.json();
    if (!res.ok) throw new Error(rankingData.msg || '랭킹을 불러오지 못했습니다.');

    rankingListBody.innerHTML = '';

    if (rankingData.length === 0) {
      rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">랭킹 정보가 없습니다.</td></tr>';
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
            <td style="text-align:center;">${index + 1}</td>
            <td>${escapeHtml(entry.displayName || entry.nickname)}</td>
            <td style="text-align:center;">${formatNumber(entry.gameState.level)}</td>
          </tr>
        `
      );
    });
  } catch (err) {
    rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">랭킹 로딩 실패</td></tr>';
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

  clearInterval(animationInterval);
  const currentAnimation = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

  animEl.textContent = currentAnimation[0];
  animationInterval = setInterval(() => {
    animEl.textContent = currentAnimation[frame];
    frame = (frame + 1) % currentAnimation.length;
  }, 450);
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
