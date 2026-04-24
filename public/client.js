// ========================
// 환경 설정
// ========================
// 로컬 테스트 시 주석 해제, 배포 시 주석 처리
const API_URL = "http://localhost:5000";
// const API_URL = "https://leeneo-main.onrender.com";

console.log("🚀 client.js 로드됨. API URL:", API_URL);


// ========================
// 초기화 (페이지 로드 완료 후 실행)
// ========================
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOMContentLoaded 이벤트 발생: HTML이 모두 로드되었습니다.");
    initGame();
});

function initGame() {
    console.log("🎮 게임 초기화...");

    // 1. 이벤트 리스너 연결 (버튼 클릭 등)
    setupEventListeners();

    // 2. 자동 로그인 시도
    tryAutoLogin();
}

function setupEventListeners() {
    // 로그인 버튼 (출근하기)
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        console.log("👍 '출근하기' 버튼 연결됨");
        loginBtn.removeEventListener("click", handleLoginClick);
        loginBtn.addEventListener("click", handleLoginClick);
    } else {
        console.error("❌ 'loginBtn' 버튼을 찾을 수 없습니다. HTML을 확인해주세요.");
    }

    // [추가됨] 로그아웃 버튼 (퇴근하기)
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        console.log("👍 '퇴근하기' 버튼 연결됨");
        logoutBtn.removeEventListener("click", handleLogoutClick);
        logoutBtn.addEventListener("click", handleLogoutClick);
    } else {
        console.error("❌ 'logoutBtn' 버튼을 찾을 수 없습니다. HTML을 확인해주세요.");
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

    // 탭 전환 버튼들은 window.showTab 함수가 처리합니다.
}


// ========================
// 로그인 관련 함수
// ========================
async function handleLoginClick(event) {
    // 폼 제출 기본 동작 막기
    if (event) event.preventDefault();

    console.log("🖱️ '출근하기' 클릭! 로그인 시도...");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const username = usernameInput.value.trim(); // 공백 제거
    const password = passwordInput.value;

    if (!username || !password) {
        alert("아이디와 비밀번호를 모두 입력해주세요.");
        return;
    }

    try {
        // 서버에 로그인 요청 전송
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.msg || `로그인 실패 (코드: ${res.status})`);
        }

        // 로그인 성공 처리
        console.log("🎉 로그인 성공!");
        processLoginSuccess(data);

    } catch (err) {
        console.error("🔥 로그인 에러:", err);
        alert(`로그인 실패: ${err.message}`);
    }
}

function processLoginSuccess(data) {
    // 토큰 및 유저 정보 저장
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    console.log("🔑 로그인 정보 저장 완료.");

    // 알림 및 화면 전환
    alert(`${data.user.username} 사원님, 환영합니다! (초기자금 10만원 지급됨)`);
    showGameScreen(data.user);
}

function tryAutoLogin() {
    console.log("🔄 자동 로그인 시도 중...");
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (userStr && token) {
        try {
            const user = JSON.parse(userStr);
            console.log(`✅ 자동 로그인: ${user.username}`);
            // TODO: 실제 서비스에서는 토큰 유효성 검증 API 호출 필요
            showGameScreen(user);
        } catch (e) {
            console.error("❌ 로그인 정보 손상됨:", e);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    } else {
        console.log("ℹ️ 저장된 로그인 정보 없음.");
    }
}


// ========================
// [추가됨] 로그아웃 처리 함수 ('퇴근하기' 클릭)
// ========================
function handleLogoutClick() {
    console.log("👋 '퇴근하기' 클릭! 로그아웃 절차를 시작합니다.");

    // 1. 로컬 스토리지에서 로그인 정보 삭제
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    console.log("✅ 로컬 스토리지의 로그인 정보가 삭제되었습니다.");

    // 2. 화면 전환 (게임 화면 숨기기, 로그인 화면 보이기)
    const loginScreen = document.getElementById("login-screen");
    const gameScreen = document.getElementById("game-screen");

    if (loginScreen && gameScreen) {
        gameScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        
        // 3. 로그인 폼 초기화 (아이디/비번 입력창 비우기)
        document.getElementById("username").value = "";
        document.getElementById("password").value = "";

        // 4. 애니메이션 정지
        if (animationInterval) clearInterval(animationInterval);

        console.log("🖥️ 초기 로그인 화면으로 돌아왔습니다.");
        alert("정상적으로 퇴근(로그아웃) 처리되었습니다. 수고하셨습니다!");
    } else {
        console.error("❌ 화면 전환 실패: 필요한 HTML 요소를 찾을 수 없습니다.");
    }
}


// ========================
// [추가됨] 액션 처리 함수 ('열일하기' 클릭)
// ========================
async function handleClickWork() {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
        alert("로그인이 필요합니다.");
        handleLogoutClick(); // 로그인 화면으로 돌려보냄
        return;
    }
    const user = JSON.parse(userStr);
    const userId = user._id;

    console.log("🔥 '폭풍 서류 작업' 클릭! 서버에 요청 보냄...");

    // 버튼 임시 비활성화 (중복 클릭 방지)
    const btn = document.getElementById("clickWorkBtn");
    btn.disabled = true;
    btn.textContent = "🔥 처리중... 🔥";

    try {
        const res = await fetch(`${API_URL}/api/action/work`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
                // 추후에는 여기에 "Authorization": `Bearer ${localStorage.getItem("token")}` 추가 필요
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
        // 버튼 다시 활성화 (약간의 딜레이를 줌)
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "🔥 폭풍 서류 작업 (클릭!) 🔥";
        }, 100);
    }
}


// ========================
// 화면 전환 및 UI 업데이트
// ========================
function showGameScreen(user) {
    const loginScreen = document.getElementById("login-screen");
    const gameScreen = document.getElementById("game-screen");

    if (loginScreen && gameScreen) {
        loginScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        updateUI(user.gameState);
        startAnimation();
    } else {
        console.error("❌ 화면 전환 실패: 필요한 HTML 요소를 찾을 수 없습니다.");
    }
}

function updateUI(state) {
    if (!state) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
        else console.warn(`⚠️ UI 업데이트 실패: 요소 #${id}를 찾을 수 없습니다.`);
    };

    // 돈 업데이트 (콤마 표시)
    setText("money", state.money ? state.money.toLocaleString() : 0);
    
    // 레벨 업데이트
    setText("level", state.level || 1);
    
    // 경험치 업데이트 (텍스트 및 프로그레스 바)
    const maxExp = 1000; // TODO: 레벨별 필요 경험치 공식 적용 필요
    setText("expText", `${state.exp || 0}/${maxExp}`);
    const expBar = document.getElementById("expBar");
    if (expBar) {
        expBar.max = maxExp;
        expBar.value = state.exp || 0;
    }

    // 분당 예상 월급 표시 (기획 수치 기반 계산)
    const baseSalaryPerMin = (2000000 / 24 / 60); // 약 1388.88...
    const levelFactor = Math.pow(1.05, (state.level || 1) - 1);
    const currentSalaryRate = Math.floor(baseSalaryPerMin * levelFactor);
    setText("salaryRate", currentSalaryRate.toLocaleString());

    // 기타 정보 (추후 구현)
    // setText("stamina", state.stamina);
    // setText("stress", state.stress);
}


// ========================
// 애니메이션 및 탭 기능
// ========================
let animationInterval;
// 백틱(`)을 사용하여 여러 줄 문자열을 안전하게 정의합니다.
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

    console.log("🎬 업무 애니메이션 시작");
    animationInterval = setInterval(() => {
        animEl.textContent = currentAnim[frame];
        frame = (frame + 1) % currentAnim.length;
    }, 500);
}

// 탭 전환 함수 (전역 스코프에 노출)
window.showTab = function(tabName) {
    document.querySelectorAll('.menu-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-tabs button').forEach(el => el.classList.remove('active'));

    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');

    // 클릭된 버튼 활성화 처리 (간단한 방식)
    const btns = document.getElementsByTagName('button');
    for (let btn of btns) {
        if (btn.getAttribute('onclick') === `showTab('${tabName}')`) {
            btn.classList.add('active');
            break;
        }
    }
};