console.log("🚀 client.js 파일이 로드되어 실행을 시작합니다!"); // <-- 이 줄 추가

// ========================
// 서버 URL 설정
// ========================
// 로컬 테스트 시 아래 주석을 해제하고 사용하세요.
const API_URL = "http://localhost:5000";

// 배포된 서버 URL (로컬 테스트 시에는 주석 처리하는 것이 좋습니다)
// const API_URL = "https://leeneo-main.onrender.com";


// ========================
// 초기화 (페이지 로드 후 실행)
// ========================
// 이 부분이 가장 중요합니다! 페이지가 다 로드된 후 실행되도록 감쌉니다.
window.addEventListener("load", () => {
    console.log("============ 페이지 로드 완료 ============");
    initGame();
});

function initGame() {
    // 1. 로그인 버튼 연결
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        // 기존에 혹시 연결되었을 리스너 제거 (중복 방지)
        loginBtn.removeEventListener("click", login);
        // 새 리스너 연결
        loginBtn.addEventListener("click", login);
        console.log("✅ 로그인 버튼 이벤트 리스너 연결 성공");
    } else {
        console.error("❌ 오류: 'loginBtn' 아이디를 가진 버튼을 찾을 수 없습니다. index.html을 확인해주세요.");
    }

    // 2. 자동 로그인 시도
    console.log("자동 로그인 시도 중...");
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (userStr && token) {
        try {
            const user = JSON.parse(userStr);
            console.log("NOTE: 저장된 유저 정보 발견. 자동 로그인 진행.");
            // 실제로는 토큰 유효성 검사를 서버에 요청해야 하지만, 프로토타입에서는 바로 진입합니다.
            showGame(user);
        } catch (e) {
            console.error("저장된 유저 정보 파싱 실패:", e);
            // 잘못된 정보는 삭제
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    } else {
        console.log("NOTE: 저장된 로그인 정보 없음. 로그인 필요.");
    }
}


// ========================
// 로그인 함수
// ========================
async function login(event) {
    // 폼 제출 기본 동작 막기 (혹시 모를 새로고침 방지)
    if (event) event.preventDefault();

    console.log("▶ 로그인 함수 시작 - 버튼 클릭됨");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    const username = usernameInput.value;
    const password = passwordInput.value;

    console.log(`입력 정보 -> 아이디: ${username}, 비밀번호: ${password ? "입력됨" : "비어있음"}`);

    if (!username || !password) {
        alert("아이디와 비밀번호를 입력하세요");
        console.warn("로그인 실패: 아이디 또는 비밀번호 미입력");
        return;
    }

    console.log(`🚀 서버로 요청 보냄: POST ${API_URL}/api/login`);

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        console.log("📩 서버 응답 받음. 상태 코드:", res.status);

        const data = await res.json();
        console.log("서버 응답 데이터:", data);

        if (!res.ok) {
            // 서버에서 에러 메시지를 보낸 경우
            alert(data.msg || "로그인 실패");
            console.error("로그인 실패 (서버 거부):", data.msg);
            return;
        }

        // ✅ 토큰 및 유저 정보 저장
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        console.log("✅ 로그인 성공! 게임 화면으로 전환합니다.");
        alert(`${data.user.username}님 환영합니다!`);

        // ✅ 화면 전환
        showGame(data.user);

    } catch (err) {
        console.error("🔥 로그인 처리 중 치명적 에러 발생:", err);
        alert(`서버 연결 실패!\n\n서버가 켜져 있는지 확인해주세요.\n에러 내용: ${err.message}`);
    }
}

// ========================
// 게임 화면 표시
// ========================
function showGame(user) {
    const loginScreen = document.getElementById("login-screen");
    const gameScreen = document.getElementById("game-screen");

    if (loginScreen && gameScreen) {
        loginScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        updateUI(user.gameState);
        startAnimation();
    } else {
        console.error("화면 전환 오류: login-screen 또는 game-screen 요소를 찾을 수 없습니다.");
    }
}

// ========================
// UI 업데이트
// ========================
function updateUI(state) {
    // 요소가 존재하는지 안전하게 확인 후 값 업데이트
    const safeUpdate = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    safeUpdate("money", state.money.toLocaleString());
    safeUpdate("level", state.level);
    // 필요한 다른 UI 요소들도 여기에 추가
}

// ========================
// 애니메이션
// ========================
const animations = [
    [
        "  O   \n /|\\  [PC]\n / \\ ",
        " \\O   \n  |\\  [PC]\n / \\ "
    ],
    [
        "  O   \n /|\\  [서류]\n / \\ ",
        "  O   \n /|\\  ...\n / \\ "
    ]
];

let animationInterval;

function startAnimation() {
    const animEl = document.getElementById("anim-display");
    if (!animEl) return;

    // 기존 인터벌이 있다면 제거해서 중복 실행 방지
    if (animationInterval) clearInterval(animationInterval);

    let currentAnim = animations[Math.floor(Math.random() * animations.length)];
    let frame = 0;

    animationInterval = setInterval(() => {
        animEl.textContent = currentAnim[frame];
        frame = (frame + 1) % currentAnim.length;
    }, 500);
}


// ========================
// 탭 전환 함수 (전역 스코프)
// ========================
window.showTab = function (tabName) {
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.menu-content').forEach(el => el.classList.add('hidden'));
    // 모든 탭 버튼 비활성화 표시 제거
    document.querySelectorAll('.menu-tabs button').forEach(el => el.classList.remove('active'));

    // 선택된 탭 컨텐츠 보이기
    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');

    // 클릭된 버튼 활성화 표시 (이벤트 위임 방식이 아니므로 간단히 처리)
    // 실제 구현 시에는 event.target을 활용하는 것이 더 좋습니다.
    const buttons = document.querySelectorAll('.menu-tabs button');
    for (const btn of buttons) {
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
            break;
        }
    }
}