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
  },
  tylenol: {
    name: '타이레놀',
    desc: '현재 걸린 모든 디버프 제거',
    hoverDesc: '사용 시 현재 걸려 있는 모든 디버프를 제거합니다.'
  },
  raid_entry_ticket: {
    name: '회의 추가 입장권',
    desc: '오늘 보스 레이드 입장 횟수 +1',
    hoverDesc: '사용 시 오늘 보스 레이드 추가 입장 가능 횟수가 1회 증가합니다.',
    shopHidden: true
  },
  hagendaz: {
    name: '하겐다즈',
    desc: '사용 즉시 1레벨 상승',
    hoverDesc: '사용 시 즉시 1레벨 상승하며 현재 경험치는 0으로 초기화됩니다.',
    shopHidden: true
  },
  business_card: {
    name: '명함',
    desc: '카드 뽑기에 사용하는 재화',
    hoverDesc: '카드 뽑기 전용 재화입니다.'
  },
  cat_tuna_can: {
    name: '고양이 참치캔',
    desc: '고양이에게 줄 수 있음',
    hoverDesc: '모험 중 회사 밖에서 고양이를 만났을 때 건네줄 수 있습니다.'
  }
};

const CARD_DATA = {
  ineo_diet: { name: '이네오의 다이어트 선언', grade: 'S', color: '#c62828', skillName: '다이어트 선언', skillDesc: '돌아오는 턴에 기본 공격을 총 10회 합니다. 각 공격마다 크리티컬이 적용될 수 있습니다.', cooldown: 3, targetType: null },
  gangnam_style: { name: '일 중에 몰래 듣는 강남스타일', grade: 'S', color: '#c62828', skillName: '강남스타일', skillDesc: '1턴 동안 모든 팀원에게 크리티컬률 20%와 흥겨움 버프를 부여합니다. 흥겨움 동안 기본 공격 횟수가 2배가 됩니다.', cooldown: 2, targetType: null },
  delegate_lee: { name: '이것 좀 대신 해줘 이대리', grade: 'S', color: '#c62828', skillName: '이것 좀 대신 해줘', skillDesc: '현재 입장한 파티원의 전체 레벨 합 x 30의 데미지를 1회 가합니다.', cooldown: 2, targetType: null },
  celine_tears: { name: '구마의 눈물 젖은 셀린느', grade: 'S', color: '#c62828', skillName: '셀린느', skillDesc: '1턴 동안 <셀린느> 버프를 얻어 공격력이 50% 증가하고, 버프가 끝날 때 자신의 레벨 x 60 피해를 입힙니다.', cooldown: 2, targetType: null },
  strawberry_latte: { name: '딸기라떼', grade: 'A', color: '#f9a825', skillName: '딸기라떼', skillDesc: '다음 턴까지 지속되는 보호막 40을 파티원 전원에게 제공합니다.', cooldown: 2, targetType: null },
  rebuttal: { name: '반박', grade: 'A', color: '#f9a825', skillName: '반박', skillDesc: '파티원 전체의 HP를 20 회복합니다.', cooldown: 2, targetType: null },
  parking_master: { name: '멍프의 주차', grade: 'A', color: '#f9a825', skillName: '멍프의 주차', skillDesc: '돌아오는 턴에 기본 공격을 총 4회 합니다. 각 공격마다 크리티컬이 적용될 수 있습니다.', cooldown: 2, targetType: null },
  tissue_box: { name: '김주임의 휴지곽', grade: 'A', color: '#f9a825', skillName: '휴지곽', skillDesc: '2턴 동안 자신이 반격 버프를 획득합니다. 피격당하면 피격 1회당 기본 공격 1번으로 반격합니다.', cooldown: 2, targetType: null },
  drinking_angle: { name: '야채곱창', grade: 'A', color: '#f9a825', skillName: '소주각?', skillDesc: '액티브 스킬 없음. 전투 시작 시 모든 파티원에게 전리품 2배 버프를 부여합니다.', cooldown: 0, targetType: null, passiveOnly: true },
  tax_invoice: { name: '호이의 세금계산서', grade: 'A', color: '#f9a825', skillName: '세금계산서', skillDesc: '파티원 2인을 선택하여 1회 피격 무효화, 1턴 공격력 25% 증가, 1회 디버프 무효화를 부여합니다.', cooldown: 3, targetType: 'ally_pair' },
  rotation_blind_date: { name: '코카의 로테이션 소개팅', grade: 'A', color: '#f9a825', skillName: '소개팅 상대', skillDesc: '액티브 스킬 없음. 매 턴 자신을 제외한 파티원 1명에게 카드 효과를 1.5배로 증폭하는 <소개팅 상대> 버프를 차례대로 줍니다.', cooldown: 0, targetType: null, passiveOnly: true },
  sherlock: { name: '셜록몬드의 추리', grade: 'B', color: '#1565c0', skillName: '셜록몬드의 추리', skillDesc: '다다음 턴까지 파티원 전원의 크리티컬 확률을 50% 증가시킵니다.', cooldown: 5, targetType: null },
  blind_date: { name: '심심이의 소개팅', grade: 'B', color: '#1565c0', skillName: '심심이의 소개팅', skillDesc: '랜덤 파티원 1명의 HP를 30 감소시키지만 다음 공격 피해를 2배로 증가시킵니다.', cooldown: 3, targetType: null },
  fantasy: { name: '라연이의 망상', grade: 'B', color: '#1565c0', skillName: '라연이의 망상', skillDesc: '파티원 전원의 해로운 효과를 제거합니다.', cooldown: 4, targetType: null },
  broken_leg: { name: '감자의 부러진 다리', grade: 'B', color: '#1565c0', skillName: '감자의 부러진 다리', skillDesc: '선택한 파티원 1명의 HP를 30 회복시킵니다.', cooldown: 2, targetType: 'ally' },
  military_service: { name: '자네, 군필인가?', grade: 'B', color: '#1565c0', skillName: '군필인가?', skillDesc: '이번 턴에 가하는 자신의 모든 공격에 자신의 레벨 x 20의 추가 데미지를 줍니다.', cooldown: 2, targetType: null },
  invincible_logic: { name: '무적의 논리', grade: 'B', color: '#1565c0', skillName: '무적의 논리', skillDesc: '파티원 1인을 선택하여 해당 팀원에게 1회 피격 무효화 버프를 제공합니다.', cooldown: 2, targetType: 'ally' },
  ride_line: { name: '라인 잘타야지', grade: 'B', color: '#1565c0', skillName: '라인 잘타야지', skillDesc: '랜덤 파티원 2인의 공격력을 1턴 동안 25% 증가시킵니다.', cooldown: 4, targetType: null },
  wig: { name: '김부장의 가발', grade: 'C', color: '#2e7d32', skillName: '김부장의 가발', skillDesc: '돌아오는 턴에 자신의 기본 공격을 총 3회 합니다.', cooldown: 3, targetType: null },
  chatgpt: { name: '모래의 챗지피티', grade: 'C', color: '#2e7d32', skillName: '모래의 챗지피티', skillDesc: '돌아오는 턴에 기본공격에 더해 자신의 레벨 x 10 추가 피해를 입힙니다.', cooldown: 2, targetType: null },
  pho: { name: '닐닐이의 쌀국수', grade: 'C', color: '#2e7d32', skillName: '닐닐이의 쌀국수', skillDesc: '랜덤 파티원 3명에게 각각 50의 보호막을 제공합니다.', cooldown: 3, targetType: null },
  coca_cola: { name: '코카의 콜라', grade: 'C', color: '#2e7d32', skillName: '코카의 콜라', skillDesc: '선택한 파티원 1인의 공격력을 2턴 동안 30% 증가시킵니다.', cooldown: 3, targetType: 'ally' },
  cider_comment: { name: '사이다 발언', grade: 'C', color: '#2e7d32', skillName: '사이다 발언', skillDesc: '파티원 1인을 선택하여 해당 팀원에게 1회 모든 디버프 무효화 버프를 제공합니다.', cooldown: 3, targetType: 'ally' },
  rooftop_pigeons: { name: '옥상의 비둘기떼', grade: 'C', color: '#2e7d32', skillName: '비둘기떼', skillDesc: '자신의 레벨 x 8의 데미지로 5회 공격합니다.', cooldown: 3, targetType: null }
};

const BUFF_DATA = {
  lupin_stress_buff: { name: '월급루팡' },
  lupin_exp_buff: { name: '월급루팡 집중' },
  field_work_buff: {
    name: '외근 버프',
    desc: '12시간 동안 자동 획득 경험치가 5배가 되고, 서류작업 클릭 경험치는 절반이 됩니다.'
  },
  confidence_buff: {
    name: '자신감',
    desc: '1시간 동안 모든 경험치 획득량이 1.8배가 됩니다.'
  },
  fatigue_debuff: {
    name: '피로감',
    desc: '4시간 동안 모든 경험치 획득량이 절반으로 감소합니다.',
    className: 'debuff-item'
  },
  cat_gratitude_buff: {
    name: '고양이의 보은',
    desc: '1시간 동안 모든 경험치 획득량이 2배가 됩니다.',
    className: 'buff-item title-buff'
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
    '   O\n  /|>   [PC]\n  / \\\\',
    '   O\n  <|\\\\   [PC]\n  / \\\\'
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
let raidPollInterval;
let modalResolver = null;
let latestGlobalState = { activeShoutText: '', activeShoutKey: '' };
let lastRenderedShoutKey = '';
let latestRaidState = null;
let raidCountdownVisible = false;

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
  bindClick('adventureBtn', handleAdventureClick);
  bindClick('shoutBtn', handleShoutClick);
  bindClick('lupinBtn', handleLupinClick);
  bindClick('napBtn', handleNapClick);
  bindClick('fieldWorkBtn', handleFieldWorkClick);
  bindClick('raidLobbyBtn', openRaidLobby);
  bindClick('raidLobbyCloseBtn', closeRaidLobby);
  bindClick('raidStartBtn', handleRaidStartClick);
  bindClick('raidCountdownCancelBtn', handleRaidCountdownCancelClick);
  bindClick('raidBackBtn', handleRaidBackClick);
  bindClick('cardDrawBtn', handleCardDraw);
  bindClick('stockInvestBtn', handleStockInvest);
  bindClick('adminLogoutBtn', handleLogoutClick);
  bindClick('adminGiftBtn', handleAdminGift);
  bindClick('adminDeleteUserBtn', handleAdminDeleteUser);
  bindClick('adminSetLevelBtn', handleAdminSetLevel);

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
  if (raidPollInterval) clearInterval(raidPollInterval);
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

function setHtml(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function getBusinessCardCount(user) {
  return (user.inventory || []).find((item) => item.itemId === 'business_card')?.quantity || 0;
}

function getEquippedCardDetail(user) {
  return (user.cardDetails || []).find((card) => card.equipped) || null;
}

function hideModal(id) {
  const element = document.getElementById(id);
  if (element) element.classList.add('hidden');
}

function showModal(id) {
  const element = document.getElementById(id);
  if (element) element.classList.remove('hidden');
}

function closeDecisionModal(result = null) {
  const overlay = document.getElementById('decisionModal');
  if (overlay) overlay.classList.add('hidden');

  const resolver = modalResolver;
  modalResolver = null;
  if (resolver) resolver(result);
}

function applyGlobalState(globalState = {}) {
  latestGlobalState = {
    activeShoutText: globalState.activeShoutText || '',
    activeShoutKey: globalState.activeShoutKey || ''
  };
  updateShoutBanner(latestGlobalState);
}

function updateShoutBanner(globalState = latestGlobalState) {
  const banner = document.getElementById('shoutBanner');
  const textEl = document.getElementById('shoutBannerText');
  if (!banner || !textEl) return;

  const shoutText = globalState.activeShoutText || '';
  const shoutKey = globalState.activeShoutKey || '';

  if (!shoutText) {
    banner.classList.add('shout-banner-empty');
    textEl.classList.remove('shout-banner-text');
    textEl.textContent = '';
    lastRenderedShoutKey = '';
    return;
  }

  banner.classList.remove('shout-banner-empty');
  if (lastRenderedShoutKey === shoutKey) return;

  textEl.classList.remove('shout-banner-text');
  void textEl.offsetWidth;
  textEl.textContent = shoutText;
  textEl.classList.add('shout-banner-text');
  lastRenderedShoutKey = shoutKey;
}

function updateShoutStatus(user) {
  const statusEl = document.getElementById('shoutStatus');
  const shoutBtn = document.getElementById('shoutBtn');
  if (!statusEl || !shoutBtn) return;

  const lastShoutAt = user?.meta?.lastShoutAt ? new Date(user.meta.lastShoutAt) : null;
  const remainMs = lastShoutAt
    ? Math.max(0, (10 * 60 * 1000) - (Date.now() - lastShoutAt.getTime()))
    : 0;

  if (remainMs <= 0) {
    statusEl.textContent = '외치기를 지금 사용할 수 있습니다.';
    shoutBtn.disabled = false;
    return;
  }

  const remainMinutes = Math.floor(remainMs / 60000);
  const remainSeconds = Math.floor((remainMs % 60000) / 1000);
  statusEl.textContent = `다음 외치기까지 ${remainMinutes}분 ${String(remainSeconds).padStart(2, '0')}초 남았습니다.`;
  shoutBtn.disabled = true;
}

function openDecisionModal({ title, message, details = '', buttons = [] }) {
  const overlay = document.getElementById('decisionModal');
  const titleEl = document.getElementById('decisionModalTitle');
  const messageEl = document.getElementById('decisionModalMessage');
  const detailsEl = document.getElementById('decisionModalDetails');
  const buttonsEl = document.getElementById('decisionModalButtons');

  if (!overlay || !titleEl || !messageEl || !detailsEl || !buttonsEl) {
    return Promise.resolve(null);
  }

  titleEl.textContent = title || '확인';
  messageEl.textContent = message || '';
  detailsEl.innerHTML = details || '';
  buttonsEl.innerHTML = '';

  overlay.classList.remove('hidden');

  return new Promise((resolve) => {
    modalResolver = resolve;

    buttons.forEach((button) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mini-btn ${button.className || ''}`.trim();
      btn.textContent = button.label;
      btn.addEventListener('click', () => closeDecisionModal(button.value));
      buttonsEl.appendChild(btn);
    });
  });
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
  const raidScreen = document.getElementById('raid-screen');
  if (raidScreen) raidScreen.classList.add('hidden');
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
  applyGlobalState(data.global);

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
  closeDecisionModal();
  hideModal('raidLobbyModal');
  hideModal('raidCountdownOverlay');
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

async function handleAdventureClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('adventureBtn');
  if (btn) btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/adventure`, { userId: user._id });
    updateLocalUserState(data);
    await processAdventureResult(data.adventureResult);
  } catch (err) {
    alert(err.message);
  } finally {
    const latestUser = getStoredUser();
    if (latestUser) {
      updateShoutStatus(latestUser);
    }
    if (btn) btn.disabled = false;
  }
}

async function handleShoutClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const input = document.getElementById('shoutInput');
  const btn = document.getElementById('shoutBtn');
  const message = input?.value.trim() || '';

  if (!message) {
    alert('외칠 내용을 입력해주세요.');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const data = await postJson(`${API_URL}/api/action/shout`, {
      userId: user._id,
      message
    });
    updateLocalUserState(data);
    if (input) input.value = '';
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
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

function getRequestedQuantity(inputId) {
  const input = document.getElementById(inputId);
  const value = Math.floor(Number(input?.value || 1));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

async function handleBuyClick(itemId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const quantity = getRequestedQuantity(inputId);
  const price = user.shopPrices?.[itemId] ?? 0;
  const itemName = ITEM_DATA[itemId]?.name || '아이템';
  if (!confirm(`${itemName} ${formatNumber(quantity)}개를 구매하시겠습니까?`)) return;

  try {
    const data = await postJson(`${API_URL}/api/shop/buy`, {
      userId: user._id,
      itemId,
      quantity
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleUseItem(itemId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const quantity = getRequestedQuantity(inputId);

  try {
    const data = await postJson(`${API_URL}/api/inventory/use`, {
      userId: user._id,
      itemId,
      quantity
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleCardDraw() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const quantity = Math.max(1, Math.floor(Number(document.getElementById('cardDrawCount')?.value) || 1));
  const businessCards = getBusinessCardCount(user);
  if (businessCards < quantity) {
    alert('명함이 부족합니다.');
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/cards/draw`, {
      userId: user._id,
      quantity
    });
    updateLocalUserState(data);
    const results = (data.drawResults || [])
      .map((card) => `[${card.grade}] ${card.name}`)
      .join(', ');
    setText('cardDrawStatus', results ? `이번 뽑기 결과: ${results}` : '뽑기 결과가 없습니다.');
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleCardEquip(cardId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/cards/equip`, {
      userId: user._id,
      cardId
    });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleTitle(titleId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const titleDetails = user.titleDetails || [];
  const currentTitle = titleDetails.find((title) => title.equipped) || null;
  const targetTitle = titleDetails.find((title) => title.id === titleId) || null;
  if (!targetTitle) {
    alert('칭호 정보를 찾을 수 없습니다.');
    return;
  }

  const targetAfterChange = currentTitle?.id === titleId ? null : targetTitle;
  const details = `
    <div class="modal-compare-block"><strong>현재 칭호</strong><br>${escapeHtml(currentTitle?.name || '없음')}<br>${escapeHtml(currentTitle?.desc || '효과 없음')}</div>
    <div class="modal-compare-block"><strong>변경 후 칭호</strong><br>${escapeHtml(targetAfterChange?.name || '없음')}<br>${escapeHtml(targetAfterChange?.desc || '효과 없음')}</div>
  `;

  const choice = await openDecisionModal({
    title: '칭호 변경 확인',
    message: '내일까지 칭호를 변경할 수 없습니다. 정말 변경하시겠습니까?',
    details,
    buttons: [
      { value: 'confirm', label: '변경하기' },
      { value: 'cancel', label: '취소' }
    ]
  });

  if (choice !== 'confirm') return;

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
  applyGlobalState(data.global);
  updateGameUI(data.user);
  updateRaidButton(data.user, latestRaidState);
  showNotifications(data.notifications);
}

async function processAdventureResult(result) {
  if (!result) return;

  setText('adventureLog', result.message || '아무 일도 일어나지 않았습니다.');

  if (result.requiresChoice) {
    const choice = await openDecisionModal({
      title: result.title || '모험',
      message: result.message || '',
      details: `<div class="modal-note">${escapeHtml(result.prompt || '')}</div>`,
      buttons: (result.buttons || []).map((button) => ({
        value: button.value,
        label: button.label
      }))
    });

    if (!choice) return;

    const user = getStoredUser();
    if (!user?._id) return handleLogoutClick();

    try {
      const data = await postJson(`${API_URL}/api/action/adventure/resolve`, {
        userId: user._id,
        choice
      });
      updateLocalUserState(data);
      await processAdventureResult(data.adventureResult);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (result.rewardText) {
    alert(result.rewardText);
  }
}

function showGameScreen(user) {
  clearIntervals();
  hideAllScreens();
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('raid-screen').classList.add('hidden');
  updateShoutBanner(latestGlobalState);
  updateGameUI(user);
  startAnimation();
  startPeriodicUpdates();

  if (user.pendingAdventure?.eventId && !modalResolver) {
    processAdventureResult({
      requiresChoice: true,
      title: `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`,
      message: user.pendingAdventure.message,
      prompt: '참치캔을 주겠습니까?',
      buttons: [
        { value: 'yes', label: '예' },
        { value: 'no', label: '아니오' }
      ]
    });
  }
}

function openRaidLobby() {
  showModal('raidLobbyModal');
  updateRaidLobbyUI(latestRaidState, getStoredUser());
  pollRaidState();
}

function closeRaidLobby() {
  hideModal('raidLobbyModal');
}

function handleRaidBackClick() {
  document.getElementById('raid-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
}

function showRaidScreen() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('raid-screen').classList.remove('hidden');
}

function updateRaidButton(user, raidState) {
  const button = document.getElementById('raidLobbyBtn');
  const hint = document.getElementById('raidEntryHint');
  if (!button || !hint || !user) return;

  const todayUsed = Boolean(raidState?.todayUsed);
  const minLevelMet = Boolean(raidState?.minLevelMet);
  const queued = Number.isInteger(raidState?.queuedSlotIndex) && raidState.queuedSlotIndex >= 0;
  const remainingEntries = Number(raidState?.remainingEntries ?? 0);

  button.classList.toggle('waiting', queued);
  button.textContent = queued ? '회의 참석 대기중' : '회의 참석';

  if (todayUsed) {
    button.disabled = true;
    hint.textContent = '오늘은 이미 보스 레이드에 입장했습니다.';
  } else if (!minLevelMet) {
    button.disabled = true;
    hint.textContent = '보스 레이드는 10레벨부터 입장할 수 있습니다.';
  } else {
    button.disabled = false;
    hint.textContent = queued
      ? `현재 ${raidState.queuedSlotIndex + 1}번 슬롯에서 대기 중입니다. 오늘 남은 입장 가능 횟수 ${remainingEntries}회`
      : `보스 레이드 대기열에 참가할 수 있습니다. 오늘 남은 입장 가능 횟수 ${remainingEntries}회`;
  }
}

function updateRaidLobbyUI(raidState, user) {
  const slotGrid = document.getElementById('raidSlotGrid');
  const rewardList = document.getElementById('raidRewardList');
  const bossName = document.getElementById('raidBossName');
  const bossDesc = document.getElementById('raidBossDesc');
  const startBtn = document.getElementById('raidStartBtn');
  if (!slotGrid || !rewardList || !bossName || !bossDesc || !startBtn) return;

  const lobby = raidState?.lobby;
  bossName.textContent = lobby ? `오늘의 보스 정보: ${lobby.bossName}` : '오늘의 보스 정보';
  bossDesc.textContent = lobby ? `${lobby.bossName} / 보스 HP 50,000 / 최소 레벨 ${lobby.minLevel}` : '';

  rewardList.innerHTML = '';
  (lobby?.rewardsText || []).forEach((rewardText) => {
    rewardList.insertAdjacentHTML('beforeend', `<li>${escapeHtml(rewardText)}</li>`);
  });

  slotGrid.innerHTML = '';
  const slots = raidState?.slots || Array(5).fill(null);
  slots.forEach((slot, index) => {
    const isSelf = slot?.userId && user && String(slot.userId) === String(user._id);
    slotGrid.insertAdjacentHTML(
      'beforeend',
      `
        <button class="raid-slot ${slot ? '' : 'empty'} ${isSelf ? 'self' : ''}" onclick="handleRaidSlotClick(${index})">
          ${slot
            ? `<div class="raid-slot-name">${escapeHtml(slot.displayName)}</div>
               <div>Lv.${formatNumber(slot.level)}</div>
               <div class="raid-slot-card">${escapeHtml(slot.equippedCardName || '장착 카드 없음')}</div>`
            : `<div class="raid-slot-name">${index + 1}번 슬롯</div><div>클릭해 참가 대기</div>`}
        </button>
      `
    );
  });

  startBtn.disabled = !raidState?.canStart;
}

function renderRaidBattle(raidState, user) {
  const battle = raidState?.activeBattle;
  if (!battle) return;
  const participantCount = battle.participants?.length || 0;
  const currentTurnIndex = Number(battle.currentTurnIndex || 0);
  const isBossTurn = currentTurnIndex >= participantCount;

  setText('raidScreenBossName', battle.bossName);
  setText('raidBossTitle', battle.bossName);
  setText('raidBossHpText', `${formatNumber(battle.bossHp)} / ${formatNumber(battle.bossMaxHp)}${battle.bossShield > 0 ? ` / 실드 ${formatNumber(battle.bossShield)}` : ''}`);

  const turnBanner = document.getElementById('raidTurnBanner');
  const turnLabel = document.getElementById('raidTurnLabel');
  const turnActor = document.getElementById('raidTurnActor');
  if (turnBanner && turnLabel && turnActor) {
    const turnNumber = Math.max(1, Number(battle.bossPatternIndex || 0) + 1);
    const actingParticipant = !isBossTurn ? battle.participants?.[currentTurnIndex] : null;

    turnLabel.textContent = `현재 턴 ${formatNumber(turnNumber)}`;
    turnActor.textContent = isBossTurn
      ? '보스 행동'
      : `우리팀 행동${actingParticipant?.displayName ? ` - ${actingParticipant.displayName}` : ''}`;
    turnBanner.classList.toggle('party-turn', !isBossTurn);
    turnBanner.classList.toggle('boss-turn', isBossTurn);
  }

  const bossArea = document.getElementById('raidBossArea');
  if (bossArea) {
    bossArea.classList.toggle('active-turn', isBossTurn);
  }

  const bossHpFill = document.getElementById('raidBossHpFill');
  if (bossHpFill) {
    const ratio = battle.bossMaxHp > 0 ? (battle.bossHp / battle.bossMaxHp) * 100 : 0;
    bossHpFill.style.width = `${Math.max(0, ratio)}%`;
  }

  const battleLog = document.getElementById('raidBattleLog');
  if (battleLog) {
    battleLog.innerHTML = (battle.recentLogs || [])
      .map((line) => `<div class="raid-log-line">${escapeHtml(line)}</div>`)
      .join('');
  }

  const participantList = document.getElementById('raidParticipantList');
  if (!participantList) return;
  participantList.innerHTML = '';

  (battle.participants || []).forEach((participant) => {
    const hpRatio = participant.maxHp > 0 ? (participant.hp / participant.maxHp) * 100 : 0;
    const ownControls = participant.isSelf
      ? buildRaidSkillControls(participant, battle.participants)
      : '';
    const isActiveParticipant = !isBossTurn && Number(participant.turnOrder) === currentTurnIndex;
    participantList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="raid-participant-card ${isActiveParticipant ? 'active-turn' : ''}">
          <div class="raid-participant-header">
            <div>
              <strong>${escapeHtml(participant.displayName)}</strong>
              <span class="menu-note">Lv.${formatNumber(participant.level)}</span>
            </div>
            <div>${escapeHtml(participant.equippedCardName || '장착 카드 없음')}</div>
          </div>
          <div class="raid-hp-bar"><div class="raid-hp-fill" style="width:${Math.max(0, hpRatio)}%"></div></div>
          <div class="raid-status-text">HP ${formatNumber(participant.hp)} / ${formatNumber(participant.maxHp)}${participant.silenceTurns > 0 ? ' / 침묵' : ''}</div>
          <div class="raid-shield-text">보호막 ${formatNumber(participant.shield || 0)}</div>
          ${ownControls}
        </div>
      `
    );
  });
}

function renderRaidBattle(raidState, user) {
  const battle = raidState?.activeBattle;
  if (!battle) return;
  const participantCount = battle.participants?.length || 0;
  const currentTurnIndex = Number(battle.currentTurnIndex || 0);
  const isBossTurn = currentTurnIndex >= participantCount;

  setText('raidScreenBossName', battle.bossName);
  setText('raidBossTitle', battle.bossName);
  setText('raidBossHpText', `${formatNumber(battle.bossHp)} / ${formatNumber(battle.bossMaxHp)}`);

  const turnBanner = document.getElementById('raidTurnBanner');
  const turnLabel = document.getElementById('raidTurnLabel');
  const turnActor = document.getElementById('raidTurnActor');
  if (turnBanner && turnLabel && turnActor) {
    const turnNumber = Math.max(1, Number(battle.bossPatternIndex || 0) + 1);
    const actingParticipant = !isBossTurn ? battle.participants?.[currentTurnIndex] : null;
    turnLabel.textContent = `현재 턴 ${formatNumber(turnNumber)}`;
    turnActor.textContent = isBossTurn
      ? '보스 행동'
      : `우리팀 행동${actingParticipant?.displayName ? ` - ${actingParticipant.displayName}` : ''}`;
    turnBanner.classList.toggle('party-turn', !isBossTurn);
    turnBanner.classList.toggle('boss-turn', isBossTurn);
  }

  const bossArea = document.getElementById('raidBossArea');
  if (bossArea) bossArea.classList.toggle('active-turn', isBossTurn);

  const bossBar = document.querySelector('.raid-boss-bar');
  if (bossBar) {
    const ratio = battle.bossMaxHp > 0 ? (battle.bossHp / battle.bossMaxHp) * 100 : 0;
    const shieldRatio = battle.bossMaxHp > 0 ? Math.min(100, (battle.bossShield / battle.bossMaxHp) * 100) : 0;
    const bossLossText = Number(battle.bossLastHpLoss || 0) > 0 ? `-${formatNumber(battle.bossLastHpLoss || 0)}` : '';
    bossBar.innerHTML = `
      <div id="raidBossHpFill" class="raid-boss-bar-fill" style="width:${Math.max(0, ratio)}%"></div>
      ${battle.bossShield > 0 ? `<div class="raid-shield-fill" style="left:${Math.max(0, ratio)}%; width:${Math.max(0, Math.min(100 - ratio, shieldRatio))}%"></div>` : ''}
      ${battle.bossShield > 0 ? `<div class="raid-shield-indicator">실드 ${formatNumber(battle.bossShield)}</div>` : ''}
      ${bossLossText ? `<div class="raid-loss-indicator">${bossLossText}</div>` : ''}
    `;
  }

  const battleLog = document.getElementById('raidBattleLog');
  if (battleLog) {
    const logs = battle.recentLogs || [];
    battleLog.innerHTML = logs
      .map((line, index) => `<div class="raid-log-line ${index === logs.length - 1 ? 'latest' : ''}">${escapeHtml(line)}</div>`)
      .join('');
  }

  const participantList = document.getElementById('raidParticipantList');
  if (!participantList) return;
  participantList.innerHTML = '';

  (battle.participants || []).forEach((participant) => {
    const hpRatio = participant.maxHp > 0 ? (participant.hp / participant.maxHp) * 100 : 0;
    const shieldRatio = participant.maxHp > 0 ? Math.min(100, (participant.shield / participant.maxHp) * 100) : 0;
    const ownControls = participant.isSelf ? buildRaidSkillControls(participant, battle.participants) : '';
    const isActiveParticipant = !isBossTurn && Number(participant.turnOrder) === currentTurnIndex;
    const lossTextParts = [];
    if (Number(participant.lastShieldLoss || 0) > 0) lossTextParts.push(`실드 -${formatNumber(participant.lastShieldLoss || 0)}`);
    if (Number(participant.lastHpLoss || 0) > 0) lossTextParts.push(`HP -${formatNumber(participant.lastHpLoss || 0)}`);
    const lossText = lossTextParts.join(' / ');

    participantList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="raid-participant-card ${isActiveParticipant ? 'active-turn' : ''}">
          <div class="raid-participant-header">
            <div>
              <strong>${escapeHtml(participant.displayName)}</strong>
              <span class="menu-note">Lv.${formatNumber(participant.level)}</span>
            </div>
            <div>${escapeHtml(participant.equippedCardName || '장착 카드 없음')}</div>
          </div>
          <div class="raid-bar-wrap">
            ${participant.shield > 0 ? `<div class="raid-shield-indicator">실드 ${formatNumber(participant.shield || 0)}</div>` : ''}
            ${lossText ? `<div class="raid-loss-indicator">${escapeHtml(lossText)}</div>` : ''}
            <div class="raid-hp-bar">
              <div class="raid-hp-fill" style="width:${Math.max(0, hpRatio)}%"></div>
              ${participant.shield > 0 ? `<div class="raid-shield-fill" style="left:${Math.max(0, hpRatio)}%; width:${Math.max(0, Math.min(100 - hpRatio, shieldRatio))}%"></div>` : ''}
            </div>
          </div>
          <div class="raid-status-text">HP ${formatNumber(participant.hp)} / ${formatNumber(participant.maxHp)}${participant.silenceTurns > 0 ? ' / 침묵' : ''}</div>
          <div class="raid-shield-text">보호막 ${formatNumber(participant.shield || 0)}</div>
          ${ownControls}
        </div>
      `
    );
  });
}

function renderRaidBattle(raidState, user) {
  const battle = raidState?.activeBattle;
  if (!battle) return;
  const participantCount = battle.participants?.length || 0;
  const currentTurnIndex = Number(battle.currentTurnIndex || 0);
  const isBossTurn = currentTurnIndex >= participantCount;

  setText('raidScreenBossName', battle.bossName);
  setText('raidBossTitle', battle.bossName);
  setText('raidBossHpText', `${formatNumber(battle.bossHp)} / ${formatNumber(battle.bossMaxHp)}`);

  const turnBanner = document.getElementById('raidTurnBanner');
  const turnLabel = document.getElementById('raidTurnLabel');
  const turnActor = document.getElementById('raidTurnActor');
  if (turnBanner && turnLabel && turnActor) {
    const turnNumber = Math.max(1, Number(battle.bossPatternIndex || 0) + 1);
    const actingParticipant = !isBossTurn ? battle.participants?.[currentTurnIndex] : null;
    turnLabel.textContent = `현재 턴 ${formatNumber(turnNumber)}`;
    turnActor.textContent = isBossTurn
      ? '보스 행동'
      : `우리팀 행동${actingParticipant?.displayName ? ` - ${actingParticipant.displayName}` : ''}`;
    turnBanner.classList.toggle('party-turn', !isBossTurn);
    turnBanner.classList.toggle('boss-turn', isBossTurn);
  }

  const bossArea = document.getElementById('raidBossArea');
  if (bossArea) bossArea.classList.toggle('active-turn', isBossTurn);

  const bossBar = document.querySelector('.raid-boss-bar');
  if (bossBar) {
    const ratio = battle.bossMaxHp > 0 ? (battle.bossHp / battle.bossMaxHp) * 100 : 0;
    const bossLossText = Number(battle.bossLastHpLoss || 0) > 0 ? `-${formatNumber(battle.bossLastHpLoss || 0)}` : '';
    bossBar.innerHTML = `
      <div id="raidBossHpFill" class="raid-boss-bar-fill" style="width:${Math.max(0, ratio)}%"></div>
      ${bossLossText ? `<div class="raid-loss-indicator">${bossLossText}</div>` : ''}
    `;
  }

  const battleLog = document.getElementById('raidBattleLog');
  if (battleLog) {
    const logs = battle.recentLogs || [];
    battleLog.innerHTML = logs
      .map((line, index) => `<div class="raid-log-line ${index === logs.length - 1 ? 'latest' : ''}">${escapeHtml(line)}</div>`)
      .join('');
  }

  const participantList = document.getElementById('raidParticipantList');
  if (!participantList) return;
  participantList.innerHTML = '';

  (battle.participants || []).forEach((participant) => {
    const hpRatio = participant.maxHp > 0 ? (participant.hp / participant.maxHp) * 100 : 0;
    const shieldRatio = participant.maxHp > 0 ? Math.min(100, (participant.shield / participant.maxHp) * 100) : 0;
    const ownControls = participant.isSelf ? buildRaidSkillControls(participant, battle.participants) : '';
    const isActiveParticipant = !isBossTurn && Number(participant.turnOrder) === currentTurnIndex;
    const lossTextParts = [];
    if (Number(participant.lastShieldLoss || 0) > 0) lossTextParts.push(`실드 -${formatNumber(participant.lastShieldLoss || 0)}`);
    if (Number(participant.lastHpLoss || 0) > 0) lossTextParts.push(`HP -${formatNumber(participant.lastHpLoss || 0)}`);
    const lossText = lossTextParts.join(' / ');

    participantList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="raid-participant-card ${isActiveParticipant ? 'active-turn' : ''}">
          <div class="raid-participant-header">
            <div>
              <strong>${escapeHtml(participant.displayName)}</strong>
              <span class="menu-note">Lv.${formatNumber(participant.level)}</span>
            </div>
            <div>${escapeHtml(participant.equippedCardName || '장착 카드 없음')}</div>
          </div>
          <div class="raid-bar-wrap">
            ${participant.shield > 0 ? `<div class="raid-shield-indicator">실드 ${formatNumber(participant.shield || 0)}</div>` : ''}
            ${lossText ? `<div class="raid-loss-indicator">${escapeHtml(lossText)}</div>` : ''}
            <div class="raid-hp-bar">
              <div class="raid-hp-fill" style="width:${Math.max(0, hpRatio)}%"></div>
              ${participant.shield > 0 ? `<div class="raid-shield-fill" style="left:${Math.max(0, hpRatio)}%; width:${Math.max(0, Math.min(100 - hpRatio, shieldRatio))}%"></div>` : ''}
            </div>
          </div>
          <div class="raid-status-text">HP ${formatNumber(participant.hp)} / ${formatNumber(participant.maxHp)}</div>
          <div class="raid-shield-text">보호막 ${formatNumber(participant.shield || 0)}</div>
          ${participant.silenceTurns > 0 ? `<div class="raid-cc-text">CC: 침묵 (${formatNumber(participant.silenceTurns)}턴)</div>` : ''}
          ${ownControls}
        </div>
      `
    );
  });
}

function buildRaidSkillControls(participant, participants) {
  if (!participant.equippedCardId) {
    return '<div class="raid-skill-row"><span class="muted-text">장착한 카드가 없어 기본 공격만 사용합니다.</span></div>';
  }
  if (participant.passiveOnly) {
    return '<div class="raid-skill-row"><span class="muted-text">전투 시작 시 자동으로 적용되는 패시브 카드입니다.</span></div>';
  }

  const disabled = participant.hp <= 0 || participant.skillCooldown > 0;
  const targetOptions = ['ally', 'ally_pair'].includes(participant.targetType)
    ? participants
      .filter((entry) => entry.hp > 0)
      .map((entry) => `<option value="${escapeHtml(entry.userId)}" ${entry.userId === participant.plannedTargetUserId ? 'selected' : ''}>${escapeHtml(entry.displayName)}</option>`)
      .join('')
    : '';
  const targetOptions2 = participant.targetType === 'ally_pair'
    ? participants
      .filter((entry) => entry.hp > 0)
      .map((entry) => `<option value="${escapeHtml(entry.userId)}" ${entry.userId === participant.plannedTargetUserId2 ? 'selected' : ''}>${escapeHtml(entry.displayName)}</option>`)
      .join('')
    : '';

  return `
    <div class="raid-skill-row">
      <button
        class="mini-btn"
        ${disabled ? 'disabled' : ''}
        title="${escapeHtml(participant.skillDesc || '')}"
        onclick="handleRaidSkillToggle('${participant.userId}', ${participant.plannedSkill ? 'false' : 'true'})"
      >
        ${participant.plannedSkill ? '다음 턴 스킬 사용 예정' : '다음 턴 스킬 사용'}
      </button>
      <span class="menu-note">쿨다운 ${formatNumber(participant.skillCooldown)}턴</span>
      ${['ally', 'ally_pair'].includes(participant.targetType)
        ? `<select id="raidTargetSelect-${escapeHtml(participant.userId)}">${targetOptions}</select>`
        : ''}
      ${participant.targetType === 'ally_pair'
        ? `<select id="raidTargetSelect2-${escapeHtml(participant.userId)}">${targetOptions2}</select>`
        : ''}
    </div>
  `;
}

function updateRaidCountdown(raidState, user) {
  const overlay = document.getElementById('raidCountdownOverlay');
  const numberEl = document.getElementById('raidCountdownNumber');
  const cancelBtn = document.getElementById('raidCountdownCancelBtn');
  if (!overlay || !numberEl) return;

  const countdown = raidState?.countdown;
  const battle = raidState?.activeBattle;
  const isParticipant = Boolean(battle?.isParticipant);

  if (countdown?.active && isParticipant && countdown.endsAt) {
    const remainingMs = new Date(countdown.endsAt).getTime() - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    numberEl.textContent = String(Math.max(1, remaining));
    if (cancelBtn) cancelBtn.disabled = false;
    showModal('raidCountdownOverlay');
    raidCountdownVisible = true;
    return;
  }

  if (battle?.phase === 'active' && isParticipant) {
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    if (cancelBtn) cancelBtn.disabled = true;
    hideModal('raidLobbyModal');
    showRaidScreen();
    renderRaidBattle(raidState, user);
    return;
  }

  if (raidCountdownVisible) {
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (!raidState?.activeBattle && Number.isInteger(raidState?.queuedSlotIndex) && raidState.queuedSlotIndex >= 0) {
      showModal('raidLobbyModal');
    }
  }
}

async function pollRaidState() {
  const user = getStoredUser();
  if (!user?._id) return;

  try {
    const data = await postJson(`${API_URL}/api/raid/state`, { userId: user._id });
    latestRaidState = data.raid;
    updateRaidButton(user, latestRaidState);
    updateRaidLobbyUI(latestRaidState, user);
    updateRaidCountdown(latestRaidState, user);

    if (latestRaidState?.activeBattle?.phase === 'active' && latestRaidState.activeBattle.isParticipant) {
      renderRaidBattle(latestRaidState, user);
    } else if (!latestRaidState?.activeBattle && !document.getElementById('raid-screen').classList.contains('hidden')) {
      handleRaidBackClick();
    }
  } catch (err) {
    console.error('Raid state poll failed:', err);
  }
}

async function handleRaidSlotClick(slotIndex) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/raid/toggle-slot`, {
      userId: user._id,
      slotIndex
    });
    latestRaidState = data.raid;
    updateRaidButton(user, latestRaidState);
    updateRaidLobbyUI(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRaidStartClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/raid/start`, { userId: user._id });
    latestRaidState = data.raid;
    updateRaidLobbyUI(latestRaidState, user);
    updateRaidCountdown(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRaidCountdownCancelClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const button = document.getElementById('raidCountdownCancelBtn');
    if (button) button.disabled = true;
    const data = await postJson(`${API_URL}/api/raid/cancel-countdown`, { userId: user._id });
    latestRaidState = data.raid;
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    updateRaidButton(user, latestRaidState);
    updateRaidLobbyUI(latestRaidState, user);
    showModal('raidLobbyModal');
  } catch (err) {
    const button = document.getElementById('raidCountdownCancelBtn');
    if (button) button.disabled = false;
    alert(err.message);
  }
}

async function handleRaidSkillToggle(userId, useSkill) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const targetSelect = document.getElementById(`raidTargetSelect-${userId}`);
  const targetSelect2 = document.getElementById(`raidTargetSelect2-${userId}`);

  try {
    const data = await postJson(`${API_URL}/api/raid/plan-skill`, {
      userId: user._id,
      useSkill,
      targetUserId: targetSelect?.value || null,
      targetUserId2: targetSelect2?.value || null
    });
    if (latestRaidState) {
      latestRaidState.activeBattle = data.raid;
    }
    renderRaidBattle(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

function updateGameUI(user) {
  updateStatusUI(user);
  updateBuffUI(user);
  updateSpecialActionButtons(user);
  updateShoutStatus(user);
  updateInventoryUI(user);
  updateShopUI(user);
  updateStatsTab(user);
  updateStockStatus(user);
  updateStressEffect(user.gameState?.stress || 0);
  setText('adventureLog', user.meta?.lastAdventureLog || '모험에서 어떤 일이 벌어질지 모릅니다.');
}

function updateSpecialActionButtons(user) {
  const adventureBtn = document.getElementById('adventureBtn');
  if (adventureBtn && user?.gameState) {
    const staminaCost = Number(user.itemStats?.adventureStaminaMultiplier || 1);
    const currentStamina = Number(user.gameState.stamina || 0);
    const hasPendingChoice = Boolean(user.pendingAdventure?.eventId);
    const canUseAdventure = currentStamina >= staminaCost && !hasPendingChoice;

    adventureBtn.disabled = !canUseAdventure;
    adventureBtn.textContent = `모험하기 (행동력 ${formatNumber(staminaCost, staminaCost % 1 === 0 ? 0 : 1)})`;
  }
}

function updateStatusUI(user) {
  const state = user.gameState;
  const itemStats = user.itemStats || {};
  if (!state) return;

  setText('userNickname', getMainName(user));
  setText('money', formatNumber(Math.floor(state.money)));
  setText('salaryRate', formatNumber(state.salaryPerMinute ?? 0, 2));
  setText('level', state.level);
  setText('stamina', `${formatNumber(state.stamina ?? 0, 1)}/${formatNumber(state.maxStamina ?? 0, 1)}`);
  setText('businessCardCount', formatNumber(getBusinessCardCount(user)));

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
  const cardList = document.getElementById('card-list');
  if (!inventoryList || !titleList || !cardList) return;

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
      const qtyInputId = `use-qty-${item.itemId}`;
      const actionButton = tooltipSource && ['bacchus', 'hot6', 'tylenol', 'raid_entry_ticket', 'hagendaz'].includes(item.itemId)
        ? `<div class="qty-action-wrap"><input id="${qtyInputId}" class="qty-input" type="number" min="1" max="${item.quantity}" step="1" value="1"><button class="mini-btn" onclick="handleUseItem('${item.itemId}', '${qtyInputId}')">사용</button></div>`
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

  cardList.innerHTML = '';
  const cardDetails = user.cardDetails || [];
  const ownedCards = cardDetails.filter((card) => card.quantity > 0);
  if (ownedCards.length === 0) {
    cardList.innerHTML = '<tr><td colspan="5">아직 보유한 카드가 없습니다.</td></tr>';
    return;
  }

  ownedCards.forEach((card) => {
    const actionText = card.equipped ? '해제' : '장착';
    cardList.insertAdjacentHTML(
      'beforeend',
      `
        <tr>
          <td>${escapeHtml(card.name)}</td>
          <td><span class="grade-badge" style="background:${escapeHtml(card.color)}">${escapeHtml(card.grade)}</span></td>
          <td>${formatNumber(card.quantity)}장 보유</td>
          <td title="${escapeHtml(card.skillDesc)}">${escapeHtml(card.skillName)} (쿨 ${formatNumber(card.cooldown)}턴)</td>
          <td><button class="mini-btn" onclick="handleToggleCardEquip('${card.id}')">${actionText}</button></td>
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
    if (['cat_tuna_can', 'business_card'].includes(itemId) || itemInfo.shopHidden) return;
    const price = user.shopPrices?.[itemId] ?? 0;
    const qtyInputId = `buy-qty-${itemId}`;

    shopList.insertAdjacentHTML(
      'beforeend',
      `
        <tr>
          <td>${escapeHtml(itemInfo.name)}</td>
          <td>${formatNumber(price)}원</td>
          <td>${escapeHtml(itemInfo.desc || '')}</td>
          <td><div class="qty-action-wrap"><input id="${qtyInputId}" class="qty-input" type="number" min="1" step="1" value="1"><button class="mini-btn" onclick="handleBuyClick('${itemId}', '${qtyInputId}')">구매</button></div></td>
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
  const equippedCard = getEquippedCardDetail(user);
  const pendingStock = user.pendingStockInvestment?.amount > 0
    ? `${formatNumber(user.pendingStockInvestment.amount)}원 투자 완료`
    : '없음';
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayKey = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-${String(kstNow.getUTCDate()).padStart(2, '0')}`;
  const titleChangeStatus = user.meta?.lastTitleChangeDayKey === todayKey ? '오늘 이미 변경함' : '오늘 변경 가능';

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
    <tr><td>행동력</td><td>${formatNumber(state.stamina || 0, 1)} / ${formatNumber(state.maxStamina || 0, 1)}</td></tr>
    <tr><td>모험 행동력 소모</td><td>${formatNumber(itemStats.adventureStaminaMultiplier || 1, 1)}</td></tr>
    <tr><td>장착 칭호</td><td>${escapeHtml(equippedTitle?.name || '없음')}</td></tr>
    <tr><td>장착 카드</td><td>${escapeHtml(equippedCard?.name || '없음')}</td></tr>
    <tr><td>보유 명함</td><td>${formatNumber(getBusinessCardCount(user))}장</td></tr>
    <tr><td>칭호 변경 가능 여부</td><td>${escapeHtml(titleChangeStatus)}</td></tr>
    <tr><td>고양이 참치캔 누적 지급</td><td>${formatNumber(user.meta?.catFoodGivenCount || 0)}회</td></tr>
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
            <td><span class="online-dot ${entry.isOnline ? 'online' : 'offline'}"></span>${escapeHtml(entry.displayName || entry.nickname)}</td>
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
    if (user) {
      updateBuffUI(user);
      updateShoutStatus(user);
    }
  }, 1000);

  updateRankingUI();
  rankingInterval = setInterval(updateRankingUI, 5000);

  syncUserState();
  syncInterval = setInterval(syncUserState, 5000);

  pollRaidState();
  raidPollInterval = setInterval(pollRaidState, 2000);
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
  const levelSelect = document.getElementById('levelTargetSelect');
  if (!giftSelect || !deleteSelect || !levelSelect) return;

  giftSelect.innerHTML = '<option value="ALL_USERS">전체 유저</option>';
  deleteSelect.innerHTML = '<option value="">삭제할 유저 선택</option>';
  levelSelect.innerHTML = '<option value="">레벨 조정할 유저 선택</option>';
  users.forEach((user) => {
    giftSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    deleteSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    levelSelect.insertAdjacentHTML(
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

async function handleAdminSetLevel() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const targetSelect = document.getElementById('levelTargetSelect');
  const levelInput = document.getElementById('levelValueInput');
  if (!targetSelect?.value) {
    alert('레벨을 조정할 유저를 선택해주세요.');
    return;
  }

  const targetLevel = Math.max(1, Math.floor(Number(levelInput?.value) || 1));
  const selectedLabel = targetSelect.options[targetSelect.selectedIndex]?.textContent || '선택한 유저';
  if (!confirm(`${selectedLabel}의 레벨을 ${targetLevel}(으)로 변경하시겠습니까? 현재 경험치는 0으로 초기화됩니다.`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/set-level`,
      {
        targetUserId: targetSelect.value,
        level: targetLevel
      },
      getAdminAuthHeaders()
    );

    setText('adminStatus', `${data.updatedLabel} 레벨을 ${data.level}(으)로 변경했습니다.`);
    alert(`${data.updatedLabel} 레벨을 ${data.level}(으)로 변경했습니다.`);
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
window.handleToggleCardEquip = handleToggleCardEquip;
window.handleRaidSlotClick = handleRaidSlotClick;
window.handleRaidSkillToggle = handleRaidSkillToggle;
