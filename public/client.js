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
};

const BUFF_DATA = {
    'lupin_buff': { name: '월급루팡 중', desc: '스트레스가 오르지 않고, 경험치 획득량이 1.5배 증가합니다.' }
};

let updateInterval;
let rankingInterval;
let syncInterval;
let animationInterval;


// ========================
// 초기화
// ========================
document.addEventListener("DOMContentLoaded", () => {
    initGame();
});

function initGame() {
    console.log("🎮 게임 초기화...");
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

    if (!username || !password) {
        alert("아이디와 비밀번호를 입력해주세요.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.msg || `로그인 실패 (코드: ${res.status})`);

        processLoginSuccess(data);

    } catch (err) {
        console.error("로그인 에러:", err);
        alert(`로그인 실패: ${err.message}`);
    }
}

function processLoginSuccess(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    if (data.isNewUser || !data.user.nickname) {
        alert("환영합니다! 게임에서 사용할 닉네임을 설정해주세요.");
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("nickname-screen").classList.remove("hidden");
    } else {
        alert(`${data.user.nickname} 사원님, 환영합니다!`);
        showGameScreen(data.user);
    }
}

async function handleSetNicknameClick() {
    const nicknameInput = document.getElementById("nicknameInput");
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
        alert("닉네임을 입력해주세요.");
        return;
    }

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

        user.nickname = data.nickname;
        localStorage.setItem("user", JSON.stringify(user));
        
        alert("닉네임이 설정되었습니다.");
        document.getElementById("nickname-screen").classList.add("hidden");
        showGameScreen(user);

    } catch (err) {
        console.error("닉네임 설정 에러:", err);
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

    alert("로그아웃되었습니다.");
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

        updateLocalUserState(user, data);

    } catch (err) {
        console.error("작업 요청 실패:", err);
        alert(err.message || "작업 요청 중 오류가 발생했습니다.");
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "🔥 폭풍 서류 작업 (클릭! 스트레스 약간 증가) 🔥";
        }, 100);
    }
}

async function handleLupinClick() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    if (user.gameState.stamina < 2) {
        alert("행동력이 부족합니다! (필요: 2)");
        return;
    }

    const btn = document.getElementById("lupinBtn");
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/action/lupin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "월급루팡 실패");

        updateLocalUserState(user, data);
        alert("월급루팡 시작! (2시간 동안 지속)");

    } catch (err) {
        console.error("월급루팡 요청 실패:", err);
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

async function handleNapClick() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    if (user.gameState.stamina < 3) {
        alert("행동력이 부족합니다! (필요: 3)");
        return;
    }

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

        updateLocalUserState(user, data);
        alert("낮잠을 자고 나니 스트레스가 줄었습니다. (스트레스 -30)");

    } catch (err) {
        console.error("낮잠자기 요청 실패:", err);
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

async function handleBuyClick(itemId) {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    if (!confirm(`${ITEM_DATA[itemId].name}을(를) 구매하시겠습니까?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/shop/buy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id, itemId: itemId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "구매 실패");

        updateLocalUserState(user, data);
        alert("구매 완료!");

    } catch (err) {
        console.error("구매 요청 실패:", err);
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
}

function updateGameUI(user) {
    updateUI(user.gameState, user.itemStats, user.nickname);
    updateBuffUI(user.buffs, user.gameState.stress);
    updateInventoryUI(user.inventory);
    updateShopUI();
    updateStressEffect(user.gameState.stress);
}

function updateUI(state, itemStats, nickname) {
    if (!state) return;
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

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

    // [수정] 서버에서 계산된 다음 레벨 필요 경험치 사용 (없으면 클라이언트에서 계산)
    const maxExp = state.nextLevelExp || Math.floor(1000 * Math.pow(1.1, state.level - 1));
    setText("expText", `${state.exp}/${maxExp}`);
    const expBar = document.getElementById("expBar");
    if (expBar) { expBar.max = maxExp; expBar.value = state.exp; }

    // [수정] 월급 계산식 수정 (하루 30만원 기준)
    const baseSalaryPerMin = (300000 / 24 / 60); 
    const levelFactor = Math.pow(1.05, (state.level - 1));
    const itemBonus = 1 + (itemStats ? (itemStats.moneyBonus || 0) / 100 : 0);
    const currentSalaryRate = Math.floor(baseSalaryPerMin * levelFactor * itemBonus);
    setText("salaryRate", currentSalaryRate.toLocaleString());

    updateStatsTab(state, itemStats, currentSalaryRate);
}

function updateBuffUI(buffs, stress) {
    const buffListEl = document.getElementById("buff-list");
    if (!buffListEl) return;
    buffListEl.innerHTML = '';

    const now = new Date();
    let hasBuffs = false;

    if (buffs) {
        buffs.forEach(buff => {
            const buffInfo = BUFF_DATA[buff.buffId];
            const expiresAt = new Date(buff.expiresAt);
            
            if (expiresAt <= now) return;

            hasBuffs = true;
            const remainingMs = expiresAt - now;
            const remainingMin = Math.floor(remainingMs / 60000);
            const remainingSec = Math.floor((remainingMs % 60000) / 1000);
            const remainingText = `${remainingMin}분 ${remainingSec}초 남음`;

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

    if (stress >= 100) {
        hasBuffs = true;
        const debuffItem = document.createElement('div');
        debuffItem.className = 'debuff-item';
        debuffItem.innerHTML = `
            스트레스 과다
            <span class="buff-tooltip">
                <strong>스트레스 과다 (100%)</strong><br>
                경험치 획득량이 50% 감소합니다.<br>
                휴식이 필요합니다.
            </span>
        `;
        buffListEl.appendChild(debuffItem);
    }

    if (!hasBuffs) {
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
}

function updateStatsTab(state, itemStats, salaryRate) {
    const statsList = document.getElementById("stats-list");
    if (!statsList) return;
    statsList.innerHTML = `
        <tr><td>레벨</td><td>${state.level}</td></tr>
        <tr><td>보유 자산</td><td>₩${Math.floor(state.money).toLocaleString()}</td></tr>
        <tr><td>분당 월급</td><td>₩${salaryRate.toLocaleString()} (기본 + 아이템 보너스)</td></tr>
        <tr><td>스트레스</td><td>${state.stress.toFixed(1)}% (100% 시 경험치 획득량 절반)</td></tr>
        <tr><td>경험치 보너스</td><td>+${itemStats ? (itemStats.expBonus || 0).toFixed(2) : 0}%</td></tr>
        <tr><td>스트레스 감소율</td><td>+${itemStats ? (itemStats.stressReduction || 0).toFixed(2) : 0}%</td></tr>
    `;
}

function updateStressEffect(stress) {
    const gameScreen = document.getElementById("game-screen");
    if (stress >= 90) {
        gameScreen.classList.add("stress-warning");
    } else {
        gameScreen.classList.remove("stress-warning");
    }
}


async function syncUserState() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return;

    const user = JSON.parse(userStr);
    try {
        const res = await fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user._id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || "상태 동기화 실패");

        updateLocalUserState(user, data);
    } catch (err) {
        console.error("상태 동기화 실패:", err);
    }
}

async function updateRankingUI() {
    const rankingListBody = document.getElementById("ranking-list-body");
    if (!rankingListBody) return;

    try {
        const res = await fetch(`${API_URL}/api/ranking`);
        const rankingData = await res.json();

        rankingListBody.innerHTML = '';
        if (rankingData.length === 0) {
            rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">랭킹 정보가 없습니다.</td></tr>';
            return;
        }

        rankingData.forEach((user, index) => {
            // [신규] 랭킹 스타일 클래스 추가
            let rankClass = '';
            if (index === 0) rankClass = 'rank-1';
            else if (index === 1) rankClass = 'rank-2';
            else if (index === 2) rankClass = 'rank-3';

            rankingListBody.innerHTML += `
                <tr class="${rankClass}">
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${user.nickname}</td>
                    <td style="text-align: center;">${user.gameState.level}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("랭킹 업데이트 실패:", err);
        rankingListBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">랭킹 로딩 실패</td></tr>';
    }
}

function startPeriodicUpdates() {
    if (updateInterval) clearInterval(updateInterval);
    if (rankingInterval) clearInterval(rankingInterval);
    if (syncInterval) clearInterval(syncInterval);

    // 버프 남은 시간 표시는 1초마다 갱신
    updateInterval = setInterval(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            updateBuffUI(user.buffs, user.gameState.stress);
        }
    }, 1000);

    // 랭킹은 5초마다 갱신
    updateRankingUI();
    rankingInterval = setInterval(updateRankingUI, 5000);

    // 서버 상태 동기화는 10초마다 실행
    syncUserState();
    syncInterval = setInterval(syncUserState, 10000);
}


// ========================
// 기타 유틸리티
// ========================
const animations = [
    [`  O   \n /|\\  [PC]\n / \\ `, ` \\O   \n  |\\  [PC]\n / \\ `],
    [`  O   \n /|\\  [서류]\n / \\ `, `  O   \n /|\\  ...\n / \\ `],
    [`  O   \n /|\\  (커피)\n / \\ `, `  O \n /|\\  (호록)\n / \\ `]
];

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
};
window.handleBuyClick = handleBuyClick;