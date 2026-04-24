// ========================
// 환경 설정
// ========================
const API_URL = "http://localhost:5000"; // 로컬 테스트용
console.log("🚀 client.js 로드됨. API URL:", API_URL);


// ========================
// 초기화
// ========================
document.addEventListener("DOMContentLoaded", () => {
    initGame();
});

function initGame() {
    console.log("🎮 게임 초기화...");

    // 1. 이벤트 리스너 연결
    setupEventListeners();

    // 2. 자동 로그인 시도
    tryAutoLogin();
}

function setupEventListeners() {
    // 로그인 버튼
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        loginBtn.removeEventListener("click", handleLoginClick);
        loginBtn.addEventListener("click", handleLoginClick);
    }

    // [추가됨] '열일하기' 버튼 (폭풍 서류 작업)
    const clickWorkBtn = document.getElementById("clickWorkBtn");
    if (clickWorkBtn) {
        console.log("👍 '열일하기' 버튼 연결됨");
        clickWorkBtn.removeEventListener("click", handleClickWork);
        clickWorkBtn.addEventListener("click", handleClickWork);
    } else {
        console.error("❌ 'clickWorkBtn' 버튼을 찾을 수 없습니다.");
    }

    // 탭 전환 버튼들 (기존 방식 유지)
    // window.showTab 함수가 처리함
}


// ========================
// 로그인 관련 함수
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

        if (!res.ok) throw new Error(data.msg);

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        alert(`${data.user.username} 사원님, 환영합니다! (초기자금 지급 완료)`);
        showGameScreen(data.user);

    } catch (err) {
        console.error("로그인 에러:", err);
        alert(`로그인 실패: ${err.message}`);
    }
}

function tryAutoLogin() {
    const userStr = localStorage.getItem("user");
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            console.log(`✅ 자동 로그인: ${user.username}`);
            showGameScreen(user);
        } catch (e) {
            localStorage.removeItem("user");
        }
    }
}


// ========================
// [추가됨] 액션 처리 함수 ('열일하기' 클릭)
// ========================
async function handleClickWork() {
    // 현재 로그인한 유저 정보 가져오기
    const userStr = localStorage.getItem("user");
    if (!userStr) {
        alert("로그인이 필요합니다.");
        // 로그인 화면으로 돌려보내는 로직 추가 가능
        return;
    }
    const user = JSON.parse(userStr);
    const userId = user._id; // 서버에서 받아온 유저 고유 ID

    console.log("🔥 '폭풍 서류 작업' 클릭! 서버에 요청 보냄...");

    // 버튼 임시 비활성화 (중복 클릭 방지 효과)
    const btn = document.getElementById("clickWorkBtn");
    btn.disabled = true;
    btn.textContent = "🔥 처리중... 🔥";

    try {
        // 서버의 '열일하기' API 호출
        const res = await fetch(`${API_URL}/api/action/work`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
                // 추후에는 여기에 토큰 인증 헤더를 추가해야 보안상 안전합니다.
                // "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ userId: userId })
        });

        const updatedGameState = await res.json();

        if (!res.ok) throw new Error(updatedGameState.msg || "작업 실패");

        console.log("✅ 작업 성공! 경험치 획득.", updatedGameState);

        // 로컬 스토리지의 유저 정보도 최신 상태로 업데이트
        user.gameState = updatedGameState;
        localStorage.setItem("user", JSON.stringify(user));

        // UI 즉시 업데이트
        updateUI(updatedGameState);

    } catch (err) {
        console.error("작업 요청 실패:", err);
        // alert(`작업 실패: ${err.message}`); // 너무 자주 뜨면 귀찮으니 콘솔에만 표시
    } finally {
        // 버튼 다시 활성화
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "🔥 폭풍 서류 작업 (클릭!) 🔥";
        }, 100); // 약간의 딜레이를 주어 클릭감을 줌
    }
}


// ========================
// 화면 및 UI 업데이트
// ========================
function showGameScreen(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    updateUI(user.gameState);
    startAnimation();
}

function updateUI(state) {
    if (!state) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    // 돈 업데이트 (콤마 표시)
    setText("money", state.money ? state.money.toLocaleString() : 0);
    
    // 레벨 업데이트
    setText("level", state.level || 1);
    
    // 경험치 업데이트 (텍스트 및 프로그레스 바)
    // TODO: 현재 레벨업 필요 경험치는 1000으로 고정됨. 추후 공식에 따라 계산 필요.
    const maxExp = 1000; // 임시 고정값
    setText("expText", `${state.exp || 0}/${maxExp}`);
    const expBar = document.getElementById("expBar");
    if (expBar) {
        expBar.max = maxExp;
        expBar.value = state.exp || 0;
    }

    // [추가됨] 분당 예상 월급 표시 (기획 수치 기반 계산)
    // 1레벨 기준 분당 약 1389원, 레벨당 5% 증가
    const baseSalaryPerMin = (2000000 / 24 / 60); // 약 1388.88...
    const levelFactor = Math.pow(1.05, (state.level || 1) - 1);
    const currentSalaryRate = Math.floor(baseSalaryPerMin * levelFactor);
    setText("salaryRate", currentSalaryRate.toLocaleString());

    // 기타 정보 (추후 구현 시 주석 해제)
    // setText("stamina", state.stamina);
    // setText("stress", state.stress);
}


// ========================
// 기타 유틸리티 (애니메이션, 탭)
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