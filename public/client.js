// ========================
// 환경 설정 및 데이터
// ========================
// 로컬/배포 환경 자동 인식
// - 서버를 통해 접속하면 현재 주소를 API 주소로 사용
// - index.html을 파일로 직접 열었을 때만 localhost:5000으로 요청
const API_URL = window.location.origin;

console.log("🚀 client.js 로드됨. API URL:", API_URL);

const ITEM_DATA = {
    'pen_monami': { name: '모나미 볼펜', price: 100000, desc: '월급 +0.05%' },
    'coffee_mix': { name: '맥심 커피믹스', price: 50000, desc: '스트레스 감소율 +2%' }
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
    'lupin_buff': { name: '월급루팡 중', desc: '스트레스가 오르지 않고, 경험치 획득량이 1.5배 증가합니다.' }
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


// ========================
// 초기화
// ========================
document.addEventListener("DOMContentLoaded", () => {
    initGame();
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});

function initGame() {
    console.log("🎮 게임 초기화...");
    setupEventListeners();
    tryAutoLogin();
  setupEventListeners();
  tryAutoLogin();
}

function setupEventListeners() {
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        loginBtn.removeEventListener("click", handleLoginClick);
        loginBtn.addEventListener("click", handleLoginClick);
    }
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.removeEventListener("click", handleLogoutClick);
        logoutBtn.addEventListener("click", handleLogoutClick);
    }
    const setNicknameBtn = document.getElementById("setNicknameBtn");
    if (setNicknameBtn) {
        setNicknameBtn.removeEventListener("click", handleSetNicknameClick);
        setNicknameBtn.addEventListener("click", handleSetNicknameClick);
    }
    const clickWorkBtn = document.getElementById("clickWorkBtn");
    if (clickWorkBtn) {
        clickWorkBtn.removeEventListener("click", handleClickWork);
        clickWorkBtn.addEventListener("click", handleClickWork);
    }
    const lupinBtn = document.getElementById("lupinBtn");
    if (lupinBtn) {
        lupinBtn.removeEventListener("click", handleLupinClick);
        lupinBtn.addEventListener("click", handleLupinClick);
    }
    const napBtn = document.getElementById("napBtn");
    if (napBtn) {
        napBtn.removeEventListener("click", handleNapClick);
        napBtn.addEventListener("click", handleNapClick);
    }
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

// ========================
// 로그인/로그아웃/닉네임 함수
// ========================
async function handleLoginClick(event) {
    if (event) event.preventDefault();
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
function getStoredUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

    if (!username || !password) {
        alert("아이디와 비밀번호를 입력해주세요.");
        return;
    }
function saveStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
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

        if (!res.ok) throw new Error(data.msg || `로그인 실패 (코드: ${res.status})`);
function getDisplayName(user) {
  if (user.displayName) return user.displayName;
  const equipped = user.titles?.equipped;
  if (equipped && TITLE_DATA[equipped]) {
    return `<${TITLE_DATA[equipped].name}> ${user.nickname}`;
  }
  return user.nickname || user.username || '사원';
}

        processLoginSuccess(data);
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

    } catch (err) {
        console.error("로그인 에러:", err);
        alert(`로그인 실패: ${err.message}`);
function showNotifications(notifications = []) {
  notifications.forEach((notification) => {
    if (notification?.text) {
      alert(notification.text);
    }
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
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem('token', data.token);
  saveStoredUser(data.user);

    if (data.isNewUser || !data.user.nickname) {
        alert("환영합니다! 게임에서 사용할 닉네임을 설정해주세요.");
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("nickname-screen").classList.remove("hidden");
    } else {
        alert(`${data.user.nickname} 사원님, 환영합니다!`);
        showGameScreen(data.user);
    }
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
    const nicknameInput = document.getElementById("nicknameInput");
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
        alert("닉네임을 입력해주세요.");
        return;
    }
  const nickname = document.getElementById('nicknameInput').value.trim();
  const user = getStoredUser();

    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    try {
        const res = await fetch(`${API_URL}/api/set-nickname`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id, nickname: nickname })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "닉네임 설정 실패");
  if (!nickname) {
    alert('닉네임을 입력해주세요.');
    return;
  }
  if (!user?._id) {
    handleLogoutClick();
    return;
  }

        user.nickname = data.nickname;
        localStorage.setItem("user", JSON.stringify(user));
        
        alert("닉네임이 설정되었습니다.");
        document.getElementById("nickname-screen").classList.add("hidden");
        showGameScreen(user);
  try {
    const data = await postJson(`${API_URL}/api/set-nickname`, {
      userId: user._id,
      nickname
    });

    } catch (err) {
        console.error("닉네임 설정 에러:", err);
        alert(err.message);
    }
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
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (userStr && token) {
        try {
            const user = JSON.parse(userStr);
            if (!user.nickname) {
                throw new Error("닉네임 미설정");
            }
            showGameScreen(user);
        } catch (e) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    }
  const user = getStoredUser();
  const token = localStorage.getItem('token');

  if (!user || !token) return;

  try {
    if (!user.nickname) throw new Error('nickname missing');
    showGameScreen(user);
  } catch (err) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }
}

function handleLogoutClick() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("nickname-screen").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
    
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    
    if (animationInterval) clearInterval(animationInterval);
    if (updateInterval) clearInterval(updateInterval);
    if (rankingInterval) clearInterval(rankingInterval);
    if (syncInterval) clearInterval(syncInterval);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  clearIntervals();

    alert("로그아웃되었습니다.");
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}


// ========================
// 액션 처리 함수
// ========================
async function handleClickWork() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    const btn = document.getElementById("clickWorkBtn");
    btn.disabled = true;
    btn.textContent = "🔥 처리중... 🔥";

    try {
        const res = await fetch(`${API_URL}/api/action/work`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "작업 실패");
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

        updateLocalUserState(user, data);
  const btn = document.getElementById('clickWorkBtn');
  btn.disabled = true;
  btn.textContent = '서류 작업 중...';

    } catch (err) {
        console.error("작업 요청 실패:", err);
        alert(err.message || "작업 요청 중 오류가 발생했습니다.");
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "🔥 폭풍 서류 작업 (클릭! 스트레스 약간 증가) 🔥";
        }, 100);
    }
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
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

    if (user.gameState.stamina < 6) {
        alert("행동력이 부족합니다! (필요: 6)");
        return;
    }
  const btn = document.getElementById('lupinBtn');
  btn.disabled = true;

    const btn = document.getElementById("lupinBtn");
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

    try {
        const res = await fetch(`${API_URL}/api/action/lupin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "월급루팡 실패");
async function handleNapClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

        updateLocalUserState(user, data);
        alert("월급루팡 시작! (1시간 동안 지속)");
  const btn = document.getElementById('napBtn');
  btn.disabled = true;

    } catch (err) {
        console.error("월급루팡 요청 실패:", err);
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
  try {
    const data = await postJson(`${API_URL}/api/action/nap`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleNapClick() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);
async function handleStockInvest() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

    if (user.gameState.stamina < 3) {
        alert("행동력이 부족합니다! (필요: 3)");
        return;
    }
  const input = document.getElementById('stockAmount');
  const rawValue = input.value.replaceAll(',', '').trim();
  const amount = Math.floor(Number(rawValue));

    const btn = document.getElementById("napBtn");
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/action/nap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "낮잠자기 실패");
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('투자 금액을 숫자로 입력해주세요.');
    return;
  }

        updateLocalUserState(user, data);
        alert("낮잠을 자고 나니 스트레스가 줄었습니다. (스트레스 -30)");
  const btn = document.getElementById('stockInvestBtn');
  btn.disabled = true;

    } catch (err) {
        console.error("낮잠자기 요청 실패:", err);
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
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
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

    if (!confirm(`${ITEM_DATA[itemId].name}을(를) 구매하시겠습니까?`)) return;
  const price = user.shopPrices?.[itemId] ?? 0;
  const itemName = ITEM_DATA[itemId]?.name || '아이템';
  if (!confirm(`${itemName}을(를) ${formatNumber(price)}원에 구매하시겠습니까?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/shop/buy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id, itemId: itemId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "구매 실패");
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

        updateLocalUserState(user, data);
        alert("구매 완료!");
async function handleUseItem(itemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

    } catch (err) {
        console.error("구매 요청 실패:", err);
        alert(err.message);
    }
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

// 서버 응답으로 로컬 상태 업데이트하는 헬퍼 함수
function updateLocalUserState(user, data) {
    user.gameState = data.gameState;
    if (data.buffs) user.buffs = data.buffs;
    if (data.inventory) user.inventory = data.inventory;
    user.itemStats = data.itemStats;
    localStorage.setItem("user", JSON.stringify(user));
    updateGameUI(user);
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

// ========================
// 화면 및 UI 업데이트
// ========================
function showGameScreen(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("nickname-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    
    updateGameUI(user);
    startAnimation();
    startPeriodicUpdates();
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  updateGameUI(user);
  startAnimation();
  startPeriodicUpdates();
}

function updateGameUI(user) {
    updateUI(user.gameState, user.itemStats, user.nickname);
    updateBuffUI(user.buffs, user.gameState.stress);
    updateInventoryUI(user.inventory);
    updateShopUI();
    updateStressEffect(user.gameState.stress);
  updateUI(user);
  updateBuffUI(user);
  updateInventoryUI(user);
  updateShopUI(user);
  updateStatsTab(user);
  updateStockStatus(user);
  updateStressEffect(user.gameState?.stress || 0);
}

function updateUI(state, itemStats, nickname) {
    if (!state) return;
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
function updateUI(user) {
  const state = user.gameState;
  const itemStats = user.itemStats || {};
  if (!state) return;

    setText("userNickname", nickname);
    setText("money", Math.floor(state.money).toLocaleString()); // 소수점 버림 표시
    setText("level", state.level);
    setText("stamina", `${state.stamina}/${state.maxStamina}`);
    
    const stressEl = document.getElementById("stress");
    stressEl.textContent = state.stress.toFixed(1);
    if (state.stress >= 100) {
        stressEl.style.color = "red";
        stressEl.style.fontWeight = "bold";
    } else {
        stressEl.style.color = "inherit";
        stressEl.style.fontWeight = "normal";
    }
  setText('userNickname', getDisplayName(user));
  setText('money', formatNumber(Math.floor(state.money)));
  setText('salaryRate', formatNumber(state.salaryPerMinute ?? 0, 2));
  setText('level', state.level);
  setText('stamina', `${state.stamina}/${state.maxStamina}`);

    // [수정] 서버에서 계산된 다음 레벨 필요 경험치 사용 (없으면 클라이언트에서 계산)
    const maxExp = state.nextLevelExp || Math.floor(1000 * Math.pow(1.1, state.level - 1));
    setText("expText", `${state.exp}/${maxExp}`);
    const expBar = document.getElementById("expBar");
    if (expBar) { expBar.max = maxExp; expBar.value = state.exp; }
  const stressEl = document.getElementById('stress');
  stressEl.textContent = formatNumber(state.stress ?? 0, 2);
  stressEl.style.color = state.stress >= 100 ? 'red' : '';
  stressEl.style.fontWeight = state.stress >= 100 ? 'bold' : 'normal';

    // [수정] 월급 계산식 수정 (하루 30만원 기준)
    const baseSalaryPerMin = (300000 / 24 / 60); 
    const levelFactor = Math.pow(1.05, (state.level - 1));
    const itemBonus = 1 + (itemStats ? (itemStats.moneyBonus || 0) / 100 : 0);
    const currentSalaryRate = Math.floor(baseSalaryPerMin * levelFactor * itemBonus);
    setText("salaryRate", currentSalaryRate.toLocaleString());
  const maxExp = state.nextLevelExp || 1000;
  setText('expText', `${formatNumber(state.exp)}/${formatNumber(maxExp)}`);
  const expBar = document.getElementById('expBar');
  if (expBar) {
    expBar.max = maxExp;
    expBar.value = state.exp;
  }

    updateStatsTab(state, itemStats, currentSalaryRate);
  setText('currentTitleText', user.titles?.equipped ? TITLE_DATA[user.titles.equipped]?.name || '장착 중' : '없음');
  setText('passiveExpPreview', formatNumber(state.passiveDailyExp ?? 0, 2));
  setText('clickExpPreview', formatNumber(state.clickExp ?? 0));
  setText('stressReductionPreview', `${formatNumber(itemStats.stressReduction ?? 0, 2)}%`);
}

function updateBuffUI(buffs, stress) {
    const buffListEl = document.getElementById("buff-list");
    if (!buffListEl) return;
    buffListEl.innerHTML = '';
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

    const now = new Date();
    let hasBuffs = false;
function updateBuffUI(user) {
  const buffListEl = document.getElementById('buff-list');
  if (!buffListEl) return;

    if (buffs) {
        buffs.forEach(buff => {
            const buffInfo = BUFF_DATA[buff.buffId];
            const expiresAt = new Date(buff.expiresAt);
            
            if (expiresAt <= now) return;
  buffListEl.innerHTML = '';
  let hasAnyBuff = false;
  const now = new Date();

            hasBuffs = true;
            const remainingMs = expiresAt - now;
            const remainingMin = Math.floor(remainingMs / 60000);
            const remainingSec = Math.floor((remainingMs % 60000) / 1000);
            const remainingText = `${remainingMin}분 ${remainingSec}초 남음`;
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

            if (buffInfo) {
                const buffItem = document.createElement('div');
                buffItem.className = 'buff-item';
                buffItem.innerHTML = `
                    ${buffInfo.name}
                    <span class="buff-tooltip">
                        <strong>${buffInfo.name}</strong><br>
                        ${buffInfo.desc}<br><br>
                        (${remainingText})
                    </span>
                `;
                buffListEl.appendChild(buffItem);
            }
        });
    }
  (user.buffs || []).forEach((buff) => {
    const info = BUFF_DATA[buff.buffId];
    if (!info) return;

    const expiresAt = new Date(buff.expiresAt);
    if (expiresAt <= now) return;

    if (stress >= 100) {
        hasBuffs = true;
        const debuffItem = document.createElement('div');
        debuffItem.className = 'debuff-item';
        debuffItem.innerHTML = `
            스트레스 과다
            <span class="buff-tooltip">
                <strong>스트레스 과다 (100%)</strong><br>
                열일하기 클릭으로 경험치를 획득할 수 없습니다.<br>
                휴식이 필요합니다.
            </span>
        `;
        buffListEl.appendChild(debuffItem);
    }
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

    if (!hasBuffs) {
        buffListEl.textContent = '(없음)';
    }
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

function updateInventoryUI(inventory) {
    const inventoryList = document.getElementById("inventory-list");
    if (!inventoryList) return;
    inventoryList.innerHTML = '';
    if (!inventory || inventory.length === 0) {
        inventoryList.innerHTML = '<tr><td colspan="3">가방이 비어있습니다.</td></tr>';
        return;
    }
    inventory.forEach(item => {
        const itemInfo = ITEM_DATA[item.itemId];
        if (itemInfo) {
            inventoryList.innerHTML += `
                <tr><td>${itemInfo.name}</td><td>${item.quantity}개</td><td>${itemInfo.desc}</td></tr>
            `;
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

function updateShopUI() {
    const shopList = document.getElementById("shop-list");
    if (!shopList) return;
    shopList.innerHTML = '';
    for (const [itemId, itemInfo] of Object.entries(ITEM_DATA)) {
        shopList.innerHTML += `
            <tr>
                <td>${itemInfo.name}</td>
                <td>₩${itemInfo.price.toLocaleString()}</td>
                <td>${itemInfo.desc}</td>
                <td><button onclick="handleBuyClick('${itemId}')">구매</button></td>
            </tr>
        `;
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

function updateStatsTab(state, itemStats, salaryRate) {
    const statsList = document.getElementById("stats-list");
    if (!statsList) return;
    statsList.innerHTML = `
        <tr><td>레벨</td><td>${state.level}</td></tr>
        <tr><td>보유 자산</td><td>₩${Math.floor(state.money).toLocaleString()}</td></tr>
        <tr><td>분당 월급</td><td>₩${salaryRate.toLocaleString()} (기본 + 아이템 보너스)</td></tr>
        <tr><td>스트레스</td><td>${state.stress.toFixed(1)}% (100% 시 열일하기 경험치 획득 불가)</td></tr>
        <tr><td>경험치 보너스</td><td>+${itemStats ? (itemStats.expBonus || 0).toFixed(2) : 0}%</td></tr>
        <tr><td>스트레스 감소율</td><td>+${itemStats ? (itemStats.stressReduction || 0).toFixed(2) : 0}%</td></tr>
    `;
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

function updateStressEffect(stress) {
    const gameScreen = document.getElementById("game-screen");
    if (stress >= 90) {
        gameScreen.classList.add("stress-warning");
    } else {
        gameScreen.classList.remove("stress-warning");
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

async function syncUserState() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return;
  if (stress >= 90) {
    gameScreen.classList.add('stress-warning');
  } else {
    gameScreen.classList.remove('stress-warning');
  }
}

    const user = JSON.parse(userStr);
    try {
        const res = await fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "상태 동기화 실패");
async function syncUserState() {
  const user = getStoredUser();
  if (!user?._id) return;

        updateLocalUserState(user, data);
    } catch (err) {
        console.error("상태 동기화 실패:", err);
    }
  try {
    const data = await postJson(`${API_URL}/api/sync`, { userId: user._id });
    updateLocalUserState(data);
  } catch (err) {
    console.error('State sync failed:', err);
  }
}

async function updateRankingUI() {
    const rankingListBody = document.getElementById("ranking-list-body");
    if (!rankingListBody) return;
  const rankingListBody = document.getElementById('ranking-list-body');
  if (!rankingListBody) return;

    try {
        const res = await fetch(`${API_URL}/api/ranking`);
        const rankingData = await res.json();
  try {
    const res = await fetch(`${API_URL}/api/ranking`);
    const rankingData = await res.json();
    if (!res.ok) throw new Error(rankingData.msg || '랭킹을 불러오지 못했습니다.');

        rankingListBody.innerHTML = '';
        if (rankingData.length === 0) {
            rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">랭킹 정보가 없습니다.</td></tr>';
            return;
        }
    rankingListBody.innerHTML = '';

        rankingData.forEach((user, index) => {
            // [신규] 랭킹 스타일 클래스 추가
            let rankClass = '';
            if (index === 0) rankClass = 'rank-1';
            else if (index === 1) rankClass = 'rank-2';
            else if (index === 2) rankClass = 'rank-3';
    if (rankingData.length === 0) {
      rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">랭킹 정보가 없습니다.</td></tr>';
      return;
    }

            rankingListBody.innerHTML += `
                <tr class="${rankClass}">
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${user.nickname}</td>
                    <td style="text-align: center;">${user.gameState.level}</td>
                </tr>
            `;
        });
    rankingData.forEach((entry, index) => {
      let rankClass = '';
      if (index === 0) rankClass = 'rank-1';
      if (index === 1) rankClass = 'rank-2';
      if (index === 2) rankClass = 'rank-3';

    } catch (err) {
        console.error("랭킹 업데이트 실패:", err);
        rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">랭킹 로딩 실패</td></tr>';
    }
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
    if (updateInterval) clearInterval(updateInterval);
    if (rankingInterval) clearInterval(rankingInterval);
    if (syncInterval) clearInterval(syncInterval);
  clearIntervals();

    // 버프 남은 시간 표시는 1초마다 갱신
    updateInterval = setInterval(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            updateBuffUI(user.buffs, user.gameState.stress);
        }
    }, 1000);
  updateInterval = setInterval(() => {
    const user = getStoredUser();
    if (user) updateBuffUI(user);
  }, 1000);

    // 랭킹은 5초마다 갱신
    updateRankingUI();
    rankingInterval = setInterval(updateRankingUI, 5000);
  updateRankingUI();
  rankingInterval = setInterval(updateRankingUI, 5000);

    // 서버 상태 동기화는 10초마다 실행
    syncUserState();
    syncInterval = setInterval(syncUserState, 10000);
  syncUserState();
  syncInterval = setInterval(syncUserState, 10000);
}

function startAnimation() {
  const animEl = document.getElementById('anim-display');
  if (!animEl) return;

// ========================
// 기타 유틸리티
// ========================
const animations = [
    [`  O   \n /|\\  [PC]\n / \\ `, ` \\O   \n  |\\  [PC]\n / \\ `],
    [`  O   \n /|\\  [서류]\n / \\ `, `  O   \n /|\\  ...\n / \\ `],
    [`  O   \n /|\\  (커피)\n / \\ `, `  O \n /|\\  (호록)\n / \\ `]
];
  clearInterval(animationInterval);
  const currentAnimation = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

function startAnimation() {
    const animEl = document.getElementById("anim-display");
    if (!animEl) return;
    if (animationInterval) clearInterval(animationInterval);
    let currentAnim = animations[Math.floor(Math.random() * animations.length)];
    let frame = 0;
    animationInterval = setInterval(() => {
        animEl.textContent = currentAnim[frame];
        frame = (frame + 1) % currentAnim.length;
    }, 500);
  animEl.textContent = currentAnimation[0];
  animationInterval = setInterval(() => {
    animEl.textContent = currentAnimation[frame];
    frame = (frame + 1) % currentAnimation.length;
  }, 450);
}

window.showTab = function(tabName) {
    document.querySelectorAll('.menu-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-tabs button').forEach(el => el.classList.remove('active'));
    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');
    const btns = document.getElementsByTagName('button');
    for (let btn of btns) {
        if (btn.getAttribute('onclick') === `showTab('${tabName}')`) {
            btn.classList.add('active');
            break;
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

window.handleBuyClick = handleBuyClick;
window.handleUseItem = handleUseItem;
window.handleToggleTitle = handleToggleTitle;