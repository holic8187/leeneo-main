// ========================
// 환경 설정
// ========================
// const API_URL = "http://localhost:5000";
const API_URL = "https://leeneo-main.onrender.com";

console.log("🚀 client.js 로드됨. API URL:", API_URL);

// 아이템 데이터 (나중에는 서버에서 받아와야 함)
const ITEM_DATA = {
    'pen_monami': { name: '모나미 볼펜', desc: '월급 +0.05%' },
    'coffee_mix': { name: '맥심 커피믹스', desc: '스트레스 감소율 +2%' }
};


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
    const clickWorkBtn = document.getElementById("clickWorkBtn");
    if (clickWorkBtn) {
        clickWorkBtn.removeEventListener("click", handleClickWork);
        clickWorkBtn.addEventListener("click", handleClickWork);
    }
}


// ========================
// 로그인/로그아웃 함수
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

        // 로그인 성공 처리
        processLoginSuccess(data);

    } catch (err) {
        console.error("로그인 에러:", err);
        alert(`로그인 실패: ${err.message}`);
    }
}

function processLoginSuccess(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    alert(`${data.user.username} 사원님, 환영합니다!`);
    showGameScreen(data.user);
}

function tryAutoLogin() {
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (userStr && token) {
        try {
            const user = JSON.parse(userStr);
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
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    if (animationInterval) clearInterval(animationInterval);
    alert("로그아웃되었습니다.");
}


// ========================
// 액션 처리 함수 ('열일하기')
// ========================
async function handleClickWork() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return handleLogoutClick();
    const user = JSON.parse(userStr);

    // [추가됨] 행동력 체크 (클라이언트 측 선검사)
    if (user.gameState.stamina < 1) {
        alert("행동력이 부족합니다! 내일 다시 시도하거나 휴식을 취하세요.");
        return;
    }

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

        // 유저 정보 업데이트
        user.gameState = data.gameState;
        user.itemStats = data.itemStats;
        localStorage.setItem("user", JSON.stringify(user));

        // UI 업데이트
        updateUI(user.gameState, user.itemStats);
        // [추가됨] 스트레스 경고 효과
        updateStressEffect(user.gameState.stress);

    } catch (err) {
        console.error("작업 요청 실패:", err);
        alert(err.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "🔥 폭풍 서류 작업 (클릭!) 🔥";
        }, 100);
    }
}


// ========================
// 화면 및 UI 업데이트
// ========================
function showGameScreen(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    updateUI(user.gameState, user.itemStats);
    updateInventoryUI(user.inventory); // [추가됨] 인벤토리 UI 업데이트
    updateStressEffect(user.gameState.stress); // [추가됨] 스트레스 효과 업데이트
    startAnimation();
}

function updateUI(state, itemStats) {
    if (!state) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    // 기본 정보 업데이트
    setText("money", state.money.toLocaleString());
    setText("level", state.level);
    setText("stamina", `${state.stamina}/${state.maxStamina}`); // [추가됨] 행동력 표시
    setText("stress", state.stress.toFixed(1)); // [추가됨] 스트레스 표시 (소수점 1자리)

    // 경험치바 업데이트
    const maxExp = 1000; // TODO: 공식 적용 필요
    setText("expText", `${state.exp}/${maxExp}`);
    const expBar = document.getElementById("expBar");
    if (expBar) {
        expBar.max = maxExp;
        expBar.value = state.exp;
    }

    // 월급 계산 (아이템 보너스 적용)
    const baseSalaryPerMin = (2000000 / 24 / 60);
    const levelFactor = Math.pow(1.05, (state.level - 1));
    // [추가됨] 아이템 보너스 적용
    const itemBonus = 1 + (itemStats ? (itemStats.moneyBonus || 0) / 100 : 0);
    const currentSalaryRate = Math.floor(baseSalaryPerMin * levelFactor * itemBonus);
    setText("salaryRate", currentSalaryRate.toLocaleString());

    // [추가됨] 능력치 탭 업데이트
    updateStatsTab(state, itemStats, currentSalaryRate);
}

// [추가됨] 인벤토리 UI 업데이트 함수
function updateInventoryUI(inventory) {
    const inventoryList = document.getElementById("inventory-list");
    if (!inventoryList) return;

    inventoryList.innerHTML = ''; // 기존 목록 초기화

    if (!inventory || inventory.length === 0) {
        inventoryList.innerHTML = '<tr><td colspan="3">가방이 비어있습니다.</td></tr>';
        return;
    }

    inventory.forEach(item => {
        const itemInfo = ITEM_DATA[item.itemId];
        if (itemInfo) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${itemInfo.name}</td>
                <td>${item.quantity}개</td>
                <td>${itemInfo.desc}</td>
            `;
            inventoryList.appendChild(row);
        }
    });
}

// [추가됨] 능력치 탭 UI 업데이트 함수
function updateStatsTab(state, itemStats, salaryRate) {
    const statsList = document.getElementById("stats-list");
    if (!statsList) return;

    statsList.innerHTML = `
        <tr><td>레벨</td><td>${state.level}</td></tr>
        <tr><td>보유 자산</td><td>₩${state.money.toLocaleString()}</td></tr>
        <tr><td>분당 월급</td><td>₩${salaryRate.toLocaleString()} (기본 + 아이템 보너스)</td></tr>
        <tr><td>스트레스</td><td>${state.stress.toFixed(1)}% (100% 시 경험치 획득량 절반)</td></tr>
        <tr><td>경험치 보너스</td><td>+${itemStats ? (itemStats.expBonus || 0).toFixed(2) : 0}%</td></tr>
        <tr><td>스트레스 감소율</td><td>+${itemStats ? (itemStats.stressReduction || 0).toFixed(2) : 0}%</td></tr>
    `;
}

// [추가됨] 스트레스 경고 효과 함수
function updateStressEffect(stress) {
    const gameScreen = document.getElementById("game-screen");
    if (stress >= 90) {
        gameScreen.classList.add("stress-warning");
    } else {
        gameScreen.classList.remove("stress-warning");
    }
}


// ========================
// 기타 유틸리티
// ========================
let animationInterval;
const animations = [
    [`  O   \n /|\\  [PC]\n / \\ `, ` \\O   \n  |\\  [PC]\n / \\ `],
    [`  O   \n /|\\  [서류]\n / \\ `, `  O   \n /|\\  ...\n / \\ `]
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